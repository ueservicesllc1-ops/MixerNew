
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { db } from './src/firebase-node.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '.');

function readAndroidMeta() {
    const gradlePath = path.join(ROOT, 'android/app/build.gradle');
    const gradle = fs.readFileSync(gradlePath, 'utf-8');
    const codeM = gradle.match(/versionCode\s+(\d+)/);
    const nameM = gradle.match(/versionName\s+"([^"]+)"/);
    return {
        versionCode: codeM ? parseInt(codeM[1], 10) : null,
        versionName: nameM ? nameM[1] : null
    };
}

async function uploadApk() {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const pkgVersion = pkg.version;
    const { versionCode, versionName } = readAndroidMeta();
    const versionLabel = versionName || pkgVersion;

    console.log(`\n🚀 ZION STAGE APK UPLOAD`);
    console.log(`📦 package.json: ${pkgVersion} | build.gradle: ${versionName} (${versionCode})`);
    console.log(`─────────────────────────────────\n`);

    const apkPath = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');

    if (!fs.existsSync(apkPath)) {
        console.error(`❌ APK not found at: ${apkPath}`);
        console.error(`💡 Run: npm run build:android first`);
        process.exit(1);
    }

    const stats = fs.statSync(apkPath);
    console.log(`✅ APK found: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    const form = new FormData();
    form.append('audioFile', fs.createReadStream(apkPath));
    form.append('fileName', `apps/zion-stage-v${versionLabel}-${Date.now()}.apk`);
    form.append('generatePreview', 'false');

    console.log(`\n📤 Uploading to Backblaze B2...`);

    const proxyUrl = process.env.PROXY_URL || 'https://mixernew-production.up.railway.app';

    const resp = await fetch(`${proxyUrl}/api/upload`, {
        method: 'POST',
        body: form
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

    console.log(`✅ Success! APK uploaded to B2.`);
    console.log(`🔗 URL: ${data.url}\n`);

    const releaseNotes =
        process.env.RELEASE_NOTES ||
        `Versión ${versionLabel} — build ${versionCode ?? 'n/a'}`;

    const pending = {
        versionName: versionLabel,
        versionCode: versionCode ?? undefined,
        downloadUrl: data.url,
        fileId: data.fileId ?? undefined,
        fileSize: stats.size,
        releaseNotes,
        uploadedAt: new Date().toISOString()
    };

    const publicDir = path.join(ROOT, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    const pendingPath = path.join(publicDir, 'release-pending.json');
    fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2), 'utf-8');
    console.log(`📄 Guardado ${pendingPath}`);
    const appLatestPath = path.join(publicDir, 'app-latest.json');
    fs.writeFileSync(
        appLatestPath,
        JSON.stringify(
            {
                versionName: pending.versionName,
                versionCode: pending.versionCode ?? null,
                downloadUrl: pending.downloadUrl,
                releaseNotes: pending.releaseNotes,
                updatedAt: pending.uploadedAt
            },
            null,
            2
        ),
        'utf-8'
    );
    console.log(`📄 ${appLatestPath}`);

    // JSON fijo en B2 → botón ACTIVAR (ruta sin ffmpeg en el proxy).
    try {
        console.log(`\n📤 Subiendo release-pending a B2 (apps/zion-release-pending.json)...`);
        const r2 = await fetch(`${proxyUrl}/api/upload-pending-json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: 'apps/zion-release-pending.json', data: pending })
        });
        const d2 = await r2.json();
        if (d2.success && d2.url) {
            console.log(`✅ ACTIVAR: ${d2.url}`);
        } else {
            console.warn(`⚠️ JSON B2:`, d2.error || d2);
        }
    } catch (e2) {
        console.warn(`⚠️ JSON B2:`, e2.message);
    }

    // Firestore opcional (si falla permisos, la subida igual fue OK)
    try {
        console.log(`\n📝 Firestore (opcional)...`);
        await addDoc(collection(db, 'app_versions'), {
            versionName: pending.versionName,
            versionCode: pending.versionCode ?? null,
            downloadUrl: pending.downloadUrl,
            fileId: pending.fileId ?? null,
            fileSize: pending.fileSize,
            releaseNotes: pending.releaseNotes,
            createdAt: serverTimestamp()
        });
        console.log(`✅ Firestore OK.`);
    } catch (e) {
        console.log(`⏭️ Firestore omitido: ${e.message}`);
    }

    console.log(`\n✅ Subida lista. Activá en Admin con el botón rojo ACTIVAR.\n`);
}

uploadApk().catch(err => {
    console.error(`\n❌ Fatal error:`, err);
    process.exit(1);
});
