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
// KNOWN AMBIGUITY: when an employer removes a live listing, handleDeleteJob()
// archives it with `active = false` and leaves `paid` true, so an archived
// listing is indistinguishable from an expired one. Fixing that needs a new
// column (e.g. `archived_at`); see docs/STATE_MACHINES.md.

export const JOB_LIFECYCLE = Object.freeze({
  LIVE: 'live',
  EXPIRED: 'expired',
  UNPUBLISHED: 'unpublished',
});

export function jobLifecycle(job) {
  if (job && job.active === false) {
    return job.paid ? JOB_LIFECYCLE.EXPIRED : JOB_LIFECYCLE.UNPUBLISHED;
  }
  return JOB_LIFECYCLE.LIVE;
}

export const isLiveJob = (job) => jobLifecycle(job) === JOB_LIFECYCLE.LIVE;
