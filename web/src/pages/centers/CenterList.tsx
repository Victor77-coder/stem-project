import { MapPinPlus, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyRow, SortButton, headClass, rowClass, useSort } from '../../components/table'
import { Button } from '../../components/ui'
import { CENTER_KINDS, UFS, type Center, type CenterKind, type PublishStatus } from '../../data/types'
import { api } from '../../lib/api'

const cols = 'grid-cols-[2fr_1fr_1fr_0.8fr_0.8fr_0.9fr_5rem]'
const select = 'h-8 rounded-md border border-ink/30 bg-white px-2 text-xs outline-none focus:border-primary'

const statusStyle: Record<PublishStatus, string> = {
  publicado: 'bg-green-100 text-green-700',
  rascunho: 'bg-amber-100 text-amber-700',
  inativo: 'bg-ink/10 text-ink/60',
}

type Filters = { tipo: CenterKind | ''; origem: Center['origem'] | ''; status: PublishStatus | ''; uf: string; revisar: boolean }

/** Por que uma campanha publicada não aparece no app (mesma regra da API pública); vazio se aparece. */
function campaignHidden(c: Center) {
  if (!c.evento_fim) return 'sem último dia, oculta no app'
  const todayLocal = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso do navegador
  return c.evento_fim < todayLocal ? 'encerrada' : ''
}

/** Cadastros (RF13): centros do CNES (só correções seguras) e campanhas e centros cadastrados pela equipe. */
export default function CenterList() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [centers, setCenters] = useState<Center[]>([])
  const [filters, setFilters] = useState<Filters>({ tipo: '', origem: '', status: '', uf: '', revisar: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<Center[]>('/staff/centers/')
      .then(setCenters)
      .catch((err: Error) => setError(err.message))
  }, [])

  const q = (params.get('q') ?? '').toLowerCase()
  const visible = centers.filter(
    (c) =>
      (!filters.tipo || c.tipo === filters.tipo) &&
      (!filters.origem || c.origem === filters.origem) &&
      (filters.status ? c.status === filters.status : c.status !== 'inativo') &&
      (!filters.uf || c.uf === filters.uf) &&
      (!filters.revisar || c.revisar) &&
      (!q || c.nome.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q) || c.cnes.includes(q)),
  )
  const { sorted, toggle } = useSort(visible, 'nome')
  const toReview = centers.filter((c) => c.revisar && c.status !== 'inativo').length
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }))

  async function unpublish(center: Center) {
    if (!confirm(`Despublicar "${center.nome_curto || center.nome}"? Ele sai do mapa e da lista do aplicativo.`)) return
    setBusy(true)
    setError('')
    try {
      await api(`/staff/centers/${center.id}/`, { method: 'DELETE' })
      setCenters((list) => list.map((c) => (c.id === center.id ? { ...c, status: 'inativo' } : c)))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between gap-4 px-5.5 pt-7 pb-4">
        <div>
          <h2 className="text-lg">Centros e campanhas</h2>
          <p className="text-xs text-ink/60">
            Centros do CNES chegam pela coleta mensal e aceitam só correções (telefone, horário, observações, coordenadas).
            Campanhas e centros sem CNES são cadastrados aqui.
          </p>
        </div>
        <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => navigate('/cadastros/novo')}>
          <MapPinPlus className="size-4" />
          Cadastrar
        </Button>
      </div>

      {toReview > 0 && (
        <button
          type="button"
          onClick={() => set('revisar', !filters.revisar)}
          className="mx-5.5 mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800"
        >
          <TriangleAlert className="size-4" />
          {toReview} centro{toReview === 1 ? '' : 's'} do CNES para revisar. {filters.revisar ? 'Mostrar todos' : 'Ver só esses'}
        </button>
      )}

      <div className="flex flex-wrap gap-2 px-5.5 pb-4">
        <select className={select} value={filters.tipo} onChange={(e) => set('tipo', e.target.value as Filters['tipo'])} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(CENTER_KINDS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select className={select} value={filters.origem} onChange={(e) => set('origem', e.target.value as Filters['origem'])} aria-label="Origem">
          <option value="">Toda origem</option>
          <option value="cnes">Coleta do CNES</option>
          <option value="manual">Cadastro da equipe</option>
        </select>
        <select className={select} value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])} aria-label="Status">
          <option value="">Publicados e rascunhos</option>
          <option value="publicado">Publicados</option>
          <option value="rascunho">Rascunhos</option>
          <option value="inativo">Despublicados</option>
        </select>
        <select className={select} value={filters.uf} onChange={(e) => set('uf', e.target.value)} aria-label="UF">
          <option value="">Todas as UFs</option>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </div>

      {error && <p className="px-6 pb-4 text-xs text-danger">{error}</p>}

      <div className="overflow-x-auto">
        <div className="min-w-190">
          <div className={`${headClass} ${cols}`}>
            <SortButton label="Nome" onClick={() => toggle('nome')} />
            <SortButton label="Tipo" onClick={() => toggle('tipo')} />
            <SortButton label="Cidade" onClick={() => toggle('cidade')} />
            <SortButton label="Origem" onClick={() => toggle('origem')} />
            <SortButton label="Status" onClick={() => toggle('status')} />
            <span>Revisão</span>
            <span className="text-center">Ações</span>
          </div>

          <div className="mt-6 px-6">
            {sorted.length === 0 && <EmptyRow text="Nenhum centro ou campanha encontrado." />}
            {sorted.map((c) => (
              <div key={c.id} className={`${rowClass} ${cols} shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}>
                <span className="truncate pr-2">
                  <b>{c.nome_curto || c.nome}</b>
                  {c.tipo === 'campanha' && c.evento_quando ? <span className="text-ink/60"> · {c.evento_quando}</span> : null}
                  {c.tipo === 'campanha' && c.status === 'publicado' && campaignHidden(c) ? (
                    <span className="text-danger"> · {campaignHidden(c)}</span>
                  ) : null}
                </span>
                <span>{CENTER_KINDS[c.tipo]}</span>
                <span className="truncate pr-2">
                  {c.cidade}/{c.uf}
                </span>
                <span>{c.origem === 'cnes' ? 'CNES' : 'Equipe'}</span>
                <span>
                  <span className={`rounded-full px-2 py-0.5 capitalize ${statusStyle[c.status]}`}>{c.status}</span>
                </span>
                <span className="truncate pr-2" title={c.motivo_revisao}>
                  {c.revisar ? <span className="text-amber-700">Revisar</span> : '—'}
                </span>
                <div className="flex justify-center gap-5">
                  <Link to={`/cadastros/${c.id}/editar`} title="Editar">
                    <Pencil className="size-4" strokeWidth={1.5} />
                  </Link>
                  {c.status !== 'inativo' && (
                    <button type="button" disabled={busy} onClick={() => unpublish(c)} title="Despublicar">
                      <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
