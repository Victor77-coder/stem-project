import { UserRound } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, ConfirmPasswordModal, Field, OutlinedInput, OutlinedSelect } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Account } from '../../data/types'
import { formatDate, today } from '../../lib/format'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

const newAccount = (): Account => ({
  id: String(Date.now()).slice(-12).padStart(12, '0'),
  nome: '',
  email: '',
  senha: 'mudar123',
  status: 'ativo',
  nivel: 'User',
  documento1: '',
  documento2: '',
  genero: '',
  tipoConta: '',
  cep: '',
  logradouro: '',
  numero: '',
  pais: 'Brasil',
  estado: '',
  cidade: '',
  bairro: '',
  complemento: '',
  referencia: '',
  criadoEm: today(),
  ultimoLogin: '',
})

type Dialog = 'block' | 'delete' | null

export default function UserProfile() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { accounts, saveAccount, checkPassword } = useStore()
  const isNew = id === 'novo'
  const original = isNew ? newAccount() : accounts.find((a) => a.id === id)

  const [form, setForm] = useState<Account | undefined>(original)
  const [editing, setEditing] = useState(isNew || params.has('editar'))
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState('')

  if (!original || !form || original.status === 'cancelado') return <Navigate to="/usuarios" replace />

  const set = <K extends keyof Account>(key: K, value: Account[K]) => setForm({ ...form, [key]: value })
  const bind = (key: keyof Account) => ({
    value: form[key] as string,
    disabled: !editing,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value as never),
  })

  async function lookupCep(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) return
      setForm((f) => f && { ...f, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, estado: data.uf })
    } catch {
      setNotice('Não foi possível consultar o CEP. Preencha o endereço manualmente.')
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    saveAccount(form)
    if (isNew) navigate(`/usuarios/${form.id}`, { replace: true })
    setEditing(false)
    setNotice('Alterações salvas.')
  }

  const cities = form.cidade ? [form.cidade] : []
  const bairros = form.bairro ? [form.bairro] : []

  return (
    <form onSubmit={save} className="p-5.5">
      {!isNew && (
        <div className="flex flex-wrap items-center gap-6 rounded-xl bg-ink px-5 py-5 text-white">
          {form.avatar ? (
            <img src={form.avatar} alt="" className="size-18 rounded-full object-cover" />
          ) : (
            <span className="flex size-18 items-center justify-center rounded-full bg-white/10">
              <UserRound className="size-8" />
            </span>
          )}
          <div className="min-w-48 flex-1">
            <p className="text-lg font-semibold">{form.nome}</p>
            <p className="text-[10px]">ID: {form.id}</p>
            <p className="mt-3 text-sm font-semibold">
              Status{' '}
              <span className={`font-normal capitalize ${form.status === 'ativo' ? 'text-green-500' : 'text-danger'}`}>
                {form.status}
              </span>
            </p>
          </div>
          <div className="flex-1 text-sm leading-relaxed">
            <p>
              <b>Role:</b> {form.nivel === 'Admin' ? 'Administrador' : 'Usuário'}
            </p>
            <p>
              <b>Data de criação da conta:</b> {formatDate(form.criadoEm)}
            </p>
            <p>
              <b>Último login:</b> {formatDate(form.ultimoLogin)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-5.5 w-20 rounded-full bg-white text-xs font-semibold text-ink"
            >
              Editar
            </button>
            {form.status === 'bloqueado' ? (
              <button
                type="button"
                onClick={() => {
                  saveAccount({ ...form, status: 'ativo' })
                  setForm({ ...form, status: 'ativo' })
                }}
                className="h-5.5 w-20 rounded-full bg-green-600 text-xs font-semibold"
              >
                Desbloquear
              </button>
            ) : (
              <button type="button" onClick={() => setDialog('block')} className="h-5.5 w-20 rounded-full bg-[#e84a4a] text-xs font-semibold">
                Bloquear
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotice(`Link de redefinição de senha enviado para ${form.email}.`)}
              className="h-5.5 rounded-full border border-white px-3 text-xs font-semibold"
            >
              Resetar Senha
            </button>
          </div>
        </div>
      )}

      {notice && <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</p>}

      <h3 className="mt-6 mb-2 text-lg">{isNew ? 'Cadastrar usuário' : 'Informações de perfil'}</h3>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Nome Completo" className="col-span-2">
          <OutlinedInput {...bind('nome')} required />
        </Field>
        <Field label="Email" className="col-span-2">
          <OutlinedInput type="email" {...bind('email')} required />
        </Field>
        <Field label="CPF/CRM/CNPJ">
          <OutlinedInput {...bind('documento1')} placeholder="........" />
        </Field>
        <Field label="CPF/CRM/CNPJ">
          <OutlinedInput {...bind('documento2')} placeholder="........" />
        </Field>
        <Field label="Gênero">
          <OutlinedSelect {...bind('genero')} options={['Feminino', 'Masculino', 'Outro', 'Prefiro não informar']} />
        </Field>
        <Field label="Tipo de conta">
          <OutlinedSelect {...bind('tipoConta')} options={['Administrador de conteúdo', 'Editor', 'Validador clínico']} />
        </Field>
        <Field label="Nível">
          <OutlinedSelect {...bind('nivel')} options={['Admin', 'User']} />
        </Field>
      </div>

      <h3 className="mt-6 mb-2 text-lg">Endereço</h3>
      <div className="grid grid-cols-[1fr_1.6fr_0.55fr] gap-3">
        <Field label="CEP">
          <OutlinedInput {...bind('cep')} placeholder="00000-000" onBlur={(e) => lookupCep(e.target.value)} />
        </Field>
        <Field label="Logradouro">
          <OutlinedInput {...bind('logradouro')} />
        </Field>
        <Field label="Número">
          <OutlinedInput {...bind('numero')} />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Field label="País">
          <OutlinedSelect {...bind('pais')} options={['Brasil']} />
        </Field>
        <Field label="Estado">
          <OutlinedSelect {...bind('estado')} options={UFS} />
        </Field>
        <Field label="Cidade">
          <OutlinedSelect {...bind('cidade')} options={cities} />
        </Field>
        <Field label="Bairro">
          <OutlinedSelect {...bind('bairro')} options={bairros} />
        </Field>
        <Field label="Complemento">
          <OutlinedInput {...bind('complemento')} />
        </Field>
        <Field label="Ponto de Referência">
          <OutlinedInput {...bind('referencia')} />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-8">
        {editing ? (
          <>
            <Button
              variant="danger-outline"
              onClick={() => {
                if (isNew) navigate('/usuarios')
                setForm(original)
                setEditing(false)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">Salvar Mudanças</Button>
          </>
        ) : (
          <Button variant="danger-outline" onClick={() => setDialog('delete')}>
            Deletar Usuário
          </Button>
        )}
      </div>

      {dialog === 'block' && (
        <ConfirmPasswordModal
          title="Bloquear usuário"
          confirmLabel="Bloquear"
          checkPassword={checkPassword}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            saveAccount({ ...form, status: 'bloqueado' })
            setForm({ ...form, status: 'bloqueado' })
            setDialog(null)
          }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmPasswordModal
          title="Deletar usuário"
          confirmLabel="Deletar"
          checkPassword={checkPassword}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            saveAccount({ ...form, status: 'cancelado' })
            navigate('/usuarios')
          }}
        />
      )}
    </form>
  )
}
