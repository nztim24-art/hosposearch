import { jobMatchesAlert, buildEmail, sendEmail, sleep } from './_lib/alerts.js';
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
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}: ${text}`);
  // PATCH with return=minimal comes back empty — that used to crash the whole
  // run after the first email, so everyone got the same jobs again next day.
  return text ? JSON.parse(text) : null;
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
    // Shift Cover listings were already emailed to matching alerts when they went live.
    const jobsPool = jobs.filter(j => j.tier !== 'shift');

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
      const matches = jobsPool.filter(job =>
        new Date(job.created_at).getTime() > lastNotified && jobMatchesAlert(job, alert)
      );

      if (matches.length === 0) continue;

      const subject = matches.length === 1
        ? `New role: ${matches[0].title} on HospoSearch`
        : `${matches.length} new roles matching "${alert.label || alert.role}"`;

      let ok = false;
      try { ok = await sendEmail(profile.email, subject, buildEmail(profile.name, matches)); }
      catch (e) { console.warn('Alert email failed:', alert.id, e.message); }
      if (ok) {
        emailsSent++;
        notifiedAlertIds.push(alert.id);
        // Mark this alert as sent straight away, so a later failure can't cause repeats
        try {
          await sb(`job_alerts?id=eq.${alert.id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ last_notified_at: new Date().toISOString() }),
          });
        } catch (e) { console.warn('Could not mark alert sent:', alert.id, e.message); }
      }
      await sleep(600); // stay under Resend's 2-emails-per-second limit
    }

    return res.status(200).json({ sent: emailsSent, alertsChecked: alerts.length, jobsPool: jobsPool.length });
  } catch (e) {
    console.error('send-job-alerts error:', e);
    return res.status(500).json({ error: e.message });
  }
}
