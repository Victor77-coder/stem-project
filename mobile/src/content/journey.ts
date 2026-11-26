import { withFallback } from '@/lib/api';

export type JourneyKind = 'doador' | 'receptor';
export type RegionId = 'maceio' | 'recife' | 'outra';
export type StepState = 'done' | 'next' | 'pending';

/** Guia pessoal: o próprio usuário marca as etapas que já fez e os itens do checklist. */
export type JourneyMarks = { done: string[]; checklist: Record<string, string[]> };

export const NO_MARKS: JourneyMarks = { done: [], checklist: {} };

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
  /** Data da última atualização no painel (RS008). As etapas embarcadas trazem a data da consulta na fonte. */
  updatedAt?: string;
};

// RS008: cada etapa mostra a fonte oficial de onde o texto saiu e a data da consulta.
const CONSULTED = 'consultado em 24/11/2026';
const SOURCES = {
  cadastro: `REDOME/INCA (redome.inca.gov.br/doadores), Hemominas e Hemoes · ${CONSULTED}`,
  doadores: `REDOME/INCA (redome.inca.gov.br/doadores) · ${CONSULTED}`,
  doacao: `REDOME/INCA (doadores e para pacientes), Hemope e Hemominas · ${CONSULTED}`,
  posDoacao: `REDOME/INCA (redome.inca.gov.br/doadores) e Hemope · ${CONSULTED}`,
  pacientes: `REDOME/INCA (redome.inca.gov.br/para-pacientes), Hemope e Hemoes · ${CONSULTED}`,
  inca: `INCA (gov.br/inca, transplante de medula óssea) e Hemominas · ${CONSULTED}`,
  centros: 'CNES/DataSUS, habilitações de transplante de medula 2401 a 2403 · competência 10/2026',
};

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'maceio', label: 'Maceió/AL' },
  { id: 'recife', label: 'Recife/PE' },
  { id: 'outra', label: 'Outra' },
];

// Sem distância: o guia não sabe onde a pessoa está (RS008, nada de dado fictício).
const HEMOAL: JourneyPlace = {
  name: 'Hemoal · Maceió',
  address: 'Av. Jorge de Lima, 58',
};

const HEMOPE: JourneyPlace = {
  name: 'Hemope · Recife',
  address: 'Rua Joaquim Nabuco, 171',
};

export const DONOR_STEPS: JourneyStep[] = [
  {
    id: 'cadastro',
    title: 'Cadastro no hemocentro',
    shortTitle: 'Cadastro no hemocentro',
    summary: 'Cadastro e coleta de 5 ml de sangue, na mesma visita.',
    body: 'O cadastro pode começar pelo site ou pelo aplicativo do REDOME, mas é concluído no hemocentro. Lá você lê e assina o termo de consentimento e, na mesma visita, coleta uma amostra de cerca de 5 ml de sangue. Pode se cadastrar quem tem entre 18 e 35 anos e está em bom estado geral de saúde.',
    checklist: [
      { label: 'Documento oficial de identidade com foto' },
      { label: 'Ter entre 18 e 35 anos' },
      { label: 'Estar em bom estado geral de saúde' },
    ],
    place: HEMOAL,
    source: SOURCES.cadastro,
  },
  {
    id: 'coleta',
    title: 'Exame de compatibilidade (HLA)',
    shortTitle: 'Exame HLA',
    summary: 'A amostra do cadastro identifica seus genes de compatibilidade.',
    body: 'A amostra coletada no cadastro é usada para identificar seus dados genéticos de compatibilidade, os genes HLA. São eles que o REDOME compara com os dos pacientes que precisam de transplante.',
    source: SOURCES.doadores,
  },
  {
    id: 'redome',
    title: 'Inclusão no REDOME',
    shortTitle: 'Inclusão no REDOME',
    summary: 'Seu cadastro fica ativo até os 60 anos. Mantenha o contato atualizado.',
    body: 'Seus dados e o resultado do HLA entram no REDOME, o Registro Nacional de Doadores Voluntários de Medula Óssea, e ficam ativos até você completar 60 anos. O contato pode levar alguns anos ou nunca acontecer. Mantenha telefone, e-mail e endereço atualizados pelo site ou pelo aplicativo do REDOME: é assim que você é encontrado.',
    checklist: [{ label: 'Manter telefone, e-mail e endereço atualizados no REDOME' }],
    source: SOURCES.doadores,
  },
  {
    id: 'contato',
    title: 'Contato do REDOME',
    shortTitle: 'Contato por compatibilidade',
    summary: 'Se você for compatível com um paciente, o REDOME entra em contato.',
    body: 'Se houver um paciente compatível, o REDOME entra em contato por telefone, WhatsApp ou e-mail para saber se você ainda deseja e pode doar. Pode ser preciso coletar uma nova amostra de sangue para exames confirmatórios. Se não houver um novo contato em até 180 dias, você não foi o doador compatível.',
    source: SOURCES.doadores,
  },
  {
    id: 'doacao',
    title: 'Avaliação e doação',
    shortTitle: 'Avaliação e doação',
    summary: 'Exames de saúde e doação por punção ou aférese, em hospital autorizado.',
    body: 'Antes de doar, você passa por avaliação clínica e exames de sangue: a doação só acontece se a sua saúde estiver bem. A forma de coleta é decidida pela equipe médica junto com você. Na punção, as células são retiradas do osso da bacia, em centro cirúrgico e sob anestesia. Na aférese, você recebe antes uma medicação que estimula a produção de células-tronco, que depois são separadas do sangue por uma máquina, sem internação nem anestesia. A doação é feita em hospital especializado e autorizado pelo Ministério da Saúde, que pode ficar em outra cidade: o SUS paga transporte, hospedagem e alimentação para você e um acompanhante.',
    checklist: [
      { label: 'Avaliação clínica e exames de sangue' },
      { label: 'Acompanhante no dia da doação' },
      { label: 'Seguir as orientações da equipe que fará a coleta' },
    ],
    source: SOURCES.doacao,
  },
  {
    id: 'pos-doacao',
    title: 'Depois da doação',
    shortTitle: 'Depois da doação',
    summary: 'Recuperação em poucas semanas e, se quiser, notícias do paciente.',
    body: 'A medula doada se recompõe em poucas semanas, e quem doa por punção costuma voltar às atividades em cerca de uma semana. Sintomas fora do esperado devem ser informados à equipe que fez a coleta. Seis meses após o transplante, você pode pedir notícias do paciente ao REDOME; depois de um ano, enviar uma mensagem anônima; e, depois de 18 meses, solicitar um encontro.',
    source: SOURCES.posDoacao,
  },
];

// Jornada do transplante alogênico (com doador). No autólogo, as células são do próprio paciente e não há busca.
const RECEPTOR_BASE: Omit<JourneyStep, 'summary'>[] = [
  {
    id: 'indicacao',
    title: 'Indicação médica',
    shortTitle: 'Indicação médica',
    body: 'O transplante de células-tronco hematopoéticas (TCTH) só começa com a indicação do médico responsável pelo tratamento, em geral um hematologista. É ele quem define o tipo: autólogo, com as células do próprio paciente, ou alogênico, com as células de um doador. As etapas de busca de doador valem só para o transplante alogênico.',
    source: SOURCES.inca,
  },
  {
    id: 'encaminhamento',
    title: 'Encaminhamento',
    shortTitle: 'Encaminhamento',
    body: 'Com a indicação, o paciente é encaminhado pelo SUS a um centro transplantador habilitado. A regulação é feita pelo SUS. O app não agenda, não altera fila e não substitui a equipe que acompanha o paciente.',
    source: SOURCES.centros,
  },
  {
    id: 'busca',
    title: 'Busca de doador',
    shortTitle: 'Busca de doador compatível',
    body: 'A busca começa pelos irmãos e parentes próximos: um irmão tem cerca de 25% de chance de ser compatível. Sem doador na família, o médico inscreve o paciente no REREME, o Registro Nacional de Receptores de Medula Óssea, e o sistema cruza os dados dele com o REDOME e com registros de mais de 50 países. O médico deve atualizar os dados do paciente pelo menos a cada 3 meses. O paciente e a família não pagam pela busca. No transplante autólogo, não há busca de doador.',
    source: SOURCES.pacientes,
  },
  {
    id: 'preparacao',
    title: 'Preparação',
    shortTitle: 'Preparação',
    body: 'No centro transplantador, o paciente faz exames e o condicionamento: quimioterapia e, em alguns casos, radioterapia, que destroem a medula doente para que as novas células possam se instalar. Essa fase é conduzida pela equipe que vai realizar o transplante.',
    source: SOURCES.inca,
  },
  {
    id: 'transplante',
    title: 'Transplante',
    shortTitle: 'Transplante',
    body: 'As células-tronco são aplicadas na veia, como uma transfusão de sangue. Em cerca de duas semanas, a nova medula começa a produzir células: é a chamada "pega". O paciente fica internado, com cuidados para evitar infecções. Só a equipe do centro transplantador define datas, protocolos e alta.',
    source: SOURCES.inca,
  },
  {
    id: 'pos-tcth',
    title: 'Acompanhamento',
    shortTitle: 'Acompanhamento',
    body: 'Depois da alta, há consultas frequentes para prevenir infecções e tratar a doença do enxerto contra o hospedeiro (DECH), uma reação das células transplantadas contra o organismo do paciente, relativamente comum e controlável com medicamentos. Em geral, depois de um ano é possível voltar às atividades normais. O calendário é da equipe médica.',
    source: SOURCES.inca,
  },
];

// Encaminhamento por região, conforme as habilitações de transplante de medula no CNES (competência 10/2026).
export const REGION_COPY: Record<RegionId, string> = {
  maceio: 'Alagoas não tem centro habilitado para transplante de medula no CNES. O SUS encaminha para outro estado, como Pernambuco.',
  recife: 'Recife tem centros habilitados para transplante de medula no CNES, como o IMIP e o Hospital Português.',
  outra: 'O SUS encaminha para o centro transplantador habilitado de referência da sua região.',
};

const RECEPTOR_SUMMARIES: Record<string, string> = {
  indicacao: 'O médico indica o transplante e o tipo: autólogo ou com doador.',
  busca: 'Primeiro na família; depois no REDOME e em registros de mais de 50 países.',
  preparacao: 'Exames e condicionamento antes do transplante.',
  transplante: 'Infusão das células e internação no centro transplantador.',
  'pos-tcth': 'Consultas frequentes depois da alta.',
};

export function receptorSteps(region: RegionId): JourneyStep[] {
  return RECEPTOR_BASE.map((step) =>
    step.id === 'encaminhamento' ? { ...step, summary: REGION_COPY[region] } : { ...step, summary: RECEPTOR_SUMMARIES[step.id] },
  );
}

export function stepsFor(kind: JourneyKind, region: RegionId): JourneyStep[] {
  return kind === 'doador' ? DONOR_STEPS.map((step) => withRegionPlace(step, region)) : receptorSteps(region);
}

/** "Próxima" é só a primeira etapa ainda não marcada: uma sugestão do guia, não o status oficial. */
export function stepStates(steps: JourneyStep[], done: string[]): StepState[] {
  const next = steps.findIndex((step) => !done.includes(step.id));
  return steps.map((step, i) => (done.includes(step.id) ? 'done' : i === next ? 'next' : 'pending'));
}

export function doneCount(steps: JourneyStep[], done: string[]) {
  return steps.filter((step) => done.includes(step.id)).length;
}

export function progressPercent(count: number, total: number) {
  return `${total ? Math.round((count / total) * 100) : 0}%` as `${number}%`;
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

/** Etapa como vem de GET /jornadas/<tipo>/ (catalog/public.py, journey_step). */
type ApiJourneyStep = {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  homeBody: string | null;
  body: string;
  checklist: ChecklistItem[];
  place: JourneyPlace | null;
  source: string;
  updatedAt: string;
};

function fromApi(step: ApiJourneyStep): JourneyStep {
  return {
    id: step.id,
    title: step.title,
    shortTitle: step.shortTitle,
    summary: step.summary,
    homeBody: step.homeBody ?? undefined,
    body: step.body,
    checklist: step.checklist.length ? step.checklist : undefined,
    place: step.place ?? undefined,
    source: step.source,
    updatedAt: step.updatedAt || undefined,
  };
}

/**
 * Etapas oficiais publicadas no painel (RF05/RF06). Sem conexão ou sem etapa publicada,
 * o app usa as etapas embarcadas acima (RNF08).
 */
export async function loadSteps(kind: JourneyKind, region: RegionId): Promise<JourneyStep[]> {
  const items = await withFallback<ApiJourneyStep[]>(`/jornadas/${kind}/?regiao=${region}`, []);
  if (!items.length) return stepsFor(kind, region);
  // O local padrão do painel é o Hemoal; nele o guia troca pelo hemocentro da região. Local editado no painel fica como está.
  return items.map(fromApi).map((step) => (step.place?.name === HEMOAL.name ? withRegionPlace(step, region) : step));
}
