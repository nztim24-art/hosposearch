// /api/create-checkout.js
// Creates a Stripe Checkout session for a one-time job listing payment.
// Always uses server-side price IDs regardless of what the frontend sends.

const PRICE_IDS = {
  bronze: 'price_1TfwBfGkG9EGtGJgBv341e2n',  // $50 AUD
  silver: 'price_1TfwBlGkG9EGtGJgGxDjQEhS',   // $70 AUD
  gold:   'price_1TfwBrGkG9EGtGJg6O8z5oAu',   // $100 AUD
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tier, jobTitle, venueEmail, jobId } = req.body || {};

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
