import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appVersion = pkg.version || '0.0.0'

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
  plugins: [react(), removeHtmlCrossorigin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    port: 3000,
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


