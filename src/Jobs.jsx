import { useEffect, useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { fetchJobs } from './supabase.js'

// ─── Palette (matches App.jsx / Landing.jsx) ──────────────────────────────────
const C = {
  bg:"#FAF8F4", bgSoft:"#F4F0EB", border:"#E8E2D8", borderMid:"#D6CEBC",
  terracotta:"#C4623A", terracottaL:"#F5EDE7", terracottaM:"#E8CFBF", terracottaD:"#9E4B2A",
  sage:"#6B8F71", sageL:"#EBF2EC", sand:"#C9A96E", sandL:"#FDF6E8",
  textDark:"#0F0E0C", textMid:"#3A3733", textSoft:"#7A7570", textFaint:"#C0BAB2",
  white:"#FFFFFF", featured:"#F5A623", featuredL:"#FFF8EE",
}

const PBG = ["#E8CFBF","#EBF2EC","#FDF6E8","#F5EDE7","#EAE4DA"]
const isData = (v) => typeof v === "string" && (v.startsWith("data:") || v.startsWith("http"))

// Strips scripts/event handlers/unsafe tags from user rich text before rendering
function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return ""
  try {
    const allowed = ["B","STRONG","I","EM","U","UL","OL","LI","BR","P","DIV","SPAN"]
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 1) {
          if (!allowed.includes(child.tagName)) { child.replaceWith(document.createTextNode(child.textContent || "")); continue }
          for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name)
          walk(child)
        } else if (child.nodeType === 8) { child.remove() }
      }
    }
    const container = doc.body.firstChild
    walk(container)
    return container.innerHTML
  } catch (e) { return html.replace(/<[^>]*>/g, "") }
}
function stripTags(text) {
  if (!text || typeof text !== "string") return ""
  return text
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim()
}
const ago = (ts) => {
  const d = Math.floor((Date.now()-ts)/86400000)
  if (d<1) return "today"; if (d===1) return "1d"; if (d<7) return d+"d"
  if (d<30) return Math.floor(d/7)+"w"; return Math.floor(d/30)+"mo"
}

// ─── SEO head management (no external deps) ───────────────────────────────────
function useSEO({ title, description, canonical, jsonLd }) {
  useEffect(() => {
    if (title) document.title = title
    const setMeta = (attr, key, content) => {
      if (!content) return
      let el = document.querySelector(`meta[${attr}="${key}"]`)
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el) }
      el.setAttribute("content", content)
    }
    setMeta("name","description",description)
    setMeta("property","og:title",title)
    setMeta("property","og:description",description)
    setMeta("property","og:type","website")
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]')
      if (!link) { link = document.createElement("link"); link.setAttribute("rel","canonical"); document.head.appendChild(link) }
      link.setAttribute("href", canonical)
    }
    let ld = document.getElementById("jobs-jsonld")
    if (jsonLd) {
      if (!ld) { ld = document.createElement("script"); ld.id="jobs-jsonld"; ld.type="application/ld+json"; document.head.appendChild(ld) }
      ld.textContent = JSON.stringify(jsonLd)
    } else if (ld) { ld.remove() }
    return () => { const x = document.getElementById("jobs-jsonld"); if (x) x.remove() }
  }, [title, description, canonical, JSON.stringify(jsonLd)])
}

const styles = `
  .jb-wrap{font-family:'DM Sans',sans-serif;background:${C.bg};min-height:100vh;color:${C.textDark};}
  .jb-serif{font-family:'Fraunces','Playfair Display',serif;}
  .jb-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:rgba(250,248,244,0.9);backdrop-filter:blur(12px);border-bottom:1px solid ${C.border};}
  .jb-logo{font-family:'Fraunces','Playfair Display',serif;font-size:22px;font-weight:800;color:${C.textDark};text-decoration:none;letter-spacing:-0.3px;}
  .jb-logo span{color:${C.terracotta};}
  .jb-nav-cta{background:${C.terracotta};color:#fff;padding:9px 20px;border-radius:100px;font-weight:600;font-size:14px;text-decoration:none;transition:background 0.2s;}
  .jb-nav-cta:hover{background:${C.terracottaD};}
  .jb-hero{text-align:center;padding:48px 24px 28px;max-width:760px;margin:0 auto;}
  .jb-hero h1{font-family:'Fraunces','Playfair Display',serif;font-size:clamp(30px,5vw,46px);font-weight:800;line-height:1.1;letter-spacing:-1px;margin-bottom:14px;}
  .jb-hero h1 em{font-style:italic;color:${C.terracotta};}
  .jb-hero p{font-size:16px;color:${C.textSoft};line-height:1.6;}
  .jb-search{max-width:560px;margin:24px auto 0;display:flex;align-items:center;background:#fff;border:2px solid ${C.border};border-radius:100px;padding:12px 20px;gap:10px;box-shadow:0 2px 12px rgba(0,0,0,0.06);transition:border-color 0.2s;}
  .jb-search:focus-within{border-color:${C.terracotta};}
  .jb-search input{flex:1;border:none;outline:none;background:none;font-size:15px;font-family:inherit;color:${C.textDark};}
  .jb-filters{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:20px 24px 0;max-width:900px;margin:0 auto;}
  .jb-pill{background:#fff;border:1px solid ${C.border};color:${C.textMid};font-size:13px;font-weight:600;padding:7px 16px;border-radius:100px;cursor:pointer;transition:all 0.15s;}
  .jb-pill:hover{border-color:${C.terracottaM};}
  .jb-pill.active{background:${C.terracotta};border-color:${C.terracotta};color:#fff;}
  .jb-grid{max-width:1120px;margin:0 auto;padding:28px 24px 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;}
  .jb-card{background:#fff;border:1px solid ${C.border};border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.05);transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;}
  .jb-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,0.12);}
  .jb-card-img{position:relative;width:100%;aspect-ratio:4/5;overflow:hidden;background:#F4F0EB;}
  .jb-card-img .jb-main{width:100%;height:100%;object-fit:cover;display:block;}
  .jb-badge{position:absolute;top:10px;left:10px;background:${C.featuredL};border:1px solid ${C.featured}55;color:${C.featured};font-size:10px;font-weight:700;padding:4px 10px;border-radius:100px;display:flex;align-items:center;gap:4px;}
  .jb-card-body{padding:14px 16px 16px;flex:1;display:flex;flex-direction:column;}
  .jb-venue{color:${C.textSoft};font-size:12px;font-weight:600;margin-bottom:4px;}
  .jb-title{font-family:'Fraunces','Playfair Display',serif;font-weight:700;font-size:19px;line-height:1.2;margin-bottom:5px;}
  .jb-salary{color:${C.sand};font-weight:700;font-size:14px;margin-bottom:9px;}
  .jb-short{color:${C.textMid};font-size:13px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:12px;flex:1;}
  .jb-meta{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:${C.textFaint};margin-top:auto;}
  .jb-meta .role{color:${C.terracotta};font-weight:700;font-size:12px;}
  .jb-empty{text-align:center;padding:80px 24px;color:${C.textSoft};}
  .jb-footer{text-align:center;padding:40px 24px;border-top:1px solid ${C.border};color:${C.textSoft};font-size:13px;}
  .jb-footer a{color:${C.terracotta};text-decoration:none;font-weight:600;}
  /* Detail page */
  .jb-detail{max-width:760px;margin:0 auto;padding:24px;}
  .jb-back{display:inline-flex;align-items:center;gap:6px;color:${C.textSoft};text-decoration:none;font-size:14px;font-weight:600;margin-bottom:20px;}
  .jb-back:hover{color:${C.terracotta};}
  .jb-detail-hero{width:100%;aspect-ratio:16/9;border-radius:18px;overflow:hidden;margin-bottom:24px;background:${C.bgSoft};}
  .jb-detail-hero img{width:100%;height:100%;object-fit:cover;}
  .jb-detail h1{font-family:'Fraunces','Playfair Display',serif;font-size:clamp(28px,4vw,40px);font-weight:800;line-height:1.1;letter-spacing:-0.5px;margin-bottom:8px;}
  .jb-detail-venue{font-size:16px;color:${C.textSoft};font-weight:600;margin-bottom:16px;}
  .jb-tags{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}
  .jb-tag{background:${C.bgSoft};border:1px solid ${C.border};color:${C.textMid};font-size:12px;font-weight:600;padding:5px 12px;border-radius:100px;}
  .jb-detail-body{font-size:15px;line-height:1.75;color:${C.textMid};margin-bottom:32px;}
  .jb-detail-body ul,.jb-detail-body ol{margin:10px 0 10px 22px;}
  .jb-detail-body li{margin-bottom:5px;}
  .jb-apply{background:linear-gradient(135deg,${C.terracotta},${C.terracottaD});color:#fff;padding:16px 36px;border-radius:100px;font-size:16px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;box-shadow:0 6px 20px rgba(196,98,58,0.3);transition:transform 0.2s;}
  .jb-apply:hover{transform:translateY(-2px);}
  @media(max-width:600px){.jb-grid{padding:20px 16px 40px;gap:14px;}.jb-nav{padding:14px 16px;}}
`

function JobCard({ job }) {
  const first = job.photos?.[0]
  const hasImg = isData(first)
  const pbg = PBG[typeof job.photos?.[0]==="number" ? job.photos[0]%PBG.length : 0]
  return (
    <Link to={`/jobs/${job.id}`} className="jb-card">
      <div className="jb-card-img" style={{ background:pbg }}>
        {hasImg
          ? <img src={first} alt={`${job.title} at ${job.venue}`} loading="lazy" className="jb-main"/>
          : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:42,opacity:0.25 }}>🍽️</div>}
        {job.featured && <div className="jb-badge">★ Featured</div>}
      </div>
      <div className="jb-card-body">
        <div className="jb-venue">{job.venue}</div>
        <div className="jb-title jb-serif">{job.title}</div>
        <div className="jb-salary">{job.salary}</div>
        <div className="jb-short">{stripTags(job.short)}</div>
        <div className="jb-meta">
          <span>{job.loc} · {ago(job.ts)} ago</span>
          <span className="role">View role →</span>
        </div>
      </div>
    </Link>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────
function JobsList({ jobs, loading }) {
  const [q, setQ] = useState("")
  const [country, setCountry] = useState("All")

  const countries = useMemo(() => {
    const set = new Set(jobs.map(j=>j.country).filter(Boolean))
    return ["All", ...Array.from(set)]
  }, [jobs])

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (country!=="All" && j.country!==country) return false
      if (!q.trim()) return true
      const hay = `${j.title} ${j.venue} ${j.loc} ${j.sector} ${j.roleType} ${(j.tags||[]).join(" ")}`.toLowerCase()
      return hay.includes(q.toLowerCase())
    })
  }, [jobs, q, country])

  useSEO({
    title: "Hospitality Jobs in Australia, New Zealand & Beyond | HospoSearch",
    description: "Browse chef, sommelier, venue manager and front-of-house roles across Australia, New Zealand and the world's best restaurants. Updated daily on HospoSearch.",
    canonical: "https://www.hosposearch.com/jobs",
    jsonLd: {
      "@context":"https://schema.org",
      "@type":"ItemList",
      "itemListElement": filtered.slice(0,20).map((j,i)=>({
        "@type":"ListItem","position":i+1,
        "url":`https://www.hosposearch.com/jobs/${j.id}`,
        "name":`${j.title} — ${j.venue}`,
      })),
    },
  })

  return (
    <>
      <div className="jb-hero">
        <h1 className="jb-serif">Find your next great <em>hospitality role</em></h1>
        <p>{loading ? "Loading roles…" : `${jobs.length} role${jobs.length!==1?"s":""} across Australia, New Zealand & beyond`}</p>
        <div className="jb-search">
          <span style={{ color:C.textSoft }}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search roles — Chef, Sommelier, Floor Manager…" />
        </div>
      </div>
      {countries.length>2 && (
        <div className="jb-filters">
          {countries.map(c => (
            <button key={c} className={`jb-pill ${country===c?"active":""}`} onClick={()=>setCountry(c)}>{c}</button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="jb-empty">Loading hospitality roles…</div>
      ) : filtered.length===0 ? (
        <div className="jb-empty">
          <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
          <div>No roles match your search just yet.</div>
        </div>
      ) : (
        <div className="jb-grid">
          {filtered.map(j => <JobCard key={j.id} job={j} />)}
        </div>
      )}
      <div className="jb-footer">
        Are you hiring? <Link to="/app">Post a role on HospoSearch →</Link>
      </div>
    </>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function JobDetail({ jobs, loading }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const job = jobs.find(j => String(j.id)===String(id))

  useSEO({
    title: job ? `${job.title} — ${job.venue} | HospoSearch` : "Hospitality Role | HospoSearch",
    description: job ? `${job.title} at ${job.venue}, ${job.loc}. ${stripTags(job.short||"").slice(0,140)}` : "View this hospitality role on HospoSearch.",
    canonical: job ? `https://www.hosposearch.com/jobs/${job.id}` : undefined,
    jsonLd: job ? {
      "@context":"https://schema.org",
      "@type":"JobPosting",
      "title":job.title,
      "description":stripTags(job.full||job.short),
      "datePosted":new Date(job.ts).toISOString(),
      "employmentType":(job.type||"FULL_TIME").toUpperCase().replace("-","_"),
      "hiringOrganization":{ "@type":"Organization","name":job.venue },
      "jobLocation":{ "@type":"Place","address":{ "@type":"PostalAddress","addressLocality":job.city||job.loc,"addressRegion":job.state,"addressCountry":job.country } },
      ...(job.salaryBand ? { "estimatedSalary":{ "@type":"MonetaryAmount","currency":"AUD","value":{ "@type":"QuantitativeValue","value":job.salaryBand } } } : {}),
    } : null,
  })

  if (loading) return <div className="jb-empty">Loading role…</div>
  if (!job) return (
    <div className="jb-empty">
      <div style={{ fontSize:40, marginBottom:12 }}>🤷</div>
      <div style={{ marginBottom:16 }}>This role is no longer available.</div>
      <Link to="/jobs" className="jb-nav-cta">Browse all roles</Link>
    </div>
  )

  const first = job.photos?.[0]
  const hasImg = isData(first)

  return (
    <div className="jb-detail">
      <Link to="/jobs" className="jb-back">← All roles</Link>
      {hasImg && <div className="jb-detail-hero"><img src={first} alt={`${job.title} at ${job.venue}`} /></div>}
      <div className="jb-detail-venue">{job.venue} · {job.loc}</div>
      <h1 className="jb-serif">{job.title}</h1>
      {job.salary && <div className="jb-salary" style={{ fontSize:18, marginBottom:18 }}>{job.salary}</div>}
      <div className="jb-tags">
        {[job.type, job.sector, job.roleType, ...(job.tags||[])].filter(Boolean).map((t,i)=>(
          <span key={i} className="jb-tag">{t}</span>
        ))}
      </div>
      <div className="jb-detail-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.full || job.short) }} />
      {job.link && job.link.trim() && job.link.trim()!=="#"
        ? <a href={job.link} target="_blank" rel="noreferrer" className="jb-apply">Apply on venue website ↗</a>
        : <Link to="/app" className="jb-apply">Apply via HospoSearch →</Link>}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Jobs({ detail=false }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchJobs()
      .then(data => { if (alive) { setJobs(data); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="jb-wrap">
      <style>{styles}</style>
      <nav className="jb-nav">
        <Link to="/" className="jb-logo"><span>Hospo</span>Search</Link>
        <Link to="/app" className="jb-nav-cta">Sign in</Link>
      </nav>
      {detail ? <JobDetail jobs={jobs} loading={loading} /> : <JobsList jobs={jobs} loading={loading} />}
    </div>
  )
}
