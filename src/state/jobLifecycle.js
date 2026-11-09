// Job listing lifecycle.
//
// A listing's state is not stored as a field; it is derived from two database
// columns, `active` and `paid` (plus `expires_at`, which fetchJobs() sweeps into
// `active = false` once it passes).
//
//   live         active !== false                     shown on the board
//   expired      active === false && paid             ran its term, can be renewed
//   unpublished  active === false && !paid            draft that never reached payment
//
//   archived     active === false && archivedAt      employer removed it; can be relisted
//
// `archived_at` (supabase/archived-at.sql) is what tells "archived" apart from
// "expired". Until that column exists, archived listings still read as expired.

export const JOB_LIFECYCLE = Object.freeze({
  LIVE: 'live',
  ARCHIVED: 'archived',
  EXPIRED: 'expired',
  UNPUBLISHED: 'unpublished',
});

export function jobLifecycle(job) {
  if (job && job.active === false) {
    if (job.archivedAt) return JOB_LIFECYCLE.ARCHIVED;
    return job.paid ? JOB_LIFECYCLE.EXPIRED : JOB_LIFECYCLE.UNPUBLISHED;
  }
  return JOB_LIFECYCLE.LIVE;
}

export const isLiveJob = (job) => jobLifecycle(job) === JOB_LIFECYCLE.LIVE;
