import { Info } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui'
import { CENTER_KINDS, UFS, type Center, type PublishStatus } from '../../data/types'
import { api } from '../../lib/api'
import { formatDate, today } from '../../lib/format'

const input =
  'h-9 w-full rounded-lg bg-field px-2.5 text-sm shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60'

type Draft = Pick<
  Center,
  'tipo' | 'nome' | 'nome_curto' | 'endereco' | 'cidade' | 'uf' | 'telefone' | 'horario' | 'observacoes' | 'evento_quando' | 'fonte' | 'revisar' | 'motivo_revisao'
> & { lat: string; lng: string; fonte_data: string; evento_fim: string; status: PublishStatus }

/** Campos que a coleta mensal do CNES atualiza: no painel ficam travados para centros vindos dela. */
const CNES_LOCKED = new Set<keyof Draft>(['nome', 'endereco', 'cidade', 'uf', 'tipo', 'fonte', 'fonte_data'])

const blank = (): Draft => ({
  tipo: 'campanha',
  nome: '',
  nome_curto: '',
  endereco: '',
  cidade: '',
  uf: '',
  telefone: '',
  horario: '',
  observacoes: '',
  evento_quando: '',
  evento_fim: '',
  fonte: '',
  fonte_data: today(),
  revisar: false,
  motivo_revisao: '',
  lat: '',
  lng: '',
  status: 'rascunho',
})

const fromCenter = (c: Center): Draft => ({
  tipo: c.tipo,
  nome: c.nome,
  nome_curto: c.nome_curto,
  endereco: c.endereco,
  cidade: c.cidade,
  uf: c.uf,
  telefone: c.telefone,
  horario: c.horario,
  observacoes: c.observacoes,
  evento_quando: c.evento_quando,
  evento_fim: c.evento_fim ?? '',
  fonte: c.fonte,
  fonte_data: c.fonte_data ?? '',
  revisar: c.revisar,
  motivo_revisao: c.motivo_revisao,
  lat: c.lat == null ? '' : String(c.lat),
  lng: c.lng == null ? '' : String(c.lng),
  status: c.status,
})

function errorText(err: unknown) {
  if (!(err instanceof Error)) return 'Não foi possível salvar.'
  return err.message
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink/60">{hint}</span> : null}
    </label>
  )
}

export default function CenterForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [existing, setExisting] = useState<Center | null>(null)
  const [form, setForm] = useState<Draft>(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    api<Center>(`/staff/centers/${id}/`)
      .then((c) => {
        setExisting(c)
        setForm(fromCenter(c))
      })
      .catch((err: Error) => setError(err.message))
  }, [id, isNew])

  const fromCnes = existing?.origem === 'cnes'
  const locked = (field: keyof Draft) => fromCnes && CNES_LOCKED.has(field)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm((f) => ({ ...f, [key]: value }))
  const text = (key: keyof Draft) => ({
    value: String(form[key] ?? ''),
    disabled: locked(key),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    className: input,
  })

  async function save(status: PublishStatus) {
    setBusy(true)
    setError('')
    const number = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))
    // Centro do CNES: manda só o que pode mudar, para a API não recusar campo travado.
    const body = Object.fromEntries(
      Object.entries({
        ...form,
        nome_curto: form.nome_curto.trim() || form.nome.trim(),
        lat: number(form.lat),
        lng: number(form.lng),
        fonte_data: form.fonte_data || null,
        evento_fim: form.evento_fim || null,
        motivo_revisao: form.revisar ? form.motivo_revisao : '',
        status,
      }).filter(([key]) => !locked(key as keyof Draft)),
    )
    try {
      if (isNew) await api('/staff/centers/', { method: 'POST', body })
      else await api(`/staff/centers/${id}/`, { method: 'PATCH', body })
      navigate('/cadastros')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5.5 pt-7 pb-8">
      <h2 className="text-lg">{isNew ? 'Cadastrar centro ou campanha' : form.nome_curto || form.nome}</h2>
      {existing && (
        <p className="text-xs text-ink/60">
          {fromCnes ? `CNES ${existing.cnes}` : 'Cadastro da equipe'} · atualizado em {formatDate(existing.atualizado_em)}
        </p>
      )}

      {fromCnes && (
        <div className="mt-4 flex gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Este centro vem do CNES. Nome, endereço, cidade, UF, tipo, fonte e data são atualizados pela coleta mensal e não
            mudam aqui. Corrija telefone, horário, observações e coordenadas, ou marque a revisão como feita.
          </p>
        </div>
      )}

      {fromCnes && form.revisar && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="font-semibold">Para revisar</p>
          <p>{form.motivo_revisao || 'A coleta marcou mudanças neste centro.'}</p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={!form.revisar} onChange={() => set('revisar', false)} />
            Revisei e está correto
          </label>
        </div>
      )}

      <div className="mt-5 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        <Row label="Tipo">
          <select {...text('tipo')}>
            {Object.entries(CENTER_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Nome curto" hint="Aparece na lista e no mapa do aplicativo.">
          <input {...text('nome_curto')} maxLength={80} />
        </Row>
        <Row label="Nome">
          <input {...text('nome')} maxLength={200} />
        </Row>
        <Row label="Endereço">
          <input {...text('endereco')} maxLength={200} />
        </Row>
        <Row label="Cidade">
          <input {...text('cidade')} maxLength={100} />
        </Row>
        <Row label="UF">
          <select {...text('uf')}>
            <option value="">....</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </Row>
        {form.tipo === 'campanha' && (
          <>
            <Row label="Quando" hint="Data e horário da campanha, como aparece no app (ex.: 06/12 · 8h às 16h).">
              <input {...text('evento_quando')} maxLength={80} />
            </Row>
            <Row label="Último dia" hint="Depois dessa data a campanha sai do app sozinha. Obrigatório para publicar.">
              <input type="date" {...text('evento_fim')} />
            </Row>
          </>
        )}
        <Row label="Telefone">
          <input {...text('telefone')} maxLength={20} />
        </Row>
        <Row label="Horário de atendimento">
          <input {...text('horario')} maxLength={120} />
        </Row>
        <Row label="Latitude" hint="Sem coordenadas, a unidade não aparece no mapa nem na busca por distância.">
          <input {...text('lat')} inputMode="decimal" />
        </Row>
        <Row label="Longitude">
          <input {...text('lng')} inputMode="decimal" />
        </Row>
        <Row label="Fonte" hint="Obrigatória para publicar (RS008).">
          <input {...text('fonte')} maxLength={200} />
        </Row>
        <Row label="Data da fonte">
          <input type="date" {...text('fonte_data')} />
        </Row>
        <div className="md:col-span-2">
          <Row label="Observações">
            <textarea {...text('observacoes')} maxLength={300} className={`${input} h-20 py-2`} />
          </Row>
        </div>
      </div>

      {error && <p className="mt-4 text-xs whitespace-pre-line text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" disabled={busy} onClick={() => navigate('/cadastros')}>
          Cancelar
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => save('rascunho')}>
          Salvar rascunho
        </Button>
        <Button disabled={busy} onClick={() => save('publicado')}>
          Publicar
        </Button>
      </div>
    </div>
  )
}
