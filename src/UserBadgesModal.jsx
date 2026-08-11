import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function BadgeRow({ badge, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [imageUrl, setImageUrl] = useState(badge.image_url)
  const [title, setTitle] = useState(badge.title)
  const [text, setText] = useState(badge.text ?? '')
  const [isActive, setIsActive] = useState(badge.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const startEdit = () => {
    setImageUrl(badge.image_url)
    setTitle(badge.title)
    setText(badge.text ?? '')
    setIsActive(badge.is_active)
    setError(null)
    setEditing(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    if (!imageUrl.trim() || !title.trim()) {
      setError('Falta la imagen o el título')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('distintivos')
        .update({
          image_url: imageUrl.trim(),
          title: title.trim(),
          text: text.trim() || null,
          is_active: isActive,
        })
        .eq('id', badge.id)
      if (updateError) throw updateError
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`¿Borrar el distintivo "${badge.title}"?`)) return
    setSaving(true)
    try {
      const { error: deleteError } = await supabase.from('distintivos').delete().eq('id', badge.id)
      if (deleteError) throw deleteError
      onChanged()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <li className="badge-item badge-item-editing">
        <form className="add-form" onSubmit={handleSave}>
          <input
            type="text"
            placeholder="URL de la imagen"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
          />
          <input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input type="text" placeholder="Texto (opcional)" value={text} onChange={(e) => setText(e.target.value)} />
          <label className="checkbox-label">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="add-toggle-btn" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </button>
          {error && <span className="add-error">{error}</span>}
        </form>
      </li>
    )
  }

  return (
    <li className={`badge-item${badge.is_active ? '' : ' badge-item-inactive'}`}>
      <img src={badge.image_url} alt="" className="badge-item-image" />
      <span className="badge-item-info">
        <span className="badge-item-title">
          {badge.title}
          {!badge.is_active && ' (inactivo)'}
        </span>
        {badge.text && <span className="badge-item-text">{badge.text}</span>}
        <span className="badge-item-date">{formatDate(badge.created_at)}</span>
        {error && <span className="add-error">{error}</span>}
      </span>
      <span className="badge-item-actions">
        <button type="button" className="edit-btn" onClick={startEdit} disabled={saving}>
          Editar
        </button>
        <button type="button" className="edit-btn badge-delete-btn" onClick={handleDelete} disabled={saving}>
          Borrar
        </button>
      </span>
    </li>
  )
}

export default function UserBadgesModal({ user, onClose, onUsernameChanged }) {
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState(user.username)
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState(null)
  const [currentUsername, setCurrentUsername] = useState(user.username)

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

  const handleSaveUsername = async (e) => {
    e.preventDefault()
    setUsernameError(null)
    const trimmed = usernameInput.trim()
    if (!trimmed) {
      setUsernameError('El nombre no puede estar vacío')
      return
    }
    if (trimmed === currentUsername) {
      setEditingUsername(false)
      return
    }
    setUsernameSaving(true)
    try {
      const { error: updateError } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id)
      if (updateError) throw updateError
      setCurrentUsername(trimmed)
      setEditingUsername(false)
      onUsernameChanged?.(user.id, trimmed)
    } catch (err) {
      setUsernameError(err.code === '23505' ? 'Ese nombre de usuario ya está en uso' : err.message)
    } finally {
      setUsernameSaving(false)
    }
  }

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
          {editingUsername ? (
            <form className="add-form" onSubmit={handleSaveUsername}>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" disabled={usernameSaving}>
                {usernameSaving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                className="add-toggle-btn"
                disabled={usernameSaving}
                onClick={() => {
                  setUsernameInput(currentUsername)
                  setUsernameError(null)
                  setEditingUsername(false)
                }}
              >
                Cancelar
              </button>
              {usernameError && <span className="add-error">{usernameError}</span>}
            </form>
          ) : (
            <span className="badge-user-name">
              {currentUsername}
              <button
                type="button"
                className="edit-btn"
                onClick={() => {
                  setUsernameInput(currentUsername)
                  setEditingUsername(true)
                }}
              >
                ✏️
              </button>
            </span>
          )}
        </div>

        {error && <p className="error-banner">{error}</p>}

        {loading ? (
          <p className="loading-text">Cargando...</p>
        ) : (
          <ul className="badge-list">
            {badges.map((b) => (
              <BadgeRow key={b.id} badge={b} onChanged={fetchBadges} />
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
