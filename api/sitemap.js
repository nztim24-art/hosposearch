// /api/sitemap.js — dynamic XML sitemap served at /sitemap.xml
// Lists the home page, /jobs, every live job, and every role/location landing
// page that currently has jobs. Expired jobs drop out automatically.

import { getLiveJobs } from '../src/seo/server-data.js'
import { SITE, landingIndex } from '../src/seo/shared.js'

const day = (ts) => new Date(ts).toISOString().split('T')[0]

export default async function handler(req, res) {
  let jobs = []
  try { jobs = await getLiveJobs() } catch (e) { console.warn('Sitemap fetch error:', e) }

  const today = day(Date.now())
  const newest = jobs.length ? day(Math.max(...jobs.map(j => j.updatedTs || j.ts))) : today
  const url = (loc, lastmod, changefreq, priority) =>
    `<url><loc>${SITE}${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`

  const idx = landingIndex(jobs)
  const landings = [...idx.roles, ...idx.places, ...idx.combos]

  const urls = [
    url('/', newest, 'weekly', '1.0'),
    url('/jobs', newest, 'daily', '0.9'),
    ...landings.map(l => url(l.path, newest, 'daily', '0.7')),
    ...jobs.map(j => url(`/jobs/${j.id}`, day(j.updatedTs || j.ts), 'weekly', '0.8')),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600')
  res.status(200).send(xml)
}
