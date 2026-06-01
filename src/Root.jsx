import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './Landing.jsx'
import App from './App.jsx'
import Jobs from './Jobs.jsx'

export default function Root() {
  return (
    <Routes>
      <Route path="/"          element={<Landing />} />
      <Route path="/app"       element={<App />} />
      <Route path="/app/*"     element={<App />} />
      <Route path="/jobs"      element={<Jobs />} />
      <Route path="/jobs/:id"  element={<Jobs detail />} />
      <Route path="/login"     element={<Navigate to="/app" replace />} />
      <Route path="/signup"    element={<Navigate to="/app" replace />} />
      <Route path="*"          element={<Navigate to="/"    replace />} />
    </Routes>
  )
}
