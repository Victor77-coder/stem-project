import type { Notice } from '../../data/types'

/** Aviso publicado com data já passada: a caixa de entrada mostrou, então não muda mais. */
export const isSent = (notice: Notice) =>
  Boolean(notice.disparado_em) || (notice.status === 'publicado' && new Date(notice.data_disparo) <= new Date())
