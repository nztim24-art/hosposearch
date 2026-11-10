// Browse live roles on a map (/map). Leaflet and the OpenStreetMap tiles are
// loaded from a CDN only when this page is opened.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { jobGeo } from './seo/shared.js'

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet'

let leafletPromise = null
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `${LEAFLET}.css`
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = `${LEAFLET}.js`
    js.async = true
    js.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet missing')))
    js.onerror = () => { leafletPromise = null; reject(new Error('Leaflet failed to load')) }
    document.head.appendChild(js)
  })
  return leafletPromise
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Roles at the same spot (one venue hiring for several roles, or several venues
// we only know the suburb for) share one pin.
export function groupPins(jobs) {
  const pins = new Map()
  for (const job of jobs) {
    const geo = jobGeo(job)
    if (!geo) continue
    const key = `${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`
    if (!pins.has(key)) pins.set(key, { lat: geo.lat, lng: geo.lng, jobs: [] })
    pins.get(key).jobs.push(job)
  }
  return [...pins.values()]
}

const REGIONS = [
  { label: 'All', match: () => true },
  { label: 'Australia', match: j => j.country === 'Australia' },
  { label: 'New Zealand', match: j => j.country === 'New Zealand' },
  { label: 'Elsewhere', match: j => j.country !== 'Australia' && j.country !== 'New Zealand' },
]

export default function JobsMap({ jobs, loading }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [region, setRegion] = useState('All')

  const shown = useMemo(() => jobs.filter(REGIONS.find(r => r.label === region).match), [jobs, region])
  const pins = useMemo(() => groupPins(shown), [shown])
  const pinned = pins.reduce((n, p) => n + p.jobs.length, 0)
  const regions = REGIONS.filter(r => r.label === 'All' || jobs.some(j => r.match(j) && jobGeo(j)))

  useEffect(() => {
    const prev = document.title
    document.title = 'Hospitality jobs on a map | HospoSearch'
    return () => { document.title = prev }
  }, [])

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !el.current || map.current) return
      map.current = L.map(el.current, { scrollWheelZoom: false }).setView([-30, 150], 4)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current)
      // Scroll-to-zoom only after a click, so the page still scrolls past the map on a phone or trackpad
      map.current.on('click', () => map.current.scrollWheelZoom.enable())
      layer.current = L.layerGroup().addTo(map.current)
      setReady(true)
    }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false; if (map.current) { map.current.remove(); map.current = null } }
  }, [])

  useEffect(() => {
    const L = window.L
    if (!ready || !L || !map.current) return
    layer.current.clearLayers()
    for (const p of pins) {
      const html = `<div class="jm-pop">${p.jobs.slice(0, 8).map(j =>
        `<a href="/jobs/${esc(j.id)}"><strong>${esc(j.title)}</strong><span>${esc(j.venue)}${j.loc ? ' · ' + esc(j.loc) : ''}</span></a>`).join('')}${
        p.jobs.length > 8 ? `<em>+ ${p.jobs.length - 8} more here</em>` : ''}</div>`
      L.marker([p.lat, p.lng], {
        title: p.jobs.length === 1 ? `${p.jobs[0].title} at ${p.jobs[0].venue}` : `${p.jobs.length} roles`,
        icon: L.divIcon({ className: '', html: `<div class="jm-pin"><b>${p.jobs.length > 1 ? p.jobs.length : ''}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] }),
      }).bindPopup(html, { maxWidth: 280 }).addTo(layer.current)
    }
    if (pins.length === 1) map.current.setView([pins[0].lat, pins[0].lng], 13)
    else if (pins.length > 1) map.current.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 13 })
  }, [ready, pins])

  return (
    <div className="jm">
      <style>{`
        .jm{max-width:1100px;margin:0 auto;padding:24px 16px 48px;}
        .jm h1{font-size:clamp(26px,5vw,38px);line-height:1.1;margin:10px 0 8px;}
        .jm-sub{color:#7A7570;font-size:15px;margin-bottom:16px;}
        .jm-map{height:min(68vh,640px);min-height:380px;border-radius:16px;border:1px solid #E8E2D8;overflow:hidden;background:#EFEAE1;z-index:0;position:relative;}
        .jm-note{font-size:13px;color:#7A7570;margin-top:10px;}
        .jm-pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#C4623A;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#fff;font:700 12px/26px system-ui,sans-serif;text-align:center;}
        .jm-pin b{display:block;transform:rotate(45deg);}
        .jm-pop a{display:block;padding:7px 0;border-bottom:1px solid #EEE8DE;text-decoration:none;color:#0F0E0C;}
        .jm-pop a:last-of-type{border-bottom:0;}
        .jm-pop strong{display:block;font-size:14px;color:#C4623A;}
        .jm-pop span{display:block;font-size:12px;color:#7A7570;}
        .jm-pop em{display:block;font-size:12px;color:#7A7570;padding-top:6px;}
      `}</style>
      <Link to="/" className="jb-back">← All roles</Link>
      <h1 className="jb-serif">Hospitality jobs on a map</h1>
      <div className="jm-sub">
        {loading ? 'Loading roles…' : `${pinned} of ${shown.length} live role${shown.length !== 1 ? 's' : ''} pinned. Tap a pin to see the role.`}
      </div>
      {regions.length > 2 && (
        <div className="jb-filters" style={{ padding: '0 0 14px', justifyContent: 'flex-start' }}>
          {regions.map(r => (
            <button key={r.label} className={`jb-pill ${region === r.label ? 'active' : ''}`} aria-pressed={region === r.label} onClick={() => setRegion(r.label)}>{r.label}</button>
          ))}
        </div>
      )}
      <div ref={el} className="jm-map" role="application" aria-label="Map of live hospitality roles" />
      {failed && <div className="jm-note">The map couldn't load. <Link to="/">Browse the list of roles instead →</Link></div>}
      {!failed && !loading && pinned < shown.length && (
        <div className="jm-note">Roles without a street address are shown in their suburb or city, or left off the map. <Link to="/">See every role in the list →</Link></div>
      )}
    </div>
  )
}
