export type NoticeKind = 'campanha' | 'evento' | 'comunicado';

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  origin: string;
  when: string;
  group: 'hoje' | 'semana';
  read: boolean;
};

export const KIND_LABEL: Record<NoticeKind, string> = {
  campanha: 'Campanha',
  evento: 'Evento',
  comunicado: 'Comunicado',
};

export const YEARS = ['2025', '2024', '2023'] as const;
export type StatYear = (typeof YEARS)[number];

export const UFS = [
  ['AC', 'Acre', 'Norte'],
  ['AL', 'Alagoas', 'Nordeste'],
  ['AP', 'Amapá', 'Norte'],
  ['AM', 'Amazonas', 'Norte'],
  ['BA', 'Bahia', 'Nordeste'],
  ['CE', 'Ceará', 'Nordeste'],
  ['DF', 'Distrito Federal', 'Centro-Oeste'],
  ['ES', 'Espírito Santo', 'Sudeste'],
  ['GO', 'Goiás', 'Centro-Oeste'],
  ['MA', 'Maranhão', 'Nordeste'],
  ['MT', 'Mato Grosso', 'Centro-Oeste'],
  ['MS', 'Mato Grosso do Sul', 'Centro-Oeste'],
  ['MG', 'Minas Gerais', 'Sudeste'],
  ['PA', 'Pará', 'Norte'],
  ['PB', 'Paraíba', 'Nordeste'],
  ['PR', 'Paraná', 'Sul'],
  ['PE', 'Pernambuco', 'Nordeste'],
  ['PI', 'Piauí', 'Nordeste'],
  ['RJ', 'Rio de Janeiro', 'Sudeste'],
  ['RN', 'Rio Grande do Norte', 'Nordeste'],
  ['RS', 'Rio Grande do Sul', 'Sul'],
  ['RO', 'Rondônia', 'Norte'],
  ['RR', 'Roraima', 'Norte'],
  ['SC', 'Santa Catarina', 'Sul'],
  ['SP', 'São Paulo', 'Sudeste'],
  ['SE', 'Sergipe', 'Nordeste'],
  ['TO', 'Tocantins', 'Norte'],
] as const;

export type RegionName = 'Sudeste' | 'Sul' | 'Nordeste' | 'Centro-Oeste' | 'Norte';

const REGION_OF = Object.fromEntries(UFS.map(([uf, , region]) => [uf, region])) as Record<string, RegionName>;

const YEAR_SCALE: Record<StatYear, number> = {
  '2025': 1,
  '2024': 0.9,
  '2023': 0.82,
};

const HEADLINES: Record<StatYear, { donors: string; transplants: string }> = {
  '2025': { donors: '5,7 mi', transplants: '3,4 mil' },
  '2024': { donors: '5,4 mi', transplants: '3,1 mil' },
  '2023': { donors: '5,1 mi', transplants: '2,9 mil' },
};

export const REGION_BASE: { name: RegionName; value: number }[] = [
  { name: 'Sudeste', value: 1820 },
  { name: 'Sul', value: 720 },
  { name: 'Nordeste', value: 510 },
  { name: 'Centro-Oeste', value: 230 },
  { name: 'Norte', value: 120 },
];

export function regionOf(uf: string): RegionName {
  return REGION_OF[uf] ?? 'Nordeste';
}

export function headline(year: StatYear) {
  return HEADLINES[year];
}

export function regionBars(year: StatYear) {
  const scale = YEAR_SCALE[year];
  return REGION_BASE.map((item) => ({ ...item, value: Math.round(item.value * scale) }));
}
