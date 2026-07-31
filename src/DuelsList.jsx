import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const PAGE_SIZE = 30

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

// duel_results only has a row for participants who actually submitted a
// score — a forfeit win leaves the no-show opponent with no row at all. For
// 1v1 duels, participants are always challenger + opponent regardless of
// whether both played, so merge in whichever side has no duel_results row.
// Multiplayer has no fixed second participant slot, so duel_results is the
// full participant list there.
function participantsFor(duel) {
  const played = [...duel.duel_results].sort((a, b) => b.total_score - a.total_score)
  if (duel.is_multiplayer) return played

  const playedIds = new Set(played.map((r) => r.profile_id))
  const noShows = [duel.challenger, duel.opponent]
    .filter(Boolean)
    .filter((p) => !playedIds.has(p.id))
    .map((p) => ({ profile_id: p.id, profile: p, total_score: null }))
  return [...played, ...noShows]
}

export default function DuelsList() {
  const [matchmakingFilter, setMatchmakingFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('duels')
      .select(
        `id, invite_code, matchmaking, is_multiplayer, created_at, closed_at, winner_id,
        challenger:challenger_id(id, username),
        opponent:opponent_id(id, username),
        duel_results(profile_id, total_score, profile:profile_id(id, username))`,
        { count: 'exact' },
      )
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (matchmakingFilter) {
      query = query.eq('matchmaking', matchmakingFilter === 'si')
    }
    if (modeFilter) {
      query = query.eq('is_multiplayer', modeFilter === 'multi')
    }

    const { data, error: fetchError, count } = await query
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [matchmakingFilter, modeFilter, page])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <select
          value={matchmakingFilter}
          onChange={(e) => {
            setMatchmakingFilter(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Origen: todos</option>
          <option value="si">Solo random (matchmaking)</option>
          <option value="no">Solo privados</option>
        </select>
        <select
          value={modeFilter}
          onChange={(e) => {
            setModeFilter(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Modo: todos</option>
          <option value="1v1">1v1</option>
          <option value="multi">Multijugador</option>
        </select>
        <span className="total-count">{totalCount} duelos completados</span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <table className="rows-table">
          <thead>
            <tr>
              <th>Cerrado</th>
              <th>Modo</th>
              <th>Origen</th>
              <th>Jugadores</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{formatDate(d.closed_at)}</td>
                <td>{d.is_multiplayer ? 'Multijugador' : '1v1'}</td>
                <td>
                  <span className={`badge ${d.matchmaking ? 'badge-mm' : 'badge-direct'}`}>
                    {d.matchmaking ? 'Random' : 'Privado'}
                  </span>
                </td>
                <td>
                  <ul className="results-list">
                    {participantsFor(d).map((r) => (
                      <li key={r.profile_id} className={r.profile_id === d.winner_id ? 'winner' : ''}>
                        {r.profile?.username ?? '—'}: {r.total_score === null ? 'no jugó' : r.total_score}
                        {r.profile_id === d.winner_id ? ' 🏆' : ''}
                      </li>
                    ))}
                    {d.winner_id === null && participantsFor(d).length >= 2 && (
                      <li className="tie-label">Empate</li>
                    )}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ‹ Anterior
        </button>
        <span>
          Página {page + 1} de {totalPages}
        </span>
        <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Siguiente ›
        </button>
      </div>
    </div>
  )
}
