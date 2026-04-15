import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

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
  .hs-nav-links a{color:var(--ink-mid);text-decoration:none;font-size:14px;font-weight:500;transition:color 0.2s;}
  .hs-nav-links a:hover{color:var(--terra);}
  .hs-nav-cta{background:var(--terra)!important;color:white!important;padding:9px 22px!important;border-radius:100px;font-weight:600!important;font-size:14px!important;transition:background 0.2s,transform 0.15s!important;}
  .hs-nav-cta:hover{background:var(--terra-d)!important;transform:translateY(-1px);}

  /* Hero */
  .hs-hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px 40px 80px;position:relative;overflow:hidden;}
  .hs-hero::before{content:'';position:absolute;top:-120px;right:-120px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(196,98,58,0.12) 0%,transparent 70%);pointer-events:none;}
  .hs-hero::after{content:'';position:absolute;bottom:-80px;left:-80px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(107,143,113,0.10) 0%,transparent 70%);pointer-events:none;}
  .hs-hero-inner{max-width:1160px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;}
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
  .hs-pricing-cards{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:740px;}
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
  .btn-ghost{background:rgba(255,255,255,0.15);color:white;padding:14px 28px;border-radius:100px;font-size:15px;font-weight:600;text-decoration:none;border:1.5px solid rgba(255,255,255,0.3);transition:all 0.2s;}
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

  /* Mobile */
  @media(max-width:900px){
    .hs-nav{padding:16px 20px;}
    .hs-nav-links{display:none;}
    .hs-hero{padding:100px 20px 60px;}
    .hs-hero-inner{grid-template-columns:1fr;}
    .hs-phone-wrap{display:none;}
    .hs-section{padding:64px 20px;}
    .hs-split{grid-template-columns:1fr;}
    .hs-split-panel{padding:36px 28px;}
    .hs-stats-inner{grid-template-columns:repeat(2,1fr);}
    .hs-stat{padding:28px 20px;}
    .hs-stat:nth-child(2){border-right:none;}
    .hs-stat-num{font-size:36px;}
    .hs-cats{grid-template-columns:repeat(2,1fr);}
    .hs-testi-grid{grid-template-columns:1fr;}
    .hs-locs-grid{grid-template-columns:repeat(3,1fr);}
    .hs-pricing-cards{grid-template-columns:1fr;max-width:380px;}
    .hs-footer-top{grid-template-columns:1fr 1fr;gap:32px;}
    .hs-footer-bottom{flex-direction:column;gap:10px;text-align:center;}
    .hs-final{padding:72px 20px;}
    .hs-pricing{padding:72px 20px;}
  }
  @media(max-width:520px){
    .hs-cats{grid-template-columns:repeat(2,1fr);}
    .hs-locs-grid{grid-template-columns:repeat(2,1fr);}
    .hs-footer-top{grid-template-columns:1fr;}
    .hs-hero-actions{flex-direction:column;align-items:flex-start;}
    .hs-final-actions{flex-direction:column;}
  }
`

const TICKER_ITEMS = [
  "Head Chef · Melbourne VIC","Sommelier · Sydney NSW","Bar Manager · Brisbane QLD",
  "Pastry Chef · Auckland NZ","Floor Manager · Perth WA","Barista · Melbourne VIC",
  "Executive Chef · Gold Coast QLD","Concierge · Dubai UAE","Restaurant Manager · Wellington NZ",
  "Kitchen Hand · Adelaide SA","Chef de Partie · Hobart TAS","Venue Manager · Sydney NSW",
]

export default function Landing() {
  const navRef = useRef()
  const statsRef = useRef()
  const countersAnimated = useRef(false)

  useEffect(() => {
    // Inject fonts
    if (!document.querySelector('#hs-fonts')) {
      const link = document.createElement('link')
      link.id = 'hs-fonts'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap'
      document.head.appendChild(link)
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
        <ul className="hs-nav-links">
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#locations">Locations</a></li>
          <li style={{position:'relative'}} className="hs-login-dd"
            onMouseEnter={e=>e.currentTarget.querySelector('.hs-dd-menu').style.display='block'}
            onMouseLeave={e=>e.currentTarget.querySelector('.hs-dd-menu').style.display='none'}>
            <a href="#" onClick={e=>e.preventDefault()} style={{display:'flex',alignItems:'center',gap:5}}>
              Log in <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
            </a>
            {/* paddingTop bridges the gap so mouse doesn't leave the hover zone */}
            <div className="hs-dd-menu" style={{display:'none',position:'absolute',top:'100%',right:0,paddingTop:6,zIndex:200,minWidth:180}}>
              <div style={{background:'white',borderRadius:14,boxShadow:'0 8px 32px rgba(0,0,0,0.12)',border:'1px solid var(--border)',overflow:'hidden'}}>
                <Link to="/app" style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',textDecoration:'none',color:'var(--ink)',fontSize:14,fontWeight:500,borderBottom:'1px solid var(--border)',transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <span style={{fontSize:18}}>👨‍🍳</span><div><div style={{fontWeight:600,fontSize:13}}>Job Seeker</div><div style={{color:'var(--ink-soft)',fontSize:11}}>Find your next role</div></div>
                </Link>
                <Link to="/app" style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',textDecoration:'none',color:'var(--ink)',fontSize:14,fontWeight:500,transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <span style={{fontSize:18}}>🍽️</span><div><div style={{fontWeight:600,fontSize:13}}>Employer</div><div style={{color:'var(--ink-soft)',fontSize:11}}>Post jobs & find talent</div></div>
                </Link>
              </div>
            </div>
          </li>
          <li><Link to="/app" className="hs-nav-cta">Post a Job →</Link></li>
        </ul>
      </nav>

      {/* Hero */}
      <section className="hs-hero">
        <div className="hs-hero-inner">
          <div>
            <div className="hs-eyebrow fade-up-1">Now live · Australia &amp; New Zealand</div>
            <h1 className="hs-hero-title fade-up-2">
              Your next great<br/><em>hospitality role</em><br/>starts here
            </h1>
            <p className="hs-hero-sub fade-up-3">
              Browse thousands of jobs at the best restaurants, hotels, bars and cafés across Australia, New Zealand and beyond. Free to join. Apply in seconds.
            </p>
            <div className="hs-hero-actions fade-up-4">
              <Link to="/app" className="btn-primary">🔍 Find Jobs — Free</Link>
              <Link to="/app" style={{background:'transparent',color:'var(--ink)',padding:'14px 28px',borderRadius:'100px',fontSize:'15px',fontWeight:'600',textDecoration:'none',border:'1.5px solid var(--border)',transition:'all 0.2s',display:'inline-flex',alignItems:'center',gap:'8px'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--ink)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';}}>
                Hiring? Post a job →
              </Link>
            </div>
            <div className="fade-up-5" style={{marginTop:16,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:'var(--ink-soft)',flexShrink:0}}>Popular searches:</span>
              {['Head Chef','Sous Chef','Barista','Sommelier','Bar Manager','Floor Manager','Kitchen Hand'].map(r=>(
                <Link key={r} to="/app" style={{background:'var(--cream)',border:'1px solid var(--border)',color:'var(--ink-mid)',fontSize:11,fontWeight:500,padding:'4px 11px',borderRadius:20,textDecoration:'none',whiteSpace:'nowrap',transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--terra-l)';e.currentTarget.style.borderColor='#E8CFBF';e.currentTarget.style.color='var(--terra)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--cream)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--ink-mid)';}}>{r}</Link>
              ))}
            </div>
            <div className="hs-trust fade-up-5">
              <div className="hs-trust-avatars">
                <span>👨‍🍳</span><span>👩‍🍳</span><span>🍽️</span><span>🌸</span>
              </div>
              <div className="hs-trust-text">
                <strong>18,000+ hospitality professionals</strong><br/>already on HospoSearch
              </div>
            </div>
          </div>

          {/* Phone mockup */}
          <div style={{position:'relative',display:'flex',justifyContent:'center',alignItems:'center'}} className="fade-up-3">
            <div className="hs-phone-wrap">
              <div className="hs-phone-badge">✨ Head Chef · $90–110k</div>
              <div className="hs-phone-badge-2">🎉 Application sent!</div>
              <div className="deco-ring" style={{width:'340px',height:'340px',top:'-40px',left:'-40px'}}/>
              <div className="deco-ring" style={{width:'240px',height:'240px',top:'20px',left:'20px',opacity:0.5}}/>
              <div className="hs-phone">
                <div className="hs-phone-notch"/>
                <div className="hs-phone-screen">
                  <div className="hs-phone-header">
                    <div className="hs-phone-logo"><span>Hospo</span>Search</div>
                    <span style={{fontSize:'18px'}}>🔔</span>
                  </div>
                  <div style={{display:'flex',gap:'12px',padding:'10px 12px',background:'white',borderBottom:'1px solid #EAE4DA',overflow:'hidden'}}>
                    {[['🍽️','Attica','story-new'],['🌸',"Tetsuya's",'story-fol'],['⚓','Quay','story-seen']].map(([emoji,name,cls])=>(
                      <div key={name} style={{textAlign:'center',flexShrink:0}}>
                        <div style={{width:'44px',height:'44px',borderRadius:'50%',
                          background: cls==='story-new'?'conic-gradient(#C4623A 0%,#C9A96E 55%,#C4623A 100%)':
                                      cls==='story-fol'?'conic-gradient(#6B8F71 0%,#A8D4AE 55%,#6B8F71 100%)':'#D0C8BC',
                          padding:'2.5px',margin:'0 auto 3px'}}>
                          <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>{emoji}</div>
                        </div>
                        <div style={{fontSize:'8px',color:'#888'}}>{name}</div>
                      </div>
                    ))}
                  </div>
                  {[
                    {emoji:'🍽️',title:'Head Chef',meta:'Attica · Ripponlea VIC',salary:'$90–110k · Full-time',bg:'linear-gradient(145deg,#EDE0D0,#CEBBA0)'},
                    {emoji:'🌸',title:'Sommelier',meta:"Tetsuya's · Sydney NSW",salary:"$70–85k · Full-time",bg:'linear-gradient(145deg,#D0E0D0,#AACCAA)'},
                  ].map(c=>(
                    <div className="hs-phone-card" key={c.title}>
                      <div className="hs-phone-card-img" style={{background:c.bg}}>{c.emoji}</div>
                      <div className="hs-phone-card-body">
                        <div className="hs-phone-card-title">{c.title}</div>
                        <div className="hs-phone-card-meta">{c.meta}</div>
                        <div className="hs-phone-card-salary">{c.salary}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* Stats */}
      <div className="hs-stats" ref={statsRef}>
        <div className="hs-stats-inner">
          {[['2,400+','Active job listings'],['18k+','Hospitality professionals'],['850+','Venues hiring now'],['17','Countries covered']].map(([n,l])=>(
            <div className="hs-stat reveal" key={l}>
              <div className="hs-stat-num">{n}</div>
              <div className="hs-stat-label">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="hs-section" id="how-it-works">
        <div className="hs-section-inner">
          <div className="reveal">
            <div className="hs-section-tag">How it works</div>
            <h2 className="hs-section-title">Built for both sides<br/>of the pass</h2>
            <p className="hs-section-sub">Whether you're a venue looking for your next great hire, or a hospitality professional ready for your next move.</p>
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
            <div className="hs-split-panel emp">
              <div className="hs-split-icon emp">🍽️</div>
              <div className="hs-split-eyebrow emp">For Employers</div>
              <h3 className="hs-split-title">Hire exceptional hospitality talent</h3>
              <p className="hs-split-desc">Post your role in minutes. Reach thousands of qualified candidates across Australia, New Zealand, and beyond.</p>
              <ul className="hs-feat-list">
                {['Instagram-style listings with photos & video reels','Applicants attach résumé and cover letter directly','Manage applications with status tracking','Browse and message candidates proactively','Verified venue profile with awards & analytics','Featured listings for maximum visibility','From just $50 AUD per listing'].map(f=><li key={f}>{f}</li>)}
              </ul>
              <Link to="/app" className="btn-emp">Post a Job — From $50 →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="hs-section" style={{background:'white',paddingTop:'72px',paddingBottom:'72px'}}>
        <div className="hs-section-inner">
          <div className="reveal">
            <div className="hs-section-tag">Browse by sector</div>
            <h2 className="hs-section-title">Every corner of hospitality</h2>
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
          <div className="reveal">
            <div className="hs-section-tag">What people are saying</div>
            <h2 className="hs-section-title">Trusted by the industry</h2>
            <p className="hs-section-sub">From 3-hat restaurants to boutique cafés, hospitality professionals across ANZ are using HospoSearch.</p>
          </div>
          <div className="hs-testi-grid reveal">
            {[
              {emoji:'🍽️',quote:'"We filled our Head Chef position within 4 days. The quality of applicants was outstanding — every single one had fine dining experience. Worth every cent."',name:'Sarah Mitchell',role:'Owner, Attica · Melbourne'},
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

      {/* Pricing */}
      <section className="hs-pricing" id="pricing">
        <div className="hs-pricing-inner">
          <div className="reveal">
            <div className="hs-section-tag" style={{color:'var(--terra)'}}>Simple pricing</div>
            <h2 className="hs-section-title" style={{color:'white',marginBottom:'14px'}}>No subscriptions.<br/>No hidden fees.</h2>
            <p style={{color:'rgba(255,255,255,0.55)',fontSize:'16px',marginBottom:'52px',maxWidth:'460px',lineHeight:'1.7'}}>Pay per listing. Job seekers are always free. GST included.</p>
          </div>
          <div className="hs-pricing-cards reveal">
            <div className="hs-price-card">
              <div className="hs-price-name">Standard Listing</div>
              <div className="hs-price-amount">$50</div>
              <div className="hs-price-period">AUD · one-time · GST incl.</div>
              <ul className="hs-price-feats">
                {['30-day listing visibility','Up to 5 photos + video reel','Unlimited applications','Application management dashboard','Verified venue profile','Discount codes accepted'].map(f=><li key={f}>{f}</li>)}
              </ul>
              <Link to="/app" className="btn-price">Post a Job</Link>
            </div>
            <div className="hs-price-card featured">
              <div className="hs-price-badge">⭐ Most Popular</div>
              <div className="hs-price-name">Featured Listing</div>
              <div className="hs-price-amount">$70</div>
              <div className="hs-price-period">AUD · one-time · GST incl.</div>
              <ul className="hs-price-feats">
                {['Everything in Standard','Pinned to top of feed','Featured badge & gold star','Priority in search results','7-day featured spotlight','3× more applications on average'].map(f=><li key={f}>{f}</li>)}
              </ul>
              <Link to="/app" className="btn-price">Post Featured</Link>
            </div>
          </div>
          <div className="hs-pricing-note reveal">Job seekers always browse and apply for free</div>
        </div>
      </section>

      {/* Locations */}
      <section className="hs-section" style={{background:'white'}} id="locations">
        <div className="hs-section-inner">
          <div className="reveal">
            <div className="hs-section-tag">Where we operate</div>
            <h2 className="hs-section-title">From Sydney to Singapore</h2>
            <p className="hs-section-sub" style={{marginBottom:'40px'}}>Find roles and candidates across Australia, New Zealand and major hospitality destinations worldwide.</p>
          </div>
          <div className="hs-locs-grid reveal">
            {[['🇦🇺','Sydney'],['🇦🇺','Melbourne'],['🇦🇺','Brisbane'],['🇦🇺','Perth'],['🇦🇺','Adelaide'],['🇦🇺','Gold Coast'],['🇳🇿','Auckland'],['🇳🇿','Wellington'],['🇳🇿','Queenstown'],['🇬🇧','London'],['🇦🇪','Dubai'],['🇸🇬','Singapore'],['🇯🇵','Tokyo'],['🇫🇷','Paris'],['🇮🇹','Rome'],['🇬🇷','Santorini'],['🇹🇭','Bangkok'],['🌏','+ 200 more']].map(([flag,city])=>(
              <Link to="/app" className="hs-loc" key={city}><span>{flag}</span>{city}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Feed Section */}
      <section className="hs-section" style={{background:'white',paddingTop:'80px',paddingBottom:'80px'}}>
        <div className="hs-section-inner">
          <div className="reveal" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:36,flexWrap:'wrap',gap:16}}>
            <div>
              <div className="hs-section-tag">Follow along</div>
              <h2 className="hs-section-title" style={{marginBottom:8}}>Behind the pass</h2>
              <p style={{color:'var(--ink-soft)',fontSize:15,lineHeight:1.6,maxWidth:480}}>
                Stories from the hospitality industry — venue spotlights, chef profiles, career tips and the jobs everyone's talking about.
              </p>
            </div>
            <a href="https://www.instagram.com/hosposearch" target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:9,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:100,padding:'10px 20px',textDecoration:'none',color:'var(--ink)',fontSize:13,fontWeight:600,flexShrink:0,transition:'all 0.2s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--terra-l)';e.currentTarget.style.borderColor='#E8CFBF';}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--cream)';e.currentTarget.style.borderColor='var(--border)';}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
              @hosposearch
            </a>
          </div>

          {/* Instagram-style card grid */}
          <div className="reveal" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
            {[
              { emoji:'👨‍🍳', color:'linear-gradient(145deg,#EDE0D0,#CEBBA0)', tag:'Chef Spotlight', title:'From Commis to Head Chef: Jordan Lim\'s story at Attica', desc:'Five years, three sections, and one phone call that changed everything. We sat down with Jordan to talk about the journey.', time:'2 days ago', likes:'847', comments:'43' },
              { emoji:'🌸', color:'linear-gradient(145deg,#D0E0D0,#AACCAA)', tag:'New Listing', title:'Tetsuya\'s is hiring a Sommelier — $70–85k + benefits', desc:'One of Sydney\'s most iconic restaurants is looking for a passionate sommelier to join their award-winning team.', time:'4 days ago', likes:'1.2k', comments:'91' },
              { emoji:'☕', color:'linear-gradient(145deg,#E8E0D4,#D4C8B8)', tag:'Career Tips', title:'How to nail a hospitality interview in 2025', desc:'The industry has changed. Here\'s what top venues are actually looking for — and how to walk in ready.', time:'1 week ago', likes:'2.1k', comments:'156' },
              { emoji:'🏨', color:'linear-gradient(145deg,#D8E4D8,#AACCAA)', tag:'Venue Spotlight', title:'Inside the Langham: what it\'s really like to work in a 5-star hotel', desc:'From concierge to kitchen — we went behind the scenes at one of Melbourne\'s most celebrated properties.', time:'1 week ago', likes:'934', comments:'67' },
              { emoji:'🍷', color:'linear-gradient(145deg,#E4D8CC,#C8A888)', tag:'Industry News', title:'Hospitality wages are rising in 2025 — here\'s what to know', desc:'New award rates, tipping culture, and what candidates should be negotiating for in their next role.', time:'2 weeks ago', likes:'3.4k', comments:'218' },
              { emoji:'🎯', color:'linear-gradient(145deg,#E0D4E8,#C8B8D4)', tag:'For Employers', title:'Why your job ad isn\'t getting applications (and how to fix it)', desc:'We analysed 500 listings. The ones that get 3× more applications all have one thing in common.', time:'2 weeks ago', likes:'1.8k', comments:'104' },
            ].map((post,i)=>(
              <a key={i} href="https://www.instagram.com/hosposearch" target="_blank" rel="noreferrer"
                className="reveal"
                style={{background:'var(--cream)',borderRadius:20,overflow:'hidden',border:'1px solid var(--border)',textDecoration:'none',color:'var(--ink)',display:'block',transition:'all 0.22s',cursor:'pointer'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,0.08)';e.currentTarget.style.borderColor='var(--terra)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='var(--border)';}}>
                {/* Card image */}
                <div style={{height:160,background:post.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,position:'relative'}}>
                  {post.emoji}
                  <div style={{position:'absolute',top:12,left:12,background:'rgba(255,255,255,0.9)',borderRadius:20,padding:'3px 10px',fontSize:10,fontWeight:700,color:'var(--terra)',letterSpacing:0.5,textTransform:'uppercase'}}>
                    {post.tag}
                  </div>
                </div>
                {/* Card body */}
                <div style={{padding:'16px 18px 18px'}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:'var(--ink)',lineHeight:1.3,marginBottom:8}}>
                    {post.title}
                  </div>
                  <div style={{fontSize:13,color:'var(--ink-soft)',lineHeight:1.6,marginBottom:14,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                    {post.desc}
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:11,color:'var(--ink-faint)'}}>{post.time}</span>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:11,color:'var(--ink-soft)',display:'flex',alignItems:'center',gap:3}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                        {post.likes}
                      </span>
                      <span style={{fontSize:11,color:'var(--ink-soft)',display:'flex',alignItems:'center',gap:3}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        {post.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="reveal" style={{textAlign:'center',marginTop:36}}>
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
        <p className="hs-final-sub">Join 18,000+ hospitality professionals who have already found their next opportunity on HospoSearch.</p>
        <div className="hs-final-actions">
          <Link to="/app" className="btn-white">🔍 Find Jobs — Free</Link>
          <Link to="/app" className="btn-ghost">Hiring? Post a job →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="hs-footer">
        <div className="hs-footer-inner">
          <div className="hs-footer-top">
            <div>
              <div className="hs-footer-logo"><span>Hospo</span>Search</div>
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
                <li><Link to="/app">Australia</Link></li>
                <li><Link to="/app">New Zealand</Link></li>
                <li><Link to="/app">United Kingdom</Link></li>
                <li><Link to="/app">Asia Pacific</Link></li>
                <li><Link to="/app">Middle East</Link></li>
              </ul>
            </div>
            <div>
              <div className="hs-footer-col-title">Company</div>
              <ul className="hs-footer-links">
                <li><a href="#">About</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="hs-footer-bottom">
            <span>© 2025 HospoSearch. All rights reserved.</span>
            <span>Made with ❤️ for the hospitality industry</span>
          </div>
        </div>
      </footer>
    </>
  )
}
