/**
 * Escritorio en modo desarrollo: Vite en el puerto 3520 (no toca el 3000 de la web).
 * Pasa ELECTRON_DEV_URL para que `electron/main.cjs` cargue esa URL.
 *
 * Uso: npm run dev:desktop
 */
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DESKTOP_DEV_PORT = 3520;
const devUrl = `http://localhost:${DESKTOP_DEV_PORT}/#/desktop`;

function waitForHttp(port, timeoutMs = 45000) {
  // Mismo host que muestra Vite ("Local: http://localhost:…") — en Windows 127.0.0.1 puede fallar aunque Vite esté bien.
  const host = 'localhost';
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tryOnce = () => {
      const req = http.get(`http://${host}:${port}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error(`No responde http://${host}:${port} (¿Vite arrancó?).`));
        } else {
          setTimeout(tryOnce, 250);
        }
      });
      req.setTimeout(1500, () => {
        req.destroy();
      });
    };
    tryOnce();
  });
}

const vite = spawn(`npm run dev -- --port ${DESKTOP_DEV_PORT}`, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

vite.on('error', (err) => {
  console.error('No se pudo arrancar Vite:', err.message);
  process.exit(1);
});

try {
  await waitForHttp(DESKTOP_DEV_PORT);
} catch (e) {
  console.error(e.message);
  vite.kill('SIGTERM');
  process.exit(1);
}

const electron = spawn('npx electron electron/main.cjs', {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ELECTRON_DEV_URL: devUrl },
});

electron.on('exit', (code) => {
  vite.kill('SIGTERM');
  process.exit(code ?? 0);
});

vite.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    electron.kill('SIGTERM');
    process.exit(code);
  }
});

process.on('SIGINT', () => {
  vite.kill('SIGTERM');
  electron.kill('SIGTERM');
  process.exit(130);
});
