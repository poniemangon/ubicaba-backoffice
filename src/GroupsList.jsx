import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import GroupDetailModal from './GroupDetailModal'

const PAGE_SIZE = 30

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function GroupsList() {
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // group_id -> member count, fetched once independent of pagination — same
  // approach as UsersList' signupRank/referralCounts maps.
  const [memberCounts, setMemberCounts] = useState(new Map())
  const [selectedGroup, setSelectedGroup] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError, count } = await supabase
      .from('groups')
      .select('id, name, image_url, created_at, creator:created_by(username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [page])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  useEffect(() => {
    supabase
      .from('user_groups')
      .select('group_id')
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          console.error(fetchError)
          return
        }
        const counts = new Map()
        for (const row of data) counts.set(row.group_id, (counts.get(row.group_id) || 0) + 1)
        setMemberCounts(counts)
      })
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">{totalCount} grupos</span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <table className="rows-table">
          <thead>
            <tr>
              <th></th>
              <th>Nombre</th>
              <th>Creador</th>
              <th>Miembros</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="rows-table-row-clickable" onClick={() => setSelectedGroup(g)}>
                <td>
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="thumb" />
                  ) : (
                    <span className="no-image">🙂</span>
                  )}
                </td>
                <td>{g.name}</td>
                <td>{g.creator?.username ?? '—'}</td>
                <td>{memberCounts.get(g.id) ?? 0}</td>
                <td>{formatDate(g.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="no-image">
                  Sin grupos todavía.
                </td>
              </tr>
            )}
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

      {selectedGroup && <GroupDetailModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />}
    </div>
  )
}
