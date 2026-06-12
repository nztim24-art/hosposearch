// /api/admin-job.js
// Admin-only job actions (delete / update) that run with the service role,
// bypassing RLS. Protected by an admin secret so only the admin app can call it.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Service not configured' });
  }

  const { secret, action, jobId, fields } = req.body || {};

  // Authenticate the admin
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const base = `${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`;
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  try {
    if (action === 'delete') {
      const r = await fetch(base, { method: 'DELETE', headers });
      if (!r.ok) throw new Error(`Delete failed: ${r.status} ${await r.text()}`);
      return res.status(200).json({ ok: true, action: 'delete', jobId });
    }
    if (action === 'update') {
      const r = await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(fields || {}) });
      if (!r.ok) throw new Error(`Update failed: ${r.status} ${await r.text()}`);
      return res.status(200).json({ ok: true, action: 'update', jobId });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('admin-job error:', e);
    return res.status(500).json({ error: e.message });
  }
}
