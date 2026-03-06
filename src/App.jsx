import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Multitrack from './pages/Multitrack'
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
      </Routes>
    </Router>
  )
}

export default App
