import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const METRIC_TYPES = [
  { value: 'daily_maps_completed', label: 'Mapas del día completados' },
  { value: 'daily_wins', label: 'Daily wins' },
  { value: 'duels_won', label: 'Duelos ganados' },
  { value: 'duels_played', label: 'Duelos jugados' },
  { value: 'elo_top_rank', label: 'Top ELO (posición)' },
]

function metricLabel(value) {
  return METRIC_TYPES.find((m) => m.value === value)?.label ?? value
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function LogroForm({ initial, onSave, onCancel, saving, error }) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [text, setText] = useState(initial.text ?? '')
  const [imageUrl, setImageUrl] = useState(initial.image_url ?? '')
  const [metricType, setMetricType] = useState(initial.metric_type ?? METRIC_TYPES[0].value)
  const [threshold, setThreshold] = useState(initial.threshold ?? 1)
  const [isActive, setIsActive] = useState(initial.is_active ?? true)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      title: title.trim(),
      text: text.trim() || null,
      image_url: imageUrl.trim() || null,
      metric_type: metricType,
      threshold: Number(threshold),
      is_active: isActive,
    })
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input type="text" placeholder="Texto (opcional)" value={text} onChange={(e) => setText(e.target.value)} />
      <input
        type="text"
        placeholder="URL de la imagen (opcional)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      <select value={metricType} onChange={(e) => setMetricType(e.target.value)}>
        {METRIC_TYPES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        placeholder="Umbral"
        value={threshold}
        onChange={(e) => setThreshold(e.target.value)}
        required
      />
      <label className="checkbox-label">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Activo
      </label>
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

function LogroRow({ logro, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (values) => {
    if (!values.title) {
      setError('Falta el título')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const { error: updateError } = await supabase.from('logros').update(values).eq('id', logro.id)
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
    if (!window.confirm(`¿Borrar el logro "${logro.title}"?`)) return
    setSaving(true)
    try {
      const { error: deleteError } = await supabase.from('logros').delete().eq('id', logro.id)
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
        <LogroForm initial={logro} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} error={error} />
      </li>
    )
  }

  return (
    <li className={`badge-item${logro.is_active ? '' : ' badge-item-inactive'}`}>
      {logro.image_url ? (
        <img src={logro.image_url} alt="" className="badge-item-image" />
      ) : (
        <span className="badge-item-image no-image">🏅</span>
      )}
      <span className="badge-item-info">
        <span className="badge-item-title">
          {logro.title}
          {!logro.is_active && ' (inactivo)'}
        </span>
        {logro.text && <span className="badge-item-text">{logro.text}</span>}
        <span className="badge-item-text">
          {metricLabel(logro.metric_type)} ≥ {logro.threshold}
        </span>
        <span className="badge-item-date">{formatDate(logro.created_at)}</span>
        {error && <span className="add-error">{error}</span>}
      </span>
      <span className="badge-item-actions">
        <button type="button" className="edit-btn" onClick={() => setEditing(true)} disabled={saving}>
          Editar
        </button>
        <button type="button" className="edit-btn badge-delete-btn" onClick={handleDelete} disabled={saving}>
          Borrar
        </button>
      </span>
    </li>
  )
}

export default function LogrosPanel() {
  const [logros, setLogros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  const fetchLogros = () => {
    setLoading(true)
    setError(null)
    supabase
      .from('logros')
      .select('*')
      .order('metric_type', { ascending: true })
      .order('threshold', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setLogros(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchLogros()
  }, [])

  const handleAdd = async (values) => {
    if (!values.title) {
      setAddError('Falta el título')
      return
    }
    setAddError(null)
    setAddSaving(true)
    try {
      const { error: insertError } = await supabase.from('logros').insert(values)
      if (insertError) throw insertError
      setAddOpen(false)
      fetchLogros()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">{logros.length} logros</span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <ul className="badge-list">
          {logros.map((l) => (
            <LogroRow key={l.id} logro={l} onChanged={fetchLogros} />
          ))}
          {logros.length === 0 && <p className="loading-text">Sin logros todavía.</p>}
        </ul>
      )}

      {addOpen ? (
        <LogroForm
          initial={{}}
          onSave={handleAdd}
          onCancel={() => setAddOpen(false)}
          saving={addSaving}
          error={addError}
        />
      ) : (
        <button type="button" className="add-toggle-btn badge-add-btn" onClick={() => setAddOpen(true)}>
          + Agregar logro
        </button>
      )}
    </div>
  )
}
