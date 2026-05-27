import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  bronze: 'price_1TYxkgGgUkBXedj25MHNk2OX',
  silver: 'price_1TYxkbGgUkBXedj236i5jbeg',
  gold:   'price_1TYxkdGgUkBXedj2pS9j0zcZ',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tier, jobTitle, venueEmail, jobId, discountCode, priceId } = req.body;

    // Use explicitly passed priceId if provided, otherwise fall back to tier lookup
    const resolvedPriceId = priceId || PRICES[tier];

    if (!resolvedPriceId) {
      return res.status(400).json({ error: 'Invalid listing tier' });
    }

    const origin = req.headers.origin || 'https://hosposearch.com.au';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      automatic_tax: { enabled: true },
      customer_email: venueEmail || undefined,
      metadata: { tier: tier||'bronze', jobTitle: jobTitle || '', jobId: jobId || '' },
      payment_intent_data: {
        metadata: { tier: tier||'bronze', jobTitle: jobTitle || '', jobId: jobId || '' },
        statement_descriptor: 'HOSPOSEARCH',
      },
      success_url: `${origin}/app?payment=success&tier=${tier||'bronze'}&jobId=${jobId || ''}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app?payment=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
