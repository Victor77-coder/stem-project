import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

export function useSort<T>(rows: T[], initial: keyof T) {
  type K = keyof T
  const [key, setKey] = useState<K>(initial)
  const [asc, setAsc] = useState(true)
  const sorted = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]), 'pt-BR') * (asc ? 1 : -1))
  const toggle = (k: K) => {
    if (k === key) setAsc((v) => !v)
    else {
      setKey(k)
      setAsc(true)
    }
  }
  return { sorted, toggle }
}

export function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-2 pr-6 font-semibold">
      {label}
      <ChevronsUpDown className="size-4" />
    </button>
  )
}

export const headClass = 'grid h-14 items-center bg-ink px-6 text-sm text-white'
export const rowClass = 'grid min-h-11 items-center border-b border-ink/15 text-[11px]'

export function EmptyRow({ text }: { text: string }) {
  return <p className="py-10 text-center text-xs text-ink/60">{text}</p>
}
