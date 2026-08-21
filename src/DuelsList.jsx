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
  const [userSearch, setUserSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revertingId, setRevertingId] = useState(null)
  const [botIds, setBotIds] = useState(null)

  // Fetched once — bots don't come and go often (0066/0072). Used to
  // exclude bot-vs-bot simulated duels from the list/count entirely: real
  // activity only, including a real player's ghost-mode duel against a bot.
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id')
      .eq('is_bot', true)
      .then(({ data, error: botError }) => {
        if (botError) {
          console.error(botError)
          setBotIds([])
          return
        }
        setBotIds((data || []).map((b) => b.id))
      })
  }, [])

  // Undoes just this one match's rating swing — subtracts (new_elo -
  // previous_elo) from whatever the player's elo is *now*, rather than
  // resetting straight to previous_elo, so any legitimate matches played
  // since aren't wiped out too. elo_reverted flips true so the button
  // disappears afterward and this can't be applied twice.
  const handleRevertElo = async (result) => {
    if (!window.confirm(`¿Devolver el ELO de ${result.profile?.username ?? 'este jugador'} por este duelo?`)) return
    setRevertingId(result.id)
    try {
      const delta = result.new_elo - result.previous_elo
      const revertedElo = Math.max(0, (result.profile?.elo ?? 0) - delta)
      const { error: profileError } = await supabase.from('profiles').update({ elo: revertedElo }).eq('id', result.profile_id)
      if (profileError) throw profileError
      const { error: resultError } = await supabase.from('duel_results').update({ elo_reverted: true }).eq('id', result.id)
      if (resultError) throw resultError
      setRows((prev) =>
        prev.map((d) => ({
          ...d,
          duel_results: d.duel_results.map((r) =>
            r.id === result.id ? { ...r, elo_reverted: true, profile: { ...r.profile, elo: revertedElo } } : r,
          ),
        })),
      )
    } catch (e) {
      alert(e.message)
    } finally {
      setRevertingId(null)
    }
  }

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)

    // A participant can be a duel's challenger/opponent (always, even a
    // no-show) or only show up via duel_results (multiplayer has no fixed
    // challenger/opponent slots) — so a username filter has to resolve to
    // profile ids first, then match against all three, not just one column.
    let userFilter = null
    if (userSearch.trim()) {
      const term = userSearch.trim().replace(/[%_]/g, '')
      const { data: matches, error: userError } = await supabase.from('profiles').select('id').ilike('username', `%${term}%`)
      if (userError) {
        setError(userError.message)
        setLoading(false)
        return
      }
      const ids = (matches || []).map((p) => p.id)
      if (ids.length === 0) {
        setRows([])
        setTotalCount(0)
        setLoading(false)
        return
      }
      const { data: resultRows, error: resultError } = await supabase
        .from('duel_results')
        .select('duel_id')
        .in('profile_id', ids)
      if (resultError) {
        setError(resultError.message)
        setLoading(false)
        return
      }
      const duelIds = [...new Set((resultRows || []).map((r) => r.duel_id))]
      const orParts = [`challenger_id.in.(${ids.join(',')})`, `opponent_id.in.(${ids.join(',')})`]
      if (duelIds.length > 0) orParts.push(`id.in.(${duelIds.join(',')})`)
      userFilter = orParts.join(',')
    }

    let query = supabase
      .from('duels')
      .select(
        `id, invite_code, matchmaking, is_multiplayer, created_at, closed_at, winner_id,
        challenger:challenger_id(id, username),
        opponent:opponent_id(id, username),
        duel_results(id, profile_id, total_score, previous_elo, new_elo, elo_reverted, profile:profile_id(id, username, elo)),
        group:group_duel(id, name)`,
        { count: 'exact' },
      )
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (matchmakingFilter) {
      query = query.eq('matchmaking', matchmakingFilter === 'si')
    }
    // Group duels are also is_multiplayer=true under the hood (see App.jsx's
    // handleStartGroupDuel), so "Multijugador" needs to explicitly exclude
    // them to mean "sala abierta libre" — otherwise it'd silently include
    // every group duel too.
    if (modeFilter === '1v1') {
      query = query.eq('is_multiplayer', false)
    } else if (modeFilter === 'multi') {
      query = query.eq('is_multiplayer', true).is('group_duel', null)
    } else if (modeFilter === 'group') {
      query = query.not('group_duel', 'is', null)
    }
    if (userFilter) {
      query = query.or(userFilter)
    }
    // Bot-vs-bot simulated duels (0072) shouldn't count as real duel
    // activity — exclude rows where BOTH sides are bots. Keeping "at least
    // one side isn't a bot" (De Morgan's) also correctly keeps multiplayer
    // rows, where opponent_id is always null but challenger_id isn't a bot.
    if (botIds && botIds.length > 0) {
      const idList = botIds.join(',')
      query = query.or(`challenger_id.not.in.(${idList}),opponent_id.not.in.(${idList})`)
    }

    const { data, error: fetchError, count } = await query
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [matchmakingFilter, modeFilter, userSearch, page, botIds])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <input
          type="text"
          placeholder="Filtrar por usuario..."
          value={userSearch}
          onChange={(e) => {
            setUserSearch(e.target.value)
            setPage(0)
          }}
        />
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
          <option value="group">De grupo</option>
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
                <td>
                  {d.group ? (
                    <span className="badge badge-group">De grupo</span>
                  ) : d.is_multiplayer ? (
                    'Multijugador'
                  ) : (
                    '1v1'
                  )}
                </td>
                <td>
                  {d.group ? (
                    <span className="badge badge-group">{d.group.name}</span>
                  ) : (
                    <span className={`badge ${d.matchmaking ? 'badge-mm' : 'badge-direct'}`}>
                      {d.matchmaking ? 'Random' : 'Privado'}
                    </span>
                  )}
                </td>
                <td>
                  <ul className="results-list">
                    {participantsFor(d).map((r) => (
                      <li key={r.profile_id} className={r.profile_id === d.winner_id ? 'winner' : ''}>
                        {r.profile?.username ?? '—'}: {r.total_score === null ? 'no jugó' : r.total_score}
                        {r.profile_id === d.winner_id ? ' 🏆' : ''}
                        {r.previous_elo != null && r.new_elo != null && (
                          <span className="elo-change"> ({r.previous_elo} → {r.new_elo})</span>
                        )}
                        {r.previous_elo != null && r.new_elo != null && !r.elo_reverted && (
                          <button
                            type="button"
                            className="edit-btn elo-revert-btn"
                            disabled={revertingId === r.id}
                            onClick={() => handleRevertElo(r)}
                          >
                            {revertingId === r.id ? 'Devolviendo...' : 'Devolver ELO'}
                          </button>
                        )}
                        {r.elo_reverted && <span className="elo-reverted-label">ELO devuelto ✓</span>}
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
