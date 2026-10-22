import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokens } from '../lib/api'
import type { Account, AccountStatus, Content } from './types'

type ContentFields = Omit<Content, 'id' | 'anexos' | 'atualizadoEm' | 'historico' | 'validadoPor'>

interface Store {
  ready: boolean
  accounts: Account[]
  contents: Content[]
  currentUser: Account | null
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  reloadAccounts: () => Promise<void>
  reloadContents: () => Promise<void>
  saveAccount: (account: Account, isNew: boolean) => Promise<{ account: Account; senhaTemporaria?: string }>
  setAccountStatus: (id: string, status: AccountStatus, senha?: string) => Promise<Account>
  resetPassword: (id: string) => Promise<string>
  saveContent: (content: Content, isNew: boolean, files: File[], removed: string[]) => Promise<Content>
  unpublishContent: (id: string, senha: string) => Promise<void>
  updateMe: (nome: string, email: string) => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

const accountFields = ({ id: _id, status: _s, criadoEm: _c, ultimoLogin: _u, podeValidar: _p, ...rest }: Account) => rest

const contentFields = (c: Content): ContentFields => ({
  titulo: c.titulo,
  descricao: c.descricao,
  categoria: c.categoria,
  publicoAlvo: c.publicoAlvo,
  fonte: c.fonte,
  visibilidade: c.visibilidade,
  status: c.status,
  validacaoClinica: c.validacaoClinica,
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !tokens.get())
  const [currentUser, setCurrentUser] = useState<Account | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contents, setContents] = useState<Content[]>([])

  const reloadAccounts = useCallback(async () => setAccounts(await api<Account[]>('/staff/accounts/')), [])
  const reloadContents = useCallback(async () => setContents(await api<Content[]>('/staff/contents/')), [])

  const enter = useCallback(
    (user: Account) => {
      setCurrentUser(user)
      reloadAccounts().catch(() => setAccounts([]))
      reloadContents().catch(() => setContents([]))
    },
    [reloadAccounts, reloadContents],
  )

  useEffect(() => {
    if (!tokens.get()) return
    api<Account>('/staff/me/')
      .then(enter)
      .catch(() => tokens.set(null))
      .finally(() => setReady(true))
  }, [enter])

  const replaceAccount = (account: Account) =>
    setAccounts((list) =>
      list.some((a) => a.id === account.id) ? list.map((a) => (a.id === account.id ? account : a)) : [...list, account],
    )

  const store: Store = {
    ready,
    accounts,
    contents,
    currentUser,
    async login(email, senha) {
      const data = await api<{ access: string; refresh: string; conta: Account }>('/staff/auth/login/', {
        method: 'POST',
        body: { email, senha },
        auth: false,
      })
      tokens.set({ access: data.access, refresh: data.refresh })
      enter(data.conta)
    },
    async logout() {
      const refresh = tokens.get()?.refresh
      tokens.set(null)
      setCurrentUser(null)
      setAccounts([])
      setContents([])
      if (refresh) await api('/auth/logout/', { method: 'POST', body: { refresh }, auth: false }).catch(() => undefined)
    },
    reloadAccounts,
    reloadContents,
    async saveAccount(account, isNew) {
      const saved: Account & { senhaTemporaria?: string } = isNew
        ? await api('/staff/accounts/', { method: 'POST', body: accountFields(account) })
        : await api(`/staff/accounts/${account.id}/`, { method: 'PATCH', body: accountFields(account) })
      const { senhaTemporaria, ...clean } = saved
      replaceAccount(clean)
      if (clean.id === currentUser?.id) setCurrentUser(clean)
      return { account: clean, senhaTemporaria }
    },
    async setAccountStatus(id, status, senha) {
      const saved = await api<Account>(`/staff/accounts/${id}/status/`, { method: 'POST', body: { status, senha } })
      if (status === 'cancelado') setAccounts((list) => list.filter((a) => a.id !== id))
      else replaceAccount(saved)
      return saved
    },
    async resetPassword(id) {
      const data = await api<{ senhaTemporaria: string }>(`/staff/accounts/${id}/reset-password/`, { method: 'POST' })
      return data.senhaTemporaria
    },
    async saveContent(content, isNew, files, removed) {
      const saved = isNew
        ? await api<Content>('/staff/contents/', { method: 'POST', body: contentFields(content) })
        : await api<Content>(`/staff/contents/${content.id}/`, { method: 'PATCH', body: contentFields(content) })
      for (const id of removed) await api(`/staff/contents/${saved.id}/anexos/${id}/`, { method: 'DELETE' })
      for (const file of files) {
        const form = new FormData()
        form.append('arquivo', file)
        await api(`/staff/contents/${saved.id}/anexos/`, { method: 'POST', body: form })
      }
      const fresh = files.length || removed.length ? await api<Content>(`/staff/contents/${saved.id}/`) : saved
      setContents((list) => [...list.filter((c) => c.id !== fresh.id), fresh])
      return fresh
    },
    async unpublishContent(id, senha) {
      await api(`/staff/contents/${id}/despublicar/`, { method: 'POST', body: { senha } })
      setContents((list) => list.filter((c) => c.id !== id))
    },
    async updateMe(nome, email) {
      setCurrentUser(await api<Account>('/staff/me/', { method: 'PATCH', body: { nome, email } }))
    },
    async changePassword(current, next) {
      const data = await api<{ access: string; refresh: string }>('/auth/password/change/', {
        method: 'POST',
        body: { current, new: next },
      })
      tokens.set(data)
    },
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}
