import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Em aparelho físico, aponte EXPO_PUBLIC_API_URL para o IP da máquina na rede (ex.: http://192.168.0.10:8000/api/v1).
const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://localhost:8000/api/v1');

const TOKENS_KEY = 'stem.tokens';

export const channel: 'android' | 'ios' | 'web' = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'web';

export type Tokens = { access: string; refresh: string };

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;

  constructor(status: number, body: unknown) {
    const data = (body ?? {}) as Record<string, unknown>;
    const fields: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
    }
    const detail = typeof data.detail === 'string' ? data.detail : Object.values(fields)[0]?.[0];
    super(detail ?? 'Não foi possível concluir agora. Tente novamente.');
    this.status = status;
    this.fields = fields;
  }
}

let memory: Tokens | null = null;

export const tokenStore = {
  async load(): Promise<Tokens | null> {
    const raw =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(TOKENS_KEY) : await SecureStore.getItemAsync(TOKENS_KEY);
    memory = raw ? (JSON.parse(raw) as Tokens) : null;
    return memory;
  },
  async save(value: Tokens | null) {
    memory = value;
    if (Platform.OS === 'web') {
      if (value) globalThis.localStorage?.setItem(TOKENS_KEY, JSON.stringify(value));
      else globalThis.localStorage?.removeItem(TOKENS_KEY);
      return;
    }
    if (value) await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(value));
    else await SecureStore.deleteItemAsync(TOKENS_KEY);
  },
  get: () => memory,
};

let refreshing: Promise<boolean> | null = null;

function refreshAccess(): Promise<boolean> {
  const current = memory;
  if (!current) return Promise.resolve(false);
  refreshing ??= fetch(`${BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: current.refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = (await res.json()) as Partial<Tokens>;
      await tokenStore.save({ access: data.access!, refresh: data.refresh ?? current.refresh });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = unknown>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {};
    if (auth && memory) headers.Authorization = `Bearer ${memory.access}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth && memory && (await refreshAccess())) res = await send();
  } catch {
    throw new ApiError(0, { detail: 'Sem conexão com o servidor. Verifique a internet e tente novamente.' });
  }
  if (res.status === 401 && auth && memory) await tokenStore.save(null);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Catálogo público: se a API estiver fora do ar, a tela usa o conteúdo embarcado no app (modo degradado). */
export async function withFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}
