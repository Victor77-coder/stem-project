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

export const AUDIENCES = ['Doador', 'Receptor', 'Leigo'] as const
export type Audience = (typeof AUDIENCES)[number]

export type Visibility = 'Público' | 'Privado' | 'Restrito'
export type PublishStatus = 'rascunho' | 'publicado' | 'inativo'

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
