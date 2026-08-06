import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import BarChart from './BarChart'

const ONLINE_WINDOW_MS = 2 * 60 * 1000 // matches the app's ~45s heartbeat interval, with room for a couple missed beats
const TOP_PAGES_DAYS = 7
const TOP_PAGES_LIMIT = 20
const DAILY_CHART_DAYS = 30

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

// One row per referring profile — small enough to just sum client-side
// rather than adding another RPC for a single number.
async function sumReferralVisits() {
  const { data, error } = await supabase.from('referrals').select('visit_count')
  if (error) throw error
  return (data || []).reduce((sum, r) => sum + r.visit_count, 0)
}

// Rolling last-24h window (not calendar-day-aligned) labeled in the
// viewer's local hours — comparing by epoch ms sidesteps timezone string
// parsing entirely, since JS Dates are epoch-based regardless of how
// they're displayed.
function buildHourlyBuckets(rows) {
  const byHour = new Map(rows.map((r) => [new Date(r.hour_start).getTime(), Number(r.pageviews)]))
  const now = new Date()
  const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
  const buckets = []
  for (let i = 23; i >= 0; i--) {
    const bucket = new Date(currentHourStart.getTime() - i * 60 * 60 * 1000)
    buckets.push({ label: `${bucket.getHours()}h`, value: byHour.get(bucket.getTime()) ?? 0 })
  }
  return buckets
}

// UTC calendar days (matches pageviews_by_day's grouping) — a rough trend
// chart, not worth localizing per-viewer for day-boundary precision.
function buildDailyBuckets(rows) {
  const byDay = new Map(rows.map((r) => [r.day_start, Number(r.unique_sessions)]))
  const today = new Date()
  const buckets = []
  for (let i = DAILY_CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    buckets.push({ label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, value: byDay.get(key) ?? 0 })
  }
  return buckets
}

export default function AnalyticsPanel() {
  const [stats, setStats] = useState(null)
  const [topPages, setTopPages] = useState([])
  const [hourlyData, setHourlyData] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const todayIso = startOfTodayIso()
      const onlineSinceIso = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
      const sinceTopPagesIso = new Date(Date.now() - TOP_PAGES_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const sinceHourlyIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const sinceDailyIso = new Date(Date.now() - DAILY_CHART_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const [
        online,
        sessionsToday,
        sessionsTotal,
        pageviewsToday,
        pageviewsTotal,
        referralVisits,
        topPagesResult,
        hourlyResult,
        dailyResult,
      ] = await Promise.all([
        countRows('analytics_sessions', [['last_seen_at', 'gt', onlineSinceIso]]),
        countRows('analytics_sessions', [['last_seen_at', 'gte', todayIso]]),
        countRows('analytics_sessions', []),
        countRows('analytics_pageviews', [['created_at', 'gte', todayIso]]),
        countRows('analytics_pageviews', []),
        sumReferralVisits(),
        supabase.rpc('top_pageviews', { since: sinceTopPagesIso, result_limit: TOP_PAGES_LIMIT }),
        supabase.rpc('pageviews_by_hour', { since: sinceHourlyIso }),
        supabase.rpc('pageviews_by_day', { since: sinceDailyIso }),
      ])

      if (topPagesResult.error) throw topPagesResult.error
      if (hourlyResult.error) throw hourlyResult.error
      if (dailyResult.error) throw dailyResult.error

      setStats({ online, sessionsToday, sessionsTotal, pageviewsToday, pageviewsTotal, referralVisits })
      setTopPages(topPagesResult.data || [])
      setHourlyData(buildHourlyBuckets(hourlyResult.data || []))
      setDailyData(buildDailyBuckets(dailyResult.data || []))
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
          <div className="stat-tile">
            <span className="stat-tile-value">{stats.referralVisits}</span>
            <span className="stat-tile-label">Visitas referidas</span>
          </div>
        </div>
      )}

      {!loading && hourlyData.length > 0 && (
        <BarChart data={hourlyData} title="Páginas vistas por hora (últimas 24h)" />
      )}

      {!loading && dailyData.length > 0 && (
        <BarChart data={dailyData} title={`Usuarios únicos por día (últimos ${DAILY_CHART_DAYS} días)`} />
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
