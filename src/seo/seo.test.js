// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  jobGroups, parseLandingSlug, jobMatchesLanding, landingCopy, landingIndex, relatedLandings,
  clip, jobTitleTag, jobDescriptionTag, fromRow,
} from './shared.js'

const row = (o) => fromRow({ id: o.id || '00000000-0000-4000-8000-000000000001', created_at: '2026-11-01T00:00:00Z', country: 'Australia', ...o })
const JOBS = [
  row({ id: 'a', title: 'Chef de Partie', venue: 'Arkhé', city: 'Adelaide', state: 'South Australia', short: 'One-MICHELIN-star open-flame restaurant.', salary: '$70,000 – $80,000', type: 'Full-time' }),
  row({ id: 'b', title: 'Section Waiter', venue: 'Arkhé', city: 'Adelaide', short: 'Join the MICHELIN starred floor team.' }),
  row({ id: 'c', title: 'Sous Chef', venue: 'Three Blue Ducks', city: 'Burradoo', full_desc: '<p>Two-hatted farm restaurant.</p>' }),
  row({ id: 'd', title: 'Bartender', venue: 'The Caterpillar Club', city: 'Sydney CBD', short: 'Late-night cocktail bar. Hats off to the team.' }),
  row({ id: 'e', title: 'Head Chef', venue: 'Pavilion', city: 'Queenstown', country: 'New Zealand', short: 'Newly hatted venue.', salary: '$90,000 – $100,000 NZD per year' }),
]

test('role groups are unchanged and come first; awards are detected from the whole listing', () => {
  assert.deepEqual(jobGroups(JOBS[0]), ['chef', 'michelin-restaurant'])
  assert.deepEqual(jobGroups(JOBS[1]), ['front-of-house', 'michelin-restaurant'])
  assert.deepEqual(jobGroups(JOBS[2]), ['chef', 'hatted-restaurant'])
  assert.deepEqual(jobGroups(JOBS[3]), ['bartender']) // "Hats off" is not a hatted restaurant
  assert.deepEqual(jobGroups(JOBS[4]), ['chef', 'hatted-restaurant'])
})

test('landing slugs: existing ones still parse, award ones are new', () => {
  assert.deepEqual(parseLandingSlug('chef-jobs'), { group: 'chef', place: null })
  assert.deepEqual(parseLandingSlug('chef-jobs-sydney'), { group: 'chef', place: 'sydney' })
  assert.deepEqual(parseLandingSlug('hospitality-jobs-new-zealand'), { group: 'hospitality', place: 'new-zealand' })
  assert.equal(parseLandingSlug('hospitality-jobs'), null)
  assert.equal(parseLandingSlug('nonsense'), null)
  assert.deepEqual(parseLandingSlug('michelin-restaurant-jobs'), { group: 'michelin-restaurant', place: null })
  assert.deepEqual(parseLandingSlug('hatted-restaurant-jobs-australia'), { group: 'hatted-restaurant', place: 'australia' })
})

test('award landing pages list the right jobs and are linked and in the index', () => {
  const m = { group: 'michelin-restaurant', place: null }
  assert.deepEqual(JOBS.filter(j => jobMatchesLanding(j, m)).map(j => j.id), ['a', 'b'])
  const idx = landingIndex(JOBS)
  assert.deepEqual(idx.awards.map(a => [a.path, a.count]), [['/jobs/hatted-restaurant-jobs', 2], ['/jobs/michelin-restaurant-jobs', 2]])
  assert.ok(idx.roles.every(r => !/restaurant-jobs/.test(r.path)))
  assert.ok(relatedLandings(JOBS[0]).some(l => l.path === '/jobs/michelin-restaurant-jobs'))
  // every related link points at a page that has this job on it
  for (const j of JOBS) for (const l of relatedLandings(j)) {
    assert.ok(jobMatchesLanding(j, parseLandingSlug(l.path.replace('/jobs/', ''))), `${j.id} → ${l.path}`)
  }
})

test('landing copy is specific to the page', () => {
  const c = landingCopy({ group: 'chef', place: 'adelaide' }, JOBS, 1)
  assert.equal(c.title, 'Chef Jobs in Adelaide | HospoSearch')
  assert.match(c.intro, /Hiring now: Arkhé\./)
  assert.match(c.intro, /Pay is listed up front/)
  assert.match(c.description, /^1 chef job in Adelaide at Arkhé\./)
  assert.ok(c.description.length <= 155)
  const m = landingCopy({ group: 'michelin-restaurant', place: null }, JOBS, 2)
  assert.equal(m.h1, 'Michelin Restaurant Jobs')
  assert.match(m.intro, /^2 live roles at Michelin-starred and Michelin Guide restaurants/)
  const many = [1,2,3,4,5,6].map(i => row({ id: 'm'+i, title: 'Chef', venue: `Sugarloaf Restaurant at Flockhill Number ${i}`, city: 'Perth', short: 'Two-hatted.' }))
  const h = landingCopy({ group: 'hatted-restaurant', place: null }, many, 6)
  assert.match(h.intro, /Number 4 and 2 more\./)
  assert.ok(h.description.length <= 155 && h.description.endsWith('updated daily.') && /and more\./.test(h.description), h.description)
  const none = landingCopy({ group: 'sommelier', place: 'perth' }, JOBS, 0)
  assert.match(none.intro, /no live sommelier roles in Perth/)
})

test('titles and descriptions fit Google and never stop mid-word', () => {
  assert.equal(jobTitleTag(JOBS[0]), 'Chef de Partie — Arkhé, Adelaide | HospoSearch')
  const long = row({ title: 'Front of House and Kitchen Professionals', venue: 'Coriole Vineyards Restaurant', city: 'McLaren Vale' })
  assert.equal(jobTitleTag(long), 'Front of House and Kitchen Professionals — Coriole Vineyards Restaurant, McLaren Vale')
  assert.equal(jobTitleTag(JOBS[3]), 'Bartender — The Caterpillar Club, Sydney | HospoSearch')
  const d = jobDescriptionTag(row({ title: 'Chef', venue: 'V', city: 'Hobart', short: 'word '.repeat(80) }))
  assert.ok(d.length <= 155 && d.endsWith('word…'), d)
  assert.match(jobDescriptionTag(JOBS[0]), /\$70,000 – \$80,000\./)
  assert.equal(clip('short text'), 'short text')
})

test('careers links: tagged for the venue, and email listings still apply through HospoSearch', async () => {
  const { trackedLink, hasExternalApply, hasCareersLink, jobPostingLd } = await import('./shared.js')
  assert.equal(trackedLink('https://venue.com/careers'), 'https://venue.com/careers?utm_source=hosposearch&utm_medium=job_board&utm_campaign=hosposearch_listing')
  assert.equal(trackedLink('https://venue.com/jobs?id=7'), 'https://venue.com/jobs?id=7&utm_source=hosposearch&utm_medium=job_board&utm_campaign=hosposearch_listing')
  assert.equal(trackedLink('https://venue.com/?utm_source=theirs'), 'https://venue.com/?utm_source=theirs')
  assert.equal(trackedLink('#'), '#')
  const both = row({ title: 'Chef', venue: 'V', link: 'https://venue.com/careers', apply_email: 'jobs@venue.com' })
  const siteOnly = row({ title: 'Chef', venue: 'V', link: 'https://venue.com/careers' })
  const emailOnly = row({ title: 'Chef', venue: 'V', link: '#', apply_email: 'jobs@venue.com' })
  assert.deepEqual([hasCareersLink(both), hasExternalApply(both)], [true, false])
  assert.deepEqual([hasCareersLink(siteOnly), hasExternalApply(siteOnly)], [true, true])
  assert.deepEqual([hasCareersLink(emailOnly), hasExternalApply(emailOnly)], [false, false])
  assert.equal(jobPostingLd(both).directApply, true)
  assert.equal(jobPostingLd(both).hiringOrganization.sameAs, 'https://venue.com')
  assert.equal(jobPostingLd(siteOnly).directApply, false)
  assert.ok(!JSON.stringify(both).includes('jobs@venue.com')) // the address itself is never carried into the page data
})

