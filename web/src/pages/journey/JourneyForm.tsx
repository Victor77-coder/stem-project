import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useStore } from '../../data/store'
import { api } from '../../lib/api'
import type { Journey, PublishStatus } from '../../data/types'

const field = 'w-full rounded-lg bg-field px-2.5 text-sm shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none placeholder:text-ink focus:ring-2 focus:ring-primary/40'

const blank = (): Journey => ({
  id: 0,
  jornada: 'doador',
  slug: '',
  ordem: 1,
  titulo: '',
  titulo_curto: '',
  resumo: '',
  resumo_home: '',
  resumo_por_regiao: {},
  corpo: '',
  o_que_stem_faz: '',
  o_que_sus_faz: '',
  checklist: [],
  local: null,
  fonte: '',
  status: 'rascunho',
  atualizado_em: '',
})

export default function JourneyForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { journeys, saveJourney } = useStore()
  const isNew = !id

  const [existing, setExisting] = useState<Journey | null | undefined>(() =>
    isNew ? blank() : journeys.find((j) => j.id === Number(id)),
  )
  const [form, setForm] = useState<Journey>(() => existing ?? blank())
  const [checklistText, setChecklistText] = useState(() => (existing?.checklist ?? []).join('\n'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew || existing !== undefined) return
    api<Journey>(`/staff/journeys/${id}/`)
      .then((j) => {
        setExisting(j)
        setForm(j)
        setChecklistText((j.checklist ?? []).join('\n'))
      })
      .catch(() => setExisting(null))
  }, [id, isNew, existing])

  if (existing === undefined) return null
  if (!existing) return <Navigate to="/jornada" replace />

  const set = <K extends keyof Journey>(key: K, value: Journey[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.status === 'publicado' && !form.fonte.trim()) {
      setError('Informe a fonte para publicar. Sem fonte a etapa permanece como rascunho.')
      return
    }
    setBusy(true)
    try {
      const payload: Journey = {
        ...form,
        checklist: checklistText.split('\n').map((s) => s.trim()).filter(Boolean),
      }
      await saveJourney(payload, isNew)
      navigate('/jornada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a etapa.')
    } finally {
      setBusy(false)
    }
  }

  const label = 'mt-3 mb-2 block text-sm font-medium'

  return (
    <form onSubmit={submit} className="px-5.5 pt-8 pb-4">
      <h2 className="mb-5 text-lg">{isNew ? 'Cadastro de etapa da jornada' : 'Editar etapa da jornada'}</h2>

      <div className="flex gap-4">
        <div className="flex-1">
          <span className={label}>Jornada</span>
          <select
            className={`${field} h-8`}
            value={form.jornada}
            onChange={(e) => set('jornada', e.target.value as Journey['jornada'])}
          >
            <option value="doador">Doador</option>
            <option value="receptor">Receptor</option>
          </select>
        </div>
        <div className="w-24">
          <span className={label}>Ordem</span>
          <input
            type="number"
            className={`${field} h-8`}
            value={form.ordem}
            onChange={(e) => set('ordem', Number(e.target.value))}
            required
          />
        </div>
      </div>

      <input className={`${field} mt-3 h-8`} placeholder="Slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} required />
      <input className={`${field} mt-3 h-8`} placeholder="Título" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required />
      <input className={`${field} mt-3 h-8`} placeholder="Título curto" value={form.titulo_curto} onChange={(e) => set('titulo_curto', e.target.value)} />

      <textarea className={`${field} mt-3 h-20 resize-none py-2.5`} placeholder="Resumo" value={form.resumo} onChange={(e) => set('resumo', e.target.value)} required />
      <textarea className={`${field} mt-3 h-16 resize-none py-2.5`} placeholder="Resumo (home)" value={form.resumo_home} onChange={(e) => set('resumo_home', e.target.value)} />
      <textarea className={`${field} mt-3 h-32 resize-none py-2.5`} placeholder="Corpo" value={form.corpo} onChange={(e) => set('corpo', e.target.value)} required />

      <input className={`${field} mt-3 h-8`} placeholder="O que o STEM faz" value={form.o_que_stem_faz} onChange={(e) => set('o_que_stem_faz', e.target.value)} />
      <input className={`${field} mt-3 h-8`} placeholder="O que o SUS faz" value={form.o_que_sus_faz} onChange={(e) => set('o_que_sus_faz', e.target.value)} />

      <span className={label}>Checklist (um item por linha)</span>
      <textarea className={`${field} h-24 resize-none py-2.5`} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} />

      <label className={label} htmlFor="fonte">Fonte</label>
      <input id="fonte" className={`${field} h-8`} placeholder="Ex.: Ministério da Saúde" value={form.fonte} onChange={(e) => set('fonte', e.target.value)} />

      <div className="flex flex-wrap gap-x-10">
        <div>
          <span className={label}>Status</span>
          <select
            className={`${field} h-8 w-40`}
            value={form.status}
            onChange={(e) => set('status', e.target.value as PublishStatus)}
          >
            <option value="rascunho">rascunho</option>
            <option value="publicado">publicado</option>
            <option value="inativo">inativo</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}

      <div className="mt-6 flex justify-end gap-8">
        <Button variant="danger-outline" onClick={() => navigate('/jornada')}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}