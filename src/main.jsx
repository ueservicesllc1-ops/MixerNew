import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config.js'
import './index.css'
import App from './App.jsx'

// Dev: quitar SW viejo (interceptaba /manifest.json y causaba "Syntax error" línea 1).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
