export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, jobTitle, tier } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

  try {
    // Send notification email to hello@hosposearch.com.au via Resend or simple fetch
    const emailBody = `
New abandoned listing notification:

Email: ${email}
Job Title: ${jobTitle || 'Not provided'}
Tier selected: ${tier || 'Not provided'}
Time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}

This employer started a listing but did not complete payment.
Follow up at: ${email}
    `.trim();

    // Use Formspree as the email relay (free, no backend needed)
    await fetch('https://formspree.io/f/xwpkgvqj', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hello@hosposearch.com.au',
        _replyto: email,
        _subject: `🔔 Abandoned listing: ${jobTitle || 'Unknown role'} (${tier || 'unknown tier'})`,
        message: emailBody,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Notify error:', err);
    res.status(500).json({ error: err.message });
  }
}
