import { ChevronDown, FileImage, FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useStore } from '../../data/store'
import { AUDIENCES, CATEGORIES, type Attachment, type Content, type PublishStatus, type Visibility } from '../../data/types'
import { formatDate, formatSize, today, uid } from '../../lib/format'

const MAX_SIZE = 500 * 1024 ** 2

const field = 'w-full rounded-lg bg-field px-2.5 text-sm shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none placeholder:text-ink focus:ring-2 focus:ring-primary/40'

const blank = (): Content => ({
  id: uid(),
  titulo: '',
  descricao: '',
  categoria: CATEGORIES[0],
  publicoAlvo: [],
  fonte: '',
  visibilidade: 'Privado',
  status: 'rascunho',
  anexos: [],
  atualizadoEm: today(),
  historico: [],
})

function PillSelect<T extends string>({ value, options, onChange, active }: { value: T; options: T[]; onChange: (v: T) => void; active: boolean }) {
  return (
    <div className="relative w-61">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`h-8 w-full appearance-none rounded-lg px-3.5 text-xs font-semibold capitalize shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none ${
          active ? 'bg-primary text-white' : 'bg-[#c4c4c4] text-ink'
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-white text-ink">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className={`pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 ${active ? 'text-white' : ''}`} />
    </div>
  )
}

export default function ContentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contents, saveContent, currentUser } = useStore()
  const existing = contents.find((c) => c.id === id)
  const isNew = !id

  const [form, setForm] = useState<Content>(() => existing ?? blank())
  const [touched, setTouched] = useState({ visibilidade: !isNew, status: !isNew })
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!isNew && !existing) return <Navigate to="/conteudo" replace />

  const set = <K extends keyof Content>(key: K, value: Content[K]) => setForm((f) => ({ ...f, [key]: value }))

  function addFiles(files: FileList | null) {
    if (!files) return
    const accepted: Attachment[] = []
    const rejected: string[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) rejected.push(file.name)
      else accepted.push({ id: uid(), nome: file.name, tamanho: file.size, enviadoEm: today() })
    }
    setError(rejected.length ? `Arquivo acima de 500 MB: ${rejected.join(', ')}` : '')
    set('anexos', [...form.anexos, ...accepted])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.status === 'publicado' && !form.fonte.trim()) {
      setError('Informe a fonte para publicar. Sem fonte o conteúdo permanece como rascunho.')
      return
    }
    if (form.publicoAlvo.length === 0) {
      setError('Selecione ao menos um público-alvo.')
      return
    }
    saveContent({
      ...form,
      atualizadoEm: today(),
      historico: [
        ...form.historico,
        { autor: currentUser?.nome ?? '', acao: isNew ? 'Criou o conteúdo' : 'Editou o conteúdo', data: new Date().toISOString() },
      ],
    })
    navigate('/conteudo')
  }

  const label = 'mt-3 mb-2 block text-sm font-medium'

  return (
    <form onSubmit={submit} className="px-5.5 pt-8 pb-4">
      <h2 className="mb-5 text-lg">{isNew ? 'Cadastro de conteúdo' : 'Editar conteúdo'}</h2>

      <input className={`${field} h-8`} placeholder="Título" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required />
      <textarea
        className={`${field} mt-3 h-27 resize-none py-2.5`}
        placeholder="Descrição"
        value={form.descricao}
        onChange={(e) => set('descricao', e.target.value)}
        required
      />

      <span className={label}>Categoria</span>
      <div className="grid grid-cols-2 gap-y-2 text-xs md:grid-cols-4">
        {CATEGORIES.map((c) => (
          <label key={c} className="flex items-center gap-1.5">
            <input type="radio" name="categoria" checked={form.categoria === c} onChange={() => set('categoria', c)} className="size-3.5 accent-ink" />
            {c}
          </label>
        ))}
      </div>

      <span className={label}>Público-alvo</span>
      <div className="flex gap-10 text-xs">
        {AUDIENCES.map((a) => (
          <label key={a} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.publicoAlvo.includes(a)}
              onChange={() =>
                set('publicoAlvo', form.publicoAlvo.includes(a) ? form.publicoAlvo.filter((x) => x !== a) : [...form.publicoAlvo, a])
              }
              className="size-3.5 accent-ink"
            />
            {a}
          </label>
        ))}
      </div>

      <label className={label} htmlFor="fonte">
        Fonte
      </label>
      <input
        id="fonte"
        className={`${field} h-8`}
        placeholder="Ex.: Ministério da Saúde, Liga Alamir, diretriz clínica"
        value={form.fonte}
        onChange={(e) => set('fonte', e.target.value)}
      />

      <div className="flex flex-wrap gap-x-10">
        <div>
          <span className={label}>Visibilidade</span>
          <PillSelect<Visibility>
            value={form.visibilidade}
            options={['Público', 'Privado', 'Restrito']}
            active={touched.visibilidade}
            onChange={(v) => {
              set('visibilidade', v)
              setTouched((t) => ({ ...t, visibilidade: true }))
            }}
          />
        </div>
        <div>
          <span className={label}>Status</span>
          <PillSelect<PublishStatus>
            value={form.status}
            options={['rascunho', 'publicado']}
            active={touched.status}
            onChange={(v) => {
              set('status', v)
              setTouched((t) => ({ ...t, status: true }))
            }}
          />
        </div>
      </div>

      <span className={label}>Adicionar Anexo/imagem</span>
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`flex h-31 w-full flex-col items-center justify-center rounded-lg border border-primary transition ${
          dragging ? 'bg-primary/10' : 'bg-field'
        }`}
      >
        <Upload className="mb-3 size-8 text-primary" strokeWidth={2.5} />
        <span className="text-sm">Envie o documento arrastando para esta área ou selecionando no seu dispositivo.</span>
        <span className="mt-3 text-sm text-ink/50">Máximo de 500 MB por arquivo</span>
      </button>
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />

      {form.anexos.length > 0 && (
        <ul className="mt-6">
          {form.anexos.map((a) => {
            const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(a.nome)
            const Icon = isImage ? FileImage : FileText
            return (
              <li key={a.id} className="flex items-center gap-5 border-b border-ink/15 py-2 last:border-0">
                <Icon className="size-10 text-danger" strokeWidth={1.2} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.nome}</p>
                  <p className="text-[10px] text-ink/70">{formatSize(a.tamanho)}</p>
                  <p className="text-[10px] text-ink/70">Enviado dia {formatDate(a.enviadoEm)}</p>
                </div>
                <button
                  type="button"
                  title="Remover anexo"
                  onClick={() => set('anexos', form.anexos.filter((x) => x.id !== a.id))}
                >
                  <Trash2 className="size-6 text-danger" strokeWidth={1.2} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}

      <div className="mt-6 flex justify-end gap-8">
        <Button variant="danger-outline" onClick={() => navigate('/conteudo')}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  )
}
