import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Moon,
  Search,
  Settings,
  UserRound,
  Users,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/usuarios', label: 'Usuários', icon: Users },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/conteudo', label: 'Conteúdo', icon: FileText },
  { to: '/cadastros', label: 'Cadastros', icon: ClipboardList },
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/suporte', label: 'Logs e Suporte', icon: LifeBuoy },
]

const PAGES: { prefix: string; title: string; search?: string }[] = [
  { prefix: '/dashboard', title: 'Dashboard', search: 'Pesquisar' },
  { prefix: '/usuarios', title: 'Gerenciador de usuários', search: 'Pesquisar usuário' },
  { prefix: '/conteudo', title: 'Gerenciador de Conteúdo', search: 'Pesquisar conteúdo' },
  { prefix: '/configuracoes', title: 'Minha Conta' },
  { prefix: '/relatorios', title: 'Relatórios' },
  { prefix: '/cadastros', title: 'Cadastros' },
  { prefix: '/notificacoes', title: 'Notificações' },
  { prefix: '/suporte', title: 'Logs e Suporte' },
]

function Sidebar() {
  const { logout } = useStore()
  const navigate = useNavigate()
  return (
    <aside className="sticky top-0 flex h-screen w-36 shrink-0 flex-col bg-white">
      <div className="flex flex-col items-center gap-6 border-b border-ink/10 pt-7 pb-9">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#d9d9d9] text-[10px]">LOGO</div>
        <span className="text-xs">Gerenciador WEB</span>
      </div>
      <nav className="mt-12 flex flex-col gap-2 pl-3.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex h-6 items-center gap-2 rounded-l-full pl-3 text-xs transition ${
                isActive ? 'bg-primary text-white' : 'hover:bg-primary/10'
              }`
            }
          >
            <Icon className="size-4" strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          void logout()
          navigate('/login')
        }}
        className="mt-auto mb-16 flex items-center justify-center gap-2 text-xs text-danger"
      >
        <LogOut className="size-4 text-ink" strokeWidth={1.5} />
        Sair
      </button>
    </aside>
  )
}

function Header() {
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const page = PAGES.find((p) => pathname.startsWith(p.prefix))

  return (
    <header className="rounded-b-2xl bg-white px-5.5">
      <div className="flex h-14 items-center justify-between border-b border-ink/10">
        <span className="text-sm">STEM Project</span>
        <div className="flex gap-3">
          <Link to="/configuracoes" title="Minha conta">
            <UserRound className="size-4" strokeWidth={1.5} />
          </Link>
          <button type="button" title="Tema escuro (em breve)" disabled className="cursor-not-allowed">
            <Moon className="size-4" strokeWidth={1.5} />
          </button>
          <Link to="/notificacoes" title="Notificações">
            <Bell className="size-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">{page?.title}</h1>
          <p className="max-w-52 text-[10px] leading-snug">Painel administrativo do STEM Project.</p>
        </div>
        {page?.search && (
          <div className="relative w-full max-w-98">
            <input
              value={params.get('q') ?? ''}
              onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
              placeholder={page.search}
              className="h-8 w-full rounded-lg border border-ink/15 px-2 pr-8 text-xs outline-none placeholder:text-ink/60 focus:border-primary"
            />
            <Search className="absolute top-1/2 right-2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </header>
  )
}

const YEAR = new Date().getFullYear()

export function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`flex items-center justify-center gap-3 rounded-t-2xl py-4 text-[10px] ${className}`}>
      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[7px] font-bold text-primary">
        STEM
      </span>
      © {YEAR} STEM Project — CélulAI. Todos os direitos reservados.
    </footer>
  )
}

export function AppLayout() {
  const { currentUser, ready } = useStore()
  if (!ready) return null
  if (!currentUser) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col px-6">
        <Header />
        <main className="mt-6 flex flex-1 flex-col rounded-t-2xl bg-white">
          <div className="flex-1">
            <Outlet />
          </div>
          <Footer className="mx-5.5 bg-surface" />
        </main>
      </div>
    </div>
  )
}
