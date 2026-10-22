import { ChevronDown, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyRow, SortButton, headClass, rowClass, useSort } from '../../components/table'
import { Button, ConfirmPasswordModal } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Account, AccountStatus } from '../../data/types'

const cols = 'grid-cols-[2rem_1.6fr_2fr_1fr_0.8fr_5rem]'
const FILTERS: (AccountStatus | 'todos')[] = ['todos', 'ativo', 'inativo', 'bloqueado']

export default function UsersList() {
  const { accounts, setAccountStatus } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('todos')
  const [toDelete, setToDelete] = useState<Account | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const q = (params.get('q') ?? '').toLowerCase()
  const visible = accounts.filter(
    (a) =>
      a.status !== 'cancelado' &&
      (filter === 'todos' || a.status === filter) &&
      (a.nome.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)),
  )
  const { sorted, toggle } = useSort(visible, 'nome')
  const allSelected = sorted.length > 0 && sorted.every((a) => selected.includes(a.id))

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-5.5 pt-7 pb-5">
        <h2 className="text-lg">Lista de contas cadastradas</h2>
        <div className="flex gap-3">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="h-8 appearance-none rounded-full border border-primary pr-9 pl-5 text-sm font-semibold text-primary capitalize outline-none"
              title="Filtrar por status"
            >
              {FILTERS.map((f) => (
                <option key={f} value={f}>
                  {f === 'todos' ? 'Filtro' : f}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-primary" />
          </div>
          <Button variant="outline" onClick={() => navigate('/usuarios/novo')}>
            <UserPlus className="size-4" />
            Cadastrar usuário
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <div className="min-w-190">
      <div className={`${headClass} ${cols}`}>
        <input
          type="checkbox"
          className="size-4"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? [] : sorted.map((a) => a.id))}
          title="Selecionar todos"
        />
        <SortButton label="Nome" onClick={() => toggle('nome')} />
        <SortButton label="Email" onClick={() => toggle('email')} />
        <SortButton label="Status" onClick={() => toggle('status')} />
        <SortButton label="Nível" onClick={() => toggle('nivel')} />
        <span className="text-center">Ações</span>
      </div>

      <div className="mt-6 px-6">
        {sorted.length === 0 && <EmptyRow text="Nenhuma conta encontrada." />}
        {sorted.map((a) => (
          <div key={a.id} className={`${rowClass} ${cols}`}>
            <input
              type="checkbox"
              className="size-3"
              checked={selected.includes(a.id)}
              onChange={() => setSelected((s) => (s.includes(a.id) ? s.filter((id) => id !== a.id) : [...s, a.id]))}
            />
            <Link to={`/usuarios/${a.id}`} className="hover:text-primary">
              {a.nome}
            </Link>
            <span>{a.email}</span>
            <span className={a.status === 'ativo' ? '' : a.status === 'bloqueado' ? 'text-danger' : 'text-ink/60'}>{a.status}</span>
            <span>{a.nivel}</span>
            <div className="flex justify-center gap-5">
              <Link to={`/usuarios/${a.id}?editar=1`} title="Editar">
                <Pencil className="size-4" strokeWidth={1.5} />
              </Link>
              <button type="button" onClick={() => setToDelete(a)} title="Deletar">
                <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
      </div>

      </div>
      </div>

      {toDelete && (
        <ConfirmPasswordModal
          title="Deletar usuário"
          confirmLabel="Deletar"
          onClose={() => setToDelete(null)}
          onConfirm={async (senha) => {
            await setAccountStatus(toDelete.id, 'cancelado', senha)
            setToDelete(null)
          }}
        />
      )}
    </div>
  )
}
