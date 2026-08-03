import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function UserBadgesModal({ user, onClose }) {
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  const fetchBadges = () => {
    setLoading(true)
    setError(null)
    supabase
      .from('distintivos')
      .select('*')
      .eq('user_uuid', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setBadges(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchBadges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const handleAddBadge = async (e) => {
    e.preventDefault()
    setAddError(null)
    if (!imageUrl.trim() || !title.trim()) {
      setAddError('Falta la imagen o el título')
      return
    }
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('distintivos').insert({
        user_uuid: user.id,
        image_url: imageUrl.trim(),
        title: title.trim(),
        text: text.trim() || null,
      })
      if (insertError) throw insertError
      setImageUrl('')
      setTitle('')
      setText('')
      setAddOpen(false)
      fetchBadges()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <span>Distintivos</span>
          <button type="button" className="calendar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="badge-user-header">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="badge-user-avatar" />
          ) : (
            <span className="badge-user-avatar no-image">🙂</span>
          )}
          <span className="badge-user-name">{user.username}</span>
        </div>

        {error && <p className="error-banner">{error}</p>}

        {loading ? (
          <p className="loading-text">Cargando...</p>
        ) : (
          <ul className="badge-list">
            {badges.map((b) => (
              <li key={b.id} className={`badge-item${b.is_active ? '' : ' badge-item-inactive'}`}>
                <img src={b.image_url} alt="" className="badge-item-image" />
                <span className="badge-item-info">
                  <span className="badge-item-title">
                    {b.title}
                    {!b.is_active && ' (inactivo)'}
                  </span>
                  {b.text && <span className="badge-item-text">{b.text}</span>}
                  <span className="badge-item-date">{formatDate(b.created_at)}</span>
                </span>
              </li>
            ))}
            {badges.length === 0 && <p className="profile-empty-text">Sin distintivos todavía.</p>}
          </ul>
        )}

        {addOpen ? (
          <form className="add-form" onSubmit={handleAddBadge}>
            <input
              type="text"
              placeholder="URL de la imagen"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input type="text" placeholder="Texto (opcional)" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Agregar distintivo'}
            </button>
            <button type="button" className="add-toggle-btn" onClick={() => setAddOpen(false)}>
              Cancelar
            </button>
            {addError && <span className="add-error">{addError}</span>}
          </form>
        ) : (
          <button type="button" className="add-toggle-btn badge-add-btn" onClick={() => setAddOpen(true)}>
            + Agregar distintivo
          </button>
        )}
      </div>
    </div>
  )
}
