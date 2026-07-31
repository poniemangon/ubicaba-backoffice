import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const DUEL_TIME_LIMIT_KEY = 'duel_time_limit_seconds'

export default function SettingsPanel() {
  const [seconds, setSeconds] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', DUEL_TIME_LIMIT_KEY)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setSeconds(String(data.value))
        setLoading(false)
      })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const value = Number(seconds)
    if (!Number.isInteger(value) || value <= 0) {
      setError('Tiene que ser un número entero positivo')
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', DUEL_TIME_LIMIT_KEY)
      if (updateError) throw updateError
      setSuccess('Guardado')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="list-wrap">
      <form className="add-form" onSubmit={handleSave}>
        <label htmlFor="duel-time-limit">Duración por ronda en duelo timed (segundos)</label>
        <input
          id="duel-time-limit"
          type="number"
          min="1"
          step="1"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading || saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {error && <span className="add-error">{error}</span>}
        {success && <span className="add-success">{success}</span>}
      </form>
    </div>
  )
}
