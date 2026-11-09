# State machines in HospoSearch

Most of this app's behaviour is driven by state machines that were never written
down: clusters of booleans, nullable ids and magic strings whose *combination*
means something. This file lists every one found in the audit, says which are now
explicit, and records the traps in the rest. Read it before changing the flows
below.

**How to read the status column**

- **Explicit** — extracted to a pure module in `src/state/`, covered by `npm test`.
- **Documented** — still inline in `src/App.jsx`; states and transitions written
  here so you don't have to reverse-engineer them.

## 1. Extracted (explicit and tested)

### 1.1 Root screen — `src/state/rootScreen.js` — Explicit
What `<App/>` renders is a function of `recovering`, `loading`, `needsAccountType`,
`user`, `type`, `showLogin`, `showSignup` and the query string (`tier`, `login`,
`signup`, `type`). It was an ordered `if` chain; **the order is the logic**.

| # | Screen | Condition (first match wins) |
|---|--------|------------------------------|
| 1 | `recovering` | password-reset link opened |
| 2 | `loading` | restoring session and first fetch |
| 3 | `choose-account-type` | pending Google sign-in with no profile, no user |
| 4 | `login-modal` | `showLogin` or `showSignup`, no user |
| 5 | `employer-required` | user, `?tier=`, and not employer/admin |
| 6 | `signup-employer` | no user, `?tier=` |
| 7 | `login-param` | no user, `?login=1` |
| 8 | `signup-param` | no user, `?signup=1` |
| 9 | `public` | no user |
| 10 | `admin` / `employer` / `employee` | by `type` |

`src/state/state.test.js` compares the module with the original chain over 2,304
input combinations.

### 1.2 Stripe return status — `src/state/paymentReturn.js` — Explicit
`/app?payment=…` and `/app?subscription=…&plan=…` become one `paymentStatus`
string that drives the dashboard banner: `null | 'success' | 'cancelled' |
'subscription_cancelled' | 'subscription_success_<plan>'`. The values are
unchanged; parsing and the "which banner" checks now live in one place.

### 1.3 Job lifecycle — `src/state/jobLifecycle.js` — Explicit (derived)
Not stored as a field; derived from `jobs.active` and `jobs.paid`:

| State | Rule | Meaning |
|-------|------|---------|
| `live` | `active !== false` | on the board |
| `expired` | `active === false && paid` | ran its term; can be renewed |
| `unpublished` | `active === false && !paid` | draft that never reached payment |

`fetchJobs()` / `fetchMyJobs()` sweep past-`expires_at` rows to `active=false`.
The Stripe webhook (`api/webhook.js`) moves a job to paid + active with a fresh
`expires_at`.

## 2. Documented (still inline in `src/App.jsx`)

### 2.1 Employer listing composer — `EmployerDash` — highest-value next extraction
Two independent facts, both held as separate state:

- **Mode** from `editId` / `draftJobId` (must never both be set):
  `create` (neither) · `edit` (`editId`) · `complete-draft` (`draftJobId`).
  `startEdit`, `openDraftForCompletion` and `resetForm` each set/clear the pair.
- **Submit phase** from `posting`, `posted`, `checkoutJob`:
  `idle` → `saving` → (`checkout` | `posted`) → `idle`.
- **Submit route** chosen inside `post()`: trial or subscription slot (post now,
  consume a slot) · subscription Silver/Gold upgrade (draft + pay) · pay-per-
  listing (draft + pay) · completing an existing draft (always pay).

Suggested shape: a reducer owning `{ mode, id, phase, checkoutJob }` with actions
`startEdit | startDraft | submit | checkoutReady | paid | reset`, so illegal pairs
(`editId` and `draftJobId` together) cannot exist.

### 2.2 Apply flow — `JobDetail`
`showForm`, `submitting`, `done`: `closed → form → submitting → done → closed`
(auto-close after 1.8 s). Guards: dirty-form confirm on close, browser Back and
Escape; Back pushes a history entry on mount.

### 2.3 Login / sign-up / reset — `Login`, `ResetPasswordScreen`
`screen` (`login | signup`) × `mode` (`employee | employer`) plus per-form flags:
`suDone`, `rSent`, `rBusy`, `err`, `suErr`, `rErr`. Reset has its own
`busy/done` pair. Wrong-account-type is detected after sign-in, not before.

### 2.4 Session bootstrap — `App` mount effect
Procedural machine over `hs_stay_logged_in` (localStorage), `hs_temp_session`
(sessionStorage), admin detection, session restore, pending OAuth profile, and the
`hs_apply_after_login` marker (1-hour TTL). Ends in `setLoading(false)`.
`onAuthStateChange` handles `SIGNED_OUT` and `PASSWORD_RECOVERY`.

### 2.5 Account switch — `altAccount`
`{ user, type } ⇄ altAccount`; switching swaps the pair in place without a reload.

### 2.6 Application pipeline — `ApplicationsManager`, `ApplicantDetailCard`
`Sent → Viewed → Shortlisted → Interview → Offer | Not Suitable`
(`PIPELINE_STAGES`). Any stage can be set from any other; nothing enforces order.
Treat that as a product decision, not an accident, before adding guards.

### 2.7 Save-feedback flags (a dozen-plus hand-rolled copies)
`xSaving`/`xSaved` (and `sending/sent`, `posting/posted`) all implement
`idle → saving → saved → idle` (profile, bio, location, experience, avatar, links,
documents, admin edit, admin email). `useCopiedFlag` already covers the timed-flag
half. A single `useSaveStatus` hook would replace them; do it one component at a
time.

### 2.8 Gesture and media machines
`StoryViewer` (`idx`, `prog`, `sliding`), `Carousel` (`cur`, `offset`, `sliding`),
`ImageCropper` (`ratio`, `zoom`, `pos`), and pull-to-refresh
(`refreshing` + `pullDist`) repeated in `PublicBrowse`, `EmployerDash`,
`EmployeeApp` and `AdminDash`.

### 2.9 Server-side
- Stripe webhook: payment → job paid/active/tier/`expires_at`; subscription
  events → `subscription_active` / `subscription_tier`; cancellation clears them.
- `send-job-alerts` runs on a daily cron (`vercel.json`), and `notify-application`,
  `notify-abandoned` and `send-weekly-email` send email. These were not audited in
  detail.

## 3. Defects found while auditing (not changed)

Left alone on purpose: each one changes behaviour, so each needs a decision.

1. **Archived looks like expired.** `handleDeleteJob` archives a live listing with
   `active=false` and leaves `paid=true`, so the dashboard labels it **Expired**
   and offers renewal. Needs a distinguishing column (e.g. `archived_at`).
2. **Success timers navigate for you.** Three `setTimeout(… setTab("feed");
   resetForm() …)` calls fire 1.8–2.5 s after posting even if the person has moved
   on, and after unmount. Fix: track the timer in a ref and clear it on tab change
   and unmount.
3. **Failed sign-up can fake an account.** In `Login.signUp`, any Supabase error
   other than "already exists" creates a session-only user (`id: "new_<time>"`) and
   logs them in. They believe they registered; nothing is saved.
4. **Draft hand-off through a global.** `window._draftJob` passes a restored draft
   from `App` to `EmployerDash`, and `EmployerDash` deletes it *during render*.
   With `React.StrictMode` on, development double-renders can lose the draft.
5. **Dead state.** `njPosting` in `EmployerDash` is declared and never read.

## 4. Conventions for adding or changing a machine

1. Put the logic in `src/state/<name>.js` as a pure function or reducer: no React,
   no `window`, no network. Export the state names as a frozen object.
2. Add tests to `src/state/*.test.js`. When replacing existing inline logic, copy
   the old logic into the test as an oracle and compare over every input.
3. Wire it into the component with the smallest possible diff.
4. Run `npm test` and `npm run build`.
5. Update this file.
