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

export const INBOX: Notice[] = [
  {
    id: 'mutirao',
    kind: 'campanha',
    title: 'Mutirão de cadastro de medula',
    body: 'Sábado, 25/10, no Hemoal Maceió. Leve documento com foto.',
    origin: 'Hemoal',
    when: '09:12',
    group: 'hoje',
    read: false,
  },
  {
    id: 'semana',
    kind: 'evento',
    title: 'Semana Nacional de Doação',
    body: 'Palestras abertas sobre células-tronco no Cesmac.',
    origin: 'Ministério da Saúde',
    when: '08:30',
    group: 'hoje',
    read: false,
  },
  {
    id: 'redome',
    kind: 'comunicado',
    title: 'Novo protocolo do REDOME',
    body: 'Atualização nas regras de permanência no cadastro.',
    origin: 'INCA',
    when: '14/10',
    group: 'semana',
    read: true,
  },
  {
    id: 'inverno',
    kind: 'campanha',
    title: 'Campanha de inverno',
    body: 'Estoques de sangue baixos em Alagoas.',
    origin: 'Hemoal',
    when: '13/10',
    group: 'semana',
    read: true,
  },
];

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

const WAIT: Record<RegionName, string> = {
  Sudeste: '3,6 meses',
  Sul: '4,1 meses',
  Nordeste: '4,8 meses',
  'Centro-Oeste': '5,2 meses',
  Norte: '6,1 meses',
};

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

export function waitFor(uf: string) {
  return WAIT[regionOf(uf)];
}

export function regionBars(year: StatYear) {
  const scale = YEAR_SCALE[year];
  return REGION_BASE.map((item) => ({ ...item, value: Math.round(item.value * scale) }));
}
