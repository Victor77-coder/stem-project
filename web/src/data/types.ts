export type AccountStatus = 'ativo' | 'inativo' | 'bloqueado' | 'cancelado'
export type AccountLevel = 'Admin' | 'User'

export interface Account {
  id: string
  nome: string
  email: string
  status: AccountStatus
  nivel: AccountLevel
  podeValidar?: boolean
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
