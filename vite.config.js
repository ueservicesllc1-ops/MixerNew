import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appVersion = pkg.version || '0.0.0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    port: 3000,
    // HMR: dejar el valor por defecto de Vite (evita ws://localhost:3000 fallando si forzamos host/puerto).
  },
})
