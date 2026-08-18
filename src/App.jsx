import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import IntersectionsList from './IntersectionsList'
import DuelsList from './DuelsList'
import UsersList from './UsersList'
import DailyMapsPanel from './DailyMapsPanel'
import GroupsList from './GroupsList'
import CommentsList from './CommentsList'
import DailyPopupsPanel from './DailyPopupsPanel'
import LogrosPanel from './LogrosPanel'
import FilesPanel from './FilesPanel'
import AnalyticsPanel from './AnalyticsPanel'
import SettingsPanel from './SettingsPanel'
import './App.css'

const TABS = [
  { id: 'esquinas', label: 'Esquinas' },
  { id: 'duelos', label: 'Duelos' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'mapas', label: 'Mapas del día' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'comentarios', label: 'Comentarios' },
  { id: 'popups', label: 'Popup diario' },
  { id: 'logros', label: 'Logros' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'analiticas', label: 'Analíticas' },
  { id: 'config', label: 'Config' },
]

function App() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [tab, setTab] = useState('esquinas')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const selectTab = (t) => {
    setTab(t)
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div className="loading-screen">Cargando...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>UbiCABA Admin</h1>
        <div className="app-header-actions">
          <button
            type="button"
            className="burger-btn"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <button type="button" className="logout-btn" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <nav className={`tab-bar${mobileMenuOpen ? ' tab-bar-open' : ''}`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab-btn active' : 'tab-btn'}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'esquinas' && <IntersectionsList />}
      {tab === 'duelos' && <DuelsList />}
      {tab === 'usuarios' && <UsersList />}
      {tab === 'mapas' && <DailyMapsPanel />}
      {tab === 'grupos' && <GroupsList />}
      {tab === 'comentarios' && <CommentsList />}
      {tab === 'popups' && <DailyPopupsPanel />}
      {tab === 'logros' && <LogrosPanel />}
      {tab === 'archivos' && <FilesPanel />}
      {tab === 'analiticas' && <AnalyticsPanel />}
      {tab === 'config' && <SettingsPanel />}
    </div>
  )
}

export default App
