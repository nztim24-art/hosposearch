// Stripe return-URL state for the employer dashboard banner.
//
// Stripe sends people back to /app?payment=success|cancelled or
// /app?subscription=success&plan=<plan>|cancelled. App turns that into a single
// `paymentStatus` string held in state. The string values below are the existing
// ones, kept as-is so nothing that reads them changes.
//
//   null | 'success' | 'cancelled'
//        | 'subscription_cancelled'
//        | 'subscription_success_<plan>'   (<plan> may be '' if the URL had none)

const SUB_SUCCESS_PREFIX = 'subscription_success_';

export function paymentStatusFromSearch(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('payment') === 'success') return 'success';
  if (p.get('payment') === 'cancelled') return 'cancelled';
  if (p.get('subscription') === 'success') return SUB_SUCCESS_PREFIX + (p.get('plan') || '');
  if (p.get('subscription') === 'cancelled') return 'subscription_cancelled';
  return null;
}

export function isSubscriptionSuccess(status) {
  return !!status && status.startsWith(SUB_SUCCESS_PREFIX);
}

// 'subscription_success_silver' -> 'silver'. Returns '' for any other status.
export function subscriptionPlan(status) {
  return isSubscriptionSuccess(status) ? status.slice(SUB_SUCCESS_PREFIX.length) : '';
}

export function isPaymentCancelled(status) {
  return status === 'cancelled' || status === 'subscription_cancelled';
}
