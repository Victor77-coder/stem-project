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
  /** Quem fez a alteração: "Você", "Equipe STEM" ou "Sistema" (RF001, RNF10). */
  by?: string;
};

