// Server-only helpers: work out who is calling an /api endpoint from their
// Supabase login token (sent as "Authorization: Bearer <token>").

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

export async function sbService(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

// The signed-in Supabase user behind this request, or null.
export async function getCaller(req) {
  const h = req.headers.authorization || req.headers.Authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : ''
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const user = await r.json()
    return user && user.id ? user : null
  } catch (e) {
    return null
  }
}

export async function isAdminUser(user) {
  if (!user?.id) return false
  try {
    const rows = await sbService(`admins?auth_id=eq.${encodeURIComponent(user.id)}&select=auth_id`)
    return Array.isArray(rows) && rows.length > 0
  } catch (e) {
    console.error('admin check failed:', e.message)
    return false
  }
}

// Returns the admin user, or sends 401 and returns null.
export async function requireAdmin(req, res) {
  const user = await getCaller(req)
  if (user && (await isAdminUser(user))) return user
  res.status(401).json({ error: 'Unauthorized' })
  return null
}

// Profile ids owned by this user (employer and/or job seeker)
export async function profileIdsFor(user) {
  if (!user?.id) return []
  const rows = await sbService(`profiles?auth_id=eq.${encodeURIComponent(user.id)}&select=id`)
  return (rows || []).map(r => r.id)
}

export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
