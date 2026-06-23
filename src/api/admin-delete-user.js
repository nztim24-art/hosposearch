// /api/admin-delete-user.js
// Fully deletes a user: auth account + profile + jobs.
// userId     = profiles.id  (used to delete profile row + jobs)
// authUserId = auth.users.id (used to delete the Supabase auth account)

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET         = process.env.ADMIN_SECRET;
const ADMIN_EMAIL          = 'admin@hosposearch.com.au';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, adminSecret, userId, authUserId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Service not configured' });

  // Auth check: admin secret OR valid Supabase JWT for admin email
  let authorised = false;

  if (adminSecret && ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    authorised = true;
  } else if (token) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const caller = await r.json();
        if (caller.email === ADMIN_EMAIL) authorised = true;
      }
    } catch(e) { /* fall through */ }
  }

  if (!authorised) return res.status(401).json({ error: 'Unauthorized' });

  const sbHeaders = {
    apikey:         SUPABASE_SERVICE_KEY,
    Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer:         'return=minimal',
  };

  const errors = [];

  // 1. Delete their job listings (keyed on profile id = emp_id)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?emp_id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
    if (!r.ok) errors.push(`jobs: ${r.status} ${await r.text()}`);
  } catch(e) { errors.push(`jobs: ${e.message}`); }

  // 2. Delete their applications (keyed on profile id = applicant_id)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/applications?applicant_id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
    if (!r.ok) errors.push(`applications: ${r.status} ${await r.text()}`);
  } catch(e) { errors.push(`applications: ${e.message}`); }

  // 3. Delete following/followers rows
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/following?follower_id=eq.${userId}`,  { method:'DELETE', headers:sbHeaders });
    await fetch(`${SUPABASE_URL}/rest/v1/following?following_id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
  } catch(e) { errors.push(`following: ${e.message}`); }

  // 4. Delete profile row (keyed on profile id)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, { method:'DELETE', headers:sbHeaders });
    if (!r.ok) errors.push(`profile: ${r.status} ${await r.text()}`);
  } catch(e) { errors.push(`profile: ${e.message}`); }

  // 5. Delete the Supabase Auth user — uses auth_id (authUserId), NOT profile id
  //    If authUserId not provided, try to look it up from the profile
  let authIdToDelete = authUserId;
  if (!authIdToDelete) {
    // Fallback: try to get auth_id from profile (already deleted above, so check before)
    console.warn('authUserId not provided — auth user may not be deleted');
  }

  if (authIdToDelete) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authIdToDelete}`, {
        method:  'DELETE',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (!r.ok) {
        const body = await r.text();
        errors.push(`auth: ${r.status} ${body}`);
        console.error(`Failed to delete auth user ${authIdToDelete}:`, r.status, body);
        return res.status(500).json({ error: 'Failed to delete auth user', detail: errors });
      }
    } catch(e) {
      return res.status(500).json({ error: `auth: ${e.message}` });
    }
  }

  return res.status(200).json({ ok: true, userId, warnings: errors.length ? errors : undefined });
}
