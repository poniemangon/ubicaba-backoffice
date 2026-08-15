import { useCallback, useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import { supabase } from './supabaseClient'

const PAGE_SIZE = 30

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatStreets(street1, street2) {
  return street2 ? `${street1} y ${street2}` : street1
}

function CommentDetailModal({ comment, onClose }) {
  const i = comment.intersection
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="edit-modal comment-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <span>Comentario</span>
          <button type="button" className="calendar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {i && (
          <div className="comment-map">
            <MapContainer center={[i.lat, i.lng]} zoom={16} className="comment-map-inner" zoomControl={false} dragging={false} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker center={[i.lat, i.lng]} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }} />
            </MapContainer>
          </div>
        )}

        <p className="comment-detail-street">{i ? formatStreets(i.street1, i.street2) : 'Esquina no encontrada'}</p>
        <p className="comment-detail-text">{comment.text}</p>
        <p className="comment-detail-meta">
          {comment.profile?.username ?? 'Jugador'} — {formatDate(comment.created_at)}
        </p>
      </div>
    </div>
  )
}

export default function CommentsList() {
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError, count } = await supabase
      .from('comments')
      .select(
        `id, text, seen, created_at,
        profile:profile_id(id, username),
        intersection:pool_index(pool_index, street1, street2, lat, lng)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data || [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [page])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const handleOpen = async (comment) => {
    setSelected(comment)
    if (comment.seen) return
    const { error: updateError } = await supabase.from('comments').update({ seen: true }).eq('id', comment.id)
    if (updateError) {
      console.error(updateError)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === comment.id ? { ...r, seen: true } : r)))
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">{totalCount} comentarios</span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <table className="rows-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Esquina</th>
              <th>Usuario</th>
              <th>Comentario</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                className={`rows-table-row-clickable${c.seen ? ' comment-row-seen' : ''}`}
                onClick={() => handleOpen(c)}
              >
                <td>{formatDate(c.created_at)}</td>
                <td>{c.intersection ? formatStreets(c.intersection.street1, c.intersection.street2) : '—'}</td>
                <td>{c.profile?.username ?? 'Jugador'}</td>
                <td className="comment-row-text">{c.text}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="loading-text">
                  Sin comentarios todavía.
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

      {selected && <CommentDetailModal comment={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
