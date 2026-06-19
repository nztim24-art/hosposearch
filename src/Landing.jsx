import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabase.js'

// ─── Multi-currency ───────────────────────────────────────────────────────────
// Rates are AUD → target. Update periodically, or wire to a live FX feed later.
// NOTE: Not GST-registered yet (under $75k threshold) — so NO tax is charged or shown.
// When registered, set taxRate:0.10 on AUD below and the  line will return.
const CURRENCIES = {
  AUD: { symbol:'$',  code:'AUD', rate:1,     tax:null, taxRate:0, isAU:true,  estimate:false },
  NZD: { symbol:'$',  code:'NZD', rate:1.09,  tax:null, taxRate:0, isAU:false, estimate:true },
  GBP: { symbol:'£',  code:'GBP', rate:0.52,  tax:null, taxRate:0, isAU:false, estimate:true },
  USD: { symbol:'$',  code:'USD', rate:0.66,  tax:null, taxRate:0, isAU:false, estimate:true },
  EUR: { symbol:'€',  code:'EUR', rate:0.61,  tax:null, taxRate:0, isAU:false, estimate:true },
}

// Map a country code (from geo lookup) to a currency
const COUNTRY_CURRENCY = {
  AU:'AUD', NZ:'NZD', GB:'GBP', UK:'GBP', US:'USD',
  IE:'EUR', FR:'EUR', DE:'EUR', ES:'EUR', IT:'EUR', NL:'EUR', AT:'EUR', BE:'EUR', PT:'EUR',
  CA:'USD', SG:'USD', AE:'USD', HK:'USD',
}

// Decide currency from the domain; .com geolocates
function currencyFromHost(host) {
  const h = (host || '').toLowerCase()
  if (h.endsWith('.com.au')) return 'AUD'
  if (h.endsWith('.co.nz'))  return 'NZD'
  if (h.endsWith('.co.uk'))  return 'GBP'
  return null // .com (or localhost) → geolocate
}

// Round to a tidy local price (nearest whole unit, ending in 0 or 5 where sensible)
function tidyPrice(aud, rate) {
  const raw = aud * rate
  if (raw < 100) return Math.round(raw)
  return Math.round(raw / 5) * 5
}

function useCurrency() {
  const [cur, setCur] = useState(() => {
    const fromHost = typeof window !== 'undefined' ? currencyFromHost(window.location.hostname) : 'AUD'
    return CURRENCIES[fromHost || 'AUD']
  })

  useEffect(() => {
    const fromHost = currencyFromHost(window.location.hostname)
    if (fromHost) { setCur(CURRENCIES[fromHost]); return }
    // .com → geolocate via free, key-less IP lookup; fall back to USD
    let alive = true
    fetch('https://ipapi.co/json/')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!alive) return
        const code = COUNTRY_CURRENCY[(data.country_code || '').toUpperCase()] || 'USD'
        setCur(CURRENCIES[code])
      })
      .catch(() => { if (alive) setCur(CURRENCIES.USD) })
    return () => { alive = false }
  }, [])

  return cur
}

const styles = `
  :root {
    --terra:#C4623A; --terra-l:#F5EDE7; --terra-d:#9E4B2A;
    --sage:#6B8F71;  --sage-l:#EBF2EC;
    --sand:#C9A96E;  --sand-l:#FDF6E8;
    --ink:#0F0E0C;   --ink-mid:#3A3733; --ink-soft:#7A7570; --ink-faint:#C0BAB2;
    --cream:#FAF8F4; --white:#FFFFFF;   --border:#E8E2D8;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;}
  body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--ink);overflow-x:hidden;-webkit-font-smoothing:antialiased;}
  body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:0.4;}
  .serif{font-family:'Playfair Display',serif;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
  @keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-8px)}}
  @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  .fade-up-1{animation:fadeUp 0.7s 0.1s ease both;}
  .fade-up-2{animation:fadeUp 0.7s 0.2s ease both;}
  .fade-up-3{animation:fadeUp 0.7s 0.35s ease both;}
  .fade-up-4{animation:fadeUp 0.7s 0.5s ease both;}
  .fade-up-5{animation:fadeUp 0.7s 0.65s ease both;}

  /* Nav */
  .hs-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:18px 40px;background:rgba(250,248,244,0.88);backdrop-filter:blur(14px);border-bottom:1px solid rgba(232,226,216,0.6);transition:padding 0.3s;}
  .hs-nav-logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:800;color:var(--ink);text-decoration:none;letter-spacing:-0.3px;}
  .hs-nav-logo span{color:var(--terra);}
  .hs-nav-links{display:flex;align-items:center;gap:32px;list-style:none;}
  .hs-nav-mobile{display:none;}
  .hs-nav-links a{color:var(--ink-mid);text-decoration:none;font-size:14px;font-weight:500;transition:color 0.2s;}
  .hs-nav-links a:hover{color:var(--terra);}
  .hs-nav-cta{background:var(--terra)!important;color:white!important;padding:9px 22px!important;border-radius:100px;font-weight:600!important;font-size:14px!important;transition:background 0.2s,transform 0.15s!important;}
  .hs-nav-cta:hover{background:var(--terra-d)!important;transform:translateY(-1px);}

  /* Hero */
  .hs-hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px 40px 80px;position:relative;overflow:hidden;}
  .hs-hero::before{content:'';position:absolute;top:-120px;right:-120px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(196,98,58,0.12) 0%,transparent 70%);pointer-events:none;}
  .hs-hero::after{content:'';position:absolute;bottom:-80px;left:-80px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(107,143,113,0.10) 0%,transparent 70%);pointer-events:none;}
  .hs-hero-inner{max-width:760px;margin:0 auto;width:100%;}
  .hs-eyebrow{display:inline-flex;align-items:center;gap:8px;background:var(--terra-l);border:1px solid rgba(196,98,58,0.25);color:var(--terra);font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:6px 14px;border-radius:100px;margin-bottom:24px;}
  .hs-eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--terra);animation:pulse 2s infinite;}
  .hs-hero-title{font-family:'Playfair Display',serif;font-size:clamp(42px,5.5vw,72px);font-weight:900;line-height:1.05;letter-spacing:-1.5px;color:var(--ink);margin-bottom:24px;}
  .hs-hero-title em{font-style:italic;color:var(--terra);}
  .hs-hero-sub{font-size:17px;line-height:1.7;color:var(--ink-soft);margin-bottom:40px;max-width:460px;}
  .hs-hero-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}

  .btn-primary{background:var(--terra);color:white;padding:15px 32px;border-radius:100px;font-size:15px;font-weight:700;text-decoration:none;transition:all 0.2s;box-shadow:0 4px 18px rgba(196,98,58,0.28);display:inline-flex;align-items:center;gap:8px;}
  .btn-primary:hover{background:var(--terra-d);transform:translateY(-2px);box-shadow:0 8px 26px rgba(196,98,58,0.35);}
  .btn-secondary{background:transparent;color:var(--ink);padding:14px 28px;border-radius:100px;font-size:15px;font-weight:600;text-decoration:none;border:1.5px solid var(--border);transition:all 0.2s;display:inline-flex;align-items:center;gap:8px;}
  .btn-secondary:hover{border-color:var(--ink-mid);background:rgba(15,14,12,0.04);transform:translateY(-1px);}

  .hs-trust{margin-top:36px;display:flex;align-items:center;gap:10px;}
  .hs-trust-avatars{display:flex;}
  .hs-trust-avatars span{width:32px;height:32px;border-radius:50%;border:2px solid var(--cream);display:flex;align-items:center;justify-content:center;font-size:15px;margin-left:-8px;background:linear-gradient(135deg,var(--terra),var(--sand));}
  .hs-trust-avatars span:first-child{margin-left:0;}
  .hs-trust-text{font-size:13px;color:var(--ink-soft);line-height:1.4;}
  .hs-trust-text strong{color:var(--ink);font-weight:600;}

  /* Phone */
  .hs-phone-wrap{position:relative;display:flex;justify-content:center;align-items:center;animation:float 6s ease-in-out infinite;}
  .hs-phone{width:260px;background:var(--ink);border-radius:40px;padding:14px;box-shadow:0 40px 80px rgba(15,14,12,0.25),0 0 0 1px rgba(255,255,255,0.08);position:relative;z-index:2;}
  .hs-phone-notch{width:80px;height:24px;background:var(--ink);border-radius:0 0 16px 16px;margin:0 auto 10px;}
  .hs-phone-screen{background:#FAF8F4;border-radius:28px;overflow:hidden;aspect-ratio:9/19;}
  .hs-phone-header{background:white;padding:12px 14px 10px;border-bottom:1px solid #EAE4DA;display:flex;align-items:center;justify-content:space-between;}
  .hs-phone-logo{font-family:'Playfair Display',serif;font-size:16px;font-weight:800;color:#1A1A1A;}
  .hs-phone-logo span{color:var(--terra);}
  .hs-phone-card{background:white;margin-bottom:6px;border-bottom:1px solid #EAE4DA;}
  .hs-phone-card-img{height:120px;display:flex;align-items:center;justify-content:center;font-size:36px;}
  .hs-phone-card-body{padding:8px 10px 10px;}
  .hs-phone-card-title{font-family:'Playfair Display',serif;font-size:13px;font-weight:700;color:#1A1A1A;margin-bottom:2px;}
  .hs-phone-card-meta{font-size:10px;color:#888;margin-bottom:6px;}
  .hs-phone-card-salary{font-size:11px;color:var(--sand);font-weight:700;}
  .hs-phone-badge{position:absolute;top:-16px;right:-20px;background:var(--terra);color:white;padding:8px 14px;border-radius:12px;font-size:11px;font-weight:700;box-shadow:0 4px 14px rgba(196,98,58,0.35);white-space:nowrap;z-index:4;}
  .hs-phone-badge-2{position:absolute;bottom:40px;left:-28px;background:white;padding:10px 14px;border-radius:12px;font-size:11px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.12);white-space:nowrap;color:var(--ink);z-index:4;border:1px solid var(--border);}
  .deco-ring{position:absolute;border-radius:50%;border:1px dashed rgba(196,98,58,0.2);pointer-events:none;}

  /* Ticker */
  .hs-ticker{background:var(--ink);color:white;padding:14px 0;overflow:hidden;}
  .hs-ticker-track{display:flex;animation:marquee 30s linear infinite;width:max-content;}
  .hs-ticker-item{display:inline-flex;align-items:center;gap:12px;padding:0 32px;font-size:13px;font-weight:500;letter-spacing:0.3px;white-space:nowrap;color:rgba(255,255,255,0.8);}
  .hs-ticker-dot{width:4px;height:4px;border-radius:50%;background:var(--terra);flex-shrink:0;}

  /* Stats */
  .hs-stats{background:white;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
  .hs-stats-inner{max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);}
  .hs-stat{padding:40px 32px;text-align:center;border-right:1px solid var(--border);}
  .hs-stat:last-child{border-right:none;}
  .hs-stat-num{font-family:'Playfair Display',serif;font-size:46px;font-weight:900;color:var(--terra);line-height:1;margin-bottom:6px;letter-spacing:-1px;}
  .hs-stat-label{font-size:13px;color:var(--ink-soft);font-weight:500;}

  /* Sections */
  .hs-section{padding:100px 40px;}
  .hs-section-inner{max-width:1160px;margin:0 auto;}
  .hs-section-tag{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--terra);margin-bottom:14px;}
  .hs-section-title{font-family:'Playfair Display',serif;font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.1;letter-spacing:-1px;color:var(--ink);margin-bottom:16px;}
  .hs-section-sub{font-size:16px;color:var(--ink-soft);line-height:1.7;max-width:520px;margin-bottom:60px;}

  /* Split */
  .hs-split{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--border);border:1px solid var(--border);border-radius:24px;overflow:hidden;}
  .hs-split-panel{background:var(--cream);padding:52px 48px;position:relative;overflow:hidden;}
  .hs-split-panel::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;pointer-events:none;}
  .hs-split-panel.emp::before{background:radial-gradient(circle,rgba(196,98,58,0.08),transparent 70%);}
  .hs-split-panel.cand::before{background:radial-gradient(circle,rgba(107,143,113,0.10),transparent 70%);}
  .hs-split-icon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;}
  .hs-split-icon.emp{background:var(--terra-l);}
  .hs-split-icon.cand{background:var(--sage-l);}
  .hs-split-eyebrow{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
  .hs-split-eyebrow.emp{color:var(--terra);}
  .hs-split-eyebrow.cand{color:var(--sage);}
  .hs-split-title{font-family:'Playfair Display',serif;font-size:28px;font-weight:800;color:var(--ink);line-height:1.15;margin-bottom:14px;letter-spacing:-0.5px;}
  .hs-split-desc{font-size:15px;color:var(--ink-soft);line-height:1.7;margin-bottom:28px;}
  .hs-feat-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:32px;}
  .hs-feat-list li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--ink-mid);line-height:1.5;}
  .hs-feat-list li::before{content:'✓';font-weight:700;font-size:13px;flex-shrink:0;margin-top:1px;}
  .hs-split-panel.emp .hs-feat-list li::before{color:var(--terra);}
  .hs-split-panel.cand .hs-feat-list li::before{color:var(--sage);}
  .btn-emp{background:var(--terra);color:white;padding:13px 26px;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;transition:all 0.2s;display:inline-flex;align-items:center;gap:7px;box-shadow:0 3px 12px rgba(196,98,58,0.25);}
  .btn-emp:hover{background:var(--terra-d);transform:translateY(-1px);}
  .btn-cand{background:var(--sage);color:white;padding:13px 26px;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;transition:all 0.2s;display:inline-flex;align-items:center;gap:7px;box-shadow:0 3px 12px rgba(107,143,113,0.25);}
  .btn-cand:hover{background:#5A7A60;transform:translateY(-1px);}

  /* Categories */
  .hs-cats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  .hs-cat{background:white;border:1px solid var(--border);border-radius:18px;padding:24px 20px;text-align:center;cursor:pointer;transition:all 0.22s;text-decoration:none;display:block;position:relative;overflow:hidden;}
  .hs-cat::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--terra-l),transparent);opacity:0;transition:opacity 0.22s;}
  .hs-cat:hover{border-color:var(--terra);transform:translateY(-3px);box-shadow:0 8px 24px rgba(196,98,58,0.12);}
  .hs-cat:hover::before{opacity:1;}
  .hs-cat-icon{font-size:32px;margin-bottom:10px;position:relative;z-index:1;}
  .hs-cat-name{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px;position:relative;z-index:1;}
  .hs-cat-sub{font-size:11px;color:var(--ink-soft);position:relative;z-index:1;}

  /* Pricing */
  .hs-pricing{background:var(--ink);padding:100px 40px;position:relative;overflow:hidden;}
  .hs-pricing::before{content:'';position:absolute;top:-200px;right:-200px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(196,98,58,0.15),transparent 65%);pointer-events:none;}
  .hs-pricing-inner{max-width:1160px;margin:0 auto;position:relative;z-index:1;}
  .hs-pricing-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:900px;}
  .hs-price-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:36px 32px;position:relative;transition:all 0.22s;}
  .hs-price-card:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);}
  .hs-price-card.featured{background:var(--terra);border-color:var(--terra);}
  .hs-price-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--sand);color:var(--ink);font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 14px;border-radius:100px;white-space:nowrap;}
  .hs-price-name{font-size:13px;font-weight:600;color:rgba(255,255,255,0.6);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;}
  .hs-price-amount{font-family:'Playfair Display',serif;font-size:52px;font-weight:900;color:white;line-height:1;margin-bottom:4px;letter-spacing:-2px;}
  .hs-price-period{font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:20px;}
  .hs-price-feats{list-style:none;display:flex;flex-direction:column;gap:8px;margin-bottom:28px;}
  .hs-price-feats li{font-size:13px;color:rgba(255,255,255,0.75);display:flex;align-items:center;gap:8px;}
  .hs-price-feats li::before{content:'✓';color:white;font-weight:700;font-size:12px;}
  .btn-price{width:100%;background:white;color:var(--ink);padding:13px 0;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;text-align:center;display:block;transition:all 0.2s;}
  .btn-price:hover{background:var(--cream);transform:translateY(-1px);}
  .hs-price-card.featured .btn-price{background:rgba(255,255,255,0.2);color:white;}
  .hs-price-card.featured .btn-price:hover{background:rgba(255,255,255,0.3);}
  .hs-pricing-note{margin-top:24px;font-size:13px;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:8px;}
  /* Equal-height tier cards with buttons aligned at the bottom */
  .hs-pricing-tier-grid>div{display:flex;flex-direction:column;transform:none!important;}
  .hs-pricing-tier-grid>div>ul{flex:1 1 auto;}
  .hs-pricing-tier-grid>div>a:last-child,.hs-pricing-tier-grid>div>button:last-child{margin-top:auto;}
  .hs-pricing-note::before{content:'🔒';}

  /* Testimonials */
  .hs-testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .hs-testi-card{background:white;border:1px solid var(--border);border-radius:20px;padding:28px 26px;transition:all 0.22s;}
  .hs-testi-card:hover{box-shadow:0 6px 24px rgba(0,0,0,0.07);transform:translateY(-2px);}
  .hs-testi-quote{font-size:15px;color:var(--ink-mid);line-height:1.7;margin-bottom:20px;font-style:italic;}
  .hs-testi-author{display:flex;align-items:center;gap:10px;}
  .hs-testi-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--terra),var(--sand));display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
  .hs-testi-name{font-weight:700;font-size:13px;color:var(--ink);}
  .hs-testi-role{font-size:11px;color:var(--ink-soft);margin-top:1px;}
  .hs-stars{color:var(--sand);font-size:13px;margin-bottom:12px;letter-spacing:2px;}

  /* Locations */
  .hs-locs-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;}
  .hs-loc{background:var(--cream);border:1px solid var(--border);border-radius:12px;padding:12px 10px;text-align:center;font-size:12px;font-weight:600;color:var(--ink-mid);cursor:pointer;transition:all 0.18s;text-decoration:none;display:block;}
  .hs-loc:hover{background:var(--terra-l);border-color:var(--terra);color:var(--terra);}
  .hs-loc span{display:block;font-size:18px;margin-bottom:4px;}

  /* Final CTA */
  .hs-final{background:linear-gradient(135deg,var(--terra) 0%,#A84F2E 100%);padding:100px 40px;text-align:center;position:relative;overflow:hidden;}
  .hs-final::before{content:'';position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:600px;height:400px;border-radius:50%;background:rgba(255,255,255,0.06);pointer-events:none;}
  .hs-final-title{font-family:'Playfair Display',serif;font-size:clamp(36px,5vw,60px);font-weight:900;color:white;line-height:1.1;letter-spacing:-1.5px;margin-bottom:16px;position:relative;z-index:1;}
  .hs-final-sub{font-size:17px;color:rgba(255,255,255,0.75);margin-bottom:40px;position:relative;z-index:1;}
  .hs-final-actions{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;position:relative;z-index:1;}
  .btn-white{background:white;color:var(--terra);padding:15px 32px;border-radius:100px;font-size:15px;font-weight:700;text-decoration:none;transition:all 0.2s;box-shadow:0 4px 18px rgba(0,0,0,0.15);display:inline-flex;align-items:center;gap:7px;}
  .btn-white:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,0.2);}
  .btn-ghost{background:rgba(255,255,255,0.15);color:white;padding:14px 28px;border-radius:100px;font-size:15px;font-weight:600;text-decoration:none;border:1.5px solid rgba(255,255,255,0.3);transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
  .btn-ghost:hover{background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);}

  /* Footer */
  .hs-footer{background:var(--ink);color:rgba(255,255,255,0.5);padding:60px 40px 32px;}
  .hs-footer-inner{max-width:1160px;margin:0 auto;}
  .hs-footer-top{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:60px;padding-bottom:48px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:28px;}
  .hs-footer-logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:800;color:white;margin-bottom:12px;}
  .hs-footer-logo span{color:var(--terra);}
  .hs-footer-desc{font-size:13px;line-height:1.7;margin-bottom:20px;}
  .hs-footer-domains{display:flex;gap:8px;flex-wrap:wrap;}
  .hs-footer-domain{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;}
  .hs-footer-col-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:16px;}
  .hs-footer-links{list-style:none;display:flex;flex-direction:column;gap:10px;}
  .hs-footer-links a{color:rgba(255,255,255,0.55);text-decoration:none;font-size:13px;transition:color 0.2s;}
  .hs-footer-links a:hover{color:white;}
  .hs-footer-bottom{display:flex;align-items:center;justify-content:space-between;font-size:12px;}

  /* Reveal */
  .reveal{opacity:0;transform:translateY(24px);transition:opacity 0.65s ease,transform 0.65s ease;}
  .reveal.visible{opacity:1;transform:translateY(0);}

  /* ── Tablet (max 900px) ── */
  @media(max-width:900px){
    .hs-nav{padding:14px 20px;}
    .hs-nav-links{display:none;}
    .hs-nav-mobile{display:flex;align-items:center;gap:8px;}

    /* Hero — stack vertically */
    .hs-hero{padding:90px 20px 48px!important;min-height:auto!important;}
    .hs-hero-inner-grid{grid-template-columns:1fr!important;gap:28px!important;}
    .hs-hero-title{font-size:clamp(36px,9vw,54px)!important;}
    .hs-hero-sub{font-size:15px!important;}

    /* Sections */
    .hs-section{padding:52px 20px;}
    .hs-section-title{font-size:clamp(26px,7vw,40px);}

    /* Split panels */
    .hs-split{grid-template-columns:1fr;}
    .hs-split-panel{padding:32px 24px;}

    /* Stats 2x2 */
    .hs-stats-inner{grid-template-columns:repeat(2,1fr);}
    .hs-stat{padding:24px 16px;}
    .hs-stat:nth-child(2){border-right:none;}
    .hs-stat-num{font-size:34px;}

    /* App showcase — stack to single col, phone on top */
    .hs-showcase-section{padding:52px 20px!important;}
    .hs-showcase-grid{grid-template-columns:1fr!important;gap:24px!important;}
    .hs-showcase-grid>div:nth-child(2){order:-1;display:flex!important;justify-content:center;}
    .hs-showcase-grid>div:nth-child(1),
    .hs-showcase-grid>div:nth-child(3){flex-direction:column!important;text-align:left!important;}
    .hs-showcase-grid>div:nth-child(3)>div{flex-direction:row!important;text-align:left!important;}
    .hs-showcase-grid>div:nth-child(3)>div>div:last-child{text-align:left!important;}

    /* Pricing — single column */
    .hs-pricing{padding:60px 20px;}
    .hs-pricing-tier-grid{grid-template-columns:1fr!important;max-width:420px!important;margin:0 auto!important;}
    .hs-modal-tier-grid{grid-template-columns:1fr!important;gap:14px!important;}
    .hs-pricing-tier-grid>div:nth-child(2){transform:none!important;box-shadow:0 8px 24px rgba(0,0,0,0.3)!important;}

    /* Seek compare table — horizontal scroll */
    .hs-compare-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:16px;}
    .hs-compare-wrap table{min-width:600px;}

    /* Categories 2 cols */
    .hs-cats{grid-template-columns:repeat(2,1fr);}

    /* Testimonials single col */
    .hs-testi-grid{grid-template-columns:1fr;}

    /* Locations 3 cols */
    .hs-locs-grid{grid-template-columns:repeat(3,1fr);}

    /* Footer */
    .hs-footer-top{grid-template-columns:1fr 1fr;gap:28px;}
    .hs-footer-bottom{flex-direction:column;gap:10px;text-align:center;}
    .hs-final{padding:64px 20px;}
    .hs-final-title{font-size:clamp(30px,8vw,48px);}
  }

  /* ── Mobile (max 600px) ── */
  @media(max-width:600px){
    .hs-hero{padding:80px 16px 40px!important;}
    .hs-section{padding:44px 16px;}

    /* Hero CTAs full width */
    .hs-hero-actions{flex-direction:column;align-items:stretch!important;}
    .hs-hero-actions a,.hs-hero-actions button{width:100%!important;justify-content:center!important;text-align:center;}

    /* Final CTA */
    .hs-final-actions{flex-direction:column;align-items:center;}
    .hs-final-actions a,.hs-final-actions button{width:100%;max-width:320px;justify-content:center;text-align:center;display:inline-flex;align-items:center;}

    /* Locations 2 cols */
    .hs-locs-grid{grid-template-columns:repeat(2,1fr);}

    /* Footer single col */
    .hs-footer-top{grid-template-columns:1fr;}

    /* Cats 2 cols */
    .hs-cats{grid-template-columns:repeat(2,1fr);}

    /* Pricing single col */
    .hs-pricing-tier-grid{grid-template-columns:1fr!important;max-width:100%!important;}
    .hs-pricing-tier-grid>div{padding:24px 20px!important;}

    /* Pricing — reduce font size on small screens */
    .hs-price-big{font-size:42px!important;}

    /* Seek compare smaller font */
    .hs-compare-wrap table{font-size:11px!important;}
    .hs-compare-wrap td,.hs-compare-wrap th{padding:9px 12px!important;}
  }
`

const TICKER_ITEMS = [
  "Head Chef · Melbourne VIC","Sommelier · Sydney NSW","Bar Manager · Brisbane QLD",
  "Pastry Chef · Auckland NZ","Floor Manager · Perth WA","Barista · Melbourne VIC",
  "Executive Chef · Gold Coast QLD","Concierge · Dubai UAE","Restaurant Manager · Wellington NZ",
  "Kitchen Hand · Adelaide SA","Chef de Partie · Hobart TAS","Venue Manager · Sydney NSW",
]

function PricingModal({ onClose, defaultTab='listing' }) {
  const [tab, setTab] = useState(defaultTab)
  const [selectedTier, setSelectedTier] = useState(null)
  const cur = useCurrency()

  const listingTiers = [
    {
      key:'bronze', icon:'🥉', name:'Bronze', price:50, period:'one-time',
      color:'#C9A96E', colorD:'#8B6914',
      features:['30-day listing visibility','Up to 5 photos','Unlimited applications','Application management dashboard','Verified venue profile','Discount codes accepted']
    },
    {
      key:'silver', icon:'🥈', name:'Silver', price:70, period:'one-time',
      color:'#C0D0E0', colorD:'#A8B8C8', popular:true,
      features:['Everything in Bronze','Pinned to top of feed 30 days','Featured badge & silver star','Priority in search results','3× more applications on average','Highlighted in candidate job alerts']
    },
    {
      key:'gold', icon:'🥇', name:'Gold', price:100, period:'one-time',
      color:'#FFD700', colorD:'#D4A017',
      features:['Everything in Silver','Shared on @hosposearch Instagram','Shared on HospoSearch Facebook','Up to 5 screening questions','Priority application inbox','Gold "Premium Venue" verified badge']
    },
  ]
  const subTiers = [
    {
      key:'starter', icon:'🥉', name:'Starter', price:99, period:'mo',
      color:'#C9A96E', colorD:'#8B6914', limit:'3 active listings',
      tagline:'Great for small to medium businesses with regular hiring needs',
      features:['3 active listings at any time','Bronze level listing on every post','Application management dashboard','Verified venue profile','Upgrade any listing to Silver (+$20) or Gold (+$50)','Cancel anytime — no lock-in']
    },
    {
      key:'growth', icon:'🥈', name:'Growth', price:199, period:'mo',
      color:'#C0D0E0', colorD:'#A8B8C8', popular:true, limit:'6 active listings',
      tagline:'Great for venues gearing up for seasonal rushes or rapid expansion',
      features:['6 active listings at any time','Bronze level listing on every post','Candidate search & messaging','Highlighted in job alert emails','Priority application inbox','Upgrade any listing to Silver (+$20) or Gold (+$50)','Cancel anytime — no lock-in']
    },
    {
      key:'pro', icon:'🥇', name:'Pro', price:399, period:'mo',
      color:'#FFD700', colorD:'#D4A017', limit:'10 active listings',
      tagline:'Great for hotels, resorts and large venue groups with ongoing staffing',
      features:['10 active listings at any time','Bronze level listing on every post','Bulk application management','Analytics dashboard','Custom venue landing page','Upgrade any listing to Silver (+$20) or Gold (+$50)','Cancel anytime — no lock-in']
    },
  ]
  const tiers = tab === 'listing' ? listingTiers : subTiers
  const selected = tiers.find(t=>t.key===selectedTier)

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',backdropFilter:'blur(6px)'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#FAF8F4',borderRadius:24,padding:'36px 32px',maxWidth:960,width:'100%',maxHeight:'92vh',overflowY:'auto',position:'relative',boxShadow:'0 40px 80px rgba(0,0,0,0.25)'}}>

        {/* Close */}
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'#F0EBE3',border:'none',color:'#3A3733',width:34,height:34,borderRadius:'50%',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:800,color:'#0F0E0C',marginBottom:8,letterSpacing:-0.5}}>
            Post a Job on HospoSearch
          </div>
          <p style={{color:'#7A7570',fontSize:14,marginBottom:20,maxWidth:480,margin:'0 auto 20px'}}>
            Reach hospitality professionals across Australia, New Zealand & beyond. Job seekers always browse free.
          </p>
          {/* Tab toggle */}
          <div style={{display:'inline-flex',background:'#fff',borderRadius:100,padding:4,gap:4,border:'1px solid #E8E2D8'}}>
            {[['listing','Pay Per Listing'],['subscription','Monthly Plans']].map(([v,l])=>(
              <button key={v} onClick={()=>{setTab(v);setSelectedTier(null)}}
                style={{padding:'9px 22px',borderRadius:100,border:'none',background:tab===v?'#C4623A':'transparent',color:tab===v?'#fff':'#7A7570',fontWeight:tab===v?700:500,fontSize:14,cursor:'pointer',transition:'all 0.2s',whiteSpace:'nowrap'}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Tier cards */}
        <div className="hs-modal-tier-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
          {tiers.map(tier=>{
            const isSel = selectedTier===tier.key
            const isFeatured = !!tier.popular
            return (
              <div key={tier.key} onClick={()=>setSelectedTier(tier.key)}
                style={{background:'#fff',border:`${isSel||isFeatured?'2':'1'}px solid ${isSel?'#C4623A':isFeatured?'#C4623A':'#E8E2D8'}`,borderRadius:18,padding:'22px 18px',cursor:'pointer',transition:'all 0.2s',position:'relative',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',boxShadow:isSel?'0 8px 24px rgba(196,98,58,0.18)':isFeatured?'0 8px 24px rgba(196,98,58,0.10)':'0 2px 8px rgba(0,0,0,0.04)'}}>
                {isFeatured && (
                  <div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:'#C4623A',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',padding:'4px 14px',borderRadius:100,whiteSpace:'nowrap'}}>Most Popular</div>
                )}
                {isSel && (
                  <div style={{position:'absolute',top:12,right:12,background:'#C4623A',color:'#fff',width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900}}>✓</div>
                )}

                {/* Dot + name */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,marginBottom:6}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:'#C4623A',flexShrink:0}}/>
                  <div style={{color:isFeatured?'#C4623A':'#7A7570',fontSize:11,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase'}}>{tier.name}</div>
                </div>
                {tier.limit && <div style={{color:'#A8A29A',fontSize:11,marginBottom:4}}>{tier.limit}</div>}
                {tier.tagline && <div style={{color:'#7A7570',fontSize:10,lineHeight:1.4,marginBottom:10,fontStyle:'italic',padding:'0 4px'}}>{tier.tagline}</div>}

                {/* Price */}
                <div style={{marginBottom:14}}>
                  {(() => {
                    const localPrice = tidyPrice(tier.price, cur.rate)
                    return (
                      <>
                        <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:4}}>
                          <div style={{fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:800,color:'#0F0E0C',lineHeight:1,letterSpacing:-1.5}}>{cur.symbol}{localPrice}</div>
                          {tier.period==='mo' && <div style={{color:'#A8A29A',fontSize:13}}>/mo</div>}
                        </div>
                        <div style={{color:'#A8A29A',fontSize:11,marginTop:3}}>
                          {cur.isAU
                            ? <>${tier.price} AUD{tier.period==='mo'?' · per month':' · one-time'}</>
                            : <>{cur.symbol}{localPrice} {cur.code} · billed at ${tier.price} AUD{tier.period==='mo'?'/mo':''}</>}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Features */}
                <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:6,textAlign:'left',width:'100%',flex:'1 1 auto'}}>
                  {tier.features.map(f=>(
                    <li key={f} style={{fontSize:12,color:'#3A3733',display:'flex',alignItems:'flex-start',gap:7,lineHeight:1.45}}>
                      <span style={{color:'#C4623A',fontWeight:700,flexShrink:0}}>✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{textAlign:'center'}}>
          <a href={`/app?tier=${selectedTier||tiers[0].key}&mode=${tab}`}
            style={{display:'inline-flex',alignItems:'center',gap:10,background:'#C4623A',color:'white',padding:'14px 40px',borderRadius:100,fontSize:15,fontWeight:700,textDecoration:'none',boxShadow:'0 6px 20px rgba(196,98,58,0.3)',transition:'all 0.2s',marginBottom:12}}>
            {selected ? `Get started with ${selected.name} →` : 'Get Started →'}
          </a>
          <div style={{color:'#A8A29A',fontSize:13}}>
            Already have an account?{' '}
            <a href="/app" style={{color:'#C4623A',textDecoration:'none',fontWeight:600}}>Log in here →</a>
          </div>
          {tab==='subscription' && (
            <div style={{marginTop:16,padding:'12px 16px',background:'#F5F0E8',borderRadius:10,fontSize:11,color:'#7A7570',lineHeight:1.6,textAlign:'left',maxWidth:480,margin:'16px auto 0'}}>
              <strong style={{color:'#3A3733'}}>Subscription terms:</strong> Cancel anytime from your account dashboard. No refunds are issued on the current billing period. To avoid being charged for the next period, cancel before your renewal date. All subscription listings are Bronze level — upgrade individual listings anytime with a one-off payment.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [modalDefaultTab, setModalDefaultTab] = useState('listing')
  const [pricingTab, setPricingTab] = useState('listing');
  const [footerModal, setFooterModal] = useState(null); // 'about' | 'privacy' | 'terms'
  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name:'', email:'', phone:'', query:'' });
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check Supabase session (real accounts)
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) { setIsLoggedIn(true); return; }
      // Fallback: check stay-logged-in flags for hardcoded admin/demo accounts
      const stayLoggedIn = localStorage.getItem('hs_stay_logged_in') === '1';
      const tempSession  = sessionStorage.getItem('hs_temp_session') === '1';
      setIsLoggedIn(stayLoggedIn || tempSession);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const sendContact = async () => {
    if (!contactForm.name.trim() || !contactForm.email.includes('@') || !contactForm.query.trim()) return;
    setContactSending(true);
    try {
      await fetch('/api/notify-abandoned', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          email: contactForm.email,
          jobTitle: `Contact form: ${contactForm.query.slice(0,60)}`,
          tier: 'contact',
          name: contactForm.name,
          phone: contactForm.phone,
          message: contactForm.query,
        })
      });
      setContactSent(true);
    } catch(e) {}
    setContactSending(false);
  };
  const cur = useCurrency()
  // Formats an AUD base price into the visitor's local currency for inline display
  const px = (aud) => `${cur.symbol}${tidyPrice(aud, cur.rate)}`
  // Sub-label under each price. No GST until registered. Overseas → AUD billing note.
  const taxLabel = (period, audPrice) => cur.isAU
    ? `$${audPrice} AUD · ${period}`
    : `${cur.symbol}${tidyPrice(audPrice, cur.rate)} ${cur.code} · billed at $${audPrice} AUD`
  const subLabel = (audPrice) => cur.isAU
    ? `$${audPrice} AUD · cancel anytime`
    : `${cur.symbol}${tidyPrice(audPrice, cur.rate)} ${cur.code} · billed at $${audPrice} AUD · cancel anytime`
  const navRef = useRef()
  const statsRef = useRef()
  const countersAnimated = useRef(false)

  const [followers, setFollowers] = useState('2,177')

  useEffect(() => {
    // Fetch real Instagram follower count from Behold
    fetch('https://feeds.behold.so/SVyieFYXHAirbiQqA0Ws')
      .then(r => r.json())
      .then(data => {
        const count = data?.followersCount || data?.userInfo?.followersCount || null
        if (count) setFollowers(count.toLocaleString())
      })
      .catch(() => {})

    // Inject fonts
    if (!document.querySelector('#hs-fonts')) {
      const link = document.createElement('link')
      link.id = 'hs-fonts'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap'
      document.head.appendChild(link)
    }

    // Inject Behold Instagram widget script
    if (!document.querySelector('#behold-script')) {
      const s = document.createElement('script')
      s.id = 'behold-script'
      s.type = 'module'
      s.src = 'https://w.behold.so/widget.js'
      document.head.appendChild(s)
    }

    // Nav shrink on scroll
    const handleScroll = () => {
      if (!navRef.current) return
      if (window.scrollY > 60) {
        navRef.current.style.padding = '12px 40px'
        navRef.current.style.boxShadow = '0 2px 20px rgba(0,0,0,0.08)'
      } else {
        navRef.current.style.padding = '18px 40px'
        navRef.current.style.boxShadow = 'none'
      }
    }
    window.addEventListener('scroll', handleScroll)

    // Scroll reveal
    const observer = new IntersectionObserver(entries => {
      entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('visible') })
    }, { threshold: 0.1 })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))

    // Animated counters
    const statObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersAnimated.current) {
          countersAnimated.current = true
          const nums = entry.target.querySelectorAll('.hs-stat-num')
          const targets = [2400, 18, 850, 17]
          const suffixes = ['+', 'k+', '+', '']
          nums.forEach((num, i) => {
            const target = targets[i]
            const suffix = suffixes[i]
            const duration = 1800
            const start = Date.now()
            const update = () => {
              const elapsed = Date.now() - start
              const progress = Math.min(elapsed / duration, 1)
              const eased = 1 - Math.pow(1 - progress, 3)
              const current = Math.round(target * eased)
              num.textContent = current.toLocaleString() + suffix
              if (progress < 1) requestAnimationFrame(update)
            }
            requestAnimationFrame(update)
          })
          statObserver.unobserve(entry.target)
        }
      })
    }, { threshold: 0.3 })
    if (statsRef.current) statObserver.observe(statsRef.current)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
      statObserver.disconnect()
    }
  }, [])

  const tickerItems = [...TICKER_ITEMS, ...TICKER_ITEMS]

  return (
    <>
      <style>{styles}</style>

      {/* Nav */}
      <nav className="hs-nav" ref={navRef}>
        <Link to="/" className="hs-nav-logo"><span>Hospo</span>Search</Link>
        {/* Mobile-only actions — visible when nav links are hidden */}
        <div className="hs-nav-mobile">
          {isLoggedIn
            ? <Link to="/app" style={{background:'var(--terra)',color:'white',padding:'8px 16px',borderRadius:100,fontWeight:600,fontSize:13,textDecoration:'none',whiteSpace:'nowrap'}}>Dashboard →</Link>
            : <>
                <Link to="/app?login=1" style={{color:'var(--ink-mid)',fontWeight:600,fontSize:13,textDecoration:'none',padding:'8px 12px'}}>Log in</Link>
                <Link to="/app?login=1&type=employer" style={{background:'var(--terra)',color:'white',padding:'8px 16px',borderRadius:100,fontWeight:600,fontSize:13,textDecoration:'none',whiteSpace:'nowrap'}}>Post a Job</Link>
              </>
          }
        </div>
        <ul className="hs-nav-links">
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#pricing" onClick={e=>{e.preventDefault();setModalDefaultTab('listing');setShowPricingModal(true);}}>Pricing</a></li>
          <li><a href="#for-employers">For employers</a></li>
          <li><Link to="/app">Browse jobs</Link></li>
          <li><a href="https://instagram.com/hosposearch" target="_blank" rel="noreferrer" aria-label="Follow HospoSearch on Instagram" style={{display:'flex',alignItems:'center'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a></li>
          {!isLoggedIn && (
          <li style={{position:'relative'}} className="hs-login-dd"
            onMouseEnter={e=>e.currentTarget.querySelector('.hs-dd-menu').style.display='block'}
            onMouseLeave={e=>e.currentTarget.querySelector('.hs-dd-menu').style.display='none'}>
            <a href="#" onClick={e=>e.preventDefault()} style={{display:'flex',alignItems:'center',gap:5}}>
              Log in <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
            </a>
            <div className="hs-dd-menu" style={{display:'none',position:'absolute',top:'100%',right:0,paddingTop:6,zIndex:200,minWidth:180}}>
              <div style={{background:'white',borderRadius:14,boxShadow:'0 8px 32px rgba(0,0,0,0.12)',border:'1px solid var(--border)',overflow:'hidden'}}>
                <Link to="/app?login=1&type=employee" style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',textDecoration:'none',color:'var(--ink)',fontSize:14,fontWeight:500,borderBottom:'1px solid var(--border)',transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <span style={{fontSize:18}}>👨‍🍳</span><div><div style={{fontWeight:600,fontSize:13}}>Job Seeker</div><div style={{color:'var(--ink-soft)',fontSize:11}}>Find your next role</div></div>
                </Link>
                <Link to="/app?login=1&type=employer" style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',textDecoration:'none',color:'var(--ink)',fontSize:14,fontWeight:500,transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <span style={{fontSize:18}}>🍽️</span><div><div style={{fontWeight:600,fontSize:13}}>Employer</div><div style={{color:'var(--ink-soft)',fontSize:11}}>Post jobs & find talent</div></div>
                </Link>
              </div>
            </div>
          </li>
          )}
          <li><button onClick={()=>{setModalDefaultTab('listing');setShowPricingModal(true)}} className="hs-nav-cta" style={{background:'var(--terra)',color:'white',padding:'9px 22px',borderRadius:100,fontWeight:600,fontSize:14,border:'none',cursor:'pointer'}}>Post a Job →</button></li>
          {isLoggedIn && (
            <li style={{position:'relative'}} className="hs-login-dd"
              onMouseEnter={e=>e.currentTarget.querySelector('.hs-dd-menu').style.display='block'}
              onMouseLeave={e=>e.currentTarget.querySelector('.hs-dd-menu').style.display='none'}>
              <Link to="/app" style={{background:'var(--terra)',color:'white',padding:'9px 22px',borderRadius:100,fontWeight:600,fontSize:14,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                My Dashboard <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
              </Link>
              <div className="hs-dd-menu" style={{display:'none',position:'absolute',top:'100%',right:0,paddingTop:6,zIndex:200,minWidth:180}}>
                <div style={{background:'white',borderRadius:14,boxShadow:'0 8px 32px rgba(0,0,0,0.12)',border:'1px solid var(--border)',overflow:'hidden'}}>
                  <Link to="/app" style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',textDecoration:'none',color:'var(--ink)',fontSize:14,fontWeight:500,borderBottom:'1px solid var(--border)',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                    onMouseLeave={e=>e.currentTarget.style.background='white'}>
                    <span style={{fontSize:18}}>🏠</span><div style={{fontWeight:600,fontSize:13}}>Open Dashboard</div>
                  </Link>
                  <button onClick={()=>supabase.auth.signOut().then(()=>setIsLoggedIn(false))}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',textDecoration:'none',color:'#DC2626',fontSize:14,fontWeight:500,background:'none',border:'none',cursor:'pointer',width:'100%',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{fontSize:18}}>🚪</span><div style={{fontWeight:600,fontSize:13}}>Log out</div>
                  </button>
                </div>
              </div>
            </li>
          )}
        </ul>
      </nav>

      {/* Hero — two column: left text, right live Instagram feed */}
      <section className="hs-hero" style={{minHeight:'90vh',padding:'110px 40px 60px',alignItems:'center'}}>
        <div className="hs-hero-inner hs-hero-inner-grid" style={{maxWidth:1160,margin:'0 auto',width:'100%',display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center'}}>
          {/* Left — candidate copy */}
          <div>
            <div className="hs-eyebrow fade-up-1">Now live · Australia &amp; New Zealand</div>
            <h1 className="hs-hero-title fade-up-2" style={{fontSize:'clamp(40px,5.5vw,72px)',letterSpacing:'-2px',marginBottom:22}}>
              Your next great<br/><em>hospitality role</em><br/>starts here
            </h1>
            <p className="hs-hero-sub fade-up-3" style={{marginBottom:32,fontSize:17}}>
              Browse thousands of jobs at the best restaurants, hotels, bars and cafés across Australia, New Zealand and beyond. Free to join. Apply in seconds.
            </p>
            <div className="hs-hero-actions fade-up-4" style={{marginBottom:18}}>
              <Link to="/app" className="btn-primary">🔍 Find Jobs — Free</Link>
              <button onClick={()=>{setModalDefaultTab('listing');setShowPricingModal(true)}} style={{background:'transparent',color:'var(--ink)',padding:'14px 24px',borderRadius:'100px',fontSize:'15px',fontWeight:'600',border:'1.5px solid var(--border)',transition:'all 0.2s',display:'inline-flex',alignItems:'center',gap:'8px',cursor:'pointer'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--ink)';e.currentTarget.style.background='rgba(15,14,12,0.04)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent';}}>
                Hiring? Post a job →
              </button>
            </div>
            <div className="fade-up-5" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:28}}>
              <span style={{fontSize:12,color:'var(--ink-soft)',flexShrink:0}}>Popular:</span>
              {['Head Chef','Sous Chef','Barista','Sommelier','Bar Manager','Floor Manager'].map(r=>(
                <Link key={r} to={"/app?search="+encodeURIComponent(r)} style={{background:'var(--cream)',border:'1px solid var(--border)',color:'var(--ink-mid)',fontSize:11,fontWeight:500,padding:'4px 10px',borderRadius:20,textDecoration:'none',whiteSpace:'nowrap',transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--terra-l)';e.currentTarget.style.borderColor='#E8CFBF';e.currentTarget.style.color='var(--terra)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--cream)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--ink-mid)';}}>{r}</Link>
              ))}
            </div>
            <div className="hs-trust fade-up-5">
              <div className="hs-trust-avatars">
                <span>👨‍🍳</span><span>👩‍🍳</span><span>🍽️</span><span>🌸</span>
              </div>
              <div className="hs-trust-text">
                <strong>Join {followers ? `${followers}+` : 'thousands of'} hospitality professionals</strong><br/>in the HospoSearch community
              </div>
            </div>
          </div>

          {/* Right — live Instagram feed */}
          <div className="fade-up-3" style={{position:'relative'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:32,height:32,borderRadius:10,background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white"/></svg>
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--ink)'}}>@hosposearch</div>
                  <div style={{fontSize:11,color:'var(--ink-soft)'}}>Latest from Instagram</div>
                </div>
              </div>
              <a href="https://www.instagram.com/hosposearch" target="_blank" rel="noreferrer"
                style={{fontSize:12,fontWeight:600,color:'var(--terra)',textDecoration:'none',border:'1px solid var(--terra)',borderRadius:20,padding:'4px 12px',transition:'all 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--terra-l)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                Follow
              </a>
            </div>
            <div style={{borderRadius:16,overflow:'hidden',border:'1px solid var(--border)',boxShadow:'0 8px 32px rgba(0,0,0,0.08)'}}>
              <behold-widget feed-id="SVyieFYXHAirbiQqA0Ws"></behold-widget>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="hs-ticker">
        <div className="hs-ticker-track">
          {tickerItems.map((item, i) => (
            <div className="hs-ticker-item" key={i}>
              <div className="hs-ticker-dot"/>{item}
            </div>
          ))}
        </div>
      </div>



      {/* Pricing */}
      <section className="hs-pricing" id="pricing" style={{background:'var(--cream)'}}>
        <div className="hs-pricing-inner">
          <div className="reveal" style={{textAlign:'center'}}>
            <div className="hs-section-tag" style={{color:'var(--terra)'}}>Simple pricing</div>
            <h2 className="hs-section-title" style={{color:'var(--ink)',marginBottom:'14px'}}>Transparent pricing.<br/>No hidden fees.</h2>
            <p style={{color:'var(--ink-soft)',fontSize:'16px',marginBottom:'32px',maxWidth:'460px',marginLeft:'auto',marginRight:'auto',lineHeight:'1.7'}}>Pay per listing or subscribe for regular hiring. Job seekers are always free.</p>
            {!cur.isAU && (
              <p style={{color:'var(--ink-soft)',opacity:0.7,fontSize:'12px',marginTop:'-20px',marginBottom:'28px',maxWidth:'460px',marginLeft:'auto',marginRight:'auto',lineHeight:'1.6'}}>
                All payments are processed and billed in Australian dollars (AUD). Prices shown in {cur.code} are an estimate based on current exchange rates and may vary slightly at checkout depending on your bank's conversion.
              </p>
            )}
            {/* Toggle */}
            <div style={{display:'inline-flex',background:'#fff',border:'1px solid var(--border)',borderRadius:100,padding:4,marginBottom:48,gap:4}}>
              {[['listing','Pay Per Listing'],['subscription','Subscriptions']].map(([v,l])=>(
                <button key={v} onClick={()=>setPricingTab(v)}
                  style={{padding:'9px 22px',borderRadius:100,border:'none',background:pricingTab===v?'var(--terra)':'transparent',color:pricingTab===v?'#fff':'var(--ink-soft)',fontWeight:pricingTab===v?700:500,fontSize:14,cursor:'pointer',transition:'all 0.2s'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const DOT = '#C4623A';
            const listingTiers = [
              { name:'Bronze', sub:'Standard Listing', price:50, cta:'Post a Job', featured:false,
                feats:['30-day listing visibility','Up to 5 photos','Unlimited applications','Application management dashboard','Verified venue profile','Discount codes accepted'] },
              { name:'Silver', sub:'Featured Listing', price:70, cta:'Post Featured', featured:true,
                feats:['Everything in Bronze','Pinned to top of feed for 30 days','Featured badge & silver star','Priority in search results','3× more applications on average','Highlighted in candidate job alerts'] },
              { name:'Gold', sub:'Premium Listing', price:100, cta:'Post Premium Gold', featured:false,
                feats:['Everything in Silver','Shared on @hosposearch Instagram','Shared on HospoSearch Facebook','Up to 5 employer screening questions','Priority application inbox','Gold "Premium Venue" verified badge'] },
            ];
            const subTiers = [
              { name:'Starter', sub:'3 active listings', price:99, cta:'Start Starter Plan', featured:false,
                tagline:'Great for small to medium businesses with regular hiring needs',
                feats:['3 active listings at any time','Bronze level listing on every post','Application management dashboard','Verified venue profile','Upgrade any listing to Silver (+$20) or Gold (+$50)','Cancel anytime — no lock-in'] },
              { name:'Growth', sub:'6 active listings', price:199, cta:'Start Growth Plan', featured:true,
                tagline:'Great for venues gearing up for seasonal rushes or rapid expansion',
                feats:['6 active listings at any time','Bronze level listing on every post','Candidate search & messaging','Highlighted in job alert emails','Priority application inbox','Upgrade any listing to Silver (+$20) or Gold (+$50)','Cancel anytime — no lock-in'] },
              { name:'Pro', sub:'10 active listings', price:399, cta:'Start Pro Plan', featured:false,
                tagline:'Great for hotels, resorts and large venue groups with ongoing staffing',
                feats:['10 active listings at any time','Bronze level listing on every post','Bulk application management','Analytics dashboard','Custom venue landing page','Upgrade any listing to Silver (+$20) or Gold (+$50)','Cancel anytime — no lock-in'] },
            ];
            const isSub = pricingTab==='subscription';
            const tiers = isSub ? subTiers : listingTiers;
            const onCta = isSub ? ()=>{setModalDefaultTab('subscription');setShowPricingModal(true);} : null;
            return (
              <div className="reveal visible hs-pricing-tier-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,maxWidth:900,margin:'0 auto 60px',textAlign:'left',alignItems:'stretch'}}>
                {tiers.map(t=>(
                  <div key={t.name} style={{background:'#fff',border:t.featured?'2px solid #C4623A':'1px solid #E8E2D8',borderRadius:18,padding:'30px 26px',position:'relative',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',boxShadow:t.featured?'0 12px 32px rgba(196,98,58,0.14)':'0 2px 10px rgba(0,0,0,0.04)',transition:'all 0.22s'}}
                    onMouseEnter={e=>{ if(!t.featured) e.currentTarget.style.borderColor='#C4623A'; e.currentTarget.style.transform='translateY(-3px)'; }}
                    onMouseLeave={e=>{ if(!t.featured) e.currentTarget.style.borderColor='#E8E2D8'; e.currentTarget.style.transform='none'; }}>
                    {t.featured && <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#C4623A',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',padding:'4px 16px',borderRadius:100,whiteSpace:'nowrap'}}>Most Popular</div>}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14}}>
                      <span style={{width:9,height:9,borderRadius:'50%',background:DOT,flexShrink:0}}/>
                      <div style={{color:t.featured?'#C4623A':'#7A7570',fontSize:11,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase'}}>{t.name}</div>
                    </div>
                    <div style={{color:'#A8A29A',fontSize:11,marginBottom:isSub&&t.tagline?4:14}}>{t.sub}</div>
                    {isSub && t.tagline && <div style={{color:'#7A7570',fontSize:11,lineHeight:1.45,marginBottom:14,fontStyle:'italic',padding:'0 4px'}}>{t.tagline}</div>}
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:6}}>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:46,fontWeight:800,color:'#0F0E0C',lineHeight:1,letterSpacing:-1.5}}>{px(t.price)}</div>
                      {isSub && <div style={{color:'#A8A29A',fontSize:13}}>/mo</div>}
                    </div>
                    <div style={{fontSize:12,color:'#A8A29A',margin:'5px 0 20px'}}>{isSub?subLabel(t.price):taxLabel('one-time',t.price)}</div>
                    <ul style={{listStyle:'none',padding:0,display:'flex',flexDirection:'column',gap:8,marginBottom:24,flex:'1 1 auto',textAlign:'left'}}>
                      {t.feats.map(f=>(
                        <li key={f} style={{fontSize:13,color:'#3A3733',display:'flex',alignItems:'flex-start',gap:8,lineHeight:1.45}}>
                          <span style={{color:'#C4623A',fontWeight:700,flexShrink:0}}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    {onCta ? (
                      <button onClick={onCta} style={{marginTop:'auto',width:'100%',textAlign:'center',background:t.featured?'#C4623A':'#fff',border:'1px solid #C4623A',color:t.featured?'#fff':'#C4623A',padding:'12px 0',borderRadius:100,fontSize:14,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}
                        onMouseEnter={e=>{ e.currentTarget.style.background=t.featured?'#A84F2E':'#FBF2EC'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background=t.featured?'#C4623A':'#fff'; }}>
                        Get Started
                      </button>
                    ) : (
                      <a href={`/app?tier=${t.name.toLowerCase()}&mode=listing`} style={{marginTop:'auto',width:'100%',display:'block',textAlign:'center',background:t.featured?'#C4623A':'#fff',border:'1px solid #C4623A',color:t.featured?'#fff':'#C4623A',padding:'12px 0',borderRadius:100,fontSize:14,fontWeight:700,textDecoration:'none',transition:'all 0.2s'}}
                        onMouseEnter={e=>{ e.currentTarget.style.background=t.featured?'#A84F2E':'#FBF2EC'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background=t.featured?'#C4623A':'#fff'; }}>
                        Get Started
                      </a>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Subscription fine print */}
          {pricingTab==='subscription' && (
            <div style={{maxWidth:660,margin:'-32px auto 40px',textAlign:'center',fontSize:11,color:'#A8A29A',lineHeight:1.7,padding:'0 16px'}}>
              Cancel anytime from your dashboard. No refunds are issued on the current billing period — to avoid renewal charges, cancel before your next billing date. All subscription listings are Bronze level. Individual listings can be upgraded to Silver or Gold anytime with a one-off payment.
            </div>
          )}

          {/* Seek comparison table */}
          <div className="reveal hs-compare-table" style={{maxWidth:900,margin:'0 auto',background:'#fff',borderRadius:20,border:'1px solid var(--border)',overflow:'hidden',marginBottom:28,boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}}>
            <div style={{padding:'20px 28px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:14,fontWeight:700,color:'var(--ink)'}}>How we compare</span>
              <span style={{fontSize:12,color:'var(--ink-soft)'}}>— vs the alternatives</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:'1px solid var(--border)'}}>
                    {['Feature','Competitors','HospoSearch Bronze','HospoSearch Silver','HospoSearch Gold'].map((h,i)=>(
                      <th key={h} style={{padding:'12px 20px',textAlign:i===0?'left':'center',color:i<=1?'var(--ink-soft)':'var(--terra)',fontWeight:700,fontSize:11,letterSpacing:1,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Price per listing', '$275–$695+', px(50), px(70), px(100)],
                    ['Hospitality-specific','✗','✓','✓','✓'],
                    ['Instagram-style feed','✗','✓','✓','✓'],
                    ['Story-style profiles','✗','✓','✓','✓'],
                    ['Pinned to top of feed','Extra cost','—','✓ 30 days','✓ 30 days'],
                    ['Social media promotion','✗','✗','✗','✓ Instagram + Facebook'],
                    ['Screening questions','Extra cost','✗','✗','✓ Up to 5'],
                    ['Priority application inbox','✗','✗','✗','✓'],
                                        ['Candidate job alert emails','Paid add-on','✗','✓','✓'],
                  ].map(([feat,...vals])=>(
                    <tr key={feat} style={{borderBottom:'1px solid var(--border)'}}>
                      <td style={{padding:'11px 20px',color:'var(--ink)',fontWeight:500}}>{feat}</td>
                      {vals.map((v,i)=>{
                        const isYes = v==='✓'||v.startsWith('✓');
                        return <td key={i} style={{padding:'11px 20px',textAlign:'center',color:isYes?'var(--terra)':v==='✗'?'#C8C2B8':'var(--ink-soft)',fontWeight:isYes||v==='✗'?700:400,whiteSpace:'nowrap'}}>{v}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hs-pricing-note reveal" style={{justifyContent:'center',color:'var(--ink-soft)'}}>Job seekers always browse and apply for free</div>
        </div>
      </section>

      {/* App showcase + Instagram feed placeholder */}
      <section className='hs-showcase-section' style={{background:'var(--cream)',padding:'80px 40px',overflow:'hidden',position:'relative'}}>
        <div style={{position:'absolute',top:-200,right:-200,width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(196,98,58,0.15),transparent 65%)',pointerEvents:'none'}}/>
        <div style={{maxWidth:1160,margin:'0 auto',position:'relative',zIndex:1}}>
          <div style={{textAlign:'center',marginBottom:52}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'var(--terra)',marginBottom:12}}>The app</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(30px,4vw,48px)',fontWeight:900,color:'var(--ink)',letterSpacing:-1,lineHeight:1.1,marginBottom:14}}>
              Job discovery, reimagined
            </h2>
            <p style={{color:'var(--ink-soft)',fontSize:15,maxWidth:480,margin:'0 auto'}}>
              Browse roles like an Instagram feed. Apply in seconds. Follow your favourite venues. Built entirely for hospitality.
            </p>
          </div>

          {/* Phone + feature callouts */}
          <div className="hs-showcase-grid" style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:40,alignItems:'center'}}>
            {/* Left features */}
            <div style={{display:'flex',flexDirection:'column',gap:24}}>
              {[
                {icon:'📸',title:'Story-style venue profiles',desc:'Follow venues and see their latest roles as stories — just like Instagram.'},
                {icon:'🔍',title:'Smart search & filters',desc:'Filter by country, state, sector, role type and salary band instantly.'},
                {icon:'📎',title:'One-tap apply',desc:'Save your résumé once. Apply to any role in seconds with it auto-attached.'},
              ].map(f=>(
                <div key={f.title} style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:'rgba(196,98,58,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{f.icon}</div>
                  <div>
                    <div style={{color:'var(--ink)',fontWeight:600,fontSize:14,marginBottom:3}}>{f.title}</div>
                    <div style={{color:'var(--ink-soft)',fontSize:13,lineHeight:1.55}}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone mockup */}
            <div style={{position:'relative',display:'flex',justifyContent:'center',animation:'float 6s ease-in-out infinite'}}>
              <div style={{position:'absolute',top:-16,right:-20,background:'var(--terra)',color:'white',padding:'8px 14px',borderRadius:12,fontSize:11,fontWeight:700,boxShadow:'0 4px 14px rgba(196,98,58,0.35)',whiteSpace:'nowrap',zIndex:4}}>✨ Head Chef · $90–110k</div>
              <div style={{position:'absolute',bottom:40,left:-28,background:'white',padding:'10px 14px',borderRadius:12,fontSize:11,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,0.12)',whiteSpace:'nowrap',color:'var(--ink)',zIndex:4,border:'1px solid var(--border)'}}>🎉 Application sent!</div>
              <div style={{width:240,background:'var(--ink)',borderRadius:36,padding:12,boxShadow:'0 40px 80px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.08)'}}>
                <div style={{width:72,height:22,background:'var(--ink)',borderRadius:'0 0 14px 14px',margin:'0 auto 8px'}}/>
                <div style={{background:'#FAF8F4',borderRadius:26,overflow:'hidden',aspectRatio:'9/19'}}>
                  <div style={{background:'white',padding:'10px 12px 8px',borderBottom:'1px solid #EAE4DA',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:800,color:'#1A1A1A'}}><span style={{color:'#C4623A'}}>Hospo</span>Search</div>
                    <span style={{fontSize:16}}>🔔</span>
                  </div>
                  <div style={{display:'flex',gap:10,padding:'8px 10px',background:'white',borderBottom:'1px solid #EAE4DA'}}>
                    {[['🍽️','Attica','#C4623A'],['🌸',"Tetsuya's",'#6B8F71'],['⚓','Quay','#C0BAB2']].map(([e,n,c])=>(
                      <div key={n} style={{textAlign:'center',flexShrink:0}}>
                        <div style={{width:38,height:38,borderRadius:'50%',background:`conic-gradient(${c} 0%,${c}88 55%,${c} 100%)`,padding:'2px',margin:'0 auto 2px'}}>
                          <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{e}</div>
                        </div>
                        <div style={{fontSize:'7px',color:'#888'}}>{n}</div>
                      </div>
                    ))}
                  </div>
                  {[{e:'🍽️',t:'Head Chef',m:'Attica · VIC',s:'$90–110k',bg:'linear-gradient(145deg,#EDE0D0,#CEBBA0)'},{e:'🌸',t:'Sommelier',m:"Tetsuya's · NSW",s:'$70–85k',bg:'linear-gradient(145deg,#D0E0D0,#AACCAA)'}].map(c=>(
                    <div key={c.t} style={{background:'white',borderBottom:'1px solid #EAE4DA'}}>
                      <div style={{height:90,background:c.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{c.e}</div>
                      <div style={{padding:'6px 9px 8px'}}>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:11,fontWeight:700,color:'#1A1A1A'}}>{c.t}</div>
                        <div style={{fontSize:9,color:'#888',marginBottom:3}}>{c.m}</div>
                        <div style={{fontSize:10,color:'#C9A96E',fontWeight:700}}>{c.s}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right features */}
            <div style={{display:'flex',flexDirection:'column',gap:24}}>
              {[
                {icon:'🔔',title:'Job alerts',desc:'Set alerts for any role, location or sector. Get notified the moment it posts.'},
                {icon:'⭐',title:'Skill endorsements',desc:'Let employers endorse your skills. Build credibility before the interview.'},
                {icon:'📊',title:'Application tracking',desc:'See exactly where every application stands — Sent, Viewed, Shortlisted.'},
              ].map(f=>(
                <div key={f.title} style={{display:'flex',gap:14,alignItems:'flex-start',flexDirection:'row-reverse',textAlign:'right'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:'rgba(196,98,58,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{f.icon}</div>
                  <div>
                    <div style={{color:'var(--ink)',fontWeight:600,fontSize:14,marginBottom:3}}>{f.title}</div>
                    <div style={{color:'var(--ink-soft)',fontSize:13,lineHeight:1.55}}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{textAlign:'center',marginTop:52}}>
            <Link to="/app" style={{display:'inline-flex',alignItems:'center',gap:8,background:'var(--terra)',color:'white',padding:'14px 32px',borderRadius:100,fontSize:15,fontWeight:700,textDecoration:'none',boxShadow:'0 4px 18px rgba(196,98,58,0.3)',transition:'all 0.2s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--terra-d)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--terra)'}>
              🔍 Start browsing jobs →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="hs-section" id="how-it-works">
        <div className="hs-section-inner">
          <div className="reveal" style={{textAlign:'center'}}>
            <div className="hs-section-tag">How it works</div>
            <h2 className="hs-section-title">Built for Everyone<br/>in Hospitality</h2>
            <p className="hs-section-sub" style={{marginLeft:'auto',marginRight:'auto'}}>Whether you run a restaurant, hotel, bar, café or any hospitality venue looking for your next great hire — or you're a hospitality professional ready for your next move.</p>
          </div>
          <div className="hs-split reveal">
            <div className="hs-split-panel cand">
              <div className="hs-split-icon cand">👨‍🍳</div>
              <div className="hs-split-eyebrow cand">For Job Seekers</div>
              <h3 className="hs-split-title">Find your next role in hospitality</h3>
              <p className="hs-split-desc">Browse roles from the best venues in Australia, New Zealand and worldwide. Apply in seconds — it's completely free.</p>
              <ul className="hs-feat-list">
                {['Swipe through roles like an Instagram feed','Filter by country, state, city, sector and role type','Save résumé & cover letter to auto-attach','Track every application and its status','Get job alerts for matching roles','Build a portfolio with work history and photos','Collect verified references and skill endorsements'].map(f=><li key={f}>{f}</li>)}
              </ul>
              <Link to="/app" className="btn-cand">Browse Jobs — Free →</Link>
            </div>
            <div className="hs-split-panel emp" id="for-employers">
              <div className="hs-split-icon emp">🍽️</div>
              <div className="hs-split-eyebrow emp">For Employers</div>
              <h3 className="hs-split-title">Hire exceptional hospitality talent</h3>
              <p className="hs-split-desc">Post your role in minutes. Reach thousands of qualified candidates across Australia, New Zealand, and beyond.</p>
              <ul className="hs-feat-list">
                {['Instagram-style listings with up to 5 photos','Applicants attach résumé and cover letter directly','Manage applications with status tracking','Browse and contact candidates proactively','Verified venue profile with awards & analytics','Featured listings for maximum visibility','Affordable per-listing pricing'].map(f=><li key={f}>{f}</li>)}
              </ul>
              <button onClick={()=>{setModalDefaultTab('listing');setShowPricingModal(true)}} className="btn-emp" style={{background:'var(--terra)',color:'white',padding:'13px 26px',borderRadius:100,fontSize:14,fontWeight:700,border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7,boxShadow:'0 3px 12px rgba(196,98,58,0.25)'}}>Post a Job →</button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="hs-section" style={{background:'white',paddingTop:'72px',paddingBottom:'72px'}}>
        <div className="hs-section-inner">
          <div className="reveal" style={{textAlign:'center'}}>
            <div className="hs-section-tag">Browse by sector</div>
            <h2 className="hs-section-title">Every venue, every role</h2>
            <p className="hs-section-sub" style={{marginLeft:'auto',marginRight:'auto'}}>From fine dining and luxury hotels to bars, cafés, resorts and everything in between — opportunities across the whole industry.</p>
          </div>
          <div className="hs-cats reveal">
            {[['🍽️','Restaurants','Fine dining to casual'],['🏨','Hotels','Luxury to boutique'],['🍸','Bars','Cocktail bars & pubs'],['☕','Cafés','Specialty & espresso'],['🏝️','Resorts','ANZ & international'],['🎉','Events','Functions & catering'],['🍷','Wineries','Cellar door & estates'],['🍰','Bakeries','Pastry & artisan']].map(([icon,name,sub])=>(
              <Link to="/app" className="hs-cat" key={name}>
                <div className="hs-cat-icon">{icon}</div>
                <div className="hs-cat-name">{name}</div>
                <div className="hs-cat-sub">{sub}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="hs-section">
        <div className="hs-section-inner">
          <div className="reveal" style={{textAlign:'center'}}>
            <div className="hs-section-tag">What people are saying</div>
            <h2 className="hs-section-title">Trusted by the industry</h2>
            <p className="hs-section-sub" style={{marginLeft:'auto',marginRight:'auto'}}>From head chefs to floor managers, hospitality professionals across Australia, New Zealand and beyond are finding their next great role on HospoSearch.</p>
          </div>
          <div className="hs-testi-grid reveal">
            {[
              {emoji:'👨‍🍳',quote:'"I landed my Head Chef role within a week of signing up. The quality of venues on here is outstanding — these are exactly the kind of places I wanted to work. Best career move I\'ve made."',name:'Sarah Mitchell',role:'Head Chef · Melbourne'},
              {emoji:'👨‍🍳',quote:'"Finally a jobs platform that actually understands hospitality. The Instagram-style feed makes it so easy to browse — I got three interviews in my first week."',name:'Jordan Lim',role:'Chef de Partie · Melbourne'},
              {emoji:'👩‍🍳',quote:'"The verified references feature is game-changing. Employers can see my track record before we even have a conversation. Landed my dream role at a hatted restaurant."',name:'Mia Santos',role:'Floor Manager · Sydney'},
            ].map(t=>(
              <div className="hs-testi-card" key={t.name}>
                <div className="hs-stars">★★★★★</div>
                <p className="hs-testi-quote">{t.quote}</p>
                <div className="hs-testi-author">
                  <div className="hs-testi-avatar">{t.emoji}</div>
                  <div><div className="hs-testi-name">{t.name}</div><div className="hs-testi-role">{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Locations */}
      <section className="hs-section" style={{background:'white'}} id="locations">
        <div className="hs-section-inner">
          <div className="reveal" style={{textAlign:'center'}}>
            <div className="hs-section-tag">Where we operate</div>
            <h2 className="hs-section-title">Hospitality knows no borders</h2>
            <p className="hs-section-sub" style={{marginBottom:'40px',marginLeft:'auto',marginRight:'auto'}}>Take your career anywhere in the world with HospoSearch — from Australia and New Zealand to the UK, Asia, the Middle East and beyond.</p>
          </div>
          <div className="hs-locs-grid reveal">
            {[['🇦🇺','Australia'],['🇳🇿','New Zealand'],['🇬🇧','United Kingdom'],['🇺🇸','United States'],['🇦🇪','UAE'],['🇸🇬','Singapore'],['🇯🇵','Japan'],['🇫🇷','France'],['🇮🇹','Italy'],['🇹🇭','Thailand'],['🇭🇰','Hong Kong'],['🇨🇳','China'],['🇩🇪','Germany'],['🇪🇸','Spain'],['🇨🇦','Canada'],['🌏','+ more']].map(([flag,country])=>(
              <Link to="/app" className="hs-loc" key={country}><span>{flag}</span>{country}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Feed Section */}
      <section className="hs-section" style={{background:'white',paddingTop:'80px',paddingBottom:'80px'}}>
        <div className="hs-section-inner">
          <div className="reveal" style={{textAlign:'center',marginBottom:36}}>
            <div className="hs-section-tag">Follow along</div>
            <h2 className="hs-section-title" style={{marginBottom:8}}>Follow our feed</h2>
            <p style={{color:'var(--ink-soft)',fontSize:15,lineHeight:1.6,maxWidth:520,marginLeft:'auto',marginRight:'auto',marginBottom:22}}>
              Join <strong style={{color:'var(--ink)'}}>{followers}+</strong> in the HospoSearch community — venue spotlights, chef profiles, career tips and the jobs everyone's talking about.
            </p>
            <a href="https://www.instagram.com/hosposearch" target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:9,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:100,padding:'10px 20px',textDecoration:'none',color:'var(--ink)',fontSize:13,fontWeight:600,transition:'all 0.2s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--terra-l)';e.currentTarget.style.borderColor='#E8CFBF';}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--cream)';e.currentTarget.style.borderColor='var(--border)';}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
              @hosposearch
            </a>
          </div>

          {/* Live Behold Instagram feed */}
          <div className="reveal" style={{marginBottom:32}}>
            <behold-widget feed-id="SVyieFYXHAirbiQqA0Ws"></behold-widget>
          </div>

          <div className="reveal" style={{textAlign:'center',marginTop:8}}>
            <a href="https://www.instagram.com/hosposearch" target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:8,background:'var(--ink)',color:'white',padding:'13px 28px',borderRadius:100,fontSize:14,fontWeight:600,textDecoration:'none',transition:'all 0.2s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white"/></svg>
              Follow @hosposearch for more
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="hs-final">
        <h2 className="hs-final-title">Your next role is<br/>waiting for you</h2>
        <p className="hs-final-sub">The hospitality industry's home for talent. Browse roles, discover venues, and take your career further.</p>
        <div className="hs-final-actions">
          <Link to="/app" className="btn-white">🔍 Find Jobs — Free</Link>
          <button onClick={()=>{setModalDefaultTab('listing');setShowPricingModal(true)}} className="btn-ghost" style={{background:'rgba(255,255,255,0.15)',color:'white',padding:'14px 28px',borderRadius:100,fontSize:15,fontWeight:600,textDecoration:'none',border:'1.5px solid rgba(255,255,255,0.3)',transition:'all 0.2s',cursor:'pointer'}}>Hiring? Post a job →</button>
        </div>
        {/* Employer email capture */}
        <div style={{marginTop:40,background:'rgba(255,255,255,0.1)',borderRadius:16,padding:'24px 28px',maxWidth:480,marginLeft:'auto',marginRight:'auto',border:'1px solid rgba(255,255,255,0.15)'}}>
          <div style={{color:'white',fontWeight:700,fontSize:16,marginBottom:6}}>Hiring? Get notified about new candidates</div>
          <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginBottom:16}}>Drop your email and we'll send you matching candidates as they join.</div>
          <div style={{display:'flex',gap:8}}>
            <input
              type="email"
              placeholder="your@venue.com.au"
              id="employer-capture-email"
              style={{flex:1,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'11px 14px',color:'white',fontSize:14,outline:'none'}}
            />
            <button
              onClick={async()=>{
                const el = document.getElementById('employer-capture-email');
                const email = el?.value;
                if (!email || !email.includes('@')) return;
                try {
                  await fetch('/api/notify-abandoned', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({ email, jobTitle:'Candidate interest from landing page', tier:'landing', source:'employer_capture' })
                  });
                  if(el) el.value='';
                  const thanks = document.getElementById('employer-capture-thanks');
                  if(thanks) thanks.style.display='block';
                } catch(e) {}
              }}
              style={{background:'white',color:'var(--terra)',padding:'11px 20px',borderRadius:10,fontSize:14,fontWeight:700,border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>
              Notify Me
            </button>
          </div>
          <div id="employer-capture-thanks" style={{display:'none',color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:10,textAlign:'center'}}>✓ Got it — we'll be in touch!</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hs-footer">
        <div className="hs-footer-inner">
          <div className="hs-footer-top">
            <div>
              <div className="hs-footer-logo" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} style={{cursor:'pointer'}}><span>Hospo</span>Search</div>
              <p className="hs-footer-desc">The premier hospitality jobs platform for Australia, New Zealand, and the world. Built by people who love good food, great service, and the teams behind them.</p>
              <div className="hs-footer-domains">
                {['hosposearch.com','hosposearch.com.au','hosposearch.co.nz','hosposearch.co.uk'].map(d=><span className="hs-footer-domain" key={d}>{d}</span>)}
              </div>
            </div>
            <div>
              <div className="hs-footer-col-title">Platform</div>
              <ul className="hs-footer-links">
                <li><Link to="/app">Browse Jobs</Link></li>
                <li><Link to="/app">Post a Job</Link></li>
                <li><a href="#how-it-works">For Employers</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
            </div>
            <div>
              <div className="hs-footer-col-title">Locations</div>
              <ul className="hs-footer-links">
                <li><a href="https://www.hosposearch.com.au" target="_blank" rel="noreferrer">Australia</a></li>
                <li><a href="https://www.hosposearch.co.nz" target="_blank" rel="noreferrer">New Zealand</a></li>
                <li><a href="https://www.hosposearch.co.uk" target="_blank" rel="noreferrer">United Kingdom</a></li>
                <li><a href="https://www.hosposearch.com" target="_blank" rel="noreferrer">Asia Pacific</a></li>
                <li><a href="https://www.hosposearch.com" target="_blank" rel="noreferrer">Middle East</a></li>
              </ul>
            </div>
            <div>
              <div className="hs-footer-col-title">Company</div>
              <ul className="hs-footer-links">
                <li><button onClick={()=>setFooterModal('about')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:13,cursor:'pointer',padding:0,textAlign:'left'}}>About</button></li>
                <li><button onClick={()=>{setContactModal(true);setContactSent(false);setContactForm({name:'',email:'',phone:'',query:''}); }} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:13,cursor:'pointer',padding:0,textAlign:'left'}}>Contact</button></li>
                <li><button onClick={()=>setFooterModal('privacy')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:13,cursor:'pointer',padding:0,textAlign:'left'}}>Privacy Policy</button></li>
                <li><button onClick={()=>setFooterModal('terms')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:13,cursor:'pointer',padding:0,textAlign:'left'}}>Terms of Service</button></li>
              </ul>
            </div>
          </div>
          <div className="hs-footer-bottom">
            <span>© {new Date().getFullYear()} HospoSearch. All rights reserved.</span>
            <span>Made with ❤️ for the hospitality industry</span>
          </div>
        </div>
      </footer>

      {/* Contact modal */}
      {contactModal && (
        <div onClick={()=>setContactModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(4px)'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:'36px 40px',maxWidth:480,width:'100%',position:'relative'}}>
            <button onClick={()=>setContactModal(false)} style={{position:'absolute',top:16,right:16,background:'#F4F0EB',border:'none',borderRadius:'50%',width:32,height:32,fontSize:16,cursor:'pointer',color:'#3A3733'}}>×</button>
            {contactSent ? (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:48,marginBottom:14}}>✉️</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:'#0F0E0C',marginBottom:8}}>Message sent!</div>
                <p style={{color:'#7A7570',fontSize:14,lineHeight:1.6}}>Thanks for reaching out. We'll get back to you at {contactForm.email} shortly.</p>
              </div>
            ) : (
              <>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:'#0F0E0C',marginBottom:4}}>Get in touch</div>
                <p style={{color:'#7A7570',fontSize:13,marginBottom:24}}>Send us a message and we'll get back to you within 24 hours.</p>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {[['Name *','name','text','Your name'],['Email *','email','email','you@email.com'],['Phone','phone','tel','04xx xxx xxx']].map(([label,key,type,ph])=>(
                    <div key={key}>
                      <div style={{fontSize:11,fontWeight:600,color:'#7A7570',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{label}</div>
                      <input type={type} value={contactForm[key]} onChange={e=>setContactForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                        style={{width:'100%',background:'#F4F0EB',border:'1px solid #E8E2D8',borderRadius:10,padding:'11px 13px',fontSize:14,color:'#0F0E0C',outline:'none',boxSizing:'border-box'}}/>
                    </div>
                  ))}
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:'#7A7570',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Message *</div>
                    <textarea value={contactForm.query} onChange={e=>setContactForm(f=>({...f,query:e.target.value}))} placeholder="How can we help you?" rows={4}
                      style={{width:'100%',background:'#F4F0EB',border:'1px solid #E8E2D8',borderRadius:10,padding:'11px 13px',fontSize:14,color:'#0F0E0C',outline:'none',resize:'none',boxSizing:'border-box'}}/>
                  </div>
                  <button onClick={sendContact} disabled={contactSending||!contactForm.name.trim()||!contactForm.email.includes('@')||!contactForm.query.trim()}
                    style={{background:'#C4623A',color:'#fff',border:'none',borderRadius:100,padding:'13px 0',fontSize:15,fontWeight:700,cursor:'pointer',opacity:contactSending?0.7:1,transition:'opacity 0.2s'}}>
                    {contactSending ? 'Sending…' : 'Send message →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer modals — About, Privacy, Terms */}
      {footerModal && (
        <div onClick={()=>setFooterModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(4px)'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:'36px 40px',maxWidth:580,width:'100%',maxHeight:'80vh',overflowY:'auto',position:'relative'}}>
            <button onClick={()=>setFooterModal(null)} style={{position:'absolute',top:16,right:16,background:'#F4F0EB',border:'none',borderRadius:'50%',width:32,height:32,fontSize:16,cursor:'pointer',color:'#3A3733'}}>×</button>
            {footerModal==='about' && <>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:'#0F0E0C',marginBottom:16}}>About HospoSearch</div>
              <p style={{fontSize:14,lineHeight:1.8,color:'#3A3733',marginBottom:14}}>HospoSearch is a hospitality-first job platform built for the people who make the industry exceptional — the chefs, sommeliers, venue managers, front-of-house legends, and everyone behind the scenes.</p>
              <p style={{fontSize:14,lineHeight:1.8,color:'#3A3733',marginBottom:14}}>We were built by people who've worked in hospitality and understand the industry's unique culture, pace, and talent. We believe the best venues deserve to find the best people — and the best people deserve to find roles that match their ambition.</p>
              <p style={{fontSize:14,lineHeight:1.8,color:'#3A3733',marginBottom:14}}>Based in Australia and New Zealand, we're growing across the UK and internationally, with a focus on the high-end hospitality scene where presentation, technique, and passion matter most.</p>
              <p style={{fontSize:14,lineHeight:1.8,color:'#3A3733'}}><strong>Contact us:</strong> <a href="mailto:hello@hosposearch.com.au" style={{color:'#C4623A'}}>hello@hosposearch.com.au</a></p>
            </>}
            {footerModal==='privacy' && <>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:'#0F0E0C',marginBottom:16}}>Privacy Policy</div>
              <p style={{fontSize:12,color:'#A8A29A',marginBottom:20}}>Last updated: June 2026</p>
              {[
                ['Information We Collect','We collect information you provide when creating an account (name, email, employment history), information about how you use our platform, and technical information such as your IP address and device type.'],
                ['How We Use Your Information','We use your information to match job seekers with relevant roles, enable employers to find candidates, send notifications about applications and jobs, and improve our platform. We do not sell your personal data to third parties.'],
                ['Data Storage','Your data is stored securely on servers provided by Supabase. We use industry-standard encryption for data in transit and at rest.'],
                ['Cookies','We use essential cookies to keep you logged in and remember your preferences. We do not use advertising or tracking cookies.'],
                ['Your Rights','You may request access to, correction of, or deletion of your personal data at any time by emailing hello@hosposearch.com.au.'],
                ['Contact','For privacy-related enquiries: hello@hosposearch.com.au'],
              ].map(([h,b])=>(
                <div key={h} style={{marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#0F0E0C',marginBottom:6}}>{h}</div>
                  <p style={{fontSize:13,lineHeight:1.7,color:'#3A3733',margin:0}}>{b}</p>
                </div>
              ))}
            </>}
            {footerModal==='terms' && <>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:'#0F0E0C',marginBottom:16}}>Terms of Service</div>
              <p style={{fontSize:12,color:'#A8A29A',marginBottom:20}}>Last updated: June 2026</p>
              {[
                ['Acceptance','By using HospoSearch you agree to these terms. If you do not agree, please do not use the platform.'],
                ['Job Listings','Employers are responsible for the accuracy of their job listings. HospoSearch reserves the right to remove listings that are misleading, offensive, or violate our community guidelines.'],
                ['Payments','Listing fees are charged per posting. Subscriptions are billed monthly and may be cancelled at any time from your account dashboard. Cancellations must be made before the next renewal date to avoid being charged for the following period. No refunds are issued on the current billing period. All prices are in AUD unless otherwise stated.'],
                ['Candidate Data','Job seekers grant employers permission to view their profile and application information for the purpose of recruitment only. This data may not be used for any other purpose.'],
                ['Prohibited Use','You may not use HospoSearch to post fraudulent listings, scrape data, spam users, or engage in any activity that harms the platform or its users.'],
                ['Liability','HospoSearch is a platform connecting employers and job seekers. We are not responsible for the outcomes of hiring decisions or the conduct of users.'],
                ['Contact','For terms-related enquiries: hello@hosposearch.com.au'],
              ].map(([h,b])=>(
                <div key={h} style={{marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#0F0E0C',marginBottom:6}}>{h}</div>
                  <p style={{fontSize:13,lineHeight:1.7,color:'#3A3733',margin:0}}>{b}</p>
                </div>
              ))}
            </>}
          </div>
        </div>
      )}
    <>
      {showPricingModal && <PricingModal onClose={()=>setShowPricingModal(false)} defaultTab={modalDefaultTab}/>}
    </>
    </>
  )
}
