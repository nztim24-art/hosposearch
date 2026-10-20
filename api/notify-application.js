// /api/notify-application.js
// Sends emails to employer + candidate when someone applies.
// From: applications@hosposearch.com via Resend
//
// The caller only sends the id of the application they just made. Everything
// in the email (who it goes to, the job, the applicant's details) is read from
// the database here, so this can't be used to email arbitrary addresses.
import { getCaller, profileIdsFor, sbService, esc } from '../src/server/auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const DOCS_PUBLIC  = '/storage/v1/object/public/documents/';

// CVs saved on profiles are private: give the employer a 14-day link instead
async function shareableDocUrl(url) {
  if (!url || !String(url).includes(DOCS_PUBLIC)) return url || null;
  try {
    const path = decodeURIComponent(String(url).split(DOCS_PUBLIC)[1].split('?')[0]);
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/documents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 14 }),
    });
    const d = await r.json();
    const signed = d.signedURL || d.signedUrl;
    return signed ? `${SUPABASE_URL}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}` : null;
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { applicationId } = req.body || {};
  if (!/^[0-9a-f-]{36}$/i.test(String(applicationId || ''))) return res.status(400).json({ error: 'Missing application' });

  const caller = await getCaller(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  let app, job, emp = null;
  try {
    [app] = await sbService(`applications?id=eq.${applicationId}&select=*`) || [];
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const mine = await profileIdsFor(caller);
    if (!mine.includes(app.applicant_id)) return res.status(403).json({ error: 'Not your application' });
    // One email per new application — not a way to re-send later
    if (Date.now() - new Date(app.created_at).getTime() > 15 * 60 * 1000)
      return res.status(409).json({ error: 'Too late to notify' });
    [job] = await sbService(`jobs?id=eq.${app.job_id}&select=id,title,venue,apply_email,emp_id`) || [];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (/^[0-9a-f-]{36}$/i.test(String(job.emp_id || ''))) {
      [emp] = await sbService(`profiles?id=eq.${job.emp_id}&select=email,name,email_notifications`) || [];
    }
  } catch (e) {
    console.error('notify-application lookup failed:', e.message);
    return res.status(500).json({ error: 'Lookup failed' });
  }

  const employerEmail = (job.apply_email && job.apply_email.includes('@')) ? job.apply_email.trim() : emp?.email;
  if (!employerEmail) return res.status(200).json({ ok: true, skipped: 'no employer email' });
  if (emp && emp.email_notifications === false && !job.apply_email) return res.status(200).json({ ok: true, skipped: 'notifications off' });

  // Everything below goes into HTML, so escape it
  const applicantEmailRaw = (app.email || '').trim();
  const employerName     = esc(emp?.name || job.venue);
  const applicantName    = esc(app.name || 'A candidate');
  const applicantEmail   = esc(applicantEmailRaw);
  const applicantPhone   = esc(app.phone || '');
  const applicantMessage = esc(app.message || '');
  const jobTitle         = esc(job.title || 'your role');
  const venueName        = esc(job.venue || emp?.name || '');
  const jobId            = job.id;
  const dashboardUrl     = `https://www.hosposearch.com/app?view=apps&jobId=${jobId}`;
  const resumeUrl        = esc(await shareableDocUrl(app.resume_url));
  const resumeName       = esc(app.resume_name || '');
  const coverUrl         = esc(await shareableDocUrl(app.cover_url));
  const coverName        = esc(app.cover_name || '');
  const visa             = esc(app.visa || '');
  const availability     = (Array.isArray(app.availability) ? app.availability : []).map(esc);
  const hours            = (Array.isArray(app.hours) ? app.hours : []).map(esc);
  const notice           = esc(app.notice || '');
  const screeningAnswers = Object.fromEntries(Object.entries(app.screening_answers || {}).map(([k, v]) => [k, esc(v)]));

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const viewUrl = dashboardUrl || 'https://www.hosposearch.com.au/app';

  // ── Helper: render a labelled row ──────────────────────────────────────────
  const row = (label, value) => value ? `
    <tr>
      <td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;padding:8px 0 2px;vertical-align:top;">${label}</td>
    </tr>
    <tr>
      <td style="font-size:14px;color:#3A3733;padding:0 0 10px;">${value}</td>
    </tr>` : '';

  // ── Screening answers block ─────────────────────────────────────────────────
  const SCREENING_LABELS = {
    rightToWork:        'Right to work',
    yearsExperience:    'Years of experience',
    noticePeriod:       'Notice period',
    policeCheck:        'Police check',
    availableWeekends:  'Available weekends',
    availablePublicHols:'Available public holidays',
    driverLicence:      'Driver licence',
    willingToRelocate:  'Willing to relocate',
  };
  const screeningRows = screeningAnswers && Object.keys(screeningAnswers).length
    ? Object.entries(screeningAnswers)
        .map(([k, v]) => row(SCREENING_LABELS[k] || k, v))
        .join('')
    : '';

  // ── Document links ──────────────────────────────────────────────────────────
  const docLinks = [
    resumeUrl ? `<a href="${resumeUrl}" style="display:inline-block;background:#F5EDE7;color:#C4623A;text-decoration:none;font-weight:600;font-size:13px;padding:8px 16px;border-radius:100px;margin-right:8px;margin-bottom:8px;">📋 ${resumeName || 'Résumé'}</a>` : '',
    coverUrl  ? `<a href="${coverUrl}"  style="display:inline-block;background:#F5EDE7;color:#C4623A;text-decoration:none;font-weight:600;font-size:13px;padding:8px 16px;border-radius:100px;margin-bottom:8px;">✉️ ${coverName  || 'Cover Letter'}</a>` : '',
  ].filter(Boolean).join('');

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#FAF8F4;padding:32px 24px;border-radius:16px;">
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0F0E0C;margin-bottom:4px;">
        <span style="color:#C4623A;">Hospo</span>Search
      </div>
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#7A7570;margin-bottom:24px;">New Application</div>

      <div style="background:#fff;border:1px solid #E8E2D8;border-radius:14px;padding:24px;">
        <p style="font-size:16px;color:#0F0E0C;margin:0 0 6px;">Hi ${employerName || 'there'},</p>
        <p style="font-size:15px;color:#3A3733;line-height:1.6;margin:0 0 18px;">
          <strong>${applicantName}</strong> has applied for your role:
        </p>

        <div style="background:#F5EDE7;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#0F0E0C;">${jobTitle}</div>
          ${venueName ? `<div style="font-size:13px;color:#7A7570;margin-top:3px;">${venueName}</div>` : ''}
        </div>

        <!-- Contact -->
        <div style="border:1px solid #E8E2D8;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:8px;">Applicant contact</div>
          <div style="font-size:15px;color:#0F0E0C;font-weight:700;margin-bottom:6px;">${applicantName}</div>
          ${applicantEmail ? `<div style="font-size:14px;margin-bottom:4px;">✉️ <a href="mailto:${applicantEmail}" style="color:#C4623A;text-decoration:none;">${applicantEmail}</a></div>` : ''}
          ${applicantPhone ? `<div style="font-size:14px;">📞 <a href="tel:${applicantPhone}" style="color:#C4623A;text-decoration:none;">${applicantPhone}</a></div>` : ''}
        </div>

        ${applicantMessage ? `
        <!-- Cover note -->
        <div style="border-left:3px solid #C4623A;padding-left:14px;margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:6px;">Cover note</div>
          <div style="font-size:14px;color:#3A3733;line-height:1.6;font-style:italic;">"${applicantMessage.replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</div>
        </div>` : ''}

        ${docLinks ? `
        <!-- Documents -->
        <div style="margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:10px;">Documents</div>
          ${docLinks}
        </div>` : ''}

        ${(visa || (availability && availability.length) || (hours && hours.length) || notice || screeningRows) ? `
        <!-- Application details -->
        <div style="border:1px solid #E8E2D8;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:8px;">Application details</div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('Right to work / visa', visa)}
            ${row('Availability', availability && availability.length ? availability.join(', ') : '')}
            ${row('Preferred hours', hours && hours.length ? hours.join(', ') : '')}
            ${row('Notice period', notice)}
            ${screeningRows}
          </table>
        </div>` : ''}

        <!-- CTA buttons -->
        ${applicantEmail ? `<a href="mailto:${applicantEmail}?subject=${encodeURIComponent('Re: Your application for ' + jobTitle)}" style="display:inline-block;background:#C4623A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;margin-right:10px;margin-bottom:10px;">Reply to ${(applicantName||'').split(' ')[0]} &rarr;</a>` : ''}
        <a href="${viewUrl}" style="display:inline-block;background:#F5EDE7;color:#C4623A;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;">View all applicants</a>
      </div>

      <p style="font-size:12px;color:#C0BAB2;text-align:center;margin-top:24px;line-height:1.5;">
        This application is saved in your HospoSearch dashboard under "Applications".<br/>
        You're receiving this because you posted a role on HospoSearch.
      </p>
    </div>
  `;

  // ── Candidate confirmation ─────────────────────────────────────────────────
  const candidateHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FAF8F4;padding:32px 24px;border-radius:16px;">
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0F0E0C;margin-bottom:4px;">
        <span style="color:#C4623A;">Hospo</span>Search
      </div>
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#7A7570;margin-bottom:24px;">Application Confirmation</div>
      <div style="background:#fff;border:1px solid #E8E2D8;border-radius:14px;padding:24px;">
        <p style="font-size:16px;color:#0F0E0C;margin:0 0 6px;">Hi ${(applicantName||'').split(' ')[0]},</p>
        <p style="font-size:15px;color:#3A3733;line-height:1.6;margin:0 0 18px;">Your application has been sent. Good luck! 🤞</p>
        <div style="background:#F5EDE7;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:4px;">Role applied for</div>
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#0F0E0C;">${jobTitle}</div>
          ${venueName ? `<div style="font-size:13px;color:#7A7570;margin-top:3px;">${venueName}</div>` : ''}
        </div>
        <p style="font-size:13px;color:#7A7570;line-height:1.6;margin:0 0 18px;">
          The venue will review your application and reach out directly if they'd like to move forward. You can track all your applications in your HospoSearch dashboard.
        </p>
        <a href="${viewUrl}" style="display:inline-block;background:#C4623A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;">View my applications &rarr;</a>
      </div>
      <p style="font-size:12px;color:#C0BAB2;text-align:center;margin-top:24px;line-height:1.5;">HospoSearch · The home of hospitality careers in ANZ</p>
    </div>
  `;

  try {
    // 1. Email employer
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'HospoSearch Applications <applications@hosposearch.com>',
        to: [employerEmail],
        reply_to: applicantEmailRaw || 'applications@hosposearch.com',
        subject: `New application — ${app.name || 'A candidate'} for ${job.title || 'your role'}`,
        html,
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('Resend error:', errText);
      return res.status(502).json({ error: 'Failed to send email', detail: errText });
    }

    // 2. Confirmation to candidate (non-blocking)
    // Confirmation goes to the applicant's own login email only
    if (caller.email) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'HospoSearch <applications@hosposearch.com>',
          to: [caller.email],
          reply_to: 'hello@hosposearch.com',
          subject: `Application sent — ${job.title || 'your application'}`,
          html: candidateHtml,
        }),
      }).catch(e => console.warn('Candidate email failed:', e));
    }

    const data = await r.json();
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('notify-application error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
