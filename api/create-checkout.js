// /api/create-checkout.js
// Creates a Stripe Checkout session for a one-time job listing payment.
// Validates discount codes server-side and applies them to the Stripe amount.

const BASE_PRICES = {
  bronze:         5000,  // $50 AUD in cents
  silver:         7000,  // $70 AUD in cents
  gold:          10000,  // $100 AUD in cents
  silver_upgrade: 2000,  // $20 AUD in cents
  gold_upgrade:   5000,  // $50 AUD in cents
};

const PRICE_IDS = {
  bronze:         'price_1TYxkgGgUkBXedj25MHNk2OX',
  silver:         'price_1TYxkbGgUkBXedj23615jbeg',
  gold:           'price_1TYxkdGgUkBXedj2p59j0zcZ',
  silver_upgrade: 'price_1TkLi1GgUkBXedj2rGk7CBC1',
  gold_upgrade:   'price_1TkLhDGgUkBXedj21S867prY',
};

const TIER_NAMES = {
  bronze: 'Bronze Listing — HospoSearch',
  silver: 'Silver Listing — HospoSearch',
  gold:   'Gold Listing — HospoSearch',
  silver_upgrade: 'Silver Upgrade — HospoSearch',
  gold_upgrade:   'Gold Upgrade — HospoSearch',
};

async function validateCode(code) {
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey || !code) return null;
  try {
    const r = await fetch(`${sbUrl}/rest/v1/discount_codes?code=eq.${encodeURIComponent(code.toUpperCase())}&active=eq.true&select=*`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }
    });
    const data = await r.json();
    if (!data?.length) return null;
    const c = data[0];
    // Check not expired
    if (c.expires_at && new Date(c.expires_at) < new Date()) return null;
    // Check uses remaining
    if (c.max_uses && c.used >= c.max_uses) return null;
    return c;
  } catch(e) { return null; }
}

async function incrementCodeUsage(code) {
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  try {
    await fetch(`${sbUrl}/rest/v1/rpc/increment_code_usage`, {
      method: 'POST',
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_val: code.toUpperCase() })
    });
  } catch(e) { console.warn('Failed to increment code usage:', e.message); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tier, jobTitle, venueEmail, jobId, discountCode } = req.body || {};

  const tierKey = tier?.toLowerCase() || 'bronze';
  const baseAmountCents = BASE_PRICES[tierKey] || BASE_PRICES.bronze;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Payment service not configured' });

  const origin = req.headers.origin || 'https://www.hosposearch.com.au';

  // Validate discount code server-side
  let discountPct = 0;
  let validCode = null;
  if (discountCode) {
    validCode = await validateCode(discountCode);
    if (validCode) discountPct = validCode.pct || 0;
  }

  const discountCents = Math.floor(baseAmountCents * (discountPct / 100));
  const finalAmountCents = baseAmountCents - discountCents;

  // 100% discount or $0 — skip Stripe, activate directly
  if (finalAmountCents <= 0 && jobId) {
    try {
      const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_KEY;
      const days = tierKey === 'bronze' ? 15 : 30;
      const expiresAt = new Date(Date.now() + days*24*60*60*1000).toISOString();
      await fetch(`${sbUrl}/rest/v1/jobs?id=eq.${jobId}`, {
        method: 'PATCH',
        headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ paid: true, active: true, tier: tierKey, featured: ['silver','gold'].includes(tierKey), expires_at: expiresAt }),
      });
      if (validCode) await incrementCodeUsage(discountCode);
      return res.status(200).json({ free: true, url: `${origin}/app?payment=success&tier=${tierKey}&jobId=${jobId}` });
    } catch(e) {
      return res.status(500).json({ error: 'Free activation failed', detail: e.message });
    }
  }

  try {
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/app?payment=success&tier=${tierKey}&jobId=${jobId || ''}`);
    params.append('cancel_url', `${origin}/app?payment=cancelled`);
    if (venueEmail) params.append('customer_email', venueEmail);
    if (jobId) params.append('client_reference_id', jobId);
    if (jobId) params.append('metadata[jobId]', jobId);
    if (tierKey) params.append('metadata[tier]', tierKey);
    if (jobTitle) params.append('metadata[jobTitle]', jobTitle?.slice(0, 500));
    if (discountPct > 0 && validCode) params.append('metadata[discountCode]', discountCode.toUpperCase());

    // Use price_data with discounted amount, or fixed price ID if no discount
    if (discountPct > 0 && validCode) {
      params.append('line_items[0][price_data][currency]', 'aud');
      params.append('line_items[0][price_data][unit_amount]', finalAmountCents.toString());
      params.append('line_items[0][price_data][product_data][name]', TIER_NAMES[tierKey] || 'HospoSearch Listing');
      params.append('line_items[0][quantity]', '1');
    } else {
      params.append('line_items[0][price]', PRICE_IDS[tierKey] || PRICE_IDS.bronze);
      params.append('line_items[0][quantity]', '1');
      params.append('allow_promotion_codes', 'true');
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const session = await response.json();
    if (!response.ok) {
      console.error('Stripe error:', session.error?.message);
      return res.status(502).json({ error: 'Stripe error', detail: session.error?.message });
    }

    // Increment code usage after successful session creation
    if (validCode) await incrementCodeUsage(discountCode);

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('create-checkout error:', err.message);
    return res.status(502).json({ error: 'Internal error', detail: err.message });
  }
}
