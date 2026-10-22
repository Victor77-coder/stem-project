import { AlertCircle, KeyRound, LockKeyhole, Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Modal, PasswordInput, ShieldIcon, TextInput } from '../components/ui'
import { useStore } from '../data/store'
import { api } from '../lib/api'

type Dialog = 'forgot' | 'request' | 'requestSent' | 'forgotSent' | null

const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v)

function EmailRequestModal({
  title,
  symbol,
  text,
  path,
  onClose,
  onSent,
}: {
  title: string
  symbol: '!' | '?'
  text: string
  path: string
  onClose: () => void
  onSent: () => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api(path, { method: 'POST', body: { email }, auth: false })
            onSent()
          } catch (err) {
            setError(err instanceof Error ? err.message : '')
          } finally {
            setBusy(false)
          }
        }}
      >
        <ShieldIcon symbol={symbol} />
        <p className="mb-4 text-sm">{text}</p>
        <TextInput icon={Mail} type="email" placeholder="Digite seu email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <div className="mt-6 flex justify-between gap-4">
          <Button variant="danger-outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isEmail(email) || busy}>
            Enviar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function SentModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <Send className="mx-auto my-4 size-16 text-primary" strokeWidth={1} />
      <p className="text-center text-sm">{text}</p>
    </Modal>
  )
}

export default function Login() {
  const { login, currentUser } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  if (currentUser) return <Navigate to="/dashboard" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await login(email, senha)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'E-mail ou senha inválidos.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden flex-[1.4] items-center justify-center bg-[#d9d9d9] md:flex">
        <div className="relative flex size-80 items-center justify-center rounded-full bg-white/50">
          <LockKeyhole className="size-32 text-[#3b82f6]" strokeWidth={1.2} />
          <KeyRound className="absolute right-6 bottom-10 size-20 -rotate-12 text-[#2563eb]" strokeWidth={1.2} />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <form onSubmit={submit} className="flex w-full max-w-60 flex-col gap-3">
          <div className="mb-2 text-center">
            <h1 className="text-xl font-semibold">Entrar</h1>
            <p className="text-[10px]">Gerenciador WEB — STEM Project</p>
          </div>
          <TextInput icon={Mail} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <PasswordInput placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          <div className="flex items-center justify-between text-[9px]">
            <button type="button" onClick={() => setDialog('forgot')} className="flex items-center gap-1 text-purple-700 hover:underline">
              <AlertCircle className="size-3" />
              Esqueci minha senha
            </button>
            <label className="flex items-center gap-1">
              <input type="checkbox" className="size-3" />
              Lembrar de mim
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="mt-3 w-full" disabled={busy}>
            Entrar
          </Button>
          <p className="mt-3 text-center text-xs">
            Não tem conta?{' '}
            <button type="button" onClick={() => setDialog('request')} className="text-primary hover:underline">
              Entre em contato com o desenvolvedor
            </button>
          </p>
        </form>
      </div>

      {dialog === 'forgot' && (
        <EmailRequestModal
          title="Esqueci a senha"
          symbol="?"
          text='Digite seu E-mail e clique em "Enviar" para receber um email para redefinir sua senha.'
          path="/staff/auth/password/forgot/"
          onClose={() => setDialog(null)}
          onSent={() => setDialog('forgotSent')}
        />
      )}
      {dialog === 'forgotSent' && (
        <SentModal
          title="Esqueci a senha"
          text="Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha."
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'request' && (
        <EmailRequestModal
          title="Criar conta"
          symbol="!"
          text="Solicitar acesso ao administrador do sistema para criar sua conta"
          path="/staff/auth/access-request/"
          onClose={() => setDialog(null)}
          onSent={() => setDialog('requestSent')}
        />
      )}
      {dialog === 'requestSent' && (
        <SentModal title="Criar conta" text="Sua solicitação foi enviada ao administrador." onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
