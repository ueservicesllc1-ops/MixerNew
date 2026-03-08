import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Multitrack from './pages/Multitrack'
import Admin from './pages/Admin'
import Store from './pages/Store'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'
import About from './pages/About'
import Software from './pages/Software'
import Recursos from './pages/Recursos'
import Library from './pages/Library'
import './index.css'

// Detecta si corre dentro de Capacitor (Android/iOS) o en el navegador web
const isNativeApp = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor?.isNativePlatform?.() === true
}

function App() {
  const native = isNativeApp()

  return (
    <Router>
      <Routes>
        {/* 
          En Android/iOS (APK): la raíz va directo al Multitrack.
          En web (browser): muestra la Landing page normal.
        */}
        <Route
          path="/"
          element={native ? <Navigate to="/multitrack" replace /> : <Landing />}
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/multitrack" element={<Multitrack />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/store" element={<Store />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/software" element={<Software />} />
        <Route path="/recursos" element={<Recursos />} />
        <Route path="/library" element={<Library />} />
      </Routes>
    </Router>
  )
}

export default App
