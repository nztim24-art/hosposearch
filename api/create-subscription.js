// /api/create-subscription.js
// Creates a Stripe Checkout session for a monthly subscription.
// Uses Stripe REST API directly — no stripe npm package needed.

const PRICE_IDS = {
  starter: 'price_1TYyDFGgUkBXedj2J0cf9bjG',  // $125/mo AUD
  growth:  'price_1TYyHMGgUkBXedj2SFs5zNUI',   // $225/mo AUD
  pro:     'price_1TYyLJGgUkBXedj2Jvagygug',   // $350/mo AUD
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, userEmail, userId, priceId } = req.body || {};
  const resolvedPriceId = priceId || PRICE_IDS[plan?.toLowerCase()];
  if (!resolvedPriceId) return res.status(400).json({ error: `Unknown plan: ${plan}` });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Payment service not configured' });

  const origin = req.headers.origin || 'https://www.hosposearch.com.au';

  try {
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', resolvedPriceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/app?subscription=success&plan=${plan || 'subscription'}`);
    params.append('cancel_url', `${origin}/app?subscription=cancelled`);
    params.append('allow_promotion_codes', 'true');
    if (userEmail) params.append('customer_email', userEmail);
    if (userId) params.append('client_reference_id', userId);
    if (plan) params.append('metadata[plan]', plan);
    if (userId) params.append('metadata[userId]', userId);

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
    console.error('create-subscription error:', err.message);
    return res.status(502).json({ error: 'Internal error', detail: err.message });
  }
}
