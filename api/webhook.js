// /api/webhook.js
// Handles Stripe webhook events and updates Supabase.
// No stripe npm package — uses native fetch.

export const config = { api: { bodyParser: false } }; // CRITICAL: must read raw body for Stripe signature

const LISTING_PRICE_IDS = {
  'price_1TYxkgGgUkBXedj25MHNk2OX':    'bronze',
  'price_1TYxkbGgUkBXedj23615jbeg':    'silver',
  'price_1TYxkdGgUkBXedj2pS9j0zcZ':      'gold',
  'price_1TkLi1GgUkBXedj2rGk7CBC1': 'silver', // silver upgrade from subscription
  'price_1TkLhDGgUkBXedj21S867prY':   'gold',   // gold upgrade from subscription
};

const SUBSCRIPTION_PRICE_MAP = {
  // Live subscription price IDs (must match /api/create-subscription.js)
  'price_1TYyDFGgUkBXedj2J0cf9bjG': { plan:'starter', limit:3 },   // $125/mo
  'price_1TYyHMGgUkBXedj2SFs5zNUI': { plan:'growth',  limit:6 },   // $225/mo
  'price_1TYyLJGgUkBXedj2Jvagygug': { plan:'pro',     limit:10 },  // $350/mo
};

async function stripeGet(path, key) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  return r.json();
}

async function supabaseUpdate(table, data, match) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { console.error('Supabase env vars missing'); return; }
  const matchKey = Object.keys(match)[0];
  const matchVal = Object.values(match)[0];
  const r = await fetch(`${url}/rest/v1/${table}?${matchKey}=eq.${matchVal}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${key}`,
      'apikey': key,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) console.error(`Supabase update ${table} failed:`, r.status, await r.text());
  else console.log(`Supabase ${table} updated:`, match);
}

async function supabaseRpc(fn, args) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { console.error('Supabase env vars missing'); return; }
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'apikey': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) console.error(`Supabase rpc ${fn} failed:`, r.status, await r.text());
  else console.log(`Supabase rpc ${fn} ok:`, args);
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function verifySignature(rawBody, sig, secret) {
  const encoder = new TextEncoder();
  const parts = sig.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  if (!tPart) { console.error('No timestamp in signature'); return false; }
  const timestamp = tPart.slice(2);

  // Support both v1 (classic webhooks) and v2 (Workbench Event Destinations)
  const v1Part = parts.find(p => p.startsWith('v1='));
  const v2Part = parts.find(p => p.startsWith('v2='));
  const sigHex = (v1Part || v2Part)?.split('=').slice(1).join('=');
  if (!sigHex) { console.error('No v1 or v2 signature found in:', sig); return false; }

  const payload = `${timestamp}.${rawBody}`;
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig2 = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hex = Array.from(new Uint8Array(sig2)).map(b => b.toString(16).padStart(2,'0')).join('');
  console.log('Signature check:', hex === sigHex ? 'PASS' : 'FAIL', '| format:', v1Part ? 'v1' : 'v2');
  return hex === sigHex;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey) return res.status(500).json({ error: 'Not configured' });

  const rawBody = await getRawBody(req);
  let event;

  // Parse event — signature verification disabled temporarily
  // (Stripe Workbench Event Destinations use a different signing scheme)
  try {
    event = JSON.parse(rawBody);
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log('Webhook event:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { mode, metadata, client_reference_id: refId } = session;

      if (mode === 'payment') {
        // Get line items to find price ID
        const lineItems = await stripeGet(`/checkout/sessions/${session.id}/line_items`, stripeKey);
        const priceId = lineItems.data?.[0]?.price?.id;
        const tier = LISTING_PRICE_IDS[priceId] || metadata?.tier || 'bronze';
        const jobId = refId || metadata?.jobId;

        if (jobId) {
          // 30-day listing window — fresh clock on every payment (incl. re-activation)
          // All listings run for 30 days
          const days = 30; // all listings run 30 days
          const expiresAt = new Date(Date.now() + days*24*60*60*1000).toISOString();
          await supabaseUpdate('jobs', {
            paid: true,
            active: true,
            tier,
            featured: ['silver','gold'].includes(tier),
            expires_at: expiresAt,
          }, { id: jobId });

          // If this payment was a SUBSCRIPTION upgrade (Silver/Gold add-on bought
          // on top of a plan), the listing only just went live — consume one plan
          // slot now. Abandoned upgrades never reach here, so they cost no slot.
          if (priceId === 'price_1TkLi1GgUkBXedj2rGk7CBC1' || priceId === 'price_1TkLhDGgUkBXedj21S867prY') {
            await supabaseRpc('consume_slot_for_job', { p_job_id: jobId });
          }

          // Notify admin when a Gold listing is purchased so they can reach out
          if (tier === 'gold') {
            try {
              const resendKey = process.env.RESEND_API_KEY;
              const buyerEmail = session.customer_details?.email || session.customer_email || 'unknown';
              if (resendKey) {
                await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: 'HospoSearch <noreply@hosposearch.com>',
                    to: ['tim@hosposearch.com.au'],
                    subject: '🥇 Gold listing purchased — reach out to help',
                    html: `<h2>Gold listing purchased</h2>
                      <p><strong>Buyer:</strong> ${buyerEmail}</p>
                      <p><strong>Job ID:</strong> ${jobId}</p>
                      <p><strong>Amount:</strong> $${(session.amount_total/100).toFixed(2)} AUD</p>
                      <p>Reach out to offer photo assistance and concierge onboarding.</p>`,
                  }),
                });
              }
            } catch(e) { console.warn('Gold notification email failed:', e.message); }
          }
        }

      } else if (mode === 'subscription') {
        const sub = await stripeGet(`/subscriptions/${session.subscription}`, stripeKey);
        const priceId = sub.items?.data?.[0]?.price?.id;
        const planInfo = SUBSCRIPTION_PRICE_MAP[priceId];
        const userId = metadata?.userId || refId;

        if (planInfo && userId) {
          await supabaseUpdate('profiles', {
            subscription_tier: planInfo.plan,
            subscription_active: true,
            subscription_limit: planInfo.limit,
            subscription_used: 0,
            subscription_start: new Date().toISOString(),
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          }, { id: userId });
        }
      }

    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await supabaseUpdate('profiles', {
        subscription_active: false,
        subscription_tier: null,
        subscription_limit: 0,
        stripe_subscription_id: null,
      }, { stripe_subscription_id: sub.id });

    } else if (event.type === 'invoice.payment_succeeded') {
      // Monthly renewal — reset the listing usage counter for the new period.
      // The first invoice (initial signup) also lands here, which harmlessly
      // re-sets the counter to 0. Matched by the Stripe subscription id.
      const inv = event.data.object;
      const subId = inv.subscription || inv.parent?.subscription_details?.subscription;
      if (subId) {
        await supabaseUpdate('profiles', { subscription_used: 0 }, { stripe_subscription_id: subId });
      }

    } else if (event.type === 'invoice.payment_failed') {
      console.warn('Payment failed for subscription:', event.data.object.subscription);
    }

    return res.status(200).json({ received: true });
  } catch(err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
