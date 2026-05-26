import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Domains from './pages/Domains'
import Routing from './pages/Routing'
import Migration from './pages/Migration'
import Settings from './pages/Settings'
import GatherForm from './pages/GatherForm'
import api from './lib/api'
import { isLoggedIn } from './lib/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)

  useEffect(() => {
    api.get('/auth/setup-status').then(({ data }) => {
      setSetupRequired(data.setupRequired)
    })
  }, [])

  if (setupRequired === null) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={setupRequired ? <Setup onComplete={() => setSetupRequired(false)} /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={!isLoggedIn() ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/" element={setupRequired ? <Navigate to="/setup" replace /> : <RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><Users /></RequireAuth>} />
        <Route path="/domains" element={<RequireAuth><Domains /></RequireAuth>} />
        <Route path="/routing" element={<RequireAuth><Routing /></RequireAuth>} />
        <Route path="/migration" element={<RequireAuth><Migration /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/gather/:token" element={<GatherForm />} />
        <Route path="*" element={<Navigate to={setupRequired ? '/setup' : isLoggedIn() ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
