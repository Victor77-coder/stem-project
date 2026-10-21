import { useState } from 'react'
import { Button, Field, OutlinedInput } from '../components/ui'
import { useStore } from '../data/store'

export default function Account() {
  const { currentUser, saveAccount } = useStore()
  const [nome, setNome] = useState(currentUser?.nome ?? '')
  const [email, setEmail] = useState(currentUser?.email ?? '')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (!currentUser) return null

  function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    saveAccount({ ...currentUser!, nome, email })
    setMessage({ ok: true, text: 'Dados atualizados.' })
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (senhaAtual !== currentUser!.senha) return setMessage({ ok: false, text: 'Senha atual incorreta.' })
    if (novaSenha.length < 8) return setMessage({ ok: false, text: 'A nova senha deve ter ao menos 8 caracteres.' })
    saveAccount({ ...currentUser!, senha: novaSenha })
    setSenhaAtual('')
    setNovaSenha('')
    setMessage({ ok: true, text: 'Senha alterada.' })
  }

  return (
    <div className="grid max-w-3xl gap-8 p-5.5">
      {message && (
        <p className={`rounded-lg px-3 py-2 text-xs ${message.ok ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>{message.text}</p>
      )}
      <form onSubmit={saveProfile}>
        <h2 className="mb-3 text-lg">Dados da conta</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome Completo">
            <OutlinedInput value={nome} onChange={(e) => setNome(e.target.value)} required />
          </Field>
          <Field label="Email">
            <OutlinedInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit">Salvar</Button>
        </div>
      </form>
      <form onSubmit={changePassword}>
        <h2 className="mb-3 text-lg">Alterar senha</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Senha atual">
            <OutlinedInput type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
          </Field>
          <Field label="Nova senha">
            <OutlinedInput type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit">Alterar senha</Button>
        </div>
      </form>
    </div>
  )
}
