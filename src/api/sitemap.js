// /api/sitemap.js — dynamic XML sitemap served at /sitemap.xml
// Lists the landing page, /jobs index, and each individual job listing

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BASE = 'https://www.hosposearch.com';

export default async function handler(req, res) {
  // Fetch all active, paid job IDs and their updated_at dates
  let jobs = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/jobs?select=id,created_at&active=eq.true&paid=eq.true&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (r.ok) jobs = await r.json();
  } catch(e) { console.warn('Sitemap fetch error:', e); }

  const today = new Date().toISOString().split('T')[0];

  const urls = [
    // Static pages
    `<url><loc>${BASE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
    `<url><loc>${BASE}/jobs</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`,
    // Dynamic job pages
    ...jobs.map(j => {
      const lastmod = j.created_at ? j.created_at.split('T')[0] : today;
      return `<url><loc>${BASE}/jobs/${j.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${lastmod}</lastmod></url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // cache 1hr
  res.status(200).send(xml);
}
