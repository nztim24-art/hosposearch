import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Jobs from './Jobs.jsx'

// The public job pages (/, /jobs, /jobs/:id) are what Google and most visitors
// load first, so only they ship in the main bundle. The logged-in app, the About
// page and the giveaway terms download on demand.
// If a chunk fails to load (usually: the site was redeployed while this tab was
// open, so the old file is gone), reload once to pick up the new version.
const load = (importer) => lazy(() => importer().catch((err) => {
  let reloaded = false
  try { reloaded = sessionStorage.getItem('hs_chunk_reload') === '1'; sessionStorage.setItem('hs_chunk_reload', '1') } catch (e) {}
  if (reloaded) throw err
  window.location.reload()
  return new Promise(() => {})
}))
const App = load(() => import('./App.jsx'))
const Landing = load(() => import('./Landing.jsx'))
const GiveawayTerms = load(() => import('./GiveawayTerms.jsx'))

const Loading = () => (
  <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff', color:'#7A7570', fontFamily:"'Montserrat',system-ui,sans-serif", fontSize:14 }}>Loading…</div>
)

export default function Root() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/"          element={<Jobs home />} />
        <Route path="/about"     element={<Landing />} />
        <Route path="/app"       element={<App />} />
        <Route path="/app/*"     element={<App />} />
        <Route path="/jobs"      element={<Jobs />} />
        <Route path="/jobs/:id"  element={<Jobs detail />} />
        <Route path="/map"       element={<Jobs map />} />
        <Route path="/login"     element={<Navigate to="/app" replace />} />
        <Route path="/signup"    element={<Navigate to="/app" replace />} />
        <Route path="/giveaway-terms" element={<GiveawayTerms />} />
        <Route path="*"          element={<Navigate to="/"    replace />} />
      </Routes>
    </Suspense>
  )
}
