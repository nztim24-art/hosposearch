// Run with: npm test
// Zero dependencies — uses Node's built-in test runner.
//
// Each machine is checked against the ORIGINAL inline logic from src/App.jsx
// (copied below as "legacy*") over every input combination, so extracting the
// logic is proven not to change behaviour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRootScreen, ROOT_SCREENS } from './rootScreen.js';
import {
  paymentStatusFromSearch, isSubscriptionSuccess, subscriptionPlan, isPaymentCancelled,
} from './paymentReturn.js';
import { jobLifecycle, isLiveJob, JOB_LIFECYCLE } from './jobLifecycle.js';

// ── Root screen ────────────────────────────────────────────────────────────

// Verbatim order of the old `if` chain in App()'s render.
function legacyRootScreen({ recovering, loading, needsAccountType, user, type, showLogin, showSignup, search }) {
  const q = new URLSearchParams(search);
  if (recovering) return 'recovering';
  if (loading) return 'loading';
  if (needsAccountType && !user) return 'choose-account-type';
  if ((showLogin || showSignup) && !user) return 'login-modal';
  const _tierParam = q.get('tier');
  if (user && _tierParam && type !== 'employer' && type !== 'admin') return 'employer-required';
  if (!user && _tierParam) return 'signup-employer';
  const _loginParam = q.get('login') === '1';
  if (!user && _loginParam) return 'login-param';
  const _signupParam = q.get('signup') === '1';
  if (!user && _signupParam) return 'signup-param';
  if (!user) return 'public';
  if (type === 'admin') return 'admin';
  if (type === 'employer') return 'employer';
  return 'employee';
}

test('root screen: identical to the legacy if-chain for every input combination', () => {
  const bools = [true, false];
  const searches = ['', '?tier=gold', '?tier=', '?login=1', '?login=0', '?signup=1',
    '?login=1&signup=1', '?tier=gold&login=1', '?type=employer&signup=1'];
  let n = 0;
  for (const recovering of bools)
  for (const loading of bools)
  for (const needsAccountType of [null, { name: 'x' }])
  for (const user of [null, { id: 'u1' }])
  for (const type of [null, 'admin', 'employer', 'employee'])
  for (const showLogin of bools)
  for (const showSignup of bools)
  for (const search of searches) {
    const input = { recovering, loading, needsAccountType, user, type, showLogin, showSignup, search };
    assert.equal(resolveRootScreen(input).name, legacyRootScreen(input), JSON.stringify(input));
    n++;
  }
  assert.equal(n, 2 * 2 * 2 * 2 * 4 * 2 * 2 * 9);
});

test('root screen: only the declared screens are ever returned', () => {
  const valid = new Set(Object.values(ROOT_SCREENS));
  assert.ok(valid.has(resolveRootScreen({ user: null, search: '' }).name));
  assert.ok(valid.has(resolveRootScreen({ user: { id: 1 }, type: 'weird', search: '' }).name));
});

test('root screen: spot checks that document intent', () => {
  const base = { recovering: false, loading: false, needsAccountType: null, user: null, type: null, showLogin: false, showSignup: false, search: '' };
  assert.equal(resolveRootScreen(base).name, 'public');
  assert.equal(resolveRootScreen({ ...base, recovering: true, loading: true }).name, 'recovering');
  assert.equal(resolveRootScreen({ ...base, user: { id: 1 }, type: 'employee', search: '?tier=gold' }).name, 'employer-required');
  assert.equal(resolveRootScreen({ ...base, user: { id: 1 }, type: 'employer', search: '?tier=gold' }).name, 'employer');
  assert.equal(resolveRootScreen({ ...base, user: { id: 1 }, type: 'admin' }).name, 'admin');
});

// ── Payment return ─────────────────────────────────────────────────────────

function legacyPaymentStatus(search) {
  const params = new URLSearchParams(search);
  if (params.get('payment') === 'success') return 'success';
  else if (params.get('payment') === 'cancelled') return 'cancelled';
  else if (params.get('subscription') === 'success') return 'subscription_success_' + (params.get('plan') || '');
  else if (params.get('subscription') === 'cancelled') return 'subscription_cancelled';
  return null;
}

test('payment return: identical to the legacy parsing for every URL shape', () => {
  const payment = ['', 'payment=success', 'payment=cancelled', 'payment=other'];
  const subscription = ['', 'subscription=success', 'subscription=cancelled', 'subscription=other'];
  const plan = ['', 'plan=silver', 'plan=gold', 'plan='];
  for (const a of payment) for (const b of subscription) for (const c of plan) {
    const search = '?' + [a, b, c].filter(Boolean).join('&');
    assert.equal(paymentStatusFromSearch(search), legacyPaymentStatus(search), search);
  }
  assert.equal(paymentStatusFromSearch(''), null);
});

test('payment return: banner helpers match the old inline expressions', () => {
  for (const s of [null, 'success', 'cancelled', 'subscription_cancelled',
    'subscription_success_', 'subscription_success_silver', 'subscription_success_gold']) {
    assert.equal(isSubscriptionSuccess(s), !!(s && s.startsWith('subscription_success_')), String(s));
    assert.equal(isPaymentCancelled(s), s === 'cancelled' || s === 'subscription_cancelled', String(s));
    if (s && s.startsWith('subscription_success_')) {
      assert.equal(subscriptionPlan(s), s.replace('subscription_success_', ''), s);
    } else {
      assert.equal(subscriptionPlan(s), '');
    }
  }
});

// ── Job lifecycle ──────────────────────────────────────────────────────────

test('job lifecycle: matches the old active/paid checks for every combination', () => {
  for (const active of [undefined, null, true, false])
  for (const paid of [undefined, null, true, false, 1, 0]) {
    const job = { active, paid };
    // old: mine = active !== false ; expiredMine = active === false ; label = paid ? Expired : Unpublished
    assert.equal(isLiveJob(job), active !== false, JSON.stringify(job));
    assert.equal(jobLifecycle(job) !== JOB_LIFECYCLE.LIVE, active === false, JSON.stringify(job));
    if (active === false) {
      assert.equal(jobLifecycle(job), paid ? 'expired' : 'unpublished', JSON.stringify(job));
    }
  }
  assert.equal(isLiveJob(undefined), true); // matches `undefined?.active !== false` style guards
});

test('job lifecycle: archived is only reported when archivedAt is set and the job is inactive', () => {
  assert.equal(jobLifecycle({ active: false, paid: true, archivedAt: 1700000000000 }), 'archived');
  assert.equal(jobLifecycle({ active: false, paid: false, archivedAt: 1700000000000 }), 'archived');
  assert.equal(jobLifecycle({ active: false, paid: true, archivedAt: null }), 'expired');
  assert.equal(jobLifecycle({ active: true, paid: true, archivedAt: 1700000000000 }), 'live'); // relisted
  assert.equal(isLiveJob({ active: false, archivedAt: 1 }), false);
});
