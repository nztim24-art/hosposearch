export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { employerEmail, employerName, applicantName, jobTitle, jobId } = req.body;
  if (!employerEmail) return res.status(400).json({ error: 'Missing employer email' });

  try {
    await fetch('https://formspree.io/f/xwpkgvqj', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: employerEmail,
        _replyto: 'hello@hosposearch.com.au',
        _subject: `🔔 New application for ${jobTitle} — HospoSearch`,
        message: `Hi ${employerName||'there'},

You have a new application on HospoSearch!

Role: ${jobTitle}
Applicant: ${applicantName}

Log in to review the application:
https://hosposearch.com.au/app

— The HospoSearch Team`,
      }),
    });
    res.status(200).json({ ok: true });
  } catch(err) {
    console.error('Notify application error:', err);
    res.status(500).json({ error: err.message });
  }
}
