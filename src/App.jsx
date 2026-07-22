import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import IntersectionsList from './IntersectionsList'
import './App.css'

function App() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out

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
      <IntersectionsList />
    </div>
  )
}

export default App
