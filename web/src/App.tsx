import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import { StoreProvider } from './data/store'
import Account from './pages/Account'
import ContentForm from './pages/content/ContentForm'
import ContentList from './pages/content/ContentList'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import UserProfile from './pages/users/UserProfile'
import UsersList from './pages/users/UsersList'

const ComingSoon = () => <p className="p-10 text-center text-sm text-ink/60">Módulo em construção.</p>

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/usuarios" element={<UsersList />} />
            <Route path="/usuarios/:id" element={<UserProfile />} />
            <Route path="/conteudo" element={<ContentList />} />
            <Route path="/conteudo/novo" element={<ContentForm />} />
            <Route path="/conteudo/:id/editar" element={<ContentForm />} />
            <Route path="/configuracoes" element={<Account />} />
            {['/relatorios', '/cadastros', '/notificacoes', '/suporte'].map((p) => (
              <Route key={p} path={p} element={<ComingSoon />} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
