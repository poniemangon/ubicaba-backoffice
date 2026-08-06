import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)

function formatDailyDate(dayNumber) {
  return new Date(EPOCH_UTC + dayNumber * DAY_MS).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function DailyMapsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase.rpc('daily_map_stats')
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">{rows.length} días con partidas</span>
        <button type="button" className="add-toggle-btn" onClick={load} disabled={loading}>
          {loading ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <div className="stat-tile-grid">
          {rows.map((r) => (
            <div key={r.day_number} className="stat-tile daily-map-tile">
              <span className="daily-map-tile-date">{formatDailyDate(r.day_number)}</span>
              <span className="daily-map-tile-totals">
                <span className="stat-tile-value">{r.total}</span>
                <span className="daily-map-unique-users">{r.unique_users}</span>
              </span>
              <span className="daily-map-tile-breakdown">
                <span className="daily-map-ranked">ranked: {r.ranked}</span>
                <span className="daily-map-unranked">unranked: {r.unranked}</span>
              </span>
            </div>
          ))}
          {rows.length === 0 && <p className="loading-text">Sin datos todavía.</p>}
        </div>
      )}
    </div>
  )
}
