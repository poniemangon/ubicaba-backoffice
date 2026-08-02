import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const PAGE_SIZE = 30

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function UsersList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('profiles')
      .select('id, username, avatar_url, elo, ranked_games_played, created_at', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (search.trim()) {
      const term = search.trim().replace(/[%_]/g, '')
      query = query.ilike('username', `%${term}%`)
    }

    const { data, error: fetchError, count } = await query
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [search, page])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

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
              <th>Registrado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id}>
                <td>{page * PAGE_SIZE + i + 1}</td>
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
    </div>
  )
}
