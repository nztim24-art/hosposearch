// /api/create-checkout.js
// Creates a Stripe Checkout session for a one-time job listing payment.

const PRICE_IDS = {
  bronze: 'price_1TYxkgGgUkBXedj25MHNk2OX',  // $50
  silver: 'price_1TYxkbGgUkBXedj236i5jbeg',   // $70
  gold:   'price_1TYxkdGgUkBXedj2pS9j0zcZ',   // $100
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tier, jobTitle, venueEmail, jobId, priceId } = req.body || {};

  // Resolve price ID — accept either a tier name or a direct priceId
  const resolvedPriceId = priceId || PRICE_IDS[tier?.toLowerCase()];

  if (!resolvedPriceId) {
    return res.status(400).json({ error: `Unknown tier: ${tier}` });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Payment service not configured' });
  }

  const origin = req.headers.origin || 'https://www.hosposearch.com.au';
  const successUrl = `${origin}/app?payment=success&tier=${tier || 'bronze'}&jobId=${jobId || ''}`;
  const cancelUrl  = `${origin}/app?payment=cancelled`;

  try {
    const stripe = await import('stripe').then(m => m.default(stripeKey));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      customer_email: venueEmail || undefined,
      client_reference_id: jobId || undefined,
      metadata: {
        tier: tier || 'bronze',
        jobTitle: jobTitle || '',
        jobId: jobId || '',
        venueEmail: venueEmail || '',
      },
      success_url: successUrl,
      cancel_url:  cancelUrl,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe create-checkout error:', err.message);
    return res.status(502).json({ error: 'Stripe error', detail: err.message });
  }
}
