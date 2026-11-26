import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useStore } from '../../data/store'
import { api } from '../../lib/api'
import type { Journey, PublishStatus } from '../../data/types'

// Regiões do guia no app (mobile/src/content/journey.ts). Em branco, vale o resumo geral.
const REGIONS = [
  { id: 'maceio', label: 'Maceió/AL' },
  { id: 'recife', label: 'Recife/PE' },
  { id: 'outra', label: 'Outra região' },
]

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
  const { journeys, saveJourney, currentUser } = useStore()
  // RF05/RF06: só administradores publicam ou alteram etapas oficiais; a equipe prepara rascunhos.
  const isAdmin = currentUser?.nivel === 'Admin'
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
      const byRegion = Object.fromEntries(
        Object.entries(form.resumo_por_regiao).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v),
      )
      const place = form.local?.name.trim() ? { name: form.local.name.trim(), address: form.local.address.trim() } : null
      const payload: Journey = {
        ...form,
        resumo_por_regiao: byRegion,
        local: place,
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

      <span className={label}>Resumo por região (opcional, substitui o resumo geral naquela região)</span>
      {REGIONS.map((r) => (
        <input
          key={r.id}
          className={`${field} mt-2 h-8`}
          placeholder={r.label}
          aria-label={`Resumo para ${r.label}`}
          value={form.resumo_por_regiao[r.id] ?? ''}
          onChange={(e) => set('resumo_por_regiao', { ...form.resumo_por_regiao, [r.id]: e.target.value })}
        />
      ))}
      <textarea className={`${field} mt-3 h-32 resize-none py-2.5`} placeholder="Corpo" value={form.corpo} onChange={(e) => set('corpo', e.target.value)} required />

      <input className={`${field} mt-3 h-8`} placeholder="O que o STEM faz" value={form.o_que_stem_faz} onChange={(e) => set('o_que_stem_faz', e.target.value)} />
      <input className={`${field} mt-3 h-8`} placeholder="O que o SUS faz" value={form.o_que_sus_faz} onChange={(e) => set('o_que_sus_faz', e.target.value)} />

      <span className={label}>Checklist (um item por linha)</span>
      <textarea className={`${field} h-24 resize-none py-2.5`} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} />

      <span className={label}>Onde fazer (opcional)</span>
      <div className="flex gap-4">
        <input
          className={`${field} h-8 flex-1`}
          placeholder="Unidade (ex.: Hemoal · Maceió)"
          aria-label="Unidade onde fazer"
          value={form.local?.name ?? ''}
          onChange={(e) => set('local', { name: e.target.value, address: form.local?.address ?? '' })}
        />
        <input
          className={`${field} h-8 flex-1`}
          placeholder="Endereço"
          aria-label="Endereço da unidade"
          value={form.local?.address ?? ''}
          onChange={(e) => set('local', { name: form.local?.name ?? '', address: e.target.value })}
        />
      </div>

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
            <option value="publicado" disabled={!isAdmin}>publicado</option>
            <option value="inativo">inativo</option>
          </select>
        </div>
      </div>

      {!isAdmin && (
        <p className="mt-2 text-xs">Somente administradores publicam ou alteram etapas já publicadas. Salve como rascunho.</p>
      )}

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