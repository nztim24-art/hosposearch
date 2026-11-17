import { useEffect, useState, useMemo, useRef, Fragment, lazy, Suspense } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase, fetchJobs, feedRank, recordJobShare, incrementViews, getStayLoggedIn, setStayLoggedIn, sessionShouldEnd, getMyProfile, fetchBookmarks, toggleBookmark, fetchFollowing, setFollow, stashAfterLogin } from './supabase.js'
import { parseLandingSlug, jobMatchesLanding, landingCopy, landingIndex, relatedLandings, isLive, jobTitleTag, jobDescriptionTag, trackedLink, mapLinks } from './seo/shared.js'

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

// Share a job: native share sheet on mobile, copy-link fallback on desktop.
// Records the share in the DB either way.
async function shareJob(job, onCopied) {
  const url = `https://www.hosposearch.com/jobs/${job.id}`
  recordJobShare(job.id)
  try {
    if (navigator.share) {
      await navigator.share({ title: `${job.title} — ${job.venue}`, text: `${job.title} at ${job.venue}`, url })
      return
    }
  } catch (e) { /* user dismissed the share sheet, or unsupported */ }
  try {
    await navigator.clipboard.writeText(url)
    onCopied && onCopied()
  } catch (e) {
    window.prompt("Copy this link:", url)
  }
}

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

// Salary with pay-type suffix (e.g. "AUD 80,000/yr", "AUD 35/hr")
function fmtSalary(job){
  const s = job && job.salary;
  if(!s || s === "Competitive") return s || "Competitive";
  const suf = job.payType === "Hourly" ? "/hr" : job.payType === "Monthly" ? "/mo" : job.payType === "Annually" ? "/yr" : "";
  if(!suf || s.endsWith(suf)) return s;
  return s + suf;
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
  .jb-card-track{display:flex;width:100%;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;}
  .jb-card-track::-webkit-scrollbar{display:none;}
  .jb-card-track img{flex:0 0 100%;width:100%;height:100%;object-fit:cover;display:block;scroll-snap-align:start;scroll-snap-stop:always;}
  .jb-card-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,0.92);color:${C.textDark};font-size:22px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;padding:0 0 2px;}
  .jb-card-arrow.prev{left:10px;} .jb-card-arrow.next{right:10px;}
  .jb-card-count{position:absolute;bottom:12px;right:12px;z-index:2;background:rgba(0,0,0,0.5);color:#fff;font-size:11px;font-weight:600;padding:3px 9px;border-radius:100px;pointer-events:none;}
  .jb-card-dots{position:absolute;bottom:14px;left:0;right:0;z-index:2;display:flex;justify-content:center;gap:5px;pointer-events:none;}
  .jb-card-dots span{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,0.55);transition:width 0.2s;}
  .jb-card-dots span.on{width:16px;background:#fff;}
  @media(hover:none){.jb-card-arrow{width:32px;height:32px;font-size:20px;opacity:0.9;}}
  .jb-badge{position:absolute;top:10px;left:10px;z-index:2;background:${C.featuredL};border:1px solid ${C.featured}55;color:${C.featured};font-size:10px;font-weight:700;padding:4px 10px;border-radius:100px;display:flex;align-items:center;gap:4px;}
  .jb-card-body{padding:14px 16px 16px;flex:1;display:flex;flex-direction:column;}
  .jb-venue{color:${C.textSoft};font-size:12px;font-weight:600;margin-bottom:4px;}
  .jb-title{font-family:'Fraunces','Playfair Display',serif;font-weight:700;font-size:19px;line-height:1.2;margin-bottom:5px;}
  .jb-salary{color:${C.sand};font-weight:700;font-size:14px;margin-bottom:9px;}
  .jb-short{color:${C.textMid};font-size:13px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:12px;flex:1;}
  .jb-meta{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:${C.textFaint};margin-top:auto;}
  .jb-meta .role{color:${C.terracotta};font-weight:700;font-size:12px;}
  .jb-empty{text-align:center;padding:80px 24px;color:${C.textSoft};}
  .jb-map{border:1px solid ${C.border};border-radius:16px;overflow:hidden;background:#fff;margin-bottom:28px;}
  .jb-map-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;flex-wrap:wrap;}
  .jb-map-title{font-weight:700;font-size:15px;}
  .jb-map-addr{font-size:14px;color:${C.textSoft};margin-top:2px;}
  .jb-map-dir{border:1.5px solid ${C.terracotta};color:${C.terracotta};padding:9px 16px;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;white-space:nowrap;}
  .jb-map-dir:hover{background:${C.terracottaL};}
  .jb-map iframe{display:block;width:100%;height:260px;border:0;border-top:1px solid ${C.border};}
  .jb-maplink{display:inline-block;margin-top:14px;color:${C.terracotta};font-weight:700;font-size:15px;text-decoration:none;}
  .jb-maplink:hover{text-decoration:underline;}
  .jb-footer{text-align:center;padding:40px 24px;border-top:1px solid ${C.border};color:${C.textSoft};font-size:13px;}
  .jb-footer a{color:${C.terracotta};text-decoration:none;font-weight:600;}
  /* Detail page */
  .jb-detail{max-width:760px;margin:0 auto;padding:24px;}
  .jb-new{position:absolute;top:10px;right:52px;background:${C.terracotta};color:#fff;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;border-radius:100px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:2;}
  .jb-gallery{position:relative;margin-bottom:24px;}
  .jb-gallery .jb-detail-hero{margin-bottom:0;}
  .jb-gallery-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
  .jb-gallery-track::-webkit-scrollbar{display:none;}
  .jb-gallery-track img{flex:0 0 100%;scroll-snap-align:start;}
  .jb-gal-btn{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,0.92);font-size:24px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);color:${C.textDark};}
  .jb-gal-prev{left:12px;} .jb-gal-next{right:12px;}
  .jb-gal-dots{position:absolute;bottom:12px;left:0;right:0;display:flex;justify-content:center;gap:6px;}
  .jb-gal-dots span{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.55);cursor:pointer;}
  .jb-gal-dots span.on{background:#fff;}
  .jb-back{display:inline-flex;align-items:center;gap:6px;color:${C.textSoft};text-decoration:none;font-size:14px;font-weight:600;margin-bottom:20px;}
  .jb-back:hover{color:${C.terracotta};}
  .jb-detail-hero{width:100%;aspect-ratio:4/5;max-height:min(78vh,720px);border-radius:18px;overflow:hidden;margin-bottom:24px;background:${C.bgSoft};}
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
  .jb-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;}
  .jb-share{background:#fff;border:1.5px solid ${C.border};color:${C.textMid};padding:15px 26px;border-radius:100px;font-size:15px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all 0.15s;font-family:inherit;}
  .jb-share:hover{border-color:${C.terracotta};color:${C.terracotta};}
  .jb-card-share{position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.92);border:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.14);font-size:14px;font-weight:700;color:${C.textMid};z-index:2;line-height:1;}
  .jb-card-share:hover{background:#fff;color:${C.terracotta};}
  .jb-browse{max-width:1120px;margin:0 auto;padding:0 24px 40px;}
  .jb-browse h2{font-family:'Fraunces','Playfair Display',serif;font-size:20px;font-weight:700;margin:24px 0 12px;}
  .jb-browse ul{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0;}
  .jb-browse a{display:inline-block;background:#fff;border:1px solid ${C.border};color:${C.textMid};font-size:13px;font-weight:600;padding:7px 14px;border-radius:100px;text-decoration:none;}
  .jb-browse a:hover{border-color:${C.terracotta};color:${C.terracotta};}
  /* Site header (homepage + jobs pages) */
  .jb-links{display:flex;align-items:center;gap:26px;margin-left:36px;margin-right:auto;}
  .jb-links a{color:${C.textSoft};font-size:15px;font-weight:500;text-decoration:none;padding:10px 0;}
  .jb-links a:hover,.jb-links a.on{color:${C.textDark};}
  .jb-links a.on{border-bottom:2px solid ${C.textDark};}
  .jb-acts{display:flex;align-items:center;gap:10px;}
  .jb-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:100px;font-size:15px;font-weight:600;text-decoration:none;white-space:nowrap;cursor:pointer;font-family:inherit;}
  .jb-btn-outline{border:1.5px solid ${C.terracotta};color:${C.terracotta};background:#fff;}
  .jb-btn-outline:hover{background:${C.terracottaL};}
  .jb-btn-ghost{border:1px solid ${C.border};background:${C.bgSoft};color:${C.textDark};}
  .jb-btn-ghost:hover{border-color:${C.borderMid};}
  .jb-btn-solid{border:0;background:${C.terracotta};color:#fff;font-weight:700;}
  .jb-btn-solid:hover{background:${C.terracottaD};}
  .jb-menu-btn{display:none;width:44px;height:44px;border:0;background:transparent;align-items:center;justify-content:center;cursor:pointer;margin-right:-8px;}
  .jb-mlogin{display:none;margin-left:auto;margin-right:4px;min-height:40px;padding:0 14px;font-size:14px;}
  .jb-acts button.jb-btn,.jb-mlogin{font-family:inherit;}
  .jb-menu-auth{display:flex;flex-direction:column;gap:10px;padding:14px 0 6px;}
  .jb-menu .lbl{display:block;font-size:14px;color:${C.textSoft};margin-top:4px;}
  .jb-btn.is-open{border-color:${C.textDark};background:#fff;}
  .jb-stay{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;color:${C.textMid};cursor:pointer;user-select:none;}
  .jb-stay input{width:18px;height:18px;margin:0;accent-color:${C.terracotta};cursor:pointer;flex-shrink:0;}
  .jb-menu .jb-stay{border:0;padding:0;}
  .jb-login .jb-stay{min-height:36px;}
  .jb-actions-col{flex-direction:column;align-items:flex-start;}
  .jb-login-apply{background:#fff;border:1.5px solid ${C.terracotta};color:${C.terracotta};padding:15px 30px;border-radius:100px;font-size:15px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;font-family:inherit;}
  .jb-login-apply:hover{background:${C.terracottaL};}
  .jb-login-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:6px;}
  .jb-menu .jb-login-foot a{min-height:44px;border:0;font-size:14px;font-weight:600;color:${C.terracotta};}
  @media(min-width:861px){
    .jb-menu.jb-login-panel{left:auto;right:24px;width:400px;border:1px solid ${C.border};border-radius:16px;margin-top:6px;padding:16px 18px 10px;}
  }
  .jb-menu .jb-menu-auth a,.jb-menu .jb-menu-auth button{min-height:50px;border:0;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:100px;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;font-family:inherit;}
  .jb-menu .jb-menu-auth button{border:1.5px solid #DADCE0;background:#fff;color:#1F1F1F;}
  .jb-menu .jb-menu-auth a{background:${C.textDark};color:#fff;}
  .jb-menu{display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid ${C.border};box-shadow:0 12px 24px rgba(0,0,0,0.08);padding:8px 16px 16px;}
  .jb-menu.open{display:block;}
  .jb-menu a{display:flex;align-items:center;min-height:48px;color:${C.textDark};font-size:16px;font-weight:600;text-decoration:none;border-bottom:1px solid ${C.bgSoft};}
  .jb-menu a.jb-menu-cta{justify-content:center;margin-top:12px;border:0;border-radius:100px;background:${C.terracotta};color:#fff;}
  /* Hero extras */
  .jb-post{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;min-height:54px;padding:0 30px;border-radius:100px;background:${C.terracotta};color:#fff;font-weight:700;font-size:17px;text-decoration:none;box-shadow:0 6px 18px rgba(196,98,58,0.3);transition:background 0.2s,transform 0.2s;}
  .jb-post:hover{background:${C.terracottaD};transform:translateY(-1px);}
  .jb-login{display:flex;background:${C.terracottaL};border:1px solid ${C.terracottaM};border-radius:16px;padding:24px 20px;text-align:left;flex-direction:column;justify-content:center;gap:12px;}
  .jb-login p{font-size:14px;color:${C.textMid};margin:0;}
  .jb-login button,.jb-login a{min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:100px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;font-family:inherit;}
  .jb-login button{border:1px solid #DADCE0;background:#fff;color:#1F1F1F;}
  .jb-login a{background:${C.textDark};color:#fff;}
  @media(max-width:860px){
    .jb-links,.jb-acts{display:none;}
    .jb-menu-btn{display:flex;}
    .jb-mlogin{display:inline-flex;}
    .jb-post{width:100%;max-width:560px;font-size:16px;min-height:52px;padding:0 16px;}
  }
  @media(max-width:600px){.jb-grid{padding:20px 16px 40px;gap:14px;}.jb-nav{padding:10px 16px;}.jb-hero{padding:32px 20px 20px;}}
  /* ── 2026-11 redesign: quieter chrome, venue photos carry the colour ── */
  .jb-nav{padding:0 24px;height:64px;}
  .jb-logo{font-weight:500;letter-spacing:-0.2px;}
  .jb-links a{font-size:14px;}
  .jb-acts{gap:12px;}
  .jb-btn{min-height:40px;padding:0 16px;border-radius:10px;font-size:14px;font-weight:600;transition:background-color 140ms ease,border-color 140ms ease,color 140ms ease;}
  .jb-btn-post{border:0;background:${C.terracottaD};color:#fff;}
  .jb-btn-post:hover{background:#86401F;}
  .jb-btn-login{border:1px solid ${C.borderMid};background:#fff;color:${C.textDark};gap:8px;}
  .jb-btn-login:hover{border-color:${C.textMid};}
  .jb-btn-dark{border:0;background:${C.textDark};color:#fff;}
  .jb-btn-dark:hover{background:#2A2622;}
  .jb-acts-div{width:1px;height:24px;background:${C.border};margin:0 2px;}
  .jb-venues-link{color:${C.textSoft};font-size:14px;font-weight:500;text-decoration:none;}
  .jb-venues-link:hover{color:${C.textDark};}
  /* Photo hero (homepage, desktop) */
  .jb-scene{position:relative;color:#F7F3EE;background:#1F1B16;overflow:hidden;}
  .jb-scene>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:75% 40%;}
  .jb-scene:before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(24,20,16,0.94) 0%,rgba(24,20,16,0.82) 36%,rgba(24,20,16,0.25) 66%,rgba(24,20,16,0.05) 100%);}
  .jb-scene:after{content:"";position:absolute;left:0;right:0;bottom:0;height:180px;z-index:1;background:linear-gradient(180deg,rgba(250,248,244,0) 0%,${C.bg} 100%);}
  .jb-scene-in{position:relative;z-index:2;max-width:1240px;margin:0 auto;padding:88px 32px 40px;}
  .jb-live{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:#D9D0C3;}
  .jb-live i{width:8px;height:8px;border-radius:4px;background:#5DBB7E;}
  .jb-scene h1{font-family:'Fraunces','Playfair Display',serif;font-weight:500;font-size:clamp(44px,6vw,76px);line-height:1.0;letter-spacing:-0.03em;margin:16px 0 0;max-width:620px;}
  .jb-scene h1 span{color:#E3A27F;}
  .jb-scene p.sub{margin:18px 0 0;font-size:19px;line-height:29px;color:#D9D0C3;max-width:34rem;}
  .jb-hsearch{margin-top:28px;display:flex;align-items:center;gap:10px;height:56px;padding:0 6px 0 16px;background:#fff;border-radius:12px;max-width:560px;box-shadow:0 12px 32px rgba(0,0,0,0.25);}
  .jb-hsearch input{flex:1;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:${C.textDark};}
  .jb-hsearch button{height:44px;padding:0 20px;border:0;border-radius:8px;background:${C.terracottaD};color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;}
  .jb-hsearch button:hover{background:#86401F;}
  .jb-hiring{margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 12px 12px 16px;border-radius:12px;background:rgba(24,20,16,0.55);border:1px solid rgba(247,243,238,0.16);max-width:560px;font-size:14px;}
  .jb-hiring span{color:#D9D0C3;} .jb-hiring strong{color:#F7F3EE;font-weight:600;}
  .jb-hiring a{margin-left:auto;display:inline-flex;align-items:center;height:40px;padding:0 16px;border-radius:8px;background:#F7F3EE;color:${C.textDark};font-weight:600;text-decoration:none;}
  .jb-hiring a:hover{background:#fff;}
  .jb-cchips{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;}
  .jb-cchips button{height:36px;padding:0 14px;border-radius:8px;border:1px solid rgba(247,243,238,0.24);background:transparent;color:#F7F3EE;font:inherit;font-size:14px;cursor:pointer;}
  .jb-cchips button.on{background:#F7F3EE;color:${C.textDark};border-color:#F7F3EE;font-weight:600;}
  .jb-cchips a{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 6px;color:#D9D0C3;font-size:14px;text-decoration:none;}
  .jb-float{margin-top:56px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;}
  .jb-float a{display:flex;gap:14px;padding:12px;background:#FDFBF8;border-radius:16px;box-shadow:0 12px 32px rgba(31,27,22,0.14);color:${C.textDark};text-decoration:none;min-width:0;}
  .jb-float img{width:88px;height:88px;border-radius:10px;object-fit:cover;flex:none;}
  .jb-float .v{font-size:14px;font-weight:600;} .jb-float .t{font-family:'Fraunces',serif;font-size:19px;line-height:1.2;} .jb-float .p{font-size:13px;color:${C.textSoft};}
  .jb-venuerow{border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};background:#F2EDE5;}
  .jb-venuerow .in{max-width:1240px;margin:0 auto;padding:16px 32px 18px;text-align:center;}
  .jb-venuerow small{display:block;font-size:12px;font-weight:500;color:${C.textSoft};margin-bottom:6px;}
  .jb-venuerow .names{display:flex;justify-content:center;align-items:center;gap:4px 8px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;}
  .jb-venuerow .names::-webkit-scrollbar{display:none;}
  .jb-venuerow button{flex:none;border:0;background:none;padding:6px 10px;border-radius:8px;font-family:'Fraunces',serif;font-size:19px;font-weight:500;color:#3A332B;cursor:pointer;white-space:nowrap;transition:background-color 140ms ease,color 140ms ease;}
  .jb-venuerow button:hover{background:rgba(31,27,22,0.06);color:${C.terracottaD};}
  .jb-venuerow .sep{flex:none;color:${C.textFaint};}
  .jb-listhead{max-width:1240px;margin:0 auto;padding:40px 32px 0;display:flex;align-items:baseline;justify-content:space-between;gap:16px;}
  .jb-listhead h2{margin:0;font-size:15px;font-weight:600;} .jb-listhead h2 span{color:${C.textSoft};font-weight:400;}
  .jb-grid{max-width:1240px;padding:20px 32px 64px;gap:24px;}
  /* Cards */
  .jb-card{border:1px solid ${C.border};box-shadow:none;transition:border-color 160ms ease;}
  .jb-card:hover{transform:none;box-shadow:none;border-color:${C.borderMid};}
  .jb-card-body{padding:18px 20px 20px;gap:6px;}
  .jb-venue{font-size:16px;font-weight:500;color:${C.textDark};margin:0;}
  .jb-title{font-weight:500;font-size:22px;margin:0;}
  .jb-short{color:${C.textSoft};font-size:14px;line-height:21px;margin:2px 0 0;}
  .jb-line{margin-top:auto;padding-top:12px;display:flex;align-items:baseline;font-size:14px;}
  .jb-line i{flex:1 1 auto;min-width:16px;border-bottom:1px dotted rgba(31,27,22,0.28);margin:0 8px;transform:translateY(-4px);}
  .jb-line b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;}
  .jb-line .comp{font-weight:400;color:${C.textSoft};}
  .jb-meta2{font-size:12px;color:${C.textSoft};}
  .jb-badge{background:rgba(253,251,248,0.95);border:0;color:${C.textDark};font-size:12px;font-weight:600;padding:4px 8px;border-radius:6px;}
  .jb-new{background:${C.textDark};border-radius:6px;font-weight:600;letter-spacing:0;font-size:11px;right:10px;}
  .jb-login{grid-column:1/-1;flex-direction:row;flex-wrap:wrap;align-items:center;gap:12px 24px;background:#EFE9DF;border:0;padding:24px;}
  .jb-login .txt{flex:1 1 320px;}
  .jb-login button,.jb-login a{min-height:44px;padding:0 18px;border-radius:10px;}
  .jb-login button{border:1px solid #747775;color:#1F1F1F;}
  .jb-login a.dark{background:${C.terracottaD};color:#fff;}
  .jb-login a.plain{background:transparent;color:${C.textDark};text-decoration:underline;padding:0 4px;}
  /* For venues */
  .jb-venues{background:#1F1B16;color:#F7F3EE;}
  .jb-venues-in{max-width:1240px;margin:0 auto;padding:80px 32px;display:flex;flex-wrap:wrap;align-items:center;gap:48px;}
  .jb-venues h2{margin:12px 0 0;font-family:'Fraunces',serif;font-weight:500;font-size:46px;line-height:1.06;letter-spacing:-0.02em;}
  .jb-venues p{margin:16px 0 0;font-size:17px;line-height:27px;color:#C9C0B3;max-width:32rem;}
  .jb-tiers{flex:1 1 560px;min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
  .jb-tier{display:flex;flex-direction:column;gap:8px;padding:24px 20px;border-radius:14px;background:#2A2520;border:1px solid rgba(247,243,238,0.08);color:#F7F3EE;text-decoration:none;transition:border-color 140ms ease;}
  .jb-tier:hover{border-color:rgba(227,162,127,0.7);}
  .jb-tier.pop{border-color:rgba(227,162,127,0.55);}
  .jb-tier .l{font-size:13px;font-weight:500;color:#E3A27F;}
  .jb-tier .pr{font-family:'Fraunces',serif;font-size:40px;line-height:1;font-variant-numeric:tabular-nums;}
  .jb-tier .pr small{font-family:'DM Sans',sans-serif;font-size:13px;color:#C9C0B3;}
  .jb-tier .d{font-size:13px;line-height:19px;color:#C9C0B3;flex:1;}
  .jb-tier .go{margin-top:8px;font-size:14px;font-weight:600;}
  .jb-vbtns{margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;}
  .jb-vbtns a{display:inline-flex;align-items:center;height:48px;padding:0 22px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;}
  .jb-vbtns a.p{background:${C.terracottaD};color:#fff;} .jb-vbtns a.p:hover{background:#86401F;}
  .jb-vbtns a.s{border:1px solid rgba(247,243,238,0.24);color:#F7F3EE;}
  .jb-footer{background:#1F1B16;color:#A39A8E;border-top:1px solid rgba(247,243,238,0.08);}
  .jb-footer a{color:#E3A27F;}
  @media(max-width:1000px){.jb-float{grid-template-columns:repeat(2,minmax(0,1fr));}.jb-float a:nth-child(3){display:none;}.jb-tiers{grid-template-columns:1fr;}}
  /* ── Mobile homepage: an Instagram-style feed ── */
  .m-wrap{font-family:'DM Sans',sans-serif;background:#FDFBF8;color:${C.textDark};min-height:100vh;padding-bottom:84px;}
  .m-head{position:sticky;top:0;z-index:40;padding:0 14px;background:rgba(253,251,248,0.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(31,27,22,0.06);}
  .m-bar{height:56px;display:flex;align-items:center;gap:8px;}
  .m-logo{border:0;background:none;padding:0;font-family:'Fraunces',serif;font-size:24px;font-weight:500;color:${C.textDark};text-decoration:none;cursor:pointer;}
  .m-logo span{color:${C.terracottaD};}
  .m-pill{height:36px;padding:0 13px;display:inline-flex;align-items:center;border-radius:18px;font:inherit;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;white-space:nowrap;}
  .m-pill.dark{border:0;background:${C.textDark};color:#F7F3EE;margin-left:auto;}
  .m-pill.line{border:1px solid rgba(31,27,22,0.22);background:transparent;color:${C.textDark};}
  .m-search{margin-bottom:10px;display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border-radius:12px;background:#F2EDE5;}
  .m-search input{flex:1;min-width:0;border:0;background:transparent;outline:none;font:inherit;font-size:16px;color:${C.textDark};}
  .m-search button{width:30px;height:30px;border:0;border-radius:15px;background:rgba(31,27,22,0.08);display:grid;place-items:center;cursor:pointer;color:${C.textDark};}
  .m-rail{display:flex;gap:4px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;}
  .m-rail::-webkit-scrollbar{display:none;}
  .m-stories{padding:12px 10px 10px;}
  .m-story{flex:none;width:76px;display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;padding:0;font:inherit;cursor:pointer;scroll-snap-align:start;color:${C.textDark};text-decoration:none;}
  .m-story .r{padding:3px;border-radius:40px;border:2px solid ${C.terracottaD};}
  .m-story.on .r{border-color:${C.textDark};}
  .m-story img,.m-story .plus{width:62px;height:62px;border-radius:31px;object-fit:cover;display:grid;place-items:center;background:#EFE9DF;}
  .m-story .plus{background:${C.terracottaD};color:#fff;}
  .m-story .plus.all{background:#F2EDE5;color:${C.textDark};font-size:15px;font-weight:600;}
  .m-story.post .r{border-style:dashed;border-color:rgba(176,79,42,0.55);}
  .m-story .n{font-size:12px;font-weight:500;white-space:nowrap;}
  .m-story.post .n{font-weight:600;color:${C.terracottaD};}
  .m-chips{gap:8px;padding:4px 14px 12px;border-bottom:1px solid rgba(31,27,22,0.06);}
  .m-chip{flex:none;scroll-snap-align:start;height:34px;padding:0 14px;border-radius:17px;border:1px solid rgba(31,27,22,0.14);background:transparent;color:${C.textDark};font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;}
  .m-chip.on{border-color:${C.textDark};background:${C.textDark};color:#F7F3EE;font-weight:600;}
  .m-count{padding:14px 14px 4px;font-size:13px;font-weight:500;color:${C.textSoft};}
  .m-back{position:sticky;top:110px;z-index:30;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(253,251,248,0.96);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(31,27,22,0.06);}
  .m-back button{height:34px;padding:0 12px 0 8px;display:inline-flex;align-items:center;gap:4px;border-radius:17px;border:1px solid rgba(31,27,22,0.16);background:#FDFBF8;color:${C.textDark};font:inherit;font-size:13px;font-weight:600;cursor:pointer;flex:none;}
  .m-back span{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .m-post{padding-bottom:22px;}
  .m-ph{display:flex;align-items:center;gap:10px;padding:10px 14px;}
  .m-av{width:36px;height:36px;border-radius:18px;overflow:hidden;flex:none;background:#EFE9DF;display:grid;place-items:center;font-family:'Fraunces',serif;color:${C.terracottaD};}
  .m-av img{width:36px;height:36px;object-fit:cover;display:block;}
  .m-vn{flex:1;min-width:0;line-height:1.25;}
  .m-vn b{display:block;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .m-vn b em{font-style:normal;font-size:12px;font-weight:500;color:${C.textSoft};}
  .m-vn small{font-size:12px;color:${C.textSoft};}
  .m-follow{height:32px;padding:0 14px;border-radius:8px;border:0;background:${C.terracottaD};color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer;flex:none;}
  .m-follow.on{background:transparent;border:1px solid rgba(31,27,22,0.16);color:${C.textDark};padding:0 12px;}
  .m-img{position:relative;display:block;width:100%;aspect-ratio:4/5;background:#EFE9DF;overflow:hidden;}
  .m-img>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
  .m-img .jb-card-track{position:absolute;inset:0;}
  .m-noimg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#E9E1D5;color:#3A332B;text-align:center;padding:24px;}
  .m-noimg b{font-family:'Fraunces',serif;font-size:30px;font-weight:500;line-height:1.1;}
  .m-acts{display:flex;align-items:center;gap:16px;padding:12px 14px 0;}
  .m-ico{border:0;background:none;padding:0;color:${C.textDark};cursor:pointer;display:flex;}
  .m-ico.on{color:${C.terracottaD};}
  .m-apply{margin-left:auto;height:38px;padding:0 20px;display:inline-flex;align-items:center;border-radius:10px;background:${C.terracottaD};color:#fff;font-size:14px;font-weight:600;text-decoration:none;}
  .m-txt{padding:10px 14px 0;}
  .m-txt .t{font-family:'Fraunces',serif;font-size:20px;font-weight:500;line-height:1.2;color:${C.textDark};text-decoration:none;display:block;}
  .m-txt .p{margin-top:4px;font-size:14px;} .m-txt .p b{font-weight:600;font-variant-numeric:tabular-nums;} .m-txt .p span{color:${C.textSoft};}
  .m-txt .c{margin-top:6px;font-size:14px;line-height:20px;color:#3A332B;}
  .m-txt .c .cl{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .m-txt .c a{color:${C.textSoft};text-decoration:none;font-size:14px;}
  .m-sales{margin:4px 14px 24px;padding:18px;border-radius:18px;background:#1F1B16;color:#F7F3EE;}
  .m-sales h3{margin:14px 0 0;font-family:'Fraunces',serif;font-size:24px;font-weight:500;line-height:1.1;}
  .m-sales .rail{margin:16px -18px 0;padding:0 18px;display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;}
  .m-sales .rail::-webkit-scrollbar{display:none;}
  .m-sales .rail a{flex:none;width:58%;scroll-snap-align:start;padding:14px;border-radius:14px;background:#2A2520;color:#F7F3EE;text-decoration:none;}
  .m-sales .rail a.pop{border:1px solid rgba(227,162,127,0.55);}
  .m-sales .rail .l{font-size:12px;color:#E3A27F;font-weight:500;}
  .m-sales .rail .pr{margin-top:6px;font-family:'Fraunces',serif;font-size:28px;}
  .m-sales .rail .pr small{font-family:'DM Sans',sans-serif;font-size:12px;color:#C9C0B3;}
  .m-sales .rail .d{margin-top:4px;font-size:12px;color:#C9C0B3;}
  .m-sales .go{margin-top:14px;display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;background:#F7F3EE;color:${C.textDark};font-size:15px;font-weight:600;text-decoration:none;}
  .m-signup{margin:4px 14px 24px;padding:18px;border-radius:18px;background:#EFE9DF;display:flex;flex-direction:column;gap:10px;}
  .m-signup b{font-family:'Fraunces',serif;font-size:22px;font-weight:500;}
  .m-signup button,.m-signup a.e{height:48px;border-radius:12px;font:inherit;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;text-decoration:none;}
  .m-signup button{border:1px solid #747775;background:#fff;color:#1F1F1F;}
  .m-signup a.e{border:0;background:${C.terracottaD};color:#fff;}
  .m-signup .li{text-align:center;font-size:14px;color:${C.textSoft};} .m-signup .li a{color:${C.textDark};font-weight:600;}
  .m-end{padding:8px 14px 24px;text-align:center;font-size:13px;color:${C.textSoft};}
  .m-empty{margin:24px 14px;padding:24px;border-radius:16px;background:#F2EDE5;text-align:center;font-size:14px;color:${C.textSoft};}
  .m-nav{position:fixed;left:0;right:0;bottom:0;z-index:45;height:72px;padding:6px 6px calc(8px + env(safe-area-inset-bottom));box-sizing:content-box;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:rgba(253,251,248,0.95);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid rgba(31,27,22,0.08);}
  .m-nav a,.m-nav button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:none;font:inherit;font-size:10px;font-weight:600;color:${C.textDark};text-decoration:none;cursor:pointer;}
  .m-nav .post{color:${C.terracottaD};}
  .m-nav .dot{position:absolute;top:2px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:${C.terracottaD};color:#fff;font-size:10px;line-height:16px;text-align:center;}
  .m-sheet{position:fixed;inset:0;z-index:60;}
  .m-sheet .bd{position:absolute;inset:0;border:0;background:rgba(24,20,16,0.45);cursor:pointer;}
  .m-sheet .pn{position:absolute;left:0;right:0;bottom:0;padding:12px 20px calc(28px + env(safe-area-inset-bottom));border-radius:24px 24px 0 0;background:#FDFBF8;display:flex;flex-direction:column;gap:12px;animation:m-up 260ms cubic-bezier(0.22,1,0.36,1);}
  @keyframes m-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
  .m-sheet .grab{align-self:center;width:40px;height:4px;border-radius:2px;background:rgba(31,27,22,0.18);}
  .m-sheet h3{margin:0;font-family:'Fraunces',serif;font-size:24px;font-weight:500;line-height:1.15;}
  .m-sheet p{margin:0;font-size:14px;line-height:20px;color:${C.textSoft};}
  .m-sheet button.g,.m-sheet a.e{height:50px;border-radius:12px;font:inherit;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;cursor:pointer;}
  .m-sheet button.g{border:1px solid #747775;background:#fff;color:#1F1F1F;font-weight:500;}
  .m-sheet a.e{background:${C.terracottaD};color:#fff;}
  .m-sheet .x{position:absolute;top:14px;right:14px;width:36px;height:36px;border:0;border-radius:18px;background:#EFE9DF;display:grid;place-items:center;cursor:pointer;color:${C.textDark};}
  .m-toast{position:fixed;left:16px;right:16px;bottom:96px;z-index:55;padding:12px 16px;border-radius:12px;background:#1F1B16;color:#F7F3EE;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.2);}
  .m-browse .jb-browse{padding:0 14px 24px;}
`

// Same Google sign-in the /app login screen uses; lands on /app signed in.
async function signInWithGoogle() {
  setStayLoggedIn(getStayLoggedIn(), true)
  try {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app', queryParams: { prompt: 'select_account' } },
    })
  } catch (e) { window.location.href = '/app?login=1' }
}

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
)

// Where the header / hero buttons go. Post a job opens the existing pricing popup on /about.
const LINKS = { home: '/', pricing: '/about#pricing', about: '/about', post: '/about?post=1', login: '/app?login=1', signup: '/app?signup=1', account: '/app' }

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
)

// "Keep me logged in on this device" — ticked by default. The choice is saved
// straight away so it carries through Google sign-in and the email login screen.
function StayLoggedIn() {
  const [on, setOn] = useState(getStayLoggedIn)
  return (
    <label className="jb-stay">
      <input type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); setStayLoggedIn(e.target.checked) }} />
      <span>Keep me logged in on this device</span>
    </label>
  )
}

// Google + email sign-in buttons, used in the Log in dropdown.
function AuthButtons() {
  return (
    <div className="jb-menu-auth">
      <button type="button" onClick={signInWithGoogle}><GoogleG/> Continue with Google</button>
      <Link to={LINKS.login}><MailIcon/> Log in with email</Link>
      <StayLoggedIn/>
    </div>
  )
}

// Every photo on the listing, swipeable on mobile, arrows on desktop.
// Shown to everyone; only applying needs a login.
function PhotoGallery({ photos, alt }) {
  const [idx, setIdx] = useState(0)
  const ref = useRef(null)
  const go = (i) => {
    const el = ref.current; if (!el) return
    const n = Math.max(0, Math.min(photos.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => { const el = ref.current; if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth)) }
  if (!photos.length) return null
  return (
    <div className="jb-gallery">
      <div className="jb-detail-hero jb-gallery-track" ref={ref} onScroll={onScroll}>
        {photos.map((p, i) => <img key={i} src={p} alt={i === 0 ? alt : `${alt} (photo ${i + 1})`} loading={i ? 'lazy' : 'eager'} />)}
      </div>
      {photos.length > 1 && <>
        {idx > 0 && <button type="button" className="jb-gal-btn jb-gal-prev" aria-label="Previous photo" onClick={() => go(idx - 1)}>‹</button>}
        {idx < photos.length - 1 && <button type="button" className="jb-gal-btn jb-gal-next" aria-label="Next photo" onClick={() => go(idx + 1)}>›</button>}
        <div className="jb-gal-dots">{photos.map((_, i) => <span key={i} className={i === idx ? 'on' : ''} onClick={() => go(i)} />)}</div>
      </>}
    </div>
  )
}

// "New listing" badge for a listing's first 3 days
const isNewListing = (j) => !!j?.ts && (Date.now() - j.ts) < 3*24*60*60*1000

// All of a listing's photos on its card: swipe on phones, arrows on desktop.
// Arrow taps don't open the listing; tapping the photo itself still does.
function CardPhotos({ photos, alt }) {
  const [idx, setIdx] = useState(0)
  const ref = useRef(null)
  const go = (e, i) => {
    e.preventDefault(); e.stopPropagation()
    const el = ref.current; if (!el) return
    const n = Math.max(0, Math.min(photos.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = ref.current
    if (el && el.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }
  if (photos.length <= 1) return <img src={photos[0]} alt={alt} loading="lazy" className="jb-main"/>
  return (
    <>
      <div className="jb-card-track" ref={ref} onScroll={onScroll}>
        {photos.map((p, i) => <img key={i} src={p} alt={i === 0 ? alt : `${alt} (photo ${i + 1})`} loading="lazy" draggable={false}/>)}
      </div>
      {idx > 0 && <button type="button" className="jb-card-arrow prev" aria-label="Previous photo" onClick={(e) => go(e, idx - 1)}>‹</button>}
      {idx < photos.length - 1 && <button type="button" className="jb-card-arrow next" aria-label="Next photo" onClick={(e) => go(e, idx + 1)}>›</button>}
      {photos.length <= 8
        ? <div className="jb-card-dots" aria-hidden="true">{photos.map((_, i) => <span key={i} className={i === idx ? 'on' : ''}/>)}</div>
        : <div className="jb-card-count" aria-hidden="true">{idx + 1}/{photos.length}</div>}
    </>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────
// Internal links to role / location pages — helps Google find them, helps people browse
function BrowseLinks({ jobs, only }) {
  const idx = useMemo(() => landingIndex(jobs), [jobs])
  const sections = only ? [["Related searches", only]] : [
    ["Award-winning venues", idx.awards],
    ["Browse by role", idx.roles],
    ["Browse by location", idx.places],
    ["Popular searches", idx.combos.slice(0, 40)],
  ]
  return (
    <div className="jb-browse">
      {sections.filter(([,arr]) => arr.length).map(([h, arr]) => (
        <section key={h}>
          <h2>{h}</h2>
          <ul>{arr.map(l => <li key={l.path}><Link to={l.path}>{l.label}{l.count ? ` (${l.count})` : ""}</Link></li>)}</ul>
        </section>
      ))}
    </div>
  )
}

// The browse-by-map page loads its map library on demand, so it costs nothing
// on the pages most visitors and Google land on.
const JobsMap = lazy(() => import('./JobsMap.jsx'))

// Map and directions for one role. Shows nothing if we have no street address.
function JobMap({ job }) {
  const m = mapLinks(job)
  if (!m) return null
  return (
    <div className="jb-map">
      <div className="jb-map-head">
        <div>
          <div className="jb-map-title">Where you'll work</div>
          {m.label && <div className="jb-map-addr">{m.label}</div>}
        </div>
        {m.directions && <a href={m.directions} target="_blank" rel="noopener" className="jb-map-dir">Get directions ↗</a>}
      </div>
      {m.embed && <iframe title={`Map showing ${job.venue}`} src={m.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
    </div>
  )
}

// ─── Shared helpers for the homepage ──────────────────────────────────────────
// "Featured" means a venue paid for it. Listings HospoSearch adds itself are
// never shown as Featured, even if the flag is set, so the badge always means paid.
const isPaidFeatured = (j) => !!j?.featured && !!j?.empId && j.empId !== 'admin'
// Only listings posted from a real employer account have a venue to follow.
const canFollow = (j) => !!j?.empId && j.empId !== 'admin'
const STATE_ABBR = { 'New South Wales':'NSW', 'Victoria':'VIC', 'Queensland':'QLD', 'Western Australia':'WA', 'South Australia':'SA', 'Tasmania':'TAS', 'Northern Territory':'NT', 'Australian Capital Territory':'ACT' }
function placeOf(j) {
  const city = (j.city || (j.loc || '').split(',')[0] || '').trim()
  const tail = j.country === 'Australia' ? (STATE_ABBR[j.state] || j.state) : j.country === 'New Zealand' ? 'NZ' : j.country === 'United Kingdom' ? 'UK' : j.country
  return [city, tail].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ')
}
const isComp = (j) => !j.salary || /^competitive$/i.test(j.salary.trim()) || /^not stated$/i.test(j.salary.trim())
// Pay in one short format, like a menu price: "$70–80k", "$30–35/hr", "From $65k".
function payOf(j) {
  if (isComp(j)) return 'Competitive'
  const raw = String(j.salary).trim()
  const cur = /£/.test(raw) ? '£' : (/\bNZ\$|NZD/i.test(raw) ? 'NZ$' : '$')
  const nums = (raw.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0).slice(0, 2)
  if (!nums.length) return /award/i.test(raw) ? 'Award rate' : raw.length > 28 ? 'Competitive' : raw
  const hourly = /hour|\/hr|p\/h|ph\b/i.test(raw) || j.payType === 'Hourly' || Math.max(...nums) < 300
  const extra = /(\+|plus)\s*super/i.test(raw) ? ' + super' : /\+\s*tips/i.test(raw) ? ' + tips' : ''
  const from = /^from\b/i.test(raw) && nums.length === 1 ? 'From ' : ''
  if (hourly) {
    const f = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
    return from + cur + (nums.length === 2 ? `${f(nums[0])}–${f(nums[1])}` : f(nums[0])) + '/hr' + extra
  }
  const k = (n) => n >= 1000 ? `${Math.round(n / 100) / 10}`.replace(/\.0$/, '') : String(n)
  return from + cur + (nums.length === 2 ? `${k(nums[0])}–${k(nums[1])}k` : `${k(nums[0])}k`) + extra
}
const realPhotos = (j) => (j.photos || []).filter(isData)

// Where Apply goes. Same rules as the job page: through HospoSearch whenever the
// venue has an apply email; the venue's own site only when there's no other way.
function applyLink(job, signedIn) {
  const ext = job.link && job.link.trim() && job.link.trim() !== '#' && !(job.applyEmail && job.applyEmail.trim())
  if (ext) return { href: trackedLink(job.link), external: true }
  return { to: signedIn === false ? `/app?apply=${job.id}` : '/app', external: false }
}
const rememberApply = (job) => { try { localStorage.setItem('hs_apply_after_login', JSON.stringify({ id: job.id, ts: Date.now() })) } catch (e) {} }

function ApplyButton({ job, signedIn, className, children }) {
  const a = applyLink(job, signedIn)
  if (a.external) return <a href={a.href} target="_blank" rel="noopener" className={className}>{children}</a>
  return <Link to={a.to} className={className} onClick={() => rememberApply(job)}>{children}</Link>
}

const Ico = ({ d, size = 24, sw = 1.6, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
)
const IC = {
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
  book: '<path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>',
  share: '<path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4z"></path>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="5"></rect><path d="M12 8v8M8 12h8"></path>',
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"></path>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"></path><path d="M9 4v13.5M15 6.5V20"></path>',
  x: '<path d="M18 6 6 18M6 6l12 12"></path>',
  back: '<path d="m15 18-6-6 6-6"></path>',
}

// Distinct venues for the "Hiring now" row, in the same fresh order as the feed.
function hiringVenues(jobs, n = 6) {
  const seen = new Set(), out = []
  for (const j of paidFirst(jobs)) {
    const v = (j.venue || '').trim()
    if (!v || v === 'HospoSearch' || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase()); out.push(v)
    if (out.length >= n) break
  }
  return out
}

function SiteHeader({ signedIn, onHome }) {
  // Which dropdown is open: null, 'menu' (hamburger) or 'login'
  const [open, setOpen] = useState(null)
  const toggle = (which) => setOpen(o => (o === which ? null : which))

  // Close on Escape or a tap outside the header
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    const onDown = (e) => { if (!e.target.closest('.jb-nav')) setOpen(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  const loginBtn = (extra) => signedIn
    ? <Link to={LINKS.account} className={`jb-btn jb-btn-dark ${extra}`}>My account</Link>
    : <button type="button" className={`jb-btn jb-btn-login ${extra} ${open === 'login' ? 'is-open' : ''}`}
        aria-expanded={open === 'login'} aria-controls="jb-login-panel" onClick={() => toggle('login')}>
        <Ico d={IC.user} size={16} />
        Log in
      </button>

  return (
    <nav className="jb-nav">
      <Link to={LINKS.home} className="jb-logo"><span>Hospo</span>Search</Link>
      <div className="jb-links">
        <Link to={LINKS.home} className={onHome ? 'on' : ''} aria-current={onHome ? 'page' : undefined}>Jobs</Link>
        <Link to={LINKS.pricing}>Pricing</Link>
        <Link to={LINKS.about}>About</Link>
      </div>
      <div className="jb-acts">
        <Link to={LINKS.post} className="jb-btn jb-btn-post">Post a job</Link>
        <span className="jb-acts-div" aria-hidden="true" />
        {loginBtn('')}
        {!signedIn && <Link to={LINKS.signup} className="jb-btn jb-btn-dark">Sign up free</Link>}
      </div>
      {loginBtn('jb-mlogin')}
      <button className="jb-menu-btn" aria-label={open === 'menu' ? 'Close menu' : 'Open menu'} aria-expanded={open === 'menu'} onClick={() => toggle('menu')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textDark} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open === 'menu' ? <path d="M6 6l12 12M18 6 6 18"/> : <path d="M4 7h16M4 12h16M4 17h16"/>}
        </svg>
      </button>

      {/* Hamburger menu (mobile) */}
      <div className={`jb-menu ${open === 'menu' ? 'open' : ''}`} onClick={() => setOpen(null)}>
        <Link to={LINKS.home}>Jobs</Link>
        <Link to={LINKS.pricing}>Pricing</Link>
        <Link to={LINKS.about}>About</Link>
        {signedIn && <Link to={LINKS.account}>My account</Link>}
        <Link to={LINKS.post} className="jb-menu-cta">Post a job</Link>
      </div>

      {/* Log in dropdown (mobile: full width like the menu; desktop: under the button) */}
      {!signedIn && (
        <div id="jb-login-panel" className={`jb-menu jb-login-panel ${open === 'login' ? 'open' : ''}`}>
          <div className="jb-serif" style={{ fontSize:20, fontWeight:500, paddingTop:6 }}>Log in or sign up</div>
          <span className="lbl">Free for job seekers. Save jobs and apply in one tap.</span>
          <AuthButtons/>
          <div className="jb-login-foot">
            <Link to={LINKS.signup} onClick={() => setOpen(null)}>New here? Create an account</Link>
            <Link to="/app?login=1&type=employer" onClick={() => setOpen(null)}>Employer log in →</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// Sign-up panel that sits in the job list after the first row, so people see jobs first.
// Only shown to logged-out visitors.
function SignInCard() {
  return (
    <div className="jb-login">
      <div className="txt">
        <div className="jb-serif" style={{ fontSize:22, fontWeight:500, lineHeight:1.2 }}>Save roles and apply in one tap</div>
        <p style={{ marginTop:4 }}>Free for job seekers. Already a member? <Link to={LINKS.login} style={{ color:C.textDark, fontWeight:600, textDecoration:'underline', minHeight:0, padding:0, display:'inline', background:'none' }}>Log in</Link></p>
      </div>
      <button type="button" onClick={signInWithGoogle}><GoogleG/> Sign up with Google</button>
      <Link to={LINKS.signup} className="dark">Sign up free with email</Link>
    </div>
  )
}

function JobCard({ job }) {
  const photos = realPhotos(job)
  return (
    <Link to={`/jobs/${job.id}`} className="jb-card">
      <div className="jb-card-img">
        {photos.length
          ? <img src={photos[0]} alt={`${job.title} at ${job.venue}`} loading="lazy" className="jb-main"/>
          : <div className="m-noimg"><b>{job.venue || 'HospoSearch'}</b><span style={{ fontSize:13, color:C.textSoft }}>{placeOf(job)}</span></div>}
        {job.tier === 'shift'
          ? <div className="jb-badge">Shift cover</div>
          : isPaidFeatured(job) && <div className="jb-badge">Featured</div>}
        {isNewListing(job) && <div className="jb-new">New</div>}
      </div>
      <div className="jb-card-body">
        <div className="jb-venue">{job.venue}</div>
        <div className="jb-title jb-serif">{job.title}</div>
        {stripTags(job.short) && <div className="jb-short">{stripTags(job.short)}</div>}
        <div className="jb-line">
          <span>{placeOf(job)}</span><i aria-hidden="true" />
          <b className={isComp(job) ? 'comp' : ''}>{payOf(job)}</b>
        </div>
        <div className="jb-meta2">{[job.type, ago(job.ts) === 'today' ? 'Posted today' : `Posted ${ago(job.ts)} ago`].filter(Boolean).join(' · ')}</div>
      </div>
    </Link>
  )
}

const COUNTRY_ORDER = ['Australia', 'New Zealand', 'United Kingdom', 'Ireland']
const sortCountries = (list) => [...list].sort((a, b) => {
  const ia = COUNTRY_ORDER.indexOf(a), ib = COUNTRY_ORDER.indexOf(b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
})
const searchHay = (j) => `${j.title} ${j.venue} ${j.loc} ${j.city} ${j.state} ${j.country} ${j.address} ${j.sector} ${j.roleType} ${(j.tags||[]).join(" ")}`.toLowerCase()
const matchesQuery = (j, q) => {
  if (!q.trim()) return true
  // Every word typed must appear somewhere. City and address are included so
  // "gold coast" finds a Southport venue and "burleigh" finds one listed under Gold Coast.
  const hay = searchHay(j)
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))
}
// Every refresh shows a fresh order. Paying venues always land somewhere in the
// first six places, in a different spot each time; everyone else is fully
// shuffled. Positions come from feedRank, which is fixed for the life of the
// page, so filtering or searching doesn't reshuffle what you're looking at.
const paidFirst = (list) => {
  const paid = list.filter(isPaidFeatured).sort((a, b) => feedRank(a.id) - feedRank(b.id))
  const rest = list.filter(j => !isPaidFeatured(j)).sort((a, b) => feedRank(a.id) - feedRank(b.id))
  const slots = Math.max(6, paid.length)
  const pos = new Map()
  paid.forEach(j => {
    let p = Math.floor(feedRank(`slot:${j.id}`) * slots)
    while ([...pos.values()].includes(p)) p = (p + 1) % slots
    pos.set(String(j.id), p)
  })
  const out = []
  let r = 0
  const byPos = [...paid].sort((a, b) => pos.get(String(a.id)) - pos.get(String(b.id)))
  for (const j of byPos) {
    while (out.length < pos.get(String(j.id)) && r < rest.length) out.push(rest[r++])
    out.push(j)
  }
  while (r < rest.length) out.push(rest[r++])
  return out
}

function VenuesSection() {
  return (
    <section className="jb-venues" aria-label="For venues">
      <div className="jb-venues-in">
        <div style={{ flex:'1 1 400px', minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#E3A27F' }}>For venues</div>
          <h2>Put your role in front of hospo people who want it</h2>
          <p>Your role goes in front of hospitality professionals across Australia and New Zealand. Pay per listing or subscribe if you're always hiring.</p>
          <div className="jb-vbtns">
            <Link to={LINKS.post} className="p">Post my job from $9.95</Link>
            <Link to={LINKS.pricing} className="s">See pricing</Link>
          </div>
          <div style={{ marginTop:16, display:'flex', alignItems:'flex-start', gap:8, fontSize:13, lineHeight:'20px', color:'#C9C0B3' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex:'none', marginTop:2 }}><path d="M20 6 9 17l-5-5"/></svg>Start with your name, venue and email. Your listing saves to your account as you go and you pay on the last step</div>
        </div>
        <div className="jb-tiers">
          <Link to="/app?tier=shift&mode=listing" className="jb-tier"><span className="l">Shift cover</span><span className="pr">$9.95</span><span className="d">A 3-day listing for extra hands on a busy weekend or event</span><span className="go">Post a shift cover →</span></Link>
          <Link to="/app?tier=bronze&mode=listing" className="jb-tier pop"><span className="l">Single role</span><span className="pr"><small>from </small>$50</span><span className="d">A full listing, live for 30 days</span><span className="go">Post a role →</span></Link>
          <Link to="/app?tier=starter&mode=subscription" className="jb-tier"><span className="l">Hiring multiple roles</span><span className="pr"><small>from </small>$125<small>/mo</small></span><span className="d">A subscription for venues and groups always hiring</span><span className="go">See plans →</span></Link>
        </div>
      </div>
    </section>
  )
}

function JobsList({ jobs: allJobs, loading, landing, signedIn, home }) {
  const jobs = useMemo(() => landing ? allJobs.filter(j => jobMatchesLanding(j, landing)) : allJobs, [allJobs, landing])
  const copy = landing ? landingCopy(landing, allJobs, jobs.length) : null
  const [q, setQ] = useState("")
  const [country, setCountry] = useState("All")
  const listRef = useRef(null)

  const countries = useMemo(() => ["All", ...sortCountries(Array.from(new Set(jobs.map(j=>j.country).filter(Boolean))))], [jobs])
  const filtered = useMemo(() => paidFirst(jobs.filter(j => (country === "All" || j.country === country) && matchesQuery(j, q))), [jobs, q, country])

  // Structured data for these pages is rendered server-side (api/seo.js)
  useSEO({
    title: copy ? copy.title : home ? "HospoSearch — Hospitality Jobs in Australia & New Zealand" : "Hospitality Jobs in Australia, New Zealand & Beyond | HospoSearch",
    description: copy ? copy.description : "Browse chef, sommelier, venue manager and front-of-house roles across Australia, New Zealand and the world's best restaurants. Updated daily on HospoSearch.",
    canonical: landing
      ? `https://www.hosposearch.com/jobs/${landing.group}-jobs${landing.place ? "-"+landing.place : ""}`
      : "https://www.hosposearch.com/",
    jsonLd: null,
  })

  const showcase = useMemo(() => paidFirst(jobs.filter(j => realPhotos(j).length)).slice(0, 3), [jobs])
  const venues = useMemo(() => hiringVenues(jobs, 5), [jobs])
  const toList = () => { try { listRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }) } catch (e) {} }

  return (
    <>
      {copy ? (
        <div className="jb-hero">
          <h1 className="jb-serif" style={{ fontWeight:500 }}>{copy.h1}</h1>
          <p>{loading ? "Loading roles…" : copy.intro}</p>
          <div className="jb-search">
            <Ico d={IC.search} size={18} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search roles, venues or cities" aria-label="Search roles" />
          </div>
        </div>
      ) : (
        <section className="jb-scene">
          <img src="/hero-cafe.jpg" alt="" fetchpriority="high" />
          <div className="jb-scene-in">
            <div style={{ maxWidth:600 }}>
              <div className="jb-live"><i aria-hidden="true" />{loading ? 'Loading roles' : `${jobs.length} roles live today`}</div>
              <h1>Your next venue is <span>hiring</span></h1>
              <p className="sub">Chefs, sommeliers, waitstaff and managers. Roles at hatted, Michelin and neighbourhood venues across Australia and New Zealand</p>
              <form className="jb-hsearch" role="search" onSubmit={e => { e.preventDefault(); toList() }}>
                <Ico d={IC.search} size={18} />
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Role, venue or city" aria-label="Search roles" />
                <button type="submit">Search jobs</button>
              </form>
              <div className="jb-hiring">
                <span><strong>Hiring?</strong> Reach hospo people across AU and NZ</span>
                <Link to={LINKS.post}>Post my job from $9.95 →</Link>
              </div>
              {countries.length > 2 && (
                <div className="jb-cchips" role="group" aria-label="Country">
                  <Link to="/map"><Ico d={IC.map} size={16} />Map</Link>
                  {countries.map(c => <button key={c} type="button" className={country===c ? 'on' : ''} aria-pressed={country===c} onClick={()=>{ setCountry(c); toList() }}>{c === 'All' ? 'All regions' : c}</button>)}
                </div>
              )}
            </div>
            {showcase.length >= 2 && (
              <div className="jb-float">
                {showcase.map(j => (
                  <Link key={j.id} to={`/jobs/${j.id}`}>
                    <img src={realPhotos(j)[0]} alt="" loading="lazy" />
                    <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:4, minWidth:0 }}>
                      <span className="v">{j.venue} · {(j.city || placeOf(j)).split(',')[0]}</span>
                      <span className="t">{j.title}</span>
                      <span className="p">{payOf(j)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {!copy && venues.length > 0 && (
        <section className="jb-venuerow" aria-label="Venues hiring">
          <div className="in">
            <small>Hiring now on HospoSearch</small>
            <div className="names">
              {venues.map((v, i) => (
                <Fragment key={v}>
                  {i > 0 && <span className="sep" aria-hidden="true">·</span>}
                  <button type="button" onClick={() => { setCountry('All'); setQ(v); toList() }} title={`See roles at ${v}`}>{v}</button>
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      )}

      {copy && countries.length > 2 && (
        <div className="jb-filters">
          {countries.map(c => (
            <button key={c} className={`jb-pill ${country===c?"active":""}`} aria-pressed={country===c} onClick={()=>setCountry(c)}>{c}</button>
          ))}
        </div>
      )}

      <div className="jb-listhead" ref={listRef} style={{ scrollMarginTop:72 }}>
        <h2>{loading ? 'Loading roles' : `${filtered.length} ${filtered.length === 1 ? 'role' : 'roles'}`} <span>{q.trim() ? `· matching “${q.trim()}”` : country !== 'All' ? `· ${country}` : ''}</span></h2>
        {(q || country !== 'All') && <button type="button" className="jb-btn jb-btn-login" onClick={() => { setQ(''); setCountry('All') }}>Clear filters</button>}
      </div>
      {loading ? (
        <div className="jb-empty">Loading hospitality roles…</div>
      ) : filtered.length===0 ? (
        <div className="jb-empty">
          <div style={{ marginBottom:12 }}>No roles match your search just yet.</div>
          <button type="button" className="jb-btn jb-btn-login" onClick={() => { setQ(''); setCountry('All') }}>Show all roles</button>
        </div>
      ) : (
        <div className="jb-grid">
          {filtered.map((j, i) => (
            <Fragment key={j.id}>
              <JobCard job={j} />
              {signedIn === false && i === Math.min(5, filtered.length - 1) && <SignInCard />}
            </Fragment>
          ))}
        </div>
      )}
      {landing && <div style={{ textAlign:"center", paddingBottom:24 }}><Link to="/" className="jb-btn jb-btn-dark">See all hospitality jobs</Link></div>}
      {!loading && <BrowseLinks jobs={allJobs} />}
      <VenuesSection />
      <div className="jb-footer">
        Are you hiring? <Link to={LINKS.post}>Post a role on HospoSearch →</Link> · <Link to={LINKS.about}>About HospoSearch</Link>
      </div>
    </>
  )
}

// ─── Mobile homepage: an Instagram-style feed ─────────────────────────────────
const ROLE_STORIES = [
  { key:'chef', label:'Chefs', words:['chef','cook','commis','cdp','kitchen'] },
  { key:'foh', label:'Front of house', words:['waiter','waitstaff','wait staff','server','front of house','host','section','barista','bartender'] },
  { key:'som', label:'Sommeliers', words:['sommelier','wine'] },
  { key:'bar', label:'Bartenders', words:['bartender','bar manager','mixolog'] },
  { key:'mgr', label:'Managers', words:['manager','supervisor','lead'] },
  { key:'pastry', label:'Pastry', words:['pastry','baker','patiss'] },
]
const roleMatch = (j, story) => { const t = ` ${(j.title||'').toLowerCase()} `; return story.words.some(w => t.includes(w)) }

// Phones get the feed. If someone ticks "Desktop site" in their browser they
// get the desktop layout, as they asked.
function detectMobile() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(max-width: 860px)').matches
}
function useIsMobile() {
  const [m, setM] = useState(detectMobile)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(max-width: 860px)')
    const f = () => setM(detectMobile())
    f()
    mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f)
    window.addEventListener('resize', f)
    window.addEventListener('pageshow', f)
    window.addEventListener('orientationchange', f)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f)
      window.removeEventListener('resize', f); window.removeEventListener('pageshow', f); window.removeEventListener('orientationchange', f)
    }
  }, [])
  return m
}

function MobilePost({ job, signedIn, saved, following, onSave, onFollow, onShare }) {
  const photos = realPhotos(job)
  const short = stripTags(job.short)
  return (
    <article className="m-post">
      <div className="m-ph">
        <span className="m-av">{photos[0] ? <img src={photos[0]} alt="" loading="lazy" /> : (job.venue || 'H').charAt(0)}</span>
        <div className="m-vn">
          <b>{job.venue}{isPaidFeatured(job) && <em> · Featured</em>}{job.tier === 'shift' && <em> · Shift cover</em>}</b>
          <small>{placeOf(job)}</small>
        </div>
        {canFollow(job) && (
          <button type="button" className={`m-follow ${following ? 'on' : ''}`} aria-pressed={following} onClick={() => onFollow(job)}>{following ? 'Following' : 'Follow'}</button>
        )}
      </div>
      <Link to={`/jobs/${job.id}`} className="m-img" aria-label={`${job.title} at ${job.venue}`}>
        {photos.length
          ? (photos.length > 1 ? <CardPhotos photos={photos} alt={`${job.title} at ${job.venue}`} /> : <img src={photos[0]} alt={`${job.title} at ${job.venue}`} loading="lazy" />)
          : <div className="m-noimg"><b>{job.venue || 'HospoSearch'}</b><span style={{ fontSize:13, color:C.textSoft }}>{placeOf(job)}</span></div>}
      </Link>
      <div className="m-acts">
        <button type="button" className={`m-ico ${saved ? 'on' : ''}`} aria-label={saved ? 'Saved' : 'Save role'} aria-pressed={saved} onClick={() => onSave(job)}>
          <Ico d={IC.book} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="m-ico" aria-label="Share role" onClick={() => onShare(job)}><Ico d={IC.share} /></button>
        <ApplyButton job={job} signedIn={signedIn} className="m-apply">Apply</ApplyButton>
      </div>
      <div className="m-txt">
        <Link to={`/jobs/${job.id}`} className="t">{job.title}</Link>
        <div className="p"><b>{payOf(job)}</b><span>{[job.type, ago(job.ts) === 'today' ? 'today' : `${ago(job.ts)} ago`].filter(Boolean).map(x => ` · ${x}`).join('')}</span></div>
        {short && <div className="c"><span className="cl"><b style={{ fontWeight:600, color:C.textDark }}>{job.venue}</b> {short}</span><Link to={`/jobs/${job.id}`}>more</Link></div>}
      </div>
    </article>
  )
}

function MobileSales() {
  return (
    <section className="m-sales" aria-label="For venues">
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ width:36, height:36, borderRadius:18, display:'grid', placeItems:'center', background:C.terracottaD, color:'#fff' }}><Ico d={IC.plus} size={20} /></span>
        <div style={{ lineHeight:1.25 }}><div style={{ fontSize:15, fontWeight:600 }}>Hiring?</div><div style={{ fontSize:12, color:'#C9C0B3' }}>Reach hospo people across AU and NZ</div></div>
      </div>
      <h3>Put your role in front of hospo people who want it</h3>
      <div className="rail">
        <Link to="/app?tier=shift&mode=listing"><div className="l">Shift cover</div><div className="pr">$9.95</div><div className="d">3-day listing</div></Link>
        <Link to="/app?tier=bronze&mode=listing" className="pop"><div className="l">Single role</div><div className="pr"><small>from </small>$50</div><div className="d">Live for 30 days</div></Link>
        <Link to="/app?tier=starter&mode=subscription"><div className="l">Multiple roles</div><div className="pr"><small>from </small>$125<small>/mo</small></div><div className="d">Subscription</div></Link>
        <span style={{ flex:'none', width:4 }} />
      </div>
      <Link to={LINKS.post} className="go">Post my job</Link>
    </section>
  )
}

function MobileSignup() {
  return (
    <section className="m-signup">
      <b>Save roles and apply in one tap</b>
      <span style={{ fontSize:14, color:C.textSoft }}>Free for job seekers</span>
      <button type="button" onClick={signInWithGoogle}><GoogleG/> Sign up with Google</button>
      <Link to={LINKS.signup} className="e">Sign up free with email</Link>
      <div className="li">Already a member? <Link to={LINKS.login}>Log in</Link></div>
    </section>
  )
}

function MobileHome({ jobs: allJobs, loading, landing, signedIn, home }) {
  const jobs = useMemo(() => landing ? allJobs.filter(j => jobMatchesLanding(j, landing)) : allJobs, [allJobs, landing])
  const copy = landing ? landingCopy(landing, allJobs, jobs.length) : null
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('All')
  const location = useLocation()
  const navigate = useNavigate()
  const role = new URLSearchParams(location.search).get('role')
  // Picking a story adds ?role= to the address, so the phone's Back gesture
  // (or the All roles button) takes you back to every listing.
  const setRole = (next) => {
    const sp = new URLSearchParams(location.search)
    if (next) sp.set('role', next); else sp.delete('role')
    const search = sp.toString() ? `?${sp}` : ''
    if (!next && !role) return
    if (!next && location.state?.roleFromFeed) { navigate(-1); return }
    navigate({ search }, { replace: !!role, state: next ? { roleFromFeed: role ? location.state?.roleFromFeed : true } : null })
  }
  const [onlySaved, setOnlySaved] = useState(false)
  const headRef = useRef(null)
  const [headH, setHeadH] = useState(110)
  useEffect(() => {
    const el = headRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight))
    ro.observe(el); setHeadH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])
  const [profile, setProfile] = useState(null)
  const [saved, setSaved] = useState([])
  const [following, setFollowing] = useState([])
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState('')
  const searchRef = useRef(null)
  const toastTimer = useRef(null)

  useSEO({
    title: copy ? copy.title : home ? "HospoSearch — Hospitality Jobs in Australia & New Zealand" : "Hospitality Jobs in Australia, New Zealand & Beyond | HospoSearch",
    description: copy ? copy.description : "Browse chef, sommelier, venue manager and front-of-house roles across Australia, New Zealand and the world's best restaurants. Updated daily on HospoSearch.",
    canonical: landing ? `https://www.hosposearch.com/jobs/${landing.group}-jobs${landing.place ? "-"+landing.place : ""}` : "https://www.hosposearch.com/",
    jsonLd: null,
  })

  // Signed-in job seekers: load their profile, saved roles and followed venues.
  useEffect(() => {
    if (!signedIn) { setProfile(null); return }
    let alive = true
    getMyProfile().then(p => {
      if (!alive || !p?.id) return
      setProfile(p)
      fetchBookmarks(p.id).then(ids => { if (alive) setSaved(ids.map(String)) }).catch(() => {})
      fetchFollowing(p.id).then(ids => { if (alive) setFollowing(ids.map(String)) }).catch(() => {})
    }).catch(() => {})
    return () => { alive = false }
  }, [signedIn])

  const flash = (t) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2400) }
  const top = () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) { window.scrollTo(0, 0) } }

  const onSave = async (job) => {
    const id = String(job.id)
    if (!signedIn || !profile?.id) {
      stashAfterLogin({ kind: 'save', jobId: job.id })
      setSheet({ title: 'Log in to save this role' }); return
    }
    const on = saved.includes(id)
    setSaved(s => on ? s.filter(x => x !== id) : [...s, id])
    try { await toggleBookmark(profile.id, job.id, on); flash(on ? 'Removed from your saved roles' : 'Saved to your profile') }
    catch (e) { setSaved(s => on ? [...s, id] : s.filter(x => x !== id)); flash("Couldn't save that. Try again") }
  }
  const onFollow = async (job) => {
    const emp = String(job.empId)
    if (!signedIn || !profile?.id) {
      stashAfterLogin({ kind: 'follow', employerId: job.empId })
      setSheet({ title: `Log in to follow ${job.venue}` }); return
    }
    const on = following.includes(emp)
    setFollowing(f => on ? f.filter(x => x !== emp) : [...f, emp])
    try { await setFollow(profile.id, job.empId, !on); if (!on) flash(`Following ${job.venue}`) }
    catch (e) { setFollowing(f => on ? [...f, emp] : f.filter(x => x !== emp)); flash("Couldn't follow. Try again") }
  }
  const onShare = (job) => shareJob(job, () => flash('Link copied'))

  const story = ROLE_STORIES.find(s => s.key === role)
  const countries = useMemo(() => ["All", ...sortCountries(Array.from(new Set(jobs.map(j=>j.country).filter(Boolean))))], [jobs])
  const list = useMemo(() => paidFirst(jobs.filter(j =>
    (!onlySaved || saved.includes(String(j.id))) &&
    (country === 'All' || j.country === country) &&
    (!story || roleMatch(j, story)) &&
    matchesQuery(j, q)
  )), [jobs, onlySaved, saved, country, story, q])
  const storyImg = (s) => { const j = jobs.find(x => roleMatch(x, s) && realPhotos(x).length); return j ? realPhotos(j)[0] : null }

  const filtered = !!(q.trim() || role || onlySaved || country !== 'All')
  let what = onlySaved ? 'Saved roles' : story ? story.label : q.trim() ? `“${q.trim()}”` : country !== 'All' ? country : ''
  if (!onlySaved && story && country !== 'All') what += ` in ${country}`
  if (!onlySaved && story && q.trim()) what += ` · “${q.trim()}”`
  const heading = filtered ? `${what} · ${list.length} ${list.length === 1 ? 'role' : 'roles'}` : (loading ? 'Loading roles' : copy ? copy.h1 : `${jobs.length} roles live today`)
  const reset = () => { setQ(''); setRole(null); setCountry('All'); setOnlySaved(false); top() }

  return (
    <div className="m-wrap">
      <header className="m-head" ref={headRef}>
        <div className="m-bar">
          <Link to="/" className="m-logo" onClick={e => { if (role) e.preventDefault(); reset() }}><span>Hospo</span>Search</Link>
          <Link to={LINKS.post} className="m-pill dark">Post a job</Link>
          {signedIn
            ? <Link to={LINKS.account} className="m-pill line">Account</Link>
            : <Link to={LINKS.login} className="m-pill line">Log in</Link>}
        </div>
        <label className="m-search">
          <Ico d={IC.search} size={18} />
          <input ref={searchRef} type="search" value={q} onChange={e => { setQ(e.target.value); setOnlySaved(false) }} placeholder="Search roles, venues or cities" aria-label="Search roles, venues or cities" />
          {filtered && <button type="button" aria-label="Clear search and filters" onClick={reset}><Ico d={IC.x} size={14} sw={2} /></button>}
        </label>
      </header>

      <div className="m-rail m-stories">
        <Link to={LINKS.post} className="m-story post"><span className="r"><span className="plus"><Ico d={IC.plus} size={26} /></span></span><span className="n">Post a job</span></Link>
        {jobs.length > 0 && (
          <button type="button" className={`m-story ${!role ? 'on' : ''}`} aria-pressed={!role} onClick={() => { setRole(null); setOnlySaved(false); top() }}>
            <span className="r"><span className="plus all">All</span></span><span className="n">All roles</span>
          </button>
        )}
        {ROLE_STORIES.map(s => {
          const img = storyImg(s)
          if (!img) return null
          return (
            <button key={s.key} type="button" className={`m-story ${role === s.key ? 'on' : ''}`} aria-pressed={role === s.key}
              onClick={() => { setRole(role === s.key ? null : s.key); setOnlySaved(false); top() }}>
              <span className="r"><img src={img} alt="" loading="lazy" /></span><span className="n">{s.label}</span>
            </button>
          )
        })}
      </div>

      {countries.length > 2 && (
        <div className="m-rail m-chips" role="group" aria-label="Country">
          <Link to="/map" className="m-chip"><Ico d={IC.map} size={14} />Map</Link>
          {countries.map(c => (
            <button key={c} type="button" className={`m-chip ${country === c && !onlySaved ? 'on' : ''}`} aria-pressed={country === c} onClick={() => { setCountry(c); setOnlySaved(false); top() }}>
              {c === 'All' ? 'All' : c === 'United Kingdom' ? 'UK' : c}
            </button>
          ))}
        </div>
      )}

      {filtered
        ? <div className="m-back" style={{ top: headH }}><button type="button" onClick={reset}><Ico d={IC.back} size={18} sw={1.8} />All roles</button><span>{heading}</span></div>
        : <div className="m-count">{heading}</div>}

      {loading ? <div className="m-empty">Loading hospitality roles…</div>
        : list.length === 0 ? (
          <div className="m-empty">
            {onlySaved ? 'No saved roles yet. Tap the bookmark on any role to save it.' : 'No roles match yet. Try a role, a venue or a city.'}
            <div style={{ marginTop:12 }}><button type="button" className="m-pill line" onClick={reset}>Show all roles</button></div>
          </div>
        ) : list.map((j, i) => (
          <Fragment key={j.id}>
            <MobilePost job={j} signedIn={signedIn} saved={saved.includes(String(j.id))} following={following.includes(String(j.empId))} onSave={onSave} onFollow={onFollow} onShare={onShare} />
            {!filtered && i === 1 && <MobileSales />}
            {!filtered && signedIn === false && i === 5 && <MobileSignup />}
          </Fragment>
        ))}
      {!loading && list.length > 0 && <div className="m-end">You're all caught up</div>}
      {!loading && <div className="m-browse"><BrowseLinks jobs={allJobs} /></div>}

      <nav className="m-nav" aria-label="Main">
        <button type="button" onClick={reset}><Ico d={IC.home} sw={1.8} />Home</button>
        <button type="button" onClick={() => { top(); setTimeout(() => searchRef.current?.focus(), 250) }}><Ico d={IC.search} sw={1.8} />Search</button>
        <Link to={LINKS.post} className="post"><Ico d={IC.plus} size={26} sw={1.8} />Post a job</Link>
        <button type="button" onClick={() => {
          if (!signedIn) { setSheet({ title: 'Log in to see your saved roles' }); return }
          setOnlySaved(true); setRole(null); setQ(''); setCountry('All'); top()
        }}>
          <Ico d={IC.book} sw={1.8} />Saved
          {saved.length > 0 && <span className="dot">{saved.length}</span>}
        </button>
        <Link to={signedIn ? LINKS.account : LINKS.login}><Ico d={IC.user} sw={1.8} />Profile</Link>
      </nav>

      {sheet && (
        <div className="m-sheet">
          <button type="button" className="bd" aria-label="Close" onClick={() => setSheet(null)} />
          <div className="pn" role="dialog" aria-label={sheet.title}>
            <span className="grab" aria-hidden="true" />
            <button type="button" className="x" aria-label="Close" onClick={() => setSheet(null)}><Ico d={IC.x} size={18} sw={2} /></button>
            <h3 style={{ paddingRight:40 }}>{sheet.title}</h3>
            <p>Saved roles and venues you follow live in your profile on every device. It's free and takes a few seconds.</p>
            <button type="button" className="g" onClick={signInWithGoogle}><GoogleG/> Continue with Google</button>
            <Link to={LINKS.signup} className="e">Sign up free with email</Link>
            <div style={{ textAlign:'center', fontSize:14, color:C.textSoft }}>Already a member? <Link to={LINKS.login} style={{ color:C.textDark, fontWeight:600 }}>Log in</Link></div>
          </div>
        </div>
      )}
      {toast && <div className="m-toast" role="status">{toast}</div>}
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function JobDetail({ jobs, loading, id, signedIn }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const job = jobs.find(j => String(j.id)===String(id))

  // Count a view every time a role is opened on the public site — a click from
  // the homepage / job lists, or a direct landing on /jobs/<id> (Instagram, Google,
  // shared links). Runs once per open; reopening the role counts again.
  useEffect(() => {
    if (job?.id) incrementViews(job.id).catch(() => {})
  }, [job?.id])

  useSEO({
    // Same title and description as the server-rendered page (api/seo.js)
    title: job ? jobTitleTag(job) : "Hospitality Role | HospoSearch",
    description: job ? jobDescriptionTag(job) : "View this hospitality role on HospoSearch.",
    canonical: job ? `https://www.hosposearch.com/jobs/${job.id}` : undefined,
    jsonLd: null, // JobPosting is rendered server-side in api/seo.js
  })

  if (loading) return <div className="jb-empty">Loading role…</div>
  if (!job) return (
    <div className="jb-empty">
      <div style={{ fontSize:40, marginBottom:12 }}>🤷</div>
      <div style={{ marginBottom:16 }}>This role is no longer available.</div>
      <Link to="/" className="jb-nav-cta">Browse all roles</Link>
    </div>
  )

  const first = job.photos?.[0]
  const hasImg = isData(first)

  return (
    <div className="jb-detail">
      <Link to="/" className="jb-back">← All roles</Link>
      {hasImg && <PhotoGallery photos={(job.photos||[]).filter(isData)} alt={`${job.title} at ${job.venue}`} />}
      <div className="jb-detail-venue">{job.venue} · {job.loc}</div>
      <h1 className="jb-serif">{job.title}</h1>
      {job.salary && <div className="jb-salary" style={{ fontSize:18, marginBottom:18 }}>{fmtSalary(job)}</div>}
      <div className="jb-tags">
        {[job.type, job.sector, job.roleType, ...(job.tags||[])].filter(Boolean).map((t,i)=>(
          <span key={i} className="jb-tag">{t}</span>
        ))}
      </div>
      <div className="jb-detail-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.full || job.short) }} />
      <JobMap job={job} />
      <div className="jb-actions jb-actions-col">
        {/* Apply through HospoSearch whenever the venue has an apply email; the
            venue's own site is only the route when there's no other way to apply. */}
        {job.link && job.link.trim() && job.link.trim()!=="#" && !(job.applyEmail && job.applyEmail.trim())
          ? <a href={trackedLink(job.link)} target="_blank" rel="noopener" className="jb-apply">Apply on venue website ↗</a>
          : <Link
              to={signedIn === false ? `/app?apply=${job.id}` : "/app"}
              className="jb-apply"
              onClick={() => {
                // Whether or not the visitor is logged in, stash which job they
                // meant to apply to. If they're already signed in, /app's init
                // picks this up on mount and opens the apply flow immediately —
                // if not, it survives login the same way. Without this, /app
                // always just lands on the generic feed with no job selected.
                try { localStorage.setItem('hs_apply_after_login', JSON.stringify({ id: job.id, ts: Date.now() })) } catch(e) {}
              }}
            >Apply via HospoSearch →</Link>}
        {/* The venue's own careers page, as a second link. Tagged so the venue can see the visit came from HospoSearch. */}
        {job.link && job.link.trim() && job.link.trim()!=="#" && job.applyEmail && job.applyEmail.trim() && (
          <a href={trackedLink(job.link)} target="_blank" rel="noopener" className="jb-login-apply">{job.venue} careers page ↗</a>
        )}
        {signedIn === false && (
          <Link
            to="/app?login=1"
            className="jb-login-apply"
            onClick={() => { try { localStorage.setItem('hs_apply_after_login', JSON.stringify({ id: job.id, ts: Date.now() })) } catch(e) {} }}
          >Log in to apply</Link>
        )}
        <button className="jb-share" onClick={() => shareJob(job, () => { setCopied(true); setTimeout(()=>setCopied(false), 2000) })}>
          {copied ? "✓ Link copied" : "↗ Share role"}
        </button>
      </div>
      <div style={{ margin:"32px -24px 0" }}><BrowseLinks jobs={jobs} only={relatedLandings(job)} /></div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Jobs({ detail=false, home=false, map=false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const landing = detail ? parseLandingSlug(id) : null
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(null) // null = still checking
  const isMobile = useIsMobile()

  // Old homepage links (hosposearch.com/#pricing etc.) now live on /about.
  useEffect(() => {
    if (home && /^#(pricing|how-it-works|for-employers|locations)$/.test(location.hash)) {
      navigate('/about' + location.hash, { replace: true })
    }
  }, [home, location.hash])

  useEffect(() => {
    let alive = true
    fetchJobs()
      .then(data => { if (alive) { setJobs(data.filter(j => isLive(j))); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    // Signed in = any live login session. (Checking for a profile row missed
    // admin accounts, which have none, so they saw "Log in" while logged in.)
    ;(sessionShouldEnd()
      ? supabase.auth.signOut().catch(() => {}).then(() => null)
      : supabase.auth.getSession().then(({ data }) => data?.session || null))
      .then(session => { if (alive) setSignedIn(!!session) })
      .catch(() => { if (alive) setSignedIn(false) })
    return () => { alive = false }
  }, [])

  // Phones get the Instagram-style feed for the job lists (home, /jobs and landing pages).
  if (isMobile && !map && !(detail && !landing)) {
    return (
      <>
        <style>{styles}</style>
        <MobileHome key={id || "all"} jobs={jobs} loading={loading} landing={landing} signedIn={signedIn} home={home} />
      </>
    )
  }

  return (
    <div className="jb-wrap">
      <style>{styles}</style>
      <SiteHeader signedIn={signedIn} onHome={!detail} />
      {map
        ? <Suspense fallback={<div className="jb-empty">Loading map…</div>}><JobsMap jobs={jobs} loading={loading} /></Suspense>
        : detail && !landing
        ? <JobDetail jobs={jobs} loading={loading} id={id} signedIn={signedIn} />
        : <JobsList key={id || "all"} jobs={jobs} loading={loading} landing={landing} signedIn={signedIn} home={home} />}
    </div>
  )
}
