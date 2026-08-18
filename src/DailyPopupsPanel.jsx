import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { uploadToBucket } from './storage'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ImageDropzone({ label, imageUrl, onChange }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const upload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setError(null)
    setUploading(true)
    try {
      onChange(await uploadToBucket(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label
        className={`dropzone dropzone-small${dragging ? ' dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files?.[0])
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="dropzone-preview" />
        ) : uploading ? (
          'Subiendo...'
        ) : (
          `${label} — arrastrá una imagen acá, o hacé click para elegir`
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            upload(e.target.files?.[0])
            e.target.value = ''
          }}
          disabled={uploading}
          hidden
        />
      </label>
      {error && <span className="add-error">{error}</span>}
      <input type="text" placeholder={`URL de la foto ${label.toLowerCase()}`} value={imageUrl} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function DailyPopupForm({ initial, onSave, onCancel, saving, error }) {
  const [imageUrlDesktop, setImageUrlDesktop] = useState(initial.image_url_desktop ?? '')
  const [imageUrlMobile, setImageUrlMobile] = useState(initial.image_url_mobile ?? '')
  const [linkUrl, setLinkUrl] = useState(initial.link_url ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      image_url_desktop: imageUrlDesktop.trim(),
      image_url_mobile: imageUrlMobile.trim(),
      link_url: linkUrl.trim(),
    })
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <ImageDropzone label="Desktop" imageUrl={imageUrlDesktop} onChange={setImageUrlDesktop} />
      <ImageDropzone label="Mobile" imageUrl={imageUrlMobile} onChange={setImageUrlMobile} />
      <input
        type="text"
        placeholder="Link (a dónde va al clickear)"
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        required
      />
      <button type="submit" disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
      <button type="button" className="add-toggle-btn" onClick={onCancel} disabled={saving}>
        Cancelar
      </button>
      {error && <span className="add-error">{error}</span>}
    </form>
  )
}

function DailyPopupRow({ popup, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (values) => {
    if (!values.image_url_desktop || !values.image_url_mobile || !values.link_url) {
      setError('Faltan la foto desktop, la foto mobile o el link')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const { error: updateError } = await supabase.from('daily_popups').update(values).eq('id', popup.id)
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
    if (!window.confirm('¿Borrar este popup?')) return
    setSaving(true)
    try {
      const { error: deleteError } = await supabase.from('daily_popups').delete().eq('id', popup.id)
      if (deleteError) throw deleteError
      onChanged()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  // Checking one deactivates every other popup — set_active_daily_popup
  // (0069) does both in one transaction. Unchecking just turns this one off,
  // no RPC needed for that direction.
  const handleToggleActive = async (e) => {
    const next = e.target.checked
    setError(null)
    setActivating(true)
    try {
      if (next) {
        const { error: rpcError } = await supabase.rpc('set_active_daily_popup', { popup_id: popup.id })
        if (rpcError) throw rpcError
      } else {
        const { error: updateError } = await supabase.from('daily_popups').update({ active: false }).eq('id', popup.id)
        if (updateError) throw updateError
      }
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setActivating(false)
    }
  }

  if (editing) {
    return (
      <li className="badge-item badge-item-editing">
        <DailyPopupForm initial={popup} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} error={error} />
      </li>
    )
  }

  return (
    <li className={`badge-item${popup.active ? '' : ' badge-item-inactive'}`}>
      <label className="checkbox-label daily-popup-active-check" title="Activo">
        <input type="checkbox" checked={popup.active} onChange={handleToggleActive} disabled={activating} />
      </label>
      <img src={popup.image_url_desktop} alt="" className="badge-item-image" />
      <span className="badge-item-info">
        <span className="badge-item-title">{popup.active ? 'Activo' : 'Inactivo'}</span>
        <span className="badge-item-text">{popup.link_url}</span>
        <span className="badge-item-text">👆 {popup.click_count ?? 0} clicks</span>
        <span className="badge-item-date">{formatDate(popup.created_at)}</span>
        {error && <span className="add-error">{error}</span>}
      </span>
      <span className="badge-item-actions">
        <button type="button" className="edit-btn" onClick={() => setPreviewing(true)} disabled={saving}>
          Ver
        </button>
        <button type="button" className="edit-btn" onClick={() => setEditing(true)} disabled={saving}>
          Editar
        </button>
        <button type="button" className="edit-btn badge-delete-btn" onClick={handleDelete} disabled={saving}>
          Borrar
        </button>
      </span>

      {previewing && (
        <div className="modal-backdrop" onClick={() => setPreviewing(false)}>
          <div className="edit-modal daily-popup-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <span>Vista previa</span>
              <button type="button" className="calendar-close" onClick={() => setPreviewing(false)}>
                ✕
              </button>
            </div>
            <p className="badge-item-text">Desktop</p>
            <img src={popup.image_url_desktop} alt="" className="daily-popup-preview-image" />
            <p className="badge-item-text">Mobile</p>
            <img src={popup.image_url_mobile} alt="" className="daily-popup-preview-image daily-popup-preview-image-mobile" />
          </div>
        </div>
      )}
    </li>
  )
}

export default function DailyPopupsPanel() {
  const [popups, setPopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  const fetchPopups = () => {
    setLoading(true)
    setError(null)
    supabase
      .from('daily_popups')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setPopups(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchPopups()
  }, [])

  const handleAdd = async (values) => {
    if (!values.image_url_desktop || !values.image_url_mobile || !values.link_url) {
      setAddError('Faltan la foto desktop, la foto mobile o el link')
      return
    }
    setAddError(null)
    setAddSaving(true)
    try {
      const { error: insertError } = await supabase.from('daily_popups').insert(values)
      if (insertError) throw insertError
      setAddOpen(false)
      fetchPopups()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">{popups.length} popups</span>
      </div>

      <p className="profile-empty-text">
        Se muestra a los jugadores una vez por día, antes de "Mapa del día" — el popup activo creado más recientemente.
      </p>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <ul className="badge-list">
          {popups.map((p) => (
            <DailyPopupRow key={p.id} popup={p} onChanged={fetchPopups} />
          ))}
          {popups.length === 0 && <p className="loading-text">Sin popups todavía.</p>}
        </ul>
      )}

      {addOpen ? (
        <DailyPopupForm initial={{}} onSave={handleAdd} onCancel={() => setAddOpen(false)} saving={addSaving} error={addError} />
      ) : (
        <button type="button" className="add-toggle-btn badge-add-btn" onClick={() => setAddOpen(true)}>
          + Agregar popup
        </button>
      )}
    </div>
  )
}
