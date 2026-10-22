export type JourneyKind = 'doador' | 'receptor';
export type RegionId = 'maceio' | 'recife' | 'outra';
export type StepState = 'done' | 'current' | 'pending';

export type ChecklistItem = { label: string };

export type JourneyPlace = {
  name: string;
  address: string;
  distance?: string;
};

export type JourneyStep = {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  homeBody?: string;
  body: string;
  checklist?: ChecklistItem[];
  place?: JourneyPlace;
  source: string;
};

export const SOURCE = 'Ministério da Saúde · Protocolo vigente em 10/2026';

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'maceio', label: 'Maceió/AL' },
  { id: 'recife', label: 'Recife/PE' },
  { id: 'outra', label: 'Outra' },
];

const HEMOAL: JourneyPlace = {
  name: 'Hemoal · Maceió',
  address: 'Av. Jorge de Lima, 58',
  distance: '3,2 km',
};

const HEMOPE: JourneyPlace = {
  name: 'Hemope · Recife',
  address: 'Rua Joaquim Nabuco, 171',
  distance: 'centro',
};

export const DONOR_STEPS: JourneyStep[] = [
  {
    id: 'cadastro',
    title: 'Cadastro no hemocentro',
    shortTitle: 'Cadastro no hemocentro',
    summary: 'Preencha a ficha e apresente documento com foto.',
    body: 'O cadastro de doador de medula é feito em hemocentro. Você preenche uma ficha, apresenta um documento oficial com foto e autoriza o uso dos dados no REDOME.',
    checklist: [
      { label: 'Documento oficial com foto' },
      { label: 'Ter entre 18 e 35 anos no cadastro' },
      { label: 'Estar em boas condições de saúde' },
    ],
    place: HEMOAL,
    source: SOURCE,
  },
  {
    id: 'coleta',
    title: 'Coleta de amostra (HLA)',
    shortTitle: 'Coleta de amostra',
    summary: 'Coleta de 5 ml no hemocentro para o teste de compatibilidade genética.',
    homeBody: 'Leve um documento com foto ao hemocentro para coletar a amostra de sangue do cadastro.',
    body: 'Uma pequena amostra de sangue é usada para identificar suas características genéticas (HLA) e comparar com pacientes que aguardam transplante.',
    checklist: [
      { label: 'Documento oficial com foto' },
      { label: 'Comprovante de endereço' },
      { label: 'Estar bem alimentado' },
    ],
    place: HEMOAL,
    source: SOURCE,
  },
  {
    id: 'redome',
    title: 'Inclusão no REDOME',
    shortTitle: 'Inclusão no REDOME',
    summary: 'Seus dados entram no registro nacional. Mantenha o contato atualizado.',
    body: 'Depois da tipagem HLA, o hemocentro envia o resultado ao REDOME, o Registro Nacional de Doadores Voluntários de Medula Óssea. Manter telefone e endereço atualizados é o que permite o contato se houver compatibilidade.',
    source: SOURCE,
  },
  {
    id: 'contato',
    title: 'Contato por compatibilidade',
    shortTitle: 'Contato por compatibilidade',
    summary: 'Se houver um paciente compatível, o hemocentro entra em contato.',
    body: 'Só uma minoria dos cadastrados é chamada. Se o sistema encontrar um paciente compatível, o hemocentro confirma se você ainda pode doar e agenda novos exames. Ninguém doa sem esse convite.',
    source: SOURCE,
  },
  {
    id: 'doacao',
    title: 'Exames e doação',
    shortTitle: 'Exames e doação',
    summary: 'Exames complementares e doação, por punção ou aférese.',
    body: 'Com a compatibilidade confirmada, você faz exames clínicos e, se estiver apto, a doação ocorre por punção no osso da bacia ou por aférese (coleta de sangue). A escolha é da equipe médica, com o seu consentimento.',
    checklist: [
      { label: 'Exames clínicos e de sangue' },
      { label: 'Acompanhante no dia do procedimento' },
      { label: 'Seguir o jejum ou orientação do hemocentro' },
    ],
    place: HEMOAL,
    source: SOURCE,
  },
  {
    id: 'pos-doacao',
    title: 'Acompanhamento',
    shortTitle: 'Acompanhamento',
    summary: 'Retorno médico após a doação.',
    body: 'Após a doação, o hemocentro agenda retorno para avaliar sua recuperação. A medula se recompõe em poucas semanas. Qualquer sintoma fora do esperado deve ser informado à equipe que te acompanhou.',
    source: SOURCE,
  },
];

const RECEPTOR_BASE: Omit<JourneyStep, 'summary'>[] = [
  {
    id: 'indicacao',
    title: 'Indicação médica',
    shortTitle: 'Indicação médica',
    body: 'O transplante de células-tronco (TCTH) só começa com indicação de um hematologista. O médico avalia o diagnóstico, tenta tratamentos prévios e solicita o transplante pelo SUS quando for o caso.',
    source: SOURCE,
  },
  {
    id: 'encaminhamento',
    title: 'Encaminhamento',
    shortTitle: 'Encaminhamento',
    body: 'Com a indicação, o paciente é encaminhado a um centro transplantador habilitado. A regulação é feita pelo SUS. O app não agenda, não altera fila e não substitui a equipe assistente.',
    source: SOURCE,
  },
  {
    id: 'busca',
    title: 'Busca de doador',
    shortTitle: 'Busca de doador compatível',
    homeBody: 'Seu cadastro foi enviado pela equipe médica. A busca é feita pelo SUS no REDOME.',
    body: 'A busca começa pelos familiares. Se não houver compatibilidade, o centro consulta o REDOME e, se preciso, registros internacionais (REREME). O tempo depende do HLA e da disponibilidade — não de uma fila única.',
    source: SOURCE,
  },
  {
    id: 'preparacao',
    title: 'Preparação',
    shortTitle: 'Preparação',
    body: 'Antes do transplante há exames, avaliações odontológicas e o condicionamento (quimioterapia e, em alguns casos, radioterapia). Essa fase acontece no centro transplantador, com a equipe que vai realizar o procedimento.',
    source: SOURCE,
  },
  {
    id: 'transplante',
    title: 'Transplante',
    shortTitle: 'Transplante',
    body: 'O transplante é a infusão das células-tronco do doador ou do próprio paciente. A internação dura semanas. Só a equipe do centro transplantador define datas, protocolos e alta.',
    source: SOURCE,
  },
  {
    id: 'pos-tcth',
    title: 'Acompanhamento',
    shortTitle: 'Acompanhamento',
    body: 'Depois da alta, há consultas frequentes para prevenir infecções e a doença do enxerto contra o hospedeiro. O calendário é da equipe médica. O app só descreve a etapa.',
    source: SOURCE,
  },
];

type RegionCopy = {
  encaminhamento: string;
  busca: string;
  estimateLabel: string;
  estimateValue: string;
  estimateNote: string;
};

export const REGION_COPY: Record<RegionId, RegionCopy> = {
  maceio: {
    encaminhamento:
      'Em Maceió, o encaminhamento é feito para centro transplantador de referência (ex.: Recife).',
    busca: 'Busca no REDOME/REREME. Familiares podem ser testados primeiro.',
    estimateLabel: 'Estimativa · Busca de doador',
    estimateValue: 'Média regional: 3 a 6 meses',
    estimateNote:
      'Aproximação estatística baseada em dados públicos. Não é garantia de atendimento, procedimento ou prazo.',
  },
  recife: {
    encaminhamento: 'Em Recife, o tratamento pode ocorrer em centro transplantador da própria região.',
    busca: 'Busca no REDOME/REREME, com centros de referência na própria região.',
    estimateLabel: 'Estimativa · Busca de doador',
    estimateValue: 'Média regional: 2 a 5 meses',
    estimateNote:
      'Aproximação estatística baseada em dados públicos. Não é garantia de atendimento, procedimento ou prazo.',
  },
  outra: {
    encaminhamento: 'O encaminhamento é feito pelo SUS para o centro transplantador de referência da sua região.',
    busca: 'Busca no REDOME/REREME. O tempo varia conforme o HLA e o centro.',
    estimateLabel: 'Estimativa · Busca de doador',
    estimateValue: 'Varia por região',
    estimateNote:
      'Aproximação estatística baseada em dados públicos. Não é garantia de atendimento, procedimento ou prazo.',
  },
};

const RECEPTOR_SUMMARIES: Record<string, string> = {
  indicacao: 'O hematologista indica o transplante e solicita o tratamento no SUS.',
  preparacao: 'Exames e condicionamento antes do transplante.',
  transplante: 'Internação no centro transplantador.',
  'pos-tcth': 'Consultas periódicas após o transplante.',
};

export function receptorSteps(region: RegionId): JourneyStep[] {
  const copy = REGION_COPY[region];
  return RECEPTOR_BASE.map((step) => {
    if (step.id === 'encaminhamento') return { ...step, summary: copy.encaminhamento };
    if (step.id === 'busca') return { ...step, summary: copy.busca };
    return { ...step, summary: RECEPTOR_SUMMARIES[step.id] };
  });
}

export function stepsFor(kind: JourneyKind, region: RegionId): JourneyStep[] {
  return kind === 'doador' ? DONOR_STEPS : receptorSteps(region);
}

export function stepState(index: number, current: number): StepState {
  if (current > 6) return 'done';
  if (index < current) return 'done';
  if (index === current) return 'current';
  return 'pending';
}

export function progressLabel(current: number) {
  if (current > 6) return '6 de 6';
  return `${current} de 6`;
}

export function progressPercent(current: number) {
  const value = Math.min(current, 6);
  return `${Math.round((value / 6) * 100)}%` as `${number}%`;
}

export const DONOR_PLACE_BY_REGION: Record<RegionId, JourneyPlace> = {
  maceio: HEMOAL,
  recife: HEMOPE,
  outra: { name: 'Hemocentro da sua região', address: 'Consulte o hemocentro mais próximo' },
};

export function withRegionPlace(step: JourneyStep, region: RegionId): JourneyStep {
  if (!step.place) return step;
  return { ...step, place: DONOR_PLACE_BY_REGION[region] };
}
