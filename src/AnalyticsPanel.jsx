import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const ONLINE_WINDOW_MS = 2 * 60 * 1000 // matches the app's ~45s heartbeat interval, with room for a couple missed beats
const TOP_PAGES_DAYS = 7
const TOP_PAGES_LIMIT = 20

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function countRows(table, filters) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  for (const [column, op, value] of filters) query = query[op](column, value)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export default function AnalyticsPanel() {
  const [stats, setStats] = useState(null)
  const [topPages, setTopPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const todayIso = startOfTodayIso()
      const onlineSinceIso = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
      const sinceTopPagesIso = new Date(Date.now() - TOP_PAGES_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const [online, sessionsToday, sessionsTotal, pageviewsToday, pageviewsTotal, topPagesResult] =
        await Promise.all([
          countRows('analytics_sessions', [['last_seen_at', 'gt', onlineSinceIso]]),
          countRows('analytics_sessions', [['last_seen_at', 'gte', todayIso]]),
          countRows('analytics_sessions', []),
          countRows('analytics_pageviews', [['created_at', 'gte', todayIso]]),
          countRows('analytics_pageviews', []),
          supabase.rpc('top_pageviews', { since: sinceTopPagesIso, result_limit: TOP_PAGES_LIMIT }),
        ])

      if (topPagesResult.error) throw topPagesResult.error

      setStats({ online, sessionsToday, sessionsTotal, pageviewsToday, pageviewsTotal })
      setTopPages(topPagesResult.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">Últimos {TOP_PAGES_DAYS} días para el detalle de páginas</span>
        <button type="button" className="add-toggle-btn" onClick={load} disabled={loading}>
          {loading ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {stats && (
        <div className="stat-tile-grid">
          <div className="stat-tile">
            <span className="stat-tile-value">{stats.online}</span>
            <span className="stat-tile-label">Online ahora</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{stats.sessionsToday}</span>
            <span className="stat-tile-label">Usuarios únicos hoy</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{stats.sessionsTotal}</span>
            <span className="stat-tile-label">Usuarios únicos (total)</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{stats.pageviewsToday}</span>
            <span className="stat-tile-label">Páginas vistas hoy</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{stats.pageviewsTotal}</span>
            <span className="stat-tile-label">Páginas vistas (total)</span>
          </div>
        </div>
      )}

      {loading && !stats ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <table className="rows-table">
          <thead>
            <tr>
              <th>Página</th>
              <th>Vistas ({TOP_PAGES_DAYS}d)</th>
            </tr>
          </thead>
          <tbody>
            {topPages.map((p) => (
              <tr key={p.path}>
                <td>{p.path}</td>
                <td>{p.views}</td>
              </tr>
            ))}
            {topPages.length === 0 && (
              <tr>
                <td colSpan={2} className="no-image">
                  Sin datos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
