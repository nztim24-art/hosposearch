// /api/send-weekly-email.js
// Admin-triggered weekly curated job listings email sent to all job seekers.

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const ADMIN_SECRET         = process.env.ADMIN_SECRET;

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

  const { adminSecret, jobIds } = req.body || {};
  if (!adminSecret || adminSecret !== ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  if (!jobIds?.length)
    return res.status(400).json({ error: 'No job IDs provided' });

  // Fetch the selected jobs
  const jobs = await sb(`jobs?id=in.(${jobIds.join(',')})&select=*`);
  if (!jobs?.length) return res.status(404).json({ error: 'No jobs found' });

  // Fetch all employee emails
  const subscribers = await sb(`profiles?type=eq.employee&select=email,name`);
  const emails = (subscribers || []).map(u => u.email).filter(Boolean);
  if (!emails.length) return res.status(200).json({ ok: true, sent: 0, message: 'No subscribers' });

  // Build email HTML
  const jobCards = jobs.map(j => `
    <div style="border:1px solid #E8E2D8;border-radius:12px;padding:16px 20px;margin-bottom:12px;background:#fff;">
      <div style="font-size:16px;font-weight:700;color:#0F0E0C;margin-bottom:4px;">${j.title}</div>
      <div style="font-size:13px;color:#7A7570;margin-bottom:8px;">${j.venue || ''} · ${j.loc || ''} · ${j.type || ''}</div>
      ${j.short ? `<div style="font-size:13px;color:#3A3733;margin-bottom:12px;">${j.short}</div>` : ''}
      <a href="https://www.hosposearch.com/app" style="display:inline-block;background:#C4623A;color:#fff;padding:9px 20px;border-radius:100px;font-size:13px;font-weight:700;text-decoration:none;">View role →</a>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#FAF8F4;font-family:'DM Sans',Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:28px;font-weight:800;color:#0F0E0C;letter-spacing:-0.5px;">
            <span style="color:#C4623A;">Hospo</span>Search
          </div>
          <div style="font-size:13px;color:#A8A29A;margin-top:4px;letter-spacing:2px;text-transform:uppercase;">This week's top roles</div>
        </div>
        <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E8E2D8;margin-bottom:24px;">
          <p style="font-size:15px;color:#3A3733;line-height:1.6;margin:0 0 20px;">
            Here are this week's handpicked hospitality roles across Australia and New Zealand.
          </p>
          ${jobCards}
        </div>
        <div style="text-align:center;font-size:12px;color:#A8A29A;line-height:1.8;">
          <a href="https://www.hosposearch.com/app" style="color:#C4623A;font-weight:700;text-decoration:none;">Browse all jobs →</a><br>
          You're receiving this because you have a HospoSearch account.<br>
          <a href="https://www.hosposearch.com/app" style="color:#A8A29A;">Manage preferences</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send in batches of 50 (Resend limit)
  let sent = 0;
  const BATCH = 50;
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'HospoSearch <noreply@hosposearch.com>',
        to: batch,
        subject: `This week's top hospitality roles — HospoSearch`,
        html,
      }),
    });
    sent += batch.length;
  }

  return res.status(200).json({ ok: true, sent, jobs: jobs.length });
}
