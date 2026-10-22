import { ChevronDown, Eye, EyeOff, Lock, X, type LucideIcon } from 'lucide-react'
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'danger' | 'danger-outline' | 'ghost-danger'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  outline: 'border border-primary text-primary hover:bg-primary/5',
  danger: 'bg-danger text-white hover:bg-danger/90',
  'danger-outline': 'border border-danger text-danger hover:bg-danger/5',
  'ghost-danger': 'text-danger hover:bg-danger/5',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 min-w-31 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

const fieldBase =
  'w-full rounded-lg bg-field px-3 text-sm text-ink placeholder:text-ink/70 shadow-[0_2px_3px_rgba(0,0,0,0.25)] outline-none focus:ring-2 focus:ring-primary/40'

export function TextInput({
  icon: Icon,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/70" />}
      <input className={`${fieldBase} h-9 ${Icon ? 'pl-9' : ''} ${className}`} {...props} />
    </div>
  )
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/70" />
      <input type={visible ? 'text' : 'password'} className={`${fieldBase} h-9 pr-10 pl-9`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-ink/70"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

const outlinedBase =
  'h-8 w-full rounded-md border border-ink/40 bg-white px-2 text-xs text-ink outline-none focus:border-primary disabled:bg-white disabled:text-ink'

export function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  )
}

export const OutlinedInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={outlinedBase} {...props} />
)

export function OutlinedSelect({ options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <div className="relative">
      <select className={`${outlinedBase} appearance-none pr-8`} {...props}>
        <option value="">....</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2" />
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full max-w-106 rounded-2xl bg-white px-18 py-14 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} title="Fechar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ShieldIcon({ symbol, className = 'text-danger' }: { symbol: '!' | '?'; className?: string }) {
  return (
    <svg viewBox="0 0 48 60" className={`mx-auto mb-4 h-16 w-13 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M24 2 4 10v18c0 14 9 25 20 30 11-5 20-16 20-30V10L24 2Z" />
      {symbol === '!' ? (
        <path d="M24 18v14M24 38v.5" strokeLinecap="round" />
      ) : (
        <path d="M19 22a5 5 0 1 1 7 4.6c-1.3.6-2 1.6-2 3V32M24 38v.5" strokeLinecap="round" />
      )}
    </svg>
  )
}

export function ConfirmPasswordModal({
  title,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string
  confirmLabel: string
  onClose: () => void
  onConfirm: (senha: string) => Promise<void>
}) {
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm(senha)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <ShieldIcon symbol="!" />
        <p className="mb-4 text-sm">
          Somente administradores podem executar essa função. Por favor, digite sua senha para confirmar essa ação:
        </p>
        <PasswordInput placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <div className="mt-6 flex justify-between gap-4">
          <Button variant="ghost-danger" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit" disabled={!senha || busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white ${className}`}>{children}</section>
}
