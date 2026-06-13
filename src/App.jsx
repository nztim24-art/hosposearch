import { useState, useRef, useEffect, useCallback } from "react";

// Desktop detection
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(()=>{
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
};

// ─── Stripe ───────────────────────────────────────────────────────────────────
const STRIPE_PK = "pk_test_51TYwmyGkG9EGtGJgeITW1dBzVae1mfXaac2ccNNjvk89D6s52Mgu4rdImGkCelAZd8UoVrWvf7MHe929Bzzmwokl00K7uBM1kw";

async function createCheckoutSession(tier, jobTitle, venueEmail, jobId) {
  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, jobTitle, venueEmail, jobId }),
  });
  if (!res.ok) throw new Error('Failed to create checkout session');
  const { url } = await res.json();
  return url;
}

async function createSubscriptionSession(plan, userEmail, userId) {
  const res = await fetch('/api/create-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, userEmail, userId }),
  });
  if (!res.ok) throw new Error('Failed to create subscription session');
  const { url } = await res.json();
  return url;
}
import { supabase, signIn, signUp as sbSignUp, signOut, getSession, fetchJobs, fetchMyJobs, createJob as sbCreateJob, updateJobFull as sbUpdateJobFull, incrementViews, fetchCodes, applyForJob as sbApplyForJob, updateApplicationStatus as sbUpdateAppStatus, uploadDocument, fetchPublicProfiles, updateProfile as sbUpdateProfile, fetchAlerts as sbFetchAlerts, createAlert as sbCreateAlert, deleteAlert as sbDeleteAlert, adminCreateJob as sbAdminCreateJob } from './supabase.js';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#FAFAF8", bgSoft:"#F4F0EB", border:"#EAE4DA", borderMid:"#D6CEBC",
  terracotta:"#C4623A", terracottaL:"#F5EDE7", terracottaM:"#E8CFBF",
  sage:"#6B8F71", sageL:"#EBF2EC", sageDark:"#4A6B50",
  sand:"#C9A96E", sandL:"#FDF6E8",
  clay:"#7A5C44", blue:"#3897F0", blueL:"#EBF4FE",
  textDark:"#1A1A1A", textMid:"#555", textSoft:"#888", textFaint:"#BBB",
  white:"#FFFFFF", error:"#E0392B",
  featured:"#F5A623", featuredL:"#FFF8EE",
};

const G = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @media(min-width:768px){
    .hs-app-root { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:240px 1fr; height:100vh; }
    .hs-sidebar { display:flex!important; flex-direction:column; border-right:1px solid var(--border,#E8E3DC); padding:24px 16px; height:100vh; position:sticky; top:0; overflow-y:auto; }
    .hs-main { overflow:hidden; display:flex; flex-direction:column; height:100vh; }
    .hs-bottom-nav { display:none!important; }
    .hs-feed-grid { display:grid!important; grid-template-columns:repeat(3,1fr); gap:1px; background:#E8E3DC; }
    .hs-feed-grid > * { background:#fff; }
    .hs-card-image { aspect-ratio:1!important; max-height:280px!important; }
  }
  @media(min-width:1100px){
    .hs-feed-grid { grid-template-columns:repeat(4,1fr)!important; }
    .hs-app-root { grid-template-columns:280px 1fr; }
  }
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { height:100%; overflow:hidden; }
  body { background:#fff; font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }
  input,textarea,select { outline:none; font-family:'DM Sans',sans-serif; }
  input::placeholder,textarea::placeholder { color:${C.textFaint}; }
  input:focus,textarea:focus,select:focus { border-color:${C.terracotta}!important; box-shadow:0 0 0 3px ${C.terracottaL}; }
  button { font-family:'DM Sans',sans-serif; cursor:pointer; }
  ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:2px; }
  .tap { transition:opacity 0.15s; } .tap:active { opacity:0.65; }
  .btn-cta { transition:all 0.18s; } .btn-cta:hover { filter:brightness(1.07); transform:translateY(-1px); } .btn-cta:active { transform:translateY(0); filter:brightness(0.96); }
  .file-zone:hover { border-color:${C.terracotta}!important; background:${C.terracottaL}!important; }
  .story-new  { background:conic-gradient(${C.terracotta} 0%,${C.sand} 55%,${C.terracotta} 100%); }
  .story-fol  { background:conic-gradient(${C.sage} 0%,#A8D4AE 55%,${C.sage} 100%); }
  .story-seen { background:#D0C8BC; }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn  { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
  .fade-up  { animation:fadeUp  0.2s ease forwards; }
  .scale-in { animation:scaleIn 0.2s ease forwards; }
  .chip { display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600; }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────
const EMPLOYERS = [];
const EMPLOYEES = [];
const ADMIN = { id:"admin", email:"admin@hosposearch.com.au", password:"hospo2024!", name:"HospoSearch Admin", handle:"admin", avatar:"🛡️" };

// Admin job actions run through a service-role API endpoint (bypasses RLS safely)
const ADMIN_SECRET = "LXqDinIuU7kZrPST5dhELfFGxqBboDsk";
async function adminJobAction(action, jobId, fields) {
  const res = await fetch("/api/admin-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: ADMIN_SECRET, action, jobId, fields }),
  });
  if (!res.ok) throw new Error(`admin-job ${action} failed: ${res.status}`);
  return res.json();
}
const PBG = ["linear-gradient(145deg,#EDE0D0,#CEBBA0)","linear-gradient(145deg,#D0E0D0,#AACCAA)","linear-gradient(145deg,#E0D4C8,#C0A888)","linear-gradient(145deg,#D8E4D8,#AACCAA)","linear-gradient(145deg,#E4D8CC,#C8A888)"];
const ROLE_TAGS = ["Chef Hat Venue","Fine Dining","Rooftop Bar","Resort","Group Venue","Michelin-Calibre","Hatted Restaurant","Waterfront","CBD","Regional","Award-Winning","Seasonal Menu"];
const SALARY_BANDS = ["Under $50k","$50–70k","$70–90k","$90–110k","$110k+","Hourly Rate"];

// ─── Visa options by country ─────────────────────────────────────────────────
const VISA_OPTIONS = {
  "Australia": [
    "I'm an Australian citizen",
    "I'm a permanent resident and/or NZ citizen",
    "I have a family/partner visa with no restrictions",
    "I have a graduate temporary work visa",
    "I have a holiday temporary work visa",
    "I have a temporary visa with restrictions on work location (e.g. 491)",
    "I have a temporary visa with no restrictions (e.g. doctoral student)",
    "I have a temporary visa with restrictions on work hours (e.g. student visa)",
    "I have a temporary visa with restrictions on industry (e.g. 408)",
    "I require sponsorship (e.g. 482, 457)",
  ],
  "New Zealand": [
    "I'm a New Zealand citizen",
    "I'm an Australian citizen or permanent resident",
    "I hold a Skilled Migrant resident visa",
    "I hold an Essential Skills work visa",
    "I hold a Working Holiday visa",
    "I hold a student visa (with work rights)",
    "I require sponsorship / Accredited Employer Work Visa",
  ],
  "United Kingdom": [
    "I'm a UK/Irish citizen",
    "I hold Indefinite Leave to Remain",
    "I hold a Skilled Worker visa",
    "I hold a Graduate visa",
    "I hold a Youth Mobility Scheme visa",
    "I require visa sponsorship",
  ],
  "default": [
    "I am legally authorised to work in this country",
    "I hold a valid work visa",
    "I require visa sponsorship",
    "Other — I will provide details",
  ],
};

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const NOTICE_PERIODS = ["I can start immediately","1 week","2 weeks","3 weeks","4 weeks","6 weeks","2 months","3 months or more"];

// ─── Location hierarchy ──────────────────────────────────────────────────────
const LOCATIONS = {
  // ── ANZ (primary markets) ────────────────────────────────────────────────
  "Australia": {
    "New South Wales":    ["Sydney","Newcastle","Wollongong","Coffs Harbour","Byron Bay","Orange","Dubbo","Tamworth"],
    "Victoria":           ["Melbourne","Geelong","Ballarat","Bendigo","Mornington Peninsula","Yarra Valley","Phillip Island","Torquay"],
    "Queensland":         ["Brisbane","Gold Coast","Sunshine Coast","Cairns","Townsville","Noosa","Whitsundays","Toowoomba"],
    "Western Australia":  ["Perth","Fremantle","Margaret River","Broome","Busselton","Albany","Esperance"],
    "South Australia":    ["Adelaide","Barossa Valley","McLaren Vale","Clare Valley","Kangaroo Island","Port Lincoln"],
    "Tasmania":           ["Hobart","Launceston","Devonport","Cradle Mountain","Freycinet"],
    "Northern Territory": ["Darwin","Alice Springs","Kakadu","Katherine"],
    "ACT":                ["Canberra"],
  },
  "New Zealand": {
    "Northland":          ["Whangārei","Paihia","Kerikeri","Dargaville","Kaitaia"],
    "Auckland":           ["Auckland CBD","North Shore","Waiheke Island","Manukau","Waitākere"],
    "Waikato":            ["Hamilton","Cambridge","Taupō","Matamata","Te Awamutu"],
    "Bay of Plenty":      ["Tauranga","Rotorua","Whakatāne","Mount Maunganui","Te Puke"],
    "Gisborne":           ["Gisborne","Tolaga Bay","Ruatoria"],
    "Hawke's Bay":        ["Napier","Hastings","Havelock North","Waipukurau"],
    "Taranaki":           ["New Plymouth","Stratford","Hāwera","Inglewood"],
    "Manawatū-Whanganui": ["Palmerston North","Whanganui","Levin","Feilding","Taumarunui"],
    "Wellington":         ["Wellington CBD","Lower Hutt","Upper Hutt","Porirua","Kapiti Coast","Wairarapa"],
    "Tasman":             ["Richmond","Motueka","Tākaka","Māpua"],
    "Nelson":             ["Nelson","Stoke","Tāhunanui"],
    "Marlborough":        ["Blenheim","Picton","Kaikōura","Renwick"],
    "West Coast":         ["Greymouth","Hokitika","Westport","Franz Josef"],
    "Canterbury":         ["Christchurch","Timaru","Ashburton","Rangiora","Akaroa"],
    "Otago":              ["Dunedin","Queenstown","Wānaka","Arrowtown","Alexandra","Cromwell","Oamaru"],
    "Southland":          ["Invercargill","Gore","Te Anau","Bluff","Stewart Island"],
  },
  // ── Rest of World ────────────────────────────────────────────────────────
  "United Kingdom": {
    "England":            ["London","Manchester","Birmingham","Bristol","Liverpool","Leeds","Brighton","Oxford","Cambridge","Bath","Exeter","York"],
    "Scotland":           ["Edinburgh","Glasgow","Aberdeen","Inverness","St Andrews","Dundee"],
    "Wales":              ["Cardiff","Swansea","Newport","Brecon","Tenby"],
    "Northern Ireland":   ["Belfast","Derry","Armagh"],
  },
  "United States": {
    "New York":           ["New York City","Buffalo","Albany","Saratoga Springs","The Hamptons"],
    "California":         ["Los Angeles","San Francisco","San Diego","Napa Valley","Sonoma","Santa Barbara","Monterey"],
    "Florida":            ["Miami","Orlando","Tampa","Key West","Fort Lauderdale","Naples"],
    "Texas":              ["Houston","Austin","Dallas","San Antonio","Fort Worth"],
    "Illinois":           ["Chicago","Springfield","Naperville"],
    "Nevada":             ["Las Vegas","Reno","Lake Tahoe"],
    "Hawaii":             ["Honolulu","Maui","Kauai","Big Island"],
    "Other":              ["Boston","Seattle","Portland","Denver","Nashville","New Orleans","Charleston"],
  },
  "Canada": {
    "Ontario":            ["Toronto","Ottawa","Niagara Falls","Hamilton","Kingston"],
    "British Columbia":   ["Vancouver","Victoria","Whistler","Kelowna","Tofino"],
    "Quebec":             ["Montreal","Quebec City","Tremblant","Gatineau"],
    "Alberta":            ["Calgary","Edmonton","Banff","Jasper","Canmore"],
    "Other":              ["Halifax","Winnipeg","Saskatoon","Regina"],
  },
  "Ireland": {
    "Leinster":           ["Dublin","Wicklow","Kilkenny","Wexford","Drogheda"],
    "Munster":            ["Cork","Limerick","Kerry","Waterford","Tipperary"],
    "Connacht":           ["Galway","Sligo","Mayo","Roscommon"],
    "Ulster":             ["Donegal","Cavan","Monaghan"],
  },
  "France": {
    "Île-de-France":      ["Paris","Versailles","Fontainebleau"],
    "Provence":           ["Marseille","Nice","Cannes","Aix-en-Provence","Saint-Tropez"],
    "Occitanie":          ["Toulouse","Montpellier","Nîmes"],
    "Nouvelle-Aquitaine": ["Bordeaux","Biarritz","Périgueux"],
    "Auvergne-Rhône-Alpes":["Lyon","Grenoble","Annecy","Chambéry"],
    "Other":              ["Strasbourg","Lille","Nantes","Rennes"],
  },
  "Italy": {
    "Lombardy":           ["Milan","Brescia","Bergamo","Como","Cremona"],
    "Tuscany":            ["Florence","Siena","Pisa","Lucca","Arezzo","Cortona"],
    "Lazio":              ["Rome","Tivoli","Ostia"],
    "Campania":           ["Naples","Amalfi Coast","Positano","Sorrento","Capri"],
    "Sicily":             ["Palermo","Catania","Taormina","Agrigento"],
    "Veneto":             ["Venice","Verona","Padua","Treviso"],
    "Other":              ["Bologna","Turin","Genoa","Bari","Trento"],
  },
  "Spain": {
    "Catalonia":          ["Barcelona","Girona","Tarragona","Sitges"],
    "Community of Madrid":["Madrid","Alcalá de Henares","Aranjuez"],
    "Andalusia":          ["Seville","Málaga","Granada","Córdoba","Marbella"],
    "Basque Country":     ["San Sebastián","Bilbao","Vitoria-Gasteiz"],
    "Balearic Islands":   ["Palma de Mallorca","Ibiza","Menorca"],
    "Other":              ["Valencia","Alicante","Zaragoza","Pamplona"],
  },
  "Japan": {
    "Kanto":              ["Tokyo","Yokohama","Kamakura","Nikko","Hakone"],
    "Kansai":             ["Osaka","Kyoto","Nara","Kobe","Hiroshima"],
    "Hokkaido":           ["Sapporo","Niseko","Hakodate","Asahikawa"],
    "Kyushu":             ["Fukuoka","Nagasaki","Kumamoto","Beppu","Kagoshima"],
    "Other":              ["Nagoya","Sendai","Kanazawa","Matsumoto"],
  },
  "Singapore": {
    "Central":            ["CBD","Marina Bay","Orchard","Tanjong Pagar","Chinatown"],
    "East":               ["Katong","East Coast","Changi","Tampines"],
    "West":               ["Jurong","Clementi","Holland Village","Dempsey Hill"],
    "North":              ["Woodlands","Yishun","Sembawang"],
  },
  "UAE": {
    "Dubai":              ["Downtown Dubai","Dubai Marina","Jumeirah","Palm Jumeirah","Business Bay","DIFC","JBR"],
    "Abu Dhabi":          ["Abu Dhabi City","Yas Island","Saadiyat Island","Al Ain"],
    "Sharjah":            ["Sharjah City","Al Majaz"],
    "Other Emirates":     ["Ras Al Khaimah","Fujairah","Ajman"],
  },
  "Germany": {
    "Bavaria":            ["Munich","Nuremberg","Augsburg","Regensburg","Garmisch-Partenkirchen"],
    "Berlin":             ["Berlin Mitte","Prenzlauer Berg","Kreuzberg","Charlottenburg"],
    "Hamburg":            ["Hamburg City","Blankenese","Altona"],
    "Other":              ["Frankfurt","Düsseldorf","Cologne","Stuttgart","Dresden","Leipzig"],
  },
  "Greece": {
    "Attica":             ["Athens","Piraeus","Glyfada"],
    "South Aegean":       ["Santorini","Mykonos","Rhodes","Kos","Paros","Naxos"],
    "Crete":              ["Heraklion","Chania","Rethymno","Agios Nikolaos"],
    "Ionian Islands":     ["Corfu","Kefalonia","Zakynthos","Lefkada"],
    "Other":              ["Thessaloniki","Halkidiki","Meteora","Delphi"],
  },
  "Thailand": {
    "Bangkok":            ["Bangkok CBD","Sukhumvit","Silom","Ari","Thonglor"],
    "Chiang Mai Province":["Chiang Mai","Chiang Rai","Pai"],
    "Phuket":             ["Phuket Town","Patong","Kata","Karon","Rawai"],
    "Koh Samui":          ["Chaweng","Bophut","Lamai","Mae Nam"],
    "Other":              ["Pattaya","Krabi","Koh Phangan","Hua Hin"],
  },
  "Maldives": {
    "North Malé Atoll":   ["Malé","Hulhumalé","Maafushi"],
    "South Malé Atoll":   ["Guraidhoo","Biyadhoo"],
    "Ari Atoll":          ["Rasdhoo","Mathiveri","Velidhoo"],
    "Other Atolls":       ["Baa Atoll","Lhaviyani Atoll","Noonu Atoll"],
  },
  "Other": {
    "Asia Pacific":       ["Bali","Hong Kong","Kuala Lumpur","Taipei","Seoul","Manila","Ho Chi Minh City","Hanoi"],
    "Middle East":        ["Beirut","Doha","Riyadh","Muscat","Kuwait City","Amman"],
    "Africa":             ["Cape Town","Johannesburg","Nairobi","Marrakech","Cairo","Mauritius"],
    "Americas":           ["Mexico City","Buenos Aires","São Paulo","Lima","Bogotá","Santiago","Cancún"],
    "Caribbean":          ["Barbados","Jamaica","St Lucia","Turks & Caicos","Cayman Islands","Antigua"],
    "Europe Other":       ["Amsterdam","Lisbon","Vienna","Prague","Copenhagen","Stockholm","Zürich","Brussels","Budapest","Warsaw"],
  },
};

// ─── Hospitality sectors ──────────────────────────────────────────────────────
const SECTORS = [
  "Restaurant","Bar & Nightclub","Hotel","Café","Catering","Events & Functions",
  "Resort","Club","Pub","Fine Dining","Fast Casual","Food Truck","Bakery","Winery / Brewery",
];

// ─── Job roles by department ──────────────────────────────────────────────────
const HOSPO_ROLES = {
  "Kitchen": [
    "Head Chef","Sous Chef","Chef de Partie","Commis Chef","Pastry Chef",
    "Pastry Sous Chef","Demi Chef","Kitchen Hand","Apprentice Chef","Executive Chef","Catering Chef",
  ],
  "Front of House": [
    "Restaurant Manager","Floor Manager","Maitre D'","Senior Waiter","Waiter / Wait Staff",
    "Sommelier","Bar Manager","Bartender","Barista","Host / Hostess","Runner / Food Runner","Functions Coordinator",
  ],
  "Management": [
    "General Manager","Operations Manager","Food & Beverage Manager","Venue Manager",
    "Events Manager","Catering Manager","Hotel Manager","Executive Assistant Manager",
  ],
  "Hotel & Accommodation": [
    "Concierge","Front Desk / Reception","Housekeeping","Room Service","Porter / Bellhop",
    "Night Auditor","Reservations Manager",
  ],
  "Other": [
    "Cellar Hand","Winemaker","Barback","Dishwasher","Delivery Driver","Marketing Coordinator","Purchasing Manager",
  ],
};
const ALL_ROLES = Object.values(HOSPO_ROLES).flat();

const INIT_JOBS = [];

const INIT_MESSAGES = {};

// ─── Sample notifications seed data ──────────────────────────────────────────
const INIT_NOTIFS = {
  "u1": [
    { id:"n2", type:"application", text:"Application viewed", sub:"Attica viewed your Head Chef application", ts:Date.now()-3600000*3, read:false, icon:"👁️" },
    { id:"n3", type:"listing", text:"New listing from Tetsuya's", sub:"Sous Chef · Sydney NSW · $80–95k", ts:Date.now()-3600000*8, read:true, icon:"🆕" },
  ],
  "u2": [
    { id:"n4", type:"listing", text:"New listing from Quay Restaurant", sub:"Floor Manager · Sydney NSW", ts:Date.now()-3600000*2, read:false, icon:"🆕" },
  ],
};

// ─── Discount codes ──────────────────────────────────────────────────────────
// Format: CODE -> { pct: discount %, uses: max uses, used: times used, desc, expires }
const INIT_CODES = {
  "HOSPO25":    { pct:25, uses:100, used:0,  desc:"25% off — early partner offer",    expires:"2026-12-31", active:true },
  "LAUNCH50":   { pct:50, uses:20,  used:3,  desc:"50% off — launch special",         expires:"2026-06-30", active:true },
  "FEATURED20": { pct:20, uses:50,  used:7,  desc:"20% off featured listing upgrade", expires:"2026-09-30", active:true },
  "FRIEND10":   { pct:10, uses:999, used:12, desc:"10% off — referral code",          expires:"2027-01-01", active:true },
};

// ─── Notification preferences ─────────────────────────────────────────────────
const DEFAULT_NOTIF_PREFS = {
  newListings:    true,
  matchingAlerts: true,
  appUpdates:     true,
  messages:       true,
  endorsements:   true,
  weeklyDigest:   false,
};

const ago = ts => { const d=Math.floor((Date.now()-ts)/1000); if(d<60) return `${d}s`; if(d<3600) return `${Math.floor(d/60)}m`; if(d<86400) return `${Math.floor(d/3600)}h`; return `${Math.floor(d/86400)}d`; };
const fmtSize = b => !b?"":b<1048576?`${(b/1024).toFixed(0)}KB`:`${(b/1048576).toFixed(1)}MB`;
const isData  = s => typeof s==="string" && (s.startsWith("data:") || s.startsWith("http"));

// Smart hierarchical search
// 1. Exact title match
// 2. Abbreviation/alias match (cdp = chef de partie, etc)
// 3. Title contains query
// 4. Related roles (same department/category)
const ROLE_ALIASES = {
  "cdp": "chef de partie",
  "chef de partie": "chef de partie",
  "sous": "sous chef",
  "exec chef": "executive chef",
  "exec sous": "executive sous chef",
  "head chef": "head chef",
  "hc": "head chef",
  "foh": "front of house",
  "boh": "back of house",
  "gm": "general manager",
  "f&b": "food & beverage manager",
  "fnb": "food & beverage manager",
  "bm": "bar manager",
  "rm": "restaurant manager",
  "fm": "floor manager",
  "sm": "sommelier",
  "pp": "pastry chef",
  "kh": "kitchen hand",
};

const ROLE_GROUPS = {
  "chef": ["head chef","sous chef","executive chef","chef de partie","commis chef","pastry chef","demi chef","kitchen hand","apprentice chef","executive sous chef","catering chef","pastry sous chef"],
  "front of house": ["restaurant manager","floor manager","maitre d'","senior waiter","waiter / wait staff","host / hostess","runner / food runner","sommelier","functions coordinator"],
  "bar": ["bar manager","bartender","barista","barback"],
  "management": ["general manager","operations manager","food & beverage manager","venue manager","events manager","catering manager","hotel manager"],
  "pastry": ["pastry chef","pastry sous chef","demi chef"],
  "sommelier": ["sommelier"],
  "hotel": ["night auditor","reservations manager","concierge","housekeeping"],
};

function smartSearch(jobs, query) {
  if (!query || !query.trim()) return jobs;
  const q = query.trim().toLowerCase();
  
  // Resolve alias
  const resolved = ROLE_ALIASES[q] || q;
  
  // Score each job
  const scored = jobs.map(j => {
    const title = (j.title||"").toLowerCase();
    const venue = (j.venue||"").toLowerCase();
    const sector = (j.sector||"").toLowerCase();
    const roleType = (j.roleType||"").toLowerCase();
    const tags = (j.tags||[]).map(t=>t.toLowerCase()).join(" ");
    const short = (j.short||"").toLowerCase();
    const loc = (j.loc||"").toLowerCase();
    
    let score = 0;
    
    // Tier 1: exact title match (100)
    if (title === resolved) score = 100;
    // Tier 2: title starts with query (90)
    else if (title.startsWith(resolved)) score = 90;
    // Tier 3: title contains exact resolved query (80)
    else if (title.includes(resolved)) score = 80;
    // Tier 4: title contains original query (70)
    else if (title.includes(q)) score = 70;
    // Tier 5: related role group (50)
    else {
      for (const [group, roles] of Object.entries(ROLE_GROUPS)) {
        if (q.includes(group) || group.includes(q)) {
          if (roles.some(r => title.includes(r) || r.includes(title))) {
            score = 50;
            break;
          }
        }
        // If query matches a role in a group, show all roles in that group
        if (roles.some(r => r.includes(q) || q.includes(r.split(" ")[0]))) {
          if (roles.some(r => title.includes(r.split(" ")[0]))) {
            score = 40;
            break;
          }
        }
      }
    }
    // Bonus: venue or location match
    if (score === 0 && (venue.includes(q) || loc.includes(q))) score = 30;
    // Bonus: sector or tags match  
    if (score === 0 && (sector.includes(q) || tags.includes(q) || roleType.includes(q))) score = 20;
    // Bonus: description match
    if (score === 0 && short.includes(q)) score = 10;
    
    return { job: j, score };
  }).filter(x => x.score > 0);
  
  // Sort by score desc, then by featured, then by date
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.job.featured !== a.job.featured) return b.job.featured ? 1 : -1;
    return b.job.ts - a.job.ts;
  });
  
  return scored.map(x => x.job);
}
const isVid   = s => typeof s==="string" && s.startsWith("data:video");

// ─── Icons ────────────────────────────────────────────────────────────────────
// ─── HTML sanitizer ───────────────────────────────────────────────────────────
// Strips scripts, event handlers, and unsafe tags from user-submitted rich text
// before rendering via dangerouslySetInnerHTML. Allows only safe formatting tags.
// Render a job description that may be plain text (with newlines) OR html.
// If it has no HTML tags, convert blank-line paragraph breaks and single
// newlines into proper spacing so it doesn't collapse into one block.
function descToHtml(text) {
  if (!text || typeof text !== "string") return "";
  const hasTags = /<(p|br|div|ul|ol|li|strong|b|em|i)\b/i.test(text);
  if (hasTags) return sanitizeHtml(text);
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br>")}</p>`).join("");
}

// Strip HTML tags to plain text — for card teasers where tags shouldn't show
function stripTags(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  try {
    const allowed = ["B","STRONG","I","EM","U","UL","OL","LI","BR","P","DIV","SPAN"];
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const walk = (node) => {
      const kids = Array.from(node.childNodes);
      for (const child of kids) {
        if (child.nodeType === 1) { // element
          if (!allowed.includes(child.tagName)) {
            // Replace disallowed element with its text content
            child.replaceWith(document.createTextNode(child.textContent || ""));
            continue;
          }
          // Strip ALL attributes (removes onerror, onclick, style hacks, href javascript:, etc.)
          for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
          walk(child);
        } else if (child.nodeType === 8) { // comment
          child.remove();
        }
      }
    };
    const container = doc.body.firstChild;
    walk(container);
    return container.innerHTML;
  } catch (e) {
    // On any failure, fall back to plain text (strip all tags)
    return html.replace(/<[^>]*>/g, "");
  }
}

const Icon = ({ name, size=24, color="currentColor", fill="none" }) => {
  const p = {
    home:     <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    search:   <><circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.6"/><path d="M16.5 16.5L21 21" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></>,
    plus:     <><rect x="3" y="3" width="18" height="18" rx="4" stroke={color} strokeWidth="1.6"/><path d="M12 8v8M8 12h8" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></>,
    person:   <><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.6"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></>,
    bookmark: <><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    more:     <><circle cx="5" cy="12" r="1.2" fill={color}/><circle cx="12" cy="12" r="1.2" fill={color}/><circle cx="19" cy="12" r="1.2" fill={color}/></>,
    back:     <><path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></>,
    check:    <><path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    close:    <><path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    logout:   <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    grid:     <><rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5"/></>,
    video:    <><polygon points="23,7 16,12 23,17" stroke={color} strokeWidth="1.6" fill={fill}/><rect x="1" y="5" width="15" height="14" rx="2" stroke={color} strokeWidth="1.6"/></>,
    camera:   <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth="1.6"/><circle cx="12" cy="13" r="4" stroke={color} strokeWidth="1.6"/></>,
    chat:     <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    bell:     <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.6"/></>,
    star:     <><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="1.6"/><circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6"/></>,
    send:     <><line x1="22" y1="2" x2="11" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><polygon points="22,2 15,22 11,13 2,9" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    award:    <><circle cx="12" cy="8" r="6" stroke={color} strokeWidth="1.6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" stroke={color} strokeWidth="1.6"/></>,
    briefcase:<><rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth="1.6"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke={color} strokeWidth="1.6"/></>,
    filter:   <><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" stroke={color} strokeWidth="1.6"/></>,
    trending: <><polyline points="23,6 13.5,15.5 8.5,10.5 1,18" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17,6 23,6 23,12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>,
    users:    <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.6"/><circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.6"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.6"/></>,
    quote:    <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" stroke={color} strokeWidth="1.6"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" stroke={color} strokeWidth="1.6"/></>,
    shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    zap:      <><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke={color} strokeWidth="1.6" fill={fill}/></>,
    image:    <><rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.6"/><circle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="1.4"/><polyline points="21,15 16,10 5,21" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/></>,
    link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></>,
    thumbsup: <><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" stroke={color} strokeWidth="1.6" fill={fill}/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" stroke={color} strokeWidth="1.6"/></>,
    sliders:  <><line x1="4" y1="21" x2="4" y2="14" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="4" y1="10" x2="4" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="12" y1="21" x2="12" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="12" y1="8" x2="12" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="20" y1="21" x2="20" y2="16" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="20" y1="12" x2="20" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="1" y1="14" x2="7" y2="14" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="9" y1="8" x2="15" y2="8" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><line x1="17" y1="16" x2="23" y2="16" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></>,
    edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>,
    clock:    <><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6"/><path d="M12 7v5l3 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">{p[name]||null}</svg>;
};

// ─── Helpers / Shared UI ──────────────────────────────────────────────────────
// ─── ImageCropper ─────────────────────────────────────────────────────────────
// Instagram-style crop modal: drag to reposition, wheel/pinch to zoom,
// toggle 4:5 / 1:1. Outputs a cropped JPEG data URL via canvas.
function ImageCropper({ src, onConfirm, onCancel }) {
  const [ratio, setRatio] = useState("4/5"); // "4/5" or "1/1"
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x:0, y:0 });
  const [imgDim, setImgDim] = useState({ w:0, h:0 });
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const ratioVal = ratio === "1/1" ? 1 : 4/5; // width/height

  useEffect(() => {
    const im = new Image();
    im.onload = () => setImgDim({ w:im.naturalWidth, h:im.naturalHeight });
    im.src = src;
  }, [src]);

  // Frame dimensions (fit within modal)
  const frameW = 300;
  const frameH = frameW / ratioVal;

  // Base scale so image covers the frame at zoom=1
  const baseScale = imgDim.w && imgDim.h
    ? Math.max(frameW / imgDim.w, frameH / imgDim.h)
    : 1;
  const dispW = imgDim.w * baseScale * zoom;
  const dispH = imgDim.h * baseScale * zoom;

  // Clamp position so image always covers the frame
  const clamp = (p) => {
    const maxX = Math.max(0, (dispW - frameW) / 2);
    const maxY = Math.max(0, (dispH - frameH) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  };

  useEffect(() => { setPos(p => clamp(p)); /* re-clamp on zoom/ratio change */ // eslint-disable-next-line
  }, [zoom, ratio, imgDim.w, imgDim.h]);

  const onPointerDown = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx,dy), zoom };
    } else {
      dragRef.current = { x: pt.clientX - pos.x, y: pt.clientY - pos.y };
    }
  };
  const onPointerMove = (e) => {
    if (e.touches && e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx,dy);
      const next = Math.max(1, Math.min(4, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
      setZoom(next);
      return;
    }
    if (!dragRef.current) return;
    const pt = e.touches ? e.touches[0] : e;
    setPos(clamp({ x: pt.clientX - dragRef.current.x, y: pt.clientY - dragRef.current.y }));
  };
  const onPointerUp = () => { dragRef.current = null; pinchRef.current = null; };
  const onWheel = (e) => { e.preventDefault(); setZoom(z => Math.max(1, Math.min(4, z - e.deltaY*0.0015))); };

  const confirm = () => {
    // Render the visible frame to a canvas at good resolution
    const out = ratio === "1/1" ? 1080 : 0.8; // square 1080, portrait scale
    const canvasW = 1080;
    const canvasH = ratio === "1/1" ? 1080 : Math.round(1080 / ratioVal);
    const canvas = document.createElement("canvas");
    canvas.width = canvasW; canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    const im = new Image();
    im.onload = () => {
      // Map frame-space to canvas-space
      const scaleToCanvas = canvasW / frameW;
      const drawW = dispW * scaleToCanvas;
      const drawH = dispH * scaleToCanvas;
      const cx = (canvasW - drawW)/2 + pos.x * scaleToCanvas;
      const cy = (canvasH - drawH)/2 + pos.y * scaleToCanvas;
      ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvasW,canvasH);
      ctx.drawImage(im, cx, cy, drawW, drawH);
      onConfirm(canvas.toDataURL("image/jpeg", 0.9));
    };
    im.src = src;
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:10000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
      {/* Ratio toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["4/5","Portrait 4:5"],["1/1","Square 1:1"]].map(([r,l])=>(
          <button key={r} className="tap" onClick={()=>setRatio(r)}
            style={{ background:ratio===r?C.terracotta:"rgba(255,255,255,0.12)", border:"none", borderRadius:20, padding:"7px 16px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {/* Crop frame */}
      <div ref={frameRef}
        onMouseDown={onPointerDown} onMouseMove={e=>dragRef.current&&onPointerMove(e)} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
        onWheel={onWheel}
        style={{ position:"relative", width:frameW, height:frameH, overflow:"hidden", borderRadius:6, background:"#000", cursor:"grab", touchAction:"none", boxShadow:"0 0 0 1px rgba(255,255,255,0.2)" }}>
        {imgDim.w>0 && (
          <img src={src} alt="" draggable={false}
            style={{ position:"absolute", left:"50%", top:"50%", width:dispW, height:dispH, transform:`translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, maxWidth:"none", userSelect:"none", pointerEvents:"none" }}/>
        )}
        {/* Grid overlay */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)", backgroundSize:`${frameW/3}px ${frameH/3}px` }}/>
      </div>

      {/* Zoom slider */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:16, width:frameW }}>
        <Icon name="search" size={14} color="rgba(255,255,255,0.6)"/>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} style={{ flex:1, accentColor:C.terracotta }}/>
      </div>
      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginTop:8 }}>Drag to reposition · scroll or pinch to zoom</div>

      {/* Actions */}
      <div style={{ display:"flex", gap:10, marginTop:20, width:frameW }}>
        <button className="tap" onClick={onCancel} style={{ flex:1, background:"rgba(255,255,255,0.12)", border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer" }}>Cancel</button>
        <button className="tap" onClick={confirm} style={{ flex:2, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>Use photo</button>
      </div>
    </div>
  );
}

// ─── CardImage ────────────────────────────────────────────────────────────────
// Clean Instagram-style fill: image covers the fixed-ratio box edge-to-edge.
// Photos are pre-cropped at upload via ImageCropper, so cover is always accurate.
function BlurFillImage({ src, alt="", ratio="4/5", radius=0 }) {
  return (
    <div style={{ position:"relative", width:"100%", aspectRatio:ratio, overflow:"hidden", borderRadius:radius, background:C.bgSoft }}>
      <img src={src} alt={alt} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
    </div>
  );
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────
// Safe contentEditable: sets initial HTML once via ref, never re-injects on render
// (which would crash React), and sanitises pasted content to plain text + line breaks.
function RichTextEditor({ value, onChange, placeholder, minHeight=120, fontSize=14 }) {
  const ref = useRef(null);

  // Set initial content ONCE on mount — never on subsequent renders
  useEffect(() => {
    if (ref.current && value && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd) => { document.execCommand(cmd, false, null); ref.current?.focus(); pushChange(); };
  const pushChange = () => { if (ref.current) onChange(ref.current.innerHTML); };

  // Strip formatting/styles from pasted content — insert as plain text with line breaks
  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    // Insert plain text, preserving line breaks
    const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    document.execCommand('insertHTML', false, safe);
    pushChange();
  };

  const btns = [
    { label:"B", cmd:"bold", style:{ fontWeight:700 }, title:"Bold" },
    { label:"I", cmd:"italic", style:{ fontStyle:"italic" }, title:"Italic" },
    { label:"U", cmd:"underline", style:{ textDecoration:"underline" }, title:"Underline" },
    { label:"• List", cmd:"insertUnorderedList", style:{}, title:"Bullet list" },
    { label:"1. List", cmd:"insertOrderedList", style:{}, title:"Numbered list" },
  ];

  return (
    <div style={{ border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", background:C.bgSoft }}>
      <div style={{ display:"flex", gap:4, padding:"6px 8px", background:C.bgSoft, borderBottom:`1px solid ${C.border}`, flexWrap:"wrap", position:"sticky", top:0, zIndex:2 }}>
        {btns.map(b=>(
          <button key={b.cmd} type="button" title={b.title} onMouseDown={e=>{ e.preventDefault(); exec(b.cmd); }}
            style={{ ...b.style, background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 9px", fontSize:12, color:C.textDark, cursor:"pointer", lineHeight:1.4 }}>
            {b.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={pushChange}
        onBlur={pushChange}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{ width:"100%", minHeight, maxHeight:260, overflowY:"auto", background:C.bgSoft, border:"none", padding:"12px 13px", color:C.textDark, fontSize, lineHeight:1.6, outline:"none", boxSizing:"border-box", WebkitOverflowScrolling:"touch" }}
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:${C.textFaint};pointer-events:none}[contenteditable] ul{margin:4px 0 4px 18px;padding:0}[contenteditable] ol{margin:4px 0 4px 18px;padding:0}[contenteditable] li{margin-bottom:2px}`}</style>
    </div>
  );
}

function Avatar({ emp, size=36, fontSize=18 }) {
  const imgUrl = emp?.avatar_url;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize, flexShrink:0, overflow:"hidden", border:`1px solid ${C.border}` }}>
      {imgUrl
        ? <img src={imgUrl} alt="" onError={e=>{e.target.style.display='none';}} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        : (emp?.avatar||"👤")
      }
    </div>
  );
}

// Top-right logged-in avatar with a dropdown: Open dashboard + Sign out
function AvatarMenu({ user, onDashboard, onLogout, badge=false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const imgUrl = user?.avatar_url;
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button className="tap" onClick={()=>setOpen(o=>!o)} style={{ position:"relative", width:32, height:32, borderRadius:10, background:imgUrl?"#fff":`linear-gradient(135deg,${C.terracotta},${C.sand})`, border:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, overflow:"hidden", cursor:"pointer", padding:0 }}>
        {imgUrl
          ? <img src={imgUrl} alt="" onError={e=>{e.target.style.display='none';}} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          : (user?.avatar||"\u{1F464}")}
        {badge && <div style={{ position:"absolute", top:-2, right:-2, width:9, height:9, borderRadius:"50%", background:C.sage, border:"2px solid #fff" }}/>}
      </button>
      {open && (
        <div style={{ position:"absolute", top:40, right:0, background:"#fff", border:`1px solid ${C.border}`, borderRadius:12, boxShadow:"0 8px 28px rgba(20,14,10,0.16)", minWidth:190, zIndex:5000, overflow:"hidden" }}>
          <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.textDark, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user?.name||"Account"}</div>
            {user?.email && <div style={{ color:C.textFaint, fontSize:11, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.email}</div>}
          </div>
          <button className="tap" onClick={()=>{ setOpen(false); onDashboard&&onDashboard(); }} style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:9, background:"none", border:"none", padding:"11px 14px", color:C.textDark, fontSize:13, fontWeight:500, cursor:"pointer" }}>
            <Icon name="person" size={16} color={C.textMid}/> Open dashboard
          </button>
          <button className="tap" onClick={()=>{ setOpen(false); onLogout&&onLogout(); }} style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:9, background:"none", border:"none", borderTop:`1px solid ${C.border}`, padding:"11px 14px", color:C.error, fontSize:13, fontWeight:500, cursor:"pointer" }}>
            <Icon name="logout" size={16} color={C.error}/> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, color, bg, border }) {
  return <span className="chip" style={{ color, background:bg||`${color}15`, border:`1px solid ${border||color+"30"}` }}>{label}</span>;
}

function TypeChip({ type }) {
  const map = { "Full-time":[C.sage,C.sageL], "Part-time":[C.sand,C.sandL], "Casual":[C.terracotta,C.terracottaL], "Contract":[C.clay,"#F0E8E0"] };
  const [col, bg] = map[type]||[C.textSoft,C.bgSoft];
  return <Chip label={type} color={col} bg={bg}/>;
}

function FileZone({ label, icon, file, onFile, onRemove }) {
  const ref = useRef();
  return (
    <div>
      <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:6, fontWeight:600 }}>{label}</div>
      {!file ? (
        <div className="file-zone tap" onClick={()=>ref.current.click()} style={{ border:`1.5px dashed ${C.borderMid}`, borderRadius:11, padding:"14px", textAlign:"center", cursor:"pointer", background:C.bgSoft, transition:"all 0.18s" }}>
          <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
          <div style={{ color:C.textMid, fontSize:13, fontWeight:500 }}>Upload {label}</div>
          <div style={{ color:C.textFaint, fontSize:11, marginTop:1 }}>PDF, DOC or DOCX</div>
          <input ref={ref} type="file" accept=".pdf,.doc,.docx" onChange={e=>{
            const f = e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => onFile({ name:f.name, size:f.size, uploadedAt:Date.now(), data:ev.target.result });
            reader.readAsDataURL(f);
          }} style={{ display:"none" }}/>
        </div>
      ) : (
        <div style={{ border:`1.5px solid ${C.sage}`, borderRadius:11, padding:"11px 13px", background:C.sageL, display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:C.sage, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📄</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:C.textDark, fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</div>
            <div style={{ color:C.textSoft, fontSize:11, marginTop:1 }}>{fmtSize(file.size)}{file.fromProfile?" · From profile":""}</div>
          </div>
          <button className="tap" onClick={()=>{ if(window.confirm(`Are you sure you want to delete your ${label}? This can't be undone.`)) onRemove(); }} style={{ background:"none", border:"none", color:C.textSoft, fontSize:18, lineHeight:1 }}>×</button>
        </div>
      )}
    </div>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────
// ─── Employer lookup helper ───────────────────────────────────────────────────
function getEmp(job) {
  if (!job) return null;
  const found = EMPLOYERS.find(e => e.id === job.empId);
  if (found) return { ...found, avatar_url: job.avatar_url || found.avatar_url };
  const venueName = job.venue || 'HospoSearch';
  return {
    id:       job.empId || 'admin',
    name:     venueName,
    handle:   venueName.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),
    avatar:   '🍽️',
    avatar_url: job.avatar_url || null,
    verified: job.verified || false,
    bio:      job.loc || '',
    cuisine:  job.sector || '',
    size:     '',
    awards:   [],
    isTrial:  false,
    email:    '',
    password: '',
    subscription_tier:   null,
    subscription_active: false,
    subscription_limit:  0,
  };
}

function Carousel({ photos, video, height=null }) {
  const [cur, setCur] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sliding, setSliding] = useState(false);
  const containerRef = useRef(null);

  // All mutable state in refs so handlers are stable — avoids stale closure
  // bug that broke swipe on Pixel (listeners detaching on every slide change)
  const state = useRef({ cur:0, startX:null, startY:null, dragging:false, width:300 });

  const slides = video
    ? [{ t:"video", src:video }, ...photos.map(s=>({ t:"photo", src:s }))]
    : photos.map(s=>({ t:"photo", src:s }));

  const goTo = useCallback((next) => {
    next = Math.max(0, Math.min(next, slides.length - 1));
    state.current.cur = next;
    setSliding(true);
    setOffset(0);
    setCur(next);
    setTimeout(() => setSliding(false), 450);
  }, [slides.length]);

  // Stable handler refs — never recreated, so removeEventListener always finds them
  const handleStart = useCallback((e) => {
    const t = e.touches[0];
    state.current.startX = t.clientX;
    state.current.startY = t.clientY;
    state.current.dragging = false;
    state.current.width = containerRef.current?.offsetWidth || 300;
    setOffset(0);
  }, []);

  const handleMove = useCallback((e) => {
    const s = state.current;
    if (s.startX === null) return;
    const dx = e.touches[0].clientX - s.startX;
    const dy = e.touches[0].clientY - s.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!s.dragging && absDy > absDx && absDy > 8) {
      s.startX = null; // vertical — let page scroll
      return;
    }
    if (absDx > 8) s.dragging = true;
    if (!s.dragging) return;

    e.preventDefault(); // block page scroll for horizontal swipe

    const atStart = s.cur === 0 && dx > 0;
    const atEnd   = s.cur === slides.length - 1 && dx < 0;
    setOffset(dx * (atStart || atEnd ? 0.2 : 1));
  }, [slides.length]);

  const handleEnd = useCallback((e) => {
    const s = state.current;
    if (s.startX === null) return;
    const dx = e.changedTouches[0].clientX - s.startX;
    const threshold = s.width * 0.25;
    if      (dx < -threshold && s.cur < slides.length - 1) goTo(s.cur + 1);
    else if (dx >  threshold && s.cur > 0)                 goTo(s.cur - 1);
    else { setSliding(true); setOffset(0); setTimeout(() => setSliding(false), 400); }
    s.startX = null;
    s.dragging = false;
  }, [slides.length, goTo]);

  // Attach once on mount — stable refs mean no need to re-attach
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchmove',  handleMove,  { passive: false }); // passive:false required for preventDefault
    el.addEventListener('touchend',   handleEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove',  handleMove);
      el.removeEventListener('touchend',   handleEnd);
    };
  }, []); // empty deps — stable refs, mount once only

  const containerStyle = height
    ? { position:"relative", width:"100%", height, overflow:"hidden" }
    : { position:"relative", width:"100%", aspectRatio:"4/5", overflow:"hidden" };

  return (
    <div ref={containerRef} style={containerStyle}>

      {slides.map((slide, i) => {
        const pbg = PBG[typeof slide.src==="number" ? slide.src%PBG.length : i%PBG.length];
        const diff = i - cur;
        const tx = `calc(${diff * 100}% + ${offset}px)`;
        const isVisible = Math.abs(diff) <= 1;
        return (
          <div key={i} style={{
            position:"absolute", inset:0,
            transform: `translateX(${tx})`,
            transition: sliding ? "transform 0.45s cubic-bezier(0.32,0.72,0,1)" : "none",
            willChange:"transform",
            display: isVisible ? "block" : "none",
            background: pbg,
          }}>
            {slide.t==="video" ? (
              <div style={{ position:"relative", width:"100%", height:"100%" }}>
                <video src={slide.src} autoPlay muted loop playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                <div style={{ position:"absolute", top:10, left:12, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)", borderRadius:20, padding:"3px 9px", display:"flex", alignItems:"center", gap:5 }}>
                  <Icon name="video" size={11} color="#fff" fill="#fff"/><span style={{ color:"#fff", fontSize:11, fontWeight:600 }}>Reel</span>
                </div>
              </div>
            ) : slide.src && isData(slide.src) ? (
              <img src={slide.src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
            ) : (
              <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, background:pbg }}>
                <Icon name="camera" size={38} color="rgba(120,95,75,0.2)"/>
                <span style={{ fontFamily:"'Fraunces',serif", fontSize:11, color:"rgba(100,80,60,0.3)", letterSpacing:3, textTransform:"uppercase" }}>Photo {i+1}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Photo counter — top right, Instagram style */}
      {slides.length > 1 && (
        <div style={{
          position:"absolute", top:10, right:12, zIndex:10,
          background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)",
          borderRadius:20, padding:"3px 10px",
          color:"#fff", fontSize:12, fontWeight:600, letterSpacing:0.3,
          pointerEvents:"none",
        }}>
          {cur + 1}/{slides.length}
        </div>
      )}

      {/* Dot indicators — bottom centre */}
      {slides.length > 1 && (
        <div style={{ position:"absolute", bottom:10, left:0, right:0, display:"flex", justifyContent:"center", gap:5, pointerEvents:"none" }}>
          {slides.map((_,i) => (
            <div key={i} style={{ width: i===cur ? 16 : 6, height:6, borderRadius:3, background: i===cur ? "#fff" : "rgba(255,255,255,0.45)", transition:"width 0.3s, background 0.3s" }}/>
          ))}
        </div>
      )}
      {/* Arrow buttons — desktop + mobile tap targets */}
      {slides.length > 1 && cur > 0 && (
        <button onClick={e=>{e.stopPropagation();goTo(cur-1);}} className="tap"
          style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", background:"linear-gradient(135deg,rgba(40,30,20,0.65),rgba(20,15,10,0.45))", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:"50%", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:3, boxShadow:"0 2px 8px rgba(0,0,0,0.35)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
      {slides.length > 1 && cur < slides.length - 1 && (
        <button onClick={e=>{e.stopPropagation();goTo(cur+1);}} className="tap"
          style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"linear-gradient(135deg,rgba(40,30,20,0.65),rgba(20,15,10,0.45))", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:"50%", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:3, boxShadow:"0 2px 8px rgba(0,0,0,0.35)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
    </div>
  );
}

// ─── Story Viewer ─────────────────────────────────────────────────────────────
// stories: array of { job, emp } — supports swipe left/right and tap zones
function StoryViewer({ stories, startIndex=0, currentUser, onClose, onApply }) {
  const [idx, setIdx] = useState(startIndex);
  const [prog, setProg] = useState(0);
  const [sliding, setSliding] = useState(null); // 'left' | 'right' | null
  const timerRef = useRef();
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const current = stories[idx] || stories[0];
  const { job, emp } = current;
  const total = stories.length;

  const goTo = (newIdx) => {
    if (newIdx < 0) { onClose(); return; }
    if (newIdx >= total) { onClose(); return; }
    setSliding(newIdx > idx ? 'left' : 'right');
    setTimeout(() => { setIdx(newIdx); setProg(0); setSliding(null); }, 160);
  };

  const next = () => goTo(idx + 1);
  const prev = () => goTo(idx - 1);

  // Restart timer whenever idx changes
  useEffect(() => {
    clearInterval(timerRef.current);
    setProg(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min(((Date.now()-start)/7000)*100, 100);
      setProg(p);
      if (p >= 100) { clearInterval(timerRef.current); next(); }
    }, 40);
    return () => clearInterval(timerRef.current);
  }, [idx]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dy > 60) { touchStartX.current = null; return; } // vertical scroll — ignore
    if (Math.abs(dx) > 44) {
      dx > 0 ? next() : prev();
    }
    touchStartX.current = null;
  };

  // Tap left third → prev, tap right third → next (like Instagram)
  const onTap = (e) => {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.33) prev();
    else if (x > w * 0.66) next();
  };

  const applied = job.apps?.some(a=>a.uid===currentUser?.id);
  const first = job.video||job.photos[0];

  return (
    <div className="scale-in" style={{ position:"fixed", inset:0, background:"#000", zIndex:9000, display:"flex", flexDirection:"column",
      opacity: sliding ? 0.5 : 1, transform: sliding==='left'?'translateX(-8px)':sliding==='right'?'translateX(8px)':'none',
      transition: sliding ? 'opacity 0.15s, transform 0.15s' : 'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{G}</style>

      {/* Progress bars — one per story */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:2, padding:"10px 10px 0", display:"flex", gap:3 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex:1, height:2.5, background:"rgba(255,255,255,0.3)", borderRadius:2, overflow:"hidden" }}>
            <div style={{
              height:"100%", borderRadius:2, background:"#fff",
              width: i < idx ? "100%" : i === idx ? `${prog}%` : "0%",
              transition: i === idx ? "width 0.04s linear" : "none"
            }}/>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position:"absolute", top:18, left:0, right:0, zIndex:2, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <Avatar emp={emp} size={34} fontSize={17}/>
        <div style={{ flex:1 }}>
          <div style={{ color:"#fff", fontWeight:600, fontSize:14, textShadow:"0 1px 3px rgba(0,0,0,0.5)" }}>
            {emp.name} <span style={{ fontWeight:400, fontSize:12, opacity:0.7 }}>· {ago(job.ts)}</span>
          </div>
          <div style={{ color:"rgba(255,255,255,0.65)", fontSize:11 }}>
            {idx+1} / {total} · New listing
          </div>
        </div>
        <button onClick={onClose} className="tap" style={{ background:"none", border:"none", color:"#fff", padding:4 }}>
          <Icon name="close" size={22} color="#fff"/>
        </button>
      </div>

      {/* Media — tappable for prev/next */}
      <div style={{ flex:1, position:"relative" }} onClick={onTap}>
        {job.video&&isVid(job.video)
          ? <video src={job.video} autoPlay muted loop playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          : first&&isData(first)&&!isVid(first)
            ? <img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            : <div style={{ width:"100%", height:"100%", background:PBG[idx%PBG.length], display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name="camera" size={48} color="rgba(100,80,60,0.25)"/>
              </div>
        }
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"60%", background:"linear-gradient(to top, rgba(0,0,0,0.85),transparent)" }}/>

        {/* Desktop-visible clickable arrows */}
        {idx > 0 && (
          <button onClick={e=>{e.stopPropagation();prev();}} className="tap"
            style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(4px)", border:"none", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:3, transition:"background 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.45)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.25)"}>
            <span style={{ color:"#fff", fontSize:20, lineHeight:1, marginRight:2 }}>‹</span>
          </button>
        )}
        {idx < total-1 && (
          <button onClick={e=>{e.stopPropagation();next();}} className="tap"
            style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(4px)", border:"none", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:3, transition:"background 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.45)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.25)"}>
            <span style={{ color:"#fff", fontSize:20, lineHeight:1, marginLeft:2 }}>›</span>
          </button>
        )}
      </div>

      {/* Job info */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"16px 18px 36px", zIndex:2 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:"#fff", lineHeight:1.15, marginBottom:5 }}>{job.title}</div>
        <div style={{ color:"rgba(255,255,255,0.75)", fontSize:13, marginBottom:12 }}>{job.venue} · {job.loc}</div>
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {[job.salary, job.type, ...(job.tags||[]).slice(0,2)].map(t=>(
            <span key={t} style={{ background:"rgba(255,255,255,0.18)", backdropFilter:"blur(6px)", color:"#fff", fontSize:11, fontWeight:600, padding:"4px 11px", borderRadius:20, border:"1px solid rgba(255,255,255,0.25)" }}>{t}</span>
          ))}
        </div>
        <button className="btn-cta tap" onClick={e=>{ e.stopPropagation(); onApply(job); onClose(); }} disabled={applied}
          style={{ width:"100%", background:applied?"rgba(107,143,113,0.45)":C.terracotta, border:"none", borderRadius:14, padding:"14px 0", color:"#fff", fontWeight:700, fontSize:15 }}>
          {applied ? "✓ Already Applied" : "Apply Now"}
        </button>
      </div>
    </div>
  );
}

// ─── Story Bar ────────────────────────────────────────────────────────────────
function StoryBar({ jobs, following, currentUser, onOpen }) {
  // onOpen(stories, startIndex)
  const cutoff = Date.now()-3600000*48;
  const items = EMPLOYERS.filter(e=>!e.isTrial).map(emp => {
    const empJobs = jobs.filter(j=>j.empId===emp.id&&j.ts>cutoff).sort((a,b)=>b.ts-a.ts);
    return { emp, latest:empJobs[0], isFollowed:following.includes(emp.id), hasNew:empJobs.length>0 };
  }).filter(x=>x.isFollowed||x.hasNew).sort((a,b)=>(b.isFollowed?1:0)-(a.isFollowed?1:0)||(b.latest?.ts||0)-(a.latest?.ts||0));
  if (!items.length) return null;
  return (
    <div style={{ display:"flex", gap:16, overflowX:"auto", padding:"12px 14px 10px", background:"#fff", borderBottom:`1px solid ${C.border}`, scrollbarWidth:"none" }}>
      {items.map(({ emp, latest, isFollowed, hasNew }) => (
        <div key={emp.id} className="tap" onClick={()=>latest&&onOpen(items.map(x=>({ job:x.latest, emp:x.emp })).filter(x=>x.job), items.findIndex(x=>x.emp.id===emp.id))} style={{ flexShrink:0, textAlign:"center", cursor:"pointer" }}>
          <div style={{ position:"relative", width:62, height:62, margin:"0 auto" }}>
            <div className={!hasNew?"story-seen":isFollowed?"story-fol":"story-new"} style={{ position:"absolute", inset:0, borderRadius:"50%", padding:2.5 }}>
              <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Avatar emp={emp} size={50} fontSize={22}/>
              </div>
            </div>
            {isFollowed && <div style={{ position:"absolute", bottom:0, right:0, width:18, height:18, borderRadius:"50%", background:C.sage, border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="check" size={10} color="#fff"/></div>}
          </div>
          <div style={{ color:C.textSoft, fontSize:10, marginTop:5, maxWidth:64, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:isFollowed?600:400 }}>{emp.name}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Venue Profile Page ───────────────────────────────────────────────────────
function VenueProfile({ emp, jobs, following, currentUser, onToggleFollow, onApply, onBack }) {
  const empJobs = jobs.filter(j=>j.empId===emp.id).sort((a,b)=>b.ts-a.ts);
  const isFollowed = following.includes(emp.id);
  const [expanded, setExpanded] = useState(null);
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 13px", color:C.textDark, fontSize:14 };
  return (
    <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:2000, overflowY:"auto" }}>
      <style>{G}</style>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, background:"rgba(250,250,248,0.96)", backdropFilter:"blur(10px)", zIndex:10 }}>
        <button className="tap" onClick={onBack} style={{ background:"none", border:"none", marginRight:10, padding:4 }}><Icon name="back" size={22} color={C.textDark}/></button>
        <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:17, color:C.textDark, flex:1 }}>@{emp.handle}</div>
      </div>
      {/* Profile header */}
      <div style={{ padding:"20px 18px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:14 }}>
          <div style={{ width:80, height:80, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, border:`3px solid ${C.border}` }}>{emp.avatar}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:18, marginBottom:4 }}>
              {[[empJobs.length,"Listings"],[empJobs.reduce((s,j)=>s+(j.apps?.length||0),0),"Applications"],["—","Followers"]].map(([n,l])=>(
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ fontWeight:700, fontSize:17, color:C.textDark }}>{n}</div>
                  <div style={{ fontSize:11, color:C.textSoft }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
            <div style={{ fontWeight:700, fontSize:15, color:C.textDark }}>{emp.name}</div>
            {emp.verified && <span style={{ color:C.blue, fontSize:13 }}>●</span>}
          </div>
          {emp.cuisine && <div style={{ color:C.textSoft, fontSize:13 }}>{emp.cuisine} · {emp.size} staff</div>}
          <div style={{ color:C.textMid, fontSize:13, marginTop:3 }}>{emp.bio}</div>
          {emp.awards?.length > 0 && (
            <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
              {emp.awards.map(a=><span key={a} style={{ background:C.featuredL, border:`1px solid ${C.featured}40`, color:C.featured, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, display:"flex", alignItems:"center", gap:4 }}><Icon name="award" size={11} color={C.featured}/>  {a}</span>)}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:8, margin:"14px 0 16px" }}>
          <button className="btn-cta tap" onClick={()=>onToggleFollow(emp.id)}
            style={{ flex:1, background:isFollowed?C.sageL:"#fff", border:`1px solid ${isFollowed?C.sage:C.border}`, borderRadius:9, padding:"8px 0", color:isFollowed?C.sage:C.textDark, fontSize:13, fontWeight:600, transition:"all 0.18s" }}>
            {isFollowed ? "✓ Following" : "+ Follow"}
          </button>
        </div>
      </div>
      {/* Listings grid */}
      <div style={{ borderTop:`1px solid ${C.border}`, padding:"14px 4px" }}>
        <div style={{ paddingLeft:14, marginBottom:10, fontWeight:600, fontSize:13, color:C.textSoft }}>ACTIVE LISTINGS</div>
        {empJobs.length===0 && <div style={{ textAlign:"center", padding:"30px 20px", color:C.textFaint, fontSize:13 }}>No active listings</div>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2 }}>
          {empJobs.map((j,i)=>{ const first=j.video||j.photos[0]; const hm=isData(first); const pbg=PBG[typeof j.photos[0]==="number"?j.photos[0]%PBG.length:i%PBG.length]; return (
            <div key={j.id} className="tap" onClick={()=>setExpanded(j)} style={{ position:"relative", aspectRatio:"1", cursor:"pointer", overflow:"hidden", background:pbg }}>
              {hm&&isVid(first)?<video src={first} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:hm?<img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<div style={{ width:"100%", height:"100%", background:pbg, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:22, opacity:0.4 }}>{emp.avatar}</span></div>}
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)" }}/>
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"5px 6px" }}>
                <div style={{ color:"#fff", fontSize:10, fontWeight:700, lineHeight:1.2 }}>{j.title}</div>
              </div>
              {j.featured && <div style={{ position:"absolute", top:4, left:4 }}><Icon name="star" size={13} color={C.featured} fill={C.featured}/></div>}
            </div>
          ); })}
        </div>
      </div>
      {expanded && <JobDetail job={expanded} currentUser={currentUser} profile={{}} following={following} onClose={()=>setExpanded(null)} onApply={j=>{ onApply(j); setExpanded(null); }} onToggleFollow={onToggleFollow} onVenueClick={()=>{}}/>}
    </div>
  );
}

// ─── Messaging ────────────────────────────────────────────────────────────────
function MessagesScreen({ currentUser, userType, messages, setMessages, jobs, onBack }) {
  const [activeThread, setActiveThread] = useState(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef();

  // Build thread list
  const threads = Object.entries(messages).filter(([key]) => key.includes(currentUser.id)).map(([key, msgs]) => {
    const other = key.replace(currentUser.id+"-","").replace("-"+currentUser.id,"");
    const otherUser = [...EMPLOYERS, ...EMPLOYEES].find(u=>u.id===other);
    const relatedJob = jobs.find(j=>j.empId===other||j.empId===currentUser.id);
    return { key, other, otherUser, msgs, last:msgs[msgs.length-1], relatedJob };
  });

  const send = () => {
    if (!draft.trim() || !activeThread) return;
    const newMsg = { from:currentUser.id, text:draft.trim(), ts:Date.now() };
    setMessages(m=>({ ...m, [activeThread.key]: [...(m[activeThread.key]||[]), newMsg] }));
    setDraft("");
    setTimeout(()=>endRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
  };

  if (activeThread) {
    const msgs = messages[activeThread.key]||[];
    return (
      <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:3000, display:"flex", flexDirection:"column" }}>
        <style>{G}</style>
        <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${C.border}`, flexShrink:0, background:"#fff" }}>
          <button className="tap" onClick={()=>setActiveThread(null)} style={{ background:"none", border:"none", marginRight:10, padding:4 }}><Icon name="back" size={22} color={C.textDark}/></button>
          <Avatar emp={activeThread.otherUser} size={32} fontSize={16}/>
          <div style={{ marginLeft:10, flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14, color:C.textDark }}>{activeThread.otherUser?.name}</div>
            {activeThread.relatedJob && <div style={{ color:C.textSoft, fontSize:11 }}>Re: {activeThread.relatedJob.title}</div>}
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 14px", display:"flex", flexDirection:"column", gap:10 }}>
          {msgs.map((m,i)=>{
            const mine = m.from===currentUser.id;
            return (
              <div key={i} style={{ display:"flex", justifyContent:mine?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"78%", background:mine?C.terracotta:C.bgSoft, color:mine?"#fff":C.textDark, borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"10px 14px", fontSize:14, lineHeight:1.5 }}>
                  {m.text}
                  <div style={{ color:mine?"rgba(255,255,255,0.6)":C.textFaint, fontSize:10, marginTop:4, textAlign:mine?"right":"left" }}>{ago(m.ts)} ago</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef}/>
        </div>
        <div style={{ padding:"10px 12px 20px", borderTop:`1px solid ${C.border}`, display:"flex", gap:9, background:"#fff", flexShrink:0 }}>
          <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message…" style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:24, padding:"10px 16px", color:C.textDark, fontSize:14 }}/>
          <button className="btn-cta tap" onClick={send} style={{ width:42, height:42, borderRadius:"50%", background:C.terracotta, border:"none", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(196,98,58,0.3)" }}><Icon name="send" size={16} color="#fff"/></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ padding:"16px 16px 10px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark }}>Messages</div>
      </div>
      {threads.length===0 && (
        <div style={{ textAlign:"center", padding:"60px 20px", color:C.textFaint }}>
          <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, color:C.textMid, marginBottom:5 }}>No messages yet</div>
          <div style={{ fontSize:13 }}>Apply for a role to start a conversation</div>
        </div>
      )}
      {threads.map(t=>(
        <div key={t.key} className="tap" onClick={()=>setActiveThread(t)} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
          <Avatar emp={t.otherUser} size={46} fontSize={22}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:14, color:C.textDark, marginBottom:2 }}>{t.otherUser?.name}</div>
            <div style={{ color:C.textSoft, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.last?.text}</div>
          </div>
          <div style={{ color:C.textFaint, fontSize:11, flexShrink:0 }}>{ago(t.last?.ts)} ago</div>
        </div>
      ))}
    </div>
  );
}

// ─── Job Alerts ───────────────────────────────────────────────────────────────
function JobAlertsScreen({ alerts, setAlerts, userId, onBack }) {
  const [newAlert, setNewAlert] = useState({ role:"", loc:"", type:"Any", salary:"Any", tags:[] });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 13px", color:C.textDark, fontSize:14 };
  const save = async () => {
    if (!newAlert.role.trim() || saving) return;
    setSaving(true);
    try {
      const created = await sbCreateAlert(userId, newAlert);
      setAlerts(a=>[created, ...a]);
      setNewAlert({ role:"", loc:"", type:"Any", salary:"Any", tags:[] });
      setSaved(true); setTimeout(()=>setSaved(false), 2000);
    } catch(e) { console.warn("Save alert error:", e); }
    setSaving(false);
  };
  const remove = async (id) => {
    setAlerts(al=>al.filter(x=>x.id!==id));
    try { await sbDeleteAlert(id); } catch(e) { console.warn("Delete alert error:", e); }
  };
  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ padding:"16px 16px 10px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark, marginBottom:3 }}>Job Alerts</div>
        <div style={{ color:C.textSoft, fontSize:13 }}>Get emailed when matching roles are posted</div>
      </div>
      <div style={{ padding:"16px" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:14, color:C.textDark, marginBottom:12 }}>Create Alert</div>
          {[["Role / Job Title","role","e.g. Head Chef, Sommelier…"],["Location","loc","e.g. Sydney NSW, Melbourne VIC"]].map(([l,k,p])=>(
            <div key={k} style={{ marginBottom:11 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>{l}</div>
              <input value={newAlert[k]} onChange={e=>setNewAlert(a=>({...a,[k]:e.target.value}))} placeholder={p} style={IS}/>
            </div>
          ))}
          {[["Employment Type","type",["Any","Full-time","Part-time","Casual","Contract"]],["Salary Band","salary",["Any",...SALARY_BANDS]]].map(([l,k,opts])=>(
            <div key={k} style={{ marginBottom:11 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>{l}</div>
              <select value={newAlert[k]} onChange={e=>setNewAlert(a=>({...a,[k]:e.target.value}))} style={IS}>{opts.map(o=><option key={o}>{o}</option>)}</select>
            </div>
          ))}
          {saved
            ? <div style={{ display:"flex", alignItems:"center", gap:9, padding:"13px", background:C.sageL, borderRadius:11, border:`1px solid ${C.sage}40` }}><span>✅</span><span style={{ color:C.sage, fontWeight:600, fontSize:13 }}>Alert saved! We'll email you new matches.</span></div>
            : <button className="btn-cta tap" onClick={save} disabled={saving} style={{ width:"100%", background:saving?"#ccc":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:11, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:"0 4px 12px rgba(196,98,58,0.22)" }}>{saving?"Saving…":"Save Alert"}</button>
          }
        </div>
        {alerts.length>0 && (
          <div>
            <div style={{ fontWeight:600, fontSize:14, color:C.textDark, marginBottom:10 }}>Your Alerts ({alerts.length})</div>
            {alerts.map(a=>(
              <div key={a.id} style={{ background:"#fff", borderRadius:13, padding:"12px 14px", border:`1px solid ${C.border}`, marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.terracottaL, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="bell" size={18} color={C.terracotta}/></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:C.textDark }}>{a.role}</div>
                  <div style={{ color:C.textSoft, fontSize:11, marginTop:1 }}>{[a.loc, a.type!=="Any"&&a.type, a.salary!=="Any"&&a.salary].filter(Boolean).join(" · ")}</div>
                </div>
                <button className="tap" onClick={()=>remove(a.id)} style={{ background:"none", border:"none", color:C.textFaint, fontSize:18, lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Notification Centre ──────────────────────────────────────────────────────
function NotifCentre({ userId, notifs, setNotifs }) {
  const mine = (notifs[userId]||[]).sort((a,b)=>b.ts-a.ts);
  const unread = mine.filter(n=>!n.read).length;
  const markAll = () => setNotifs(p=>({ ...p, [userId]: (p[userId]||[]).map(n=>({...n,read:true})) }));
  const dismiss = id => setNotifs(p=>({ ...p, [userId]: (p[userId]||[]).filter(n=>n.id!==id) }));
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark }}>Notifications</div>
          {unread>0 && <div style={{ color:C.textSoft, fontSize:12, marginTop:2 }}>{unread} unread</div>}
        </div>
        {unread>0 && <button className="tap" onClick={markAll} style={{ background:"none", border:"none", color:C.terracotta, fontSize:13, fontWeight:600 }}>Mark all read</button>}
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {mine.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:C.textFaint }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔔</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, color:C.textMid, marginBottom:5 }}>All caught up</div>
            <div style={{ fontSize:13 }}>New activity will appear here</div>
          </div>
        )}
        {mine.map(n=>(
          <div key={n.id} className="tap" style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px", borderBottom:`1px solid ${C.border}`, background:n.read?"#fff":C.terracottaL, cursor:"pointer" }}
            onClick={()=>setNotifs(p=>({ ...p, [userId]:(p[userId]||[]).map(x=>x.id===n.id?{...x,read:true}:x) }))}>
            <div style={{ width:42, height:42, borderRadius:14, background:n.read?C.bgSoft:C.terracottaM, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{n.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:n.read?500:700, fontSize:14, color:C.textDark, marginBottom:2 }}>{n.text}</div>
              <div style={{ color:C.textSoft, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.sub}</div>
              <div style={{ color:C.textFaint, fontSize:11, marginTop:4 }}>{ago(n.ts)} ago</div>
            </div>
            {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:C.terracotta, flexShrink:0, marginTop:6 }}/>}
            <button className="tap" onClick={e=>{ e.stopPropagation(); dismiss(n.id); }} style={{ background:"none", border:"none", color:C.textFaint, fontSize:18, lineHeight:1, padding:"0 0 0 4px", flexShrink:0 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Candidate Discovery (Employer) ──────────────────────────────────────────
function CandidateDiscovery({ jobs, currentUser }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [locFilter, setLocFilter] = useState("All");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [msgDraft, setMsgDraft] = useState("");
  const [msgSent, setMsgSent] = useState(false);

  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchPublicProfiles()
      .then(data => { if (alive) { setProfiles(data); setLoadingProfiles(false); } })
      .catch(() => { if (alive) setLoadingProfiles(false); });
    return () => { alive = false; };
  }, []);

  const [discCountry, setDiscCountry] = useState("");
  const [discState, setDiscState]     = useState("");
  const [discSector, setDiscSector]   = useState("");

  const discStates = discCountry ? Object.keys(LOCATIONS[discCountry]||{}) : [];

  const candidates = profiles.filter(e=>{
    const q = search.toLowerCase();
    const matchQ = !q || e.name.toLowerCase().includes(q) || (e.role||"").toLowerCase().includes(q) || (e.location||"").toLowerCase().includes(q) || (e.state||"").toLowerCase().includes(q) || (e.city||"").toLowerCase().includes(q) || (e.sector||"").toLowerCase().includes(q) || (e.bio||"").toLowerCase().includes(q) || (e.skills||[]).some(s=>s.toLowerCase().includes(q)) || (e.cuisine||[]).some(c=>c.toLowerCase().includes(q));
    const matchR = roleFilter==="All" || (e.role||"").toLowerCase().includes(roleFilter.toLowerCase());
    const matchC = !discCountry || (e.country||"").toLowerCase().includes(discCountry.toLowerCase()) || (e.location||"").toLowerCase().includes(discCountry.toLowerCase());
    const matchL = !discState || (e.state||"").toLowerCase().includes(discState.toLowerCase()) || (e.city||"").toLowerCase().includes(discState.toLowerCase()) || (e.location||"").toLowerCase().includes(discState.toLowerCase());
    const matchS = !discSector || (e.sector||"").toLowerCase().includes(discSector.toLowerCase());
    const matchA = !availableOnly || e.available;
    return matchQ && matchR && matchC && matchL && matchS && matchA;
  });

  const activeDiscFilters = [discCountry, discState, discSector, roleFilter!=="All"?roleFilter:"", locFilter!=="All"?locFilter:""].filter(Boolean).length;

  const sendMessage = () => {
    if (!msgDraft.trim()||!selected) return;
    const key = `${selected.id}-${currentUser.id}`;
    setMessages(m=>({ ...m, [key]:[...(m[key]||[]), { from:currentUser.id, text:msgDraft.trim(), ts:Date.now() }] }));
    setMsgDraft(""); setMsgSent(true); setTimeout(()=>{ setMsgSent(false); setSelected(null); },2000);
  };

  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.textDark, fontSize:13 };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Search + Filters */}
      <div style={{ padding:"10px 12px 8px", background:"#fff", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ background:C.bgSoft, borderRadius:10, padding:"9px 13px", display:"flex", alignItems:"center", gap:8, border:`1px solid ${C.border}`, marginBottom:8 }}>
          <Icon name="search" size={15} color={C.textSoft}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, role, skill, location…" style={{ flex:1, background:"none", border:"none", color:C.textDark, fontSize:13 }}/>
          {search && <button className="tap" onClick={()=>setSearch("")} style={{ background:"none", border:"none", color:C.textFaint, fontSize:16, lineHeight:1 }}>×</button>}
        </div>
        {/* Location dropdowns */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:7 }}>
          {[
            ["Country", discCountry, v=>{setDiscCountry(v);setDiscState("");}, ["", ...Object.keys(LOCATIONS)]],
            ["State",   discState,   v=>setDiscState(v),  ["", ...discStates]],
            ["Sector",  discSector,  v=>setDiscSector(v), ["", ...SECTORS]],
          ].map(([lbl,val,setter,opts])=>(
            <div key={lbl}>
              <div style={{ color:C.textFaint, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>{lbl}</div>
              <select value={val} onChange={e=>setter(e.target.value)} disabled={lbl==="State"&&!discCountry}
                style={{ width:"100%", background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 8px", color:val?C.textDark:C.textFaint, fontSize:11 }}>
                <option value="">Any</option>
                {opts.filter(Boolean).map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        {/* Role filter chips — scrollable */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", scrollbarWidth:"none", marginBottom:7 }}>
          {["All","Head Chef","Sous Chef","Chef de Partie","Pastry Chef","Kitchen Hand","Commis Chef","Front of House","Floor Manager","Sommelier","Bartender","Barista","Bar Manager","Restaurant Manager","General Manager","Concierge","Housekeeping"].map(r=>(
            <button key={r} className="tap" onClick={()=>setRoleFilter(r)}
              style={{ flexShrink:0, background:roleFilter===r?C.textDark:"#fff", border:`1.5px solid ${roleFilter===r?C.textDark:C.border}`, borderRadius:20, padding:"4px 11px", color:roleFilter===r?"#fff":C.textDark, fontSize:11, fontWeight:roleFilter===r?600:400 }}>{r}</button>
          ))}
        </div>
        {/* Available toggle */}
        <div className="tap" onClick={()=>setAvailableOnly(!availableOnly)}
          style={{ display:"inline-flex", alignItems:"center", gap:6, background:availableOnly?C.sageL:"#fff", border:`1.5px solid ${availableOnly?C.sage:C.border}`, borderRadius:20, padding:"5px 13px", cursor:"pointer" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:availableOnly?C.sage:C.border }}/>
          <span style={{ color:availableOnly?C.sage:C.textSoft, fontSize:11, fontWeight:availableOnly?600:400 }}>Open to work only</span>
        </div>
      </div>
      {candidates.length>0 && (discCountry||discState||discSector||roleFilter!=="All"||search) && (
        <div style={{ padding:"6px 14px", background:C.terracottaL, borderBottom:`1px solid ${C.terracottaM}`, color:C.terracotta, fontSize:11, fontWeight:600, flexShrink:0 }}>
          {candidates.length} candidate{candidates.length!==1?"s":""} match your filters
        </div>
      )}

      {/* Results */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 12px" }}>
        <div style={{ color:C.textFaint, fontSize:11, marginBottom:10 }}>{candidates.length} candidate{candidates.length!==1?"s":""} found</div>
        {candidates.map(cand=>{
          return (
            <div key={cand.id} className="tap" onClick={()=>setSelected(cand)} style={{ background:"#fff", borderRadius:14, padding:"14px 15px", border:`1px solid ${C.border}`, marginBottom:10, boxShadow:"0 1px 5px rgba(0,0,0,0.04)", cursor:"pointer" }}>
              <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0, border:`2px solid ${C.border}`, overflow:"hidden" }}>{cand.avatarUrl ? <img src={cand.avatarUrl} alt={cand.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : cand.avatar}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:C.textDark }}>{cand.name}</div>
                    {cand.available && <div style={{ display:"inline-flex", alignItems:"center", gap:4, background:C.sageL, border:`1px solid ${C.sage}40`, color:C.sage, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}><span style={{ width:5, height:5, borderRadius:"50%", background:C.sage, display:"inline-block" }}/>Open to work</div>}
                  </div>
                  <div style={{ color:C.textSoft, fontSize:13, marginBottom:3 }}>{cand.role}{cand.yearsExp ? ` · ${cand.yearsExp}` : cand.experience ? ` · ${cand.experience}` : ""}</div>
                  {cand.location && <div style={{ color:C.textFaint, fontSize:12, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>📍 {cand.location}</div>}
                  {cand.bio && <div style={{ color:C.textMid, fontSize:12, lineHeight:1.5, marginBottom:8, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{cand.bio}</div>}
                  {cand.sector && <span style={{ background:C.bgSoft, border:`1px solid ${C.border}`, color:C.textSoft, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>{cand.sector}</span>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                  <button className="btn-cta tap" onClick={e=>{ e.stopPropagation(); setSelected(cand); }} style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:8, padding:"7px 13px", color:"#fff", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(196,98,58,0.2)" }}>View</button>
                </div>
              </div>
            </div>
          );
        })}
        {candidates.length===0 && (loadingProfiles
          ? <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>⏳</div><div style={{ fontSize:13 }}>Loading talent…</div></div>
          : <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>👥</div><div style={{ fontFamily:"'Fraunces',serif", fontSize:16, color:C.textMid, marginBottom:5 }}>No candidates found</div><div style={{ fontSize:13 }}>{profiles.length===0 ? "No job seekers are discoverable yet — check back soon" : "Try adjusting your filters"}</div></div>
        )}
      </div>

      {/* Candidate detail modal */}
      {selected && (
        <div onClick={()=>setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(3px)", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:480, background:"#fff", borderRadius:20, padding:"20px 20px 32px", maxHeight:"88vh", overflowY:"auto", position:"relative" }}>

            {/* X close button */}
            <button className="tap" onClick={()=>setSelected(null)}
              style={{ position:"absolute", top:14, right:14, width:32, height:32, borderRadius:"50%", background:C.bgSoft, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:C.textMid, cursor:"pointer", lineHeight:1, padding:0, zIndex:2 }}>×</button>

            {/* Header — photo + name */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16, paddingRight:40 }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, border:`3px solid ${C.border}`, flexShrink:0, overflow:"hidden" }}>
                {selected.avatarUrl
                  ? <img src={selected.avatarUrl} alt={selected.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{e.target.style.display="none";}}/>
                  : selected.avatar||"👤"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 }}>
                  <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:20, color:C.textDark }}>{selected.name}</div>
                  {selected.available && <div style={{ display:"inline-flex", alignItems:"center", gap:4, background:C.sageL, border:`1px solid ${C.sage}40`, color:C.sage, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}><span style={{ width:5, height:5, borderRadius:"50%", background:C.sage, display:"inline-block" }}/>Open to work</div>}
                </div>
                <div style={{ color:C.textSoft, fontSize:13 }}>{selected.role}{selected.experience ? ` · ${selected.experience}` : ""}</div>
                {selected.location && <div style={{ color:C.textFaint, fontSize:12, marginTop:3 }}>📍 {selected.location}</div>}
              </div>
            </div>
            {selected.bio && <div style={{ color:C.textMid, fontSize:14, lineHeight:1.65, marginBottom:16, background:C.bgSoft, borderRadius:11, padding:"12px 14px" }}>{selected.bio}</div>}
            {/* Work photos */}
            {selected.photos?.length>0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:8 }}>Work & Profile Photos</div>
                <div style={{ display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 }}>
                  {selected.photos.map((p,i)=>(
                    <a key={i} href={p} target="_blank" rel="noreferrer" style={{ flexShrink:0 }}>
                      <img src={p} alt={`${selected.name} work ${i+1}`} style={{ width:96, height:96, objectFit:"cover", borderRadius:10, border:`1px solid ${C.border}` }}/>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resume download — only if candidate chose to share */}
            {selected.showResume !== false && selected.resumeUrl && (
              <div style={{ marginBottom:16 }}>
                <a href={selected.resumeUrl} target="_blank" rel="noreferrer" download
                  style={{ display:"flex", alignItems:"center", gap:11, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 15px", textDecoration:"none" }}>
                  <div style={{ width:38, height:38, borderRadius:9, background:C.terracottaL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📄</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:C.textDark }}>{selected.resumeName||"Resume / CV"}</div>
                    <div style={{ color:C.textSoft, fontSize:11 }}>Tap to download</div>
                  </div>
                  <span style={{ color:C.terracotta, fontSize:13, fontWeight:700 }}>↓</span>
                </a>
              </div>
            )}

            {/* Contact — only show what candidate chose to share */}
            {(selected.showEmail !== false && selected.contactEmail) || (selected.showPhone && selected.contactPhone) ? (
              <div style={{ marginTop:16 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:7 }}>Contact</div>
                {selected.showEmail !== false && selected.contactEmail && (
                  <a href={`mailto:${selected.contactEmail}?subject=${encodeURIComponent(`Opportunity via HospoSearch`)}&body=${encodeURIComponent(`Hi ${selected.name},\n\nI found your profile on HospoSearch and would love to discuss an opportunity with you.\n\n`)}`}
                    className="btn-cta tap"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, textDecoration:"none", boxShadow:"0 3px 10px rgba(196,98,58,0.22)", marginBottom:8 }}>
                    ✉️ Email {selected.name.split(" ")[0]}
                  </a>
                )}
                {selected.showPhone && selected.contactPhone && (
                  <a href={`tel:${selected.contactPhone}`}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 0", color:C.textDark, fontWeight:600, fontSize:14, textDecoration:"none", marginBottom:8 }}>
                    📞 Call {selected.name.split(" ")[0]}
                  </a>
                )}
                {selected.instagram && <a href={`https://instagram.com/${selected.instagram.replace(/^@/,"")}`} target="_blank" rel="noreferrer" style={{ display:"block", textAlign:"center", color:C.sage, fontSize:12, fontWeight:600 }}>@{selected.instagram.replace(/^@/,"")} on Instagram ↗</a>}
              </div>
            ) : (
              <div style={{ marginTop:16, padding:"12px 14px", background:C.bgSoft, borderRadius:10, color:C.textFaint, fontSize:13, textAlign:"center" }}>
                This candidate hasn't shared contact details yet
              </div>
            )}
            <button className="tap" onClick={()=>setSelected(null)}
              style={{ width:"100%", marginTop:16, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 0", color:C.textMid, fontSize:13, fontWeight:500, cursor:"pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Portfolio & Work History ─────────────────────────────────────────────────
function PortfolioSection({ user, profile, setProfile }) {
  const [addingWork, setAddingWork] = useState(false);
  const [newWork, setNewWork] = useState({ venue:"", role:"", dates:"", desc:"" });
  const [addingLink, setAddingLink] = useState(false);
  const [newLink, setNewLink] = useState({ label:"", url:"" });
  const [workSaved, setWorkSaved] = useState(false);
  const photoRef = useRef();
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 };

  const workHistory = profile?.workHistory || user.workHistory || [];
  const portfolioLinks = profile?.portfolioLinks || [];
  const portfolioPhotos = profile?.portfolioPhotos || [];

  const saveWork = () => {
    if (!newWork.venue.trim()) return;
    setProfile(p=>({ ...p, workHistory:[{ ...newWork, id:"wh"+Date.now() }, ...(p?.workHistory||user.workHistory||[])] }));
    setNewWork({ venue:"", role:"", dates:"", desc:"" }); setAddingWork(false); setWorkSaved(true);
    setTimeout(()=>setWorkSaved(false), 2000);
  };

  const saveLink = () => {
    if (!newLink.url.trim()) return;
    setProfile(p=>({ ...p, portfolioLinks:[...(p?.portfolioLinks||[]), { ...newLink, id:"lk"+Date.now() }] }));
    setNewLink({ label:"", url:"" }); setAddingLink(false);
  };

  const addPhoto = () => {
    const r = document.createElement("input"); r.type="file"; r.accept="image/*";
    r.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = ev => setProfile(p=>({ ...p, portfolioPhotos:[...(p?.portfolioPhotos||[]), { src:ev.target.result, caption:"", id:"ph"+Date.now() }] }));
      rd.readAsDataURL(f);
    };
    r.click();
  };

  return (
    <div style={{ marginBottom:20 }}>
      {/* Work History */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontWeight:600, fontSize:14, color:C.textDark, display:"flex", alignItems:"center", gap:7 }}>
          <Icon name="briefcase" size={15} color={C.terracotta}/>Work History
        </div>
        <button className="tap" onClick={()=>setAddingWork(!addingWork)} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:20, padding:"4px 11px", color:C.terracotta, fontSize:11, fontWeight:600 }}>+ Add</button>
      </div>

      {workSaved && <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:C.sageL, borderRadius:10, border:`1px solid ${C.sage}40`, marginBottom:10 }}><span>✅</span><span style={{ color:C.sage, fontWeight:600, fontSize:12 }}>Work history added!</span></div>}

      {addingWork && (
        <div style={{ background:"#fff", borderRadius:13, padding:14, border:`1px solid ${C.border}`, marginBottom:12 }}>
          <div style={{ fontWeight:600, fontSize:13, color:C.textDark, marginBottom:10 }}>Add Work Experience</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[["Venue / Employer","venue","e.g. Attica"],["Role","role","e.g. Chef de Partie"],["Dates","dates","e.g. 2021 – Present"]].map(([l,k,p])=>(
              <div key={k}><div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:3, fontWeight:600 }}>{l}</div><input value={newWork[k]} onChange={e=>setNewWork(w=>({...w,[k]:e.target.value}))} placeholder={p} style={IS}/></div>
            ))}
            <div><div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:3, fontWeight:600 }}>Description</div><textarea value={newWork.desc} onChange={e=>setNewWork(w=>({...w,desc:e.target.value}))} placeholder="Key responsibilities and achievements…" rows={2} style={{...IS,resize:"none"}}/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="tap" onClick={()=>setAddingWork(false)} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 0", color:C.textMid, fontSize:12 }}>Cancel</button>
              <button className="btn-cta tap" onClick={saveWork} style={{ flex:2, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:9, padding:"10px 0", color:"#fff", fontWeight:700, fontSize:12, boxShadow:"0 2px 8px rgba(196,98,58,0.22)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {workHistory.length===0 && !addingWork && (
        <div style={{ background:C.bgSoft, borderRadius:11, padding:"14px", textAlign:"center", border:`1px dashed ${C.border}`, marginBottom:12 }}>
          <div style={{ color:C.textFaint, fontSize:13 }}>Add your work history to stand out</div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
        {workHistory.map((w,i)=>(
          <div key={w.id||i} style={{ background:"#fff", borderRadius:13, padding:"13px 14px", border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:11, background:C.terracottaL, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="briefcase" size={16} color={C.terracotta}/></div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.textDark }}>{w.role}</div>
                <div style={{ color:C.terracotta, fontSize:12, fontWeight:600, marginBottom:1 }}>{w.venue}</div>
                <div style={{ color:C.textFaint, fontSize:11, marginBottom:w.desc?6:0 }}>{w.dates}</div>
                {w.desc && <div style={{ color:C.textMid, fontSize:12, lineHeight:1.55 }}>{w.desc}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Portfolio Photos */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontWeight:600, fontSize:14, color:C.textDark, display:"flex", alignItems:"center", gap:7 }}>
          <Icon name="image" size={15} color={C.terracotta}/>Portfolio Photos
        </div>
        <button className="tap" onClick={addPhoto} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:20, padding:"4px 11px", color:C.terracotta, fontSize:11, fontWeight:600 }}>+ Photo</button>
      </div>

      {portfolioPhotos.length===0 && (
        <div className="file-zone tap" onClick={addPhoto} style={{ border:`1.5px dashed ${C.borderMid}`, borderRadius:12, padding:"20px", textAlign:"center", cursor:"pointer", background:C.bgSoft, marginBottom:12 }}>
          <Icon name="image" size={28} color={C.borderMid}/>
          <div style={{ color:C.textMid, fontSize:13, fontWeight:500, marginTop:6 }}>Upload dish photos, certificates, or venue shots</div>
          <div style={{ color:C.textFaint, fontSize:11, marginTop:2 }}>JPG, PNG — show employers your work</div>
        </div>
      )}

      {portfolioPhotos.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:3, marginBottom:16, borderRadius:12, overflow:"hidden" }}>
          {portfolioPhotos.map((ph,i)=>(
            <div key={ph.id||i} style={{ position:"relative", aspectRatio:"1", overflow:"hidden" }}>
              <img src={ph.src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              <button className="tap" onClick={()=>setProfile(p=>({ ...p, portfolioPhotos:(p?.portfolioPhotos||[]).filter((_,j)=>j!==i) }))}
                style={{ position:"absolute", top:4, right:4, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
          ))}
          <div className="file-zone tap" onClick={addPhoto} style={{ aspectRatio:"4/5", background:C.bgSoft, border:`1.5px dashed ${C.borderMid}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <span style={{ color:C.textFaint, fontSize:22 }}>+</span>
          </div>
        </div>
      )}

      {/* Portfolio Links */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontWeight:600, fontSize:14, color:C.textDark, display:"flex", alignItems:"center", gap:7 }}>
          <Icon name="link" size={15} color={C.terracotta}/>Links
          <span style={{ color:C.textFaint, fontSize:11, fontWeight:400 }}>LinkedIn, portfolio site…</span>
        </div>
        <button className="tap" onClick={()=>setAddingLink(!addingLink)} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:20, padding:"4px 11px", color:C.terracotta, fontSize:11, fontWeight:600 }}>+ Link</button>
      </div>

      {addingLink && (
        <div style={{ background:"#fff", borderRadius:12, padding:13, border:`1px solid ${C.border}`, marginBottom:10 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div><div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:3, fontWeight:600 }}>Label</div><input value={newLink.label} onChange={e=>setNewLink(l=>({...l,label:e.target.value}))} placeholder="e.g. LinkedIn, Portfolio, Instagram" style={IS}/></div>
            <div><div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:3, fontWeight:600 }}>URL</div><input value={newLink.url} onChange={e=>setNewLink(l=>({...l,url:e.target.value}))} placeholder="https://…" style={IS}/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="tap" onClick={()=>setAddingLink(false)} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 0", color:C.textMid, fontSize:12 }}>Cancel</button>
              <button className="btn-cta tap" onClick={saveLink} style={{ flex:2, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:9, padding:"9px 0", color:"#fff", fontWeight:700, fontSize:12, boxShadow:"0 2px 8px rgba(196,98,58,0.22)" }}>Add Link</button>
            </div>
          </div>
        </div>
      )}

      {portfolioLinks.map((l,i)=>(
        <div key={l.id||i} style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 13px", background:"#fff", borderRadius:11, border:`1px solid ${C.border}`, marginBottom:7 }}>
          <Icon name="link" size={15} color={C.textSoft}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:13, color:C.textDark }}>{l.label||"Link"}</div>
            <div style={{ color:C.textSoft, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.url}</div>
          </div>
          <button className="tap" onClick={()=>setProfile(p=>({ ...p, portfolioLinks:(p?.portfolioLinks||[]).filter((_,j)=>j!==i) }))} style={{ background:"none", border:"none", color:C.textFaint, fontSize:16, lineHeight:1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Notification Preferences ─────────────────────────────────────────────────
function NotifPrefsPanel({ prefs, setPrefs }) {
  const settings = [
    ["newListings",    "🆕", "New job listings",        "Get notified when new roles matching your profile are posted"],
    ["matchingAlerts", "🎯", "Alert matches",           "Notifications when a listing matches one of your job alerts"],
    ["appUpdates",     "📋", "Application updates",     "When employers view or update the status of your application"],
    ["messages",       "💬", "Messages",                "New messages from employers"],
    ["weeklyDigest",   "📰", "Weekly digest",           "A weekly summary of new roles and activity"],
  ];
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontWeight:600, fontSize:14, color:C.textDark, marginBottom:4, display:"flex", alignItems:"center", gap:7 }}>
        <Icon name="sliders" size={15} color={C.terracotta}/>Notification Preferences
      </div>
      <div style={{ color:C.textSoft, fontSize:12, marginBottom:12 }}>Choose what you hear about</div>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {settings.map(([key, icon, label, sub], i)=>(
          <div key={key} className="tap" onClick={()=>setPrefs(p=>({...p,[key]:!p[key]}))}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px", background:"#fff", borderBottom:i<settings.length-1?`1px solid ${C.border}`:"none", borderRadius:i===0?"12px 12px 0 0":i===settings.length-1?"0 0 12px 12px":"0", cursor:"pointer", border:`1px solid ${C.border}`, marginBottom:i<settings.length-1?-1:0 }}>
            <div style={{ fontSize:18, width:28, textAlign:"center", flexShrink:0 }}>{icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:13, color:C.textDark }}>{label}</div>
              <div style={{ color:C.textSoft, fontSize:11, marginTop:1 }}>{sub}</div>
            </div>
            {/* Toggle */}
            <div style={{ width:44, height:24, borderRadius:12, background:prefs[key]?C.terracotta:C.border, position:"relative", flexShrink:0, transition:"background 0.2s" }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:prefs[key]?23:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Candidate Profile ────────────────────────────────────────────────────────
function CandidateProfile({ user, profile, setProfile, following, setFollowing, altAccount, onSwitchAccount, applications, bookmarks, notifPrefs, setNotifPrefs, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    ...user,
    role: user?.role||"",
    sector: user?.sector||"",
    country: user?.country||"Australia",
    state: user?.state||"",
    city: user?.city||"",
    yearsExp: user?.yearsExp||user?.experience||"",
  });
  const [resume, setResume] = useState(user.resume_url ? { name:user.resume_name, url:user.resume_url } : profile?.resume||null);
  const [cover, setCover] = useState(user.cover_url ? { name:user.cover_name, url:user.cover_url } : profile?.coverLetter||null);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url||null);
  const [avatarEmoji, setAvatarEmoji] = useState(user.avatar||"👨‍🍳");
  const [docSaving, setDocSaving] = useState(false);
  const [docSaved, setDocSaved] = useState(false);
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 13px", color:C.textDark, fontSize:14 };

  const [saving, setSaving] = useState(false);

  // Upload avatar photo
  const uploadAvatar = async (file) => {
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const res = await fetch(ev.target.result);
        const blob = await res.blob();
        // Avatars go in the PUBLIC job-photos bucket so they display everywhere
        const path = `avatars/${user.id}/avatar-${Date.now()}.jpg`;
        await supabase.storage.from('job-photos').upload(path, blob, { upsert:true, contentType:'image/jpeg' });
        const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(path);
        setAvatarUrl(urlData.publicUrl);
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      } catch(e) { console.warn('Avatar upload error:', e); }
    };
    reader.readAsDataURL(file);
  };

  // Save docs separately with their own button
  const saveDocs = async () => {
    setDocSaving(true);
    let resumeResult = resume;
    let coverResult = cover;
    if (resume?.data) {
      try {
        const res = await fetch(resume.data);
        const blob = await res.blob();
        const ext = resume.name?.split('.').pop()||'pdf';
        const path = `profiles/${user.id}/resume.${ext}`;
        await supabase.storage.from('documents').upload(path, blob, { upsert:true, contentType:blob.type });
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        resumeResult = { name:resume.name, size:resume.size, url:urlData.publicUrl };
        setResume(resumeResult);
      } catch(e) { console.warn('Resume upload error:', e); }
    }
    if (cover?.data) {
      try {
        const res = await fetch(cover.data);
        const blob = await res.blob();
        const ext = cover.name?.split('.').pop()||'pdf';
        const path = `profiles/${user.id}/cover.${ext}`;
        await supabase.storage.from('documents').upload(path, blob, { upsert:true, contentType:blob.type });
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        coverResult = { name:cover.name, size:cover.size, url:urlData.publicUrl };
        setCover(coverResult);
      } catch(e) { console.warn('Cover upload error:', e); }
    }
    try {
      await supabase.from('profiles').update({
        resume_name: resumeResult?.name||null, resume_url: resumeResult?.url||null,
        cover_name: coverResult?.name||null, cover_url: coverResult?.url||null,
      }).eq('id', user.id);
    } catch(e) {}
    setProfile(p=>({ ...p, resume:resumeResult, coverLetter:coverResult }));
    setDocSaving(false); setDocSaved(true); setTimeout(()=>setDocSaved(false), 2000);
  };

  const save = async () => {
    setSaving(true);
    let resumeResult = resume;
    let coverResult = cover;

    // Upload resume to Supabase Storage if it has new data
    if (resume?.data) {
      try {
        const res = await fetch(resume.data);
        const blob = await res.blob();
        const ext = resume.name?.split('.').pop() || 'pdf';
        const path = `profiles/${user.id}/resume.${ext}`;
        await supabase.storage.from('documents').upload(path, blob, { upsert:true, contentType:blob.type });
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        resumeResult = { name:resume.name, size:resume.size, url:urlData.publicUrl };
      } catch(e) { console.warn('Resume upload error:', e); }
    }

    // Upload cover letter to Supabase Storage if it has new data
    if (cover?.data) {
      try {
        const res = await fetch(cover.data);
        const blob = await res.blob();
        const ext = cover.name?.split('.').pop() || 'pdf';
        const path = `profiles/${user.id}/cover.${ext}`;
        await supabase.storage.from('documents').upload(path, blob, { upsert:true, contentType:blob.type });
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        coverResult = { name:cover.name, size:cover.size, url:urlData.publicUrl };
      } catch(e) { console.warn('Cover upload error:', e); }
    }

    // Save profile to Supabase
    try {
      await supabase.from('profiles').update({
        resume_name: resumeResult?.name || null,
        resume_url:  resumeResult?.url  || null,
        cover_name:  coverResult?.name  || null,
        cover_url:   coverResult?.url   || null,
        bio:         draft.bio,
        location:    draft.location,
        experience:  draft.experience,
      }).eq('id', user.id);
    } catch(e) { console.warn('Profile save error:', e); }

    setResume(resumeResult);
    setCover(coverResult);
    setProfile(p=>({ ...p, resume:resumeResult, coverLetter:coverResult, bio:draft.bio, location:draft.location, experience:draft.experience }));
    setSaving(false); setSaved(true); setEditing(false);
    setTimeout(()=>setSaved(false), 2000);
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", background:"#fff" }}>
      {/* IG-style header */}
      <div style={{ padding:"20px 18px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:14 }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <div style={{ width:82, height:82, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, border:`3px solid ${C.border}`, overflow:"hidden" }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                : <span>{avatarEmoji}</span>
              }
            </div>
            <label style={{ position:"absolute", bottom:0, right:0, width:26, height:26, borderRadius:"50%", background:C.terracotta, border:"2px solid white", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <span style={{ fontSize:13 }}>📷</span>
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files[0]; if(f) uploadAvatar(f); }}/>
            </label>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:18, marginBottom:4 }}>
              {[[applications.length,"Applied"],[bookmarks.length,"Saved"],["—","Views"]].map(([n,l])=>(
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ fontWeight:700, fontSize:17, color:C.textDark }}>{n}</div>
                  <div style={{ fontSize:11, color:C.textSoft }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom:6 }}>
          <div style={{ fontWeight:700, fontSize:16, color:C.textDark }}>{user.name}</div>
          <div style={{ color:C.textSoft, fontSize:13 }}>{user.role}</div>
          <div style={{ color:C.textFaint, fontSize:12 }}>@{user.handle}</div>
          {user.location && <div style={{ color:C.textMid, fontSize:13, marginTop:3 }}>📍 {user.location}</div>}
          {(profile?.bio||user.bio) && <div style={{ color:C.textMid, fontSize:13, marginTop:4, lineHeight:1.5 }}>{profile?.bio||user.bio}</div>}
          {user.available && <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:C.sageL, border:`1px solid ${C.sage}40`, color:C.sage, fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20, marginTop:6 }}><span style={{ width:6, height:6, borderRadius:"50%", background:C.sage, display:"inline-block" }}/>Open to work</div>}
          {(user.instagram||profile?.instagram) && (
            <a href={"https://instagram.com/"+(user.instagram||profile?.instagram||"").replace(/^@/,"")} target="_blank" rel="noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:5, color:C.textSoft, fontSize:12, marginTop:5, textDecoration:"none" }}>
              <span>📸</span> @{(user.instagram||profile?.instagram||"").replace(/^@/,"")}
            </a>
          )}
        </div>
        <div style={{ display:"flex", gap:8, margin:"12px 0 16px" }}>
          <button className="tap" onClick={()=>setEditing(!editing)} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"8px 0", color:C.textDark, fontSize:13, fontWeight:600 }}>{editing ? "Cancel" : "Edit profile"}</button>
          <button className="tap" style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"8px 0", color:C.textMid, fontSize:13, fontWeight:600 }}>Share profile</button>
        </div>
      </div>

      <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px 18px" }}>
        {/* Edit form */}
        {editing && (
          <div style={{ marginBottom:20 }}>
            {[["Bio","bio","Tell employers about yourself…"],["Location","location","e.g. Sydney NSW"],["Experience","experience","e.g. 5 years fine dining"]].map(([l,k,p])=>(
              <div key={k} style={{ marginBottom:11 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>{l}</div>
                {k==="bio" ? <textarea value={draft[k]||""} onChange={e=>setDraft(d=>({...d,[k]:e.target.value}))} placeholder={p} rows={3} style={{...IS,resize:"none"}}/> : <input value={draft[k]||""} onChange={e=>setDraft(d=>({...d,[k]:e.target.value}))} placeholder={p} style={IS}/>}
              </div>
            ))}
          </div>
        )}

        {/* Saved docs */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:14, color:C.textDark, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            📎 Documents
            {(resume&&cover) && <span style={{ color:C.sage, fontSize:11, background:C.sageL, border:`1px solid ${C.sage}40`, borderRadius:20, padding:"2px 8px" }}>Both saved · auto-attach</span>}
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {[["Résumé",resume,"📋"],["Cover Letter",cover,"✉️"]].map(([l,f,ic])=>(
              <div key={l} style={{ flex:1, padding:"10px 10px", borderRadius:11, background:f?C.sageL:C.bgSoft, border:`1px solid ${f?C.sage+"50":C.border}`, textAlign:"center" }}>
                <div style={{ fontSize:18, marginBottom:2 }}>{ic}</div>
                {f?.url
                  ? <a href={f.url} target="_blank" rel="noreferrer" style={{ color:C.sage, fontSize:11, fontWeight:600, textDecoration:"none" }}>View ↗</a>
                  : <div style={{ color:f?C.sage:C.textFaint, fontSize:11, fontWeight:600 }}>{f?"Saved (not uploaded)":"Not set"}</div>
                }
                {f?.name && <div style={{ color:C.textFaint, fontSize:10, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <FileZone label="Résumé" icon="📋" file={resume} onFile={f=>setResume(f)} onRemove={()=>setResume(null)}/>
            {resume?.url && !resume?.data && <a href={resume.url} target="_blank" rel="noreferrer" style={{ color:C.sage, fontSize:12, marginTop:-6, display:"block" }}>View uploaded résumé ↗</a>}
            <FileZone label="Cover Letter" icon="✉️" file={cover} onFile={f=>setCover(f)} onRemove={()=>setCover(null)}/>
            {cover?.url && !cover?.data && <a href={cover.url} target="_blank" rel="noreferrer" style={{ color:C.sage, fontSize:12, marginTop:-6, display:"block" }}>View uploaded cover letter ↗</a>}
            <button className="btn-cta tap" onClick={saveDocs} disabled={docSaving}
              style={{ background:docSaved?C.sage:docSaving?"#999":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:"none", transition:"all 0.3s" }}>
              {docSaved ? "✅ Documents Saved!" : docSaving ? "⏳ Uploading…" : "💾 Save Documents"}
            </button>
          </div>
        </div>

        {/* Following */}
        {following.length>0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontWeight:600, fontSize:14, color:C.textDark, marginBottom:10 }}>Following · {following.length}</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {following.map(id=>{ const emp=EMPLOYERS.find(e=>e.id===id); return emp?(<div key={id} style={{ display:"flex", alignItems:"center", gap:7, background:C.sageL, border:`1px solid ${C.sage}40`, borderRadius:20, padding:"5px 11px" }}><span style={{ fontSize:14 }}>{emp.avatar}</span><span style={{ color:C.sage, fontSize:12, fontWeight:600 }}>{emp.name}</span></div>):null; })}
            </div>
          </div>
        )}

        {(editing||resume||cover) && (
          saved
            ? <div style={{ display:"flex", alignItems:"center", gap:9, padding:"12px 14px", background:C.sageL, borderRadius:11, border:`1px solid ${C.sage}40`, marginBottom:14 }}><span>✅</span><span style={{ color:C.sage, fontWeight:600, fontSize:13 }}>Profile saved!</span></div>
            : editing && <button className="btn-cta tap" onClick={save} disabled={saving}
              style={{ width:"100%", background:saving?"#999":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:11, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:saving?"none":"0 4px 12px rgba(196,98,58,0.22)", marginBottom:14 }}>
              {saving ? "⏳ Uploading…" : "Save Changes"}
            </button>
        )}

        <TalentShareCard user={user}/>

        <PortfolioSection user={user} profile={profile} setProfile={setProfile}/>

        <NotifPrefsPanel prefs={notifPrefs} setPrefs={setNotifPrefs}/>

        <AccountSettings user={user} onLogout={onLogout}/>
        {altAccount && (
          <button className="tap" onClick={onSwitchAccount}
            style={{ width:"100%", background:C.terracottaL, border:"1px solid #E8CFBF", borderRadius:11, padding:"12px 0", color:C.terracotta, fontSize:14, fontWeight:600, marginBottom:8 }}>
            Switch to Employer Account
          </button>
        )}
        <button className="tap" onClick={onLogout} style={{ width:"100%", background:C.bgSoft, border:"1px solid #E8E3DC", borderRadius:11, padding:"12px 0", color:C.textMid, fontSize:14, fontWeight:500, marginTop:8 }}>Sign Out</button>
      </div>
    </div>
  );
}

// ─── My Applications Screen ───────────────────────────────────────────────────
function MyApplications({ userId, jobs, bookmarks, onExpand }) {
  const [tab, setTab] = useState("applied");
  const applied = jobs.filter(j=>j.apps?.some(a=>a.uid===userId)).map(j=>({ job:j, app:j.apps.find(a=>a.uid===userId) }));
  const saved = jobs.filter(j=>bookmarks.includes(j.id));
  const statusColor = { "Sent":C.textSoft, "Viewed":C.blue, "Shortlisted":C.sage, "No thanks":C.error };
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, background:"#fff", flexShrink:0 }}>
        {[["applied",`Applied (${applied.length})`],["saved",`Saved (${saved.length})`]].map(([t,l])=>(
          <button key={t} className="tap" onClick={()=>setTab(t)} style={{ flex:1, padding:"13px 0", border:"none", background:"transparent", color:tab===t?C.terracotta:C.textSoft, fontWeight:tab===t?600:400, fontSize:13, borderBottom:tab===t?`2.5px solid ${C.terracotta}`:"2.5px solid transparent" }}>{l}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
        {tab==="applied" && (
          applied.length===0
            ? <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>📋</div><div style={{ fontFamily:"'Fraunces',serif", fontSize:16, color:C.textMid, marginBottom:5 }}>No applications yet</div><div style={{ fontSize:13 }}>Apply for a role to track it here</div></div>
            : applied.map(({ job, app })=>{ const emp=getEmp(job); const status=app.status||"Sent"; const sc=statusColor[status]||C.textSoft; const first=job.photos[0]; const isd=isData(first); return (
              <div key={job.id} className="tap" onClick={()=>onExpand(job)} style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, marginBottom:10, overflow:"hidden", boxShadow:"0 1px 5px rgba(0,0,0,0.04)", cursor:"pointer" }}>
                <div style={{ display:"flex", height:70 }}>
                  <div style={{ width:70, flexShrink:0, overflow:"hidden", background:PBG[(typeof first==="number"?first:0)%PBG.length] }}>
                    {isd?<img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:22, opacity:0.4 }}>{emp?.avatar}</span></div>}
                  </div>
                  <div style={{ flex:1, padding:"10px 12px" }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.textDark, marginBottom:1 }}>{job.title}</div>
                    <div style={{ color:C.textSoft, fontSize:11, marginBottom:6 }}>{job.venue} · {job.type}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:sc, display:"inline-block" }}/>
                      <span style={{ color:sc, fontSize:11, fontWeight:600 }}>{status}</span>
                      <span style={{ color:C.textFaint, fontSize:11 }}>· Applied {ago(app.ts)} ago</span>
                    </div>
                  </div>
                </div>
              </div>
            ); })
        )}
        {tab==="saved" && (
          saved.length===0
            ? <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>🔖</div><div style={{ fontFamily:"'Fraunces',serif", fontSize:16, color:C.textMid, marginBottom:5 }}>No saved jobs yet</div><div style={{ fontSize:13 }}>Tap the bookmark icon on any listing</div></div>
            : saved.map(job=>{ const emp=getEmp(job); const first=job.photos[0]; const isd=isData(first); return (
              <div key={job.id} className="tap" onClick={()=>onExpand(job)} style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, marginBottom:10, overflow:"hidden", boxShadow:"0 1px 5px rgba(0,0,0,0.04)", cursor:"pointer" }}>
                <div style={{ display:"flex", height:70 }}>
                  <div style={{ width:70, flexShrink:0, overflow:"hidden", background:PBG[(typeof first==="number"?first:0)%PBG.length] }}>
                    {isd?<img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:22, opacity:0.4 }}>{emp?.avatar}</span></div>}
                  </div>
                  <div style={{ flex:1, padding:"10px 12px" }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.textDark, marginBottom:1 }}>{job.title}</div>
                    <div style={{ color:C.textSoft, fontSize:11, marginBottom:5 }}>{job.venue} · {job.type}</div>
                    <div style={{ color:C.sand, fontWeight:600, fontSize:12 }}>{job.salary}</div>
                  </div>
                </div>
              </div>
            ); })
        )}
      </div>
    </div>
  );
}

// ─── Explore Grid ─────────────────────────────────────────────────────────────
function ExploreGrid({ jobs, following, currentUser, bookmarks, onOpen, onToggleFollow }) {
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [country, setCountry]     = useState("");
  const [state, setState]         = useState("");
  const [city, setCity]           = useState("");
  const [sector, setSector]       = useState("");
  const [roleType, setRoleType]   = useState("");
  const [empType, setEmpType]     = useState("");
  const [salaryBand, setSalaryBand] = useState("");

  const states = country ? Object.keys(LOCATIONS[country]||{}) : [];
  const cities = (country && state) ? (LOCATIONS[country]?.[state]||[]) : [];

  const activeFilters = [country,state,city,sector,roleType,empType,salaryBand].filter(Boolean).length;

  const filtered = jobs.filter(j=>{
    const q = search.toLowerCase();
    const matchQ = !q || j.title.toLowerCase().includes(q) || j.venue.toLowerCase().includes(q) || j.loc.toLowerCase().includes(q) || (j.roleType||"").toLowerCase().includes(q) || (j.sector||"").toLowerCase().includes(q) || (j.tags||[]).some(t=>t.toLowerCase().includes(q));
    const matchCountry  = !country  || j.country===country;
    const matchState    = !state    || j.state===state;
    const matchCity     = !city     || j.city===city;
    const matchSector   = !sector   || j.sector===sector;
    const matchRole     = !roleType || j.roleType===roleType || j.title.toLowerCase().includes(roleType.toLowerCase());
    const matchEmpType  = !empType  || j.type===empType;
    const matchSalary   = !salaryBand || j.salaryBand===salaryBand;
    return matchQ && matchCountry && matchState && matchCity && matchSector && matchRole && matchEmpType && matchSalary;
  });

  const clearAll = () => { setCountry(""); setState(""); setCity(""); setSector(""); setRoleType(""); setEmpType(""); setSalaryBand(""); setSearch(""); };
  const SS = { width:"100%", background:"#fff", border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13 };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Search bar */}
      <div style={{ padding:"10px 12px 8px", background:"#fff", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", gap:8, marginBottom:showFilters?8:0 }}>
          <div style={{ flex:1, background:C.bgSoft, borderRadius:10, padding:"9px 13px", display:"flex", alignItems:"center", gap:8, border:`1px solid ${C.border}` }}>
            <Icon name="search" size={15} color={C.textSoft}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roles, venues, sectors…" style={{ flex:1, background:"none", border:"none", color:C.textDark, fontSize:13 }}/>
            {search && <button className="tap" onClick={()=>setSearch("")} style={{ background:"none", border:"none", color:C.textFaint, fontSize:16, lineHeight:1 }}>×</button>}
          </div>
          <button className="tap" onClick={()=>setShowFilters(!showFilters)}
            style={{ background:showFilters||activeFilters>0?C.terracotta:C.bgSoft, border:`1px solid ${showFilters||activeFilters>0?C.terracotta:C.border}`, borderRadius:10, padding:"9px 13px", color:showFilters||activeFilters>0?"#fff":C.textDark, display:"flex", alignItems:"center", gap:5, position:"relative" }}>
            <Icon name="filter" size={14} color={showFilters||activeFilters>0?"#fff":C.textDark}/>
            <span style={{ fontSize:13, fontWeight:600 }}>Filter</span>
            {activeFilters>0 && <span style={{ background:"#fff", color:C.terracotta, borderRadius:"50%", width:16, height:16, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{activeFilters}</span>}
          </button>
        </div>

        {showFilters && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {/* Location row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7 }}>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Country</div>
                <select value={country} onChange={e=>{setCountry(e.target.value);setState("");setCity("");}} style={SS}>
                  <option value="">Any</option>
                  {Object.keys(LOCATIONS).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>State</div>
                <select value={state} onChange={e=>{setState(e.target.value);setCity("");}} style={SS} disabled={!country}>
                  <option value="">Any</option>
                  {states.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>City</div>
                <select value={city} onChange={e=>setCity(e.target.value)} style={SS} disabled={!state}>
                  <option value="">Any</option>
                  {cities.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Sector + Role type */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Sector</div>
                <select value={sector} onChange={e=>setSector(e.target.value)} style={SS}>
                  <option value="">Any sector</option>
                  {SECTORS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Role Type</div>
                <select value={roleType} onChange={e=>setRoleType(e.target.value)} style={SS}>
                  <option value="">Any role</option>
                  {Object.entries(HOSPO_ROLES).map(([dept,roles])=><optgroup key={dept} label={dept}>{roles.map(r=><option key={r}>{r}</option>)}</optgroup>)}
                </select>
              </div>
            </div>
            {/* Employment type + Salary */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Employment</div>
                <select value={empType} onChange={e=>setEmpType(e.target.value)} style={SS}>
                  <option value="">Any</option>
                  {["Full-time","Part-time","Casual","Contract"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:C.textFaint, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Salary Band</div>
                <select value={salaryBand} onChange={e=>setSalaryBand(e.target.value)} style={SS}>
                  <option value="">Any</option>
                  {SALARY_BANDS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {activeFilters>0 && (
              <button className="tap" onClick={clearAll} style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"7px 0", color:C.textMid, fontSize:12, fontWeight:500 }}>
                Clear all filters ({activeFilters})
              </button>
            )}
          </div>
        )}
      </div>
      {(search||activeFilters>0) && (
        <div style={{ padding:"7px 14px", background:"#fff", borderBottom:`1px solid ${C.border}`, color:C.textSoft, fontSize:12, flexShrink:0, display:"flex", alignItems:"center", gap:6 }}>
          <span>{filtered.length} result{filtered.length!==1?"s":""}</span>
          {[country,state,city,sector,roleType,empType,salaryBand].filter(Boolean).map(f=>(
            <span key={f} style={{ background:C.terracottaL, color:C.terracotta, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, border:`1px solid ${C.terracottaM}` }}>{f}</span>
          ))}
        </div>
      )}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr", gap:isDesktop?16:12 }}>
          {filtered.map((j,i)=>{ const first=j.video||j.photos[0]; const hm=isData(first); const pbg=PBG[typeof j.photos[0]==="number"?j.photos[0]%PBG.length:i%PBG.length]; const emp=getEmp(j); const bk=bookmarks.includes(j.id); return (
            <div key={j.id} className="tap" onClick={()=>onOpen(j)}
              style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.2s" }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)"; e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="none"; }}>
              {/* Image */}
              <div style={{ position:"relative", width:"100%", aspectRatio:"4/5", overflow:"hidden", background:pbg }}>
                {hm&&isVid(first)?<video src={first} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  :hm?<BlurFillImage src={first} alt={j.title} ratio="4/5"/>
                  :<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:40, opacity:0.2 }}>{emp?.avatar}</span></div>}
                {j.featured && <div style={{ position:"absolute", top:8, left:8, background:C.featuredL, border:`1px solid ${C.featured}40`, borderRadius:20, padding:"3px 9px", display:"flex", alignItems:"center", gap:4, zIndex:2 }}><Icon name="star" size={11} color={C.featured} fill={C.featured}/><span style={{ color:C.featured, fontSize:10, fontWeight:700 }}>Featured</span></div>}
                {j.video && <div style={{ position:"absolute", top:8, right:8, zIndex:2 }}><Icon name="video" size={13} color="#fff"/></div>}
                {bk && <div style={{ position:"absolute", top:j.video?28:8, right:8, zIndex:2 }}><Icon name="bookmark" size={14} color={C.terracotta} fill={C.terracotta}/></div>}
              </div>
              {/* Text */}
              <div style={{ padding:"12px 14px 14px" }}>
                <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, marginBottom:3 }}>{j.venue||emp?.name}</div>
                <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:17, color:C.textDark, marginBottom:4, lineHeight:1.2 }}>{j.title}</div>
                <div style={{ color:C.sand, fontWeight:600, fontSize:13, marginBottom:8 }}>{j.salary}</div>
                <div style={{ color:C.textMid, fontSize:13, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:10 }}>{stripTags(j.short)}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ color:C.textFaint, fontSize:11 }}>{j.loc} · {ago(j.ts)} ago</div>
                  <div style={{ color:C.terracotta, fontSize:12, fontWeight:600 }}>View role →</div>
                </div>
              </div>
            </div>
          ); })}
        </div>
        {filtered.length===0 && <div style={{ textAlign:"center", padding:"60px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>🔍</div><div style={{ color:C.textMid, fontSize:14 }}>No roles match your search</div></div>}
      </div>
    </div>
  );
}

// ─── Listing countdown ──────────────────────────────────────────────────────
// Days remaining until a listing's expires_at. Returns null if no expiry set.
function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24*60*60*1000));
}
function CountdownBadge({ expiresAt, style }) {
  const d = daysLeft(expiresAt);
  if (d === null) return null;
  const urgent = d <= 3;
  const expired = d === 0;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      background: expired ? "#FEE2E2" : urgent ? "#FEF3C7" : C.sandL,
      border:`1px solid ${expired ? "#FCA5A5" : urgent ? "#FDE68A" : C.sand+"60"}`,
      color: expired ? "#B91C1C" : urgent ? "#92400E" : C.clay,
      fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, ...style }}>
      <Icon name="clock" size={11} color={expired ? "#B91C1C" : urgent ? "#92400E" : C.clay}/>
      {expired ? "Expired" : d === 1 ? "1 day left" : `${d} days left`}
    </span>
  );
}

// ─── Mine Job Card (employer view — compact card with thumbnail + management actions) ──
function MineJobCard({ job, onEdit, onApps, onExpand }) {
  const first = job.photos?.[0];
  const isd = isData(first);
  const appsCount = job.apps?.length || 0;
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", marginBottom:12 }}>
      <div className="tap" onClick={()=>onExpand(job)} style={{ display:"flex", gap:12, padding:12, cursor:"pointer", alignItems:"center" }}>
        {/* Thumbnail */}
        <div style={{ width:72, height:72, borderRadius:10, overflow:"hidden", flexShrink:0, background:isd?"transparent":C.bgSoft, position:"relative" }}>
          {isd
            ? <img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, opacity:0.35 }}>🍽️</div>
          }
          {job.featured && (
            <div style={{ position:"absolute", top:4, left:4, background:C.featuredL, border:`1px solid ${C.featured}50`, borderRadius:20, padding:"1px 6px", display:"flex", alignItems:"center", gap:3 }}>
              <Icon name="star" size={9} color={C.featured} fill={C.featured}/>
            </div>
          )}
        </div>
        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:16, color:C.textDark, marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{job.title}</div>
          <div style={{ color:C.textSoft, fontSize:12, marginBottom:4 }}>{job.type} · {job.loc}</div>
          <div style={{ color:C.sand, fontWeight:600, fontSize:12, marginBottom:4 }}>{job.salary}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <CountdownBadge expiresAt={job.expiresAt}/>
            <span style={{ color:C.textFaint, fontSize:11 }}>{ago(job.ts)} ago</span>
          </div>
        </div>
        <Icon name="more" size={18} color={C.textFaint}/>
      </div>
      {/* Action bar */}
      <div style={{ display:"flex", gap:0, borderTop:`1px solid ${C.border}` }}>
        <button className="tap" onClick={onEdit}
          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#fff", border:"none", borderRight:`1px solid ${C.border}`, padding:"10px 0", color:C.textDark, fontSize:13, fontWeight:600, cursor:"pointer" }}>
          <Icon name="edit" size={13} color={C.textMid}/> Edit
        </button>
        <button className="tap" onClick={onApps}
          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:appsCount>0?C.terracottaL:"#fff", border:"none", padding:"10px 0", color:appsCount>0?C.terracotta:C.textSoft, fontSize:13, fontWeight:appsCount>0?700:500, cursor:"pointer" }}>
          <Icon name="briefcase" size={13} color={appsCount>0?C.terracotta:C.textSoft}/> {appsCount} application{appsCount!==1?"s":""}
        </button>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
// Wraps Carousel inside a JobCard — intercepts horizontal swipes so they scroll
// photos without triggering the card's onClick (which would open the listing).
// Reusable sortable photo grid — arrow buttons to reorder, × to delete, + to add
// photos: array of data URLs or Supabase URLs
// onPhotos: callback with new array
// onAdd: callback when + is tapped (optional — opens file picker)
function SortablePhotoGrid({ photos, onPhotos, onAdd, maxPhotos=5 }) {
  const filled = (photos||[]).filter(Boolean);

  const move = (from, to) => {
    if (to < 0 || to >= filled.length) return;
    const next = [...filled];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onPhotos(next);
  };

  const remove = (i) => {
    const next = filled.filter((_,idx)=>idx!==i);
    onPhotos(next);
  };

  const addFromFile = (e) => {
    const files = Array.from(e.target.files||[]);
    let current = [...filled];
    let pending = files.length;
    files.forEach(file => {
      if (current.length >= maxPhotos) { pending--; return; }
      const r = new FileReader();
      r.onload = ev => {
        current = [...current, ev.target.result];
        pending--;
        if (pending === 0) onPhotos(current);
      };
      r.readAsDataURL(file);
    });
    e.target.value = "";
  };

  return (
    <div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {filled.map((p, i) => (
          <div key={i} style={{ position:"relative", width:60, flexShrink:0 }}>
            {/* Photo thumb */}
            <div style={{ position:"relative", width:60, height:74, borderRadius:9, overflow:"hidden", border:`2px solid ${i===0?C.terracotta:C.border}` }}>
              <img src={p} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
              {i===0 && (
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(196,98,58,0.85)", color:"#fff", fontSize:8, fontWeight:700, textAlign:"center", letterSpacing:1, padding:"2px 0", textTransform:"uppercase" }}>Cover</div>
              )}
              {/* Delete */}
              <button className="tap" onClick={()=>remove(i)}
                style={{ position:"absolute", top:2, right:2, width:18, height:18, borderRadius:"50%", background:"rgba(0,0,0,0.65)", border:"none", color:"#fff", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:2 }}>×</button>
            </div>
            {/* Reorder arrows */}
            {filled.length > 1 && (
              <div style={{ display:"flex", justifyContent:"center", gap:4, marginTop:4 }}>
                <button className="tap" onClick={()=>move(i, i-1)} disabled={i===0}
                  style={{ width:26, height:20, borderRadius:5, background:i===0?C.bgSoft:C.terracottaL, border:`1px solid ${i===0?C.border:C.terracottaM}`, color:i===0?C.textFaint:C.terracotta, fontSize:11, fontWeight:700, cursor:i===0?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
                <button className="tap" onClick={()=>move(i, i+1)} disabled={i===filled.length-1}
                  style={{ width:26, height:20, borderRadius:5, background:i===filled.length-1?C.bgSoft:C.terracottaL, border:`1px solid ${i===filled.length-1?C.border:C.terracottaM}`, color:i===filled.length-1?C.textFaint:C.terracotta, fontSize:11, fontWeight:700, cursor:i===filled.length-1?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
              </div>
            )}
          </div>
        ))}
        {/* Add button */}
        {filled.length < maxPhotos && (
          <label style={{ width:60, height:74, borderRadius:9, border:`1.5px dashed ${C.border}`, background:C.bgSoft, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", gap:3, flexShrink:0 }}>
            <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={addFromFile}/>
            <Icon name="camera" size={18} color={C.textFaint}/>
            <span style={{ fontSize:9, color:C.textFaint, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Add</span>
          </label>
        )}
      </div>
      {filled.length > 0 && <div style={{ color:C.textFaint, fontSize:11, marginTop:7 }}>First photo is the cover · use ‹ › to reorder</div>}
    </div>
  );
}

function CarouselWrapper({ children, onSwipe }) {
  const ref = useRef(null);
  const swipedRef = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onStart = (e) => {
      swipedRef.current = false;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      const dx = Math.abs(e.touches[0].clientX - startX.current);
      const dy = Math.abs(e.touches[0].clientY - startY.current);
      if (dx > 8 && dx > dy) {
        swipedRef.current = true;
        onSwipe && onSwipe();
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
    };
  }, [onSwipe]);

  return (
    <div ref={ref} onClick={e => { if (swipedRef.current) { e.stopPropagation(); swipedRef.current = false; } }}>
      {children}
    </div>
  );
}

function JobCard({ job, currentUser, following, bookmarks, onApply, onExpand, onToggleFollow, onToggleBookmark, onVenueClick }) {
  const emp = getEmp(job);
  const appliedApp = job.apps?.find(a=>a.uid===currentUser?.id);
  const applied = !!appliedApp;
  const isOwnListing = currentUser?.id && job.empId === currentUser.id;
  const isNew = job.ts && (Date.now() - job.ts) < 3*24*60*60*1000;
  const isFollowed = following.includes(job.empId);
  const isBookmarked = bookmarks.includes(job.id);

  return (
    <div style={{ background:"#fff", marginBottom:12, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
      {job.featured && (
        <div style={{ background:C.featuredL, borderBottom:`1px solid ${C.featured}30`, padding:"5px 14px", display:"flex", alignItems:"center", gap:6 }}>
          <Icon name="star" size={12} color={C.featured} fill={C.featured}/><span style={{ color:C.featured, fontSize:11, fontWeight:700 }}>Featured Listing</span>
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", padding:"11px 14px", gap:10 }}>
        <div className="tap" onClick={()=>onVenueClick&&onVenueClick(emp)} style={{ cursor:"pointer" }}>
          <Avatar emp={emp} size={36} fontSize={18}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span className="tap" onClick={()=>onVenueClick&&onVenueClick(emp)} style={{ color:C.textDark, fontWeight:600, fontSize:14, cursor:"pointer" }}>{emp?.name||emp?.handle}</span>
            {job.verified && <span style={{ color:C.blue, fontSize:13 }}>●</span>}
          </div>
          <div style={{ color:C.textSoft, fontSize:11 }}>{job.loc}</div>
        </div>
        <button className="tap" onClick={e=>{e.stopPropagation();onToggleFollow(job.empId);}}
          style={{ background:isFollowed?C.sageL:"#fff", border:`1px solid ${isFollowed?C.sage:C.border}`, borderRadius:8, padding:"5px 12px", color:isFollowed?C.sage:C.textDark, fontSize:12, fontWeight:600, transition:"all 0.18s" }}>
          {isFollowed ? "Following" : "Follow"}
        </button>
        <button className="tap" onClick={e=>{e.stopPropagation(); onExpand(job);}} style={{ background:"none", border:"none", padding:"2px 0 2px 4px" }} title="View full listing"><Icon name="more" size={20} color={C.textSoft}/></button>
      </div>
      <div onClick={()=>onExpand(job)}
        style={{ cursor:"pointer", position:"relative" }}>
        <CarouselWrapper><Carousel photos={job.photos} video={job.video}/></CarouselWrapper>
        {/* New listing badge — top right, 3 days */}
        {isNew && (
          <div style={{ position:"absolute", top:10, right:10, background:C.terracotta, color:"#fff", fontSize:11, fontWeight:700, letterSpacing:0.5, padding:"4px 10px", borderRadius:20, boxShadow:"0 2px 8px rgba(0,0,0,0.25)", zIndex:2 }}>
            New listing
          </div>
        )}
        {/* Applied tick — shows only to the candidate who applied */}
        {applied && (
          <div style={{ position:"absolute", top:10, left:10, background:"rgba(107,143,113,0.95)", color:"#fff", fontSize:11, fontWeight:700, padding:"5px 11px", borderRadius:20, boxShadow:"0 2px 8px rgba(0,0,0,0.25)", zIndex:2, display:"flex", flexDirection:"column", alignItems:"flex-start", lineHeight:1.3 }}>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}>✓ Applied</span>
            {appliedApp?.ts && <span style={{ fontSize:9, fontWeight:500, opacity:0.9 }}>{new Date(appliedApp.ts).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</span>}
          </div>
        )}
      </div>
      <div style={{ padding:"10px 14px 4px", display:"flex", alignItems:"center", gap:12 }}>
        {isOwnListing ? (
          <div style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"7px 16px", color:C.textSoft, fontWeight:600, fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="person" size={13} color={C.textSoft}/> Your listing
          </div>
        ) : (
          <button className="btn-cta tap" onClick={e=>{e.stopPropagation();onApply(job);}}
            style={{ background:applied?C.sageL:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:applied?`1px solid ${C.sage}`:"none", borderRadius:9, padding:"7px 16px", color:applied?C.sage:"#fff", fontWeight:700, fontSize:13, boxShadow:applied?"none":"0 2px 10px rgba(196,98,58,0.2)" }}>
            {applied ? "✓ Applied" : "Apply Now"}
          </button>
        )}
        <div style={{ flex:1 }}/>
        {job.video && <span style={{ background:C.sandL, border:`1px solid ${C.sand}40`, color:C.clay, fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:20, display:"flex", alignItems:"center", gap:3 }}><Icon name="video" size={10} color={C.clay}/>Reel</span>}
        {isOwnListing && <div style={{ display:"flex", alignItems:"center", gap:4, color:C.textFaint, fontSize:11 }}><Icon name="eye" size={14} color={C.textFaint}/>{job.views||0}</div>}
        <button className="tap" onClick={e=>{e.stopPropagation();onToggleBookmark(job.id);}} style={{ background:"none", border:"none", padding:2 }}>
          <Icon name="bookmark" size={22} color={isBookmarked?C.terracotta:C.textSoft} fill={isBookmarked?C.terracotta:"none"}/>
        </button>
      </div>
      <div style={{ padding:"4px 14px 14px" }}>
        {/* Venue name first */}
        <div style={{ color:C.textSoft, fontSize:12, fontWeight:600, marginBottom:3 }}>
          <span className="tap" onClick={()=>onVenueClick&&onVenueClick(emp)} style={{ cursor:"pointer", color:C.textDark }}>{job.venue||emp?.name}</span>
          {job.verified && <span style={{ color:C.blue, fontSize:11, marginLeft:4 }}>● Verified</span>}
        </div>
        {/* Job title */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:20, color:C.textDark }}>{job.title}</span>
          <TypeChip type={job.type}/>
        </div>
        {/* Salary */}
        <div style={{ color:C.sand, fontWeight:600, fontSize:13, marginBottom:6 }}>{job.salary}</div>
        {/* Tags */}
        {(job.tags||[]).length>0 && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
            {job.tags.slice(0,3).map(t=><span key={t} style={{ background:C.bgSoft, border:`1px solid ${C.border}`, color:C.textSoft, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>{t}</span>)}
          </div>
        )}
        {/* Description */}
        <div style={{ color:C.textMid, fontSize:13, lineHeight:1.6 }}>{stripTags(job.short)}</div>
        <div className="tap" onClick={()=>onExpand(job)} style={{ color:C.terracotta, fontSize:13, marginTop:7, cursor:"pointer", fontWeight:600 }}>View full role →</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:5 }}>
          <div style={{ color:C.textFaint, fontSize:11, textTransform:"uppercase", letterSpacing:0.5 }}>{ago(job.ts)} ago</div>
          <CountdownBadge expiresAt={job.expiresAt}/>
        </div>
      </div>
    </div>
  );
}

// ─── Job Detail ───────────────────────────────────────────────────────────────
function JobDetail({ job, currentUser, profile, following, bookmarks, onClose, onApply, onToggleFollow, onToggleBookmark, onVenueClick, openToApply=false }) {
  const emp = getEmp(job);
  const applied = job.apps?.some(a=>a.uid===currentUser?.id);
  const isOwnListing = currentUser?.id && job.empId === currentUser.id;
  const isFollowed = following.includes(job.empId);
  const isBookmarked = bookmarks?.includes(job.id);
  const [showForm, setShowForm] = useState(openToApply && !isOwnListing);
  const [fd, setFd] = useState({ name:currentUser?.name||"", email:currentUser?.email||"", phone:currentUser?.phone||"", msg:"" });
  const [resume, setResume] = useState(profile?.resume||null);
  const [cover, setCover] = useState(profile?.coverLetter||null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Count the view once per open
  useEffect(() => {
    if (job?.id && job.id !== "preview") {
      try { incrementViews(job.id); } catch(e) {}
    }
  }, [job?.id]);

  // Guarded close: confirm if the application form has unsaved content
  const formHasContent = showForm && !done && (fd.msg?.trim() || (fd.screeningAnswers && Object.values(fd.screeningAnswers).some(v=>v?.trim?.())));
  const guardedClose = () => {
    if (formHasContent && !window.confirm("Discard your application? Your answers won't be saved.")) return;
    onClose();
  };

  // ESC closes the modal (with the same guard)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") guardedClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm, done, fd]);

  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 13px", color:C.textDark, fontSize:14 };
  const openForm = () => { setResume(profile?.resume||null); setCover(profile?.coverLetter||null); setShowForm(true); };
  const submit = () => {
    if (!fd.name.trim() || !fd.email.trim() || !fd.email.includes("@")) return;
    onApply(job, {...fd, resume, cover, screeningAnswers: fd.screeningAnswers||{}}); setDone(true);
    setTimeout(()=>{ setShowForm(false); onClose(); }, 1800);
  };
  const isDesktopDetail = typeof window !== 'undefined' && window.innerWidth >= 768;
  return (
    <div onClick={guardedClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:3000, overflow:"hidden", backdropFilter:"blur(3px)", display:"flex", justifyContent:"center", alignItems: isDesktopDetail ? "center" : "flex-end" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth: isDesktopDetail ? 720 : 560, background:C.bg, height: isDesktopDetail ? "90vh" : "100%", maxHeight: isDesktopDetail ? "90vh" : "100vh", margin: isDesktopDetail ? "0 auto" : 0, borderRadius: isDesktopDetail ? 20 : 0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${C.border}`, flexShrink:0, background:"rgba(250,250,248,0.96)", backdropFilter:"blur(10px)", zIndex:10 }}>
          <button className="tap" onClick={guardedClose} style={{ background:"none", border:"none", marginRight:10, padding:4 }}><Icon name="back" size={22} color={C.textDark}/></button>
          <div style={{ flex:1 }}>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600 }}>{job.venue||emp?.name}</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:17, color:C.textDark }}>{job.title}</div>
          </div>
          <button className="tap" onClick={()=>onToggleFollow&&onToggleFollow(job.empId)}
            style={{ background:isFollowed?C.sageL:"#fff", border:`1px solid ${isFollowed?C.sage:C.border}`, borderRadius:8, padding:"5px 12px", color:isFollowed?C.sage:C.textDark, fontSize:12, fontWeight:600 }}>
            {isFollowed ? "Following" : "Follow"}
          </button>
          {onToggleBookmark && <button className="tap" onClick={()=>onToggleBookmark(job.id)} style={{ background:"none", border:"none", marginLeft:8, padding:2 }}><Icon name="bookmark" size={22} color={isBookmarked?C.terracotta:C.textSoft} fill={isBookmarked?C.terracotta:"none"}/></button>}
          <button className="tap" onClick={guardedClose} title="Close" style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:"50%", width:32, height:32, marginLeft:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", fontSize:18, color:C.textMid, lineHeight:1, padding:0 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
        <Carousel photos={job.photos} video={job.video} height={isDesktopDetail ? 420 : 255}/>
        <div style={{ padding:"18px 18px 50px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div className="tap" onClick={()=>onVenueClick&&onVenueClick(emp)} style={{ cursor:"pointer" }}><Avatar emp={emp} size={44} fontSize={20}/></div>
            <div style={{ cursor:"pointer", flex:1 }} onClick={()=>onVenueClick&&onVenueClick(emp)}>
              <div style={{ color:C.textDark, fontWeight:700, fontSize:15, display:"flex", alignItems:"center", gap:5 }}>{job.venue||emp?.name} {job.verified&&<span style={{ color:C.blue, fontSize:12 }}>●</span>}</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:20, color:C.textDark, marginTop:2 }}>{job.title}</div>
              <div style={{ color:C.textSoft, fontSize:12, marginTop:2 }}>{emp?.bio}</div>
            </div>
            {job.verified && <span style={{ marginLeft:"auto", color:C.sage, fontSize:11, border:`1px solid ${C.sage}`, borderRadius:20, padding:"3px 9px", fontWeight:600 }}>Verified</span>}
          </div>
          {job.featured && <div style={{ display:"flex", alignItems:"center", gap:6, background:C.featuredL, border:`1px solid ${C.featured}30`, borderRadius:10, padding:"8px 12px", marginBottom:14 }}><Icon name="star" size={14} color={C.featured} fill={C.featured}/><span style={{ color:C.featured, fontWeight:600, fontSize:13 }}>Featured Listing</span></div>}
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:C.textDark, lineHeight:1.2, marginBottom:6 }}>{job.title}</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ color:C.sand, fontWeight:700, fontSize:14 }}>{job.salary}</span>
            <span style={{ width:3, height:3, borderRadius:"50%", background:C.textFaint, display:"inline-block" }}/>
            <TypeChip type={job.type}/>
            <span style={{ color:C.textFaint, fontSize:12 }}>· {job.loc}</span>
            <CountdownBadge expiresAt={job.expiresAt} style={{ marginLeft:"auto" }}/>
          </div>
          {(job.tags||[]).length>0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
              {job.tags.map(t=><span key={t} style={{ background:C.bgSoft, border:`1px solid ${C.border}`, color:C.textSoft, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>{t}</span>)}
            </div>
          )}
          {job.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 12px", background:C.bgSoft, borderRadius:10, marginBottom:16, border:`1px solid ${C.border}`, textDecoration:"none" }}>
              <Icon name="pin" size={15} color={C.terracotta}/>
              <span style={{ color:C.textMid, fontSize:13 }}>{job.address}</span>
              <span style={{ marginLeft:"auto", color:C.terracotta, fontSize:11, fontWeight:600 }}>Map ↗</span>
            </a>
          )}
          {isOwnListing && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:C.bgSoft, borderRadius:10, marginBottom:18, border:`1px solid ${C.border}` }}>
              <Icon name="eye" size={15} color={C.textSoft}/><span style={{ color:C.textSoft, fontSize:12 }}>{job.views||0} views</span>
              <span style={{ color:C.textFaint }}>·</span>
              <Icon name="briefcase" size={15} color={C.textSoft}/><span style={{ color:C.textSoft, fontSize:12 }}>{job.apps?.length||0} applications</span>
            </div>
          )}
          <div style={{ color:C.textMid, fontSize:14, lineHeight:1.75, borderTop:`1px solid ${C.border}`, paddingTop:16, marginBottom:24 }} dangerouslySetInnerHTML={{ __html: descToHtml(job.full) }}/>
          {!showForm && !done && isOwnListing && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", background:C.sandL, borderRadius:13, border:`1px solid ${C.sand}40` }}>
              <Icon name="eye" size={18} color={C.clay}/>
              <div>
                <div style={{ color:C.textDark, fontSize:14, fontWeight:700 }}>This is your listing</div>
                <div style={{ color:C.textSoft, fontSize:12, marginTop:1 }}>This is how candidates see it. Manage it from My Listings.</div>
              </div>
            </div>
          )}
          {!showForm && !done && !isOwnListing && (() => {
            const hasLink     = job.link && job.link.trim() && job.link.trim() !== "#";
            const hasEmail    = job.applyEmail && job.applyEmail.trim();
            const showBoth    = hasLink && hasEmail;
            return (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(profile?.resume||profile?.coverLetter) && !applied && !showBoth && (
                <div style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 12px", background:C.sageL, borderRadius:10, border:`1px solid ${C.sage}30` }}>
                  <span>📎</span><div style={{ color:C.textMid, fontSize:13 }}>Your saved documents will auto-attach when applying via HospoSearch</div>
                </div>
              )}

              {applied ? (
                /* Already applied — show status + option to reapply */
                <div style={{ borderRadius:13, border:`1px solid ${C.sage}40`, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", background:C.sageL }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:C.sage, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Icon name="check" size={14} color="#fff"/>
                    </div>
                    <div>
                      <div style={{ color:C.sage, fontWeight:700, fontSize:14 }}>You've already applied</div>
                      {appliedApp?.ts && <div style={{ color:C.textSoft, fontSize:12 }}>Submitted {new Date(appliedApp.ts).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}</div>}
                    </div>
                  </div>
                  <button className="tap" onClick={openForm}
                    style={{ width:"100%", background:"#fff", border:"none", borderTop:`1px solid ${C.border}`, padding:"12px 16px", color:C.terracotta, fontWeight:600, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    <Icon name="edit" size={15} color={C.terracotta}/> Apply again with a new application
                  </button>
                </div>
              ) : showBoth ? (
                /* Both link and email — HospoSearch is the hero, website is secondary */
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <button className="btn-cta tap" onClick={openForm}
                    style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:13, padding:"16px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:"0 4px 16px rgba(196,98,58,0.35)", display:"flex", alignItems:"center", justifyContent:"center", gap:9 }}>
                    <Icon name="briefcase" size={18} color="#fff"/>
                    Apply via HospoSearch
                  </button>
                  <div style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 12px", background:C.sageL, borderRadius:10, border:`1px solid ${C.sage}30` }}>
                    <span>📎</span>
                    <div style={{ color:C.textMid, fontSize:12 }}>Your résumé & cover letter attach automatically</div>
                  </div>
                  <a href={job.link} target="_blank" rel="noreferrer"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px 0", borderRadius:13, background:"#fff", border:`1px solid ${C.border}`, color:C.textSoft, fontSize:13, fontWeight:600, textDecoration:"none" }}>
                    Or apply on their website ↗
                  </a>
                </div>
              ) : hasLink ? (
                /* Link only — apply externally */
                <a href={job.link} target="_blank" rel="noreferrer" className="btn-cta tap"
                  style={{ display:"block", textAlign:"center", padding:"15px 0", borderRadius:13, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, color:"#fff", textDecoration:"none", fontSize:15, fontWeight:700, boxShadow:"0 4px 14px rgba(196,98,58,0.22)" }}>
                  Apply on venue website ↗
                </a>
              ) : (
                /* Email only — apply via HospoSearch */
                <button className="btn-cta tap" onClick={openForm}
                  style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:13, padding:"15px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:"0 4px 14px rgba(196,98,58,0.22)" }}>
                  Apply via HospoSearch
                </button>
              )}
            </div>
            );
          })()}
          {showForm && !done && (
            <div style={{ background:"#fff", borderRadius:16, padding:20, border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, color:C.textDark, fontWeight:700, marginBottom:3 }}>Your Application</div>
              <div style={{ color:C.textSoft, fontSize:13, marginBottom:14 }}>For <strong style={{ color:C.textDark }}>{job.title}</strong> at {job.venue}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* Name */}
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Full Name *</div>
                  <input value={fd.name} onChange={e=>setFd(f=>({...f,name:e.target.value}))} placeholder="Your full name" style={IS}/>
                </div>

                {/* Contact email */}
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Email *</div>
                  <input value={fd.email} onChange={e=>setFd(f=>({...f,email:e.target.value}))} placeholder="you@email.com" type="email" style={IS}/>
                </div>

                {/* Contact phone */}
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Phone <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional)</span></div>
                  <input value={fd.phone} onChange={e=>setFd(f=>({...f,phone:e.target.value}))} placeholder="04xx xxx xxx" type="tel" style={IS}/>
                </div>

                {/* Cover note */}
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Cover Note <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional)</span></div>
                  <textarea value={fd.msg} onChange={e=>setFd(f=>({...f,msg:e.target.value}))} placeholder="Introduce yourself briefly…" rows={3} style={{...IS,resize:"none"}}/>
                </div>

                {/* Documents */}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                  <div style={{ color:C.textDark, fontSize:13, fontWeight:600, marginBottom:9 }}>📎 Documents</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                    <FileZone label="Résumé" icon="📋" file={resume} onFile={f=>setResume(f)} onRemove={()=>setResume(null)}/>
                    <FileZone label="Cover Letter" icon="✉️" file={cover} onFile={f=>setCover(f)} onRemove={()=>setCover(null)}/>
                  </div>
                </div>

                {/* Right to work */}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                  <div style={{ color:C.textDark, fontSize:13, fontWeight:600, marginBottom:5 }}>🛂 Right to Work</div>
                  <div style={{ color:C.textSoft, fontSize:12, marginBottom:9 }}>Which best describes your right to work in {job.country||"this country"}?</div>
                  <select value={fd.visa||""} onChange={e=>setFd(f=>({...f,visa:e.target.value}))} style={IS}>
                    <option value="">Select your visa / work status…</option>
                    {(VISA_OPTIONS[job.country]||VISA_OPTIONS["default"]).map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                {/* Availability */}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                  <div style={{ color:C.textDark, fontSize:13, fontWeight:600, marginBottom:5 }}>📅 Availability</div>
                  <div style={{ color:C.textSoft, fontSize:12, marginBottom:9 }}>Which days are you available to work?</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {DAYS_OF_WEEK.map(day=>{
                      const sel = (fd.availability||[]).includes(day);
                      return (
                        <button key={day} type="button" className="tap" onClick={()=>setFd(f=>({ ...f, availability: sel ? (f.availability||[]).filter(d=>d!==day) : [...(f.availability||[]), day] }))}
                          style={{ background:sel?C.terracotta:"#fff", border:`1.5px solid ${sel?C.terracotta:C.border}`, borderRadius:20, padding:"6px 13px", color:sel?"#fff":C.textMid, fontSize:12, fontWeight:sel?600:400, transition:"all 0.15s" }}>
                          {day.slice(0,3)}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ color:C.textSoft, fontSize:12, marginTop:10, marginBottom:6 }}>Preferred hours:</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {["Full-time","Part-time","Casual / On-call","Weekends only","Evenings only","Public holidays"].map(h=>{
                      const sel = (fd.hours||[]).includes(h);
                      return (
                        <button key={h} type="button" className="tap" onClick={()=>setFd(f=>({ ...f, hours: sel ? (f.hours||[]).filter(x=>x!==h) : [...(f.hours||[]), h] }))}
                          style={{ background:sel?C.sage:"#fff", border:`1.5px solid ${sel?C.sage:C.border}`, borderRadius:20, padding:"5px 12px", color:sel?"#fff":C.textMid, fontSize:11, fontWeight:sel?600:400, transition:"all 0.15s" }}>
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Screening questions from employer */}
                {job.screeningQ && (Object.keys(job.screeningQ).filter(k=>k!=="custom"&&job.screeningQ[k]).length > 0 || (job.screeningQ.custom||[]).length > 0) && (() => {
                  const SCREENING_LABELS = {
                    rightToWork:        'Right to work in this country?',
                    yearsExperience:    'Years of hospitality experience?',
                    noticePeriod:       'Notice period / when can you start?',
                    policeCheck:        'Do you have a current police check?',
                    availableWeekends:  'Available to work weekends?',
                    availablePublicHols:'Available to work public holidays?',
                    driverLicence:      'Do you hold a current driver\'s licence?',
                    willingToRelocate:  'Willing to relocate?',
                    relocate:           'Willing to relocate?',
                    availablePublicHolidays: 'Available to work public holidays?',
                  };
                  const activeQ = Object.keys(job.screeningQ).filter(k=>k!=="custom"&&job.screeningQ[k]);
                  const customQ = job.screeningQ.custom||[];
                  return (
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                      <div style={{ color:C.textDark, fontSize:13, fontWeight:600, marginBottom:5 }}>📋 Screening Questions</div>
                      <div style={{ color:C.textSoft, fontSize:12, marginBottom:12 }}>{job.venue} would like to know:</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                        {activeQ.map(key=>(
                          <div key={key}>
                            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>{SCREENING_LABELS[key]||key}</div>
                            <input
                              value={(fd.screeningAnswers||{})[key]||""}
                              onChange={e=>setFd(f=>({...f, screeningAnswers:{...(f.screeningAnswers||{}), [key]:e.target.value}}))}
                              placeholder="Your answer…"
                              style={IS}
                            />
                          </div>
                        ))}
                        {customQ.map((q,i)=>(
                          <div key={`custom_${i}`}>
                            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>✏️ {q}</div>
                            <input
                              value={(fd.screeningAnswers||{})[`custom_${i}`]||""}
                              onChange={e=>setFd(f=>({...f, screeningAnswers:{...(f.screeningAnswers||{}), [`custom_${i}`]:e.target.value}}))}
                              placeholder="Your answer…"
                              style={IS}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Notice period */}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                  <div style={{ color:C.textDark, fontSize:13, fontWeight:600, marginBottom:5 }}>⏱️ Notice Period</div>
                  <div style={{ color:C.textSoft, fontSize:12, marginBottom:9 }}>How much notice do you need to give your current employer?</div>
                  <select value={fd.notice||""} onChange={e=>setFd(f=>({...f,notice:e.target.value}))} style={IS}>
                    <option value="">Select…</option>
                    {NOTICE_PERIODS.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {/* Buttons */}
                <div style={{ display:"flex", gap:9, paddingTop:4 }}>
                  <button className="tap" onClick={()=>setShowForm(false)} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 0", color:C.textMid, fontSize:14 }}>Cancel</button>
                  <button className="btn-cta tap" onClick={submit} disabled={submitting}
                    style={{ flex:2, background:submitting?"#999":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:submitting?"none":"0 3px 10px rgba(196,98,58,0.22)" }}>
                    {submitting ? "⏳ Uploading…" : "Submit Application"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {done && (
            <div style={{ textAlign:"center", padding:"28px 0" }}>
              <div style={{ width:66, height:66, borderRadius:"50%", background:C.sageL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 14px", border:`2px solid ${C.sage}` }}>🎉</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:21, color:C.textDark, fontWeight:700, marginBottom:5 }}>Application Sent!</div>
              <div style={{ color:C.textSoft, fontSize:14 }}>{job.venue} will be in touch.</div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
// ─── Public Browse (no login required) ───────────────────────────────────────
function PublicBrowse({ jobs, onLogin, onSignup, initialSearch="" }) {
  const [expandedJob, setExpandedJob] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pubSearch, setPubSearch] = useState(initialSearch);
  const isDesktop = useIsDesktop();

  // ESC closes the preview
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setExpandedJob(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Count public views too
  useEffect(() => {
    if (expandedJob?.id) { try { incrementViews(expandedJob.id); } catch(e) {} }
  }, [expandedJob?.id]);

  const pubFiltered = pubSearch.trim() ? smartSearch(jobs.filter(j=>j&&j.id&&j.title), pubSearch) : jobs.filter(j=>j&&j.id&&j.title);

  const handleExpand = (job) => {
    setExpandedJob(job);
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden" }}>
      <style>{G}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, background:"#fff", flexShrink:0 }}>
        <a href="/" style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:22, color:C.textDark, flex:1, textDecoration:"none", cursor:"pointer" }}>
          <span style={{ color:C.terracotta }}>Hospo</span>Search
        </a>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onLogin} className="tap"
            style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:100, padding:"8px 18px", color:C.textDark, fontSize:13, fontWeight:600 }}>
            Log in
          </button>
          <button onClick={onSignup||onLogin} className="btn-cta tap"
            style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:100, padding:"8px 18px", color:"#fff", fontSize:13, fontWeight:700, boxShadow:"0 2px 8px rgba(196,98,58,0.25)" }}>
            Sign up free
          </button>
        </div>
      </div>

      {/* Job grid */}
      <div style={{ flex:1, overflowY:"auto", padding:isDesktop?"20px":"12px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          {/* Hero text + search */}
          <div style={{ textAlign:"center", padding:isDesktop?"24px 0 28px":"16px 0 20px" }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:isDesktop?36:24, fontWeight:700, color:C.textDark, marginBottom:8 }}>
              Find your next great <em style={{ color:C.terracotta }}>hospitality role</em>
            </div>
            <div style={{ color:C.textSoft, fontSize:15, marginBottom:20 }}>{jobs.length} roles across Australia, New Zealand & beyond</div>
            {/* Search bar */}
            <div style={{ maxWidth:520, margin:"0 auto", position:"relative" }}>
              <div style={{ display:"flex", alignItems:"center", background:"#fff", border:`2px solid ${pubSearch?C.terracotta:C.border}`, borderRadius:100, padding:"10px 16px", gap:10, boxShadow:"0 2px 12px rgba(0,0,0,0.08)", transition:"border-color 0.2s" }}>
                <Icon name="search" size={20} color={pubSearch?C.terracotta:C.textSoft}/>
                <input
                  value={pubSearch}
                  onChange={e=>setPubSearch(e.target.value)}
                  placeholder="Search roles — Chef, Sommelier, Floor Manager…"
                  style={{ flex:1, border:"none", background:"transparent", fontSize:15, color:C.textDark, outline:"none" }}
                />
                {pubSearch && (
                  <button onClick={()=>setPubSearch("")} style={{ background:"none", border:"none", color:C.textSoft, fontSize:18, cursor:"pointer", padding:0, lineHeight:1 }}>×</button>
                )}
              </div>
              {pubSearch && pubFiltered.length > 0 && (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"#fff", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", border:`1px solid ${C.border}`, overflow:"hidden", zIndex:10 }}>
                  <div style={{ padding:"8px 14px", background:C.terracottaL, borderBottom:`1px solid ${C.terracottaM}`, color:C.terracotta, fontSize:12, fontWeight:600 }}>
                    {pubFiltered.length} role{pubFiltered.length!==1?"s":""} found for "{pubSearch}"
                  </div>
                </div>
              )}
            </div>
            {pubSearch && (
              <div style={{ color:C.textSoft, fontSize:13, marginTop:10 }}>
                {pubFiltered.length === 0
                  ? `No roles found for "${pubSearch}"`
                  : `Showing ${pubFiltered.length} result${pubFiltered.length!==1?"s":""} for "${pubSearch}"`}
              </div>
            )}
          </div>

          {/* Location quick-filter bar */}
          {(() => {
            const locs = [...new Set(jobs.filter(j=>j&&j.country).map(j=>j.country))].slice(0,8);
            return locs.length > 0 ? (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", marginBottom:16 }}>
                {["All",...locs].map(loc=>(
                  <button key={loc} className="tap" onClick={()=>setPubSearch(loc==="All"?"":loc)}
                    style={{ background:(pubSearch===loc||(loc==="All"&&!pubSearch))?"#C4623A":"#fff", border:(pubSearch===loc||(loc==="All"&&!pubSearch))?"none":"1px solid #E8E3DC", borderRadius:20, padding:"6px 14px", color:(pubSearch===loc||(loc==="All"&&!pubSearch))?"#fff":"#555", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    {loc}
                  </button>
                ))}
              </div>
            ) : null;
          })()}

          {/* Grid */}
          <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr", gap:isDesktop?16:12 }}>
            {pubFiltered.filter(j=>j&&j.id&&j.title).map((j,i)=>{
              const first = j.video||j.photos?.[0];
              const hm = isData(first);
              const pbg = PBG[typeof j.photos?.[0]==="number"?j.photos[0]%PBG.length:i%PBG.length];
              const emp = getEmp(j);
              return (
                <div key={j.id} style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="none"; }}>
                  {/* Swipeable photo carousel — no login needed */}
                  <div className="tap" onClick={()=>handleExpand(j)} style={{ display:"block", cursor:"pointer" }}>
                    <CarouselWrapper onSwipe={()=>{ try { incrementViews(j.id); } catch(e){} }}>
                      <Carousel photos={j.photos} video={j.video}/>
                    </CarouselWrapper>
                  </div>
                  {/* Text — tap to open */}
                  <div className="tap" onClick={()=>handleExpand(j)} style={{ padding:"12px 14px 14px", cursor:"pointer" }}>
                    <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, marginBottom:3 }}>{j.venue||emp?.name}</div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:17, color:C.textDark, marginBottom:4, lineHeight:1.2 }}>{j.title}</div>
                    <div style={{ color:C.sand, fontWeight:600, fontSize:13, marginBottom:8 }}>{j.salary}</div>
                    <div style={{ color:C.textMid, fontSize:13, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:10 }}>{stripTags(j.short)}</div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ color:C.textFaint, fontSize:11 }}>{j.loc} · {ago(j.ts)} ago</div>
                      <div style={{ color:C.terracotta, fontSize:12, fontWeight:600 }}>View role →</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expanded job — shows preview, prompts login to apply */}
      {expandedJob && (
        <div onClick={()=>setExpandedJob(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent:"center", backdropFilter:"blur(4px)", padding: isDesktop ? 20 : 0 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius: isDesktop ? 20 : "22px 22px 0 0", width:"100%", maxWidth:560, height: isDesktop ? "88vh" : "92vh", maxHeight: isDesktop ? "88vh" : "92vh", overflow:"hidden", position:"relative", display:"flex", flexDirection:"column" }}>

            {/* Fixed header bar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid ${C.border}`, flexShrink:0, background:"#fff", zIndex:10 }}>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{expandedJob.venue}</div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:700, color:C.textDark, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{expandedJob.title}</div>
              </div>
              <button className="tap" onClick={()=>setExpandedJob(null)} title="Close" style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18, color:C.textMid, lineHeight:1, padding:0, flexShrink:0, marginLeft:10 }}>×</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
              {/* Photo */}
              {(expandedJob.photos?.length > 0 || expandedJob.video) && (
                <Carousel photos={expandedJob.photos||[]} video={expandedJob.video} height={isDesktop ? 320 : 240}/>
              )}

              <div style={{ padding:"16px 18px 24px" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:700, color:C.textDark, marginBottom:6 }}>{expandedJob.title}</div>
                <div style={{ color:C.sand, fontWeight:700, fontSize:15, marginBottom:10 }}>{expandedJob.salary}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                  {[expandedJob.type, expandedJob.loc, ...(expandedJob.tags||[]).slice(0,2)].filter(Boolean).map(t=>(
                    <span key={t} style={{ background:C.bgSoft, border:`1px solid ${C.border}`, color:C.textSoft, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>{t}</span>
                  ))}
                </div>
                <div style={{ color:C.textMid, fontSize:14, lineHeight:1.7, marginBottom:14 }} dangerouslySetInnerHTML={{ __html: descToHtml(expandedJob.short) }}/>

                {/* Full description */}
                {expandedJob.full && expandedJob.full !== expandedJob.short && (
                  <div style={{ color:C.textMid, fontSize:14, lineHeight:1.7, marginBottom:20 }} dangerouslySetInnerHTML={{ __html: descToHtml(expandedJob.full) }}/>
                )}

                {/* Apply gate */}
                <div style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:14, padding:"16px", textAlign:"center" }}>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:700, color:C.textDark, marginBottom:6 }}>Apply for this role</div>
                  <div style={{ color:C.textSoft, fontSize:13, marginBottom:14 }}>Create a free account to apply in seconds</div>
                  <button onClick={onSignup||onLogin} className="btn-cta tap"
                    style={{ width:"100%", background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:12, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:"0 4px 14px rgba(196,98,58,0.25)", marginBottom:10 }}>
                    Apply via HospoSearch →
                  </button>
                  {expandedJob.link && expandedJob.link.trim() && expandedJob.link.trim() !== "#" && (
                    <a href={expandedJob.link} target="_blank" rel="noreferrer"
                      style={{ display:"block", color:C.textMid, fontSize:13, fontWeight:600, textDecoration:"none", padding:"8px 0" }}>
                      Or apply on their website ↗
                    </a>
                  )}
                  <button onClick={onLogin} style={{ background:"none", border:"none", color:C.textFaint, fontSize:12, cursor:"pointer", marginTop:4 }}>
                    Already have an account? Log in →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Login({ onLogin, onClose, defaultScreen="login", defaultMode="employee" }) {
  useEffect(()=>{
    const handler = () => {};
    document.addEventListener('hs-show-login', handler);
    return () => document.removeEventListener('hs-show-login', handler);
  }, []);
  const [screen, setScreen] = useState(defaultScreen); // login | signup
  const [mode, setMode] = useState(defaultMode);
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState("");
  // Sign up fields
  const [su, setSu] = useState({ name:"", email:"", pass:"", pass2:"", mode:defaultMode });
  const [suErr, setSuErr] = useState("");
  const [suDone, setSuDone] = useState(false);

  const go = async () => {
    setErr("");
    // Check hardcoded admin first
    if (email===ADMIN.email&&pass===ADMIN.password) { onLogin(ADMIN,"admin"); return; }
    // Check hardcoded trial account
    const trial = EMPLOYERS.find(e=>e.isTrial&&e.email===email&&e.password===pass);
    if (trial) { onLogin(trial,"employer"); return; }
    // Check demo accounts — detect wrong account type and give helpful message
    const wrongPool = mode==="employer"?EMPLOYEES:EMPLOYERS;
    const wrongType = wrongPool.find(u=>u.email===email&&u.password===pass);
    if (wrongType) {
      const correctType = mode==="employer"?"Job Seeker":"Employer";
      setErr(`This account is registered as a ${correctType}. Please switch the toggle above.`);
      return;
    }
    const pool = mode==="employer"?EMPLOYERS:EMPLOYEES;
    const demoUser = pool.find(u=>u.email===email&&u.password===pass);
    if (demoUser) { onLogin(demoUser, mode); return; }
    // Try Supabase auth — logs in regardless of mode toggle, uses account's actual type
    try {
      const { profile } = await signIn(email, pass);
      if (profile) {
        const accountType = profile.type === 'employer' ? 'employer' : 'employee';
        // If they picked the wrong toggle, show helpful message
        if (mode === 'employer' && accountType === 'employee') {
          setErr("This account is registered as a Job Seeker. Switch the toggle to Job Seeker to log in.");
          return;
        }
        if (mode === 'employee' && accountType === 'employer') {
          setErr("This account is registered as an Employer. Switch the toggle to Employer to log in.");
          return;
        }
        onLogin(profile, accountType);
        return;
      }
    } catch(e) {
      setErr("Incorrect email or password.");
    }
  };

  const signUp = async () => {
    setSuErr("");
    if (!su.name.trim()) { setSuErr("Please enter your name."); return; }
    if (!su.email.includes("@")) { setSuErr("Please enter a valid email."); return; }
    if (su.pass.length < 6) { setSuErr("Password must be at least 6 characters."); return; }
    if (su.pass !== su.pass2) { setSuErr("Passwords don't match."); return; }
    try {
      const { profile } = await sbSignUp(su.email, su.pass, su.name, su.mode);
      setSuDone(true);
      setTimeout(()=>{ onLogin(profile, su.mode); }, 1400);
    } catch(e) {
      // If Supabase signup fails (e.g. email already exists), fall back to session account
      if (e.message?.includes('already')) {
        setSuErr("An account with this email already exists. Please log in.");
      } else {
        // Create session-only account as fallback
        const newUser = {
          id: "new_" + Date.now(),
          email: su.email,
          name: su.name,
          handle: su.name.toLowerCase().replace(/\s+/g,"_"),
          avatar: su.mode==="employer" ? "🍽️" : "👨‍🍳",
          role: su.mode==="employer" ? "" : "Hospitality Professional",
          type: su.mode,
          verified: false,
          bio: "",
          ...(su.mode==="employer" ? { cuisine:"", venue_size:"", awards:[] } : { experience:"", cuisine_tags:[], location:"", available:true, skills:[], work_history:[], portfolio_photos:[] }),
        };
        setSuDone(true);
        setTimeout(()=>{ onLogin(newUser, su.mode); }, 1400);
      }
    }
  };

  const demo = t => { if(t==="employer"){setEmail("hire@attica.com.au");setPass("pass123");setMode("employer");}else{setEmail("chef@gmail.com");setPass("pass123");setMode("employee");} };
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"13px 14px", color:C.textDark, fontSize:15 };
  return (
    <div style={{ minHeight:"100vh", height:"100%", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", overflow:"auto", position:"relative" }}>
      {onClose && (
        <button onClick={onClose} style={{ position:"fixed", top:16, left:16, display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.textSoft, fontSize:14, fontWeight:600, cursor:"pointer", padding:"8px 12px", borderRadius:20, transition:"background 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.background=C.bgSoft}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <span style={{ fontSize:18 }}>←</span> Back to jobs
        </button>
      )}
      <style>{G}</style>
      <div style={{ position:"fixed", top:-80, right:-80, width:240, height:240, borderRadius:"50%", background:`radial-gradient(circle,${C.terracottaM},transparent 70%)`, opacity:0.5, pointerEvents:"none" }}/>
      <div style={{ position:"fixed", bottom:-60, left:-60, width:200, height:200, borderRadius:"50%", background:`radial-gradient(circle,${C.sageL},transparent 70%)`, pointerEvents:"none" }}/>
      <div style={{ width:"100%", maxWidth:380, position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 14px", boxShadow:`0 6px 18px ${C.terracottaM}` }}>🍽️</div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, color:C.textDark, letterSpacing:-0.5 }}><span style={{ color:C.terracotta }}>Hospo</span>Search</div>
          <div style={{ color:C.textFaint, fontSize:11, marginTop:5, letterSpacing:2.5, textTransform:"uppercase", fontWeight:500 }}>Hospitality Jobs · ANZ</div>
        </div>

        {/* ── Sign Up Screen ── */}
        {screen==="signup" && (
          <div>
            {suDone ? (
              <div style={{ textAlign:"center", padding:"32px 0" }}>
                <div style={{ width:66, height:66, borderRadius:"50%", background:C.sageL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 14px", border:`2px solid ${C.sage}` }}>🎉</div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:C.textDark, fontWeight:700, marginBottom:6 }}>Welcome to HospoSearch!</div>
                <div style={{ color:C.textSoft, fontSize:14 }}>Setting up your account…</div>
              </div>
            ) : (
              <div style={{ background:"#fff", borderRadius:20, padding:24, boxShadow:"0 2px 24px rgba(0,0,0,0.08)", border:`1px solid ${C.border}` }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark, marginBottom:16 }}>Create Account</div>
                <div style={{ display:"flex", background:C.bgSoft, borderRadius:12, padding:3, marginBottom:20, border:`1px solid ${C.border}` }}>
                  {[["employee","👨‍🍳 Job Seeker"],["employer","🍽️ Employer"]].map(([m,l])=>(
                    <button key={m} onClick={()=>setSu(s=>({...s,mode:m}))} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, background:su.mode===m?"#fff":"transparent", color:su.mode===m?C.terracotta:C.textSoft, fontWeight:su.mode===m?600:400, fontSize:13, boxShadow:su.mode===m?"0 1px 5px rgba(0,0,0,0.07)":"none", transition:"all 0.18s" }}>{l}</button>
                  ))}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
                  <input value={su.name} onChange={e=>setSu(s=>({...s,name:e.target.value}))} placeholder={su.mode==="employer"?"Venue / Business name":"Your full name"} style={IS}/>
                  <input value={su.email} onChange={e=>setSu(s=>({...s,email:e.target.value}))} placeholder="Email address" type="email" style={IS}/>
                  <input value={su.pass} onChange={e=>setSu(s=>({...s,pass:e.target.value}))} placeholder="Password (min. 6 characters)" type="password" style={IS}/>
                  <input value={su.pass2} onChange={e=>setSu(s=>({...s,pass2:e.target.value}))} placeholder="Confirm password" type="password" onKeyDown={e=>e.key==="Enter"&&signUp()} style={IS}/>
                  {suErr && <div style={{ color:C.error, fontSize:13, background:"#FEF2F0", border:"1px solid #F5C4BE", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>{suErr}</div>}
                  <button className="btn-cta tap" onClick={signUp} style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:12, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:"0 4px 14px rgba(196,98,58,0.22)", marginTop:2 }}>Create Account</button>
                </div>
                <div style={{ textAlign:"center", marginTop:16, color:C.textFaint, fontSize:13 }}>
                  Already have an account? <span onClick={()=>setScreen("login")} style={{ color:C.terracotta, fontWeight:600, cursor:"pointer" }}>Log in</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Login Screen ── */}
        {screen==="login" && <>
        <div style={{ background:"#fff", borderRadius:20, padding:24, boxShadow:"0 2px 24px rgba(0,0,0,0.08)", border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", background:C.bgSoft, borderRadius:12, padding:3, marginBottom:20, border:`1px solid ${C.border}` }}>
            {[["employee","Job Seeker"],["employer","Employer"]].map(([m,l])=>(
              <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, background:mode===m?"#fff":"transparent", color:mode===m?C.terracotta:C.textSoft, fontWeight:mode===m?600:400, fontSize:14, boxShadow:mode===m?"0 1px 5px rgba(0,0,0,0.07)":"none", transition:"all 0.18s" }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" style={IS}/>
            <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" type="password" onKeyDown={e=>e.key==="Enter"&&go()} style={IS}/>
            {err && <div style={{ color:C.error, fontSize:13, background:"#FEF2F0", border:"1px solid #F5C4BE", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>{err}</div>}
            <button className="btn-cta tap" onClick={go} style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:12, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:"0 4px 14px rgba(196,98,58,0.22)", marginTop:2 }}>Log In</button>
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:16, color:C.textFaint, fontSize:12 }}>
          Don't have an account? <span onClick={()=>setScreen("signup")} style={{ color:C.terracotta, fontWeight:600, cursor:"pointer" }}>Sign up</span>
        </div>
        </>}

      </div>
    </div>
  );
}

// ─── Stripe Checkout ──────────────────────────────────────────────────────────
function StripeCheckout({ jobDraft, onSuccess, onCancel, codes, setCodes, isFeatured, tierKey="bronze", tierPrice=50, tierPriceId="price_1TfwBfGkG9EGtGJgBv341e2n", user=null }) {
  const basePrice = tierPrice;
  const tierLabel = tierKey==='gold' ? '🥇 Gold Premium listing' : tierKey==='silver' ? '🥈 Silver Featured listing' : '🥉 Bronze Standard listing';

  const [codeInput, setCodeInput]     = useState("");
  const [appliedCode, setAppliedCode] = useState(null);
  const [codeErr, setCodeErr]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");
  const [captureEmail, setCaptureEmail] = useState(user?.email||"");
  const [emailCaptured, setEmailCaptured] = useState(false);

  // Notify hello@hosposearch.com.au when employer enters email but hasn't paid
  const notifyAbandoned = async (email) => {
    if (!email || !email.includes('@') || emailCaptured) return;
    setEmailCaptured(true);
    try {
      await fetch('/api/notify-abandoned', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ email, jobTitle:jobDraft?.title||'', tier:tierKey }),
      });
    } catch(e) {}
  };

  const discount   = appliedCode ? Math.round(basePrice * (appliedCode.pct/100)) : 0;
  const subtotal   = basePrice - discount;
  const gst        = Math.round(subtotal * 0.1);
  const total      = subtotal + gst;

  const applyCode = () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    const found = codes?.[code];
    if (!found) { setCodeErr("Code not found."); return; }
    if (!found.active) { setCodeErr("This code is no longer active."); return; }
    if (found.used >= found.uses) { setCodeErr("This code has reached its usage limit."); return; }
    if (new Date(found.expires) < new Date()) { setCodeErr("This code has expired."); return; }
    setAppliedCode({ ...found, code });
    setCodeErr("");
  };

  const removeCode = () => { setAppliedCode(null); setCodeInput(""); setCodeErr(""); };

  const pay = async () => {
    setLoading(true);
    setErr("");
    try {
      const url = await createCheckoutSession(
        tierKey,
        jobDraft?.title || '',
        user?.email || '',
        jobDraft?.id || ''
      );
      window.location.href = url;
    } catch(e) {
      setErr("Could not connect to payment. Please try again.");
      setLoading(false);
    }
  };

  const IS2 = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 13px", color:C.textDark, fontSize:14 };

  return (
    <div style={{ background:"#fff", borderRadius:16, padding:20, border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
      <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, color:C.textDark, fontWeight:700, marginBottom:3 }}>Complete Payment</div>
      <div style={{ color:C.textSoft, fontSize:13, marginBottom:18 }}>Posting <strong style={{color:C.textDark}}>{jobDraft?.title||"your listing"}</strong> as {tierLabel}</div>

      {/* Email field — captured for follow-up if abandoned */}
      {!user?.email && (
        <div style={{ marginBottom:14 }}>
          <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Your Email <span style={{color:C.error}}>*</span></div>
          <input
            type="email"
            value={captureEmail}
            onChange={e=>setCaptureEmail(e.target.value)}
            onBlur={()=>notifyAbandoned(captureEmail)}
            placeholder="your@venue.com.au"
            style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 13px", color:C.textDark, fontSize:14 }}
          />
        </div>
      )}

      {/* Price breakdown */}
      <div style={{ background:C.bgSoft, borderRadius:12, padding:"14px 16px", border:`1px solid ${C.border}`, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ color:C.textSoft, fontSize:13 }}>{tierLabel} listing</span>
          <span style={{ color:C.textDark, fontSize:13 }}>${basePrice}.00 AUD</span>
        </div>
        {discount > 0 && (
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:C.sage, fontSize:13 }}>Discount ({appliedCode?.code})</span>
            <span style={{ color:C.sage, fontSize:13, fontWeight:600 }}>−${discount}.00</span>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ color:C.textSoft, fontSize:13 }}>GST (10%)</span>
          <span style={{ color:C.textDark, fontSize:13 }}>${gst}.00 AUD</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
          <span style={{ color:C.textDark, fontSize:15, fontWeight:700 }}>Total</span>
          <span style={{ color:C.terracotta, fontSize:17, fontWeight:700 }}>${total}.00 AUD</span>
        </div>
      </div>

      {/* Discount code */}
      <div style={{ marginBottom:16 }}>
        <div style={{ color:C.textSoft, fontSize:13, textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>🏷️ Have a discount code?</div>
        {appliedCode ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 13px", background:C.sageL, borderRadius:10, border:`1px solid ${C.sage}40` }}>
            <span style={{ flex:1, color:C.sage, fontWeight:700, fontSize:13 }}>✓ {appliedCode.code} — {appliedCode.pct}% off applied</span>
            <button onClick={removeCode} style={{ background:"none", border:"none", color:C.textFaint, fontSize:16, cursor:"pointer" }}>×</button>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&applyCode()} placeholder="Enter code" style={{...IS2, flex:1}}/>
            <button className="tap" onClick={applyCode} style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 16px", color:C.textMid, fontSize:13, fontWeight:600 }}>Apply</button>
          </div>
        )}
        {codeErr && <div style={{ color:C.error, fontSize:12, marginTop:5 }}>{codeErr}</div>}
      </div>

      {/* Stripe secure notice */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 14px", background:"#F0FFF4", border:"1px solid #86EFAC", borderRadius:10, marginBottom:16 }}>
        <span style={{ fontSize:18 }}>🔒</span>
        <span style={{ color:"#166534", fontSize:12 }}>You'll be taken to Stripe's secure checkout to complete payment. We never store your card details.</span>
      </div>

      {err && <div style={{ color:C.error, fontSize:13, background:"#FEF2F0", border:`1px solid ${C.error}30`, borderRadius:8, padding:"9px 12px", marginBottom:12 }}>{err}</div>}

      {/* Buttons */}
      <div style={{ display:"flex", gap:9 }}>
        <button className="tap" onClick={()=>{ notifyAbandoned(captureEmail||user?.email||''); onCancel(); }} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 0", color:C.textMid, fontSize:14 }}>Back</button>
        <button className="btn-cta tap" onClick={pay} disabled={loading}
          style={{ flex:2, background:loading?"#ccc":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:12, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:loading?"none":"0 4px 14px rgba(196,98,58,0.22)" }}>
          {loading ? "Redirecting to Stripe…" : `Pay $${total}.00 AUD →`}
        </button>
      </div>
      <div style={{ textAlign:"center", marginTop:10, color:C.textFaint, fontSize:11 }}>Secured by Stripe · GST receipt provided</div>
    </div>
  );
}


// ─── Subscribe Plans ──────────────────────────────────────────────────────────
function SubscribePlans({ user, onSubscribe }) {
  const [loading, setLoading] = useState(null);
  const sub = user?.subscription_tier;
  const active = user?.subscription_active;

  const plans = [
    {
      key: "starter",
      name: "Starter",
      icon: "🥉",
      price: 99,
      limit: 3,
      color: "#C9A96E",
      colorL: "#FDF6E8",
      border: "#8B6914",
      features: [
        "3 active listings at any time",
        "30-day listing visibility",
        "Up to 5 photos + video reel",
        "Unlimited applications",
        "Application management dashboard",
        "Verified venue profile",
        "Cancel anytime",
      ],
    },
    {
      key: "growth",
      name: "Growth",
      icon: "🥈",
      price: 199,
      limit: 6,
      color: "#C0D0E0",
      colorL: "#EEF3F8",
      border: "#A8B8C8",
      popular: true,
      features: [
        "6 active listings at any time",
        "All Starter features",
        "Pinned to top of feed",
        "Featured badge on every listing",
        "Priority in search results",
        "Highlighted in job alert emails",
        "Candidate search & messaging",
        "Cancel anytime",
      ],
    },
    {
      key: "pro",
      name: "Pro",
      icon: "🥇",
      price: 399,
      limit: 10,
      color: "#FFD700",
      colorL: "#FFFBEB",
      border: "#D4A017",
      features: [
        "10 active listings at any time",
        "All Growth features",
        "Instagram & Facebook promotion",
        "Custom screening questions",
        "Applicant auto-ranking",
        "Bulk application management",
        "Analytics dashboard",
        "Custom venue landing page",
        "Cancel anytime",
      ],
    },
  ];

  const IS = { width:"100%", background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 13px", color:C.textDark, fontSize:14 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark, marginBottom:3 }}>Subscription Plans</div>
        <div style={{ color:C.textSoft, fontSize:13 }}>Post multiple jobs every month for one flat fee. Cancel anytime.</div>
      </div>

      {/* Current plan badge */}
      {active && sub && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:C.sageL, borderRadius:12, border:`1px solid ${C.sage}40` }}>
          <span style={{ fontSize:22 }}>✅</span>
          <div>
            <div style={{ color:C.sage, fontWeight:700, fontSize:14 }}>
              Active: {sub.charAt(0).toUpperCase()+sub.slice(1)} Plan
            </div>
            <div style={{ color:C.textSoft, fontSize:12 }}>Your subscription is active and renews monthly via Stripe.</div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      {plans.map(plan => {
        const isCurrent = active && sub === plan.key;
        const gst = Math.round(plan.price * 0.1);
        const total = plan.price + gst;
        return (
          <div key={plan.key} style={{ background:isCurrent?"#ECFDF5":"#fff", borderRadius:16, border:`1.5px solid ${isCurrent?C.sage:plan.popular?plan.border:C.border}`, padding:"18px 16px", position:"relative", boxShadow:plan.popular?"0 4px 20px rgba(0,0,0,0.08)":"none" }}>
            {plan.popular && !isCurrent && (
              <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:`linear-gradient(135deg,${plan.border},${plan.color})`, color:C.ink, fontSize:10, fontWeight:800, letterSpacing:1.5, textTransform:"uppercase", padding:"4px 14px", borderRadius:100, whiteSpace:"nowrap" }}>⭐ Most Popular</div>
            )}
            {isCurrent && (
              <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:C.sage, color:"#fff", fontSize:10, fontWeight:800, letterSpacing:1.5, textTransform:"uppercase", padding:"4px 14px", borderRadius:100, whiteSpace:"nowrap" }}>✓ Current Plan</div>
            )}

            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <span style={{ fontSize:28 }}>{plan.icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:C.textDark }}>{plan.name}</div>
                <div style={{ color:C.textSoft, fontSize:12 }}>{plan.limit} active listings/month</div>
              </div>
              <div style={{ marginLeft:"auto", textAlign:"right" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:900, color:plan.color, lineHeight:1 }}>${plan.price}</div>
                <div style={{ color:C.textFaint, fontSize:10 }}>+${gst} GST/mo</div>
              </div>
            </div>

            <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
              {plan.features.map(f=>(
                <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:7, fontSize:13, color:C.textMid }}>
                  <span style={{ color:plan.color, fontWeight:700, flexShrink:0, marginTop:1 }}>✓</span>{f}
                </li>
              ))}
            </ul>

            <button className="btn-cta tap" disabled={isCurrent||loading===plan.key}
              onClick={async()=>{
                setLoading(plan.key);
                await onSubscribe(plan.key);
                setLoading(null);
              }}
              style={{ width:"100%", background:isCurrent?C.sage:loading===plan.key?"#ccc":`linear-gradient(135deg,${plan.color},${plan.border})`, border:"none", borderRadius:10, padding:"13px 0", color:plan.key==="starter"?"#1A1000":"#fff", fontWeight:700, fontSize:14, opacity:isCurrent?0.7:1 }}>
              {isCurrent ? "Current Plan" : loading===plan.key ? "Redirecting…" : `Subscribe — $${total}/mo incl. GST`}
            </button>
          </div>
        );
      })}

      {/* Compare to pay per listing */}
      <div style={{ background:C.bgSoft, borderRadius:12, padding:"13px 15px", border:`1px solid ${C.border}` }}>
        <div style={{ color:C.textMid, fontSize:12, fontWeight:600, marginBottom:6 }}>💡 Compare to pay-per-listing</div>
        <div style={{ color:C.textSoft, fontSize:12, lineHeight:1.6 }}>
          Posting 3 Bronze listings individually = $165 AUD (incl. GST).<br/>
          Starter plan = $108.90/mo for the same 3 slots, every month.<br/>
          <span style={{ color:C.terracotta, fontWeight:600 }}>Save over 30% with a subscription.</span>
        </div>
      </div>

      <div style={{ textAlign:"center", color:C.textFaint, fontSize:11 }}>
        Billed monthly · Cancel anytime in Stripe · GST receipt provided
      </div>
    </div>
  );
}


// ─── Account Settings ─────────────────────────────────────────────────────────
// ─── Talent Share Card ────────────────────────────────────────────────────────
function TalentShareCard({ user }) {
  const [isPublic, setIsPublic]   = useState(user?.is_public===true);
  const [expanded, setExpanded]   = useState(false); // show config panel
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");
  const [showInfo, setShowInfo]   = useState(false);

  // Contact / privacy fields
  const [contactEmail, setContactEmail] = useState(user?.contact_email||user?.email||"");
  const [contactPhone, setContactPhone] = useState(user?.contact_phone||"");
  const [showEmail, setShowEmail]   = useState(user?.show_email !== false);
  const [showPhone, setShowPhone]   = useState(user?.show_phone === true);
  const [showResume, setShowResume] = useState(user?.show_resume !== false);

  // Structured discovery fields
  const [role,     setRole]     = useState(user?.role||"");
  const [sector,   setSector]   = useState(user?.sector||"");
  const [country,  setCountry]  = useState(user?.country||"Australia");
  const [state,    setState]    = useState(user?.state||"");
  const [city,     setCity]     = useState(user?.city||"");
  const [yearsExp, setYearsExp] = useState(user?.years_exp||user?.experience||"");

  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 11px", color:C.textDark, fontSize:13 };

  const saveAndShare = async () => {
    if (!showEmail && !showPhone) {
      setMsg("You must share at least your email or phone so employers can contact you.");
      setTimeout(()=>setMsg(""), 3500); return;
    }
    if (showEmail && !contactEmail.trim()) {
      setMsg("Please enter a contact email first.");
      setTimeout(()=>setMsg(""), 3000); return;
    }
    setSaving(true);
    const locStr = [city, state, country].filter(Boolean).join(", ");
    try {
      await supabase.from("profiles").update({
        is_public: true,
        contact_email: contactEmail.trim()||user.email,
        contact_phone: contactPhone.trim()||null,
        show_email: showEmail, show_phone: showPhone, show_resume: showResume,
        role: role||null, sector: sector||null,
        country: country||null, state: state||null, city: city||null,
        years_exp: yearsExp||null, experience: yearsExp||null,
        location: locStr||null,
      }).eq("id", user.id);
      setIsPublic(true);
      setExpanded(false);
      setMsg("✓ Your profile is now visible to employers");
      setTimeout(()=>setMsg(""), 3000);
    } catch(e) { setMsg("Couldn't save — try again"); }
    setSaving(false);
  };

  const goPrivate = async () => {
    setSaving(true);
    try {
      await supabase.from("profiles").update({ is_public: false }).eq("id", user.id);
      setIsPublic(false);
      setExpanded(false);
      setMsg("Your profile is now private");
      setTimeout(()=>setMsg(""), 2500);
    } catch(e) { setMsg("Couldn't update — try again"); }
    setSaving(false);
  };

  const saveSettings = async () => {
    if (!showEmail && !showPhone) {
      setMsg("You must share at least your email or phone.");
      setTimeout(()=>setMsg(""), 3000); return;
    }
    setSaving(true);
    const locStr = [city, state, country].filter(Boolean).join(", ");
    try {
      await supabase.from("profiles").update({
        contact_email: contactEmail.trim()||user.email,
        contact_phone: contactPhone.trim()||null,
        show_email: showEmail, show_phone: showPhone, show_resume: showResume,
        role: role||null, sector: sector||null,
        country: country||null, state: state||null, city: city||null,
        years_exp: yearsExp||null, experience: yearsExp||null,
        location: locStr||null,
      }).eq("id", user.id);
      setMsg("✓ Settings saved");
      setTimeout(()=>setMsg(""), 2000);
    } catch(e) { setMsg("Couldn't save — try again"); }
    setSaving(false);
  };

  const PrivacyCheck = ({ label, sub, checked, onChange, required }) => (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
      <button className="tap" onClick={onChange}
        style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?C.sage:C.border}`, background:checked?C.sage:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", marginTop:2 }}>
        {checked && <Icon name="check" size={12} color="#fff"/>}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.textDark, display:"flex", alignItems:"center", gap:6 }}>
          {label}
          {required && <span style={{ fontSize:10, color:C.terracotta, fontWeight:700, background:C.terracottaL, padding:"1px 7px", borderRadius:10 }}>Required</span>}
        </div>
        {sub && <div style={{ fontSize:11, color:C.textFaint, marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom:16 }}>

      {/* Header card — always visible */}
      <div style={{ borderRadius: expanded ? "14px 14px 0 0" : 14, border:`2px solid ${isPublic?C.sage:C.terracotta}`, background:isPublic?C.sageL:"#fff", padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:isPublic?C.sage:C.terracottaL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
          {isPublic ? "👁️" : "🔒"}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:1 }}>
            <div style={{ fontWeight:700, fontSize:15, color:C.textDark }}>
              {isPublic ? "Visible to Employers" : "Share Profile to Talent Search"}
            </div>
            {/* Info button */}
            <button className="tap" onClick={()=>setShowInfo(true)}
              style={{ width:18, height:18, borderRadius:"50%", background:C.bgSoft, border:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.textSoft, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>?</button>
          </div>
          <div style={{ fontSize:12, color:C.textSoft }}>
            {isPublic ? "Employers can find and contact you · tap to edit settings" : "Tap to set your details and share with employers"}
          </div>
          {msg && <div style={{ fontSize:12, fontWeight:600, color:msg.startsWith("✓")?C.sage:C.terracotta, marginTop:3 }}>{msg}</div>}
        </div>
        {isPublic ? (
          <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
            <button className="tap" onClick={()=>setExpanded(e=>!e)} disabled={saving}
              style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${C.sage}`, background:"#fff", color:C.sage, fontWeight:700, fontSize:12, cursor:"pointer" }}>
              {expanded ? "Done" : "Edit"}
            </button>
            <button className="tap" onClick={goPrivate} disabled={saving}
              style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${C.border}`, background:"#fff", color:C.textSoft, fontWeight:600, fontSize:12, cursor:"pointer" }}>
              {saving ? "…" : "Go Private"}
            </button>
          </div>
        ) : (
          <button className="tap" onClick={()=>setExpanded(e=>!e)} disabled={saving}
            style={{ flexShrink:0, padding:"10px 18px", borderRadius:22, border:"none", background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", boxShadow:"0 3px 10px rgba(196,98,58,0.3)" }}>
            Share Profile
          </button>
        )}
      </div>

      {/* Expandable config panel */}
      {expanded && (
        <div style={{ border:`2px solid ${isPublic?C.sage:C.terracotta}`, borderTop:"none", borderRadius:"0 0 14px 14px", background:"#fff", padding:"16px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Role + Sector */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.textSoft, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Your Role</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <select value={role} onChange={e=>setRole(e.target.value)} style={IS}>
                  <option value="">Select your role…</option>
                  {["Head Chef","Sous Chef","Chef de Partie","Commis Chef","Pastry Chef","Executive Chef","Kitchen Hand","Bar Manager","Bartender","Sommelier","Front of House Manager","Floor Manager","Barista","Waiter / Waitress","Venue Manager","Events Coordinator","Food & Beverage Manager","Restaurant Manager","Hospitality Professional"].map(r=><option key={r}>{r}</option>)}
                </select>
                <select value={sector} onChange={e=>setSector(e.target.value)} style={IS}>
                  <option value="">Select industry / sector…</option>
                  {["Fine Dining","Casual Dining","Café","Bakery","Pub / Bar","Hotel & Resort","Events & Catering","Fast Casual","Bistro","Club","Winery / Cellar Door","Food Truck","Corporate Catering"].map(s=><option key={s}>{s}</option>)}
                </select>
                <select value={yearsExp} onChange={e=>setYearsExp(e.target.value)} style={IS}>
                  <option value="">Years of experience…</option>
                  {["Less than 1 year","1–2 years","2–5 years","5–10 years","10–15 years","15+ years"].map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.textSoft, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Your Location</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <select value={country} onChange={e=>{ setCountry(e.target.value); setState(""); setCity(""); }} style={IS}>
                  {Object.keys(LOCATIONS).map(c=><option key={c}>{c}</option>)}
                </select>
                {country && Object.keys(LOCATIONS[country]||{}).length>0 && (
                  <select value={state} onChange={e=>{ setState(e.target.value); setCity(""); }} style={IS}>
                    <option value="">Select region / state…</option>
                    {Object.keys(LOCATIONS[country]||{}).map(s=><option key={s}>{s}</option>)}
                  </select>
                )}
                {state && (LOCATIONS[country]?.[state]||[]).length>0 && (
                  <select value={city} onChange={e=>setCity(e.target.value)} style={IS}>
                    <option value="">Select city / suburb…</option>
                    {(LOCATIONS[country]?.[state]||[]).map(c=><option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Contact visibility */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.textSoft, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>What Employers Can See</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <PrivacyCheck label="Email address" required checked={showEmail} onChange={()=>setShowEmail(v=>!v)}/>
                  {showEmail && <input value={contactEmail} onChange={e=>setContactEmail(e.target.value)} placeholder="you@email.com" type="email" style={{ ...IS, marginTop:7 }}/>}
                </div>
                <div>
                  <PrivacyCheck label="Phone number" sub="Optional — lets employers call you directly" checked={showPhone} onChange={()=>setShowPhone(v=>!v)}/>
                  {showPhone && <input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="04xx xxx xxx" type="tel" style={{ ...IS, marginTop:7 }}/>}
                </div>
                <PrivacyCheck label="Résumé / CV" sub="Let employers download your résumé" checked={showResume} onChange={()=>setShowResume(v=>!v)}/>
              </div>
              <div style={{ fontSize:11, color:C.textFaint, marginTop:10, lineHeight:1.5, background:C.bgSoft, borderRadius:8, padding:"8px 10px" }}>
                ℹ️ Your name, role, bio and work photos are always shown when your profile is public.
              </div>
            </div>

            {msg && <div style={{ fontSize:13, fontWeight:600, color:msg.startsWith("✓")?C.sage:C.terracotta }}>{msg}</div>}

            {/* Action buttons */}
            {isPublic ? (
              <button className="btn-cta tap" onClick={saveSettings} disabled={saving}
                style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:11, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 3px 10px rgba(196,98,58,0.22)" }}>
                {saving ? "Saving…" : "Save Settings"}
              </button>
            ) : (
              <button className="btn-cta tap" onClick={saveAndShare} disabled={saving}
                style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:11, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 3px 10px rgba(196,98,58,0.22)" }}>
                {saving ? "Saving…" : "✓ Share My Profile"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info popup */}
      {showInfo && (
        <div onClick={()=>setShowInfo(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:18, padding:"24px 20px", maxWidth:340, width:"100%", position:"relative" }}>
            <button onClick={()=>setShowInfo(false)} style={{ position:"absolute", top:14, right:14, width:28, height:28, borderRadius:"50%", background:C.bgSoft, border:`1px solid ${C.border}`, fontSize:16, color:C.textMid, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            <div style={{ fontSize:30, marginBottom:10 }}>👁️</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark, marginBottom:8 }}>Talent Search</div>
            <div style={{ color:C.textMid, fontSize:13, lineHeight:1.6, marginBottom:12 }}>
              When you share your profile, employers hiring on HospoSearch can discover you in their <strong>Talent Search</strong> — even if you haven't applied to their listing.
            </div>
            {[["✓","Your name, role and bio are always visible"],["✓","You choose what contact details employers can see"],["✓","Email or phone required so employers can reach you"],["✓","Turn it off any time to go private instantly"]].map(([ic,t])=>(
              <div key={t} style={{ display:"flex", gap:8, marginBottom:6 }}>
                <span style={{ color:C.sage, fontWeight:700 }}>{ic}</span>
                <span style={{ color:C.textMid, fontSize:13 }}>{t}</span>
              </div>
            ))}
            <button className="tap" onClick={()=>setShowInfo(false)}
              style={{ width:"100%", marginTop:14, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}


function AccountSettings({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState(user?.handle||"");
  const [instagram, setInstagram] = useState(user?.instagram||"");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [handleMsg, setHandleMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const IS = { width:"100%", background:C.bgSoft, border:"1px solid #E8E3DC", borderRadius:10, padding:"10px 13px", color:C.textDark, fontSize:14 };

  const saveHandle = async () => {
    if (!handle.trim()) return;
    setSaving(true);
    // Check if handle is taken
    const { data } = await supabase.from('profiles').select('id').eq('handle', handle.trim()).neq('id', user.id);
    if (data && data.length > 0) {
      setHandleMsg("That username is already taken");
    } else {
      await supabase.from('profiles').update({ handle: handle.trim(), instagram: instagram.trim()||null }).eq('id', user.id);
      setHandleMsg("Username saved!");
      setTimeout(()=>setHandleMsg(""), 2000);
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPass.length < 6) { setPassMsg("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) setPassMsg(error.message);
      else { setPassMsg("Password updated!"); setOldPass(""); setNewPass(""); }
    } catch(e) { setPassMsg("Failed to update password"); }
    setSaving(false);
    setTimeout(()=>setPassMsg(""), 3000);
  };

  return (
    <div style={{ marginBottom:12 }}>
      <button className="tap" onClick={()=>setOpen(!open)}
        style={{ width:"100%", background:open?C.terracottaL:"#fff", border:"1px solid #E8E3DC", borderRadius:11, padding:"12px 16px", color:C.textDark, fontSize:14, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>⚙️ Account Settings</span>
        <span style={{ color:C.textSoft, fontSize:12 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ background:"#fff", border:"1px solid #E8E3DC", borderTop:"none", borderRadius:"0 0 11px 11px", padding:"14px 16px", display:"flex", flexDirection:"column", gap:14 }}>

)}

          <div>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Username</div>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ position:"relative", flex:1 }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.textFaint, fontSize:14 }}>@</span>
                <input value={handle} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} style={{...IS, paddingLeft:26}}/>
              </div>
              <button className="tap" onClick={saveHandle} disabled={saving}
                style={{ background:"linear-gradient(135deg,#C4623A,#A84F2E)", border:"none", borderRadius:10, padding:"10px 16px", color:"#fff", fontSize:13, fontWeight:700 }}>
                Save
              </button>
            </div>
            {handleMsg && <div style={{ color:handleMsg.includes("taken")?"#C4623A":"#6B8F71", fontSize:12, marginTop:4 }}>{handleMsg}</div>}
          </div>

          {/* Instagram link */}
          <div>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Instagram Handle <span style={{ color:C.textFaint, textTransform:"none", letterSpacing:0, fontWeight:400 }}>(optional — shown to employers)</span></div>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ position:"relative", flex:1 }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.textFaint, fontSize:14 }}>@</span>
                <input value={instagram} onChange={e=>setInstagram(e.target.value.replace(/^@/,""))} placeholder="yourhandle" style={{...IS, paddingLeft:26}}/>
              </div>
              <button className="tap" onClick={saveHandle} disabled={saving}
                style={{ background:"linear-gradient(135deg,#C4623A,#A84F2E)", border:"none", borderRadius:10, padding:"10px 16px", color:"#fff", fontSize:13, fontWeight:700 }}>
                Save
              </button>
            </div>
            {instagram && <a href={"https://instagram.com/"+instagram.replace(/^@/,"")} target="_blank" rel="noreferrer" style={{ color:"#6B8F71", fontSize:12, marginTop:4, display:"block" }}>instagram.com/{instagram} ↗</a>}
          </div>

          {/* Change password */}
          <div>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Change Password</div>
            <input value={newPass} onChange={e=>setNewPass(e.target.value)} type="password" placeholder="New password (min 6 characters)" style={{...IS, marginBottom:8}}/>
            <button className="tap" onClick={changePassword} disabled={saving}
              style={{ width:"100%", background:"linear-gradient(135deg,#C4623A,#A84F2E)", border:"none", borderRadius:10, padding:"11px 0", color:"#fff", fontSize:13, fontWeight:700 }}>
              Update Password
            </button>
            {passMsg && <div style={{ color:passMsg.includes("updated")?"#6B8F71":"#C4623A", fontSize:12, marginTop:4 }}>{passMsg}</div>}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Employer Profile Tab ────────────────────────────────────────────────────
function EmployerProfileTab({ user, mine, apps, emailNotifs, toggleEmailNotifs, onLogout, altAccount, onSwitchAccount, onAvatarChange }) {
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 13px", color:C.textDark, fontSize:14 };

  // Avatar / profile picture — staged: pick → preview → confirm save
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || null);
  const [pendingAvatar, setPendingAvatar] = useState(null); // { file, preview }
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);

  const pickAvatar = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setPendingAvatar({ file:f, preview:ev.target.result });
    reader.readAsDataURL(f);
  };
  const saveAvatar = async () => {
    if (!pendingAvatar) return;
    setAvatarSaving(true);
    try {
      const ext = pendingAvatar.file.name.split(".").pop();
      const path = `avatars/${user.id}/avatar-${Date.now()}.${ext}`;
      await supabase.storage.from("job-photos").upload(path, pendingAvatar.file, { upsert:true, contentType:pendingAvatar.file.type });
      const { data: urlData } = supabase.storage.from("job-photos").getPublicUrl(path);
      const url = urlData.publicUrl;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setAvatarUrl(url);
      setPendingAvatar(null);
      setAvatarSaved(true);
      setTimeout(()=>setAvatarSaved(false), 2500);
      if (onAvatarChange) onAvatarChange(url); // propagate to app + listings immediately
    } catch(e) { console.warn("Avatar save error:", e); }
    setAvatarSaving(false);
  };
  const cancelAvatar = () => setPendingAvatar(null);

  // Bio section
  const [bio, setBio] = useState(user.bio||"");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const saveBio = async () => {
    setBioSaving(true);
    try { await supabase.from("profiles").update({ bio: bio.trim() }).eq("id", user.id); setBioSaved(true); setTimeout(()=>setBioSaved(false), 2000); } catch(e) {}
    setBioSaving(false);
  };

  const [empCountry, setEmpCountry] = useState(user.country||"Australia");
  const [empState,   setEmpState]   = useState(user.state||"");
  const [empCity,    setEmpCity]    = useState(user.city||"");
  const [locSaving,  setLocSaving]  = useState(false);
  const [locSaved,   setLocSaved]   = useState(false);
  const saveLocation = async () => {
    setLocSaving(true);
    const loc = [empCity, empState, empCountry].filter(Boolean).join(", ");
    try {
      await supabase.from("profiles").update({ country: empCountry, state: empState||null, city: empCity||null, location: loc }).eq("id", user.id);
      setLocSaved(true); setTimeout(()=>setLocSaved(false), 2000);
    } catch(e) {}
    setLocSaving(false);
  };

  // Website / links
  const [website, setWebsite] = useState(user.website||"");
  const [instagram, setInstagram] = useState(user.instagram||"");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);
  const saveLinks = async () => {
    setLinkSaving(true);
    try { await supabase.from("profiles").update({ website, instagram }).eq("id", user.id); } catch(e) {}
    setLinkSaving(false); setLinkSaved(true); setTimeout(()=>setLinkSaved(false), 2000);
  };

  // Resume / cover letter
  const [resume, setResume] = useState(user.resume_url ? { name:user.resume_name, url:user.resume_url } : null);
  const [cover, setCover] = useState(user.cover_url ? { name:user.cover_name, url:user.cover_url } : null);
  const [docSaving, setDocSaving] = useState(false);
  const [docSaved, setDocSaved] = useState(false);

  const saveDocs = async () => {
    setDocSaving(true);
    let resumeResult = resume;
    let coverResult = cover;

    if (resume?.data) {
      try {
        const res = await fetch(resume.data);
        const blob = await res.blob();
        const ext = resume.name?.split(".").pop()||"pdf";
        const path = `profiles/${user.id}/resume.${ext}`;
        await supabase.storage.from("documents").upload(path, blob, { upsert:true, contentType:blob.type });
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        resumeResult = { name:resume.name, size:resume.size, url:urlData.publicUrl };
      } catch(e) { console.warn("Resume upload error:", e); }
    }

    if (cover?.data) {
      try {
        const res = await fetch(cover.data);
        const blob = await res.blob();
        const ext = cover.name?.split(".").pop()||"pdf";
        const path = `profiles/${user.id}/cover.${ext}`;
        await supabase.storage.from("documents").upload(path, blob, { upsert:true, contentType:blob.type });
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        coverResult = { name:cover.name, size:cover.size, url:urlData.publicUrl };
      } catch(e) { console.warn("Cover upload error:", e); }
    }

    try {
      await supabase.from("profiles").update({
        resume_name: resumeResult?.name||null,
        resume_url:  resumeResult?.url||null,
        cover_name:  coverResult?.name||null,
        cover_url:   coverResult?.url||null,
      }).eq("id", user.id);
    } catch(e) {}

    setResume(resumeResult);
    setCover(coverResult);
    setDocSaving(false); setDocSaved(true);
    setTimeout(()=>setDocSaved(false), 2000);
  };

  const SectionCard = ({ title, children, action }) => (
    <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:12 }}>
      <div style={{ padding:"13px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontWeight:700, fontSize:14, color:C.textDark }}>{title}</div>
        {action}
      </div>
      <div style={{ padding:"14px 16px" }}>{children}</div>
    </div>
  );

  const SaveBtn = ({ saving, saved, onClick, label="Save" }) => (
    <button className="tap" onClick={onClick} disabled={saving}
      style={{ background:saved?C.sage:saving?"#aaa":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:8, padding:"7px 16px", color:"#fff", fontSize:12, fontWeight:700, transition:"all 0.3s" }}>
      {saved ? "✓ Saved" : saving ? "⏳" : label}
    </button>
  );

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"20px 16px 40px" }}>

      {/* Header — avatar with confirm-to-save */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
        <div style={{ flexShrink:0, textAlign:"center" }}>
          <label style={{ position:"relative", cursor:"pointer", display:"inline-block" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, border:`3px solid ${C.border}`, overflow:"hidden" }}>
              {(pendingAvatar?.preview || avatarUrl)
                ? <img src={pendingAvatar?.preview || avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                : <span>{user.avatar}</span>
              }
            </div>
            <div style={{ position:"absolute", bottom:0, right:0, width:22, height:22, borderRadius:"50%", background:C.terracotta, border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="edit" size={11} color="#fff"/>
            </div>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={pickAvatar}/>
          </label>
          {pendingAvatar && (
            <div style={{ display:"flex", gap:5, marginTop:8, justifyContent:"center" }}>
              <button className="tap" onClick={saveAvatar} disabled={avatarSaving}
                style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:7, padding:"5px 12px", color:"#fff", fontSize:11, fontWeight:700 }}>
                {avatarSaving ? "⏳" : "Save"}
              </button>
              <button className="tap" onClick={cancelAvatar}
                style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 10px", color:C.textMid, fontSize:11, fontWeight:600 }}>
                Cancel
              </button>
            </div>
          )}
          {avatarSaved && <div style={{ color:C.sage, fontSize:11, fontWeight:600, marginTop:6 }}>✓ Updated</div>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:C.textDark, fontWeight:700 }}>{user.name}</div>
          <div style={{ color:C.textSoft, fontSize:13, marginBottom:6 }}>@{user.handle}</div>
          {user.verified && <div style={{ color:C.sage, fontSize:12, fontWeight:600, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}><Icon name="check" size={12} color={C.sage}/>Verified Employer</div>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:16, padding:"14px 0", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, marginBottom:16 }}>
        {[["Listings",mine.length],["Applications",apps],["Views",mine.reduce((s,j)=>s+(j.views||0),0)]].map(([l,v])=>(
          <div key={l} style={{ textAlign:"center", flex:1 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:20, color:C.textDark }}>{v}</div>
            <div style={{ color:C.textSoft, fontSize:12 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Bio */}
      <SectionCard title="📝 About your venue">
        <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={4}
          placeholder="Tell candidates about your venue — cuisine, culture, team size, awards…"
          style={{...IS, resize:"none", width:"100%", marginBottom:10}}/>
        <SaveBtn saving={bioSaving} saved={bioSaved} onClick={saveBio}/>
      </SectionCard>

      {/* Location */}
      <SectionCard title="📍 Location">
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:10 }}>
          <div>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Country</div>
            <select value={empCountry} onChange={e=>{ setEmpCountry(e.target.value); setEmpState(""); setEmpCity(""); }} style={IS}>
              {Object.keys(LOCATIONS).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          {empCountry && Object.keys(LOCATIONS[empCountry]||{}).length>0 && (
            <div>
              <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>State / Region</div>
              <select value={empState} onChange={e=>{ setEmpState(e.target.value); setEmpCity(""); }} style={IS}>
                <option value="">Select state / region…</option>
                {Object.keys(LOCATIONS[empCountry]||{}).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          {empState && (LOCATIONS[empCountry]?.[empState]||[]).length>0 && (
            <div>
              <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>City / Suburb</div>
              <select value={empCity} onChange={e=>setEmpCity(e.target.value)} style={IS}>
                <option value="">Select city…</option>
                {(LOCATIONS[empCountry]?.[empState]||[]).map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
        <SaveBtn saving={locSaving} saved={locSaved} onClick={saveLocation}/>
      </SectionCard>

      {/* Links */}
      <SectionCard title="🔗 Website & Social" action={<SaveBtn saving={linkSaving} saved={linkSaved} onClick={saveLinks}/>}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Website</div>
            <input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://yourvenue.com.au" style={IS}/>
          </div>
          <div>
            <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Instagram</div>
            <input value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder="@yourvenue" style={IS}/>
          </div>
        </div>
      </SectionCard>

      {/* Notification settings */}
      <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:12 }}>
        <div style={{ padding:"13px 16px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.textDark }}>🔔 Application Notifications</div>
          <div style={{ color:C.textSoft, fontSize:12, marginTop:2 }}>Get emailed when someone applies to your jobs</div>
        </div>
        <div className="tap" onClick={()=>toggleEmailNotifs(!emailNotifs)}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", cursor:"pointer" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:13, color:C.textDark }}>Email notifications</div>
            <div style={{ color:C.textSoft, fontSize:12, marginTop:1 }}>
              {emailNotifs ? "On — you'll get an email per application" : "Off — check the Apps tab manually"}
            </div>
          </div>
          <div style={{ width:44, height:24, borderRadius:12, background:emailNotifs?C.terracotta:C.border, position:"relative", flexShrink:0, transition:"background 0.2s" }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:emailNotifs?23:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
          </div>
        </div>
        <div style={{ padding:"8px 16px", background:C.bgSoft, borderTop:`1px solid ${C.border}` }}>
          <div style={{ color:C.textFaint, fontSize:11 }}>💡 Agencies: turn off to avoid multiple emails across client accounts</div>
        </div>
      </div>

      {altAccount && (
        <button className="tap" onClick={onSwitchAccount}
          style={{ width:"100%", background:C.terracottaL, border:"1px solid #E8CFBF", borderRadius:11, padding:"12px 0", color:C.terracotta, fontSize:14, fontWeight:600, marginBottom:8 }}>
          Switch to {altAccount.type === 'employer' ? 'Employer' : 'Job Seeker'} Account
        </button>
      )}
      <button className="tap" onClick={onLogout} style={{ width:"100%", background:C.bgSoft, border:"1px solid #E8E3DC", borderRadius:11, padding:"13px 0", color:C.textMid, fontSize:14, fontWeight:500 }}>Sign Out</button>
    </div>
  );
}

// ─── Employer Browse (logged-in, full access, no login prompt) ───────────────
function EmployerBrowse({ jobs, user, onExpand }) {
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseCountry, setBrowseCountry] = useState("");
  const isDesktop = useIsDesktop();

  const filtered = browseSearch.trim()
    ? smartSearch(jobs.filter(j=>j&&j.id&&j.title), browseSearch)
    : browseCountry
      ? jobs.filter(j=>j&&j.id&&j.title&&(j.country===browseCountry||j.loc?.includes(browseCountry)))
      : jobs.filter(j=>j&&j.id&&j.title);

  const countries = [...new Set(jobs.filter(j=>j&&j.country).map(j=>j.country))].slice(0,8);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Search */}
      <div style={{ padding:"10px 14px 8px", background:"#fff", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", background:C.bgSoft, border:`1.5px solid ${browseSearch?C.terracotta:C.border}`, borderRadius:100, padding:"8px 14px", gap:8, transition:"border-color 0.2s" }}>
          <Icon name="search" size={16} color={browseSearch?C.terracotta:C.textSoft}/>
          <input value={browseSearch} onChange={e=>setBrowseSearch(e.target.value)} placeholder="Search all listings — role, venue, location…" style={{ flex:1, border:"none", background:"transparent", fontSize:13, color:C.textDark, outline:"none" }}/>
          {browseSearch && <button onClick={()=>setBrowseSearch("")} style={{ background:"none", border:"none", color:C.textSoft, fontSize:16, cursor:"pointer", padding:0 }}>×</button>}
        </div>
        {/* Location chips */}
        {countries.length > 0 && (
          <div style={{ display:"flex", gap:6, marginTop:8, overflowX:"auto", scrollbarWidth:"none" }}>
            {["All",...countries].map(c=>(
              <button key={c} className="tap" onClick={()=>setBrowseCountry(c==="All"?"":c)}
                style={{ flexShrink:0, background:(browseCountry===c||(c==="All"&&!browseCountry))?C.terracotta:"#fff", border:`1px solid ${(browseCountry===c||(c==="All"&&!browseCountry))?C.terracotta:C.border}`, borderRadius:20, padding:"4px 12px", color:(browseCountry===c||(c==="All"&&!browseCountry))?"#fff":C.textSoft, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                {c}
              </button>
            ))}
          </div>
        )}
        {(browseSearch||browseCountry) && (
          <div style={{ color:C.textSoft, fontSize:12, marginTop:6 }}>
            {filtered.length} result{filtered.length!==1?"s":""}{browseSearch?` for "${browseSearch}`:""}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex:1, overflowY:"auto", padding:isDesktop?"16px":"0" }}>
        {jobs.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:12, color:C.textFaint }}>
            <div style={{ width:32, height:32, borderRadius:"50%", border:`3px solid ${C.terracotta}`, borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }}/>
            <span style={{ fontSize:13 }}>Loading listings…</span>
          </div>
        )}
        {isDesktop ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, maxWidth:1100, margin:"0 auto" }}>
            {filtered.map((j,i)=>{
              const first = j.video||j.photos?.[0];
              const hm = isData(first);
              const pbg = PBG[typeof j.photos?.[0]==="number"?j.photos[0]%PBG.length:i%PBG.length];
              const emp = getEmp(j);
              return (
                <div key={j.id} className="tap" onClick={()=>onExpand(j)}
                  style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="none"; }}>
                  <div style={{ position:"relative", width:"100%", aspectRatio:"4/5", overflow:"hidden", background:pbg }}>
                    {hm ? <BlurFillImage src={first} alt={j.title} ratio="4/5"/> : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:40, opacity:0.2 }}>{emp?.avatar}</span></div>}
                    {j.featured && <div style={{ position:"absolute", top:8, left:8, background:C.featuredL, border:`1px solid ${C.featured}40`, borderRadius:20, padding:"3px 9px", display:"flex", alignItems:"center", gap:4, zIndex:2 }}><Icon name="star" size={11} color={C.featured} fill={C.featured}/><span style={{ color:C.featured, fontSize:10, fontWeight:700 }}>Featured</span></div>}
                  </div>
                  <div style={{ padding:"12px 14px 14px" }}>
                    <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, marginBottom:3 }}>{j.venue||emp?.name}</div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:17, color:C.textDark, marginBottom:4, lineHeight:1.2 }}>{j.title}</div>
                    <div style={{ color:C.sand, fontWeight:600, fontSize:13, marginBottom:8 }}>{j.salary}</div>
                    <div style={{ color:C.textMid, fontSize:13, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:10 }}>{stripTags(j.short)}</div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ color:C.textFaint, fontSize:11 }}>{j.loc} · {ago(j.ts)} ago</div>
                      <div style={{ color:C.terracotta, fontSize:12, fontWeight:600 }}>View role →</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {filtered.map(j=>(
              <JobCard key={j.id} job={j} currentUser={user} following={[]} bookmarks={[]} onApply={onExpand} onExpand={onExpand} onToggleFollow={()=>{}} onToggleBookmark={()=>{}} onVenueClick={()=>{}}/>
            ))}
            {filtered.length === 0 && <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>🔍</div><div style={{ color:C.textMid, fontSize:14 }}>No listings found</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Applications Manager (SEEK-style pipeline) ──────────────────────────────
const SCREENING_Q_LABELS = {
  rightToWork:         'Right to work',
  yearsExperience:     'Years of experience',
  noticePeriod:        'Notice period',
  policeCheck:         'Police check',
  availableWeekends:   'Available weekends',
  availablePublicHols: 'Available public holidays',
  driverLicence:       "Driver's licence",
  willingToRelocate:   'Willing to relocate',
};
const PIPELINE_STAGES = ["Sent","Viewed","Shortlisted","Interview","Offer","Not Suitable"];
const STAGE_BG = { Sent:C.bgSoft, Viewed:C.blueL, Shortlisted:C.sageL, Interview:"#FFF8EE", Offer:"#ECFDF5", "Not Suitable":"#FEF2F0" };
const STAGE_FG = { Sent:C.textMid, Viewed:C.blue, Shortlisted:C.sage, Interview:C.featured, Offer:C.sage, "Not Suitable":C.error };

function ApplicantDetailCard({ a, job, user, setJobs, setSupabaseApps, setMessages, setTab }) {
  const setStatus = async (newStatus) => {
    // Update the displayed source (supabaseApps) immediately
    if (setSupabaseApps) setSupabaseApps(prev => prev.map(ap => ap.id===a.id ? { ...ap, status:newStatus } : ap));
    // Keep jobs array in sync too (used elsewhere)
    setJobs(p=>p.map(jj=>jj.id===job.id?{...jj,apps:(jj.apps||[]).map(ap=>ap.id===a.id?{...ap,status:newStatus}:ap)}:jj));
    try { if(a.id) await sbUpdateAppStatus(a.id, newStatus); } catch(err){}
  };
  const screening = a.screeningAnswers || {};
  const screeningKeys = Object.keys(screening).filter(k=>screening[k]);
  return (
    <div style={{ padding:"4px 2px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:"#fff", fontWeight:700, flexShrink:0 }}>
          {(a.name||"?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:19, fontWeight:700, color:C.textDark }}>{a.name}</div>
          <div style={{ color:C.textSoft, fontSize:12, marginTop:2 }}>Applied {ago(a.ts)} ago</div>
          <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
            <span style={{ background:STAGE_BG[a.status||"Sent"], color:STAGE_FG[a.status||"Sent"], fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{a.status||"Sent"}</span>
          </div>
        </div>
      </div>

      {/* Contact + actions */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        {a.email && <a href={`mailto:${a.email}`} style={{ display:"flex", alignItems:"center", gap:5, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 12px", color:C.terracotta, fontSize:13, fontWeight:600, textDecoration:"none" }}>✉️ {a.email}</a>}
        {a.phone && <a href={`tel:${a.phone}`} style={{ display:"flex", alignItems:"center", gap:5, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 12px", color:C.terracotta, fontSize:13, fontWeight:600, textDecoration:"none" }}>📞 {a.phone}</a>}
      </div>

      {/* Documents */}
      {(a.resume_url||a.cover_url) && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          {a.resume_url && <a href={a.resume_url} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:6, background:C.sageL, border:`1px solid ${C.sage}40`, borderRadius:9, padding:"9px 14px", color:C.sage, fontSize:13, fontWeight:600, textDecoration:"none" }}>📋 Download Résumé ↗</a>}
          {a.cover_url && <a href={a.cover_url} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:6, background:C.sageL, border:`1px solid ${C.sage}40`, borderRadius:9, padding:"9px 14px", color:C.sage, fontSize:13, fontWeight:600, textDecoration:"none" }}>✉️ Download Cover Letter ↗</a>}
        </div>
      )}

      {/* Cover note */}
      {a.msg && (
        <div style={{ marginBottom:16 }}>
          <div style={{ color:C.textSoft, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Cover note</div>
          <div style={{ color:C.textMid, fontSize:14, background:C.bgSoft, padding:"12px 14px", borderRadius:10, lineHeight:1.6, fontStyle:"italic" }}>"{a.msg}"</div>
        </div>
      )}

      {/* Screening questions checklist */}
      {(screeningKeys.length>0 || a.visa || a.notice || (a.availability||[]).length>0 || (a.hours||[]).length>0) && (
        <div style={{ marginBottom:16 }}>
          <div style={{ color:C.textSoft, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Screening questions</div>
          <div style={{ border:`1px solid ${C.border}`, borderRadius:11, overflow:"hidden" }}>
            {a.visa && <ScreenRow label="Right to work / visa" value={a.visa}/>}
            {(a.availability||[]).length>0 && <ScreenRow label="Availability" value={(a.availability||[]).join(", ")}/>}
            {(a.hours||[]).length>0 && <ScreenRow label="Preferred hours" value={(a.hours||[]).join(", ")}/>}
            {a.notice && <ScreenRow label="Notice period" value={a.notice}/>}
            {screeningKeys.map(k=><ScreenRow key={k} label={SCREENING_Q_LABELS[k]||k} value={screening[k]}/>)}
          </div>
        </div>
      )}

      {/* Move through pipeline */}
      <div style={{ color:C.textSoft, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Move to stage</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {PIPELINE_STAGES.map(s=>(
          <button key={s} className="tap" onClick={()=>setStatus(s)}
            style={{ background:(a.status||"Sent")===s?STAGE_FG[s]:STAGE_BG[s], color:(a.status||"Sent")===s?"#fff":STAGE_FG[s], border:`1px solid ${(a.status||"Sent")===s?STAGE_FG[s]:C.border}`, borderRadius:20, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScreenRow({ label, value }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 13px", borderBottom:`1px solid ${C.border}`, background:"#fff" }}>
      <span style={{ color:C.sage, fontSize:14, marginTop:1, flexShrink:0 }}>✓</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:C.textSoft, fontSize:12 }}>{label}</div>
        <div style={{ color:C.textDark, fontSize:13, fontWeight:600, marginTop:1 }}>{value}</div>
      </div>
    </div>
  );
}

function ApplicationsManager({ mine, sel, setSel, user, setJobs, setSupabaseApps, setMessages, setTab, isDesktop }) {
  // All applications across the employer's listings (or just the selected job)
  const sourceJobs = sel ? [sel] : mine;
  const allApps = sourceJobs.flatMap(j => (j.apps||[]).map(a => ({ ...a, _job:j })));
  const [stageFilter, setStageFilter] = useState("All");
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [search, setSearch] = useState("");

  const counts = PIPELINE_STAGES.reduce((acc,s)=>{ acc[s]=allApps.filter(a=>(a.status||"Sent")===s).length; return acc; }, { All: allApps.length });

  const filtered = allApps
    .filter(a => stageFilter==="All" || (a.status||"Sent")===stageFilter)
    .filter(a => !search.trim() || (a.name||"").toLowerCase().includes(search.toLowerCase()) || (a.email||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.ts-a.ts);

  const selectedApp = allApps.find(a=>a.id===selectedAppId) || filtered[0] || null;

  // ── Pipeline rail ──
  const renderPipelineRail = () => (
    <div>
      <div style={{ position:"relative", marginBottom:10 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names or email…"
          style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", fontSize:13, color:C.textDark }}/>
      </div>
      {[["All","All applications"],...PIPELINE_STAGES.map(s=>[s,s])].map(([key,label])=>(
        <button key={key} className="tap" onClick={()=>{ setStageFilter(key); setSelectedAppId(null); }}
          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 13px", marginBottom:4, background:stageFilter===key?C.terracottaL:"#fff", border:`1px solid ${stageFilter===key?C.terracottaM:C.border}`, borderRadius:10, cursor:"pointer" }}>
          <span style={{ color:stageFilter===key?C.terracotta:C.textDark, fontSize:13, fontWeight:stageFilter===key?700:500 }}>{label}</span>
          <span style={{ background:key!=="All"?STAGE_BG[key]:C.bgSoft, color:key!=="All"?STAGE_FG[key]:C.textMid, fontSize:12, fontWeight:700, minWidth:24, textAlign:"center", padding:"2px 8px", borderRadius:20 }}>{counts[key]||0}</span>
        </button>
      ))}
    </div>
  );

  // ── Applicant list (mobile + the middle column on desktop) ──
  const renderApplicantList = (onPick) => (
    <div>
      {filtered.length===0 && (
        <div style={{ padding:"30px 16px", textAlign:"center", color:C.textFaint, fontSize:13, background:"#fff", borderRadius:11, border:`1px dashed ${C.border}` }}>
          {allApps.length===0 ? "No applications yet" : `No ${stageFilter==="All"?"":stageFilter+" "}applications`}
        </div>
      )}
      {filtered.map(a=>(
        <button key={a.id} className="tap" onClick={()=>onPick(a.id)}
          style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:11, padding:"12px 13px", marginBottom:6, background:selectedApp?.id===a.id?C.terracottaL:"#fff", border:`1px solid ${selectedApp?.id===a.id?C.terracottaM:C.border}`, borderRadius:12, cursor:"pointer" }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#fff", fontWeight:700, flexShrink:0 }}>
            {(a.name||"?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:C.textDark, fontWeight:700, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.name}</div>
            {!sel && <div style={{ color:C.textSoft, fontSize:11, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a._job?.title}</div>}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
              <span style={{ background:STAGE_BG[a.status||"Sent"], color:STAGE_FG[a.status||"Sent"], fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>{a.status||"Sent"}</span>
              <span style={{ color:C.textFaint, fontSize:11 }}>{ago(a.ts)} ago</span>
            </div>
          </div>
          {(a.resume_url||a.cover_url) && <span style={{ color:C.sage, fontSize:13 }}>📎</span>}
        </button>
      ))}
    </div>
  );

  // ── DESKTOP: three-column pipeline | list | detail ──
  if (isDesktop) {
    return (
      <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          {sel && <button className="tap" onClick={()=>setSel(null)} style={{ background:"none", border:"none", padding:2 }}><Icon name="back" size={20} color={C.textDark}/></button>}
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:C.textDark, fontWeight:700 }}>{sel?sel.title:"All Applications"}</div>
          <span style={{ color:C.textSoft, fontSize:13 }}>· {allApps.length} total</span>
        </div>
        <div style={{ flex:1, display:"grid", gridTemplateColumns:"230px 300px 1fr", overflow:"hidden" }}>
          <div style={{ borderRight:`1px solid ${C.border}`, overflowY:"auto", padding:14, background:C.bgSoft }}>{renderPipelineRail()}</div>
          <div style={{ borderRight:`1px solid ${C.border}`, overflowY:"auto", padding:14 }}>{renderApplicantList(setSelectedAppId)}</div>
          <div style={{ overflowY:"auto", padding:20 }}>
            {selectedApp
              ? <ApplicantDetailCard a={selectedApp} job={selectedApp._job} user={user} setJobs={setJobs} setSupabaseApps={setSupabaseApps} setMessages={setMessages} setTab={setTab}/>
              : <div style={{ textAlign:"center", color:C.textFaint, fontSize:14, marginTop:60 }}>Select an applicant to view details</div>
            }
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE: list → drill into detail ──
  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        {(sel || selectedAppId) && <button className="tap" onClick={()=>{ if(selectedAppId) setSelectedAppId(null); else setSel(null); }} style={{ background:"none", border:"none", padding:2 }}><Icon name="back" size={20} color={C.textDark}/></button>}
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:19, color:C.textDark, fontWeight:700 }}>{selectedAppId&&selectedApp?selectedApp.name:sel?sel.title:"Applications"}</div>
      </div>

      {selectedAppId && selectedApp ? (
        <ApplicantDetailCard a={selectedApp} job={selectedApp._job} user={user} setJobs={setJobs} setSupabaseApps={setSupabaseApps} setMessages={setMessages} setTab={setTab}/>
      ) : (
        <>
          {/* Stage filter chips */}
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:10, marginBottom:6 }}>
            {[["All",`All ${counts.All}`],...PIPELINE_STAGES.map(s=>[s,`${s} ${counts[s]||0}`])].map(([key,label])=>(
              <button key={key} className="tap" onClick={()=>setStageFilter(key)}
                style={{ flexShrink:0, background:stageFilter===key?C.terracotta:"#fff", color:stageFilter===key?"#fff":C.textMid, border:`1px solid ${stageFilter===key?C.terracotta:C.border}`, borderRadius:20, padding:"6px 13px", fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>
                {label}
              </button>
            ))}
          </div>
          {renderApplicantList(setSelectedAppId)}
        </>
      )}
    </div>
  );
}

function EmployerDash({ user, jobs, setJobs, messages, setMessages, codes, setCodes, onLogout, paymentStatus, setPaymentStatus, altAccount, onSwitchAccount }) {
  // Read tier/mode from URL on mount (passed from landing page Get Started buttons)
  const _urlParams = new URLSearchParams(window.location.search);
  const _urlTier = _urlParams.get('tier') || 'bronze';
  const _urlMode = _urlParams.get('mode') || 'listing';
  const _tierMap = { bronze:{ key:'bronze', price:50, priceId:'price_1TfwBfGkG9EGtGJgBv341e2n', featured:false }, silver:{ key:'silver', price:70, priceId:'price_1TfwBlGkG9EGtGJgGxDjQEhS', featured:true }, gold:{ key:'gold', price:100, priceId:'price_1TfwBrGkG9EGtGJg6O8z5oAu', featured:true } };
  const _initTier = _tierMap[_urlTier] || _tierMap.bronze;
  const _viewParam = _urlParams.get('view');
  const _jobIdParam = _urlParams.get('jobId');

  const [tab, setTabRaw] = useState(_urlParams.get('tier') ? "post" : (_viewParam==="apps" ? "apps" : "feed"));
  const [prevTab, setPrevTab] = useState("feed");
  const setTab = (next) => { setTabRaw(prev => { setPrevTab(prev); return next; }); };
  const goBack = () => setTabRaw(prevTab);
  const [expandedJob, setExpandedJob] = useState(null);
  const [emailNotifs, setEmailNotifs] = useState(()=>localStorage.getItem('hs_email_notifs')!=='false');

  // Clean URL after reading tier param so back-nav isn't affected
  useEffect(()=>{
    if (window.location.search.includes('tier=') || window.location.search.includes('mode=') || window.location.search.includes('view=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const toggleEmailNotifs = async (val) => {
    setEmailNotifs(val);
    localStorage.setItem('hs_email_notifs', val.toString());
    try { await supabase.from('profiles').update({ email_notifications: val }).eq('id', user.id); } catch(e) {}
  };
  const [venueProfile, setVenueProfile] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [sel, setSel] = useState(null);
  const [appStatusFilter, setAppStatusFilter] = useState("All");
  const [supabaseApps, setSupabaseApps] = useState([]);
  const [lastSeenApps, setLastSeenApps] = useState(() => parseInt(localStorage.getItem('hs_last_seen_apps')||'0'));
  const [newAppsCount, setNewAppsCount] = useState(0);

  // Load applications from Supabase on mount (and refresh when switching tabs)
  useEffect(()=>{
    const loadApps = async () => {
      try {
        const { data } = await supabase
          .from('applications')
          .select('*')
          .order('created_at', { ascending:false });
        if (data) {
          const newCount = data.filter(a => new Date(a.created_at).getTime() > lastSeenApps).length;
          setNewAppsCount(newCount);
          setSupabaseApps(data);
        }
      } catch(e) { console.warn('Load applications error:', e); }
    };
    loadApps();
  }, [tab, user.id]);

  // If arriving from email "View all applicants", select that job once loaded
  useEffect(()=>{
    if (_jobIdParam && jobs.length) {
      const target = jobs.find(j => String(j.id) === String(_jobIdParam));
      if (target) setSel(target);
    }
  }, [jobs.length]);
  const [nj, setNj] = useState({ title:"", short:"", full:"", salary:"", salaryBand:"$70–90k", type:"Full-time", country:"Australia", state:"", city:"", sector:"", roleType:"", link:"", tags:[], featured:_initTier.featured, tier:_initTier.key, tierPrice:_initTier.price, tierPriceId:_initTier.priceId });
  const [photos, setPhotos] = useState([null,null,null,null,null]);
  const [videoFile, setVideoFile] = useState(null);
  // Image cropper: stash raw src + a callback that receives the cropped result
  const [cropState, setCropState] = useState(null); // { src, onDone }
  const pickAndCrop = (onDone) => {
    const r=document.createElement("input"); r.type="file"; r.accept="image/*";
    r.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=ev=>setCropState({ src:ev.target.result, onDone }); rd.readAsDataURL(f); };
    r.click();
  };
  const [posted, setPosted] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [checkoutJob, setCheckoutJob] = useState(null);
  const [editId, setEditId] = useState(null); // when set, the Post form is editing this job id
  const [reactivateJob, setReactivateJob] = useState(null); // expired job being re-activated
  const [myJobs, setMyJobs] = useState(null); // all of employer's jobs incl. expired; null until loaded
  // Load full list (including expired/inactive) for the Mine tab
  useEffect(()=>{
    let alive = true;
    fetchMyJobs(user.id).then(list=>{ if(alive && Array.isArray(list)) setMyJobs(list); }).catch(()=>{});
    return ()=>{ alive = false; };
  }, [user.id, jobs]);
  // Active listings: prefer the live `jobs` list (has fresh apps/views), fall back to myJobs
  const _attachApps = (j) => {
    const jobApps = supabaseApps
      .filter(a => String(a.job_id) === String(j.id))
      .map(a => ({
        id: a.id, uid: a.applicant_id, name: a.name, email: a.email, phone: a.phone,
        msg: a.message, visa: a.visa, availability: a.availability || [], hours: a.hours || [],
        notice: a.notice, screeningAnswers: a.screening_answers || {},
        resume: a.resume_name ? { name:a.resume_name, size:a.resume_size } : null, resume_url: a.resume_url, resume_name: a.resume_name,
        cover: a.cover_name ? { name:a.cover_name } : null, cover_url: a.cover_url, cover_name: a.cover_name,
        status: a.status || 'Sent', ts: new Date(a.created_at).getTime(),
      }));
    return jobApps.length ? { ...j, apps: jobApps } : { ...j, apps: j.apps || [] };
  };
  const mine = (myJobs || jobs.filter(j=>j.empId===user.id)).filter(j=>j.empId===user.id && (j.active!==false)).map(_attachApps);
  const expiredMine = (myJobs || []).filter(j=>j.empId===user.id && j.active===false).map(_attachApps);
  const apps = mine.reduce((s,j)=>s+(j.apps?.length||0),0);
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 13px", color:C.textDark, fontSize:14 };

  // Load an existing job into the Post form for editing
  const startEdit = (j) => {
    // Split a combined location string back into country/state/city where possible
    setNj({
      title: j.title||"", short: j.short||"", full: j.full||j.short||"",
      salary: j.salary||"", salaryBand: j.salaryBand||"$70–90k", type: j.type||"Full-time",
      country: j.country||"Australia", state: j.state||"", city: j.city||"",
      sector: j.sector||"", roleType: j.roleType||"", link: (j.link&&j.link!=="#")?j.link:"",
      applyEmail: j.applyEmail||"", venueName: j.venue||"", address: j.address||"", tags: j.tags||[],
      featured: j.featured||false, tier: j.tier||"bronze",
      sellingPoints: j.sellingPoints||["","",""], screeningQ: j.screeningQ||{},
    });
    // Photos: keep existing (https URLs / placeholders) in the 5 slots
    const ph = [null,null,null,null,null];
    (j.photos||[]).slice(0,5).forEach((p,i)=>{ ph[i] = p; });
    setPhotos(ph);
    setVideoFile(j.video||null);
    setEditId(j.id);
    setTab("post");
    setPosted(false);
  };

  const buildJobData = () => {
    const fp = photos.filter(Boolean);
    const locStr = [nj.city, nj.state, nj.country].filter(Boolean).join(", ") || "Australia";
    // Pass photos as-is (base64 or number placeholders) — supabase.js handles upload
    const photoData = fp.length > 0 ? fp : [0, 1, 2];
    const hasActiveSub = user.subscription_active && (user.subscription_limit||0) > 0;
    return { empId:user.id, title:nj.title, venue:nj.venueName?.trim()||user.name, loc:locStr, address:nj.address?.trim()||"", country:nj.country, state:nj.state, city:nj.city, sector:nj.sector, roleType:nj.roleType, salary:nj.salary||"Competitive", salaryBand:nj.salaryBand, type:nj.type, tags:nj.tags, short:nj.short, full:nj.full||nj.short, link:nj.link||"#", applyEmail:nj.applyEmail?.trim()||user.email||"", photos:photoData, video:videoFile||null, verified:user.verified, featured:nj.featured, tier:nj.tier||"bronze", paid:hasActiveSub, active:true, avatar_url:user.avatar_url||null };
  };

  const resetForm = () => {
    setNj({title:"",short:"",full:"",salary:"",salaryBand:"$70–90k",type:"Full-time",country:"Australia",state:"",city:"",sector:"",roleType:"",link:"",tags:[],featured:false});
    setPhotos([null,null,null,null,null]);
    setVideoFile(null);
    setEditId(null);
  };

  // Save edits to an existing listing (no payment — already paid)
  const saveEdit = async () => {
    if(!nj.title.trim()) return;
    setPosting(true);
    const jobData = buildJobData();
    try {
      const updated = await sbUpdateJobFull(editId, jobData);
      setJobs(p=>p.map(j=>j.id===editId ? { ...j, ...updated } : j));
    } catch(e) {
      console.warn('Edit save failed:', e);
      // optimistic local update as fallback
      setJobs(p=>p.map(j=>j.id===editId ? { ...j, ...jobData, id:editId } : j));
    }
    setPosting(false);
    setPosted(true);
    setTimeout(()=>{ setPosted(false); setTab("feed"); resetForm(); }, 1800);
  };

  const post = async () => {
    if(!nj.title.trim()) return;
    const jobData = buildJobData();
    if(user.isTrial) {
      setPosting(true);
      try {
        const saved = await sbCreateJob(user.id, jobData);
        setJobs(p=>[saved,...p]);
        // Notify followers of new listing
        try {
          const { data: followers } = await supabase.from('following').select('follower_id').eq('following_id', user.id);
          if (followers?.length > 0) {
            const notifs = followers.map(f=>({
              user_id: f.follower_id,
              type: 'listing',
              text: `New listing from ${user.name}`,
              sub: `${jobData.title} · ${jobData.loc}`,
              icon: '🍽️',
              read: false,
            }));
            await supabase.from('notifications').insert(notifs);
          }
        } catch(e) { console.warn('Follower notify error:', e); }
      } catch(e) {
        console.warn('Supabase save failed, using local:', e);
        setJobs(p=>[{...jobData, id:"j"+Date.now(), ts:Date.now(), apps:[], views:0},...p]);
      }
      setPosting(false);
      setPosted(true);
      setTimeout(()=>{ setPosted(false); setTab("feed"); resetForm(); }, 2500);
    } else {
      // Paid listing: create the job as an unpaid draft FIRST so the Stripe
      // webhook has a real jobId to flip to paid/active after payment.
      setPosting(true);
      try {
        const draft = { ...jobData, paid:false, active:false };
        const saved = await sbCreateJob(user.id, draft);
        setCheckoutJob(saved); // saved.id is the real Supabase row id
      } catch(e) {
        console.warn('Draft job save failed, proceeding without persisted id:', e);
        setCheckoutJob(jobData); // fallback — checkout still works, webhook just can't match
      }
      setPosting(false);
    }
  };
  const publishAfterPayment = async () => {
    // Payment succeeded. The webhook marks the job paid:true/active:true server-side.
    // Here we just refresh the local list from the DB so it shows immediately.
    setPosting(true);
    try {
      const fresh = await fetchJobs();
      if (Array.isArray(fresh)) setJobs(fresh);
    } catch(e) {
      // Fallback: optimistically add the checkout job locally
      if (checkoutJob) setJobs(p=>[{ ...checkoutJob, paid:true, active:true, ts:Date.now(), apps:[], views:0 },...p]);
    }
    setCheckoutJob(null);
    setPosting(false);
    setPosted(true);
    setTimeout(()=>{ setPosted(false); setTab("feed"); resetForm(); }, 2500);
  };
  const uploadVideo = () => { const r=document.createElement("input"); r.type="file"; r.accept="video/*"; r.onchange=e=>{ const f=e.target.files[0]; if(!f) return; if(f.size>50*1048576){alert("Keep reel under 50MB.");return;} const rd=new FileReader(); rd.onload=ev=>setVideoFile(ev.target.result); rd.readAsDataURL(f); }; r.click(); };
  const fmtS = b => !b?"":b<1048576?`${(b/1024).toFixed(0)}KB`:`${(b/1048576).toFixed(1)}MB`;

  const NavBtn = ({ t, ic, l, badge }) => {
    const isPost = t==="post";
    const isPostedTab = isPost && posted;
    const isActive = tab===t;
    const iconColor = isPostedTab ? C.sage : isActive ? C.terracotta : C.textSoft;
    const labelColor = isPostedTab ? C.sage : isActive ? C.terracotta : C.textSoft;
    return (
      <button className="tap" onClick={()=>{ if(t==="post" && editId){ resetForm(); } setTab(t); }}
        style={{ flex:1, padding:"10px 0 8px", border:"none", background:isPostedTab?"#ECFDF5":"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:3, position:"relative", transition:"background 0.3s", borderTop:isPostedTab?`2px solid ${C.sage}`:"2px solid transparent" }}>
        {isPostedTab
          ? <span style={{ fontSize:22 }}>✅</span>
          : <Icon name={ic} size={24} color={iconColor} fill={isActive&&ic==="person"?C.terracottaL:"none"}/>
        }
        {badge>0 && <div style={{ position:"absolute", top:6, right:"calc(50% - 16px)", width:16, height:16, borderRadius:"50%", background:C.terracotta, border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ color:"#fff", fontSize:9, fontWeight:700 }}>{badge}</span></div>}
        <span style={{ fontSize:10, color:labelColor, fontWeight:isActive||isPostedTab?600:400 }}>
          {isPostedTab ? "Posted!" : l}
        </span>
      </button>
    );
  };

  const isDesktop = useIsDesktop();

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#fff", overflow:"hidden", maxWidth: isDesktop?"1200px":"100%", margin:"0 auto" }}>
      <style>{G}</style>
      {paymentStatus==='success' && (
        <div style={{ background:"#ECFDF5", borderBottom:"1px solid #86EFAC", padding:"11px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>🎉</span>
          <div style={{ flex:1 }}>
            <div style={{ color:"#166534", fontWeight:700, fontSize:14 }}>Payment successful — listing is live!</div>
            <div style={{ color:"#166534", fontSize:12, opacity:0.8 }}>A GST receipt has been sent to your email by Stripe.</div>
          </div>
          <button onClick={()=>setPaymentStatus(null)} style={{ background:"none", border:"none", color:"#166534", fontSize:20, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
      )}
      {paymentStatus&&paymentStatus.startsWith('subscription_success_') && (
        <div style={{ background:"#ECFDF5", borderBottom:"1px solid #86EFAC", padding:"11px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>🎉</span>
          <div style={{ flex:1 }}>
            <div style={{ color:"#166534", fontWeight:700, fontSize:14 }}>
              Welcome to {paymentStatus.replace('subscription_success_','').charAt(0).toUpperCase()+paymentStatus.replace('subscription_success_','').slice(1)} Plan!
            </div>
            <div style={{ color:"#166534", fontSize:12, opacity:0.8 }}>Your subscription is active. You can now post jobs up to your plan limit.</div>
          </div>
          <button onClick={()=>setPaymentStatus(null)} style={{ background:"none", border:"none", color:"#166534", fontSize:20, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
      )}
      {(paymentStatus==='cancelled'||paymentStatus==='subscription_cancelled') && (
        <div style={{ background:"#FEF2F0", borderBottom:`1px solid ${C.error}30`, padding:"11px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>ℹ️</span>
          <div style={{ flex:1 }}>
            <div style={{ color:C.error, fontWeight:700, fontSize:14 }}>Payment cancelled</div>
            <div style={{ color:C.error, fontSize:12, opacity:0.8 }}>No charge was made.</div>
          </div>
          <button onClick={()=>setPaymentStatus(null)} style={{ background:"none", border:"none", color:C.error, fontSize:20, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:"rgba(255,255,255,0.96)", backdropFilter:"blur(10px)", flexShrink:0 }}>
        {tab!=="feed" && (
          <button className="tap" onClick={goBack} style={{ background:"none", border:"none", padding:"2px 8px 2px 0", marginRight:4, display:"flex", alignItems:"center" }} title="Back">
            <Icon name="back" size={22} color={C.textDark}/>
          </button>
        )}
        <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:20, color:C.textDark, flex:1 }}>{user.avatar} {user.name}</div>
        {user.isTrial
          ? <span style={{ background:C.sageL, color:C.sage, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, border:`1px solid ${C.sage}50`, marginRight:10 }}>TRIAL</span>
          : <span style={{ background:C.terracottaL, color:C.terracotta, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, border:`1px solid ${C.terracottaM}`, marginRight:10 }}>EMPLOYER</span>
        }
        <AvatarMenu user={user} onDashboard={()=>setTab("feed")} onLogout={onLogout}/>
      </div>

      <div style={{ flex:1, overflow:"hidden" }}>
        {/* Browse */}
        {tab==="browse" && (
          <EmployerBrowse jobs={jobs} user={user} onExpand={setExpandedJob}/>
        )}

        {/* Mine */}
        {tab==="feed" && (
          <div style={{ height:"100%", overflowY:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1, background:C.border, flexShrink:0 }}>
              {[["My Listings",mine.length],["Applications",apps],["Followers","—"]].map(([l,v])=>(
                <div key={l} style={{ background:"#fff", padding:"14px 10px", textAlign:"center" }}>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:C.terracotta, fontWeight:700 }}>{v}</div>
                  <div style={{ color:C.textFaint, fontSize:11, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:"12px 12px 4px" }}>
              <button className="tap" onClick={()=>setTab("browse")}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"11px 0", color:C.textDark, fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:12 }}>
                <Icon name="home" size={16} color={C.textMid}/> Browse all listings
              </button>
            </div>
            <div style={{ padding:"0 12px 12px" }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700, color:C.textDark, marginBottom:12 }}>My Listings</div>
              {mine.map(j=>(
                <MineJobCard
                  key={j.id}
                  job={j}
                  onEdit={()=>startEdit(j)}
                  onApps={()=>{ setSel(j); setTab("apps"); }}
                  onExpand={()=>setExpandedJob(j)}
                />
              ))}
              {/* Add new listing card */}
              <button className="tap" onClick={()=>{ resetForm(); setTab("post"); }}
                style={{ width:"100%", background:"#fff", border:`2px dashed ${C.borderMid}`, borderRadius:14, padding:"24px 0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, cursor:"pointer", marginBottom:16 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:C.terracottaL, border:`2px solid ${C.terracottaM}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name="plus" size={22} color={C.terracotta}/>
                </div>
                <div style={{ fontWeight:700, fontSize:14, color:C.textDark }}>Add new listing</div>
                <div style={{ fontSize:12, color:C.textSoft }}>Bronze $50 · Silver $70 · Gold $100</div>
              </button>

              {/* Completed / expired listings */}
              {expiredMine.length>0 && (
                <div style={{ marginTop:24 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0 14px", color:C.textFaint, fontSize:12 }}>
                    <div style={{ flex:1, height:1, background:C.border }}/>
                    <span style={{ fontWeight:600, letterSpacing:0.5 }}>COMPLETED LISTINGS</span>
                    <div style={{ flex:1, height:1, background:C.border }}/>
                  </div>
                  {expiredMine.map(j=>{ const first=j.photos?.[0]; const isd=isData(first); return (
                    <div key={j.id} style={{ marginBottom:12, background:"#fff", border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", opacity:0.92 }}>
                      <div style={{ display:"flex", gap:12, padding:12 }}>
                        <div style={{ width:64, height:64, borderRadius:10, overflow:"hidden", flexShrink:0, background:PBG[(typeof first==="number"?first:0)%PBG.length], position:"relative" }}>
                          {isd ? <img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", filter:"grayscale(0.4)" }}/> : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, opacity:0.4 }}>🍽️</div>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:C.textDark, marginBottom:2 }}>{j.title}</div>
                          <div style={{ color:C.textSoft, fontSize:11, marginBottom:6 }}>{j.type} · {j.salary}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#FEE2E2", border:"1px solid #FCA5A5", color:"#B91C1C", fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>
                              <Icon name="clock" size={10} color="#B91C1C"/> Expired
                            </span>
                            {(j.apps?.length||0)>0 && (
                              <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:C.sageL, border:`1px solid ${C.sage}40`, color:C.sage, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>
                                <Icon name="briefcase" size={10} color={C.sage}/> {j.apps.length} applicant{j.apps.length!==1?"s":""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Actions: view applicants (kept after expiry), edit, re-activate */}
                      <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
                        <button className="tap" onClick={()=>{ setSel(j); setTab("apps"); }}
                          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#fff", border:"none", borderRight:`1px solid ${C.border}`, padding:"11px 0", color:(j.apps?.length||0)>0?C.terracotta:C.textSoft, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          <Icon name="briefcase" size={13} color={(j.apps?.length||0)>0?C.terracotta:C.textSoft}/> Applicants ({j.apps?.length||0})
                        </button>
                        <button className="tap" onClick={()=>{ startEdit(j); setReactivateJob(j); }}
                          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#fff", border:"none", padding:"11px 0", color:C.textMid, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          <Icon name="edit" size={13} color={C.textMid}/> Edit & relist
                        </button>
                      </div>
                      <button className="tap" onClick={()=>setReactivateJob(j)}
                        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:7, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", padding:"11px 0", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                        ↻ Re-activate listing
                      </button>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Post */}
        {tab==="post" && !posted && (
          <div style={{ height:"100%", overflowY:"auto", padding:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button className="tap" onClick={()=>{ resetForm(); goBack(); }} style={{ background:"none", border:"none", padding:"4px 2px", display:"flex", alignItems:"center" }}><Icon name="back" size={22} color={C.textDark}/></button>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:21, color:C.textDark, fontWeight:700 }}>{editId ? "Edit Listing" : "New Job Listing"}</div>
              </div>
              {editId && <button className="tap" onClick={()=>{ resetForm(); goBack(); }} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 14px", color:C.textMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>}
            </div>
            <div style={{ background:"#fff", borderRadius:13, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.5, fontWeight:600 }}>Photos</div>
                <div style={{ color:C.textFaint, fontSize:11 }}>{photos.filter(Boolean).length}/5</div>
              </div>
              <SortablePhotoGrid
                photos={photos.filter(Boolean)}
                onPhotos={newList=>{ const padded = [...newList]; while(padded.length<5) padded.push(null); setPhotos(padded); }}
                maxPhotos={5}
              />
            </div>
            <div style={{ background:"#fff", borderRadius:13, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.5, fontWeight:600, marginBottom:9 }}>Reel <span style={{ color:C.textFaint, fontWeight:400, letterSpacing:0, textTransform:"none", fontSize:11 }}>(optional · max 50MB)</span></div>
              {!videoFile ? (
                <div className="file-zone tap" onClick={uploadVideo} style={{ border:`1.5px dashed ${C.borderMid}`, borderRadius:11, padding:"16px 14px", textAlign:"center", cursor:"pointer", background:C.bgSoft }}>
                  <div style={{ fontSize:26, marginBottom:5 }}>🎬</div>
                  <div style={{ color:C.textMid, fontSize:13, fontWeight:500 }}>Upload a short reel</div>
                  <div style={{ color:C.textFaint, fontSize:11, marginTop:2 }}>MP4, MOV or WebM</div>
                </div>
              ) : (
                <div style={{ borderRadius:11, overflow:"hidden", border:`1.5px solid ${C.sage}`, position:"relative" }}>
                  <video src={videoFile} autoPlay muted loop playsInline style={{ width:"100%", maxHeight:160, objectFit:"cover", display:"block" }}/>
                  <button className="tap" onClick={()=>setVideoFile(null)} style={{ position:"absolute", top:7, right:7, width:24, height:24, borderRadius:"50%", background:"rgba(0,0,0,0.65)", border:"none", color:"#fff", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"6px 10px", background:"linear-gradient(to top,rgba(0,0,0,0.5),transparent)" }}><span style={{ color:"#fff", fontSize:11, fontWeight:600 }}>▶ Reel ready</span></div>
                </div>
              )}
            </div>
            {/* Venue Name — above job title */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Venue Name <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional — defaults to your profile name)</span></div>
              <input value={nj.venueName||""} onChange={e=>setNj(j=>({...j,venueName:e.target.value}))} placeholder="Leave blank to use your profile name" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 13px", color:C.textDark, fontSize:14 }}/>
            </div>
            {/* Venue Address — so candidates can see the location */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Venue Address <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional — shown on the listing)</span></div>
              <input value={nj.address||""} onChange={e=>setNj(j=>({...j,address:e.target.value}))} placeholder="e.g. 12 Marine Parade, Burleigh Heads QLD 4220" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 13px", color:C.textDark, fontSize:14 }}/>
            </div>
            {[["Job Title *","title","e.g. Head Chef…"],["Salary / Rate","salary","e.g. $70k–$85k"],["Apply Link","link","https://…"]].map(([l,k,p])=>(
              <div key={k} style={{ marginBottom:12 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>{l}</div>
                <input value={nj[k]} onChange={e=>setNj(j=>({...j,[k]:e.target.value}))} placeholder={p} style={IS}/>
              </div>
            ))}
            {/* Application contact email */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>Application Email <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(where to send applications)</span></div>
              <input value={nj.applyEmail||""} onChange={e=>setNj(j=>({...j,applyEmail:e.target.value}))} placeholder={user.email||"hiring@yourvenue.com"} type="email" style={IS}/>
              <div style={{ color:C.textFaint, fontSize:11, marginTop:5, lineHeight:1.4 }}>📥 You'll get an email for each applicant, and every application is also saved to your dashboard under "Applications". Leave blank to use your account email.</div>
            </div>
            {[["Employment Type","type",["Full-time","Part-time","Casual","Contract"]],["Salary Band","salaryBand",SALARY_BANDS]].map(([l,k,opts])=>(
              <div key={k} style={{ marginBottom:12 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>{l}</div>
                <select value={nj[k]} onChange={e=>setNj(j=>({...j,[k]:e.target.value}))} style={IS}>{opts.map(o=><option key={o}>{o}</option>)}</select>
              </div>
            ))}
            {/* Location */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>Country</div>
              <select value={nj.country} onChange={e=>setNj(j=>({...j,country:e.target.value,state:"",city:""}))} style={IS}>
                {Object.keys(LOCATIONS).map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>State / Region</div>
                <select value={nj.state} onChange={e=>setNj(j=>({...j,state:e.target.value,city:""}))} style={IS}>
                  <option value="">All states</option>
                  {Object.keys(LOCATIONS[nj.country]||{}).map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>City</div>
                <select value={nj.city} onChange={e=>setNj(j=>({...j,city:e.target.value}))} style={IS}>
                  <option value="">All cities</option>
                  {(LOCATIONS[nj.country]?.[nj.state]||[]).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Sector + Role Type */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>Sector</div>
                <select value={nj.sector} onChange={e=>setNj(j=>({...j,sector:e.target.value}))} style={IS}>
                  <option value="">Select…</option>
                  {SECTORS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>Role Type</div>
                <select value={nj.roleType} onChange={e=>setNj(j=>({...j,roleType:e.target.value}))} style={IS}>
                  <option value="">Select…</option>
                  {Object.entries(HOSPO_ROLES).map(([dept,roles])=><optgroup key={dept} label={dept}>{roles.map(r=><option key={r}>{r}</option>)}</optgroup>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:8, fontWeight:600 }}>Role Tags <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(tap to add)</span></div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {ROLE_TAGS.map(t=><button key={t} className="tap" onClick={()=>setNj(j=>({ ...j, tags:j.tags.includes(t)?j.tags.filter(x=>x!==t):[...j.tags,t] }))} style={{ background:nj.tags.includes(t)?C.terracottaL:C.bgSoft, border:`1px solid ${nj.tags.includes(t)?C.terracottaM:C.border}`, borderRadius:20, padding:"5px 12px", color:nj.tags.includes(t)?C.terracotta:C.textSoft, fontSize:12, fontWeight:nj.tags.includes(t)?600:400, transition:"all 0.15s" }}>{t}</button>)}
              </div>
            </div>
            {!user.isTrial && !editId && (
              <div style={{ marginBottom:16 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:8, fontWeight:600 }}>Choose Your Listing Type</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { key:"bronze", label:"🥉 Bronze — Standard", price:50, priceId:"price_1TfwBfGkG9EGtGJgBv341e2n", perks:["Listed in the feed","Candidates can apply","7-day listing"], missing:["Not featured","No priority placement"] },
                    { key:"silver", label:"🥈 Silver — Featured", price:70, priceId:"price_1TfwBlGkG9EGtGJgGxDjQEhS", perks:["Everything in Bronze","⭐ Pinned to top of feed","Priority placement for 7 days","Featured badge on listing"], missing:[] },
                    { key:"gold",   label:"🥇 Gold — Premium",   price:100, priceId:"price_1TfwBrGkG9EGtGJg6O8z5oAu", perks:["Everything in Silver","🔥 Maximum visibility","Highlighted in search results","30-day listing","Dedicated support"], missing:[] },
                  ].map(tier=>(
                    <div key={tier.key} className="tap" onClick={()=>setNj(j=>({...j, tier:tier.key, featured:tier.key!=="bronze", tierPrice:tier.price, tierPriceId:tier.priceId}))}
                      style={{ border:`2px solid ${nj.tier===tier.key?C.terracotta:C.border}`, borderRadius:13, padding:"14px 15px", background:nj.tier===tier.key?C.terracottaL:"#fff", cursor:"pointer", transition:"all 0.2s" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:22, height:22, borderRadius:"50%", background:nj.tier===tier.key?C.terracotta:C.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {nj.tier===tier.key && <Icon name="check" size={13} color="#fff"/>}
                          </div>
                          <span style={{ fontWeight:700, fontSize:14, color:nj.tier===tier.key?C.terracotta:C.textDark }}>{tier.label}</span>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:nj.tier===tier.key?C.terracotta:C.textDark }}>${tier.price}</div>
                          <div style={{ color:C.textFaint, fontSize:10 }}>+ GST one-time</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                        {tier.perks.map(p=><span key={p} style={{ background:nj.tier===tier.key?"rgba(196,98,58,0.12)":C.bgSoft, color:nj.tier===tier.key?C.terracotta:C.textSoft, fontSize:11, padding:"2px 8px", borderRadius:20, border:`1px solid ${nj.tier===tier.key?C.terracottaM:C.border}` }}>{p}</span>)}
                        {tier.missing.map(p=><span key={p} style={{ background:"#f5f5f5", color:C.textFaint, fontSize:11, padding:"2px 8px", borderRadius:20, border:"1px solid #eee", textDecoration:"line-through" }}>{p}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Upsell / downsell nudge — changes based on selected tier */}
                {nj.tier==="bronze" && (
                  <div style={{ marginTop:8, padding:"10px 13px", background:"#FFF8EE", borderRadius:10, border:"1px solid #F5A62333", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <div style={{ fontSize:12, color:C.textMid }}>⭐ <strong>Silver</strong> gets you pinned to the top of the feed for 30 days — 3× more applications on average.</div>
                    <button className="tap" onClick={()=>setNj(j=>({...j,tier:"silver",featured:true,tierPrice:70,tierPriceId:"price_1TfwBlGkG9EGtGJgGxDjQEhS"}))} style={{ flexShrink:0, background:"#F5A623", border:"none", borderRadius:20, padding:"4px 12px", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Upgrade $70 →</button>
                  </div>
                )}
                {nj.tier==="silver" && (
                  <div style={{ marginTop:8, padding:"10px 13px", background:C.terracottaL, borderRadius:10, border:`1px solid ${C.terracottaM}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <div style={{ fontSize:12, color:C.textMid }}>🥇 <strong>Gold</strong> gets you shared on our Instagram & Facebook + applicant auto-ranking.</div>
                    <button className="tap" onClick={()=>setNj(j=>({...j,tier:"gold",featured:true,tierPrice:100,tierPriceId:"price_1TfwBrGkG9EGtGJg6O8z5oAu"}))} style={{ flexShrink:0, background:C.terracotta, border:"none", borderRadius:20, padding:"4px 12px", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Upgrade $100 →</button>
                  </div>
                )}
                {/* Subscription option */}
                <div style={{ marginTop:10, padding:"12px 14px", background:C.sageL, borderRadius:12, border:`1px solid ${C.sage}40` }}>
                  <div style={{ color:C.sage, fontSize:12, fontWeight:600, marginBottom:2 }}>💡 Hiring regularly? Save with a subscription</div>
                  <div style={{ color:C.textSoft, fontSize:11 }}>Starter $99/mo · Growth $199/mo · Pro $399/mo — unlimited listings, priority support</div>
                  <button className="tap" onClick={()=>setShowSubModal(true)} style={{ marginTop:6, background:"none", border:`1px solid ${C.sage}`, borderRadius:20, padding:"4px 12px", color:C.sage, fontSize:11, fontWeight:600, cursor:"pointer" }}>View Plans →</button>
                </div>
              </div>
            )}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>Short Description</div>
              <textarea value={nj.short} onChange={e=>setNj(j=>({...j,short:e.target.value}))} placeholder="Brief intro on the feed…" rows={3} style={{...IS,resize:"none"}}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:600 }}>Full Description</div>
              <RichTextEditor key={nj.title+"-emp"} value={nj.full} onChange={html=>setNj(j=>({...j,full:html}))} placeholder="Full details, requirements, benefits…" />
            </div>

            {/* Key selling points */}
            <div style={{ marginBottom:16 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:4, fontWeight:600 }}>Key Selling Points <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional)</span></div>
              <div style={{ color:C.textFaint, fontSize:11, marginBottom:8 }}>Up to 3 reasons candidates should choose this role</div>
              {[0,1,2].map(i=>(
                <input key={i} value={(nj.sellingPoints||[])[i]||""} onChange={e=>setNj(j=>{ const sp=[...(j.sellingPoints||["","",""])]; sp[i]=e.target.value; return {...j,sellingPoints:sp}; })} placeholder={["e.g. Staff meals & drinks provided","e.g. 4-day work week available","e.g. Above award wages + tips"][i]} style={{...IS,marginBottom:6}}/>
              ))}
            </div>

            {/* Screening questions */}
            <div style={{ marginBottom:16 }}>
              <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1.2, marginBottom:4, fontWeight:600 }}>Screening Questions <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional)</span></div>
              <div style={{ color:C.textFaint, fontSize:11, marginBottom:8 }}>Candidates must answer selected questions when applying</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  ["rightToWork",        "🛂 Right to work in this country?"],
                  ["yearsExperience",    "📅 Years of hospitality experience?"],
                  ["noticePeriod",       "⏱ Notice period / when can you start?"],
                  ["policeCheck",        "🔒 Current police check?"],
                  ["availableWeekends",  "📆 Available to work weekends?"],
                  ["availablePublicHols","🎉 Available to work public holidays?"],
                  ["driverLicence",      "🚗 Current driver's licence?"],
                  ["willingToRelocate",  "✈️ Willing to relocate?"],
                ].map(([key,label])=>(
                  <div key={key} className="tap" onClick={()=>setNj(j=>({...j,screeningQ:{...(j.screeningQ||{}),[key]:!(j.screeningQ||{})[key]}}))}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:(nj.screeningQ||{})[key]?C.sageL:C.bgSoft, border:`1px solid ${(nj.screeningQ||{})[key]?C.sage+"50":C.border}`, borderRadius:9, cursor:"pointer" }}>
                    <div style={{ width:18, height:18, borderRadius:4, background:(nj.screeningQ||{})[key]?C.sage:"#ddd", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {(nj.screeningQ||{})[key] && <Icon name="check" size={11} color="#fff"/>}
                    </div>
                    <span style={{ color:(nj.screeningQ||{})[key]?C.sage:C.textMid, fontSize:13 }}>{label}</span>
                  </div>
                ))}

                {/* Custom questions */}
                {((nj.screeningQ||{}).custom||[]).map((q,i)=>(
                  <div key={`custom_${i}`} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, padding:"9px 12px", background:C.sageL, border:`1px solid ${C.sage}50`, borderRadius:9 }}>
                      <div style={{ width:18, height:18, borderRadius:4, background:C.sage, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <Icon name="check" size={11} color="#fff"/>
                      </div>
                      <span style={{ color:C.sage, fontSize:13, fontWeight:500, flex:1 }}>✏️ {q}</span>
                    </div>
                    <button className="tap" onClick={()=>setNj(j=>{ const custom=[...(j.screeningQ?.custom||[])]; custom.splice(i,1); return {...j, screeningQ:{...(j.screeningQ||{}), custom}}; })}
                      style={{ background:"none", border:"none", color:C.textFaint, fontSize:18, lineHeight:1, padding:"0 4px", cursor:"pointer", flexShrink:0 }}>×</button>
                  </div>
                ))}

                {/* Add custom question input */}
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <input
                    id="customQInput"
                    placeholder="✏️ Add a custom question…"
                    style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 12px", color:C.textDark, fontSize:13 }}
                    onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); const v=e.target.value.trim(); if(!v) return; setNj(j=>{ const custom=[...(j.screeningQ?.custom||[]),v]; return {...j, screeningQ:{...(j.screeningQ||{}), custom}}; }); e.target.value=""; }}}
                  />
                  <button className="tap" onClick={()=>{ const el=document.getElementById("customQInput"); const v=el?.value?.trim(); if(!v) return; setNj(j=>{ const custom=[...(j.screeningQ?.custom||[]),v]; return {...j, screeningQ:{...(j.screeningQ||{}), custom}}; }); if(el) el.value=""; }}
                    style={{ background:C.sage, border:"none", borderRadius:9, padding:"9px 14px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", flexShrink:0 }}>
                    Add
                  </button>
                </div>
                <div style={{ color:C.textFaint, fontSize:11, marginTop:2 }}>Type a question and press Enter or Add — candidates will be asked to answer it when applying</div>
              </div>
            </div>

            {!user.isTrial && !editId && (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 15px", background:C.sandL, borderRadius:12, border:`1px solid ${C.sand}40`, marginBottom:12 }}>
                <span style={{ fontSize:20 }}>💳</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:C.clay, fontSize:13, fontWeight:600 }}>
                    {nj.tier==="gold"?"🥇 Gold Premium":nj.tier==="silver"?"🥈 Silver Featured":"🥉 Bronze Standard"} — ${nj.tierPrice||50}.00 AUD
                  </div>
                  <div style={{ color:C.textSoft, fontSize:11, marginTop:1 }}>One-time · GST added at checkout · Powered by Stripe</div>
                </div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:C.terracotta, fontWeight:700 }}>${nj.tierPrice||50}</div>
              </div>
            )}
            {user.isTrial && <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 15px", background:C.sageL, borderRadius:12, border:`1px solid ${C.sage}40`, marginBottom:12 }}><span>🎁</span><div style={{ flex:1 }}><div style={{ color:C.sage, fontSize:13, fontWeight:600 }}>HospoSearch Trial — Free Post</div><div style={{ color:C.textSoft, fontSize:11, marginTop:1 }}>Posting on behalf of a new venue</div></div><span style={{ color:C.sage, fontWeight:700 }}>FREE</span></div>}
            {/* Edit mode: simple Save button, no payment */}
            {editId && (
              <button className="btn-cta tap" onClick={saveEdit} disabled={posting}
                style={{ width:"100%", background:posting?"#ccc":posted?C.sage:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:12, padding:"15px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:posting||posted?"none":"0 4px 14px rgba(196,98,58,0.22)", transition:"all 0.3s" }}>
                {posting ? "⏳ Saving…" : posted ? "✓ Changes Saved!" : "Save Changes"}
              </button>
            )}
            {/* Listing limit check */}
            {!editId && (() => {
              const activeListings = mine.filter(j=>j.active!==false).length;
              const subLimit = user.subscription_limit || 0;
              const hasActiveSub = user.subscription_active && subLimit > 0;
              const atLimit = hasActiveSub && activeListings >= subLimit;

              if (atLimit) return (
                <div style={{ background:"#FEF2F0", border:`1px solid ${C.error}30`, borderRadius:12, padding:"16px", textAlign:"center" }}>
                  <div style={{ fontSize:24, marginBottom:8 }}>🚫</div>
                  <div style={{ fontWeight:700, fontSize:14, color:C.error, marginBottom:4 }}>Active listing limit reached</div>
                  <div style={{ color:C.textSoft, fontSize:13, marginBottom:12 }}>
                    You have {activeListings}/{subLimit} active listings on your {user.subscription_tier} plan.
                    Remove a listing or upgrade to post more.
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="tap" onClick={()=>setTab("listings")}
                      style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 0", color:C.textMid, fontSize:13, fontWeight:600 }}>
                      Manage Listings
                    </button>
                    <button className="tap" onClick={()=>setShowSubModal(true)}
                      style={{ flex:1, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"10px 0", color:"#fff", fontSize:13, fontWeight:700 }}>
                      Upgrade Plan
                    </button>
                  </div>
                </div>
              );

              return (
                <>
                  {hasActiveSub && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:C.sageL, borderRadius:10, border:`1px solid ${C.sage}40`, marginBottom:8 }}>
                      <span style={{ fontSize:14 }}>📊</span>
                      <span style={{ color:C.sage, fontSize:12 }}>
                        {activeListings}/{subLimit} active listings used on {user.subscription_tier} plan
                      </span>
                    </div>
                  )}
                  {nj.title.trim() && (
                    <button className="tap" onClick={()=>setShowPreview(true)}
                      style={{ width:"100%", background:"#fff", border:`1.5px solid ${C.terracotta}`, borderRadius:12, padding:"12px 0", color:C.terracotta, fontWeight:700, fontSize:14, marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                      <Icon name="eye" size={16} color={C.terracotta}/> Preview how it looks
                    </button>
                  )}
                  <button className="btn-cta tap" onClick={post} disabled={posting}
                    style={{ width:"100%", background:posting?"#ccc":posted?C.sage:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:12, padding:"15px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:posting||posted?"none":"0 4px 14px rgba(196,98,58,0.22)", transition:"all 0.3s" }}>
                    {posting ? "⏳ Posting your listing…" : posted ? "✓ Job Posted!" : user.isTrial ? "🚀 Publish Free Listing" : "Continue to Payment →"}
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {posted && (
          <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", background:"#ECFDF5" }}>
            <div style={{ width:88, height:88, borderRadius:"50%", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:46, marginBottom:20, border:`3px solid ${C.sage}`, boxShadow:`0 8px 24px ${C.sage}40` }}>✅</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, color:"#166534", fontWeight:800, marginBottom:8, textAlign:"center" }}>{editId ? "Changes Saved!" : "Job Posted!"}</div>
            <div style={{ color:"#166534", fontSize:15, marginBottom:6, opacity:0.8, textAlign:"center" }}>{editId ? "Your listing has been updated" : "Your listing is now live on HospoSearch"}</div>
            <div style={{ color:"#166534", fontSize:13, opacity:0.6 }}>Redirecting to your listings…</div>
          </div>
        )}

        {/* Applications */}
        {tab==="apps" && (
          <ApplicationsManager mine={mine} sel={sel} setSel={setSel} user={user} setJobs={setJobs} setSupabaseApps={setSupabaseApps} setMessages={setMessages} setTab={setTab} isDesktop={isDesktop}/>
        )}

        {/* Talent discovery */}
        {tab==="talent" && <CandidateDiscovery jobs={jobs} currentUser={user}/>}

        {/* Analytics */}
        {tab==="subscribe" && (
          <SubscribePlans user={user} onSubscribe={async(plan)=>{
            try {
              const url = await createSubscriptionSession(plan, user.email, user.id);
              window.location.href = url;
            } catch(e) { alert("Could not start subscription. Please try again."); }
          }}/>
        )}
        {tab==="analytics" && (
          <div style={{ height:"100%", overflowY:"auto", padding:"16px" }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:C.textDark, fontWeight:700, marginBottom:16 }}>Analytics</div>
            {mine.length===0 ? <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>📊</div><div>Post a listing to see analytics</div></div> : (
              mine.map(j=>(
                <div key={j.id} style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, padding:"14px 16px", marginBottom:12, boxShadow:"0 1px 5px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.textDark, marginBottom:10 }}>{j.title}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                    {[["Views",j.views||0,"👁️"],["Applications",j.apps?.length||0,"📋"],["Conv. Rate",j.views?(((j.apps?.length||0)/j.views)*100).toFixed(1)+"%":"—","📈"]].map(([l,v,ic])=>(
                      <div key={l} style={{ background:C.bgSoft, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:16, marginBottom:2 }}>{ic}</div>
                        <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, color:C.terracotta, fontWeight:700 }}>{v}</div>
                        <div style={{ color:C.textFaint, fontSize:10 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height:4, background:C.border, borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:`linear-gradient(90deg,${C.terracotta},${C.sand})`, width:`${Math.min((j.apps?.length||0)/Math.max(j.views||1,1)*100*10,100)}%`, borderRadius:2 }}/>
                  </div>
                  <div style={{ color:C.textFaint, fontSize:11, marginTop:4 }}>Application rate vs views</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Profile */}
        {tab==="profile" && (
          <EmployerProfileTab user={user} mine={mine} apps={apps} emailNotifs={emailNotifs} toggleEmailNotifs={toggleEmailNotifs} onLogout={onLogout} altAccount={altAccount} onSwitchAccount={onSwitchAccount} onAvatarChange={(url)=>{ user.avatar_url = url; setJobs(prev=>prev.map(j=>j.empId===user.id?{...j, avatar_url:url}:j)); }}/>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ display:"flex", borderTop:`1px solid ${C.border}`, background:"#fff", flexShrink:0 }}>
        <button className="tap" onClick={()=>window.location.href='/'}
          style={{ flex:1, padding:"10px 0 8px", border:"none", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <Icon name="home" size={24} color={C.textSoft}/>
          <span style={{ fontSize:10, color:C.textSoft, fontWeight:400 }}>Home</span>
        </button>
        <NavBtn t="browse" ic="search" l="Browse"/>
        <NavBtn t="feed" ic="grid" l="My Listings"/>
        <NavBtn t="post" ic="plus" l="Post"/>
        <NavBtn t="talent" ic="users" l="Talent"/>
        <NavBtn t="apps" ic="briefcase" l="Applications" badge={newAppsCount||apps}/>
        <NavBtn t="profile" ic="person" l="Profile"/>
      </div>

      {checkoutJob && <StripeCheckout jobDraft={checkoutJob} onSuccess={publishAfterPayment} onCancel={()=>setCheckoutJob(null)} codes={codes} setCodes={setCodes} isFeatured={nj.featured} tierKey={nj.tier||"bronze"} tierPrice={nj.tierPrice||50} tierPriceId={nj.tierPriceId||"price_1TfwBfGkG9EGtGJgBv341e2n"} user={user}/>}

      {/* Job card preview */}
      {showPreview && (() => {
        const previewJob = { ...buildJobData(), id:"preview", ts:Date.now(), views:0, apps:[], avatar_url:user.avatar_url };
        return (
          <div onClick={()=>setShowPreview(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:3500, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(3px)" }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:440, maxHeight:"88vh", overflowY:"auto", borderRadius:16 }}>
              <div style={{ textAlign:"center", marginBottom:12 }}>
                <span style={{ background:"#fff", color:C.textMid, fontSize:12, fontWeight:600, padding:"6px 14px", borderRadius:100 }}>Preview — this is how candidates see it</span>
              </div>
              <JobCard job={previewJob} currentUser={{id:"preview-viewer"}} following={[]} bookmarks={[]} onApply={()=>{}} onExpand={()=>{}} onToggleFollow={()=>{}} onToggleBookmark={()=>{}} onVenueClick={()=>{}}/>
              <button className="tap" onClick={()=>setShowPreview(false)}
                style={{ width:"100%", background:"#fff", border:"none", borderRadius:12, padding:"13px 0", color:C.textDark, fontWeight:700, fontSize:14, marginTop:6 }}>
                Close preview
              </button>
            </div>
          </div>
        );
      })()}

      {/* Re-activate expired listing — choose any tier, repay, fresh 30-day clock */}
      {reactivateJob && (
        <div onClick={()=>setReactivateJob(null)} style={{ position:"fixed", inset:0, background:"rgba(20,14,10,0.55)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", padding:"22px 18px 28px", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ width:38, height:4, background:C.border, borderRadius:10, margin:"0 auto 16px" }}/>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:21, fontWeight:700, color:C.textDark, marginBottom:4 }}>Re-activate listing</div>
            <div style={{ color:C.textSoft, fontSize:13, marginBottom:18 }}>“{reactivateJob.title}” will go live again for a fresh 30 days. Choose a tier:</div>
            {[
              { key:"bronze", name:"Bronze — Standard", price:50, priceId:"price_1TfwBfGkG9EGtGJgBv341e2n", feats:"Listed in the feed · 30-day listing" },
              { key:"silver", name:"Silver — Featured", price:70, priceId:"price_1TfwBlGkG9EGtGJgGxDjQEhS", feats:"Pinned to top · Featured badge · 30-day listing" },
              { key:"gold",   name:"Gold — Premium",   price:100, priceId:"price_1TfwBrGkG9EGtGJg6O8z5oAu", feats:"Max visibility · Highlighted · 30-day listing" },
            ].map(t=>(
              <button key={t.key} className="tap" onClick={()=>{
                  setNj(p=>({ ...p, tier:t.key, tierPrice:t.price, tierPriceId:t.priceId, featured:(t.key!=="bronze") }));
                  setCheckoutJob(reactivateJob); // existing job id → webhook flips active + fresh expires_at
                  setReactivateJob(null);
                }}
                style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:13, padding:"14px 15px", marginBottom:10, cursor:"pointer" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:C.textDark, marginBottom:3 }}>{t.name}</div>
                  <div style={{ color:C.textSoft, fontSize:11 }}>{t.feats}</div>
                </div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.terracotta, whiteSpace:"nowrap" }}>${t.price}<span style={{ fontSize:10, color:C.textFaint, fontWeight:400 }}> +GST</span></div>
              </button>
            ))}
            <button className="tap" onClick={()=>setReactivateJob(null)} style={{ width:"100%", background:"none", border:"none", color:C.textSoft, fontSize:13, padding:"10px 0", marginTop:4, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      {expandedJob && <JobDetail job={expandedJob} currentUser={user} profile={{}} following={[]} bookmarks={[]} onClose={()=>setExpandedJob(null)} onApply={()=>{}} onToggleFollow={()=>{}} onToggleBookmark={()=>{}} onVenueClick={setVenueProfile}/>}
      {venueProfile && <VenueProfile emp={venueProfile} jobs={jobs} following={[]} currentUser={user} onToggleFollow={()=>{}} onApply={()=>{}} onBack={()=>setVenueProfile(null)}/>}
      {cropState && <ImageCropper src={cropState.src} onConfirm={(cropped)=>{ cropState.onDone(cropped); setCropState(null); }} onCancel={()=>setCropState(null)}/>}

      {/* Subscription plans modal */}
      {showSubModal && (
        <div onClick={()=>setShowSubModal(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#FAF8F4", borderRadius:20, padding:"28px 24px", maxWidth:620, width:"100%", maxHeight:"90vh", overflowY:"auto", position:"relative" }}>
            <button onClick={()=>setShowSubModal(false)} style={{ position:"absolute", top:14, right:14, background:"#F0EBE3", border:"none", borderRadius:"50%", width:30, height:30, fontSize:16, cursor:"pointer", color:"#3A3733" }}>×</button>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:C.textDark, marginBottom:4 }}>Subscription Plans</div>
            <p style={{ color:C.textSoft, fontSize:13, marginBottom:20 }}>Post more, pay less. Cancel anytime.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { name:"Starter", price:99, priceId:"price_1TfwByGkG9EGtGJg9FeaYFE2", sub:"3 active listings", featured:false, feats:["3 active listings at any time","All Bronze features on every listing","Application dashboard","Cancel anytime"] },
                { name:"Growth",  price:199, priceId:"price_1TfwC5GkG9EGtGJglmXiYPOV", sub:"6 active listings", featured:true,  feats:["6 active listings at any time","All Silver features on every listing","Candidate search & messaging","Cancel anytime"] },
                { name:"Pro",     price:399, priceId:"price_1TfwCAGkG9EGtGJgDhgMbdHb", sub:"10 active listings", featured:false, feats:["10 active listings at any time","All Gold features on every listing","Instagram & Facebook promotion","Analytics dashboard","Cancel anytime"] },
              ].map(plan=>(
                <div key={plan.name} style={{ background:"#fff", border:`${plan.featured?"2px":"1px"} solid ${plan.featured?C.terracotta:C.border}`, borderRadius:14, padding:"18px 20px", position:"relative" }}>
                  {plan.featured && <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:C.terracotta, color:"#fff", fontSize:10, fontWeight:700, letterSpacing:1, textTransform:"uppercase", padding:"3px 14px", borderRadius:100, whiteSpace:"nowrap" }}>Most Popular</div>}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:C.terracotta }}/>
                        <span style={{ color:plan.featured?C.terracotta:C.textSoft, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{plan.name}</span>
                      </div>
                      <div style={{ color:C.textSoft, fontSize:12 }}>{plan.sub}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:800, color:C.textDark, lineHeight:1 }}>${plan.price}</div>
                      <div style={{ color:C.textFaint, fontSize:11 }}>AUD / month</div>
                    </div>
                  </div>
                  <ul style={{ listStyle:"none", padding:0, display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
                    {plan.feats.map(f=>(
                      <li key={f} style={{ fontSize:12, color:C.textMid, display:"flex", alignItems:"flex-start", gap:7 }}>
                        <span style={{ color:C.terracotta, fontWeight:700, flexShrink:0 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <button className="tap" onClick={async ()=>{
                    try {
                      const res = await fetch('/api/create-subscription', { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ plan:plan.name.toLowerCase(), userEmail:user.email, userId:user.id, priceId:plan.priceId }) });
                      const { url } = await res.json();
                      if (url) window.location.href = url;
                    } catch(e) { alert("Couldn't connect to checkout — please try again."); }
                  }} style={{ width:"100%", background:plan.featured?C.terracotta:"#fff", border:`1px solid ${C.terracotta}`, borderRadius:100, padding:"11px 0", color:plan.featured?"#fff":C.terracotta, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    Get Started — ${plan.price}/mo
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Employee App ─────────────────────────────────────────────────────────────
// ─── Following Screen ────────────────────────────────────────────────────────
function FollowingScreen({ following, jobs, currentUser, onUnfollow, onOpen }) {
  const [selected, setSelected] = useState(null);

  // Build list of followed employers with their latest jobs
  const followedEmployers = following.map(id => {
    const empJobs = jobs.filter(j => j.empId === id);
    const emp = getEmp(empJobs[0]) || { id, name:"Unknown Venue", handle:id, avatar:"🍽️" };
    return { emp, jobs:empJobs.sort((a,b)=>b.ts-a.ts) };
  }).filter(Boolean);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 10px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark, marginBottom:2 }}>Following</div>
        <div style={{ color:C.textSoft, fontSize:13 }}>{following.length} venue{following.length!==1?"s":""} you follow</div>
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        {followedEmployers.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:C.textFaint }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💔</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, color:C.textMid, marginBottom:6 }}>No venues followed yet</div>
            <div style={{ fontSize:13 }}>Follow venues from the home feed or explore tab</div>
          </div>
        )}

        {followedEmployers.map(({ emp, jobs:empJobs }) => (
          <div key={emp.id}>
            {/* Venue header */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:`1px solid ${C.border}`, background:"#fff" }}>
              <div style={{ width:50, height:50, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0, border:`2px solid ${C.border}` }}>
                {emp.avatar}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15, color:C.textDark }}>{emp.name}</div>
                <div style={{ color:C.textSoft, fontSize:12, marginTop:1 }}>
                  {empJobs.length > 0 ? `${empJobs.length} active listing${empJobs.length!==1?"s":""}` : "No active listings"}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                {/* Cold apply button if employer has email */}
                {emp.email && (
                  <a href={`mailto:${emp.email}?subject=Expression of Interest — HospoSearch&body=Hi ${emp.name},%0D%0A%0D%0AI came across your venue on HospoSearch and would love to express my interest in any upcoming opportunities.%0D%0A%0D%0AKind regards`}
                    style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:8, padding:"5px 11px", color:C.terracotta, fontSize:11, fontWeight:700, textDecoration:"none" }}>
                    ✉️ Cold Apply
                  </a>
                )}
                <button className="tap" onClick={()=>onUnfollow(emp.id)}
                  style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 11px", color:C.textMid, fontSize:11, fontWeight:600 }}>
                  Unfollow
                </button>
              </div>
            </div>

            {/* Latest listings */}
            {empJobs.length > 0 && (
              <div style={{ background:C.bgSoft }}>
                {empJobs.slice(0,3).map(j => (
                  <div key={j.id} className="tap" onClick={()=>onOpen(j)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:"#fff", marginBottom:1 }}>
                    {/* Thumbnail */}
                    <div style={{ width:48, height:60, borderRadius:8, overflow:"hidden", background:C.bgSoft, flexShrink:0 }}>
                      {isData(j.photos?.[0])
                        ? <img src={j.photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                        : <div style={{ width:"100%", height:"100%", background:PBG[(typeof j.photos?.[0]==="number"?j.photos[0]:0)%PBG.length], display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:16, opacity:0.4 }}>{emp.avatar}</span></div>
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:C.textDark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{j.title}</div>
                      <div style={{ color:C.textSoft, fontSize:12, marginTop:2 }}>{j.salary} · {j.type}</div>
                      <div style={{ color:C.textFaint, fontSize:11, marginTop:2 }}>{ago(j.ts)} ago</div>
                    </div>
                    <div style={{ color:C.terracotta, fontSize:13, fontWeight:600, flexShrink:0 }}>View →</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeApp({ user, jobs, setJobs, profile, setProfile, following, setFollowing, messages, setMessages, notifs, setNotifs, notifPrefs, setNotifPrefs, onLogout, altAccount, onSwitchAccount }) {
  const isDesktop = useIsDesktop();
  const [tab, setTabRaw] = useState("home");
  const [prevTab, setPrevTab] = useState("home");
  const setTab = (next) => { setTabRaw(prev => { setPrevTab(prev); return next; }); };
  const goBack = () => setTabRaw(prevTab);
  const [expandedJob, setExpandedJob] = useState(null);
  const [openToApply, setOpenToApply] = useState(false);
  const openJob  = (j) => { setOpenToApply(false); setExpandedJob(j); };
  const applyJob = (j) => { setOpenToApply(true);  setExpandedJob(j); };
  const [refreshing, setRefreshing] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const [homeSearch, setHomeSearch] = useState("");
  const homeFiltered = homeSearch.trim() ? smartSearch(jobs, homeSearch) : jobs;
  const appliedCount = jobs.filter(j=>j.apps?.some(a=>a.uid===user.id)).length;
  // Keep avatar_url in sync
  const [liveAvatarUrl, setLiveAvatarUrl] = useState(user?.avatar_url||null);
  const pullStartY = useRef(null);
  const pullDelta = useRef(0);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const dbJobs = await fetchJobs();
      if (Array.isArray(dbJobs)) setJobs(dbJobs);
    } catch(e) { console.warn('Refresh failed:', e); }
    setTimeout(() => setRefreshing(false), 600);
  };

  const onPullStart = e => { pullStartY.current = e.touches[0].clientY; pullDelta.current = 0; };
  const onPullMove  = e => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0 && e.currentTarget.scrollTop === 0) {
      pullDelta.current = Math.min(delta, 80);
    }
  };
  const onPullEnd = () => {
    if (pullDelta.current > 50) doRefresh();
    pullStartY.current = null;
    pullDelta.current = 0;
  };
  const [venueProfile, setVenueProfile] = useState(null);
  const [storyJob, setStoryJob] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [savedSearchToast, setSavedSearchToast] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Load this candidate's saved searches / job alerts from Supabase
  useEffect(() => {
    let cancelled = false;
    sbFetchAlerts(user.id).then(list => { if (!cancelled && Array.isArray(list)) setAlerts(list); }).catch(()=>{});
    return () => { cancelled = true; };
  }, [user.id]);

  // Load this candidate's own applications and merge into jobs.apps
  useEffect(() => {
    let cancelled = false;
    const loadMyApps = async () => {
      try {
        const { data } = await supabase
          .from('applications')
          .select('*')
          .eq('applicant_id', user.id)
          .order('created_at', { ascending:false });
        if (data && !cancelled) {
          setJobs(prev => prev.map(j => {
            const mine = data.filter(a => a.job_id === j.id);
            if (mine.length === 0) return j;
            const existing = (j.apps || []).filter(a => a.uid !== user.id);
            const myApps = mine.map(a => ({
              id: a.id, uid: a.applicant_id, name: a.name,
              email: a.email, phone: a.phone, msg: a.message,
              visa: a.visa, availability: a.availability || [], hours: a.hours || [],
              notice: a.notice, resume_url: a.resume_url, resume_name: a.resume_name,
              cover_url: a.cover_url, cover_name: a.cover_name,
              status: a.status || 'Sent', ts: new Date(a.created_at).getTime(),
            }));
            return { ...j, apps: [...existing, ...myApps] };
          }));
        }
      } catch(e) { console.warn('Load my applications error:', e); }
    };
    loadMyApps();
    return () => { cancelled = true; };
  }, [user.id]);

  const toggleFollow = async (id) => {
    const isFollowing = following.includes(id);
    setFollowing(f => isFollowing ? f.filter(x=>x!==id) : [...f, id]);
    try {
      if (isFollowing) {
        await supabase.from('following').delete().eq('follower_id', user.id).eq('following_id', id);
      } else {
        await supabase.from('following').insert({ follower_id: user.id, following_id: id });
        // Notify the employer that someone followed them
        await supabase.from('notifications').insert({
          user_id: id,
          type: 'follow',
          text: `${user.name} is now following your venue`,
          sub: "They'll be notified when you post new roles",
          icon: '👥',
          read: false,
        });
      }
    } catch(e) { console.warn('Follow error:', e); }
  };
  const toggleBookmark = id => setBookmarks(b=>b.includes(id)?b.filter(x=>x!==id):[...b,id]);
  const handleApply = async (job, fd) => {
    // Save application to Supabase (includes document upload inside sbApplyForJob)
    let savedApp = null;
    try {
      savedApp = await sbApplyForJob(job.id, user.id, fd);
    } catch(e) {
      console.warn('Application save failed:', e);
    }
    // Send email notification to employer (job's applyEmail takes priority, then profile email)
    try {
      let profileEmail = null, profileName = null, notifsOff = false;
      try {
        const empProfile = await supabase.from('profiles').select('email,name,email_notifications').eq('id', job.empId).single();
        if (empProfile.data) {
          profileEmail = empProfile.data.email;
          profileName = empProfile.data.name;
          notifsOff = empProfile.data.email_notifications === false;
        }
      } catch(_) { /* admin or no profile row — fall back to job.applyEmail */ }

      const targetEmail = job.applyEmail || profileEmail;
      if (targetEmail && !notifsOff) {
        await fetch('/api/notify-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employerEmail: targetEmail,
            employerName: profileName || job.venue,
            applicantName: fd.name,
            applicantEmail: fd.email || '',
            applicantPhone: fd.phone || '',
            applicantMessage: fd.msg || '',
            jobTitle: job.title,
            venueName: job.venue || profileName || '',
            jobId: job.id,
            dashboardUrl: `https://www.hosposearch.com.au/app?view=apps&jobId=${job.id}`,
            resumeUrl: savedApp?.resume_url || null,
            resumeName: fd.resume?.name || null,
            coverUrl: savedApp?.cover_url || null,
            coverName: fd.cover?.name || null,
            visa: fd.visa || '',
            availability: fd.availability || [],
            hours: fd.hours || [],
            notice: fd.notice || '',
            screeningAnswers: fd.screeningAnswers || {},
          }),
        });
      }
    } catch(e) { console.warn('Email notify error:', e); }

    // Update local state
    setJobs(p=>p.map(j=>j.id===job.id ? {
      ...j,
      views: (j.views||0)+1,
      apps: [...(j.apps||[]), {
        id: savedApp?.id,
        uid: user.id,
        name: fd.name,
        msg: fd.msg,
        visa: fd.visa,
        availability: fd.availability,
        hours: fd.hours,
        notice: fd.notice,
        resume: fd.resume,
        resume_url: savedApp?.resume_url || null,
        cover: fd.cover,
        cover_url: savedApp?.cover_url || null,
        ts: Date.now(),
        status: "Sent"
      }]
    } : j));
  };

  const followedJobs = jobs.filter(j=>following.includes(j.empId)).sort((a,b)=>b.ts-a.ts);
  const featuredJobs = jobs.filter(j=>j.featured);
  const otherJobs = jobs.filter(j=>!following.includes(j.empId)).sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||b.ts-a.ts);
  const sortedJobs = [...followedJobs,...otherJobs];
  const hasDocs = profile?.resume||profile?.coverLetter;
  const unreadMessages = Object.values(messages).filter(msgs=>msgs.some(m=>m.from!==user.id)).length;

  const NavBtn = ({ t, ic, l, badge }) => {
    const isProfile = t==="profile";
    const profileAvatar = isProfile && user?.avatar_url;
    return (
      <button className="tap" onClick={()=>setTab(t)} style={{ flex:1, padding:"10px 0 8px", border:"none", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:3, position:"relative" }}>
        {profileAvatar
          ? <div style={{ width:24, height:24, borderRadius:"50%", overflow:"hidden", border:`2px solid ${tab===t?C.terracotta:C.border}` }}>
              <img src={profileAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            </div>
          : <Icon name={ic} size={24} color={tab===t?C.terracotta:C.textSoft} fill={tab===t&&ic==="person"?C.terracottaL:"none"}/>
        }
        {badge>0 && <div style={{ position:"absolute", top:6, right:"calc(50% - 16px)", width:16, height:16, borderRadius:"50%", background:C.terracotta, border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ color:"#fff", fontSize:9, fontWeight:700 }}>{badge}</span></div>}
        <span style={{ fontSize:10, color:tab===t?C.terracotta:C.textSoft, fontWeight:tab===t?600:400 }}>{l}</span>
      </button>
    );
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#fff", overflow:"hidden" }}>
      <style>{G}</style>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:"rgba(255,255,255,0.97)", backdropFilter:"blur(10px)", flexShrink:0, zIndex:50 }}>
        {tab!=="home" && (
          <button className="tap" onClick={goBack} style={{ background:"none", border:"none", padding:"2px 8px 2px 0", display:"flex", alignItems:"center" }} title="Back">
            <Icon name="back" size={22} color={C.textDark}/>
          </button>
        )}
        <a href="/" style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:24, color:C.textDark, flex:1, letterSpacing:-0.3, textDecoration:"none" }}><span style={{ color:C.terracotta }}>Hospo</span>Search</a>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="tap" onClick={()=>setNotifOpen(true)} style={{ background:"none", border:"none", padding:2, position:"relative" }}>
            <Icon name="bell" size={22} color={C.textDark}/>
            {(notifs[user.id]||[]).filter(n=>!n.read).length>0 && <div style={{ position:"absolute", top:0, right:0, width:8, height:8, borderRadius:"50%", background:C.terracotta, border:"2px solid #fff" }}/>}
          </button>
          <AvatarMenu user={user} badge={hasDocs} onDashboard={()=>setTab("profile")} onLogout={onLogout}/>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {tab==="home" && (
          <div style={{ height:"100%", overflowY:"auto", WebkitOverflowScrolling:"touch", overscrollBehaviorY:"contain" }}
            onTouchStart={e=>{ pullStartY.current = e.currentTarget.scrollTop<=0 ? (e.touches[0]?.clientY||0) : null; pullDelta.current=0; }}
            onTouchMove={e=>{
              if(pullStartY.current===null || refreshing) return;
              const delta=(e.touches[0]?.clientY||0)-pullStartY.current;
              if(delta>0 && e.currentTarget.scrollTop<=0){
                pullDelta.current=Math.min(delta,110);
                // Resistance curve so it feels natural
                setPullDist(Math.min(delta*0.5,70));
              } else {
                setPullDist(0);
              }
            }}
            onTouchEnd={()=>{
              if(pullDelta.current>60 && !refreshing) doRefresh();
              setPullDist(0);
              pullStartY.current=null; pullDelta.current=0;
            }}>
            {/* Pull indicator */}
            <div style={{ height:pullDist, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", transition:pullStartY.current===null?"height 0.25s":"none" }}>
              {pullDist>5 && <div style={{ display:"flex", alignItems:"center", gap:8, color:C.sage, fontSize:13, fontWeight:600 }}>
                <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${C.sage}`, borderTopColor:"transparent", transform:`rotate(${pullDist*5}deg)`, transition:"transform 0.1s" }}/>
                {pullDist>50 ? "Release to refresh" : "Pull to refresh"}
              </div>}
            </div>
            {refreshing && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"10px 0", background:C.sageL, gap:8 }}><div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${C.sage}`, borderTopColor:"transparent", animation:"spin 0.7s linear infinite" }}/><span style={{ color:C.sage, fontSize:13, fontWeight:600 }}>Refreshing…</span></div>}
            {/* Hero + Search */}
            <div style={{ textAlign:"center", padding:isDesktop?"24px 20px 20px":"16px 16px 12px", background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:isDesktop?32:22, fontWeight:700, color:C.textDark, marginBottom:6 }}>
                Find your next great <em style={{ color:C.terracotta }}>hospitality role</em>
              </div>
              <div style={{ color:C.textSoft, fontSize:14, marginBottom:14 }}>{jobs.length} role{jobs.length!==1?"s":""} across Australia, New Zealand & beyond</div>
              <div style={{ maxWidth:520, margin:"0 auto", display:"flex", alignItems:"center", background:"#fff", border:`2px solid ${homeSearch?C.terracotta:C.border}`, borderRadius:100, padding:"10px 16px", gap:10, boxShadow:"0 2px 12px rgba(0,0,0,0.08)", transition:"border-color 0.2s" }}>
                <Icon name="search" size={16} color={C.textSoft}/>
                <input value={homeSearch} onChange={e=>setHomeSearch(e.target.value)} placeholder="Search roles — Chef, Sommelier, Floor Manager…" style={{ flex:1, background:"none", border:"none", color:C.textDark, fontSize:14 }}/>
                {homeSearch && <button className="tap" onClick={()=>setHomeSearch("")} style={{ background:"none", border:"none", color:C.textFaint, fontSize:18, lineHeight:1, cursor:"pointer" }}>×</button>}
              </div>
              {homeSearch.trim() && (
                <button className="tap" onClick={async ()=>{
                  try {
                    const created = await sbCreateAlert(user.id, { role:homeSearch.trim(), loc:"", type:"Any", salary:"Any", label:homeSearch.trim() });
                    setAlerts(a=>[created, ...a]);
                    setSavedSearchToast(true); setTimeout(()=>setSavedSearchToast(false), 2600);
                  } catch(e) { console.warn("Save search error:", e); }
                }}
                  style={{ marginTop:12, background:savedSearchToast?C.sageL:"#fff", border:`1.5px solid ${savedSearchToast?C.sage:C.terracotta}`, borderRadius:100, padding:"9px 18px", color:savedSearchToast?C.sage:C.terracotta, fontWeight:700, fontSize:13, display:"inline-flex", alignItems:"center", gap:7 }}>
                  {savedSearchToast ? "✓ Saved — we'll email you new matches" : <><Icon name="bell" size={14} color={C.terracotta}/> Save this search & get alerts</>}
                </button>
              )}
            </div>
            <StoryBar jobs={jobs} following={following} currentUser={user} onOpen={(stories, startIndex)=>setStoryJob({ stories, startIndex })}/>
            {featuredJobs.length>0 && (
              <div style={{ background:C.featuredL, padding:"9px 16px", borderBottom:`1px solid ${C.featured}30`, display:"flex", alignItems:"center", gap:8 }}>
                <Icon name="star" size={14} color={C.featured} fill={C.featured}/>
                <span style={{ color:C.featured, fontSize:13, fontWeight:600 }}>{featuredJobs.length} featured listing{featuredJobs.length!==1?"s":""} this week</span>
              </div>
            )}
            {following.length>0&&followedJobs.length>0 && <div style={{ background:`linear-gradient(135deg,${C.sageL},#F4F9F4)`, padding:"9px 16px", borderBottom:`1px solid ${C.sage}25`, display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:14 }}>⭐</span><span style={{ color:C.textMid, fontSize:13 }}><strong style={{ color:C.sage }}>{followedJobs.length}</strong> {followedJobs.length===1?"role":"roles"} from venues you follow</span></div>}
            {!hasDocs && <div className="tap" onClick={()=>setTab("profile")} style={{ background:`linear-gradient(135deg,${C.sandL},${C.terracottaL})`, padding:"11px 16px", borderBottom:`1px solid ${C.terracottaM}`, display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}><span style={{ fontSize:17 }}>💡</span><div style={{ flex:1 }}><div style={{ color:C.clay, fontSize:13, fontWeight:600 }}>Speed up your applications</div><div style={{ color:C.textSoft, fontSize:12 }}>Save résumé & cover letter to auto-attach</div></div><span style={{ color:C.terracotta, fontSize:13, fontWeight:600 }}>Set up →</span></div>}
            <div style={{ padding:"12px 14px" }}>
              {(homeSearch.trim() ? homeFiltered : sortedJobs).map((j,i)=>(
                <div key={j.id}>
                  {!homeSearch.trim() && i===followedJobs.length&&followedJobs.length>0&&otherJobs.length>0 && <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0 12px", color:C.textFaint, fontSize:11 }}><div style={{ flex:1, height:1, background:C.border }}/><span>More listings</span><div style={{ flex:1, height:1, background:C.border }}/></div>}
                  {j && j.id && j.title && <JobCard job={j} currentUser={user} following={following} bookmarks={bookmarks} onApply={applyJob} onExpand={openJob} onToggleFollow={toggleFollow} onToggleBookmark={toggleBookmark} onVenueClick={setVenueProfile}/>}
                </div>
              ))}
            </div>
            <div style={{ textAlign:"center", padding:"32px 0", color:C.textFaint, fontSize:13 }}><div style={{ fontSize:24, marginBottom:7 }}>🌿</div>You're all caught up!</div>
          </div>
        )}
        {tab==="following" && <FollowingScreen following={following} jobs={jobs} currentUser={user} onUnfollow={toggleFollow} onOpen={j=>setExpandedJob(j)}/>}
        {tab==="explore" && <ExploreGrid jobs={jobs} following={following} currentUser={user} bookmarks={bookmarks} onOpen={j=>setExpandedJob(j)} onToggleFollow={toggleFollow}/>}
        {tab==="activity" && <MyApplications userId={user.id} jobs={jobs} bookmarks={bookmarks} onExpand={setExpandedJob}/>}
        {tab==="alerts" && <JobAlertsScreen alerts={alerts} setAlerts={setAlerts} userId={user.id} onBack={goBack}/>}
        {tab==="profile" && <CandidateProfile user={user} profile={profile} setProfile={setProfile} following={following} setFollowing={setFollowing} altAccount={altAccount} onSwitchAccount={onSwitchAccount} jobs={jobs} applications={jobs.filter(j=>j.apps?.some(a=>a.uid===user.id))} bookmarks={bookmarks} notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs} onLogout={onLogout}/>}
      </div>

      {/* Bottom Nav */}
      <div style={{ display:"flex", borderTop:`1px solid ${C.border}`, background:"#fff", flexShrink:0 }}>
        <NavBtn t="home"     ic="home"      l="Home"/>
        <NavBtn t="explore"  ic="search"    l="Explore"/>
        <NavBtn t="activity" ic="briefcase" l="Applied" badge={appliedCount}/>
        <NavBtn t="following" ic="heart"    l="Following" badge={following.length}/>
        <NavBtn t="profile"  ic="person"    l="Profile"/>
      </div>

      {notifOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:4000, display:"flex", flexDirection:"column", backdropFilter:"blur(2px)" }} onClick={()=>setNotifOpen(false)}>
          <div style={{ flex:1, maxHeight:"15vh" }}/>
          <div style={{ background:"#fff", borderRadius:"22px 22px 0 0", maxHeight:"85vh", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:"10px auto 0", flexShrink:0 }}/>
            <div style={{ flex:1, overflow:"hidden" }}>
              <NotifCentre userId={user.id} notifs={notifs} setNotifs={setNotifs}/>
            </div>
          </div>
        </div>
      )}
      {tab==="alerts" && null}
      {expandedJob && <JobDetail job={expandedJob} currentUser={user} profile={profile} following={following} bookmarks={bookmarks} onClose={()=>{ setExpandedJob(null); setOpenToApply(false); }} onApply={handleApply} onToggleFollow={toggleFollow} onToggleBookmark={toggleBookmark} onVenueClick={setVenueProfile} openToApply={openToApply}/>}
      {/* Desktop grid view */}
      {isDesktop && tab==="home" && (
        <div style={{ position:"absolute", top:"53px", left:0, right:0, bottom:0, overflowY:"auto", background:C.bg, zIndex:5 }}>
          {/* Hero + Search */}
          <div style={{ textAlign:"center", padding:"28px 20px 24px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:34, fontWeight:700, color:C.textDark, marginBottom:8 }}>
              Find your next great <em style={{ color:C.terracotta }}>hospitality role</em>
            </div>
            <div style={{ color:C.textSoft, fontSize:15, marginBottom:20 }}>{jobs.length} role{jobs.length!==1?"s":""} across Australia, New Zealand & beyond</div>
            <div style={{ maxWidth:560, margin:"0 auto", display:"flex", alignItems:"center", background:"#fff", border:`2px solid ${homeSearch?C.terracotta:C.border}`, borderRadius:100, padding:"12px 20px", gap:10, boxShadow:"0 2px 12px rgba(0,0,0,0.08)", transition:"border-color 0.2s" }}>
              <Icon name="search" size={16} color={C.textSoft}/>
              <input value={homeSearch} onChange={e=>setHomeSearch(e.target.value)} placeholder="Search roles — Chef, Sommelier, Floor Manager…" style={{ flex:1, background:"none", border:"none", color:C.textDark, fontSize:14 }}/>
              {homeSearch && <button className="tap" onClick={()=>setHomeSearch("")} style={{ background:"none", border:"none", color:C.textFaint, fontSize:18, lineHeight:1, cursor:"pointer" }}>×</button>}
            </div>
          </div>
          <div style={{ padding:"20px", maxWidth:1100, margin:"0 auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
              {homeFiltered.filter(j=>j&&j.id&&j.title).map((j,i)=>{
                const first = j.video||j.photos?.[0];
                const hm = isData(first);
                const pbg = PBG[typeof j.photos?.[0]==="number"?j.photos[0]%PBG.length:i%PBG.length];
                const emp = getEmp(j);
                return (
                  <div key={j.id} className="tap" onClick={()=>setExpandedJob(j)}
                    style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.2s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="none"; }}>
                    <div style={{ position:"relative", width:"100%", aspectRatio:"4/5", overflow:"hidden", background:pbg }}>
                      {hm&&isVid(first)
                        ? <video src={first} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                        : hm
                          ? <BlurFillImage src={first} alt={j.title} ratio="4/5"/>
                          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:40, opacity:0.2 }}>{emp?.avatar}</span></div>
                      }
                      {j.featured && <div style={{ position:"absolute", top:8, left:8, background:C.featuredL, border:`1px solid ${C.featured}40`, borderRadius:20, padding:"3px 9px", display:"flex", alignItems:"center", gap:4, zIndex:2 }}><Icon name="star" size={11} color={C.featured} fill={C.featured}/><span style={{ color:C.featured, fontSize:10, fontWeight:700 }}>Featured</span></div>}
                    </div>
                    <div style={{ padding:"12px 14px 14px" }}>
                      <div style={{ color:C.textSoft, fontSize:11, fontWeight:600, marginBottom:3 }}>{j.venue||emp?.name}</div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:17, color:C.textDark, marginBottom:4, lineHeight:1.2 }}>{j.title}</div>
                      <div style={{ color:C.sand, fontWeight:600, fontSize:13, marginBottom:8 }}>{j.salary}</div>
                      <div style={{ color:C.textMid, fontSize:13, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:10 }}>{stripTags(j.short)}</div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div style={{ color:C.textFaint, fontSize:11 }}>{j.loc} · {ago(j.ts)} ago</div>
                        <div style={{ color:C.terracotta, fontSize:12, fontWeight:600 }}>View role →</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {storyJob && <StoryViewer stories={storyJob.stories} startIndex={storyJob.startIndex} currentUser={user} onClose={()=>setStoryJob(null)} onApply={setExpandedJob}/>}
      {venueProfile && <VenueProfile emp={venueProfile} jobs={jobs} following={following} currentUser={user} onToggleFollow={toggleFollow} onApply={setExpandedJob} onBack={()=>setVenueProfile(null)}/>}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
// ─── Admin Uploads Viewer ────────────────────────────────────────────────────
function AdminUploads({ supabase }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [filter, setFilter] = useState("all"); // all | resumes | covers | photos

  useEffect(()=>{
    const load = async () => {
      setLoading(true);
      try {
        // Get all files from both buckets
        const [docsRes, photosRes] = await Promise.all([
          supabase.storage.from('documents').list('', { limit:200, sortBy:{ column:'created_at', order:'desc' } }),
          supabase.storage.from('job-photos').list('', { limit:200, sortBy:{ column:'created_at', order:'desc' } }),
        ]);

        const docs = (docsRes.data||[]).filter(f=>f.name!=='.emptyFolderPlaceholder').map(f=>({
          ...f,
          bucket: 'documents',
          url: supabase.storage.from('documents').getPublicUrl(f.name).data.publicUrl,
          type: f.name.includes('resume') ? 'resume' : f.name.includes('cover') ? 'cover' : 'document',
        }));

        const photos = (photosRes.data||[]).filter(f=>f.name!=='.emptyFolderPlaceholder').map(f=>({
          ...f,
          bucket: 'job-photos',
          url: supabase.storage.from('job-photos').getPublicUrl(f.name).data.publicUrl,
          type: 'photo',
        }));

        setFiles([...docs, ...photos]);
      } catch(e) { console.warn('Load uploads error:', e); }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = filter==="all" ? files
    : filter==="resumes" ? files.filter(f=>f.type==="resume")
    : filter==="covers" ? files.filter(f=>f.type==="cover")
    : files.filter(f=>f.type==="photo");

  const fmtBytes = b => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)}MB` : b > 1024 ? `${(b/1024).toFixed(0)}KB` : `${b}B`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, color:C.textDark, fontWeight:700, marginBottom:3 }}>All Uploads</div>
        <div style={{ color:C.textSoft, fontSize:13, marginBottom:12 }}>{files.length} files across documents and job photos</div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          {[["all","All"],["resumes","📋 Résumés"],["covers","✉️ Cover Letters"],["photos","📷 Job Photos"]].map(([v,l])=>(
            <button key={v} className="tap" onClick={()=>setFilter(v)}
              style={{ flexShrink:0, background:filter===v?C.terracottaL:"#fff", border:`1.5px solid ${filter===v?C.terracotta:C.border}`, borderRadius:20, padding:"5px 12px", color:filter===v?C.terracotta:C.textSoft, fontSize:11, fontWeight:filter===v?700:400 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign:"center", padding:"30px", color:C.textSoft }}>⏳ Loading uploads…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"30px", color:C.textFaint, background:C.bgSoft, borderRadius:12, border:`1px dashed ${C.border}` }}>
          No {filter === "all" ? "" : filter} uploads yet
        </div>
      )}

      {filtered.map((f,i) => (
        <div key={i} style={{ background:"#fff", borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
          {/* Preview */}
          {f.type==="photo"
            ? <img src={f.url} alt="" style={{ width:44, height:55, borderRadius:8, objectFit:"cover", flexShrink:0 }}/>
            : <div style={{ width:44, height:55, borderRadius:8, background:C.sageL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0, border:`1px solid ${C.sage}30` }}>
                {f.type==="resume"?"📋":f.type==="cover"?"✉️":"📄"}
              </div>
          }
          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:13, color:C.textDark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
            <div style={{ color:C.textSoft, fontSize:11, marginTop:2 }}>
              {f.type} · {f.metadata?.size ? fmtBytes(f.metadata.size) : ""}
              {f.created_at && ` · ${new Date(f.created_at).toLocaleDateString('en-AU')}`}
            </div>
          </div>
          {/* Actions */}
          <a href={f.url} target="_blank" rel="noreferrer"
            style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:8, padding:"6px 12px", color:C.terracotta, fontSize:12, fontWeight:600, textDecoration:"none", flexShrink:0 }}>
            View ↗
          </a>
        </div>
      ))}
    </div>
  );
}

function AdminDash({ jobs, setJobs, codes, setCodes, onLogout }) {
  const [tab, setTabRaw] = useState("listings");
  const [prevTab, setPrevTab] = useState("listings");
  const setTab = (next) => { setTabRaw(prev => { setPrevTab(prev); return next; }); };
  const goBack = () => setTabRaw(prevTab);
  const [editJob, setEditJob] = useState(null);
  const [viewJob, setViewJob] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [newCode, setNewCode] = useState({ code:"", pct:10, uses:50, desc:"", expires:"" });
  const [codeSaved, setCodeSaved] = useState(false);

  // Post job state
  const ADMIN_EMPLOYER = { id:"admin", name:"HospoSearch", handle:"hosposearch", avatar:"🍽️", verified:true, cuisine:"All sectors", size:"Platform", awards:[] };
  const [nj, setNj] = useState({ title:"", short:"", full:"", salary:"", salaryBand:"$70–90k", type:"Full-time", country:"Australia", state:"", city:"", sector:"", roleType:"", link:"", tags:[], featured:false, tier:"bronze", tierPrice:50, tierPriceId:"price_1TfwBfGkG9EGtGJgBv341e2n" });
  const [njPhotos, setNjPhotos] = useState([]);
  const [cropState, setCropState] = useState(null);
  const pickAndCropAdmin = () => {
    const r=document.createElement("input"); r.type="file"; r.accept="image/*";
    r.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=ev=>setCropState({ src:ev.target.result }); rd.readAsDataURL(f); };
    r.click();
  };
  const [njPosted, setNjPosted] = useState(false);
  const [njPosting, setNjPosting] = useState(false);
  const [njTagInput, setNjTagInput] = useState("");

  const postJob = async () => {
    if (!nj.title.trim() || !nj.short.trim()) return;
    setNjPosting(true);
    const fp = njPhotos.length > 0 ? njPhotos : [];
    const locStr = [nj.city, nj.state, nj.country].filter(Boolean).join(", ") || "Australia";
    const newJob = {
      id: "j" + Date.now(),
      empId: "admin",
      title: nj.title,
      venue: nj.venue.trim() || "HospoSearch",
      loc: locStr,
      country: nj.country,
      state: nj.state,
      city: nj.city,
      sector: nj.sector,
      roleType: nj.roleType,
      salary: nj.salary || "Competitive",
      salaryBand: nj.salaryBand,
      type: nj.type,
      tags: nj.tags,
      short: nj.short,
      full: nj.full || nj.short,
      link: nj.link || "#",
      applyEmail: nj.applyEmail?.trim() || "",
      photos: fp.length > 0 ? fp : [0, 1, 2],
      video: null,
      verified: true,
      featured: nj.featured || false,
      tier: nj.tier || "bronze",
      ts: Date.now(),
      apps: [],
      views: 0,
    };
    // Save to Supabase via admin API (service role — admin has no auth session)
    try {
      const saved = await sbAdminCreateJob(ADMIN_SECRET, newJob);
      setJobs(p => [saved, ...p]);
    } catch(e) {
      console.warn('Admin job save failed:', e);
      alert('Save failed — the job was not posted. Please try again.');
      setNjPosting(false);
      return;
    }
    setNjPosting(false);
    setNjPosted(true);
    setNj({ title:"", short:"", full:"", salary:"", salaryBand:"$70–90k", type:"Full-time", country:"Australia", state:"", city:"", sector:"", roleType:"", link:"", applyEmail:"", tags:[], featured:false, tier:"standard" });
    setNjPhotos([]);
    setTimeout(() => { setNjPosted(false); setTab('listings'); }, 2500);
  };
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(()=>{
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending:false });
        if (data && !error) setAllUsers(data.map(u=>({
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          handle: u.handle || u.email?.split('@')[0],
          avatar: u.avatar || (u.type==='employer'?'🍽️':'👨‍🍳'),
          type: u.type || 'employee',
          verified: u.verified || false,
          subscription_tier: u.subscription_tier,
          subscription_active: u.subscription_active,
          created_at: u.created_at,
        })));
      } catch(e) { console.warn('Load users error:', e); }
      setUsersLoading(false);
    };
    loadUsers();
  }, []);
  const IS = { width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 };
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#fff", overflow:"hidden" }}>
      <style>{G}</style>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:"#fff", flexShrink:0 }}>
        {(editJob||viewJob||editUser) ? (
          <button className="tap" onClick={()=>{ setEditJob(null); setViewJob(null); setEditUser(null); }} style={{ background:"none", border:"none", padding:"2px 8px 2px 0", display:"flex", alignItems:"center" }} title="Back">
            <Icon name="back" size={22} color={C.textDark}/>
          </button>
        ) : tab!=="listings" && (
          <button className="tap" onClick={goBack} style={{ background:"none", border:"none", padding:"2px 8px 2px 0", display:"flex", alignItems:"center" }} title="Back">
            <Icon name="back" size={22} color={C.textDark}/>
          </button>
        )}
        <div style={{ fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:19, color:C.textDark, flex:1 }}>🛡️ Admin Panel</div>
        <button className="tap" onClick={()=>window.location.href='/'} style={{ background:"none", border:"none", marginRight:10, padding:2 }} title="Home"><Icon name="home" size={20} color={C.textSoft}/></button>
        <span style={{ background:"#FEF2F0", color:C.error, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, border:`1px solid ${C.error}30`, marginRight:10 }}>ADMIN</span>
        <button className="tap" onClick={onLogout} style={{ background:"none", border:"none", color:C.textSoft, fontSize:13, fontWeight:500 }}>Sign out</button>
      </div>
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {[["listings","📋 Listings"],["post","➕ Post Job"],["users","👥 Users"],["docs","📁 Uploads"],["codes","🎟️ Codes"]].map(([t,l])=>(
          <button key={t} className="tap" onClick={()=>setTab(t)} style={{ flex:1, padding:"13px 0", border:"none", background:"transparent", color:tab===t?C.terracotta:C.textSoft, fontWeight:tab===t?600:400, fontSize:12, borderBottom:tab===t?`2.5px solid ${C.terracotta}`:"2.5px solid transparent" }}>{l}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:14 }}>
        {tab==="listings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ color:C.textFaint, fontSize:12, marginBottom:4 }}>{jobs.length} total listing{jobs.length!==1?"s":""}</div>
            {jobs.filter(j=>j&&j.id).map(j=>{ const emp=getEmp(j); const first=(j.photos||[0])[0]; const isd=isData(first); return (
              <div key={j.id} style={{ background:"#fff", borderRadius:13, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 5px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex", height:72 }}>
                  <div style={{ width:72, flexShrink:0, background:isd?"transparent":PBG[(typeof first==="number"?first:0)%PBG.length], overflow:"hidden" }}>
                    {isd?<img src={first} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:22, opacity:0.35 }}>{emp?.avatar||"📷"}</span></div>}
                  </div>
                  <div style={{ flex:1, padding:"10px 12px" }}>
                    <div className="tap" onClick={()=>setViewJob(j)} style={{ fontWeight:700, fontSize:13, color:C.textDark, marginBottom:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer" }}>{j.title}</div>
                    <div style={{ color:C.textSoft, fontSize:11, marginBottom:5 }}>{j.venue} · {j.type} · {ago(j.ts)} ago</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button className="tap" onClick={()=>setViewJob(j)} style={{ background:C.sageL, border:`1px solid ${C.sage}40`, borderRadius:7, padding:"4px 10px", color:C.sage, fontSize:11, fontWeight:600 }}>View</button>
                      <button className="tap" onClick={()=>setEditJob({...j})} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:7, padding:"4px 10px", color:C.terracotta, fontSize:11, fontWeight:600 }}>Edit</button>
                      <button className="tap" onClick={async ()=>{ if(window.confirm("Delete this listing?")) {
  setJobs(p=>p.filter(x=>x.id!==j.id));
  try {
    await adminJobAction('delete', j.id);
  } catch(e) { console.warn('Delete job error:', e); alert('Delete failed — please try again.'); }
}}} style={{ background:"#FEF2F0", border:`1px solid ${C.error}30`, borderRadius:7, padding:"4px 10px", color:C.error, fontSize:11, fontWeight:600 }}>Delete</button>
                      <button className="tap" onClick={async ()=>{
                        const newFeatured = !j.featured;
                        setJobs(p=>p.map(x=>x.id===j.id?{...x, featured:newFeatured}:x));
                        try { await adminJobAction('update', j.id, { featured: newFeatured }); }
                        catch(e) { console.warn('Pin error:', e); alert('Pin failed — please try again.'); }
                      }} style={{ background:j.featured?C.featuredL:C.bgSoft, border:`1px solid ${j.featured?C.featured+"40":C.border}`, borderRadius:7, padding:"4px 10px", color:j.featured?C.featured:C.textSoft, fontSize:11, fontWeight:600 }}>
                        {j.featured ? "📌 Unpin" : "📌 Pin to top"}
                      </button>
                      <span style={{ background:C.bgSoft, borderRadius:7, padding:"4px 9px", color:C.textSoft, fontSize:11 }}>{j.apps?.length||0} app{j.apps?.length!==1?"s":""}</span>
                      {j.featured && <span style={{ background:C.featuredL, borderRadius:7, padding:"4px 9px", color:C.featured, fontSize:11, fontWeight:600 }}>⭐ Featured</span>}
                    </div>
                  </div>
                </div>
              </div>
            ); })}
            {jobs.length===0 && <div style={{ textAlign:"center", padding:"50px 20px", color:C.textFaint }}><div style={{ fontSize:36, marginBottom:10 }}>📋</div>No listings yet</div>}
          </div>
        )}
        {/* Post a Job — as HospoSearch */}
        {tab==="post" && (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <button className="tap" onClick={()=>setTab("listings")}
                style={{ background:"none", border:"none", padding:"4px 2px", display:"flex", alignItems:"center" }}>
                <Icon name="back" size={22} color={C.textDark}/>
              </button>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, color:C.textDark, fontWeight:700 }}>Post a Job as HospoSearch</div>
            </div>
            <div style={{ color:C.textSoft, fontSize:13, marginBottom:16 }}>Post jobs directly to the feed under the HospoSearch brand.</div>

            {njPosted && (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:C.sageL, borderRadius:12, border:`1px solid ${C.sage}40`, marginBottom:14 }}>
                <span style={{ fontSize:22 }}>🎉</span>
                <div>
                  <div style={{ color:C.sage, fontWeight:700, fontSize:14 }}>Job posted successfully!</div>
                  <div style={{ color:C.textSoft, fontSize:12 }}>It's now live in the feed.</div>
                </div>
              </div>
            )}

            <div style={{ background:"#fff", borderRadius:14, padding:"16px", border:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:13 }}>

              {/* Tier selector */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:600 }}>Listing Tier</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[["standard","🥉 Bronze","Standard"],["featured","🥈 Silver","Featured"],["premium","🥇 Gold","Premium"]].map(([v,icon,label])=>(
                    <button key={v} className="tap" onClick={()=>setNj(j=>({...j,tier:v}))}
                      style={{ padding:"10px 6px", border:`2px solid ${nj.tier===v?C.terracotta:C.border}`, borderRadius:10, background:nj.tier===v?C.terracottaL:"#fff", color:nj.tier===v?C.terracotta:C.textMid, fontSize:11, fontWeight:nj.tier===v?700:400, textAlign:"center" }}>
                      <div style={{ fontSize:18, marginBottom:3 }}>{icon.split(" ")[0]}</div>
                      <div>{label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Venue Name <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(leave blank to post as HospoSearch)</span></div>
                <input value={nj.venue||""} onChange={e=>setNj(j=>({...j,venue:e.target.value}))} placeholder="e.g. Attica, Quay, The Grill — leave blank for anonymous" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:14 }}/>

                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, marginTop:4, fontWeight:600 }}>Job Title *</div>
                <input value={nj.title} onChange={e=>setNj(j=>({...j,title:e.target.value}))} placeholder="e.g. Head Chef, Bar Manager…" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:14 }}/>
              </div>

              {/* Location */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Country</div>
                <select value={nj.country} onChange={e=>setNj(j=>({...j,country:e.target.value,state:"",city:""}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                  {Object.keys(LOCATIONS).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>State / Region</div>
                  <select value={nj.state} onChange={e=>setNj(j=>({...j,state:e.target.value,city:""}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                    <option value="">Any</option>
                    {Object.keys(LOCATIONS[nj.country]||{}).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>City</div>
                  <select value={nj.city} onChange={e=>setNj(j=>({...j,city:e.target.value}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                    <option value="">Any</option>
                    {(LOCATIONS[nj.country]?.[nj.state]||[]).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Sector + Role Type */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Sector</div>
                  <select value={nj.sector} onChange={e=>setNj(j=>({...j,sector:e.target.value}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                    <option value="">Select…</option>
                    {SECTORS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Role Type</div>
                  <select value={nj.roleType} onChange={e=>setNj(j=>({...j,roleType:e.target.value}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                    <option value="">Select…</option>
                    {Object.entries(HOSPO_ROLES).map(([dept,roles])=><optgroup key={dept} label={dept}>{roles.map(r=><option key={r}>{r}</option>)}</optgroup>)}
                  </select>
                </div>
              </div>

              {/* Employment Type + Salary */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Employment Type</div>
                  <select value={nj.type} onChange={e=>setNj(j=>({...j,type:e.target.value}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                    {["Full-time","Part-time","Casual","Contract"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Salary Band</div>
                  <select value={nj.salaryBand} onChange={e=>setNj(j=>({...j,salaryBand:e.target.value}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}>
                    {SALARY_BANDS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Salary display */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Salary (display text)</div>
                <input value={nj.salary} onChange={e=>setNj(j=>({...j,salary:e.target.value}))} placeholder="e.g. $90–110k, Competitive, DOE" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}/>
              </div>

              {/* Short description */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Short Description * <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(shown in feed)</span></div>
                <textarea value={nj.short} onChange={e=>setNj(j=>({...j,short:e.target.value}))} placeholder="2–3 punchy sentences about the role…" rows={3} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13, resize:"none" }}/>
              </div>

              {/* Full description — rich text */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Full Description <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional — shown on detail page)</span></div>
                <RichTextEditor key={nj.title+"-admin"} value={nj.full} onChange={html=>setNj(j=>({...j,full:html}))} placeholder="Full job description, responsibilities, requirements…" fontSize={13} />
              </div>

              {/* Tags */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Tags</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:7 }}>
                  {nj.tags.map(tag=>(
                    <span key={tag} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, color:C.terracotta, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, display:"flex", alignItems:"center", gap:5 }}>
                      {tag}
                      <button onClick={()=>setNj(j=>({...j,tags:j.tags.filter(t=>t!==tag)}))} style={{ background:"none", border:"none", color:C.terracotta, fontSize:14, lineHeight:1, cursor:"pointer", padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input value={njTagInput} onChange={e=>setNjTagInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&njTagInput.trim()){ setNj(j=>({...j,tags:[...j.tags,njTagInput.trim()]})); setNjTagInput(""); }}} placeholder="Type a tag and press Enter…" style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13 }}/>
                  <button className="tap" onClick={()=>{ if(njTagInput.trim()){ setNj(j=>({...j,tags:[...j.tags,njTagInput.trim()]})); setNjTagInput(""); }}} style={{ background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 13px", color:C.textMid, fontSize:13 }}>Add</button>
                </div>
              </div>

              {/* Photos */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Photos <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(up to 5)</span></div>
                <button type="button" onClick={pickAndCropAdmin} disabled={njPhotos.length>=5} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:C.bgSoft, border:`1.5px dashed ${C.border}`, borderRadius:10, cursor:njPhotos.length>=5?"default":"pointer", color:C.textMid, fontSize:13, opacity:njPhotos.length>=5?0.5:1 }}>
                  📷 Tap to upload &amp; crop photos ({njPhotos.length}/5)
                </button>
                {njPhotos.length > 0 && (
                  <div style={{ display:"flex", gap:7, marginTop:8, flexWrap:"wrap" }}>
                    {njPhotos.map((p,i)=>(
                      <div key={i} style={{ position:"relative" }}>
                        <img src={p} alt="" style={{ width:48, height:60, borderRadius:8, objectFit:"cover" }}/>
                        <button onClick={()=>setNjPhotos(ps=>ps.filter((_,idx)=>idx!==i))} style={{ position:"absolute", top:-5, right:-5, width:18, height:18, borderRadius:"50%", background:C.error, border:"none", color:"white", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Apply link */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Application Link <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(optional)</span></div>
                <input value={nj.link} onChange={e=>setNj(j=>({...j,link:e.target.value}))} placeholder="https://venue.com/apply or leave blank" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}/>
              </div>

              {/* Application email */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Application Email <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(where applications are emailed)</span></div>
                <input value={nj.applyEmail||""} onChange={e=>setNj(j=>({...j,applyEmail:e.target.value}))} placeholder="hiring@venue.com" type="email" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}/>
                <div style={{ color:C.textFaint, fontSize:11, marginTop:5, lineHeight:1.4 }}>📥 Each applicant emails this address, and applications are also saved to the dashboard.</div>
              </div>


              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:600 }}>Screening Questions <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(candidates must answer when applying)</span></div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {[
                    ["rightToWork", "Right to work in Australia?"],
                    ["yearsExperience", "Years of hospitality experience?"],
                    ["noticePeriod", "Notice period required?"],
                    ["policeCheck", "Do you have a current police check?"],
                    ["relocate", "Are you willing to relocate for this role?"],
                    ["availableWeekends", "Are you available to work weekends?"],
                    ["availablePublicHolidays", "Are you available to work public holidays?"],
                    ["driverLicence", "Do you hold a current driver's licence?"],
                  ].map(([key, label]) => (
                    <div key={key} className="tap" onClick={()=>setNj(j=>({...j, screeningQ:{...(j.screeningQ||{}), [key]:!(j.screeningQ||{})[key]}}))}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:(nj.screeningQ||{})[key]?C.sageL:C.bgSoft, border:`1px solid ${(nj.screeningQ||{})[key]?C.sage+"50":C.border}`, borderRadius:9, cursor:"pointer", transition:"all 0.15s" }}>
                      <div style={{ width:18, height:18, borderRadius:4, background:(nj.screeningQ||{})[key]?C.sage:C.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {(nj.screeningQ||{})[key] && <Icon name="check" size={11} color="#fff"/>}
                      </div>
                      <span style={{ color:(nj.screeningQ||{})[key]?C.sage:C.textMid, fontSize:13, fontWeight:(nj.screeningQ||{})[key]?600:400 }}>{label}</span>
                    </div>
                  ))}

                  {/* Custom questions */}
                  {((nj.screeningQ||{}).custom||[]).map((q,i)=>(
                    <div key={`custom_${i}`} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, padding:"9px 12px", background:C.sageL, border:`1px solid ${C.sage}50`, borderRadius:9 }}>
                        <div style={{ width:18, height:18, borderRadius:4, background:C.sage, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <Icon name="check" size={11} color="#fff"/>
                        </div>
                        <span style={{ color:C.sage, fontSize:13, fontWeight:500, flex:1 }}>✏️ {q}</span>
                      </div>
                      <button className="tap" onClick={()=>setNj(j=>{ const custom=[...(j.screeningQ?.custom||[])]; custom.splice(i,1); return {...j, screeningQ:{...(j.screeningQ||{}), custom}}; })}
                        style={{ background:"none", border:"none", color:C.textFaint, fontSize:18, lineHeight:1, padding:"0 4px", cursor:"pointer" }}>×</button>
                    </div>
                  ))}

                  {/* Add custom question */}
                  <div style={{ display:"flex", gap:8, marginTop:4 }}>
                    <input id="adminCustomQInput"
                      placeholder="✏️ Add a custom question…"
                      style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 12px", color:C.textDark, fontSize:13 }}
                      onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); const v=e.target.value.trim(); if(!v) return; setNj(j=>{ const custom=[...(j.screeningQ?.custom||[]),v]; return {...j,screeningQ:{...(j.screeningQ||{}),custom}}; }); e.target.value=""; }}}
                    />
                    <button className="tap" onClick={()=>{ const el=document.getElementById("adminCustomQInput"); const v=el?.value?.trim(); if(!v) return; setNj(j=>{ const custom=[...(j.screeningQ?.custom||[]),v]; return {...j,screeningQ:{...(j.screeningQ||{}),custom}}; }); if(el) el.value=""; }}
                      style={{ background:C.sage, border:"none", borderRadius:9, padding:"9px 14px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", flexShrink:0 }}>
                      Add
                    </button>
                  </div>
                </div>
                <div style={{ color:C.textFaint, fontSize:11, marginTop:7 }}>Selected questions appear on the application form for this role</div>
              </div>

              {/* Listing tier */}
              <div style={{ marginBottom:16 }}>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:10, fontWeight:600 }}>Listing Tier</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { key:"bronze", label:"🥉 Bronze — Standard",  price:50,  featured:false, desc:"Listed in the feed · 30-day listing" },
                    { key:"silver", label:"🥈 Silver — Featured",  price:70,  featured:true,  desc:"Pinned to top · Featured badge · Priority placement" },
                    { key:"gold",   label:"🥇 Gold — Premium",     price:100, featured:true,  desc:"Max visibility · Highlighted in search · Dedicated support" },
                  ].map(t=>(
                    <div key={t.key} className="tap" onClick={()=>setNj(j=>({...j, tier:t.key, featured:t.featured, tierPrice:t.price}))}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:nj.tier===t.key?C.terracottaL:"#fff", border:`2px solid ${nj.tier===t.key?C.terracotta:C.border}`, borderRadius:12, cursor:"pointer", transition:"all 0.15s" }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:nj.tier===t.key?C.terracotta:C.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {nj.tier===t.key && <Icon name="check" size={12} color="#fff"/>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:nj.tier===t.key?C.terracotta:C.textDark }}>{t.label}</div>
                        <div style={{ color:C.textSoft, fontSize:11, marginTop:2 }}>{t.desc}</div>
                      </div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700, color:nj.tier===t.key?C.terracotta:C.textMid }}>${t.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post button */}
              <button className="btn-cta tap" onClick={postJob}
                disabled={njPosting||njPosted||!nj.title.trim()||!nj.short.trim()}
                style={{ background:njPosted?C.sage:njPosting?"#999":nj.title.trim()&&nj.short.trim()?`linear-gradient(135deg,${C.terracotta},#A84F2E)`:"#ccc", border:"none", borderRadius:12, padding:"14px 0", color:"#fff", fontWeight:700, fontSize:15, boxShadow:njPosted?`0 4px 14px ${C.sage}40`:nj.title.trim()&&nj.short.trim()?"0 4px 14px rgba(196,98,58,0.22)":"none", transition:"all 0.3s" }}>
                {njPosted ? "✅ Job Posted!" : njPosting ? "⏳ Uploading…" : "🚀 Post Job to Feed"}
              </button>
            </div>
          </div>
        )}

        {/* Uploads / Documents */}
        {tab==="docs" && (
          <AdminUploads supabase={supabase}/>
        )}

        {/* Discount Codes */}
        {tab==="codes" && (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, color:C.textDark, fontWeight:700, marginBottom:4 }}>Discount Codes</div>
            <div style={{ color:C.textSoft, fontSize:13, marginBottom:16 }}>Create and manage codes to give employers discounted listings.</div>

            {/* Create new code */}
            <div style={{ background:"#fff", borderRadius:14, padding:"14px 16px", border:`1px solid ${C.border}`, marginBottom:16, boxShadow:"0 1px 5px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight:600, fontSize:13, color:C.textDark, marginBottom:12 }}>Create New Code</div>
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                  <div>
                    <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontWeight:600 }}>Code</div>
                    <input value={newCode.code} onChange={e=>setNewCode(c=>({...c,code:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")}))} placeholder="e.g. HOSPO25" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13, textTransform:"uppercase", letterSpacing:1 }}/>
                  </div>
                  <div>
                    <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontWeight:600 }}>Discount %</div>
                    <input type="number" min="1" max="100" value={newCode.pct} onChange={e=>setNewCode(c=>({...c,pct:parseInt(e.target.value)||0}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13 }}/>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                  <div>
                    <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontWeight:600 }}>Max Uses</div>
                    <input type="number" min="1" value={newCode.uses} onChange={e=>setNewCode(c=>({...c,uses:parseInt(e.target.value)||1}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13 }}/>
                  </div>
                  <div>
                    <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontWeight:600 }}>Expires</div>
                    <input type="date" value={newCode.expires} onChange={e=>setNewCode(c=>({...c,expires:e.target.value}))} style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13 }}/>
                  </div>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontWeight:600 }}>Description</div>
                  <input value={newCode.desc} onChange={e=>setNewCode(c=>({...c,desc:e.target.value}))} placeholder="e.g. 25% off — early partner offer" style={{ width:"100%", background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.textDark, fontSize:13 }}/>
                </div>
                {codeSaved && <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:C.sageL, borderRadius:9, border:`1px solid ${C.sage}40` }}><span>✅</span><span style={{ color:C.sage, fontWeight:600, fontSize:12 }}>Code created!</span></div>}
                <button className="btn-cta tap" onClick={()=>{
                  if(!newCode.code.trim()||newCode.pct<1) return;
                  setCodes(p=>({ ...p, [newCode.code]: { pct:newCode.pct, uses:newCode.uses, used:0, desc:newCode.desc, expires:newCode.expires||"2099-12-31", active:true } }));
                  setNewCode({ code:"", pct:10, uses:50, desc:"", expires:"" });
                  setCodeSaved(true); setTimeout(()=>setCodeSaved(false), 2000);
                }} style={{ background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontWeight:700, fontSize:13, boxShadow:"0 3px 10px rgba(196,98,58,0.22)" }}>Create Code</button>
              </div>
            </div>

            {/* Existing codes */}
            <div style={{ fontWeight:600, fontSize:13, color:C.textDark, marginBottom:10 }}>Active Codes ({Object.keys(codes).length})</div>
            {Object.entries(codes).map(([code, data])=>{
              const usagePct = Math.round((data.used/data.uses)*100);
              const expired = new Date(data.expires) < new Date();
              return (
                <div key={code} style={{ background:"#fff", borderRadius:13, padding:"12px 14px", border:`1px solid ${expired||!data.active?C.error+"30":C.border}`, marginBottom:9, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ width:44, height:44, borderRadius:13, background:expired||!data.active?C.bgSoft:C.terracottaL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🎟️</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:15, color:C.textDark, letterSpacing:1 }}>{code}</span>
                        <span style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, color:C.terracotta, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>{data.pct}% off</span>
                        {(expired||!data.active) && <span style={{ background:"#FEF2F0", border:`1px solid ${C.error}30`, color:C.error, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>{expired?"EXPIRED":"INACTIVE"}</span>}
                      </div>
                      <div style={{ color:C.textSoft, fontSize:12, marginBottom:6 }}>{data.desc}</div>
                      {/* Usage bar */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <div style={{ flex:1, height:5, background:C.border, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:usagePct+"%", background:usagePct>80?C.error:C.terracotta, borderRadius:3, transition:"width 0.3s" }}/>
                        </div>
                        <span style={{ color:C.textFaint, fontSize:11, whiteSpace:"nowrap" }}>{data.used}/{data.uses} uses</span>
                      </div>
                      <div style={{ color:C.textFaint, fontSize:11 }}>Expires: {data.expires}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
                      <button className="tap" onClick={()=>setCodes(p=>({ ...p, [code]:{ ...p[code], active:!p[code].active } }))}
                        style={{ background:data.active?C.sageL:"#fff", border:`1px solid ${data.active?C.sage:C.border}`, borderRadius:7, padding:"4px 10px", color:data.active?C.sage:C.textSoft, fontSize:11, fontWeight:600 }}>
                        {data.active?"Active":"Paused"}
                      </button>
                      <button className="tap" onClick={()=>{ if(window.confirm("Delete code "+code+"?")) setCodes(p=>{ const n={...p}; delete n[code]; return n; }); }}
                        style={{ background:"#FEF2F0", border:`1px solid ${C.error}30`, borderRadius:7, padding:"4px 10px", color:C.error, fontSize:11, fontWeight:600 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(codes).length===0 && <div style={{ textAlign:"center", padding:"30px 20px", color:C.textFaint }}><div style={{ fontSize:32, marginBottom:8 }}>🎟️</div><div>No codes yet</div></div>}
          </div>
        )}

        {tab==="users" && (
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            <div style={{ color:C.textFaint, fontSize:12, marginBottom:4 }}>
              {usersLoading ? "Loading users…" : `${allUsers.length} registered users`}
            </div>
            {usersLoading && <div style={{ textAlign:"center", padding:"30px", color:C.textSoft, fontSize:13 }}>⏳ Loading…</div>}
            {allUsers.map(u=>(
              <div key={u.id} style={{ background:"#fff", borderRadius:13, border:`1px solid ${C.border}`, padding:"12px 14px", boxShadow:"0 1px 5px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.terracotta},${C.sand})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{u.avatar}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:C.textDark }}>{u.name}</div>
                    <div style={{ color:C.textSoft, fontSize:11 }}>{u.email}</div>
                    <div style={{ display:"flex", gap:6, marginTop:4 }}>
                      <span style={{ background:u.type==="employer"?C.terracottaL:C.sageL, border:`1px solid ${u.type==="employer"?C.terracottaM:C.sage+"40"}`, color:u.type==="employer"?C.terracotta:C.sage, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>{u.type.toUpperCase()}</span>
                      {u.verified && <span style={{ background:C.sageL, border:`1px solid ${C.sage}40`, color:C.sage, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>VERIFIED</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <button className="tap" onClick={()=>setEditUser({...u})} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:8, padding:"6px 12px", color:C.terracotta, fontSize:12, fontWeight:600 }}>Edit</button>
                    <button className="tap" onClick={()=>{
                      if(window.confirm(`Delete ${u.name}? This cannot be undone.`)) {
                        setAllUsers(p=>p.filter(x=>x.id!==u.id));
                        // Also delete from Supabase
                        supabase.from('profiles').delete().eq('id', u.id).then(({error})=>{ if(error) console.warn('Delete user error:',error); });
                      }
                    }} style={{ background:"#FEF2F0", border:`1px solid ${C.error}30`, borderRadius:8, padding:"6px 12px", color:C.error, fontSize:12, fontWeight:600 }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewJob && (
        <JobDetail
          job={viewJob}
          currentUser={{ id:"admin-preview" }}
          profile={null}
          following={[]}
          bookmarks={[]}
          onClose={()=>setViewJob(null)}
          onApply={()=>{}}
          onToggleFollow={()=>{}}
          onToggleBookmark={()=>{}}
          onVenueClick={()=>{}}
        />
      )}
      {editJob && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9000, display:"flex", alignItems:"flex-end", backdropFilter:"blur(3px)" }}>
          <div style={{ width:"100%", maxWidth:540, margin:"0 auto", background:"#fff", borderRadius:"22px 22px 0 0", padding:"6px 20px 40px", maxHeight:"92vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:"10px auto 16px" }}/>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:C.textDark }}>Edit Listing</div>
                <div style={{ color:C.textSoft, fontSize:12, marginTop:2 }}>{editJob.venue} · posted {ago(editJob.ts)} ago</div>
              </div>
              <button className="tap" onClick={()=>setEditJob(null)} style={{ background:"none", border:"none" }}><Icon name="close" size={22} color={C.textSoft}/></button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>

              {/* Title + Venue */}
              {[["Job Title","title"],["Venue Name","venue"]].map(([l,k])=>(
                <div key={k}>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>{l}</div>
                  <input value={editJob[k]||""} onChange={e=>setEditJob(j=>({...j,[k]:e.target.value}))} style={IS}/>
                </div>
              ))}

              {/* Application email */}
              <div>
                <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Application Email <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(applications emailed here)</span></div>
                <input value={editJob.applyEmail||""} onChange={e=>setEditJob(j=>({...j,applyEmail:e.target.value}))} placeholder="hiring@venue.com" type="email" style={IS}/>
              </div>

              {/* Apply link */}
              <div>
                <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Application Link <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(leave blank to apply via HospoSearch)</span></div>
                <input value={editJob.link==="#"?"":(editJob.link||"")} onChange={e=>setEditJob(j=>({...j,link:e.target.value}))} placeholder="https://venue.com/apply" style={IS}/>
              </div>

              {/* Location */}
              <div>
                <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Country</div>
                <select value={editJob.country||"Australia"} onChange={e=>setEditJob(j=>({...j,country:e.target.value,state:"",city:""}))} style={IS}>
                  {Object.keys(LOCATIONS).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>State / Region</div>
                  <select value={editJob.state||""} onChange={e=>setEditJob(j=>({...j,state:e.target.value,city:""}))} style={IS}>
                    <option value="">Any</option>
                    {Object.keys(LOCATIONS[editJob.country||"Australia"]||{}).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>City</div>
                  <select value={editJob.city||""} onChange={e=>setEditJob(j=>({...j,city:e.target.value}))} style={IS}>
                    <option value="">Any</option>
                    {(LOCATIONS[editJob.country||"Australia"]?.[editJob.state||""]||[]).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Sector + Role Type */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Sector</div>
                  <select value={editJob.sector||""} onChange={e=>setEditJob(j=>({...j,sector:e.target.value}))} style={IS}>
                    <option value="">Select…</option>
                    {SECTORS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Role Type</div>
                  <select value={editJob.roleType||""} onChange={e=>setEditJob(j=>({...j,roleType:e.target.value}))} style={IS}>
                    <option value="">Select…</option>
                    {Object.entries(HOSPO_ROLES).map(([dept,roles])=><optgroup key={dept} label={dept}>{roles.map(r=><option key={r}>{r}</option>)}</optgroup>)}
                  </select>
                </div>
              </div>

              {/* Employment Type + Salary Band */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Employment Type</div>
                  <select value={editJob.type||"Full-time"} onChange={e=>setEditJob(j=>({...j,type:e.target.value}))} style={IS}>
                    {["Full-time","Part-time","Casual","Contract"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Salary Band</div>
                  <select value={editJob.salaryBand||""} onChange={e=>setEditJob(j=>({...j,salaryBand:e.target.value}))} style={IS}>
                    {SALARY_BANDS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Salary display */}
              <div>
                <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Salary Display Text</div>
                <input value={editJob.salary||""} onChange={e=>setEditJob(j=>({...j,salary:e.target.value}))} placeholder="e.g. $90–110k, Competitive" style={IS}/>
              </div>

              {/* Short + Full description */}
              {[["Short Description (shown in feed)","short",3],["Full Description (detail page)","full",6]].map(([l,k,rows])=>(
                <div key={k}>
                  <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>{l}</div>
                  <textarea value={editJob[k]||""} onChange={e=>setEditJob(j=>({...j,[k]:e.target.value}))} rows={rows} style={{...IS,resize:"none"}}/>
                </div>
              ))}

              {/* Apply link */}
              <div>
                <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Apply Link</div>
                <input value={editJob.link||""} onChange={e=>setEditJob(j=>({...j,link:e.target.value}))} placeholder="https://…" style={IS}/>
              </div>

              {/* Tags */}
              <div>
                <div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Tags</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:7 }}>
                  {(editJob.tags||[]).map(tag=>(
                    <span key={tag} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, color:C.terracotta, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, display:"flex", alignItems:"center", gap:5 }}>
                      {tag}
                      <button onClick={()=>setEditJob(j=>({...j,tags:(j.tags||[]).filter(t=>t!==tag)}))} style={{ background:"none", border:"none", color:C.terracotta, fontSize:14, lineHeight:1, cursor:"pointer", padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <input onKeyDown={e=>{ if(e.key==="Enter"&&e.target.value.trim()){ setEditJob(j=>({...j,tags:[...(j.tags||[]),e.target.value.trim()]})); e.target.value=""; }}} placeholder="Type tag + Enter to add" style={IS}/>
              </div>

              {/* Photos */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:600 }}>Photos <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(up to 5 · reorder with ‹ ›)</span></div>
                <SortablePhotoGrid
                  photos={(editJob.photos||[]).filter(p=>isData(p))}
                  onPhotos={newList=>setEditJob(j=>({...j, photos:newList}))}
                  maxPhotos={5}
                />
              </div>

              {/* Transfer to employer */}
              <div>
                <div style={{ color:C.textSoft, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:600 }}>Transfer to Employer <span style={{ color:C.textFaint, fontWeight:400, textTransform:"none", fontSize:11, letterSpacing:0 }}>(enter their email to hand off this listing)</span></div>
                <div style={{ display:"flex", gap:8 }}>
                  <input
                    placeholder="employer@venue.com.au"
                    id="transfer-email-input"
                    style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.textDark, fontSize:13 }}
                  />
                  <button className="tap" onClick={async ()=>{
                    const email = document.getElementById('transfer-email-input').value.trim();
                    if (!email) return;
                    // Find user by email in Supabase
                    const { data } = await supabase.from('profiles').select('id,name,handle').eq('email', email).single();
                    if (!data) { alert('No account found with that email. Ask them to sign up first.'); return; }
                    if (window.confirm(`Transfer this listing to ${data.name} (@${data.handle})?`)) {
                      setEditJob(j=>({...j, empId:data.id, venue:data.name}));
                      document.getElementById('transfer-email-input').value = '';
                      alert(`✅ Listing will transfer to ${data.name} when you save.`);
                    }
                  }} style={{ background:C.terracottaL, border:`1px solid ${C.terracottaM}`, borderRadius:9, padding:"10px 14px", color:C.terracotta, fontSize:13, fontWeight:600 }}>
                    Transfer
                  </button>
                </div>
                {editJob.empId !== 'admin' && editJob.empId && (
                  <div style={{ color:C.sage, fontSize:12, marginTop:5 }}>✓ Currently assigned to emp ID: {editJob.empId}</div>
                )}
              </div>

              {/* Featured + Verified toggles */}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[["featured","⭐ Featured listing",C.featured,C.featuredL],["verified","✅ Verified venue",C.sage,C.sageL]].map(([key,label,clr,bg])=>(
                  <div key={key} className="tap" onClick={()=>setEditJob(j=>({...j,[key]:!j[key]}))}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 12px", background:editJob[key]?bg:C.bgSoft, borderRadius:10, border:`1px solid ${editJob[key]?clr+"40":C.border}`, cursor:"pointer" }}>
                    <div style={{ width:20, height:20, borderRadius:5, background:editJob[key]?clr:C.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {editJob[key] && <Icon name="check" size={12} color="#fff"/>}
                    </div>
                    <span style={{ color:editJob[key]?clr:C.textMid, fontSize:13, fontWeight:500 }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:9, marginTop:4 }}>
                <button className="tap" onClick={()=>{ setEditJob(null); setEditSaving(false); setEditSaved(false); }} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"13px 0", color:C.textMid, fontSize:14 }}>Cancel</button>
                <button className="btn-cta tap" disabled={editSaving} onClick={async ()=>{
                  setEditSaving(true);
                  // Upload any new base64 photos to Supabase Storage
                  const updatedPhotos = [];
                  for (let i = 0; i < (editJob.photos||[]).length; i++) {
                    const p = editJob.photos[i];
                    if (typeof p === 'string' && p.startsWith('data:')) {
                      try {
                        const res = await fetch(p);
                        const blob = await res.blob();
                        const ext = blob.type.includes('png') ? 'png' : 'jpg';
                        const path = `jobs/${editJob.id}/${Date.now()}_${i}.${ext}`;
                        const { error } = await supabase.storage.from('job-photos').upload(path, blob, { upsert:true, contentType:blob.type });
                        if (!error) {
                          const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(path);
                          updatedPhotos.push(urlData.publicUrl);
                        } else { updatedPhotos.push(p); }
                      } catch(e) { updatedPhotos.push(p); }
                    } else { updatedPhotos.push(p); }
                  }
                  const locStr = [editJob.city,editJob.state,editJob.country].filter(Boolean).join(", ")||editJob.loc||"Australia";
                  const updated = {...editJob, loc:locStr, photos:updatedPhotos, link:(editJob.link||"").trim()||"#"};
                  // Save to Supabase via admin API (service role, bypasses RLS)
                  try {
                    await adminJobAction('update', updated.id, {
                      title: updated.title, venue: updated.venue, loc: updated.loc,
                      country: updated.country, state: updated.state, city: updated.city,
                      sector: updated.sector, role_type: updated.roleType,
                      salary: updated.salary, salary_band: updated.salaryBand,
                      type: updated.type, tags: updated.tags,
                      short: updated.short, full_desc: updated.full,
                      link: updated.link, apply_email: updated.applyEmail||"", photos: updatedPhotos,
                      featured: updated.featured, verified: updated.verified,
                    });
                  } catch(e) { console.warn('Update job error:', e); alert('Save failed — please try again.'); }
                  setJobs(p=>p.map(j=>j.id===updated.id?updated:j));
                  setEditSaving(false);
                  setEditSaved(true);
                  setTimeout(()=>{ setEditSaved(false); setEditJob(null); }, 1800);
                }} style={{ flex:2, background:editSaved?C.sage:editSaving?"#999":`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"13px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:editSaved?`0 3px 10px ${C.sage}40`:"0 3px 10px rgba(196,98,58,0.22)", transition:"all 0.3s" }}>
                  {editSaved ? "✅ Saved!" : editSaving ? "⏳ Uploading…" : "💾 Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editUser && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, display:"flex", alignItems:"flex-end", backdropFilter:"blur(2px)" }}>
          <div style={{ width:"100%", maxWidth:520, margin:"0 auto", background:"#fff", borderRadius:"20px 20px 0 0", padding:"6px 20px 40px", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:"10px auto 18px" }}/>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700, color:C.textDark }}>Edit User</div>
              <button className="tap" onClick={()=>setEditUser(null)} style={{ background:"none", border:"none" }}><Icon name="close" size={20} color={C.textSoft}/></button>
            </div>
            <div style={{ background:C.bgSoft, borderRadius:10, padding:"10px 12px", marginBottom:14, border:`1px solid ${C.border}` }}><div style={{ color:C.textFaint, fontSize:11 }}>Note: In production, changes persist to your database.</div></div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[["Name","name"],["Email","email"],["Handle","handle"],editUser.type==="employer"?["Bio","bio"]:["Role","role"]].map(([l,k])=>(
                <div key={k}><div style={{ color:C.textSoft, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontWeight:600 }}>{l}</div><input value={editUser[k]||""} onChange={e=>setEditUser(u=>({...u,[k]:e.target.value}))} style={IS}/></div>
              ))}
              <div className="tap" onClick={()=>setEditUser(u=>({...u,verified:!u.verified}))} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:editUser.verified?C.sageL:C.bgSoft, borderRadius:10, border:`1px solid ${editUser.verified?C.sage+"40":C.border}`, cursor:"pointer" }}>
                <div style={{ width:18, height:18, borderRadius:4, background:editUser.verified?C.sage:C.border, display:"flex", alignItems:"center", justifyContent:"center" }}>{editUser.verified&&<Icon name="check" size={11} color="#fff"/>}</div>
                <span style={{ color:C.textMid, fontSize:13 }}>Verified {editUser.type}</span>
              </div>
              <div style={{ display:"flex", gap:9, marginTop:4 }}>
                <button className="tap" onClick={()=>setEditUser(null)} style={{ flex:1, background:C.bgSoft, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 0", color:C.textMid, fontSize:14 }}>Cancel</button>
                <button className="btn-cta tap" onClick={()=>setEditUser(null)} style={{ flex:2, background:`linear-gradient(135deg,${C.terracotta},#A84F2E)`, border:"none", borderRadius:10, padding:"12px 0", color:"#fff", fontWeight:700, fontSize:14, boxShadow:"0 3px 10px rgba(196,98,58,0.22)" }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {cropState && <ImageCropper src={cropState.src} onConfirm={(cropped)=>{ setNjPhotos(p=>[...p.slice(0,4),cropped]); setCropState(null); }} onCancel={()=>setCropState(null)}/>}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]     = useState(null);
  const [type, setType]     = useState(null);
  const [altAccount, setAltAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [jobs, setJobs]     = useState(INIT_JOBS);
  const [profile, setProfile] = useState({ resume:null, coverLetter:null });
  const [following, setFollowing] = useState([]);

  // Populate profile docs from the saved user record so they auto-attach to applications
  useEffect(()=>{
    if (!user) return;
    setProfile(p => ({
      ...p,
      resume: user.resume_url ? { name:user.resume_name||'Résumé', url:user.resume_url } : p.resume,
      coverLetter: user.cover_url ? { name:user.cover_name||'Cover Letter', url:user.cover_url } : p.coverLetter,
    }));
  }, [user?.id]);

  // Load following from Supabase
  useEffect(()=>{
    if (!user?.id) return;
    supabase.from('following').select('following_id').eq('follower_id', user.id)
      .then(({ data }) => { if (data) setFollowing(data.map(r=>r.following_id)); });
  }, [user?.id]);
  const [messages, setMessages]   = useState(INIT_MESSAGES);
  const [notifs, setNotifs]       = useState(INIT_NOTIFS);
  const [notifPrefs, setNotifPrefs]     = useState(DEFAULT_NOTIF_PREFS);
  const [codes, setCodes]               = useState(INIT_CODES);

  // ── Handle Stripe payment return ────────────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState(null); // success | cancelled | null

  // ── Load session + jobs on mount ──────────────────────────────────────────
  useEffect(()=>{
    // Check for Stripe payment return
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentStatus('success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('payment') === 'cancelled') {
      setPaymentStatus('cancelled');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('subscription') === 'success') {
      const plan = params.get('plan') || '';
      setPaymentStatus('subscription_success_' + plan);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('subscription') === 'cancelled') {
      setPaymentStatus('subscription_cancelled');
      window.history.replaceState({}, '', window.location.pathname);
    }

    const init = async () => {
      try {
        // Try to restore session from Supabase
        const profile = await getSession();
        if (profile) {
          setUser(profile);
          setType(profile.type === 'admin' ? 'admin' : profile.type === 'employer' ? 'employer' : 'employee');
        }
      } catch(e) { /* no session — show login */ }

      // Load jobs from Supabase
      try {
        const dbJobs = await fetchJobs();
        if (Array.isArray(dbJobs)) setJobs(dbJobs);
      } catch(e) { /* use seed data if DB empty */ }

      // If returning from a successful payment, the webhook may still be
      // flipping the job to paid/active. Re-fetch a couple of times to catch it.
      if (params.get('payment') === 'success') {
        [1500, 4000].forEach(delay => setTimeout(async () => {
          try { const j = await fetchJobs(); if (Array.isArray(j)) setJobs(j); } catch(e) {}
        }, delay));
      }

      // Load discount codes from Supabase
      try {
        const dbCodes = await fetchCodes();
        if (dbCodes && Object.keys(dbCodes).length > 0) setCodes(dbCodes);
      } catch(e) { /* use seed codes */ }

      setLoading(false);
    };
    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setType(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    try { await signOut(); } catch(e) {}
    setUser(null); setType(null);
  };

  const handleLogin = async (u, t) => {
    setUser(u); setType(t);
    if (u?.id) localStorage.setItem('hs_pref_type_' + u.id, t);
    if (u?.email && t !== 'admin') {
      try {
        const otherType = t === 'employer' ? 'employee' : 'employer';
        const { data } = await supabase.from('profiles').select('*').eq('email', u.email).eq('type', otherType).single();
        if (data) setAltAccount({ profile: data, type: otherType });
        else setAltAccount(null);
      } catch(e) { setAltAccount(null); }
    }
    try {
      const dbJobs = await fetchJobs();
      if (Array.isArray(dbJobs)) setJobs(dbJobs);
    } catch(e) {}
  };

  const switchAccount = () => {
    if (!altAccount) return;
    const prev = { profile: user, type };
    setUser(altAccount.profile);
    setType(altAccount.type);
    setAltAccount({ profile: prev.profile, type: prev.type });
  };

  if (loading) return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#FAF8F4", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=DM+Sans:wght@400;500&display=swap');`}</style>
      <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,#C4623A,#C9A96E)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, marginBottom:16, boxShadow:"0 6px 18px rgba(196,98,58,0.3)" }}>🍽️</div>
      <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:800, color:"#1A1A1A", letterSpacing:-0.5 }}><span style={{ color:"#C4623A" }}>Hospo</span>Search</div>
      <div style={{ color:"#BBB", fontSize:12, marginTop:8, letterSpacing:2, textTransform:"uppercase" }}>Loading…</div>
    </div>
  );

  // Show login/signup modal if triggered from PublicBrowse
  if ((showLogin||showSignup) && !user) return <Login defaultScreen={showSignup?"signup":"login"} onLogin={(u,t)=>{ setShowLogin(false); setShowSignup(false); handleLogin(u,t); }} onClose={()=>{ setShowLogin(false); setShowSignup(false); }}/>;
  // Arriving from landing "Get Started" — show employer signup with Employer tab pre-selected
  const _tierParam = new URLSearchParams(window.location.search).get('tier');
  if (!user && _tierParam) return <Login defaultScreen="signup" defaultMode="employer" onLogin={(u,t)=>{ handleLogin(u,t); }} onClose={()=>{ window.history.replaceState({},'','/app'); }}/>;
  if (!user) return <PublicBrowse jobs={jobs} onLogin={()=>setShowLogin(true)} onSignup={()=>setShowSignup(true)} initialSearch={new URLSearchParams(window.location.search).get('search')||""}/>;
  if (type==="admin")    return <AdminDash jobs={jobs} setJobs={setJobs} codes={codes} setCodes={setCodes} onLogout={logout}/>;
  if (type==="employer") return <EmployerDash user={user} jobs={jobs} setJobs={setJobs} messages={messages} setMessages={setMessages} codes={codes} setCodes={setCodes} onLogout={logout} paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus} altAccount={altAccount} onSwitchAccount={switchAccount}/>;
  return <EmployeeApp user={user} jobs={jobs} setJobs={setJobs} profile={profile} setProfile={setProfile} following={following} setFollowing={setFollowing} messages={messages} setMessages={setMessages} notifs={notifs} setNotifs={setNotifs} notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs} onLogout={logout} altAccount={altAccount} onSwitchAccount={switchAccount}/>;
}
