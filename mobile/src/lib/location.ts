import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { originFromQuery, type Origin } from '@/content/centers';
import { api, ApiError } from '@/lib/api';

/** RF009: as coordenadas do aparelho só existem em memória; nada aqui é gravado ou enviado ao perfil. */

export type DeviceOriginResult =
  | { ok: true; origin: Origin }
  | { ok: false; reason: 'denied'; canAskAgain: boolean }
  | { ok: false; reason: 'unavailable' };

const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const FIX_TIMEOUT_MS = 10_000;

const UF_BY_STATE: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function toUf(region: string | null) {
  if (!region) return '';
  if (/^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  const key = region.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return UF_BY_STATE[key] ?? '';
}

export async function hasLocationPermission() {
  const { granted } = await Location.getForegroundPermissionsAsync();
  return granted;
}

export async function requestLocationPermission() {
  const { granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  return { granted, canAskAgain };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function currentCoords() {
  const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
  if (last) return last.coords;
  const fix = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    FIX_TIMEOUT_MS,
  );
  return fix?.coords ?? null;
}

async function labelFor(lat: number, lng: number) {
  if (Platform.OS === 'web') return { city: '', uf: '' };
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return { city: place?.city ?? place?.subregion ?? '', uf: toUf(place?.region ?? null) };
  } catch {
    return { city: '', uf: '' };
  }
}

/** Pede a permissão (se ainda não houver) e devolve a posição atual como origem da busca de centros. */
export async function requestDeviceOrigin(): Promise<DeviceOriginResult> {
  const permission = await requestLocationPermission().catch(() => ({ granted: false, canAskAgain: false }));
  if (!permission.granted) return { ok: false, reason: 'denied', canAskAgain: permission.canAskAgain };
  const coords = await currentCoords();
  if (!coords) return { ok: false, reason: 'unavailable' };
  const { city, uf } = await labelFor(coords.latitude, coords.longitude);
  return {
    ok: true,
    origin: {
      lat: coords.latitude,
      lng: coords.longitude,
      label: city && uf ? `${city}/${uf}` : 'Sua localização',
      city,
      uf,
      mode: 'gps',
    },
  };
}

type CepLocation = {
  cep: string;
  address: string;
  district: string;
  city: string;
  uf: string;
  lat: number;
  lng: number;
  precision: 'cep' | 'cidade';
};

export type CepOriginResult = { ok: true; origin: Origin; offline?: boolean } | { ok: false; message: string };

/** CEP vira coordenada no backend (BrasilAPI + centro da cidade). Sem servidor, cai no fixture embarcado. */
export async function originFromCep(value: string): Promise<CepOriginResult> {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return { ok: true, origin: originFromQuery(value) };
  try {
    const data = await api<CepLocation>(`/geo/cep/${digits}/`, { auth: false });
    const label = `${data.city}/${data.uf}`;
    return {
      ok: true,
      origin: { lat: data.lat, lng: data.lng, label, city: data.city, uf: data.uf, mode: 'cep' },
    };
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0 && error.status < 500) {
      return { ok: false, message: error.message };
    }
    return { ok: true, origin: originFromQuery(value), offline: true };
  }
}
