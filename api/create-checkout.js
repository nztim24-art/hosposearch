// /api/create-checkout.js
// Creates a Stripe Checkout session for a one-time job listing payment.
// Always uses server-side price IDs regardless of what the frontend sends.

const PRICE_IDS = {
  bronze:         'price_1TYxkgGgUkBXedj25MHNk2OX',  // $50 AUD
  silver:         'price_1TYxkbGgUkBXedj23615jbeg',  // $70 AUD
  gold:           'price_1TYxkdGgUkBXedj2p59j0zcZ',  // $100 AUD
  silver_upgrade: 'price_1TkLi1GgUkBXedj2rGk7CBC1',  // $20 AUD
  gold_upgrade:   'price_1TkLhDGgUkBXedj21S867prY',  // $50 AUD
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tier, jobTitle, venueEmail, jobId, discountPct } = req.body || {};

  // 100% discount — skip Stripe, activate job directly via Supabase
  if (Number(discountPct) >= 100 && jobId) {
    try {
      const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_KEY;
      const days = tier === 'bronze' ? 15 : 30;
      const expiresAt = new Date(Date.now() + days*24*60*60*1000).toISOString();
      await fetch(`${sbUrl}/rest/v1/jobs?id=eq.${jobId}`, {
        method: 'PATCH',
        headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ paid: true, active: true, tier: tier || 'bronze', featured: ['silver','gold'].includes(tier), expires_at: expiresAt }),
      });
      const origin = req.headers.origin || 'https://www.hosposearch.com.au';
      return res.status(200).json({ free: true, url: `${origin}/app?payment=success&tier=${tier || 'bronze'}&jobId=${jobId}` });
    } catch(e) {
      return res.status(500).json({ error: 'Free activation failed', detail: e.message });
    }
  }

  // Always resolve from server-side map — never trust client-sent price IDs
  const resolvedPriceId = PRICE_IDS[tier?.toLowerCase()] || PRICE_IDS.bronze;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Payment service not configured' });

  const origin = req.headers.origin || 'https://www.hosposearch.com.au';

  try {
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][price]', resolvedPriceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/app?payment=success&tier=${tier || 'bronze'}&jobId=${jobId || ''}`);
    params.append('cancel_url', `${origin}/app?payment=cancelled`);
    params.append('allow_promotion_codes', 'true');
    if (venueEmail) params.append('customer_email', venueEmail);
    if (jobId) params.append('client_reference_id', jobId);
    if (jobId) params.append('metadata[jobId]', jobId);
    if (tier) params.append('metadata[tier]', tier);
    if (jobTitle) params.append('metadata[jobTitle]', jobTitle?.slice(0, 500));

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();
    if (!response.ok) {
      console.error('Stripe error:', session.error?.message);
      return res.status(502).json({ error: 'Stripe error', detail: session.error?.message });
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('create-checkout error:', err.message);
    return res.status(502).json({ error: 'Internal error', detail: err.message });
  }
}
