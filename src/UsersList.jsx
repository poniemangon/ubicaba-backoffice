import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import UserBadgesModal from './UserBadgesModal'

const PAGE_SIZE = 30

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function UsersList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('created_at') // 'created_at' | 'referrals'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // id -> signup rank (1 = first user ever registered), independent of the
  // displayed sort order/search/pagination below. Fetched once — just two
  // columns for every profile, cheap at this app's scale.
  const [signupRank, setSignupRank] = useState(new Map())
  // user_id -> visit_count, one row per referring profile — same
  // fetch-once-independent-of-pagination approach as signupRank above.
  const [referralCounts, setReferralCounts] = useState(new Map())
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, created_at')
      .order('created_at', { ascending: true })
      .then(({ data, error: rankError }) => {
        if (rankError) {
          console.error(rankError)
          return
        }
        setSignupRank(new Map(data.map((u, i) => [u.id, i + 1])))
      })

    supabase
      .from('referrals')
      .select('user_id, visit_count')
      .then(({ data, error: referralsError }) => {
        if (referralsError) {
          console.error(referralsError)
          return
        }
        setReferralCounts(new Map(data.map((r) => [r.user_id, r.visit_count])))
      })
  }, [])

  // Referral count isn't a column on profiles (it lives in the separate
  // referrals table, already fully loaded above), so sorting by it can't be
  // pushed down as a plain .order() on this query — fetch every matching
  // profile (same unpaginated-fetch precedent as signupRank/referralCounts
  // above) and sort + paginate client-side for both sort keys, so the two
  // stay consistent with each other.
  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('profiles').select('id, username, avatar_url, elo, ranked_games_played, created_at')

    if (search.trim()) {
      const term = search.trim().replace(/[%_]/g, '')
      query = query.ilike('username', `%${term}%`)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setAllRows(data)
    }
    setLoading(false)
  }, [search])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const sorted = [...allRows].sort((a, b) => {
    const va = sortBy === 'referrals' ? referralCounts.get(a.id) ?? 0 : new Date(a.created_at).getTime()
    const vb = sortBy === 'referrals' ? referralCounts.get(b.id) ?? 0 : new Date(b.created_at).getTime()
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sortArrow = (column) => (sortBy === column ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <input
          type="text"
          placeholder="Buscar usuario..."
          onChange={(e) => {
            const value = e.target.value
            setSearch(value)
            setPage(0)
          }}
        />
        <span className="total-count">{totalCount} usuarios</span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <table className="rows-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Usuario</th>
              <th>Ranking</th>
              <th>Partidas rankeadas</th>
              <th className="rows-table-sortable" onClick={() => toggleSort('referrals')}>
                Referidos{sortArrow('referrals')}
              </th>
              <th className="rows-table-sortable" onClick={() => toggleSort('created_at')}>
                Registrado{sortArrow('created_at')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="rows-table-row-clickable" onClick={() => setSelectedUser(u)}>
                <td>{signupRank.get(u.id) ?? '—'}</td>
                <td>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="thumb" />
                  ) : (
                    <span className="no-image">🙂</span>
                  )}
                </td>
                <td>{u.username}</td>
                <td>{u.ranked_games_played > 0 ? u.elo : 'Sin ranking'}</td>
                <td>{u.ranked_games_played}</td>
                <td>{referralCounts.get(u.id) ?? 0}</td>
                <td>{formatDate(u.created_at)}</td>
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

      {selectedUser && <UserBadgesModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  )
}
