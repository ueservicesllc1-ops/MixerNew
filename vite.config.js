import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appVersion = pkg.version || '0.0.0'

/** Inyecta en `index.html` la URL del .exe de escritorio (build CI: `VITE_DESKTOP_INSTALLER_URL`). */
function injectZionDesktopInstallerGlobals(version) {
  const installerUrl = process.env.VITE_DESKTOP_INSTALLER_URL || ''
  return {
    name: 'inject-zion-desktop-installer-globals',
    transformIndexHtml(html) {
      const payload = `<script>window.__ZION_DESKTOP_INSTALLER_URL__=${JSON.stringify(
        installerUrl
      )};window.__ZION_APP_VERSION__=${JSON.stringify(version)};</script>`
      return html.replace('</head>', `${payload}\n</head>`)
    },
  }
}

/**
 * Vite inyecta `crossorigin` en <script type="module"> del index de producción.
 * Con `file://` en Electron eso puede impedir que el bundle cargue → pantalla en blanco.
 * Quitar el atributo no afecta al despliegue web habitual (mismo origen / hosting estático).
 */
function removeHtmlCrossorigin() {
  return {
    name: 'remove-html-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas para que `dist/` funcione con Electron (`file://`) sin depender de un servidor.
  base: './',
  plugins: [injectZionDesktopInstallerGlobals(appVersion), react(), removeHtmlCrossorigin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_DESKTOP_INSTALLER_URL': JSON.stringify(process.env.VITE_DESKTOP_INSTALLER_URL || ''),
  },
  server: {
    port: 3000,
    /** Abre el navegador al hacer `npm run dev` (la app web no corre con `npm run desktop`). */
    open: true,
  },
  optimizeDeps: {
    include: ['qrcode.react'],
  },
  resolve: {
    alias: {
      'qrcode.react': path.resolve(__dirname, 'node_modules/qrcode.react/lib/esm/index.js'),
    },
  },
  build: {
    rollupOptions: {
      maxParallelFileOps: 2,
      external: [],
    },
  },
})


