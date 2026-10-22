import { Eye, FilePlus2, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyRow, SortButton, headClass, rowClass, useSort } from '../../components/table'
import { Button, ConfirmPasswordModal, Modal } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Content } from '../../data/types'
import { formatDate, formatSize } from '../../lib/format'

const cols = 'grid-cols-[2rem_1.3fr_1.4fr_1.4fr_0.8fr_6rem]'

const statusStyle: Record<Content['status'], string> = {
  publicado: 'bg-green-100 text-green-700',
  rascunho: 'bg-amber-100 text-amber-700',
  inativo: 'bg-ink/10 text-ink/60',
}

export default function ContentList() {
  const { contents, unpublishContent } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [toDelete, setToDelete] = useState<Content | null>(null)
  const [preview, setPreview] = useState<Content | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const q = (params.get('q') ?? '').toLowerCase()
  const visible = contents.filter(
    (c) => c.status !== 'inativo' && (c.titulo.toLowerCase().includes(q) || c.categoria.toLowerCase().includes(q)),
  )
  const { sorted, toggle } = useSort(visible, 'titulo')
  const allSelected = sorted.length > 0 && sorted.every((c) => selected.includes(c.id))

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-5.5 pt-7 pb-5">
        <h2 className="text-lg">Lista de conteúdo</h2>
        <Button variant="outline" onClick={() => navigate('/conteudo/novo')}>
          <FilePlus2 className="size-4" />
          Cadastrar conteúdo
        </Button>
      </div>

      <div className="overflow-x-auto">
      <div className="min-w-190">
      <div className={`${headClass} ${cols}`}>
        <input
          type="checkbox"
          className="size-4"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? [] : sorted.map((c) => c.id))}
          title="Selecionar todos"
        />
        <SortButton label="Título" onClick={() => toggle('titulo')} />
        <SortButton label="Categoria" onClick={() => toggle('categoria')} />
        <SortButton label="Visibilidade" onClick={() => toggle('visibilidade')} />
        <SortButton label="Status" onClick={() => toggle('status')} />
        <span className="text-center">Ações</span>
      </div>

      <div className="mt-6 px-6">
        {sorted.length === 0 && <EmptyRow text="Nenhum conteúdo encontrado." />}
        {sorted.map((c) => (
          <div key={c.id} className={`${rowClass} ${cols} shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}>
            <input
              type="checkbox"
              className="size-3"
              checked={selected.includes(c.id)}
              onChange={() => setSelected((s) => (s.includes(c.id) ? s.filter((id) => id !== c.id) : [...s, c.id]))}
            />
            <b className="truncate pr-2">{c.titulo}</b>
            <span>
              <b>Categoria:</b> {c.categoria}
            </span>
            <span>
              <b>Visibilidade:</b> {c.visibilidade}
            </span>
            <span>
              <span className={`rounded-full px-2 py-0.5 capitalize ${statusStyle[c.status]}`}>{c.status}</span>
            </span>
            <div className="flex justify-center gap-5">
              <button type="button" onClick={() => setPreview(c)} title="Visualizar">
                <Eye className="size-4" strokeWidth={1.5} />
              </button>
              <Link to={`/conteudo/${c.id}/editar`} title="Editar">
                <Pencil className="size-4" strokeWidth={1.5} />
              </Link>
              <button type="button" onClick={() => setToDelete(c)} title="Deletar">
                <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
      </div>

      </div>
      </div>

      {preview && (
        <Modal title={preview.titulo} onClose={() => setPreview(null)} className="max-w-xl px-10 py-10">
          <p className="mb-4 text-sm whitespace-pre-line">{preview.descricao}</p>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="font-semibold">Categoria</dt>
            <dd>{preview.categoria}</dd>
            <dt className="font-semibold">Público-alvo</dt>
            <dd>{preview.publicoAlvo.join(', ') || '—'}</dd>
            <dt className="font-semibold">Fonte</dt>
            <dd>{preview.fonte || 'Não informada'}</dd>
            <dt className="font-semibold">Validação clínica</dt>
            <dd>{preview.validacaoClinica ? `Validado por ${preview.validadoPor}` : 'Pendente'}</dd>
            <dt className="font-semibold">Atualizado em</dt>
            <dd>{formatDate(preview.atualizadoEm)}</dd>
            <dt className="font-semibold">Anexos</dt>
            <dd>{preview.anexos.map((a) => `${a.nome} (${formatSize(a.tamanho)})`).join(', ') || '—'}</dd>
          </dl>
        </Modal>
      )}

      {toDelete && (
        <ConfirmPasswordModal
          title="Deletar Conteúdo"
          confirmLabel="Deletar"
          onClose={() => setToDelete(null)}
          onConfirm={async (senha) => {
            await unpublishContent(toDelete.id, senha)
            setToDelete(null)
          }}
        />
      )}
    </div>
  )
}
