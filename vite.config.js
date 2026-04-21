import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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


