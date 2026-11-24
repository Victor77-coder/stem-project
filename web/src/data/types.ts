export type AccountStatus = 'ativo' | 'inativo' | 'bloqueado' | 'cancelado'
export type AccountLevel = 'Admin' | 'User'

export interface Account {
  id: string
  nome: string
  email: string
  status: AccountStatus
  nivel: AccountLevel
  podeValidar?: boolean
  /** Admin ou Administrador de conteúdo: só eles publicam avisos. */
  podePublicarAvisos?: boolean
  avatar?: string
  documento1: string
  documento2: string
  genero: string
  tipoConta: string
  cep: string
  logradouro: string
  numero: string
  pais: string
  estado: string
  cidade: string
  bairro: string
  complemento: string
  referencia: string
  criadoEm: string
  ultimoLogin: string
}

export const CATEGORIES = [
  'O que é célula-tronco',
  'O que o Brasil autoriza',
  'Doenças',
  'Mitos',
  'FAQ',
  'Novidades',
] as const
export type Category = (typeof CATEGORIES)[number]

export const AUDIENCES = ['Doador', 'Receptor', 'Convidado'] as const
export type Audience = (typeof AUDIENCES)[number]

export type Visibility = 'Público' | 'Privado' | 'Restrito'
export type PublishStatus = 'rascunho' | 'publicado' | 'inativo'

export interface JourneyLocal {
  name: string
  address: string
  distance: string
}

export interface Journey {
  id: number
  jornada: 'doador' | 'receptor'
  slug: string
  ordem: number
  titulo: string
  titulo_curto: string
  resumo: string
  resumo_home: string
  resumo_por_regiao: Record<string, string>
  corpo: string
  o_que_stem_faz: string
  o_que_sus_faz: string
  checklist: string[]
  local: JourneyLocal | null
  fonte: string
  status: PublishStatus
  atualizado_em: string
}

export interface Attachment {
  id: string
  nome: string
  tamanho: number
  enviadoEm: string
}

export interface HistoryEntry {
  autor: string
  acao: string
  data: string
}

export interface Content {
  id: string
  titulo: string
  descricao: string
  categoria: Category
  publicoAlvo: Audience[]
  fonte: string
  visibilidade: Visibility
  status: PublishStatus
  validacaoClinica: boolean
  validadoPor: string
  anexos: Attachment[]
  atualizadoEm: string
  historico: HistoryEntry[]
  /** Matéria original de uma novidade coletada dos portais. Só leitura no painel. */
  linkOriginal: string
}

export type NoticeKind = 'campanha' | 'evento' | 'comunicado'

export const NOTICE_KINDS: Record<NoticeKind, string> = {
  campanha: 'Campanha de doação',
  evento: 'Evento de saúde',
  comunicado: 'Comunicado oficial',
}

export type DeliveryCounts = Record<'pendente' | 'enviado' | 'falhou' | 'ignorado', number>

/** Aviso do app (RF10). Os nomes seguem os campos do modelo no backend. */
export interface Notice {
  id: number
  tipo: NoticeKind
  titulo: string
  mensagem: string
  origem: string
  uf: string
  cidade: string
  data_disparo: string
  status: PublishStatus
  centro: number | null
  conteudo: string | null
  atualizado_em: string
  disparado_em: string | null
  envios: { push: DeliveryCounts; email: DeliveryCounts }
}

/** Saúde do envio nas últimas 24 horas (GET /staff/notifications/saude/). Só contagens, sem dado de pessoa. */
export interface NoticeHealth {
  ultimas24h: Record<'push' | 'email', { enviados: number; falhas: number }>
  alertas: { nivel: 'erro' | 'aviso' | 'info'; titulo: string; texto: string }[]
}

/** Só contagens: o painel nunca vê quem recebe. */
export interface NoticeReach {
  caixaDeEntrada: number
  push: number
  email: number
}

export interface Dashboard {
  publicados: number
  rascunhos: number
  contasAtivas: number
  anexos: number
  totalConteudos: number
  recentes: { id: string; titulo: string; status: PublishStatus; atualizadoEm: string }[]
  atividade: (HistoryEntry & { titulo: string })[]
  porCategoria: { categoria: Category; total: number }[]
}

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

export type CenterKind = 'hemocentro' | 'transplante' | 'campanha'

export const CENTER_KINDS: Record<CenterKind, string> = {
  hemocentro: 'Hemocentro',
  transplante: 'Centro de transplante',
  campanha: 'Campanha',
}

/** Centro ou campanha (RF08, RF13). Os nomes seguem os campos do modelo no backend. */
export interface Center {
  id: number
  slug: string
  cnes: string
  origem: 'manual' | 'cnes'
  revisar: boolean
  motivo_revisao: string
  nome: string
  nome_curto: string
  endereco: string
  cidade: string
  uf: string
  tipo: CenterKind
  lat: number | null
  lng: number | null
  horario: string
  telefone: string
  observacoes: string
  evento_quando: string
  fonte: string
  fonte_data: string | null
  status: PublishStatus
  atualizado_em: string
}

