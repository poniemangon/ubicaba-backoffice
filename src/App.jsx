import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import IntersectionsList from './IntersectionsList'
import DuelsList from './DuelsList'
import UsersList from './UsersList'
import DailyMapsPanel from './DailyMapsPanel'
import AnalyticsPanel from './AnalyticsPanel'
import SettingsPanel from './SettingsPanel'
import './App.css'

function App() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [tab, setTab] = useState('esquinas')

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
        <button type="button" className="logout-btn" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </header>
      <nav className="tab-bar">
        <button
          type="button"
          className={tab === 'esquinas' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('esquinas')}
        >
          Esquinas
        </button>
        <button
          type="button"
          className={tab === 'duelos' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('duelos')}
        >
          Duelos
        </button>
        <button
          type="button"
          className={tab === 'usuarios' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('usuarios')}
        >
          Usuarios
        </button>
        <button
          type="button"
          className={tab === 'mapas' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('mapas')}
        >
          Mapas del día
        </button>
        <button
          type="button"
          className={tab === 'analiticas' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('analiticas')}
        >
          Analíticas
        </button>
        <button
          type="button"
          className={tab === 'config' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('config')}
        >
          Config
        </button>
      </nav>
      {tab === 'esquinas' && <IntersectionsList />}
      {tab === 'duelos' && <DuelsList />}
      {tab === 'usuarios' && <UsersList />}
      {tab === 'mapas' && <DailyMapsPanel />}
      {tab === 'analiticas' && <AnalyticsPanel />}
      {tab === 'config' && <SettingsPanel />}
    </div>
  )
}

export default App
