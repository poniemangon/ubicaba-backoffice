import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import LocationPicker from './LocationPicker'

const PAGE_SIZE = 30

function comunaLabel(comuna) {
  return comuna === 0 ? 'Especiales' : `Comuna ${comuna}`
}

function formatStreets(street1, street2) {
  return street2 ? `${street1} y ${street2}` : street1
}

export default function IntersectionsList() {
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [comunaFilter, setComunaFilter] = useState('')
  const [barrioFilter, setBarrioFilter] = useState('')
  const [barrios, setBarrios] = useState([])
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  const [addOpen, setAddOpen] = useState(false)
  const [newStreet1, setNewStreet1] = useState('')
  const [newStreet2, setNewStreet2] = useState('')
  const [newLat, setNewLat] = useState('')
  const [newLng, setNewLng] = useState('')
  const [newBarrioId, setNewBarrioId] = useState('49')
  const [newImageFile, setNewImageFile] = useState(null)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)
  const [addSuccess, setAddSuccess] = useState(null)

  const [editingRow, setEditingRow] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  useEffect(() => {
    supabase
      .from('barrios')
      .select('*')
      .order('comuna', { ascending: true })
      .order('nombre', { ascending: true })
      .then(({ data, error: barriosError }) => {
        if (barriosError) setError(barriosError.message)
        else setBarrios(data)
      })
  }, [])

  const comunas = [...new Set(barrios.map((b) => b.comuna))].sort((a, b) => a - b)
  const barriosInComuna = comunaFilter
    ? barrios.filter((b) => String(b.comuna) === String(comunaFilter))
    : barrios

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('intersections')
      .select('pool_index, street1, street2, lat, lng, image_url, barrios(barrio_id, nombre, comuna)', {
        count: 'exact',
      })
      .order('pool_index', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (search.trim()) {
      const term = search.trim().replace(/[%_]/g, '')
      query = query.or(`street1.ilike.%${term}%,street2.ilike.%${term}%`)
    }
    if (onlyMissing) {
      query = query.is('image_url', null)
    }
    if (barrioFilter) {
      query = query.eq('barrio_id', barrioFilter)
    } else if (comunaFilter) {
      const ids = barriosInComuna.map((b) => b.barrio_id)
      query = query.in('barrio_id', ids.length ? ids : [-1])
    }

    const { data, error: fetchError, count } = await query
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, onlyMissing, comunaFilter, barrioFilter, page, barrios])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const handleSearchChange = (value) => {
    setSearch(value)
    setPage(0)
  }

  const uploadImage = async (poolIndex, file) => {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${poolIndex}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('intersection-images')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = supabase.storage.from('intersection-images').getPublicUrl(path)
    return `${publicUrl}?v=${Date.now()}`
  }

  const handleUpload = async (poolIndex, file) => {
    if (!file) return
    setUploadingIndex(poolIndex)
    setError(null)
    try {
      const imageUrl = await uploadImage(poolIndex, file)
      const { error: updateError } = await supabase
        .from('intersections')
        .update({ image_url: imageUrl })
        .eq('pool_index', poolIndex)
      if (updateError) throw updateError

      await fetchRows()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploadingIndex(null)
    }
  }

  const handleAddLocation = async (e) => {
    e.preventDefault()
    setAddError(null)
    setAddSuccess(null)

    const lat = parseFloat(newLat)
    const lng = parseFloat(newLng)
    if (!newStreet1.trim()) {
      setAddError('Falta el nombre / calle principal')
      return
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setAddError('Lat/Lng inválidos')
      return
    }

    setAddSaving(true)
    try {
      const { data: maxRow, error: maxError } = await supabase
        .from('intersections')
        .select('pool_index')
        .order('pool_index', { ascending: false })
        .limit(1)
        .single()
      if (maxError) throw maxError
      const nextIndex = (maxRow?.pool_index ?? -1) + 1

      const imageUrl = newImageFile ? await uploadImage(nextIndex, newImageFile) : null

      const { error: insertError } = await supabase.from('intersections').insert({
        pool_index: nextIndex,
        street1: newStreet1.trim(),
        street2: newStreet2.trim(),
        lat,
        lng,
        barrio_id: newBarrioId ? Number(newBarrioId) : null,
        image_url: imageUrl,
      })
      if (insertError) throw insertError

      setAddSuccess(`Agregado como #${nextIndex}`)
      setNewStreet1('')
      setNewStreet2('')
      setNewLat('')
      setNewLng('')
      setNewImageFile(null)
      await fetchRows()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }

  const openEdit = (r) => {
    setEditError(null)
    setEditingRow({
      pool_index: r.pool_index,
      street1: r.street1,
      street2: r.street2 ?? '',
      lat: String(r.lat),
      lng: String(r.lng),
      barrio_id: r.barrios?.barrio_id ? String(r.barrios.barrio_id) : '',
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    setEditError(null)

    const lat = parseFloat(editingRow.lat)
    const lng = parseFloat(editingRow.lng)
    if (!editingRow.street1.trim()) {
      setEditError('Falta el nombre / calle principal')
      return
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setEditError('Lat/Lng inválidos')
      return
    }

    setEditSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('intersections')
        .update({
          street1: editingRow.street1.trim(),
          street2: editingRow.street2.trim(),
          lat,
          lng,
          barrio_id: editingRow.barrio_id ? Number(editingRow.barrio_id) : null,
        })
        .eq('pool_index', editingRow.pool_index)
      if (updateError) throw updateError

      setEditingRow(null)
      await fetchRows()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <input
          type="text"
          placeholder="Buscar calle..."
          value={search}
          onChange={(e) => {
            const value = e.target.value
            clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => handleSearchChange(value), 300)
          }}
        />
        <select
          value={comunaFilter}
          onChange={(e) => {
            setComunaFilter(e.target.value)
            setBarrioFilter('')
            setPage(0)
          }}
        >
          <option value="">Todas las comunas</option>
          {comunas.map((c) => (
            <option key={c} value={c}>
              {comunaLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={barrioFilter}
          onChange={(e) => {
            setBarrioFilter(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Todos los barrios</option>
          {barriosInComuna.map((b) => (
            <option key={b.barrio_id} value={b.barrio_id}>
              {b.nombre}
            </option>
          ))}
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => {
              setOnlyMissing(e.target.checked)
              setPage(0)
            }}
          />
          Solo sin imagen
        </label>
        <span className="total-count">{totalCount} esquinas</span>
        <button type="button" className="add-toggle-btn" onClick={() => setAddOpen((o) => !o)}>
          {addOpen ? '✕ Cerrar' : '+ Agregar ubicación'}
        </button>
      </div>

      {addOpen && (
        <form className="add-form" onSubmit={handleAddLocation}>
          <input
            type="text"
            placeholder="Nombre / calle principal"
            value={newStreet1}
            onChange={(e) => setNewStreet1(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Calle 2 (opcional)"
            value={newStreet2}
            onChange={(e) => setNewStreet2(e.target.value)}
          />
          <input
            type="text"
            placeholder="Lat"
            value={newLat}
            onChange={(e) => setNewLat(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Lng"
            value={newLng}
            onChange={(e) => setNewLng(e.target.value)}
            required
          />
          <select value={newBarrioId} onChange={(e) => setNewBarrioId(e.target.value)}>
            <option value="">Sin barrio</option>
            {barrios.map((b) => (
              <option key={b.barrio_id} value={b.barrio_id}>
                {comunaLabel(b.comuna)} — {b.nombre}
              </option>
            ))}
          </select>
          <div className="picker-hint">Tocá el mapa o escribí lat/lng directamente — valen los dos.</div>
          <LocationPicker
            lat={parseFloat(newLat)}
            lng={parseFloat(newLng)}
            onPick={(pickedLat, pickedLng) => {
              setNewLat(pickedLat.toFixed(6))
              setNewLng(pickedLng.toFixed(6))
            }}
          />
          <div className="add-image-row">
            {newImageFile && <img src={URL.createObjectURL(newImageFile)} alt="" className="thumb" />}
            <label className="upload-btn">
              {newImageFile ? newImageFile.name : 'Agregar imagen (opcional)'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button type="submit" disabled={addSaving}>
            {addSaving ? 'Guardando...' : 'Agregar'}
          </button>
          {addError && <span className="add-error">{addError}</span>}
          {addSuccess && <span className="add-success">{addSuccess}</span>}
        </form>
      )}

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <table className="rows-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Calles</th>
              <th>Barrio</th>
              <th>Imagen</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pool_index}>
                <td>{r.pool_index}</td>
                <td>{formatStreets(r.street1, r.street2)}</td>
                <td>{r.barrios?.nombre ?? '—'}</td>
                <td>
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="thumb" />
                  ) : (
                    <span className="no-image">Sin imagen</span>
                  )}
                </td>
                <td>
                  <label className="upload-btn">
                    {uploadingIndex === r.pool_index ? 'Subiendo...' : r.image_url ? 'Cambiar' : 'Subir'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingIndex === r.pool_index}
                      onChange={(e) => handleUpload(r.pool_index, e.target.files?.[0])}
                    />
                  </label>
                </td>
                <td>
                  <button type="button" className="edit-btn" onClick={() => openEdit(r)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingRow && (
        <div className="modal-backdrop" onClick={() => setEditingRow(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <span>Editar #{editingRow.pool_index}</span>
              <button type="button" className="calendar-close" onClick={() => setEditingRow(null)}>
                ✕
              </button>
            </div>
            <form className="add-form" onSubmit={handleEditSave}>
              <input
                type="text"
                placeholder="Nombre / calle principal"
                value={editingRow.street1}
                onChange={(e) => setEditingRow({ ...editingRow, street1: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Calle 2 (opcional)"
                value={editingRow.street2}
                onChange={(e) => setEditingRow({ ...editingRow, street2: e.target.value })}
              />
              <input
                type="text"
                placeholder="Lat"
                value={editingRow.lat}
                onChange={(e) => setEditingRow({ ...editingRow, lat: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Lng"
                value={editingRow.lng}
                onChange={(e) => setEditingRow({ ...editingRow, lng: e.target.value })}
                required
              />
              <select
                value={editingRow.barrio_id}
                onChange={(e) => setEditingRow({ ...editingRow, barrio_id: e.target.value })}
              >
                <option value="">Sin barrio</option>
                {barrios.map((b) => (
                  <option key={b.barrio_id} value={b.barrio_id}>
                    {comunaLabel(b.comuna)} — {b.nombre}
                  </option>
                ))}
              </select>
              <div className="picker-hint">Tocá el mapa o escribí lat/lng directamente — valen los dos.</div>
              <LocationPicker
                lat={parseFloat(editingRow.lat)}
                lng={parseFloat(editingRow.lng)}
                onPick={(pickedLat, pickedLng) =>
                  setEditingRow({ ...editingRow, lat: pickedLat.toFixed(6), lng: pickedLng.toFixed(6) })
                }
              />
              <button type="submit" disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              {editError && <span className="add-error">{editError}</span>}
            </form>
          </div>
        </div>
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
