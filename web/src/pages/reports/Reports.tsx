import { useEffect, useState } from 'react'
import { Card } from '../../components/ui'
import type { Reports as ReportsData } from '../../data/types'
import { api } from '../../lib/api'

const PROFILES = [
  { id: 'doador', label: 'Doadores', color: 'bg-primary' },
  { id: 'receptor', label: 'Receptores', color: 'bg-teal-500' },
  { id: 'convidado', label: 'Convidados', color: 'bg-amber-400' },
] as const

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthLabel = (value: string) => {
  const [year, month] = value.split('-')
  return `${MONTHS[Number(month) - 1]}/${year.slice(2)}`
}

/** null = recorte de 1 a 4 pessoas: aparece como "<5" para ninguém ser identificado. */
const count = (value: number | null) => (value === null ? '<5' : value.toLocaleString('pt-BR'))

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-ink/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink/60">{hint}</p> : null}
    </Card>
  )
}

/** Relatórios (RF13): só contagens, sem nomes nem identificadores. */
export default function Reports() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<ReportsData>('/staff/relatorios/')
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p className="p-10 text-center text-sm text-danger">{error}</p>
  if (!data) return <p className="p-10 text-center text-sm text-ink/60">Carregando relatórios…</p>

  const active = data.participantes.ativos
  const totalActive = PROFILES.reduce((sum, p) => sum + (active[p.id] ?? 0), 0)
  const peak = Math.max(1, ...data.meses.map((m) => PROFILES.reduce((sum, p) => sum + (m.novos[p.id] ?? 0), 0)))
  const envios = data.avisos.envios

  return (
    <div className="flex flex-col gap-5 px-5.5 pt-7 pb-8">
      <div>
        <h2 className="text-lg">Relatórios</h2>
        <p className="text-xs text-ink/60">
          Só contagens, sem nomes. Grupos com menos de {data.recorteMinimo} pessoas aparecem como “&lt;{data.recorteMinimo}” para ninguém
          ser identificado. Período: últimos 12 meses.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Participantes ativos" value={totalActive.toLocaleString('pt-BR')} />
        {PROFILES.map((p) => (
          <Stat key={p.id} label={p.label} value={count(active[p.id])} />
        ))}
      </div>

      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold">Novos cadastros por mês</h3>
        <p className="mb-4 text-[11px] text-ink/60">Inativações (contas encerradas ou convidados que passaram do prazo) na última linha.</p>
        <div className="flex h-40 items-end gap-2">
          {data.meses.map((m) => {
            const total = PROFILES.reduce((sum, p) => sum + (m.novos[p.id] ?? 0), 0)
            return (
              <div key={m.mes} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(m.mes)}: ${total} novos`}>
                <span className="text-[10px] text-ink/70">{total || ''}</span>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(total / peak) * 100}%` }}>
                  {PROFILES.map((p) => (
                    <div key={p.id} className={p.color} style={{ flexGrow: m.novos[p.id] ?? 0 }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex gap-2">
          {data.meses.map((m) => (
            <div key={m.mes} className="flex-1 text-center text-[10px] text-ink/60">
              <p>{monthLabel(m.mes)}</p>
              <p className="text-danger">{m.inativacoes ? `−${m.inativacoes}` : ''}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-[11px]">
          {PROFILES.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <span className={`inline-block size-2.5 rounded-sm ${p.color}`} />
              {p.label}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Participantes ativos por estado</h3>
          {data.participantes.porUf.length === 0 ? (
            <p className="text-xs text-ink/60">Nenhum participante com estado informado.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink/60">
                  <th className="py-1 font-medium">UF</th>
                  {PROFILES.map((p) => (
                    <th key={p.id} className="py-1 text-right font-medium">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.participantes.porUf.map((row) => (
                  <tr key={row.uf} className="border-t border-ink/10">
                    <td className="py-1.5 font-medium">{row.uf}</td>
                    {PROFILES.map((p) => (
                      <td key={p.id} className="py-1.5 text-right">
                        {count(row[p.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Avisos</h3>
            <p className="text-xs">{data.avisos.publicados} avisos publicados no período.</p>
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="text-left text-ink/60">
                  <th className="py-1 font-medium">Canal</th>
                  <th className="py-1 text-right font-medium">Enviados</th>
                  <th className="py-1 text-right font-medium">Com falha</th>
                  <th className="py-1 text-right font-medium">Sem aparelho ou e-mail</th>
                </tr>
              </thead>
              <tbody>
                {(['push', 'email'] as const).map((channel) => (
                  <tr key={channel} className="border-t border-ink/10">
                    <td className="py-1.5 font-medium">{channel === 'push' ? 'Celular' : 'E-mail'}</td>
                    <td className="py-1.5 text-right">{envios[channel].enviado}</td>
                    <td className="py-1.5 text-right">{envios[channel].falhou}</td>
                    <td className="py-1.5 text-right">{envios[channel].ignorado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Conteúdos publicados por categoria</h3>
            <ul className="flex flex-col gap-1.5 text-xs">
              {Object.entries(data.conteudos)
                .sort((a, b) => b[1] - a[1])
                .map(([category, total]) => (
                  <li key={category} className="flex justify-between border-t border-ink/10 pt-1.5">
                    <span>{category}</span>
                    <b>{total}</b>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink/60">{data.participantes.inativos} contas de participantes inativas no total.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
