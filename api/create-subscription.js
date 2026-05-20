import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUBSCRIPTION_PRICES = {
  starter: 'price_1TYyDFGgUkBXedj2J0cf9bjG',
  growth:  'price_1TYyHMGgUkBXedj2SFs5zNUI',
  pro:     'price_1TYyLJGgUkBXedj2Jvagygug',
};

const TIER_LIMITS = {
  starter: 3,
  growth:  6,
  pro:     10,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, userEmail, userId } = req.body;

    if (!SUBSCRIPTION_PRICES[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const origin = req.headers.origin || 'https://hosposearch.com.au';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: SUBSCRIPTION_PRICES[plan], quantity: 1 }],
      automatic_tax: { enabled: true },
      customer_email: userEmail || undefined,
      metadata: { plan, userId: userId || '', limit: TIER_LIMITS[plan] },
      subscription_data: {
        metadata: { plan, userId: userId || '', limit: TIER_LIMITS[plan] },
      },
      success_url: `${origin}/app?subscription=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app?subscription=cancelled`,
      billing_address_collection: 'auto',
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe subscription error:', err);
    res.status(500).json({ error: err.message });
  }
}
