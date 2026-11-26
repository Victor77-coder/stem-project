/**
 * Contrato do futuro GET /centros?lat=&lng=&q=&kind=&perfil=.
 * Fixture mínimo para as telas; a coleta CNES entra no Django e substitui CENTERS.
 */
import type { ProfileType } from '@/context/RegistrationContext';

export type CenterKind = 'hemocentro' | 'transplante' | 'campanha';
export type CenterFilter = 'todos' | CenterKind;

export type Origin = {
  lat: number;
  lng: number;
  label: string;
  city: string;
  uf: string;
  mode: 'gps' | 'cep';
};

export type Center = {
  id: string;
  cnes?: string;
  name: string;
  shortName: string;
  address: string;
  listAddress: string;
  city: string;
  uf: string;
  kind: CenterKind;
  lat: number;
  lng: number;
  hours?: string;
  phone?: string;
  source: string;
  sourceDate: string;
  eventWhen?: string;
  services: string[];
  openNow?: boolean;
};

export type CenterResult = Center & { km: number; distance: string };

export const FILTERS: { id: CenterFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'hemocentro', label: 'Hemocentros' },
  { id: 'transplante', label: 'Transplante' },
  { id: 'campanha', label: 'Campanhas' },
];

/** O doador vê onde se cadastrar; o receptor, onde se trata. O convidado vê tudo. Igual ao ?perfil= da API. */
export const KINDS_FOR: Record<ProfileType, CenterKind[]> = {
  doador: ['hemocentro', 'campanha'],
  receptor: ['transplante'],
  convidado: ['hemocentro', 'transplante', 'campanha'],
};

/** Filtros do perfil. Com um tipo só, não há o que filtrar. */
export function filtersFor(profile: ProfileType) {
  const kinds = KINDS_FOR[profile];
  return kinds.length > 1 ? FILTERS.filter((item) => item.id === 'todos' || kinds.includes(item.id)) : [];
}

/** Um filtro de outro perfil (ex.: "Transplante" para o doador) volta para "Todos". */
export function filterOf(profile: ProfileType, value: CenterFilter): CenterFilter {
  return value === 'todos' || KINDS_FOR[profile].includes(value) ? value : 'todos';
}

export const KIND_LABEL: Record<CenterKind, string> = {
  hemocentro: 'Hemocentro',
  transplante: 'Transplante',
  campanha: 'Campanha',
};

export const RADIUS_KM = 50;

/** Origem de reserva: busca por nome de cidade e modo sem servidor. GPS e CEP usam coordenadas reais. */
export const ORIGINS = {
  maceio: { lat: -9.6658, lng: -35.735, label: 'Maceió/AL', city: 'Maceió', uf: 'AL' },
  recife: { lat: -8.0476, lng: -34.877, label: 'Recife/PE', city: 'Recife', uf: 'PE' },
} as const;

const SOURCE = 'CNES/DataSUS';
const SOURCE_DATE = '30/09/2026';
const HEMO_SERVICES = ['Doação de sangue', 'Cadastro de medula (REDOME)', 'Coleta HLA'];

export const CENTERS: Center[] = [
  {
    id: 'hemoal-trapiche',
    name: 'Hemoal · Hemocentro de Alagoas',
    shortName: 'Hemoal · Trapiche',
    address: 'Av. Jorge de Lima, 58 · Trapiche da Barra',
    listAddress: 'Av. Jorge de Lima, 58 · Trapiche',
    city: 'Maceió',
    uf: 'AL',
    kind: 'hemocentro',
    lat: -9.6725,
    lng: -35.7583,
    hours: 'Seg a sex · 7h às 18h · Sáb · 7h às 12h',
    phone: '(82) 3315-2102',
    source: SOURCE,
    sourceDate: SOURCE_DATE,
    services: HEMO_SERVICES,
    openNow: true,
  },
  {
    id: 'hemoal-sede',
    cnes: '2003899',
    name: 'Hemoal · Sede',
    shortName: 'Hemoal · Sede',
    address: 'Av. Menino Marcelo, 9974 · Cidade Universitária',
    listAddress: 'Av. Menino Marcelo, 9974 · Cidade Universitária',
    city: 'Maceió',
    uf: 'AL',
    kind: 'hemocentro',
    lat: -9.555,
    lng: -35.77,
    hours: 'Seg a sex · 7h às 18h',
    phone: '(82) 3373-9628',
    source: SOURCE,
    sourceDate: SOURCE_DATE,
    services: HEMO_SERVICES,
    openNow: true,
  },
  // Sem campanhas: elas têm data de término e o dado embarcado não expira. Campanha só vem da API.
  {
    id: 'hemope',
    cnes: '0000809',
    name: 'Hemope · Fundação de Hematologia de Pernambuco',
    shortName: 'Hemope · Recife',
    address: 'Rua Joaquim Nabuco, 171 · Graças',
    listAddress: 'Rua Joaquim Nabuco, 171 · Graças',
    city: 'Recife',
    uf: 'PE',
    kind: 'hemocentro',
    lat: -8.0479,
    lng: -34.8981,
    hours: 'Consulte o horário no hemocentro',
    phone: '(81) 3182-4695',
    source: SOURCE,
    sourceDate: SOURCE_DATE,
    services: HEMO_SERVICES,
    openNow: true,
  },
];

/** Origem offline: o dado embarcado só tem Maceió e Recife. Outra cidade é null, nunca Maceió por engano. */
export function originFromQuery(value: string): Origin | null {
  const raw = value.trim().toLowerCase();
  const digits = raw.replace(/\D/g, '');
  if (raw.includes('recife') || digits.startsWith('50')) {
    return { ...ORIGINS.recife, mode: 'cep' };
  }
  if (/macei[oó]/.test(raw) || digits.startsWith('57')) {
    return { ...ORIGINS.maceio, mode: 'cep' };
  }
  return null;
}

export function listCenters(origin: Origin, kind: CenterFilter, query = '', kinds = KINDS_FOR.convidado): CenterResult[] {
  const needle = query.trim().toLowerCase();
  return CENTERS.filter((center) => {
    if (!kinds.includes(center.kind)) return false;
    if (kind !== 'todos' && center.kind !== kind) return false;
    const km = haversineKm(origin, center);
    if (km > RADIUS_KM) return false;
    if (!needle) return true;
    return `${center.name} ${center.address} ${center.listAddress} ${center.city} ${center.cnes ?? ''}`.toLowerCase().includes(needle);
  })
    .map((center) => {
      const km = haversineKm(origin, center);
      return { ...center, km, distance: formatDistance(km) };
    })
    .sort((a, b) => a.km - b.km);
}

export function centerById(id: string, origin: Origin): CenterResult | undefined {
  const center = CENTERS.find((item) => item.id === id);
  if (!center) return undefined;
  const km = haversineKm(origin, center);
  return { ...center, km, distance: formatDistance(km) };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}
