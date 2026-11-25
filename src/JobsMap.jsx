// Browse live roles on a map (/map). Leaflet and the clustering plugin are
// bundled into this page's own chunk, so they only download when the map opens
// and come from our own CDN rather than unpkg.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { jobGeo } from './seo/shared.js'

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
    if (!el.current || map.current) return
    map.current = L.map(el.current, { scrollWheelZoom: false, preferCanvas: true }).setView([-30, 150], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current)
    // Scroll-to-zoom only after a click, so the page still scrolls past the map on a phone or trackpad
    map.current.on('click', () => map.current.scrollWheelZoom.enable())
    // Nearby pins merge into one numbered bubble until you zoom in, so the map
    // draws a handful of markers instead of 150+ overlapping ones.
    layer.current = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: c => L.divIcon({ className: '', html: `<div class="jm-cl">${c.getAllChildMarkers().reduce((n, m) => n + (m.jobCount || 1), 0)}</div>`, iconSize: [38, 38] }),
    }).addTo(map.current)
    setReady(true)
    return () => { if (map.current) { map.current.remove(); map.current = null } }
  }, [])

  useEffect(() => {
    if (!ready || !map.current) return
    layer.current.clearLayers()
    const markers = []
    for (const p of pins) {
      const html = `<div class="jm-pop">${p.jobs.slice(0, 8).map(j =>
        `<a href="/jobs/${esc(j.id)}"><strong>${esc(j.title)}</strong><span>${esc(j.venue)}${j.loc ? ' · ' + esc(j.loc) : ''}</span></a>`).join('')}${
        p.jobs.length > 8 ? `<em>+ ${p.jobs.length - 8} more here</em>` : ''}</div>`
      const m = L.marker([p.lat, p.lng], {
        title: p.jobs.length === 1 ? `${p.jobs[0].title} at ${p.jobs[0].venue}` : `${p.jobs.length} roles`,
        icon: L.divIcon({ className: '', html: `<div class="jm-pin"><b>${p.jobs.length > 1 ? p.jobs.length : ''}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] }),
      }).bindPopup(html, { maxWidth: 280 })
      m.jobCount = p.jobs.length
      markers.push(m)
    }
    layer.current.addLayers(markers)
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
        .jm-cl{width:38px;height:38px;border-radius:50%;background:#C4623A;border:3px solid rgba(255,255,255,.9);box-shadow:0 2px 6px rgba(0,0,0,.3);color:#fff;font:700 13px/32px system-ui,sans-serif;text-align:center;}
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
      {!loading && pinned < shown.length && (
        <div className="jm-note">Roles without a street address are shown in their suburb or city, or left off the map. <Link to="/">See every role in the list →</Link></div>
      )}
    </div>
  )
}
