// /api/admin-delete-user.js
// Fully deletes a user: auth account + profile + jobs.
// Accepts either a Supabase JWT (real admin account) OR ADMIN_SECRET (hardcoded admin).

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET         = process.env.ADMIN_SECRET;
const ADMIN_EMAIL          = 'admin@hosposearch.com.au';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, adminSecret, userId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Service not configured' });

  // Auth: accept either a valid Supabase JWT OR the ADMIN_SECRET
  let authorised = false;

  if (adminSecret && ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    // Hardcoded admin path — secret matches
    authorised = true;
  } else if (token) {
    // Real Supabase session path — verify JWT belongs to admin email
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const caller = await r.json();
        if (caller.email === ADMIN_EMAIL) authorised = true;
      }
    } catch(e) { /* fall through to 401 */ }
  }

  if (!authorised) return res.status(401).json({ error: 'Unauthorized' });

  const sbHeaders = {
    apikey:         SUPABASE_SERVICE_KEY,
    Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer:         'return=minimal',
  };

  const errors = [];

  // 1. Delete their job listings
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?emp_id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
    if (!r.ok) errors.push(`jobs: ${r.status} ${await r.text()}`);
  } catch(e) { errors.push(`jobs: ${e.message}`); }

  // 2. Delete their applications
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/applications?user_id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
    if (!r.ok) errors.push(`applications: ${r.status} ${await r.text()}`);
  } catch(e) { errors.push(`applications: ${e.message}`); }

  // 3. Delete following/followers rows
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/following?follower_id=eq.${userId}`,  { method:'DELETE', headers:sbHeaders });
    await fetch(`${SUPABASE_URL}/rest/v1/following?following_id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
  } catch(e) { errors.push(`following: ${e.message}`); }

  // 4. Delete profile row
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
    if (!r.ok) errors.push(`profile: ${r.status} ${await r.text()}`);
  } catch(e) { errors.push(`profile: ${e.message}`); }

  // 5. Delete the Supabase Auth user — prevents re-login
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method:  'DELETE',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    if (!r.ok) {
      const body = await r.text();
      errors.push(`auth: ${r.status} ${body}`);
      return res.status(500).json({ error: 'Failed to delete auth user', detail: errors });
    }
  } catch(e) {
    return res.status(500).json({ error: `auth: ${e.message}` });
  }

  return res.status(200).json({ ok: true, userId, warnings: errors.length ? errors : undefined });
}
