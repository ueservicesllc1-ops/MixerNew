/**
 * migrate-audio-to-flac.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend migration script: converts every existing song track in Firestore
 * from MP3/WAV/OGG to a normalized FLAC file (44 100 Hz, 16-bit) and stores
 * it in B2.  Updates each track's Firestore metadata with:
 *
 *   normalizedUrl      – B2 public URL to the FLAC file
 *   normalizedReady    – true
 *   normalizedFormat   – "flac"
 *   audioFormatVersion – 2
 *
 * The app reads these fields and downloads the FLAC instead of the original.
 * Old MP3 caches on devices are automatically invalidated on next open.
 *
 * ── REQUIREMENTS ────────────────────────────────────────────────────────────
 *   • FFmpeg on PATH  (ffmpeg -version  should work)
 *   • GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT env var
 *   • PROXY_URL env var (defaults to https://mixernew-production.up.railway.app)
 *   • node-fetch, form-data, firebase-admin in node_modules
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   node migrate-audio-to-flac.mjs
 *
 *   Dry-run (no writes):
 *   DRY_RUN=1 node migrate-audio-to-flac.mjs
 *
 *   Migrate a single song:
 *   SONG_ID=<firestoreDocId> node migrate-audio-to-flac.mjs
 *
 * ── RESUME ───────────────────────────────────────────────────────────────────
 *   The script skips any track that already has normalizedReady===true.
 *   Re-running the script is safe — already-migrated tracks are skipped.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs        from 'fs';
import path      from 'path';
import os        from 'os';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath }      from 'url';
import FormData  from 'form-data';
import fetch     from 'node-fetch';
import admin     from 'firebase-admin';

// ── Config ────────────────────────────────────────────────────────────────────
const PROXY_URL  = process.env.PROXY_URL || 'https://mixernew-production.up.railway.app';
const DRY_RUN    = process.env.DRY_RUN === '1';
const TARGET_SONG_ID = process.env.SONG_ID || null; // Optionally limit to one song
const AUDIO_FORMAT_VERSION = 2;
const TARGET_SR  = 44100;
const SKIP_TRACK = '__PreviewMix'; // Waveform-only track — skip, not played by C++ engine
const FLAC_B2_PREFIX = 'audio/flac'; // B2 storage path prefix for FLAC files
const CONCURRENCY = 2; // parallel FFmpeg jobs (keep low to avoid CPU saturation)

// ── Firebase Admin SDK ────────────────────────────────────────────────────────
let db = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString());
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        throw new Error('No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
    }
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized');
} catch (e) {
    console.error('❌ Firebase init failed:', e.message);
    process.exit(1);
}

// ── FFmpeg check ──────────────────────────────────────────────────────────────
function checkFfmpeg() {
    const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', timeout: 5000 });
    if (result.error || result.status !== 0) {
        console.error('❌ FFmpeg not found on PATH.');
        console.error('   Install FFmpeg: https://ffmpeg.org/download.html');
        console.error('   Windows: winget install FFmpeg  or  choco install ffmpeg');
        process.exit(1);
    }
    const vLine = result.stdout.split('\n')[0];
    console.log(`✅ FFmpeg: ${vLine}`);
}

// ── Convert audio to FLAC using FFmpeg ───────────────────────────────────────
/**
 * Converts inputPath to a FLAC file at outputPath.
 * 44 100 Hz, 16-bit signed integer, channels preserved, compression level 3.
 * @returns {boolean} true on success
 */
function convertToFlac(inputPath, outputPath) {
    const result = spawnSync('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-vn',                    // strip any video stream
        '-ar', String(TARGET_SR), // resample to 44100
        '-sample_fmt', 's16',     // 16-bit PCM samples
        '-compression_level', '3', // fast FLAC (~60 % of raw PCM)
        outputPath
    ], { encoding: 'utf8', timeout: 120_000 });

    if (result.error || result.status !== 0) {
        const stderr = result.stderr || '';
        console.error(`   ❌ FFmpeg failed (rc=${result.status}): ${stderr.slice(-300)}`);
        return false;
    }
    return true;
}

// ── Upload FLAC to B2 via Railway proxy ──────────────────────────────────────
/**
 * Uploads a local FLAC file to B2, stores it at b2Path.
 * @returns {{ url: string, fileId: string } | null}
 */
async function uploadFlacToB2(localPath, b2Path) {
    const form = new FormData();
    form.append('audioFile', fs.createReadStream(localPath));
    form.append('fileName', b2Path);
    form.append('generatePreview', 'false');

    const resp = await fetch(`${PROXY_URL}/api/upload`, {
        method: 'POST',
        body: form,
        timeout: 180_000
    });

    if (!resp.ok) {
        console.error(`   ❌ B2 upload HTTP error: ${resp.status} ${resp.statusText}`);
        return null;
    }

    const data = await resp.json();
    if (!data.success) {
        console.error(`   ❌ B2 upload API error:`, data.error || data);
        return null;
    }
    return { url: data.url, fileId: data.fileId };
}

// ── Update Firestore track metadata ─────────────────────────────────────────
/**
 * Reads a song doc, updates the track entry for trackName, writes it back.
 */
async function updateTrackMeta(songId, trackName, fields) {
    const ref  = db.collection('songs').doc(songId);
    const snap = await ref.get();
    if (!snap.exists) {
        console.warn(`   ⚠️  Song doc ${songId} not found in Firestore.`);
        return false;
    }
    const data   = snap.data();
    const tracks = (data.tracks || []).map(tr => {
        if (tr.name !== trackName) return tr;
        return { ...tr, ...fields };
    });
    await ref.update({ tracks });
    return true;
}

// ── Download helper ───────────────────────────────────────────────────────────
async function downloadFile(url, destPath) {
    const resp = await fetch(url, { timeout: 120_000 });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} downloading ${url}`);
    const buffer = await resp.buffer();
    fs.writeFileSync(destPath, buffer);
}

// ── Process one track ─────────────────────────────────────────────────────────
async function processTrack(song, tr) {
    const { id: songId } = song;
    const trackName = tr.name;

    if (tr.normalizedReady === true) {
        console.log(`   ⏭️  ${trackName} — already normalized (v${tr.audioFormatVersion})`);
        return 'skipped';
    }

    if (!tr.url || tr.url === 'undefined') {
        console.warn(`   ⚠️  ${trackName} — no URL, skipping`);
        return 'skipped';
    }

    console.log(`   🔄  ${trackName} — converting...`);

    // Build a safe filename base
    const safeName = trackName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const tmpDir   = os.tmpdir();
    const ext      = path.extname(new URL(tr.url).pathname) || '.mp3';
    const tmpInput = path.join(tmpDir, `zion_${songId}_${safeName}${ext}`);
    const tmpFlac  = path.join(tmpDir, `zion_${songId}_${safeName}.flac`);

    try {
        // 1. Download source
        const downloadUrl = tr.url.startsWith('http')
            ? `${PROXY_URL}/api/download?url=${encodeURIComponent(tr.url)}`
            : tr.url;
        console.log(`      ↓  Downloading source...`);
        await downloadFile(downloadUrl, tmpInput);
        const srcKB = Math.round(fs.statSync(tmpInput).size / 1024);
        console.log(`      ✅ Downloaded (${srcKB} KB)`);

        // 2. Convert to FLAC
        console.log(`      🎵 FFmpeg → FLAC...`);
        const ok = convertToFlac(tmpInput, tmpFlac);
        if (!ok) return 'failed';
        const flacKB = Math.round(fs.statSync(tmpFlac).size / 1024);
        console.log(`      ✅ FLAC ready (${flacKB} KB)`);

        if (DRY_RUN) {
            console.log(`      🏃 DRY_RUN — skip upload & Firestore write`);
            return 'dry';
        }

        // 3. Upload FLAC to B2
        const b2Path = `${FLAC_B2_PREFIX}/${songId}/${safeName}.flac`;
        console.log(`      ↑  Uploading to B2: ${b2Path}`);
        const b2 = await uploadFlacToB2(tmpFlac, b2Path);
        if (!b2) return 'failed';

        // Route through proxy for ISP-blocked users
        const proxyUrl = `${PROXY_URL}/api/download?url=${encodeURIComponent(b2.url)}`;
        console.log(`      ✅ B2 uploaded: ${b2.url}`);

        // 4. Update Firestore
        await updateTrackMeta(songId, trackName, {
            normalizedUrl:      proxyUrl,
            normalizedB2Url:    b2.url,
            normalizedReady:    true,
            normalizedFormat:   'flac',
            audioFormatVersion: AUDIO_FORMAT_VERSION,
        });
        console.log(`      ✅ Firestore updated`);
        return 'done';

    } finally {
        // Clean up temp files
        try { if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput); } catch { /* ignore */ }
        try { if (fs.existsSync(tmpFlac))  fs.unlinkSync(tmpFlac);  } catch { /* ignore */ }
    }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🎵 ZION STAGE — Audio Normalization Migration');
    console.log(`   Target format  : FLAC ${TARGET_SR} Hz 16-bit`);
    console.log(`   Format version : ${AUDIO_FORMAT_VERSION}`);
    console.log(`   Proxy          : ${PROXY_URL}`);
    console.log(`   Mode           : ${DRY_RUN ? '🏃 DRY RUN (no writes)' : '🔴 LIVE'}`);
    if (TARGET_SONG_ID) console.log(`   Song filter    : ${TARGET_SONG_ID}`);
    console.log('─────────────────────────────────────────────\n');

    checkFfmpeg();

    // Fetch songs from Firestore
    let songsSnap;
    if (TARGET_SONG_ID) {
        const ref = db.collection('songs').doc(TARGET_SONG_ID);
        const snap = await ref.get();
        songsSnap = snap.exists ? [{ id: snap.id, ...snap.data() }] : [];
    } else {
        const snap = await db.collection('songs').get();
        songsSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    console.log(`📚 Found ${songsSnap.length} song(s) in Firestore\n`);

    const stats = { done: 0, skipped: 0, failed: 0, dry: 0 };

    for (const song of songsSnap) {
        const tracks = (song.tracks || []).filter(tr => tr.name !== SKIP_TRACK);
        if (!tracks.length) continue;

        const needsMigration = tracks.some(tr => tr.normalizedReady !== true);
        if (!needsMigration) {
            console.log(`⏭️  [${song.id}] "${song.name}" — all tracks already normalized`);
            stats.skipped += tracks.length;
            continue;
        }

        console.log(`\n🎵 [${song.id}] "${song.name || 'Untitled'}" (${tracks.length} tracks)`);

        // Process tracks sequentially within a song (avoid hammering B2)
        for (const tr of tracks) {
            const result = await processTrack(song, tr);
            stats[result] = (stats[result] || 0) + 1;
        }
    }

    console.log('\n─────────────────────────────────────────────');
    console.log(`✅ Done         : ${stats.done}`);
    console.log(`⏭️  Skipped      : ${stats.skipped}`);
    console.log(`🏃 Dry-run      : ${stats.dry}`);
    console.log(`❌ Failed       : ${stats.failed}`);
    console.log('─────────────────────────────────────────────\n');

    if (stats.failed > 0) process.exit(1);
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
