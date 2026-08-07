import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const BUCKET = 'admin-uploads'

function publicUrlFor(name) {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(name)
  return publicUrl
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default function FilesPanel() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [copiedName, setCopiedName] = useState(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: listError } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    if (listError) {
      setError(listError.message)
    } else {
      setFiles((data || []).filter((f) => f.name !== '.emptyFolderPlaceholder'))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const path = `${Date.now()}-${sanitizeName(file.name)}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
      if (uploadError) throw uploadError
      await fetchFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleCopy = (name) => {
    navigator.clipboard.writeText(publicUrlFor(name))
    setCopiedName(name)
    setTimeout(() => setCopiedName(null), 1500)
  }

  const handleDelete = async (name) => {
    if (!window.confirm(`¿Borrar "${name}"?`)) return
    setError(null)
    const { error: deleteError } = await supabase.storage.from(BUCKET).remove([name])
    if (deleteError) {
      setError(deleteError.message)
    } else {
      fetchFiles()
    }
  }

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <span className="total-count">{files.length} archivos</span>
        <label className="upload-btn">
          {uploading ? 'Subiendo...' : '+ Subir archivo'}
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} hidden />
        </label>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : (
        <div className="files-grid">
          {files.map((f) => (
            <div key={f.name} className="file-card">
              <img src={publicUrlFor(f.name)} alt="" className="file-card-thumb" />
              <span className="file-card-name">{f.name}</span>
              <span className="file-card-actions">
                <button type="button" className="edit-btn" onClick={() => handleCopy(f.name)}>
                  {copiedName === f.name ? 'Copiado!' : 'Copiar URL'}
                </button>
                <button type="button" className="edit-btn badge-delete-btn" onClick={() => handleDelete(f.name)}>
                  Borrar
                </button>
              </span>
            </div>
          ))}
          {files.length === 0 && <p className="loading-text">Sin archivos todavía.</p>}
        </div>
      )}
    </div>
  )
}
