import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { UPLOADS_BUCKET, uploadToBucket } from './storage'

function publicUrlFor(name) {
  const {
    data: { publicUrl },
  } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(name)
  return publicUrl
}

export default function FilesPanel() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copiedName, setCopiedName] = useState(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: listError } = await supabase.storage
      .from(UPLOADS_BUCKET)
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

  const uploadFiles = useCallback(
    async (fileList) => {
      const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return
      setUploading(true)
      setError(null)
      try {
        for (const file of imageFiles) {
          await uploadToBucket(file)
        }
        await fetchFiles()
      } catch (err) {
        setError(err.message)
      } finally {
        setUploading(false)
      }
    },
    [fetchFiles],
  )

  const handlePick = (e) => {
    const fileList = e.target.files
    e.target.value = ''
    if (fileList?.length) uploadFiles(fileList)
  }

  // Paste an image (Ctrl+V) anywhere on the page while this tab is open —
  // no need to save it to disk first just to pick it in the file input.
  useEffect(() => {
    const handlePaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) uploadFiles([file])
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [uploadFiles])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  const handleCopy = (name) => {
    navigator.clipboard.writeText(publicUrlFor(name))
    setCopiedName(name)
    setTimeout(() => setCopiedName(null), 1500)
  }

  const handleDelete = async (name) => {
    if (!window.confirm(`¿Borrar "${name}"?`)) return
    setError(null)
    const { error: deleteError } = await supabase.storage.from(UPLOADS_BUCKET).remove([name])
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
      </div>

      <label
        className={`dropzone${dragging ? ' dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {uploading ? 'Subiendo...' : 'Arrastrá una o más imágenes acá, pegá con Ctrl+V, o hacé click para elegir'}
        <input type="file" accept="image/*" multiple onChange={handlePick} disabled={uploading} hidden />
      </label>

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
