import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useStore } from '../../data/store'
import { NOTICE_KINDS, type Notice, type NoticeKind, type NoticeReach, type PublishStatus } from '../../data/types'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { isSent } from './notices'

const field = 'w-full rounded-lg bg-field px-2.5 text-sm shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none placeholder:text-ink focus:ring-2 focus:ring-primary/40 disabled:opacity-60'
const label = 'mt-3 mb-2 block text-sm font-medium'

type Draft = Pick<Notice, 'tipo' | 'titulo' | 'mensagem' | 'origem' | 'uf' | 'cidade' | 'centro' | 'conteudo'> & {
  /** Valor do input datetime-local, no fuso do navegador. */
  quando: string
}

type CenterOption = { id: number; nome: string; cidade: string; uf: string; status: PublishStatus }

const pad = (n: number) => String(n).padStart(2, '0')

function toLocalInput(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function brasiliaHour(local: string) {
  const date = new Date(local)
  if (Number.isNaN(date.getTime())) return null
  return Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(date))
}

const blank = (): Draft => ({
  tipo: 'campanha',
  titulo: '',
  mensagem: '',
  origem: '',
  uf: '',
  cidade: '',
  centro: null,
  conteudo: null,
  quando: toLocalInput(new Date().toISOString()),
})

const fromNotice = (n: Notice): Draft => ({
  tipo: n.tipo,
  titulo: n.titulo,
  mensagem: n.mensagem,
  origem: n.origem,
  uf: n.uf,
  cidade: n.cidade,
  centro: n.centro,
  conteudo: n.conteudo,
  quando: toLocalInput(n.data_disparo),
})

export default function NotificationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, contents } = useStore()
  const isNew = !id
  const canPublish = Boolean(currentUser?.podePublicarAvisos)

  const [existing, setExisting] = useState<Notice | null | undefined>(isNew ? null : undefined)
  const [form, setForm] = useState<Draft>(blank)
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [reach, setReach] = useState<NoticeReach | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    api<Notice>(`/staff/notifications/${id}/`)
      .then((n) => {
        setExisting(n)
        setForm(fromNotice(n))
      })
      .catch(() => setExisting(null))
  }, [id, isNew])

  useEffect(() => {
    api<CenterOption[]>('/staff/centers/')
      .then((list) => setCenters(list.filter((c) => c.status === 'publicado')))
      .catch(() => setCenters([]))
  }, [])

  const { tipo, uf, cidade } = form
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ tipo, uf: uf.trim(), cidade: cidade.trim() })
      api<NoticeReach>(`/staff/notifications/alcance/?${query}`)
        .then(setReach)
        .catch(() => setReach(null))
    }, 300)
    return () => clearTimeout(timer)
  }, [tipo, uf, cidade])

  if (existing === undefined) return null
  if (!isNew && !existing) return <Navigate to="/notificacoes" replace />

  const sent = existing ? isSent(existing) : false
  const readOnly = sent || (existing?.status === 'publicado' && !canPublish)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm((f) => ({ ...f, [key]: value }))
  const hour = brasiliaHour(form.quando)
  const outsideWindow = hour !== null && (hour < 8 || hour >= 21)

  async function save(status: PublishStatus) {
    if (status === 'publicado' && !form.origem.trim()) {
      setError('Informe a origem oficial para publicar. Sem origem, o aviso permanece como rascunho.')
      return
    }
    const when = new Date(form.quando)
    if (Number.isNaN(when.getTime())) {
      setError('Informe a data e a hora do disparo.')
      return
    }
    setBusy(true)
    setError('')
    const { quando: _q, ...rest } = form
    const body = { ...rest, uf: rest.uf.trim().toUpperCase(), cidade: rest.cidade.trim(), data_disparo: when.toISOString(), status }
    try {
      if (isNew) await api<Notice>('/staff/notifications/', { method: 'POST', body })
      else await api<Notice>(`/staff/notifications/${id}/`, { method: 'PATCH', body })
      navigate('/notificacoes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o aviso.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="px-5.5 pt-8 pb-4">
      <h2 className="mb-1 text-lg">{isNew ? 'Novo aviso' : readOnly ? 'Aviso' : 'Editar aviso'}</h2>
      <p className="mb-5 text-xs text-ink/60">
        O aviso aparece na caixa de entrada de quem mora na região e escolheu o assunto. Push e e-mail vão só para quem ativou o canal.
      </p>

      {readOnly && existing && (
        <div className="mb-4 rounded-xl border border-ink/10 bg-ink/5 px-4 py-3 text-xs">
          {sent ? (
            <>
              <p className="font-semibold">Aviso já disparado: só leitura. Para corrigir, despublique e crie outro.</p>
              {existing.disparado_em && (
                <p className="mt-1">
                  Disparado em {formatDateTime(existing.disparado_em)} · Celular: {existing.envios.push.enviado} enviados,{' '}
                  {existing.envios.push.falhou} com falha · E-mail: {existing.envios.email.enviado} enviados, {existing.envios.email.falhou} com falha
                </p>
              )}
            </>
          ) : (
            <p className="font-semibold">Aviso publicado. Somente administradores e administradores de conteúdo alteram.</p>
          )}
        </div>
      )}

      <fieldset disabled={readOnly}>
        <div className="flex flex-wrap gap-4">
          <div className="w-56">
            <span className={label}>Tipo</span>
            <select className={`${field} h-8`} value={form.tipo} onChange={(e) => set('tipo', e.target.value as NoticeKind)}>
              {Object.entries(NOTICE_KINDS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          <div className="w-56">
            <label className={label} htmlFor="quando">
              Data e hora do disparo
            </label>
            <input id="quando" type="datetime-local" className={`${field} h-8`} value={form.quando} onChange={(e) => set('quando', e.target.value)} required />
          </div>
        </div>
        {outsideWindow && (
          <p className="mt-2 text-xs text-amber-700">
            Fora da janela das 8h às 21h (Brasília): a caixa de entrada mostra no horário marcado, e push e e-mail saem às 8h.
          </p>
        )}

        <input className={`${field} mt-3 h-8`} placeholder="Título" maxLength={120} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required />
        <textarea
          className={`${field} mt-3 h-24 resize-none py-2.5`}
          placeholder="Mensagem"
          maxLength={500}
          value={form.mensagem}
          onChange={(e) => set('mensagem', e.target.value)}
          required
        />

        <label className={label} htmlFor="origem">
          Origem oficial
        </label>
        <input
          id="origem"
          className={`${field} h-8`}
          placeholder="Ex.: Hemoal, Ministério da Saúde, INCA"
          maxLength={120}
          value={form.origem}
          onChange={(e) => set('origem', e.target.value)}
        />

        <div className="flex flex-wrap gap-4">
          <div className="w-24">
            <label className={label} htmlFor="uf">
              UF
            </label>
            <input id="uf" className={`${field} h-8 uppercase`} placeholder="Brasil" maxLength={2} value={form.uf} onChange={(e) => set('uf', e.target.value)} />
          </div>
          <div className="w-64">
            <label className={label} htmlFor="cidade">
              Cidade
            </label>
            <input
              id="cidade"
              className={`${field} h-8`}
              placeholder={form.uf.trim() ? 'Todo o estado' : 'Informe a UF antes'}
              disabled={!form.uf.trim()}
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="w-72">
            <span className={label}>Centro relacionado (opcional)</span>
            <select className={`${field} h-8`} value={form.centro ?? ''} onChange={(e) => set('centro', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Nenhum</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {c.cidade}/{c.uf}
                </option>
              ))}
            </select>
          </div>
          <div className="w-72">
            <span className={label}>Conteúdo relacionado (opcional)</span>
            <select className={`${field} h-8`} value={form.conteudo ?? ''} onChange={(e) => set('conteudo', e.target.value || null)}>
              <option value="">Nenhum</option>
              {contents
                .filter((c) => c.status === 'publicado')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </fieldset>

      {!sent && (
        <div className="mt-5 rounded-xl border border-ink/10 px-4 py-3 text-xs">
          <p className="font-semibold">Alcance agora</p>
          {reach ? (
            <p className="mt-1">
              {reach.caixaDeEntrada} na caixa de entrada · {reach.push} no celular · {reach.email} por e-mail
            </p>
          ) : (
            <p className="mt-1 text-ink/60">Carregando…</p>
          )}
          <p className="mt-1 text-ink/60">Só contagens, sem nomes. Muda conforme as pessoas ligam ou desligam os avisos.</p>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap justify-end gap-4">
        <Button variant="danger-outline" onClick={() => navigate('/notificacoes')}>
          {readOnly ? 'Voltar' : 'Cancelar'}
        </Button>
        {!readOnly && (
          <Button variant="outline" disabled={busy} onClick={() => save('rascunho')}>
            Salvar rascunho
          </Button>
        )}
        {!readOnly && canPublish && (
          <Button disabled={busy} onClick={() => save('publicado')}>
            {busy ? 'Salvando…' : 'Publicar'}
          </Button>
        )}
      </div>
    </form>
  )
}
