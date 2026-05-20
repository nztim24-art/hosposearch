import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  'https://ecvatlagiskvapeqsfnu.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const TIER_LIMITS = { starter: 3, growth: 6, pro: 10 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = webhookSecret
      ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
      : JSON.parse(rawBody.toString());
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { plan, userId } = session.metadata || {};
        if (!userId || !plan) break;

        if (session.mode === 'subscription') {
          await supabase.from('profiles').update({
            subscription_tier: plan,
            subscription_active: true,
            subscription_limit: TIER_LIMITS[plan] || 3,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_start: new Date().toISOString(),
          }).eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const plan = sub.metadata?.plan;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const active = sub.status === 'active' || sub.status === 'trialing';
        await supabase.from('profiles').update({
          subscription_active: active,
          subscription_tier: active ? plan : null,
          subscription_limit: active ? (TIER_LIMITS[plan] || 3) : 0,
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase.from('profiles').update({
          subscription_active: false,
          subscription_tier: null,
          subscription_limit: 0,
          stripe_subscription_id: null,
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await supabase.from('profiles').update({
          subscription_active: false,
        }).eq('stripe_customer_id', invoice.customer);
        break;
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
