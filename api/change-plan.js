// /api/change-plan.js
// Switches an EXISTING subscriber to a different plan using Stripe proration.
// They pay the prorated difference immediately, and are billed the new rate
// each cycle thereafter. New (not-yet-subscribed) users still go through
// /api/create-subscription (a normal Checkout session) instead.

const PRICE_IDS = {
  starter: 'price_1TYyDFGgUkBXedj2J0cf9bjG',  // $125/mo AUD
  growth:  'price_1TYyHMGgUkBXedj2SFs5zNUI',  // $225/mo AUD
  pro:     'price_1TYyLJGgUkBXedj2Jvagygug',  // $350/mo AUD
};
const PLAN_LIMITS = { starter: 3, growth: 6, pro: 10 };

async function stripeGet(path, key) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { 'Authorization': `Bearer ${key}` },
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, plan } = req.body || {};
  const planKey = plan?.toLowerCase();
  const newPriceId = PRICE_IDS[planKey];
  if (!userId || !newPriceId) return res.status(400).json({ error: `Invalid request: ${plan}` });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!stripeKey || !sbUrl || !sbKey) return res.status(500).json({ error: 'Service not configured' });

  try {
    // 1. Find the subscriber's Stripe subscription id.
    const profRes = await fetch(
      `${sbUrl}/rest/v1/profiles?id=eq.${userId}&select=stripe_subscription_id,subscription_tier`,
      { headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey } }
    );
    const profs = await profRes.json();
    const prof = Array.isArray(profs) ? profs[0] : null;
    const subId = prof?.stripe_subscription_id;
    if (!subId) return res.status(400).json({ error: 'No active subscription found. Please subscribe first.' });
    if (prof?.subscription_tier === planKey) return res.status(200).json({ ok: true, unchanged: true });

    // 2. Read the current subscription item id.
    const sub = await stripeGet(`/subscriptions/${subId}`, stripeKey);
    const itemId = sub?.items?.data?.[0]?.id;
    if (!itemId) return res.status(502).json({ error: 'Could not read current subscription' });

    // 3. Swap the item to the new price; prorate the difference and invoice now.
    const params = new URLSearchParams();
    params.append('items[0][id]', itemId);
    params.append('items[0][price]', newPriceId);
    params.append('proration_behavior', 'always_invoice');
    const upRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const updated = await upRes.json();
    if (!upRes.ok) {
      console.error('Stripe change-plan error:', updated.error?.message);
      return res.status(502).json({ error: 'Stripe error', detail: updated.error?.message });
    }

    // 4. Reflect the new plan on the profile immediately. (The webhook's
    //    invoice.payment_succeeded will also reset the monthly usage counter.)
    await fetch(`${sbUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ subscription_tier: planKey, subscription_limit: PLAN_LIMITS[planKey] }),
    });

    return res.status(200).json({ ok: true, plan: planKey });
  } catch (err) {
    console.error('change-plan error:', err.message);
    return res.status(502).json({ error: 'Internal error', detail: err.message });
  }
}
