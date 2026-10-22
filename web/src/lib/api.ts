const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const TOKENS_KEY = 'stem:tokens'

type Tokens = { access: string; refresh: string }

export class ApiError extends Error {
  status: number
  fields: Record<string, string[]>

  constructor(status: number, body: unknown) {
    const data = (body ?? {}) as Record<string, unknown>
    const fields: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) fields[key] = value.map(String)
    }
    const detail = typeof data.detail === 'string' ? data.detail : Object.values(fields)[0]?.[0]
    super(detail ?? 'Não foi possível concluir a ação. Tente novamente.')
    this.status = status
    this.fields = fields
  }
}

export const tokens = {
  get(): Tokens | null {
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  },
  set(value: Tokens | null) {
    if (value) localStorage.setItem(TOKENS_KEY, JSON.stringify(value))
    else localStorage.removeItem(TOKENS_KEY)
  },
}

let refreshing: Promise<boolean> | null = null

async function refreshAccess(): Promise<boolean> {
  const current = tokens.get()
  if (!current) return false
  refreshing ??= fetch(`${BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: current.refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      const data = (await res.json()) as Partial<Tokens>
      tokens.set({ access: data.access!, refresh: data.refresh ?? current.refresh })
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type Options = { method?: string; body?: unknown; auth?: boolean }

export async function api<T = unknown>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {}
    const access = auth ? tokens.get()?.access : undefined
    if (access) headers.Authorization = `Bearer ${access}`
    let payload: BodyInit | undefined
    if (body instanceof FormData) payload = body
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }
    return fetch(`${BASE}${path}`, { method, headers, body: payload })
  }

  let res: Response
  try {
    res = await send()
    if (res.status === 401 && auth && (await refreshAccess())) res = await send()
  } catch {
    throw new ApiError(0, { detail: 'Sem conexão com o servidor. Verifique a internet e tente novamente.' })
  }
  if (res.status === 401 && auth) tokens.set(null)
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
