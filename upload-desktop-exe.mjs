/**
 * Subida del instalador Windows (.exe) — mismo flujo que `upload-final-apk.mjs`:
 * B2 vía Railway proxy → `public/release-pending-desktop.json` + `public/app-latest-desktop.json`
 * → JSON en B2 para el botón ACTIVAR del Admin (`apps/zion-desktop-release-pending.json`)
 * → Firestore opcional (`app_versions` con `desktopDownloadUrl`, sin tocar `downloadUrl` del APK).
 *
 * Quien despliega no toca Firestore a mano: igual que el APK, si hay credenciales admin en el entorno
 * el script publica solo. Si ves «Firestore OK», listo.
 *
 * Un solo comando (equivalente a `npm run release` del APK):
 *   npm run release:desktop
 *
 * Solo subir (ya tenés el .exe):
 *   npm run upload:desktop
 *   set DESKTOP_EXE_PATH=C:\ruta\instalador.exe   (opcional)
 *
 * Versión publicada: `desktopVersion` en package.json (no `version` móvil), salvo DESKTOP_VERSION_NAME.
 *
 * Credenciales: `.env` (dotenv) o, si no hay env, el primer `*-firebase-adminsdk-*.json` en `.secrets/` (nunca en `public/`).
 */

import 'dotenv/config';
import { ensureFirebaseAdminCredentialFromDisk } from './scripts/ensure-firebase-admin-credential.mjs';

ensureFirebaseAdminCredentialFromDisk();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import admin from 'firebase-admin';

let dbAdmin = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const saJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
        const sa = JSON.parse(saJson);
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
        dbAdmin = admin.firestore();
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
        dbAdmin = admin.firestore();
    } else {
        console.warn('No Firebase admin credentials provided; Firestore writes will be skipped.');
    }
} catch (e) {
    console.warn('Failed initializing Firebase admin:', e && e.message ? e.message : e);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '.');

function readDesktopVersionLabel() {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const dv = pkg.desktopVersion && String(pkg.desktopVersion).trim();
    return process.env.DESKTOP_VERSION_NAME?.trim() || dv || String(pkg.version || '0.0.0').trim();
}

/** Mismo criterio que la app de escritorio / Admin (major*10000 + minor*100 + patch). */
function semverToVersionCode(name) {
    const m = String(name || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return 0;
    const maj = parseInt(m[1], 10) || 0;
    const min = parseInt(m[2], 10) || 0;
    const pat = parseInt(m[3], 10) || 0;
    return maj * 10000 + min * 100 + Math.min(pat, 99);
}

function findWindowsInstaller() {
    const envPath = process.env.DESKTOP_EXE_PATH && String(process.env.DESKTOP_EXE_PATH).trim();
    if (envPath && fs.existsSync(envPath)) return path.resolve(envPath);

    let newestPath = null;
    let newestMtime = 0;

    const consider = (fullPath) => {
        try {
            if (!fullPath || !fs.existsSync(fullPath)) return;
            const st = fs.statSync(fullPath);
            if (!st.isFile()) return;
            const low = fullPath.toLowerCase();
            if (!low.endsWith('.exe')) return;
            if (low.includes('uninst') || low.includes('elevate') || low.includes('squash')) return;
            if (st.mtimeMs >= newestMtime) {
                newestMtime = st.mtimeMs;
                newestPath = fullPath;
            }
        } catch { /* ignore */ }
    };

    const roots = [
        path.join(ROOT, 'desktop-release'),
        path.join(ROOT, 'dist'),
        path.join(ROOT, 'release'),
    ];

    const walk = (dir, depth = 0) => {
        if (depth > 6 || !fs.existsSync(dir)) return;
        let names;
        try {
            names = fs.readdirSync(dir);
        } catch {
            return;
        }
        for (const name of names) {
            if (name === 'node_modules' || name.startsWith('.')) continue;
            const full = path.join(dir, name);
            try {
                const st = fs.statSync(full);
                if (st.isDirectory()) walk(full, depth + 1);
                else consider(full);
            } catch { /* ignore */ }
        }
    };

    for (const r of roots) walk(r);

    return newestPath;
}

async function uploadDesktopExe() {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const versionLabel = readDesktopVersionLabel();

    console.log(`\n🖥️  ZION STAGE DESKTOP (.exe) UPLOAD`);
    console.log(`📱 App móvil (package version): ${pkg.version}`);
    console.log(`🖥️  Escritorio (desktopVersion):  ${versionLabel} (código ${semverToVersionCode(versionLabel)})`);
    console.log(`─────────────────────────────────\n`);

    const exePath = findWindowsInstaller();
    if (!exePath) {
        console.error('❌ No se encontró ningún .exe.');
        console.error('   Indica la ruta: set DESKTOP_EXE_PATH=C:\\...\\instalador.exe');
        console.error('   O generá uno con: npm run release:desktop:auto  o  npm run build:desktop:win');
        process.exit(1);
    }

    const stats = fs.statSync(exePath);
    console.log(`✅ Instalador: ${exePath}`);
    console.log(`   Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    const form = new FormData();
    form.append('audioFile', fs.createReadStream(exePath));
    form.append('fileName', `apps/zion-stage-desktop-v${versionLabel}-${Date.now()}.exe`);
    form.append('generatePreview', 'false');

    console.log(`\n📤 Subiendo a Backblaze B2 (vía proxy)...`);

    const proxyUrl = process.env.PROXY_URL || 'https://mixernew-production.up.railway.app';

    const resp = await fetch(`${proxyUrl}/api/upload`, {
        method: 'POST',
        body: form,
    });

    if (!resp.ok) {
        console.error(`❌ Upload failed: ${resp.status} ${resp.statusText}`);
        process.exit(1);
    }

    const data = await resp.json();

    if (!data.success) {
        console.error(`❌ Upload failed: ${data.error}`);
        process.exit(1);
    }

    console.log(`✅ Subido a B2.`);
    console.log(`🔗 B2 URL: ${data.url}\n`);

    const proxyDownloadUrl = `${proxyUrl}/api/download?url=${encodeURIComponent(data.url)}`;
    console.log(`🔗 Proxy URL (desktopDownloadUrl): ${proxyDownloadUrl}\n`);

    const releaseNotes =
        process.env.DESKTOP_RELEASE_NOTES ||
        process.env.RELEASE_NOTES ||
        `Zion Stage escritorio ${versionLabel}`;

    const envCode = parseInt(process.env.DESKTOP_VERSION_CODE || '0', 10);
    const resolvedCode = Number.isFinite(envCode) && envCode > 0 ? envCode : semverToVersionCode(versionLabel);

    const pending = {
        versionName: versionLabel,
        versionCode: resolvedCode,
        /** URL proxificada del .exe (mismo patrón que el APK en downloadUrl). */
        desktopDownloadUrl: proxyDownloadUrl,
        b2Url: data.url,
        fileId: data.fileId ?? undefined,
        fileSize: stats.size,
        releaseNotes,
        uploadedAt: new Date().toISOString(),
    };

    const publicDir = path.join(ROOT, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    const pendingPath = path.join(publicDir, 'release-pending-desktop.json');
    fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2), 'utf-8');
    console.log(`📄 Guardado ${pendingPath}`);

    const appLatestPath = path.join(publicDir, 'app-latest-desktop.json');
    fs.writeFileSync(
        appLatestPath,
        JSON.stringify(
            {
                versionName: pending.versionName,
                versionCode: pending.versionCode ?? null,
                desktopDownloadUrl: pending.desktopDownloadUrl,
                releaseNotes: pending.releaseNotes,
                updatedAt: pending.uploadedAt,
            },
            null,
            2,
        ),
        'utf-8',
    );
    console.log(`📄 ${appLatestPath}`);

    try {
        console.log(`\n📤 Subiendo pending escritorio a B2 (apps/zion-desktop-release-pending.json)...`);
        const r2 = await fetch(`${proxyUrl}/api/upload-pending-json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: 'apps/zion-desktop-release-pending.json', data: pending }),
        });
        const d2 = await r2.json();
        if (d2.success && d2.url) {
            console.log(`✅ ACTIVAR (Admin): ${d2.url}`);
        } else {
            console.warn(`⚠️ JSON B2:`, d2.error || d2);
        }
    } catch (e2) {
        console.warn(`⚠️ JSON B2:`, e2.message);
    }

    try {
        console.log(`\n📝 Firestore (opcional)...`);
        if (dbAdmin) {
            await dbAdmin.collection('app_versions').add({
                versionName: pending.versionName,
                versionCode: pending.versionCode ?? null,
                desktopDownloadUrl: pending.desktopDownloadUrl,
                fileId: pending.fileId ?? null,
                fileSize: pending.fileSize,
                releaseNotes: pending.releaseNotes,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ Firestore OK.`);
        } else {
            console.log('⏭️ Firestore omitido: no hay credenciales admin disponibles.');
        }
    } catch (e) {
        console.log(`⏭️ Firestore omitido: ${e.message}`);
    }

    console.log(`\n✅ Subida lista.`);
    console.log(`   Si viste «Firestore OK»: las apps escritorio (Electron) leen app_versions igual que el APK — no hace falta redeploy del proxy ni variables LATEST_DESKTOP_* en Railway.`);
    console.log(`   Si no hubo credenciales o falló Firestore: Admin → ACTIVAR ESCRITORIO, o redeploy del proxy / env LATEST_DESKTOP_*.\n`);
}

uploadDesktopExe().catch((err) => {
    console.error(`\n❌ Fatal error:`, err);
    process.exit(1);
});
