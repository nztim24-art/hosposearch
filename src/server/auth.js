// Server-only helpers: work out who is calling an /api endpoint from their
// Supabase login token (sent as "Authorization: Bearer <token>").

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://auth.hosposearch.com'
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

export function bearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

// The signed-in Supabase user behind this request, or null.
export async function getCaller(req) {
  const token = bearerToken(req)
  if (!token || !SERVICE_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      console.warn('getCaller: /auth/v1/user returned', r.status)
      return null
    }
    const user = await r.json()
    return user && user.id ? user : null
  } catch (e) {
    console.warn('getCaller failed:', e.message)
    return null
  }
}

// Is this account an admin? Checked two independent ways so one API hiccup
// can't lock the admin panel out: the admins table, then the is_admin()
// function called as the caller. Both read the same private admins list.
export async function isAdminUser(user, token) {
  if (!user?.id) return false
  try {
    const rows = await sbService(`admins?auth_id=eq.${encodeURIComponent(user.id)}&select=auth_id`)
    if (Array.isArray(rows) && rows.length > 0) return true
  } catch (e) {
    console.warn('admins table check failed:', e.message)
  }
  if (!token) return false
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) {
      console.warn('is_admin rpc returned', r.status, await r.text().catch(() => ''))
      return false
    }
    return (await r.json()) === true
  } catch (e) {
    console.warn('is_admin rpc failed:', e.message)
    return false
  }
}

// Returns the admin user, or sends 401 and returns null.
export async function requireAdmin(req, res) {
  const user = await getCaller(req)
  if (user && (await isAdminUser(user, bearerToken(req)))) return user
  console.warn('requireAdmin denied for', user?.email || 'no caller')
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
