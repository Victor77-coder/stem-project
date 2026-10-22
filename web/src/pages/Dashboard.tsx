import { FileCheck, FilePen, Paperclip, UserCheck, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { CATEGORIES, type Dashboard as DashboardData } from '../data/types'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'

function StatCard({ title, value, text, icon: Icon }: { title: string; value: number; text: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl bg-surface p-2.5 pb-6 shadow-[0_3px_4px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium">{title}</h3>
        <span className="flex size-8 items-center justify-center rounded-full bg-[#d9d9d9]">
          <Icon className="size-4 text-purple-700" strokeWidth={1.5} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-[10px]">{text}</p>
    </div>
  )
}

const panel = 'rounded-2xl bg-surface p-3 shadow-[0_3px_4px_rgba(0,0,0,0.2)]'

export default function Dashboard() {
  const { contents } = useStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<DashboardData>('/staff/dashboard/')
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [contents])

  if (error) return <p className="p-10 text-center text-sm text-danger">{error}</p>
  if (!data) return null
  const recent = data.recentes
  const history = data.atividade

  return (
    <div className="grid gap-6 p-5.5">
      <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
        <StatCard title="Conteúdos publicados" value={data.publicados} text="Visíveis ao usuário final" icon={FileCheck} />
        <StatCard title="Rascunhos" value={data.rascunhos} text="Aguardando fonte ou validação" icon={FilePen} />
        <StatCard title="Contas ativas" value={data.contasAtivas} text="Administradores e editores" icon={UserCheck} />
        <StatCard title="Anexos" value={data.anexos} text="Arquivos enviados" icon={Paperclip} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <div className={panel}>
            <h3 className="mb-3 text-xs font-medium">Conteúdos recentes</h3>
            <ul className="space-y-2 text-[11px]">
              {recent.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <Link to={`/conteudo/${c.id}/editar`} className="truncate hover:text-primary">
                    {c.titulo}
                  </Link>
                  <span className="shrink-0 capitalize">{c.status}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={panel}>
            <h3 className="mb-3 text-xs font-medium">Atividade recente</h3>
            <ul className="space-y-2 text-[11px]">
              {history.map((h, i) => (
                <li key={i}>
                  <b>{h.autor}</b> — {h.acao.toLowerCase()} “{h.titulo}” em {formatDate(h.data)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={panel}>
          <h3 className="mb-3 text-xs font-medium">Conteúdos por categoria</h3>
          <ul className="space-y-3 text-[11px]">
            {CATEGORIES.map((cat) => {
              const n = data.porCategoria.find((c) => c.categoria === cat)?.total ?? 0
              return (
                <li key={cat}>
                  <div className="mb-1 flex justify-between">
                    <span>{cat}</span>
                    <span>{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#d9d9d9]">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(n / Math.max(data.totalConteudos, 1)) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-6 text-[10px] text-ink/60">Métricas agregadas — sem dados nominais de usuários finais (RF012).</p>
        </div>
      </div>
    </div>
  )
}
