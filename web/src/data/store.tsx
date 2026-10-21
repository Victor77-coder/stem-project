import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { initialAccounts, initialContents } from './mock'
import type { Account, Content } from './types'

interface Store {
  accounts: Account[]
  contents: Content[]
  currentUser: Account | null
  login: (email: string, senha: string) => boolean
  logout: () => void
  checkPassword: (senha: string) => boolean
  saveAccount: (account: Account) => void
  saveContent: (content: Content) => void
}

const StoreContext = createContext<Store | null>(null)

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : initial
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = usePersisted('stem:accounts', initialAccounts)
  const [contents, setContents] = usePersisted('stem:contents', initialContents)
  const [userId, setUserId] = usePersisted<string | null>('stem:session', null)

  const currentUser = accounts.find((a) => a.id === userId) ?? null

  const store: Store = {
    accounts,
    contents,
    currentUser,
    login(email, senha) {
      const account = accounts.find(
        (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.senha === senha && a.status === 'ativo',
      )
      if (!account) return false
      setUserId(account.id)
      setAccounts((list) =>
        list.map((a) => (a.id === account.id ? { ...a, ultimoLogin: new Date().toISOString().slice(0, 10) } : a)),
      )
      return true
    },
    logout: () => setUserId(null),
    checkPassword: (senha) => currentUser?.senha === senha,
    saveAccount(account) {
      setAccounts((list) =>
        list.some((a) => a.id === account.id)
          ? list.map((a) => (a.id === account.id ? account : a))
          : [...list, account],
      )
    },
    saveContent(content) {
      setContents((list) =>
        list.some((c) => c.id === content.id)
          ? list.map((c) => (c.id === content.id ? content : c))
          : [...list, content],
      )
    },
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}
