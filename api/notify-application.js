// /api/notify-application.js
// Sends an email to the employer when a candidate applies.
// Uses Resend (https://resend.com) — set RESEND_API_KEY in Vercel env vars.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    employerEmail,
    employerName,
    applicantName,
    applicantEmail,
    applicantPhone,
    applicantMessage,
    jobTitle,
    jobId,
    dashboardUrl,
  } = req.body || {};

  if (!employerEmail || !applicantName || !jobTitle) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const viewUrl = dashboardUrl || 'https://www.hosposearch.com.au/app';

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FAF8F4;padding:32px 24px;border-radius:16px;">
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
        </div>

        <div style="border:1px solid #E8E2D8;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:8px;">Applicant contact</div>
          <div style="font-size:14px;color:#0F0E0C;font-weight:600;margin-bottom:4px;">${applicantName}</div>
          ${applicantEmail ? `<div style="font-size:14px;margin-bottom:3px;">✉️ <a href="mailto:${applicantEmail}" style="color:#C4623A;text-decoration:none;">${applicantEmail}</a></div>` : ''}
          ${applicantPhone ? `<div style="font-size:14px;">📞 <a href="tel:${applicantPhone}" style="color:#C4623A;text-decoration:none;">${applicantPhone}</a></div>` : ''}
        </div>

        ${applicantMessage ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:6px;">Their message</div>
          <div style="font-size:14px;color:#3A3733;line-height:1.6;font-style:italic;">"${applicantMessage.replace(/</g,'&lt;')}"</div>
        </div>` : ''}
        ${applicantEmail ? `
        <a href="mailto:${applicantEmail}?subject=${encodeURIComponent('Re: Your application for '+jobTitle)}" style="display:inline-block;background:#C4623A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;margin-right:10px;margin-bottom:10px;">
          Reply to ${(applicantName||'').split(' ')[0]} &rarr;
        </a>` : ''}
        <a href="${viewUrl}" style="display:inline-block;background:#F5EDE7;color:#C4623A;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;">
          View all applicants
        </a>
      </div>

      <p style="font-size:12px;color:#C0BAB2;text-align:center;margin-top:24px;line-height:1.5;">
        This application is also saved in your HospoSearch dashboard under "Applications".<br/>
        You're receiving this because you posted a role on HospoSearch.
      </p>
    </div>
  `;

  try {
    // 1. Email employer
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HospoSearch Applications <applications@hosposearch.com.au>',
        to: [employerEmail],
        reply_to: applicantEmail || 'applications@hosposearch.com.au',
        subject: `New application via HospoSearch — ${jobTitle}`,
        html,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Resend error:', errText);
      return res.status(502).json({ error: 'Failed to send email', detail: errText });
    }

    // 2. Confirmation email to candidate
    if (applicantEmail) {
      const candidateHtml = `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FAF8F4;padding:32px 24px;border-radius:16px;">
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0F0E0C;margin-bottom:4px;">
            <span style="color:#C4623A;">Hospo</span>Search
          </div>
          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#7A7570;margin-bottom:24px;">Application Confirmation</div>
          <div style="background:#fff;border:1px solid #E8E2D8;border-radius:14px;padding:24px;">
            <p style="font-size:16px;color:#0F0E0C;margin:0 0 6px;">Hi ${(applicantName||'').split(' ')[0]},</p>
            <p style="font-size:15px;color:#3A3733;line-height:1.6;margin:0 0 18px;">
              Your application has been sent. Good luck! 🤞
            </p>
            <div style="background:#F5EDE7;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7A7570;font-weight:600;margin-bottom:4px;">Role applied for</div>
              <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#0F0E0C;">${jobTitle}</div>
              ${req.body.venueName ? `<div style="font-size:13px;color:#7A7570;margin-top:3px;">${req.body.venueName}</div>` : ''}
            </div>
            <p style="font-size:13px;color:#7A7570;line-height:1.6;margin:0 0 18px;">
              The venue will review your application and reach out directly if they'd like to move forward. You can track your applications in your HospoSearch dashboard.
            </p>
            <a href="${viewUrl}" style="display:inline-block;background:#C4623A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;">
              View my applications &rarr;
            </a>
          </div>
          <p style="font-size:12px;color:#C0BAB2;text-align:center;margin-top:24px;line-height:1.5;">
            HospoSearch · The home of hospitality careers in ANZ
          </p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HospoSearch <applications@hosposearch.com.au>',
          to: [applicantEmail],
          reply_to: 'hello@hosposearch.com.au',
          subject: `Application sent — ${jobTitle}`,
          html: candidateHtml,
        }),
      }).catch(e => console.warn('Candidate confirmation email failed:', e));
    }

    const data = await r.json();
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('notify-application error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
