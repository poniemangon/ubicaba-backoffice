import { supabase } from './supabaseClient'

export const UPLOADS_BUCKET = 'admin-uploads'

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadToBucket(file) {
  const path = `${Date.now()}-${sanitizeName(file.name)}`
  const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(path, file)
  if (error) throw error
  const {
    data: { publicUrl },
  } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path)
  return publicUrl
}
