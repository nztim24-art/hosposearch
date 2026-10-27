// Shared SEO helpers — used by the server-rendered pages (api/seo.js),
// the sitemap (api/sitemap.js) and the React /jobs pages (src/Jobs.jsx).
// Pure JS, no React or Node-only imports, so it runs in both places.

export const SITE = 'https://www.hosposearch.com'

// ─── Role groups (what job seekers actually search for) ──────────────────────
// Order matters: first match wins, so specific groups come before broad ones.
export const ROLE_GROUPS = [
  { slug: 'sommelier',      label: 'Sommelier',          plural: 'sommelier',          re: /sommelier|wine (waiter|steward)/i },
  { slug: 'bartender',      label: 'Bartender',          plural: 'bartender',          re: /bartend|mixolog|\bbar (manager|supervisor|back|attendant)/i },
  { slug: 'chef',           label: 'Chef',               plural: 'chef',               re: /chef|\bcook\b|commis|\bcdp\b|kitchen|pastry|baker/i },
  { slug: 'front-of-house', label: 'Front of House',     plural: 'front of house',     re: /wait|server|host|front of house|\bfoh\b|floor|maitre|runner|barista/i },
  { slug: 'manager',        label: 'Hospitality Manager', plural: 'hospitality manager', re: /manager|supervisor|director|general manager/i },
]
// "hospitality" = every role
export const ALL_GROUP = { slug: 'hospitality', label: 'Hospitality', plural: 'hospitality', re: /.*/ }

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// "Auckland CBD" → "Auckland" so CBD roles roll up into the city page
export function cleanCity(city) {
  return String(city || '').replace(/\s+(CBD|city centre|city center)$/i, '').trim()
}

// Which role groups a job belongs to (a Bar Manager is both bartender + manager)
export function jobGroups(job) {
  const hay = `${job.roleType || ''} ${job.title || ''}`
  return ROLE_GROUPS.filter(g => g.re.test(hay)).map(g => g.slug)
}

// Places a job can be found under: its city and its country
export function jobPlaces(job) {
  const out = []
  const city = cleanCity(job.city)
  if (city) out.push({ slug: slugify(city), label: city, kind: 'city' })
  if (job.country) out.push({ slug: slugify(job.country), label: job.country, kind: 'country' })
  return out
}

// ─── Landing URLs: /jobs/chef-jobs-sydney, /jobs/chef-jobs, /jobs/hospitality-jobs-melbourne
export function landingPath(groupSlug, placeSlug) {
  return `/jobs/${groupSlug}-jobs${placeSlug ? '-' + placeSlug : ''}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isJobId = (s) => UUID_RE.test(String(s || ''))

export function parseLandingSlug(slug) {
  if (!slug || isJobId(slug)) return null
  const s = String(slug).toLowerCase()
  for (const g of [...ROLE_GROUPS, ALL_GROUP]) {
    const prefix = `${g.slug}-jobs`
    if (s === prefix) return g.slug === 'hospitality' ? null : { group: g.slug, place: null }
    if (s.startsWith(prefix + '-')) {
      const place = s.slice(prefix.length + 1)
      if (/^[a-z0-9-]+$/.test(place)) return { group: g.slug, place }
    }
  }
  return null
}

export function jobMatchesLanding(job, landing) {
  if (!landing) return true
  if (landing.group !== 'hospitality' && !jobGroups(job).includes(landing.group)) return false
  if (landing.place && !jobPlaces(job).some(p => p.slug === landing.place)) return false
  return true
}

export function groupBySlug(slug) {
  return [...ROLE_GROUPS, ALL_GROUP].find(g => g.slug === slug) || ALL_GROUP
}

// Human label for a place slug, taken from the jobs themselves
export function placeLabel(placeSlug, jobs) {
  for (const j of jobs || []) {
    const p = jobPlaces(j).find(x => x.slug === placeSlug)
    if (p) return p.label
  }
  return placeSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function landingCopy(landing, jobs, count) {
  const g = groupBySlug(landing.group)
  const place = landing.place ? placeLabel(landing.place, jobs) : null
  const what = `${g.label} Jobs`
  const where = place ? ` in ${place}` : ''
  const title = `${what}${where} | HospoSearch`
  const h1 = `${what}${where}`
  const n = count === 1 ? '1 live role' : `${count} live roles`
  const roleWords = {
    chef: 'chef de partie, sous chef, head chef, commis and pastry',
    'front-of-house': 'waiter, host, floor and front-of-house',
    sommelier: 'sommelier and wine',
    bartender: 'bartender and bar',
    manager: 'restaurant manager, duty manager and venue management',
    hospitality: 'chef, front-of-house, bar, sommelier and management',
  }[g.slug]
  const intro = count > 0
    ? `${n} for ${roleWords} positions${where ? where : ' across Australia, New Zealand and beyond'}. Every listing on HospoSearch is checked by our team and you apply directly to the venue — no recruiters in the middle.`
    : `There are no live ${g.plural} roles${where} right now. New hospitality jobs go up every evening — check back soon or browse all roles below.`
  const description = count > 0
    ? `Browse ${n.replace('live ', '')} for ${g.plural} jobs${where}. Apply directly to restaurants, hotels and bars on HospoSearch — updated daily.`
    : `${g.label} jobs${where} on HospoSearch — hospitality roles updated daily across Australia and New Zealand.`
  return { title, h1, intro, description, place }
}

// Links to every landing page that has at least `min` live jobs.
// Used for the "Browse by role / location" sections and the sitemap.
export function landingIndex(jobs, { minCombo = 2 } = {}) {
  const groups = new Map(), places = new Map(), combos = new Map()
  const bump = (m, k, v) => { const e = m.get(k) || { ...v, count: 0 }; e.count++; m.set(k, e) }
  for (const j of jobs) {
    const gs = jobGroups(j)
    const ps = jobPlaces(j)
    for (const g of gs) bump(groups, g, { path: landingPath(g), label: `${groupBySlug(g).label} jobs` })
    for (const p of ps) {
      bump(places, p.slug, { path: landingPath('hospitality', p.slug), label: `Hospitality jobs in ${p.label}`, kind: p.kind })
      for (const g of gs) bump(combos, `${g}|${p.slug}`, { path: landingPath(g, p.slug), label: `${groupBySlug(g).label} jobs in ${p.label}` })
    }
  }
  const sort = (m) => [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return {
    roles: sort(groups),
    places: sort(places),
    combos: sort(combos).filter(c => c.count >= minCombo),
  }
}

// Landing pages most relevant to one job (for "More chef jobs in Sydney" links)
export function relatedLandings(job) {
  const out = []
  const gs = jobGroups(job), ps = jobPlaces(job)
  for (const g of gs) for (const p of ps) out.push({ path: landingPath(g, p.slug), label: `More ${groupBySlug(g).plural} jobs in ${p.label}` })
  for (const p of ps) out.push({ path: landingPath('hospitality', p.slug), label: `All hospitality jobs in ${p.label}` })
  for (const g of gs) out.push({ path: landingPath(g), label: `All ${groupBySlug(g).plural} jobs` })
  return out
}

// ─── Live-ness: active and not past its expiry date ───────────────────────────
export function isLive(job, now = Date.now()) {
  if (job.active === false) return false
  if (job.expiresAt && job.expiresAt < now) return false
  return true
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
export function stripTags(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

// ─── Google for Jobs: JobPosting structured data ──────────────────────────────
const COUNTRY = {
  'australia': { iso: 'AU', cur: 'AUD' },
  'new zealand': { iso: 'NZ', cur: 'NZD' },
  'united kingdom': { iso: 'GB', cur: 'GBP' },
  'uk': { iso: 'GB', cur: 'GBP' },
  'england': { iso: 'GB', cur: 'GBP' },
  'ireland': { iso: 'IE', cur: 'EUR' },
  'united states': { iso: 'US', cur: 'USD' },
  'singapore': { iso: 'SG', cur: 'SGD' },
}
const countryInfo = (c) => COUNTRY[String(c || '').toLowerCase().trim()] || null

const EMPLOYMENT = {
  'full-time': 'FULL_TIME', 'full time': 'FULL_TIME',
  'part-time': 'PART_TIME', 'part time': 'PART_TIME',
  'casual': 'PART_TIME',
  'contract': 'CONTRACTOR',
  'temporary': 'TEMPORARY', 'seasonal': 'TEMPORARY',
  'internship': 'INTERN', 'apprenticeship': 'INTERN',
}

// Pull numbers out of free-text salary like "$79,000–$89,000 per annum" or "$25.80–$38.70/hr"
export function parseSalary(job) {
  if (!job.salaryShown) return null
  const s = String(job.salary || '')
  const nums = (s.match(/\d[\d,]*(\.\d+)?\s*k?/gi) || [])
    .map(x => {
      const k = /k\s*$/i.test(x)
      const n = parseFloat(x.replace(/[,k\s]/gi, ''))
      return k ? n * 1000 : n
    })
    .filter(n => n > 0)
  if (!nums.length) return null
  const hourly = job.payType === 'Hourly' || /\/\s*h(ou)?r|per hour|p\/h/i.test(s)
  const unit = hourly ? 'HOUR' : job.payType === 'Monthly' ? 'MONTH' : 'YEAR'
  // sanity: drop numbers that don't fit the unit (e.g. "+ 11% super")
  const ok = nums.filter(n => unit === 'HOUR' ? n >= 10 && n <= 300 : unit === 'MONTH' ? n >= 1000 : n >= 20000)
  if (!ok.length) return null
  const min = Math.min(...ok), max = Math.max(...ok)
  return { min, max, unit }
}

export function hasExternalApply(job) {
  const l = String(job.link || '').trim()
  return /^https?:\/\//i.test(l)
}

// Address helpers for jobLocation. Many listings store only "Melbourne VIC" in
// the address field, so only treat it as a street address when it looks like one.
const AU_STATES = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/
const STREET_WORDS = /\b(st|street|rd|road|ave|avenue|lane|ln|pde|parade|tce|terrace|dr|drive|hwy|highway|pl|place|blvd|boulevard|cres|crescent|way|quay|wharf|esplanade|square|sq)\b/i
export function addressParts(job) {
  const raw = String(job.address || '').trim()
  const usable = raw && !/not stated/i.test(raw)
  const isStreet = usable && (/\d/.test(raw.split(',')[0]) || STREET_WORDS.test(raw))
  const postcode = usable ? (raw.match(/\b(\d{4})\s*$/) || raw.match(/\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})\b/) || [])[1] : null
  const state = job.state || (usable ? (raw.match(AU_STATES) || [])[1] : null) || null
  return { street: isStreet ? raw : null, postcode: postcode || null, state }
}

export function jobPostingLd(job) {
  const ci = countryInfo(job.country)
  const posted = new Date(job.ts || Date.now())
  const valid = job.expiresAt ? new Date(job.expiresAt) : new Date(posted.getTime() + 30 * 86400000)
  const desc = job.fullHtml || job.full || job.short || `${job.title} at ${job.venue}`
  // House rule: a job type that can't be confirmed is listed as Casual
  const typeKey = String(job.type || '').toLowerCase().trim()
  const emp = EMPLOYMENT[!typeKey || typeKey === 'not stated' ? 'casual' : typeKey]
  const parts = addressParts(job)
  const address = {
    '@type': 'PostalAddress',
    ...(parts.street ? { streetAddress: parts.street } : {}),
    ...(job.city ? { addressLocality: cleanCity(job.city) } : {}),
    ...(parts.state ? { addressRegion: parts.state } : {}),
    ...(parts.postcode ? { postalCode: parts.postcode } : {}),
    ...(ci ? { addressCountry: ci.iso } : job.country ? { addressCountry: job.country } : {}),
  }
  const org = { '@type': 'Organization', name: job.venue }
  if (hasExternalApply(job)) { try { org.sameAs = new URL(job.link).origin } catch (e) {} }
  if (job.logo && /^https?:\/\//.test(job.logo)) org.logo = job.logo

  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: desc,
    identifier: { '@type': 'PropertyValue', name: 'HospoSearch', value: String(job.id) },
    datePosted: posted.toISOString(),
    validThrough: valid.toISOString(),
    hiringOrganization: org,
    jobLocation: { '@type': 'Place', address },
    directApply: !hasExternalApply(job),
    url: `${SITE}/jobs/${job.id}`,
  }
  if (emp) ld.employmentType = emp
  if (job.workplace && /remote/i.test(job.workplace)) ld.jobLocationType = 'TELECOMMUTE'
  if (job.sector) ld.industry = `Hospitality — ${job.sector}`
  else ld.industry = 'Hospitality'
  if (job.roleType) ld.occupationalCategory = job.roleType
  const sal = parseSalary(job)
  if (sal && ci) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: ci.cur,
      value: sal.min === sal.max
        ? { '@type': 'QuantitativeValue', value: sal.min, unitText: sal.unit }
        : { '@type': 'QuantitativeValue', minValue: sal.min, maxValue: sal.max, unitText: sal.unit },
    }
  }
  return ld
}

// Map a raw Supabase `jobs` row to the fields the helpers above use
export function fromRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    venue: row.venue || 'HospoSearch',
    loc: row.loc || row.country || '',
    country: row.country || '',
    state: row.state || '',
    city: row.city || '',
    sector: row.sector || '',
    roleType: row.role_type || '',
    salary: row.salary || 'Competitive',
    salaryShown: row.salary_shown !== false,
    payType: row.pay_type || 'Annually',
    workplace: row.workplace || 'On-site',
    type: row.type || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    short: row.short || '',
    full: row.full_desc || row.short || '',
    link: row.link || '',
    address: row.address || '',
    photos: Array.isArray(row.photos) ? row.photos.filter(p => typeof p === 'string' && /^https?:/.test(p)) : [],
    logo: row.avatar_url || null,
    ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedTs: row.updated_at ? new Date(row.updated_at).getTime() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    active: row.active !== false,
    featured: !!row.featured,
  }
}
