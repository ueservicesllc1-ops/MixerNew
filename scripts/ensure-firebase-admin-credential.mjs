/**
 * Credenciales Firebase Admin para scripts locales (upload APK, upload desktop, etc.).
 * Prioridad: FIREBASE_SERVICE_ACCOUNT → GOOGLE_APPLICATION_CREDENTIALS → primer `*-firebase-adminsdk-*.json` en `.secrets/`.
 * Nunca coloques estas claves en `public/` (quedan publicadas en Hosting).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export function ensureFirebaseAdminCredentialFromDisk() {
    if (String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()) return;
    const existing = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
    if (existing && fs.existsSync(existing)) return;

    const secretsDir = path.join(ROOT, '.secrets');
    if (!fs.existsSync(secretsDir)) return;
    let names;
    try {
        names = fs.readdirSync(secretsDir);
    } catch {
        return;
    }
    const match = names.find((n) => /firebase-adminsdk.*\.json$/i.test(n) && !n.endsWith('.example.json'));
    if (!match) return;
    const full = path.join(secretsDir, match);
    if (fs.existsSync(full)) process.env.GOOGLE_APPLICATION_CREDENTIALS = full;
}
