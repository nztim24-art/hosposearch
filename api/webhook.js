// /api/webhook.js
// Handles Stripe webhook events and updates Supabase accordingly.
// Verifies the Stripe signature, then processes:
//   - checkout.session.completed  → activate listing OR activate subscription
//   - customer.subscription.deleted → deactivate subscription

import { createClient } from '@supabase/supabase-js';

const LISTING_PRICE_IDS = new Set([
  'price_1TfwBfGkG9EGtGJgBv341e2n', // Bronze $50
  'price_1TfwBlGkG9EGtGJgGxDjQEhS', // Silver $70
  'price_1TfwBrGkG9EGtGJg6O8z5oAu', // Gold $100
]);

const SUBSCRIPTION_PRICE_MAP = {
  'price_1TfwByGkG9EGtGJg9FeaYFE2': { plan:'starter', limit:3 },
  'price_1TfwC5GkG9EGtGJglmXiYPOV': { plan:'growth',  limit:6 },
  'price_1TfwCAGkG9EGtGJgDhgMbdHb': { plan:'pro',     limit:10 },
};

const TIER_FROM_PRICE = {
  'price_1TfwBfGkG9EGtGJgBv341e2n': 'bronze',
  'price_1TfwBlGkG9EGtGJgGxDjQEhS': 'silver',
  'price_1TfwBrGkG9EGtGJg6O8z5oAu': 'gold',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = await import('stripe').then(m => m.default(stripeKey));

  // Verify webhook signature if secret is set
  let event;
  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    const rawBody = await getRawBody(req);
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }
  } else {
    // No webhook secret — accept the event body directly (for testing)
    event = req.body;
  }

  console.log('Webhook event:', event.type);

  try {
    const supabase = getSupabase();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { metadata, mode, customer, subscription: subId, client_reference_id: jobId } = session;

      if (mode === 'payment') {
        // ── One-time listing payment ─────────────────────────────────────────
        const priceId = session.line_items?.data?.[0]?.price?.id
          || await getSessionPriceId(stripe, session.id);
        const tier = TIER_FROM_PRICE[priceId] || metadata?.tier || 'bronze';
        const featuredTiers = ['silver','gold'];

        if (jobId) {
          const { error } = await supabase.from('jobs').update({
            paid: true,
            active: true,
            tier: tier,
            featured: featuredTiers.includes(tier),
          }).eq('id', jobId);

          if (error) console.error('Failed to activate job:', error);
          else console.log(`Job ${jobId} activated as ${tier}`);
        } else {
          // jobId not in client_reference_id — try metadata
          const metaJobId = metadata?.jobId;
          if (metaJobId) {
            await supabase.from('jobs').update({
              paid: true, active: true, tier,
              featured: featuredTiers.includes(tier),
            }).eq('id', metaJobId);
          }
        }

      } else if (mode === 'subscription') {
        // ── Subscription payment ─────────────────────────────────────────────
        // Get the price ID from the subscription object
        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price?.id;
        const planInfo = SUBSCRIPTION_PRICE_MAP[priceId];
        const userId = metadata?.userId || client_reference_id;

        if (planInfo && userId) {
          const { error } = await supabase.from('profiles').update({
            subscription_tier: planInfo.plan,
            subscription_active: true,
            subscription_limit: planInfo.limit,
            stripe_customer_id: customer,
            stripe_subscription_id: subId,
          }).eq('id', userId);

          if (error) console.error('Failed to activate subscription:', error);
          else console.log(`Subscription ${planInfo.plan} activated for user ${userId}`);
        }
      }

    } else if (event.type === 'customer.subscription.deleted') {
      // ── Subscription cancelled ───────────────────────────────────────────
      const sub = event.data.object;
      const supabase = getSupabase();

      const { error } = await supabase.from('profiles').update({
        subscription_active: false,
        subscription_tier: null,
        subscription_limit: 0,
        stripe_subscription_id: null,
      }).eq('stripe_subscription_id', sub.id);

      if (error) console.error('Failed to deactivate subscription:', error);
      else console.log(`Subscription ${sub.id} deactivated`);

    } else if (event.type === 'invoice.payment_failed') {
      // ── Subscription payment failed ──────────────────────────────────────
      const invoice = event.data.object;
      console.warn(`Payment failed for subscription ${invoice.subscription}`);
      // Could notify the employer here via email — leaving as a log for now
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}

// Helper: get line item price ID from the session (requires expand in Stripe API)
async function getSessionPriceId(stripe, sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });
    return session.line_items?.data?.[0]?.price?.id || null;
  } catch {
    return null;
  }
}

// Helper: read raw body for webhook signature verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
