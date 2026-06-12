// /api/send-job-alerts.js
// Daily cron: finds jobs posted since each alert was last notified,
// matches them against saved searches, and emails candidates their new matches.
// Triggered by Vercel Cron (see vercel.json). Secured with CRON_SECRET.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// Does a job match an alert? Loose, forgiving matching.
function jobMatchesAlert(job, alert) {
  const norm = (s) => (s || '').toLowerCase().trim();

  // Role / title — keyword overlap
  if (alert.role && norm(alert.role)) {
    const terms = norm(alert.role).split(/\s+/).filter(t => t.length > 2);
    const haystack = `${norm(job.title)} ${norm(job.role)} ${(job.tags||[]).map(norm).join(' ')}`;
    const hit = terms.some(t => haystack.includes(t));
    if (!hit) return false;
  }

  // Location — substring either direction
  if (alert.location && norm(alert.location)) {
    const loc = `${norm(job.loc)} ${norm(job.city)} ${norm(job.state)} ${norm(job.country)}`;
    const aloc = norm(alert.location);
    if (!loc.includes(aloc) && !aloc.split(/[\s,]+/).some(p => p.length > 2 && loc.includes(p))) return false;
  }

  // Employment type
  if (alert.emp_type && alert.emp_type !== 'Any') {
    if (norm(job.type) !== norm(alert.emp_type)) return false;
  }

  return true;
}

function jobRow(job) {
  const salary = job.salary || (job.salary_text) || 'Salary on application';
  const loc = job.loc || [job.city, job.state, job.country].filter(Boolean).join(', ');
  return `
    <tr><td style="padding:0 0 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E2D8;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1A1410;margin-bottom:3px;">${job.title || 'New role'}</div>
          <div style="font-size:13px;color:#7A7570;margin-bottom:6px;">${job.venue || ''}${loc ? ' · ' + loc : ''}</div>
          <div style="font-size:14px;color:#C4623A;font-weight:600;margin-bottom:12px;">${salary}</div>
          <a href="https://www.hosposearch.com.au/jobs/${job.id}" style="display:inline-block;background:#C4623A;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;">View &amp; apply →</a>
        </td></tr>
      </table>
    </td></tr>`;
}

function buildEmail(name, matches) {
  const rows = matches.map(jobRow).join('');
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAF8F4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:24px 0;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 20px 20px;">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1A1410;">
              <span style="color:#C4623A;">Hospo</span>Search
            </div>
          </td></tr>
          <tr><td style="padding:0 20px 8px;">
            <div style="font-family:Georgia,serif;font-size:20px;color:#1A1410;">
              ${matches.length} new role${matches.length !== 1 ? 's' : ''} matching your alert
            </div>
            <div style="font-size:14px;color:#7A7570;margin-top:4px;">
              Hi ${name || 'there'}, here ${matches.length !== 1 ? 'are' : 'is'} the latest ${matches.length !== 1 ? 'matches' : 'match'} from your saved search.
            </div>
          </td></tr>
          <tr><td style="padding:16px 20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          </td></tr>
          <tr><td style="padding:14px 20px 30px;">
            <div style="font-size:12px;color:#A8A29A;line-height:1.6;">
              You're receiving this because you saved a job alert on HospoSearch.
              Manage or remove your alerts anytime in the app under Job Alerts.
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'HospoSearch <alerts@hosposearch.com>', to: [to], subject, html }),
  });
  return res.ok;
}

export default async function handler(req, res) {
  // Secure the cron endpoint
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Service not configured' });
  }

  try {
    // 1. Get all active alerts
    const alerts = await sb('job_alerts?active=eq.true&select=*');
    if (!alerts.length) return res.status(200).json({ sent: 0, message: 'No active alerts' });

    // 2. Get active paid jobs from the last 7 days (the candidate pool to match against)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const jobs = await sb(`jobs?active=eq.true&paid=eq.true&created_at=gte.${sevenDaysAgo}&select=*`);

    // 3. Get candidate profiles (need their email + name) for the alert user_ids
    const userIds = [...new Set(alerts.map(a => a.user_id))];
    const profiles = await sb(`profiles?id=in.(${userIds.join(',')})&select=id,email,name`);
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

    let emailsSent = 0;
    const notifiedAlertIds = [];

    // 4. For each alert, find jobs newer than last_notified_at that match
    for (const alert of alerts) {
      const profile = profileMap[alert.user_id];
      if (!profile || !profile.email) continue;

      const lastNotified = new Date(alert.last_notified_at || alert.created_at || 0).getTime();
      const matches = jobs.filter(job =>
        new Date(job.created_at).getTime() > lastNotified && jobMatchesAlert(job, alert)
      );

      if (matches.length === 0) continue;

      const subject = matches.length === 1
        ? `New role: ${matches[0].title} on HospoSearch`
        : `${matches.length} new roles matching "${alert.label || alert.role}"`;

      const ok = await sendEmail(profile.email, subject, buildEmail(profile.name, matches));
      if (ok) { emailsSent++; notifiedAlertIds.push(alert.id); }
    }

    // 5. Update last_notified_at on alerts we emailed
    const now = new Date().toISOString();
    for (const id of notifiedAlertIds) {
      await sb(`job_alerts?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_notified_at: now }),
      });
    }

    return res.status(200).json({ sent: emailsSent, alertsChecked: alerts.length, jobsPool: jobs.length });
  } catch (e) {
    console.error('send-job-alerts error:', e);
    return res.status(500).json({ error: e.message });
  }
}
