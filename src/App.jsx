import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Landing from './pages/Landing'
import Admin from './pages/Admin'
import Store from './pages/Store'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'
import DeleteAccount from './pages/DeleteAccount'
import About from './pages/About'
import Software from './pages/Software'
import Recursos from './pages/Recursos'
import RecursosAudio from './pages/RecursosAudio'
import Library from './pages/Library'
import Vendedores from './pages/Vendedores'
import SellerProfile from './pages/SellerProfile'
import Checkout from './pages/Checkout'
import './index.css'

// Heavy pages — loaded on demand to reduce initial bundle size
const Dashboard  = lazy(() => import('./pages/Dashboard'))
const Multitrack = lazy(() => import('./pages/Multitrack'))
const Academy    = lazy(() => import('./pages/Academy'))
const Manual     = lazy(() => import('./pages/Manual'))
const NextGenTest = lazy(() => import('./pages/NextGenTest'))

const PageLoader = () => (
  <div style={{
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f172a', color: '#8b5cf6', flexDirection: 'column', gap: 16,
  }}>
    <div style={{
      width: 40, height: 40, border: '4px solid rgba(139,92,246,0.2)',
      borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

import { KeepAwake } from '@capacitor-community/keep-awake';
import { useEffect } from 'react';

// Detecta si corre dentro de Capacitor (Android/iOS) o en el navegador web
const isNativeApp = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor?.isNativePlatform?.() === true
}

// Detecta si corre como PWA instalada (standalone — no en pestaña del navegador)
const isPWA = () => {
  return typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     window.navigator.standalone === true)
}

function App() {
  const native = isNativeApp()
  const pwa = isPWA()

  useEffect(() => {
    if (native) {
      KeepAwake.keepAwake().catch(console.error);
    }
  }, [native]);

  useEffect(() => {
    if (!pwa) return;
    const hash = window.location.hash || '';
    if (hash === '' || hash === '#' || hash === '#/') {
      window.location.replace(`${window.location.origin}/#/multitrack`);
    }
  }, [pwa]);

  // Precarga el chunk de Multitrack para que #/multitrack no espere tanto al lazy (misma ruta que lazy()).
  useEffect(() => {
    const run = () => import('./pages/Multitrack');
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(run);
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={(native || pwa) ? <Navigate to="/multitrack" replace /> : <Landing />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/multitrack" element={<Multitrack />} />
          {/* Isolated NextGen native engine manual test — not part of production multitrack flow */}
          <Route path="/nextgen-test" element={<NextGenTest />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/store" element={<Store />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/delete" element={<DeleteAccount />} />
          <Route path="/about" element={<About />} />
          <Route path="/software" element={<Software />} />
          <Route path="/recursos" element={<Recursos />} />
          <Route path="/recursos/audio" element={<RecursosAudio />} />
          <Route path="/library" element={<Library />} />
          <Route path="/vendedores" element={<Vendedores />} />
          <Route path="/seller/:id" element={<SellerProfile />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/manual" element={<Manual />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
