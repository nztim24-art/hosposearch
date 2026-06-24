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

// Escape user-supplied text before dropping into the HTML email.
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Salary with pay-type suffix — matches the in-app job card (e.g. "AUD 80,000/yr", "AUD 35/hr").
const fmtSalary = (j) => {
  const s = j.salary;
  if (!s || s === 'Competitive') return s || 'Competitive';
  const suf = j.payType === 'Hourly' ? '/hr' : j.payType === 'Monthly' ? '/mo' : j.payType === 'Annually' ? '/yr' : '';
  return suf && !String(s).endsWith(suf) ? s + suf : s;
};

// First usable (hosted) photo for a job, or null.
const coverPhoto = (j) => {
  const arr = Array.isArray(j.photos) ? j.photos : [];
  return arr.find(p => typeof p === 'string' && p.startsWith('http')) || null;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Accept either field name for the admin secret.
  const { adminSecret, secret, jobIds } = req.body || {};
  const provided = adminSecret || secret;
  if (!provided || provided !== ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  if (!jobIds?.length)
    return res.status(400).json({ error: 'No job IDs provided' });

  // Fetch the selected jobs
  const jobs = await sb(`jobs?id=in.(${jobIds.join(',')})&select=*`);
  if (!jobs?.length) return res.status(404).json({ error: 'No jobs found' });

  // Preserve the admin's selection order
  const order = new Map(jobIds.map((id, i) => [String(id), i]));
  jobs.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0));

  // Fetch all employee emails
  const subscribers = await sb(`profiles?type=eq.employee&select=email,name`);
  const emails = (subscribers || []).map(u => u.email).filter(Boolean);
  if (!emails.length) return res.status(200).json({ ok: true, sent: 0, message: 'No subscribers' });

  // ── Build job cards ──────────────────────────────────────────────
  const jobCards = jobs.map(j => {
    const url   = `https://www.hosposearch.com/jobs/${j.id}`;
    const cover = coverPhoto(j);
    const venue = esc(j.venue || '');
    const loc   = esc(j.loc || '');

    // Cover image, or a branded placeholder block with the venue name.
    const media = cover
      ? `<a href="${url}" style="text-decoration:none;">
           <img src="${esc(cover)}" alt="${esc(j.title || 'Role')}" width="100%"
                style="display:block;width:100%;max-height:240px;object-fit:cover;border-radius:14px 14px 0 0;" />
         </a>`
      : `<a href="${url}" style="text-decoration:none;">
           <div style="background:linear-gradient(135deg,#E8CFBF,#C9A96E);border-radius:14px 14px 0 0;padding:46px 20px;text-align:center;">
             <div style="font-family:Georgia,'Times New Roman',serif;color:#fff;font-size:22px;font-weight:700;line-height:1.25;">${venue || 'HospoSearch'}</div>
             ${loc ? `<div style="color:rgba(255,255,255,0.9);font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-top:8px;">${loc}</div>` : ''}
           </div>
         </a>`;

    return `
      <div style="border:1px solid #ECE4D8;border-radius:16px;overflow:hidden;margin-bottom:18px;background:#fff;">
        ${media}
        <div style="padding:18px 22px 20px;">
          <div style="font-size:12px;font-weight:600;color:#9A8E7E;margin-bottom:4px;">${venue}</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#2B2722;margin-bottom:6px;">${esc(j.title || '')}</div>
          <div style="font-size:13px;font-weight:600;color:#C9A96E;margin-bottom:10px;">${esc(fmtSalary(j))}</div>
          ${j.short ? `<div style="font-size:13px;color:#6B6256;line-height:1.55;margin-bottom:14px;">${esc(j.short)}</div>` : ''}
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="font-size:12px;color:#9A8E7E;">📍 ${loc}${j.type ? ` · ${esc(j.type)}` : ''}</td>
            <td align="right"><a href="${url}" style="color:#C4623A;font-size:13px;font-weight:700;text-decoration:none;">View role →</a></td>
          </tr></table>
        </div>
      </div>`;
  }).join('');

  // ── Full email shell ─────────────────────────────────────────────
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#EFE9E1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="padding:22px 0;text-align:center;color:#9A8E7E;font-size:12px;">This week's hand-picked roles from HospoSearch</div>
    <div style="max-width:600px;margin:0 auto;background:#FBF8F3;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#C4623A,#A84F2E);padding:38px 32px;text-align:center;">
        <div style="font-family:Georgia,'Times New Roman',serif;color:#fff;font-size:30px;font-weight:700;letter-spacing:-0.5px;">HospoSearch</div>
        <div style="color:#F5EDE7;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:8px;font-weight:600;">Find. Grow. Stay.</div>
      </div>

      <!-- Intro -->
      <div style="padding:34px 32px 8px;">
        <div style="color:#C4623A;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:10px;">This week in hospitality</div>
        <div style="font-family:Georgia,'Times New Roman',serif;color:#2B2722;font-size:24px;font-weight:700;line-height:1.3;margin-bottom:12px;">Roles worth a look</div>
        <div style="color:#5F574C;font-size:15px;line-height:1.6;">Hand-picked openings from across Australia, New Zealand and beyond — fresh on the board this week. Tap any role to view the full listing and apply.</div>
      </div>

      <!-- Listings -->
      <div style="padding:24px 24px 8px;">
        ${jobCards}
      </div>

      <!-- CTA -->
      <div style="padding:14px 32px 36px;text-align:center;">
        <a href="https://www.hosposearch.com/jobs" style="display:inline-block;background:linear-gradient(135deg,#C4623A,#A84F2E);color:#fff;font-size:15px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none;">Browse all roles →</a>
      </div>

      <!-- Footer -->
      <div style="background:#F3ECE1;padding:28px 32px;text-align:center;border-top:1px solid #ECE4D8;">
        <div style="font-family:Georgia,'Times New Roman',serif;color:#C4623A;font-size:17px;font-weight:700;margin-bottom:8px;">HospoSearch</div>
        <div style="color:#9A8E7E;font-size:12px;line-height:1.6;margin-bottom:14px;">The home of hospitality talent across Australia &amp; New Zealand.</div>
        <div style="color:#B3A998;font-size:11px;line-height:1.7;">
          You're receiving this because you have a HospoSearch account.<br>
          <a href="https://www.hosposearch.com/app" style="color:#9A8E7E;text-decoration:underline;">Manage preferences</a>
        </div>
        <div style="color:#C4BBA8;font-size:11px;margin-top:14px;">hello@hosposearch.com &nbsp;·&nbsp; @hosposearch</div>
      </div>
    </div>
    <div style="height:40px;"></div>
  </body>
  </html>`;

  // Send in batches. Each email goes TO hello@hosposearch.com with the
  // recipients on BCC, so no job seeker can see anyone else's address.
  // Resend caps recipients at 50 per request (1 "to" + up to 49 bcc).
  let sent = 0;
  const BATCH = 49;
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'HospoSearch <noreply@hosposearch.com>',
        to: ['hello@hosposearch.com'],
        bcc: batch,
        subject: `This week's top hospitality roles — HospoSearch`,
        html,
      }),
    });
    sent += batch.length;
  }

  // Record what was sent so the admin can review it later.
  try {
    await sb('sent_emails', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        type: 'weekly',
        subject: `This week's top hospitality roles — HospoSearch`,
        job_ids: jobs.map(j => j.id),
        job_titles: jobs.map(j => ({ id: j.id, title: j.title || '', venue: j.venue || '', loc: j.loc || '' })),
        recipient_count: sent,
        html,
      }),
    });
  } catch (e) { console.warn('Could not log sent email:', e.message); }

  return res.status(200).json({ ok: true, sent, jobs: jobs.length });
}
