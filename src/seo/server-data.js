// Server-only: fetch live jobs from Supabase for the SEO pages and sitemap.
// Uses the public anon key (same one the browser app ships with), so it can only
// read what Row Level Security already makes public.
import { fromRow, isLive } from './shared.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://auth.hosposearch.com'
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjdmF0bGFnaXNrdmFwZXFzZm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTI1MzksImV4cCI6MjA5MTc4ODUzOX0.9NL3wnGKAQzfLXTpzlgEyHTiOVGFRBkM99WCYEZoAOM'

const COLS = 'id,title,venue,loc,country,state,city,sector,role_type,salary,salary_shown,pay_type,workplace,type,tags,short,full_desc,link,address,photos,avatar_url,created_at,updated_at,expires_at,active,featured'

let cache = { at: 0, jobs: null }

async function rest(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?${query}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text().catch(() => '')}`)
  return r.json()
}

// All live jobs, newest first (featured on top). Cached in memory for 60s.
export async function getLiveJobs() {
  if (cache.jobs && Date.now() - cache.at < 60_000) return cache.jobs
  const rows = await rest(`select=${COLS}&or=(active.is.null,active.eq.true)&order=featured.desc,created_at.desc`)
  const now = Date.now()
  const jobs = rows.map(fromRow).filter(j => isLive(j, now))
  cache = { at: Date.now(), jobs }
  return jobs
}

// One job by id, live or not (so expired jobs can return 410 Gone)
export async function getJob(id) {
  const rows = await rest(`select=${COLS}&id=eq.${encodeURIComponent(id)}&limit=1`)
  return rows[0] ? fromRow(rows[0]) : null
}
