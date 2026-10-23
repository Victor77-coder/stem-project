/**
 * Contrato do futuro GET /centros?lat=&lng=&q=&kind=.
 * Fixture mínimo para as telas; a coleta CNES entra no Django e substitui CENTERS.
 */

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
  {
    id: 'hupaa',
    cnes: '2006197',
    name: 'Hospital Universitário (HUPAA)',
    shortName: 'HUPAA',
    address: 'Av. Lourival Melo Mota, s/n · Tabuleiro do Martins',
    listAddress: 'Av. Lourival Melo Mota · Tabuleiro',
    city: 'Maceió',
    uf: 'AL',
    kind: 'transplante',
    lat: -9.5556,
    lng: -35.7778,
    hours: 'Atendimento hospitalar 24h',
    phone: '(82) 3214-1100',
    source: SOURCE,
    sourceDate: SOURCE_DATE,
    services: ['Transplante de medula', 'Acompanhamento hospitalar'],
    openNow: true,
  },
  {
    id: 'mutirao-hemoal',
    name: 'Mutirão de cadastro de doadores de medula',
    shortName: 'Mutirão de cadastro',
    address: 'Hemoal · Av. Jorge de Lima, 58 · Trapiche da Barra',
    listAddress: 'Hemoal · Trapiche',
    city: 'Maceió',
    uf: 'AL',
    kind: 'campanha',
    lat: -9.6724,
    lng: -35.7578,
    eventWhen: '25 out · 8h–16h',
    source: 'Ministério da Saúde',
    sourceDate: '12/10/2026',
    services: ['Cadastro de medula (REDOME)'],
  },
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

export function originFromCity(city: string, uf: string, mode: Origin['mode'] = 'cep'): Origin {
  const recife = city.toLowerCase().includes('recife') || uf.toUpperCase() === 'PE';
  const base = recife ? ORIGINS.recife : ORIGINS.maceio;
  return { ...base, mode };
}

export function originFromQuery(value: string): Origin {
  const raw = value.trim().toLowerCase();
  const digits = raw.replace(/\D/g, '');
  if (raw.includes('recife') || digits.startsWith('50')) {
    return { ...ORIGINS.recife, mode: 'cep' };
  }
  return { ...ORIGINS.maceio, mode: 'cep' };
}

export function listCenters(origin: Origin, kind: CenterFilter, query = ''): CenterResult[] {
  const needle = query.trim().toLowerCase();
  return CENTERS.filter((center) => {
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
