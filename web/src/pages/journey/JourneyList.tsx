import { FilePlus2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyRow, SortButton, headClass, rowClass, useSort } from '../../components/table'
import { Button } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Journey } from '../../data/types'
import { api } from '../../lib/api'

type AppConfig = { jornadaAtiva: boolean; atualizadoEm: string }

/** Liga ou desliga a aba Jornada no aplicativo. Só administradores alteram. */
function JourneySwitch() {
  const { currentUser } = useStore()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEdit = currentUser?.nivel === 'Admin'

  useEffect(() => {
    api<AppConfig>('/staff/config/')
      .then(setConfig)
      .catch((err: Error) => setError(err.message))
  }, [])

  async function toggle() {
    if (!config) return
    const next = !config.jornadaAtiva
    if (!confirm(next ? 'Exibir a Jornada no aplicativo?' : 'Ocultar a Jornada do aplicativo?')) return
    setSaving(true)
    setError('')
    try {
      setConfig(await api<AppConfig>('/staff/config/', { method: 'PATCH', body: { jornadaAtiva: next } }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const on = config?.jornadaAtiva ?? false
  return (
    <div className="mx-5.5 mb-5 flex items-center justify-between gap-4 rounded-xl border border-ink/10 px-4 py-3">
      <div>
        <p className="text-sm font-semibold">Jornada no aplicativo</p>
        <p className="text-xs text-ink/60">
          {config === null && !error
            ? 'Carregando…'
            : on
              ? 'Visível: a aba e os atalhos da Jornada aparecem no app.'
              : 'Oculta: a aba e os atalhos da Jornada não aparecem no app.'}
          {!canEdit && config !== null && ' Somente administradores podem alterar.'}
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Exibir a Jornada no aplicativo"
        disabled={!config || saving || !canEdit}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-green-600' : 'bg-ink/20'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

const statusStyle: Record<Journey['status'], string> = {
  publicado: 'bg-green-100 text-green-700',
  rascunho: 'bg-amber-100 text-amber-700',
  inativo: 'bg-ink/10 text-ink/60',
}

export default function JourneyList() {
  const { journeys, unpublishJourney } = useStore()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)

  const { sorted, toggle } = useSort(journeys, 'ordem')

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-5.5 pt-7 pb-5">
        <h2 className="text-lg">Etapas da jornada</h2>
        <Button variant="outline" onClick={() => navigate('/jornada/nova')}>
          <FilePlus2 className="size-4" />
          Cadastrar etapa
        </Button>
      </div>

      <JourneySwitch />

      <div className="overflow-x-auto">
        <div className="min-w-190">
          <div className={`${headClass} grid-cols-[4rem_1fr_2fr_0.8fr_6rem]`}>
            <SortButton label="Ordem" onClick={() => toggle('ordem')} />
            <SortButton label="Jornada" onClick={() => toggle('jornada')} />
            <SortButton label="Título" onClick={() => toggle('titulo')} />
            <SortButton label="Status" onClick={() => toggle('status')} />
            <span className="text-center">Ações</span>
          </div>

          <div className="mt-6 px-6">
            {sorted.length === 0 && <EmptyRow text="Nenhuma etapa encontrada." />}
            {sorted.map((j) => (
              <div key={j.id} className={`${rowClass} grid-cols-[4rem_1fr_2fr_0.8fr_6rem] shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}>
                <span className="text-center font-semibold">{j.ordem}</span>
                <span className="capitalize">{j.jornada}</span>
                <b className="truncate pr-2">{j.titulo}</b>
                <span>
                  <span className={`rounded-full px-2 py-0.5 capitalize ${statusStyle[j.status]}`}>{j.status}</span>
                </span>
                <div className="flex justify-center gap-5">
                  <Link to={`/jornada/${j.id}/editar`} title="Editar">
                    <Pencil className="size-4" strokeWidth={1.5} />
                  </Link>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      if (!confirm('Despublicar esta etapa?')) return
                      setDeleting(true)
                      try {
                        await unpublishJourney(j.id)
                      } finally {
                        setDeleting(false)
                      }
                    }}
                    title="Despublicar"
                  >
                    <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


    </div>
  )
}