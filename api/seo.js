// /api/seo.js — server-rendered HTML for job-seeker pages, so Google can read them.
//
//   /                              → homepage = all live jobs (the old landing page is now /about)
//   /jobs                          → same list (canonical points at /)
//   /jobs/<uuid>                   → one job, with Google for Jobs (JobPosting) data
//   /jobs/chef-jobs-sydney         → role + location landing page
//   /jobs/chef-jobs                → role landing page
//   /jobs/hospitality-jobs-sydney  → location landing page
//   /sitemap.xml                   → XML sitemap (same function: Hobby plan caps us at 12)
//
// It takes the built SPA shell (dist/shell.html — renamed from index.html at build time so
// that "/" isn't a static file and can be rendered here too), fills in <title>, meta tags and JSON-LD,
// and puts readable content inside <div id="root">. The React app then loads and
// takes over exactly as before — visitors see the same site, crawlers get content.
// If anything here fails, it falls back to the plain SPA shell (never a broken page).

import fs from 'node:fs'
import path from 'node:path'
import { getLiveJobs, getJob } from '../src/seo/server-data.js'
import {
  SITE, isJobId, parseLandingSlug, jobMatchesLanding, landingCopy, landingIndex,
  relatedLandings, jobPostingLd, jobGroups, stripTags, cleanCity, parseSalary, groupBySlug,
} from '../src/seo/shared.js'

// ─── Template (the built SPA shell) ──────────────────────────────────────────
let TEMPLATE = null
async function getTemplate(req) {
  if (TEMPLATE) return TEMPLATE
  const candidates = [
    path.join(process.cwd(), 'dist', 'shell.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ]
  for (const p of candidates) {
    try {
      const html = fs.readFileSync(p, 'utf8')
      // Only accept a *built* shell (has hashed /assets/ script), not the Vite source file
      if (html.includes('/assets/')) { TEMPLATE = html; return TEMPLATE }
    } catch (e) { /* try next */ }
  }
  // Fallback: fetch the static shell from the live site
  const hosts = [req.headers['x-forwarded-host'] || req.headers.host, 'www.hosposearch.com'].filter(Boolean)
  for (const h of hosts) {
    try {
      const r = await fetch(`https://${h}/shell.html`, { headers: { 'x-hs-seo': '1' } })
      const html = r.ok ? await r.text() : ''
      if (html.includes('<div id="root">') && html.includes('/assets/')) { TEMPLATE = html; return TEMPLATE }
    } catch (e) { /* try next */ }
  }
  throw new Error('SPA template not found')
}

// ─── Small HTML helpers ──────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ldScript = (obj) =>
  `<script type="application/ld+json" data-ssr="1">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

// Keep only simple formatting tags from user rich text; drop scripts, styles, attributes
function safeHtml(html) {
  if (!html) return ''
  let s = String(html)
    .replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (m, tag) => {
    const t = tag.toLowerCase()
    const ok = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span', 'h2', 'h3', 'h4']
    if (!ok.includes(t)) return ''
    if (t === 'br') return '<br>'
    return m.startsWith('</') ? `</${t}>` : `<${t}>`
  })
  // plain text with newlines → paragraphs
  if (!/<(p|div|br|li)>/i.test(s)) s = s.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
  return s
}

function fmtSalary(job) {
  if (!job.salaryShown || !job.salary || /competitive/i.test(job.salary)) return ''
  return job.salary
}
function where(job) {
  return [cleanCity(job.city), job.state, job.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || job.loc
}
function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d < 1) return 'Posted today'
  if (d === 1) return 'Posted yesterday'
  return `Posted ${d} days ago`
}

const CSS = `<style id="ssr-css">
.ssr{font-family:'Montserrat','DM Sans',system-ui,sans-serif;background:#FAF8F4;color:#0F0E0C;min-height:100vh}
.ssr a{color:#C4623A}
.ssr-nav{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #E8E2D8}
.ssr-logo{font-family:'Fraunces',serif;font-weight:800;font-size:22px;color:#0F0E0C!important;text-decoration:none}
.ssr-logo span{color:#C4623A}
.ssr-main{max-width:820px;margin:0 auto;padding:24px 16px 56px}
.ssr h1{font-family:'Fraunces',serif;font-size:clamp(28px,5vw,42px);line-height:1.1;margin:8px 0 12px}
.ssr h2{font-family:'Fraunces',serif;font-size:22px;margin:32px 0 10px}
.ssr-sub{color:#7A7570;line-height:1.6}
.ssr-crumbs{font-size:13px;color:#7A7570}
.ssr-crumbs a{color:#7A7570}
.ssr-list{list-style:none;padding:0;margin:16px 0}
.ssr-card{background:#fff;border:1px solid #E8E2D8;border-radius:14px;padding:14px 16px;margin-bottom:10px}
.ssr-card a{font-weight:600;font-size:17px;text-decoration:none;color:#0F0E0C}
.ssr-meta{font-size:14px;color:#7A7570;margin-top:4px}
.ssr-body{line-height:1.7;margin-top:16px}
.ssr-apply{display:inline-block;background:#C4623A;color:#fff!important;padding:12px 22px;border-radius:100px;text-decoration:none;font-weight:600;margin-top:20px}
.ssr-links{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0}
.ssr-links a{display:inline-block;border:1px solid #E8E2D8;border-radius:100px;padding:6px 12px;font-size:14px;text-decoration:none;background:#fff}
.ssr-img{width:100%;max-height:360px;object-fit:cover;border-radius:14px;margin-bottom:12px}
</style>`

function shell(inner) {
  return `${CSS}<div class="ssr"><nav class="ssr-nav"><a class="ssr-logo" href="/"><span>Hospo</span>Search</a><a href="/app">Sign in</a></nav><main class="ssr-main">${inner}</main></div>`
}

function jobCard(j) {
  const sal = fmtSalary(j)
  return `<li class="ssr-card"><a href="/jobs/${esc(j.id)}">${esc(j.title)} — ${esc(j.venue)}</a>
<div class="ssr-meta">${esc(where(j))}${j.type && !/not stated/i.test(j.type) ? ' · ' + esc(j.type) : ''}${sal ? ' · ' + esc(sal) : ''}</div>
${j.short ? `<div class="ssr-meta">${esc(stripTags(j.short).slice(0, 180))}</div>` : ''}</li>`
}

function browseSections(jobs) {
  const idx = landingIndex(jobs)
  const links = (arr) => `<ul class="ssr-links">${arr.map(l => `<li><a href="${esc(l.path)}">${esc(l.label)} (${l.count})</a></li>`).join('')}</ul>`
  let html = ''
  if (idx.roles.length) html += `<h2>Browse by role</h2>${links(idx.roles)}`
  if (idx.places.length) html += `<h2>Browse by location</h2>${links(idx.places)}`
  if (idx.combos.length) html += `<h2>Popular searches</h2>${links(idx.combos.slice(0, 40))}`
  return html
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path })),
  }
}

// ─── Page builders: return { status, title, description, canonical, robots, ld[], body, image }
function listPage(jobs, landing, home = false) {
  const matching = landing ? jobs.filter(j => jobMatchesLanding(j, landing)) : jobs
  let title, h1, intro, description, canonical, crumbs
  if (landing) {
    const c = landingCopy(landing, jobs, matching.length)
    ;({ title, h1, intro, description } = c)
    canonical = `${SITE}/jobs/${landing.group}-jobs${landing.place ? '-' + landing.place : ''}`
    crumbs = [{ name: 'Jobs', path: '/jobs' }, { name: h1, path: canonical.replace(SITE, '') }]
  } else {
    title = home ? 'HospoSearch — Hospitality Jobs in Australia & New Zealand' : 'Hospitality Jobs in Australia, New Zealand & Beyond | HospoSearch'
    h1 = home ? 'Find your next great hospitality role' : 'Hospitality jobs'
    intro = `${matching.length} live chef, front-of-house, bar, sommelier and management roles at restaurants, hotels and wineries across Australia, New Zealand and beyond. Apply directly to the venue — new roles added every evening.`
    description = `Browse ${matching.length} hospitality jobs — chef, sous chef, waiter, bartender, sommelier and restaurant manager roles across Australia and New Zealand. Updated daily on HospoSearch.`
    canonical = `${SITE}/` // the homepage is the jobs list; /jobs is the same page
    crumbs = [{ name: 'Jobs', path: '/' }]
  }
  const body = shell(`
<div class="ssr-crumbs"><a href="/">HospoSearch</a> › <a href="/jobs">Jobs</a>${landing ? ' › ' + esc(h1) : ''}</div>
<h1>${esc(h1)}</h1>
<p class="ssr-sub">${esc(intro)}</p>
${matching.length ? `<ul class="ssr-list">${matching.map(jobCard).join('')}</ul>` : ''}
${landing ? `<p><a href="/jobs">See all hospitality jobs →</a></p>` : ''}
${browseSections(jobs)}
<p class="ssr-sub" style="margin-top:32px">Hiring? <a href="/about?post=1">Post a role on HospoSearch →</a> · <a href="/about">About HospoSearch</a></p>`)
  const ld = [
    breadcrumbLd(crumbs),
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: h1,
      itemListElement: matching.slice(0, 50).map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/jobs/${j.id}`, name: `${j.title} — ${j.venue}` })),
    },
  ]
  return {
    status: 200, title, description, canonical,
    robots: matching.length ? 'index,follow' : 'noindex,follow',
    ld, body, image: matching.find(j => j.photos[0])?.photos[0],
  }
}

function jobPage(job, jobs) {
  const loc = where(job)
  const sal = fmtSalary(job)
  const title = `${job.title} — ${job.venue}, ${cleanCity(job.city) || job.country || job.loc} | HospoSearch`
  const description = `${job.title} at ${job.venue}, ${loc}.${sal ? ' ' + sal + '.' : ''} ${stripTags(job.short || job.full)}`.slice(0, 158).trim()
  const canonical = `${SITE}/jobs/${job.id}`
  const ext = /^https?:\/\//i.test(job.link || '')
  const related = relatedLandings(job)
  const g0 = jobGroups(job)[0]
  const similar = g0 ? jobs.filter(j => j.id !== job.id && jobMatchesLanding(j, { group: g0, place: null })).slice(0, 5) : []
  const tags = [job.type, job.sector, job.roleType, ...(job.tags || [])].filter(t => t && !/not stated/i.test(t))
  const body = shell(`
<div class="ssr-crumbs"><a href="/">HospoSearch</a> › <a href="/jobs">Jobs</a>${related[0] ? ` › <a href="${esc(related[0].path)}">${esc(related[0].label.replace(/^More /, '').replace(/^./, c => c.toUpperCase()))}</a>` : ''}</div>
${job.photos[0] ? `<img class="ssr-img" src="${esc(job.photos[0])}" alt="${esc(job.title)} at ${esc(job.venue)}">` : ''}
<div class="ssr-meta">${esc(job.venue)} · ${esc(loc)}</div>
<h1>${esc(job.title)}</h1>
${sal ? `<p><strong>${esc(sal)}</strong></p>` : ''}
${tags.length ? `<p class="ssr-meta">${tags.map(esc).join(' · ')}</p>` : ''}
<p class="ssr-meta">${esc(ago(job.ts))}</p>
<div class="ssr-body">${safeHtml(job.full || job.short)}</div>
<a class="ssr-apply" href="${ext ? esc(job.link) : '/app'}"${ext ? ' rel="nofollow noopener" target="_blank"' : ''}>${ext ? 'Apply on venue website' : 'Apply via HospoSearch'}</a>
${related.length ? `<h2>Related searches</h2><ul class="ssr-links">${related.map(l => `<li><a href="${esc(l.path)}">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
${similar.length ? `<h2>Similar roles</h2><ul class="ssr-list">${similar.map(jobCard).join('')}</ul>` : ''}
<p><a href="/jobs">Browse all hospitality jobs →</a></p>`)
  const crumbs = [{ name: 'Jobs', path: '/jobs' }]
  if (related[0]) crumbs.push({ name: related[0].label.replace(/^More /, ''), path: related[0].path })
  crumbs.push({ name: job.title, path: `/jobs/${job.id}` })
  const ld = [jobPostingLd({ ...job, fullHtml: safeHtml(job.full || job.short) }), breadcrumbLd(crumbs)]
  return { status: 200, title, description, canonical, robots: 'index,follow', ld, body, image: job.photos[0] }
}

function gonePage(jobs) {
  const body = shell(`
<h1>This role has been filled or has closed</h1>
<p class="ssr-sub">The listing you're looking for is no longer taking applications. Here are the latest hospitality jobs instead.</p>
<ul class="ssr-list">${jobs.slice(0, 10).map(jobCard).join('')}</ul>
<p><a href="/jobs">Browse all hospitality jobs →</a></p>`)
  return { status: 410, title: 'Role no longer available | HospoSearch', description: 'This hospitality role has closed. Browse the latest hospitality jobs on HospoSearch.', robots: 'noindex,follow', ld: [], body }
}

function notFoundPage(jobs) {
  const p = gonePage(jobs)
  return { ...p, status: 404, title: 'Page not found | HospoSearch' }
}

// ─── Inject into the SPA shell ────────────────────────────────────────────────
function render(template, page) {
  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta name="robots" content="${esc(page.robots || 'index,follow')}">`,
    page.canonical ? `<link rel="canonical" href="${esc(page.canonical)}">` : '',
    `<meta property="og:site_name" content="HospoSearch">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    page.canonical ? `<meta property="og:url" content="${esc(page.canonical)}">` : '',
    page.image ? `<meta property="og:image" content="${esc(page.image)}">` : '',
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}">`,
    ...(page.ld || []).map(ldScript),
  ].filter(Boolean).join('\n    ')

  return template
    // drop the shell's generic title/description/OG so ours are the only ones
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${page.body}</div>`)
}

// ─── /sitemap.xml ─────────────────────────────────────────────────────────────
async function sitemap(req, res) {
  let jobs = []
  try { jobs = await getLiveJobs() } catch (e) { console.warn('Sitemap fetch error:', e) }
  const day = (ts) => new Date(ts).toISOString().split('T')[0]
  const newest = jobs.length ? day(Math.max(...jobs.map(j => j.updatedTs || j.ts))) : day(Date.now())
  const url = (loc, lastmod, changefreq, priority) =>
    `<url><loc>${SITE}${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
  const idx = landingIndex(jobs)
  const urls = [
    url('/', newest, 'daily', '1.0'),
    url('/about', newest, 'monthly', '0.6'),
    ...[...idx.roles, ...idx.places, ...idx.combos].map(l => url(l.path, newest, 'daily', '0.7')),
    ...jobs.map(j => url(`/jobs/${j.id}`, day(j.updatedTs || j.ts), 'weekly', '0.8')),
  ]
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600')
  return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`)
}

export default async function handler(req, res) {
  if (req.query.sitemap) return sitemap(req, res)
  const slug = String(req.query.slug || '').replace(/\/+$/, '')
  let template
  try {
    template = await getTemplate(req)
  } catch (e) {
    console.error('seo: no template', e)
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.end('<!doctype html><meta http-equiv="refresh" content="0;url=/"><a href="/">HospoSearch</a>')
  }

  try {
    const jobs = await getLiveJobs()
    let page
    if (!slug) {
      page = listPage(jobs, null, !!req.query.home)
    } else if (isJobId(slug)) {
      const live = jobs.find(j => String(j.id) === slug)
      if (live) page = jobPage(live, jobs)
      else {
        const any = await getJob(slug).catch(() => null)
        // Not public any more (expired / taken down) → 410 so Google drops it quickly
        page = any && any.active !== false && (!any.expiresAt || any.expiresAt > Date.now())
          ? jobPage(any, jobs)
          : gonePage(jobs)
      }
    } else {
      const landing = parseLandingSlug(slug)
      page = landing && groupBySlug(landing.group) ? listPage(jobs, landing) : notFoundPage(jobs)
    }
    res.statusCode = page.status
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600')
    if (page.status === 410) res.setHeader('X-Robots-Tag', 'noindex')
    return res.end(render(template, page))
  } catch (e) {
    // Data problem → serve the normal SPA so visitors are never blocked
    console.error('seo: render failed', e)
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30')
    return res.end(template)
  }
}
