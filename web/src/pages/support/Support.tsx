import { useCallback, useEffect, useState } from 'react'
import { EmptyRow, headClass, rowClass } from '../../components/table'
import { Button, Modal } from '../../components/ui'
import { useStore } from '../../data/store'
import type { AccessRequest, ActionLog } from '../../data/types'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

const cols = 'grid-cols-[1.1fr_1.1fr_1.6fr_2fr_1.1fr]'
const requestCols = 'grid-cols-[2fr_1.2fr_1fr_1.6fr_11rem]'
const control = 'h-8 rounded-md border border-ink/30 bg-white px-2 text-xs outline-none focus:border-primary'
const input = 'h-9 w-full rounded-lg bg-field px-2.5 text-sm shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none focus:ring-2 focus:ring-primary/40'

const SITUATION: Record<AccessRequest['situacao'], string> = {
  pendente: 'bg-amber-100 text-amber-700',
  atendido: 'bg-green-100 text-green-700',
  recusado: 'bg-ink/10 text-ink/60',
}

type Filters = { tipo: string; pessoa: string; desde: string; ate: string }

function ActionLogSection() {
  const [log, setLog] = useState<ActionLog | null>(null)
  const [filters, setFilters] = useState<Filters>({ tipo: '', pessoa: '', desde: '', ate: '' })
  const [error, setError] = useState('')

  const load = useCallback((current: Filters) => {
    const query = new URLSearchParams(Object.entries(current).filter(([, value]) => value) as [string, string][])
    api<ActionLog>(`/staff/logs/${query.size ? `?${query}` : ''}`)
      .then(setLog)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => load({ tipo: '', pessoa: '', desde: '', ate: '' }), [load])

  const set = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <section>
      <div className="px-5.5 pt-7 pb-3">
        <h2 className="text-lg">Log de ações</h2>
        <p className="text-xs text-ink/60">
          Quem fez o quê no painel: conteúdo, jornada, centros, avisos, estatísticas, configurações e contas da equipe. Mostra as{' '}
          {log?.limite ?? 300} ações mais recentes do filtro.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-2 px-5.5 pb-4"
        onSubmit={(e) => {
          e.preventDefault()
          load(filters)
        }}
      >
        <select className={control} value={filters.tipo} onChange={(e) => set('tipo', e.target.value)} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {log?.tipos.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.label}
            </option>
          ))}
        </select>
        <input className={control} placeholder="Pessoa da equipe" value={filters.pessoa} onChange={(e) => set('pessoa', e.target.value)} />
        <label className="flex items-center gap-1 text-xs">
          De <input type="date" className={control} value={filters.desde} onChange={(e) => set('desde', e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs">
          até <input type="date" className={control} value={filters.ate} onChange={(e) => set('ate', e.target.value)} />
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {error && <p className="px-6 pb-4 text-xs text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <div className="min-w-190">
          <div className={`${headClass} ${cols}`}>
            <span>Quando</span>
            <span>Tipo</span>
            <span>Item</span>
            <span>Ação</span>
            <span>Pessoa</span>
          </div>
          <div className="mt-6 px-6">
            {log && log.itens.length === 0 && <EmptyRow text="Nenhuma ação encontrada para este filtro." />}
            {log?.itens.map((item) => (
              <div key={item.id} className={`${rowClass} ${cols} shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}>
                <span>{formatDateTime(item.quando)}</span>
                <span>{item.tipoLabel}</span>
                <b className="truncate pr-2" title={item.objeto}>
                  {item.objeto}
                </b>
                <span className="truncate pr-2" title={item.acao}>
                  {item.acao}
                </span>
                <span className="truncate pr-2">{item.pessoa}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ApproveModal({ request, onClose, onDone }: { request: AccessRequest; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState('')
  const [tipoConta, setTipoConta] = useState('Editor')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function approve() {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ senhaTemporaria: string }>(`/staff/access-requests/${request.id}/aprovar/`, {
        method: 'POST',
        body: { nome, tipoConta },
      })
      setPassword(data.senhaTemporaria)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Criar conta da equipe" onClose={onClose} className="max-w-lg px-10 py-10">
      {password ? (
        <div className="text-sm">
          <p>
            Conta criada para <b>{request.email}</b>. Repasse a senha temporária por um canal seguro; a pessoa troca no primeiro acesso.
          </p>
          <p className="mt-3 rounded-lg bg-field px-3 py-2 font-mono text-base">{password}</p>
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            E-mail: <b>{request.email}</b>
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Nome</span>
            <input className={input} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Tipo de conta</span>
            <select className={input} value={tipoConta} onChange={(e) => setTipoConta(e.target.value)}>
              <option>Editor</option>
              <option>Validador clínico</option>
              <option>Administrador de conteúdo</option>
            </select>
          </label>
          <p className="text-xs text-ink/60">A conta nasce com nível de usuário. Para torná-la administradora, use Usuários.</p>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="mt-3 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!nome.trim() || busy} onClick={approve}>
              Criar conta
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AccessRequestsSection() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [approving, setApproving] = useState<AccessRequest | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<AccessRequest[]>('/staff/access-requests/')
      .then(setRequests)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  async function refuse(request: AccessRequest) {
    if (!confirm(`Recusar o pedido de acesso de ${request.email}?`)) return
    setError('')
    try {
      await api(`/staff/access-requests/${request.id}/recusar/`, { method: 'POST' })
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const pending = requests.filter((r) => r.situacao === 'pendente').length

  return (
    <section>
      <div className="px-5.5 pt-7 pb-3">
        <h2 className="text-lg">Pedidos de acesso ao painel</h2>
        <p className="text-xs text-ink/60">
          Feitos em “Solicitar acesso”, na tela de login. {pending ? `${pending} aguardando resposta.` : 'Nenhum aguardando resposta.'}
        </p>
      </div>
      {error && <p className="px-6 pb-4 text-xs text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <div className="min-w-190">
          <div className={`${headClass} ${requestCols}`}>
            <span>E-mail</span>
            <span>Pedido em</span>
            <span>Situação</span>
            <span>Atendido por</span>
            <span className="text-center">Ações</span>
          </div>
          <div className="mt-6 px-6">
            {requests.length === 0 && <EmptyRow text="Nenhum pedido de acesso." />}
            {requests.map((r) => (
              <div key={r.id} className={`${rowClass} ${requestCols} shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}>
                <b className="truncate pr-2">{r.email}</b>
                <span>{formatDateTime(r.criadoEm)}</span>
                <span>
                  <span className={`rounded-full px-2 py-0.5 capitalize ${SITUATION[r.situacao]}`}>{r.situacao}</span>
                </span>
                <span className="truncate pr-2">
                  {r.atendidoPor ? `${r.atendidoPor} · ${formatDateTime(r.atendidoEm ?? r.criadoEm)}` : r.jaTemConta ? 'Já tem conta' : '—'}
                </span>
                <div className="flex justify-center gap-2">
                  {r.situacao === 'pendente' && (
                    <>
                      <button type="button" className="text-primary underline" disabled={r.jaTemConta} onClick={() => setApproving(r)}>
                        Criar conta
                      </button>
                      <button type="button" className="text-danger underline" onClick={() => refuse(r)}>
                        Recusar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {approving && <ApproveModal request={approving} onClose={() => setApproving(null)} onDone={load} />}
    </section>
  )
}

/** Logs e Suporte (RF13): log de ações da equipe e, para administradores, os pedidos de acesso ao painel. */
export default function Support() {
  const { currentUser } = useStore()
  return (
    <div className="flex flex-col gap-6 pb-8">
      <ActionLogSection />
      {currentUser?.nivel === 'Admin' ? (
        <AccessRequestsSection />
      ) : (
        <p className="px-6 text-xs text-ink/60">Os pedidos de acesso ao painel aparecem só para administradores.</p>
      )}
    </div>
  )
}
