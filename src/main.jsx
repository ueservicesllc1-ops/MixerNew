import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config.js'
import './index.css'
import App from './App.jsx'

// Dev: quitar SW viejo (interceptaba /manifest.json y causaba "Syntax error" línea 1).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
}

// Electron carga `dist/index.html` por `file:` — el SW con `/sw.js` no aplica y puede interferir.
const canUseServiceWorker =
  import.meta.env.PROD &&
  typeof window !== 'undefined' &&
  window.location.protocol !== 'file:' &&
  'serviceWorker' in navigator

if (canUseServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
