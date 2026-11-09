// /api/_lib/alerts.js
// Shared job-alert helpers, used by the daily alert cron and by the Stripe
// webhook (Shift Cover listings are alerted the moment they're paid for).
// Files under api/_lib are not deployed as routes.

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Does a job match an alert? Loose, forgiving matching.
export function jobMatchesAlert(job, alert) {
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

export function jobRow(job) {
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

export function buildEmail(name, matches) {
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

export async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'HospoSearch <alerts@hosposearch.com>', to: [to], subject, html }),
  });
  return res.ok;
}


// Email every matching job-alert subscriber about one job right now.
// Leaves last_notified_at alone; the daily cron skips Shift Cover jobs instead,
// so nobody gets the same urgent role twice.
export async function sendInstantAlerts(job, { supabaseUrl, serviceKey }) {
  if (!job || !supabaseUrl || !serviceKey || !RESEND_API_KEY) return { sent: 0, skipped: 'not configured' };
  const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const ar = await fetch(`${supabaseUrl}/rest/v1/job_alerts?active=eq.true&select=*`, { headers: h });
  const alerts = ar.ok ? await ar.json() : [];
  const matching = alerts.filter(a => jobMatchesAlert(job, a));
  if (!matching.length) return { sent: 0 };
  const ids = [...new Set(matching.map(a => a.user_id))];
  const pr = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,email,name`, { headers: h });
  const profiles = pr.ok ? await pr.json() : [];
  let sent = 0;
  for (const p of profiles) {
    if (!p.email) continue;
    try {
      const ok = await sendEmail(p.email, `Urgent: ${job.title || 'shift'} at ${job.venue || 'a venue near you'}`, buildEmail(p.name, [job]));
      if (ok) sent++;
    } catch (e) { console.warn('Instant alert failed:', p.id, e.message); }
    await sleep(600); // Resend: 2 emails per second
  }
  return { sent };
}
