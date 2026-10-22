import type { ProfileType } from '@/context/RegistrationContext';

export const PROFILE_COMORBIDITIES = ['Nenhuma', 'Hipertensão', 'Diabetes', 'Cardiopatia', 'Outra'];

export const COLLECTED = [
  'Peso, altura e sexo biológico',
  'Comorbidades informadas por você',
  'CEP (sem histórico de rotas)',
];

export const GLOSSARY = [
  {
    term: 'HLA',
    body: 'Antígenos leucocitários humanos. São as características genéticas usadas para comparar quem doa e quem recebe. A compatibilidade não depende do tipo sanguíneo.',
  },
  {
    term: 'REDOME',
    body: 'Registro Nacional de Doadores Voluntários de Medula Óssea. É o cadastro brasileiro consultado pelo SUS na busca de doador compatível.',
  },
  {
    term: 'TCTH',
    body: 'Transplante de células-tronco hematopoéticas. Pode usar células da medula óssea, do sangue periférico ou do cordão umbilical.',
  },
];

export const TEAM = [
  { name: 'Daniel Ferreira', role: 'Desenvolvedor' },
  { name: 'Victor Medeiros', role: 'Desenvolvedor' },
];

export type HistoryIcon = 'pulse' | 'shield' | 'person';

export type HistoryEvent = {
  id: string;
  icon: HistoryIcon;
  title: string;
  detail: string;
  when: string;
};

const DONOR_HISTORY: HistoryEvent[] = [
  { id: 'peso', icon: 'pulse', title: 'Peso alterado', detail: '70 kg → 68 kg', when: '17/10/2026 · 10:42' },
  { id: 'comorb', icon: 'pulse', title: 'Comorbidade adicionada', detail: 'Hipertensão', when: '17/10/2026 · 10:42' },
  { id: 'tcle', icon: 'shield', title: 'TCLE aceito', detail: 'Versão 1.0', when: '01/10/2026 · 21:15' },
  { id: 'conta', icon: 'person', title: 'Conta criada', detail: 'Perfil Doador', when: '01/10/2026 · 21:10' },
];

export function seedHistory(profile: ProfileType): HistoryEvent[] {
  if (profile === 'leigo') {
    return [{ id: 'conta', icon: 'person', title: 'Conta criada', detail: 'Perfil Leigo', when: '17/10/2026 · 21:10' }];
  }
  if (profile === 'receptor') {
    return DONOR_HISTORY.map((event) =>
      event.id === 'conta' ? { ...event, detail: 'Perfil Receptor' } : event,
    );
  }
  return DONOR_HISTORY;
}
