import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

// Group duels are always multiplayer (no fixed challenger/opponent slots),
// so duel_results is already the full participant list — just sort it.
function participantsFor(duel) {
  return [...duel.duel_results].sort((a, b) => b.total_score - a.total_score)
}

export default function GroupDetailModal({ group, onClose }) {
  const [members, setMembers] = useState([])
  const [duels, setDuels] = useState([])
  const [dailyWinCounts, setDailyWinCounts] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('user_groups').select('profile:user_id(id, username, avatar_url)').eq('group_id', group.id),
      supabase
        .from('duels')
        .select('id, created_at, closed_at, winner_id, duel_results(profile_id, total_score, profile:profile_id(id, username))')
        .eq('group_duel', group.id)
        .order('created_at', { ascending: false }),
      supabase.from('daily_group_wins').select('profile_id').eq('group_id', group.id),
    ])
      .then(([membersRes, duelsRes, winsRes]) => {
        if (membersRes.error) throw membersRes.error
        if (duelsRes.error) throw duelsRes.error
        if (winsRes.error) throw winsRes.error
        setMembers((membersRes.data || []).map((r) => r.profile).filter(Boolean))
        setDuels(duelsRes.data || [])
        const counts = new Map()
        for (const row of winsRes.data || []) counts.set(row.profile_id, (counts.get(row.profile_id) || 0) + 1)
        setDailyWinCounts(counts)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [group.id])

  const duelWins = new Map()
  for (const d of duels) {
    if (d.closed_at && d.winner_id) duelWins.set(d.winner_id, (duelWins.get(d.winner_id) || 0) + 1)
  }
  const ranking = members
    .map((m) => ({ ...m, wins: duelWins.get(m.id) || 0, dailyWins: dailyWinCounts.get(m.id) || 0 }))
    .sort((a, b) => b.wins - a.wins)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="edit-modal group-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <span>{group.name}</span>
          <button type="button" className="calendar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}

        {loading ? (
          <p className="loading-text">Cargando...</p>
        ) : (
          <>
            <h3 className="modal-section-title">Ranking ({members.length} miembros)</h3>
            <table className="rows-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Usuario</th>
                  <th>Duelos ganados</th>
                  <th>Daily wins (grupo)</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td>{m.username}</td>
                    <td>{m.wins}</td>
                    <td>{m.dailyWins}</td>
                  </tr>
                ))}
                {ranking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="no-image">
                      Sin miembros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h3 className="modal-section-title">Duelos ({duels.length})</h3>
            <table className="rows-table">
              <thead>
                <tr>
                  <th>Creado</th>
                  <th>Estado</th>
                  <th>Jugadores</th>
                </tr>
              </thead>
              <tbody>
                {duels.map((d) => (
                  <tr key={d.id}>
                    <td>{formatDate(d.created_at)}</td>
                    <td>{d.closed_at ? 'Cerrado' : 'Activo'}</td>
                    <td>
                      <ul className="results-list">
                        {participantsFor(d).map((r) => (
                          <li key={r.profile_id} className={r.profile_id === d.winner_id ? 'winner' : ''}>
                            {r.profile?.username ?? '—'}: {r.total_score}
                            {r.profile_id === d.winner_id ? ' 🏆' : ''}
                          </li>
                        ))}
                        {d.closed_at && d.winner_id === null && d.duel_results.length >= 2 && (
                          <li className="tie-label">Empate</li>
                        )}
                        {d.duel_results.length === 0 && <li>Sin resultados</li>}
                      </ul>
                    </td>
                  </tr>
                ))}
                {duels.length === 0 && (
                  <tr>
                    <td colSpan={3} className="no-image">
                      Sin duelos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
