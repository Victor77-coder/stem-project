import { BellPlus, CircleAlert, Eye, Info, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyRow, SortButton, headClass, rowClass, useSort } from '../../components/table'
import { Button } from '../../components/ui'
import { useStore } from '../../data/store'
import { NOTICE_KINDS, type Notice, type NoticeHealth } from '../../data/types'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { isSent } from './notices'

const cols = 'grid-cols-[1fr_2fr_0.9fr_1.1fr_0.8fr_1.2fr_5rem]'

const statusStyle: Record<Notice['status'], string> = {
  publicado: 'bg-green-100 text-green-700',
  rascunho: 'bg-amber-100 text-amber-700',
  inativo: 'bg-ink/10 text-ink/60',
}

const alertStyle = {
  erro: { box: 'border-red-200 bg-red-50 text-red-800', Icon: CircleAlert },
  aviso: { box: 'border-amber-200 bg-amber-50 text-amber-800', Icon: TriangleAlert },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
} as const

/** Alertas do envio (credenciais de push, SMTP, falhas em massa, cota de e-mail). Some quando está tudo bem. */
function HealthAlerts({ alerts }: { alerts: NoticeHealth['alertas'] }) {
  if (!alerts.length) return null
  return (
    <div className="flex flex-col gap-2 px-5.5 pb-5" role="status">
      {alerts.map((alert) => {
        const { box, Icon } = alertStyle[alert.nivel]
        return (
          <div key={alert.titulo} className={`flex gap-3 rounded-lg border px-4 py-3 text-xs ${box}`}>
            <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <div>
              <p className="font-semibold">{alert.titulo}</p>
              <p className="mt-0.5 opacity-90">{alert.texto}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function deliverySummary(notice: Notice) {
  if (!notice.disparado_em) return notice.status === 'publicado' ? 'Agendado' : '—'
  const sent = notice.envios.push.enviado + notice.envios.email.enviado
  const failed = notice.envios.push.falhou + notice.envios.email.falhou
  return `${sent} enviado${sent === 1 ? '' : 's'}${failed ? ` · ${failed} com falha` : ''}`
}

export default function NotificationList() {
  const { currentUser } = useStore()
  const navigate = useNavigate()
  const [notices, setNotices] = useState<Notice[]>([])
  const [alerts, setAlerts] = useState<NoticeHealth['alertas']>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canPublish = Boolean(currentUser?.podePublicarAvisos)

  useEffect(() => {
    api<Notice[]>('/staff/notifications/')
      .then(setNotices)
      .catch((err: Error) => setError(err.message))
    // Sem resposta da saúde do envio, a lista continua; só os alertas não aparecem.
    api<NoticeHealth>('/staff/notifications/saude/')
      .then((data) => setAlerts(data.alertas))
      .catch(() => setAlerts([]))
  }, [])

  const visible = notices.filter((n) => n.status !== 'inativo')
  const { sorted, toggle } = useSort(visible, 'data_disparo', false)

  async function unpublish(notice: Notice) {
    if (!confirm('Despublicar este aviso? Ele sai da caixa de entrada do aplicativo.')) return
    setBusy(true)
    setError('')
    try {
      await api(`/staff/notifications/${notice.id}/`, { method: 'DELETE' })
      setNotices((list) => list.filter((n) => n.id !== notice.id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between gap-4 px-5.5 pt-7 pb-5">
        <div>
          <h2 className="text-lg">Avisos do aplicativo</h2>
          <p className="text-xs text-ink/60">
            Push e e-mail só chegam a quem ativou o canal, das 8h às 21h (Brasília).
            {!canPublish && ' Você cria rascunhos; administradores e administradores de conteúdo publicam.'}
          </p>
        </div>
        <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => navigate('/notificacoes/novo')}>
          <BellPlus className="size-4" />
          Criar aviso
        </Button>
      </div>

      <HealthAlerts alerts={alerts} />
      {error && <p className="px-6 pb-4 text-xs text-danger">{error}</p>}

      <div className="overflow-x-auto">
        <div className="min-w-190">
          <div className={`${headClass} ${cols}`}>
            <SortButton label="Tipo" onClick={() => toggle('tipo')} />
            <SortButton label="Título" onClick={() => toggle('titulo')} />
            <SortButton label="Região" onClick={() => toggle('uf')} />
            <SortButton label="Disparo" onClick={() => toggle('data_disparo')} />
            <SortButton label="Status" onClick={() => toggle('status')} />
            <span>Envios</span>
            <span className="text-center">Ações</span>
          </div>

          <div className="mt-6 px-6">
            {sorted.length === 0 && <EmptyRow text="Nenhum aviso cadastrado." />}
            {sorted.map((n) => {
              const sent = isSent(n)
              const locked = n.status === 'publicado' && !canPublish
              return (
                <div key={n.id} className={`${rowClass} ${cols} shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}>
                  <span>{NOTICE_KINDS[n.tipo]}</span>
                  <b className="truncate pr-2">{n.titulo}</b>
                  <span>{n.uf ? [n.cidade, n.uf].filter(Boolean).join(' / ') : 'Brasil'}</span>
                  <span>{formatDateTime(n.data_disparo)}</span>
                  <span>
                    <span className={`rounded-full px-2 py-0.5 capitalize ${statusStyle[n.status]}`}>{n.status}</span>
                  </span>
                  <span>{deliverySummary(n)}</span>
                  <div className="flex justify-center gap-5">
                    <Link to={`/notificacoes/${n.id}/editar`} title={sent || locked ? 'Ver' : 'Editar'}>
                      {sent || locked ? <Eye className="size-4" strokeWidth={1.5} /> : <Pencil className="size-4" strokeWidth={1.5} />}
                    </Link>
                    {!locked && (
                      <button type="button" disabled={busy} onClick={() => unpublish(n)} title="Despublicar">
                        <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
