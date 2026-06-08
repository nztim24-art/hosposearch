// /api/create-subscription.js
// Creates a Stripe Checkout session for a monthly subscription plan.
// Redirects to Stripe hosted checkout, then back to the app on success/cancel.

const PRICE_IDS = {
  starter: 'price_1TfwByGkG9EGtGJg9FeaYFE2',  // $99/mo
  growth:  'price_1TfwC5GkG9EGtGJglmXiYPOV',   // $199/mo
  pro:     'price_1TfwCAGkG9EGtGJgDhgMbdHb',   // $399/mo
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, userEmail, userId, priceId } = req.body || {};

  // Resolve price ID — accept either a plan name or a direct priceId
  const resolvedPriceId = priceId || PRICE_IDS[plan?.toLowerCase()];

  if (!resolvedPriceId) {
    return res.status(400).json({ error: `Unknown plan: ${plan}` });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Payment service not configured' });
  }

  const origin = req.headers.origin || 'https://www.hosposearch.com.au';
  const successUrl = `${origin}/app?subscription=success&plan=${plan || 'subscription'}`;
  const cancelUrl  = `${origin}/app?subscription=cancelled`;

  try {
    const stripe = await import('stripe').then(m => m.default(stripeKey));

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      customer_email: userEmail || undefined,
      client_reference_id: userId || undefined,
      metadata: {
        plan: plan || 'subscription',
        userId: userId || '',
        userEmail: userEmail || '',
      },
      success_url: successUrl,
      cancel_url:  cancelUrl,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe create-subscription error:', err.message);
    return res.status(502).json({ error: 'Stripe error', detail: err.message });
  }
}
