// Root screen state machine for <App/> (src/App.jsx).
//
// Which top-level screen the visitor sees is a pure function of a handful of
// flags plus the URL query string. It used to be an ordered chain of `if`s
// inside App's render; the ORDER is the logic, so it lives here where it can be
// read and tested in one place.
//
// Rules are evaluated top to bottom and the first match wins. Do not reorder
// without updating src/state/rootScreen.test.js and docs/STATE_MACHINES.md.

export const ROOT_SCREENS = Object.freeze({
  RECOVERING: 'recovering',                   // password-reset link opened
  LOADING: 'loading',                         // restoring session + first fetch
  CHOOSE_ACCOUNT_TYPE: 'choose-account-type', // new Google sign-in, no profile yet
  LOGIN_MODAL: 'login-modal',                 // "Log in"/"Sign up" from PublicBrowse
  EMPLOYER_REQUIRED: 'employer-required',     // job seeker followed a ?tier= post link
  SIGNUP_EMPLOYER: 'signup-employer',         // logged out + ?tier=
  LOGIN_PARAM: 'login-param',                 // logged out + ?login=1
  SIGNUP_PARAM: 'signup-param',               // logged out + ?signup=1
  PUBLIC: 'public',                           // logged out, browsing jobs
  ADMIN: 'admin',
  EMPLOYER: 'employer',
  EMPLOYEE: 'employee',
});

/**
 * @param {object}  s
 * @param {boolean} s.recovering
 * @param {boolean} s.loading
 * @param {*}       s.needsAccountType  pending OAuth session without a profile, or null
 * @param {*}       s.user              signed-in user object, or null
 * @param {string}  s.type              'admin' | 'employer' | 'employee' | null
 * @param {boolean} s.showLogin
 * @param {boolean} s.showSignup
 * @param {string}  s.search            window.location.search
 * @returns {{ name: string }}          one of ROOT_SCREENS
 */
export function resolveRootScreen({
  recovering, loading, needsAccountType, user, type, showLogin, showSignup, search = '',
}) {
  const params = new URLSearchParams(search);
  const tier = params.get('tier');

  let name;
  if (recovering) name = ROOT_SCREENS.RECOVERING;
  else if (loading) name = ROOT_SCREENS.LOADING;
  else if (needsAccountType && !user) name = ROOT_SCREENS.CHOOSE_ACCOUNT_TYPE;
  else if ((showLogin || showSignup) && !user) name = ROOT_SCREENS.LOGIN_MODAL;
  else if (user && tier && type !== 'employer' && type !== 'admin') name = ROOT_SCREENS.EMPLOYER_REQUIRED;
  else if (!user && tier) name = ROOT_SCREENS.SIGNUP_EMPLOYER;
  else if (!user && params.get('login') === '1') name = ROOT_SCREENS.LOGIN_PARAM;
  else if (!user && params.get('signup') === '1') name = ROOT_SCREENS.SIGNUP_PARAM;
  else if (!user) name = ROOT_SCREENS.PUBLIC;
  else if (type === 'admin') name = ROOT_SCREENS.ADMIN;
  else if (type === 'employer') name = ROOT_SCREENS.EMPLOYER;
  else name = ROOT_SCREENS.EMPLOYEE;

  return { name };
}
