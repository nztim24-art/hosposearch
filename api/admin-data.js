// /api/admin-data.js
// Admin-only read endpoint. Uses the service role to return the COMPLETE
// picture — every job (with its views and its applications) plus headline
// stats. The caller must be signed in with an account in the `admins` table.
import { requireAdmin } from '../src/server/auth.js';

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await requireAdmin(req, res))) return;

  try {
    // Pull everything the panel needs, in parallel, via the service role (no RLS).
    const [jobs, applications, profileIds] = await Promise.all([
      sb('jobs?select=*&order=created_at.desc'),
      sb('applications?select=*&order=created_at.desc'),
      sb('profiles?select=id'),
    ]);

    const totalViews = (jobs || []).reduce((sum, j) => sum + (Number(j.views) || 0), 0);
    const activeJobs = (jobs || []).filter(j => j.active !== false).length;

    const stats = {
      totalJobs:        (jobs || []).length,
      activeJobs,
      inactiveJobs:     (jobs || []).length - activeJobs,
      totalViews,
      totalApplications: (applications || []).length,
      totalProfiles:    (profileIds || []).length,
    };

    return res.status(200).json({ jobs: jobs || [], applications: applications || [], stats });
  } catch (e) {
    console.error('admin-data error:', e);
    return res.status(500).json({ error: 'Failed to load admin data' });
  }
}
