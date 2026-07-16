import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../.secrets/freedommix-c5c3e-firebase-adminsdk-fbsvc-bb80ba4e1e.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TARGET = 'levanto mis manos';
const COMPARE = 'viento recio';

async function testUrl(url, label) {
    try {
        const proxyUrl = 'https://mixernew-production.up.railway.app';
        const proxied = `${proxyUrl}/api/download?url=${encodeURIComponent(url)}`;
        const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
        const fn = fetch || globalThis.fetch;
        const r = await fn(proxied);
        const buf = Buffer.from(await r.arrayBuffer());
        const hex = buf.slice(0, 4).toString('hex').match(/../g).join(' ');
        let fmt = 'UNKNOWN ❌';
        if (hex.startsWith('49 44 33')) fmt = 'MP3/ID3 ✅';
        else if (hex.startsWith('ff fb') || hex.startsWith('ff fa') || hex.startsWith('ff f3')) fmt = 'MP3 ✅';
        else if (hex.startsWith('66 4c 61 43')) fmt = 'FLAC ✅';
        else fmt = `UNKNOWN — hex: ${hex} text: ${buf.slice(0,60).toString('utf8').replace(/[^\x20-\x7e]/g,'.')}`;
        console.log(`  [${label}] status=${r.status} size=${buf.length}B fmt=${fmt}`);
        return buf.length;
    } catch(e) {
        console.log(`  [${label}] ERROR: ${e.message}`);
        return 0;
    }
}

async function run() {
    let foundLevanto = null;
    let foundViento = null;

    // 1. Check songs collection
    console.log('Buscando en songs collection (admin)...');
    const songsSnap = await db.collection('songs').get();
    songsSnap.forEach(d => {
        const data = d.data();
        const name = (data.name || '').toLowerCase();
        if (name.includes(TARGET) && (data.tracks || []).length > 0) {
            foundLevanto = { id: d.id, ...data };
            console.log(`  ✅ songs/${d.id}: "${data.name}" — ${(data.tracks||[]).length} tracks`);
        }
        if (name.includes(COMPARE) && (data.tracks || []).length > 0 && !foundViento) {
            foundViento = { id: d.id, ...data };
        }
    });

    // 2. Check setlists collection
    if (!foundLevanto) {
        console.log('No en songs, buscando en setlists...');
        const setSnap = await db.collection('setlists').get();
        setSnap.forEach(d => {
            const data = d.data();
            for (const song of (data.songs || [])) {
                const name = (song.name || '').toLowerCase();
                if (name.includes(TARGET) && (song.tracks || []).length > 0 && !foundLevanto) {
                    foundLevanto = song;
                    console.log(`  ✅ setlist ${d.id}: "${song.name}" — ${(song.tracks||[]).length} tracks`);
                }
                if (name.includes(COMPARE) && (song.tracks || []).length > 0 && !foundViento) {
                    foundViento = song;
                }
            }
        });
    }

    if (!foundLevanto) {
        console.log('\n❌ "Levanto mis manos" no encontrado con tracks en songs ni setlists.');
        process.exit(0);
    }

    const levTracks = (foundLevanto.tracks || []).filter(t => t.name !== '__PreviewMix' && t.url);
    const vienTracks = (foundViento?.tracks || []).filter(t => t.name !== '__PreviewMix' && t.url);

    console.log(`\n=== LEVANTO MIS MANOS — ${levTracks.length} stems ===`);
    for (const tr of levTracks) {
        console.log(`  [${tr.name}] normReady=${tr.normalizedReady ?? false} url=${(tr.url||'').slice(0,70)}`);
    }

    // Key check: are all stems the same URL? (upload bug)
    const urls = levTracks.map(t => t.url);
    const uniqueUrls = new Set(urls);
    if (uniqueUrls.size === 1 && levTracks.length > 1) {
        console.log('\n🚨 BUG DETECTADO: TODOS LOS STEMS APUNTAN A LA MISMA URL!');
        console.log(`   URL: ${[...uniqueUrls][0]}`);
        console.log('   Esto significa que todos los stems son el mismo archivo de audio.');
        console.log('   Al mezclarlos en fase → cancelación → SCRATCH / sonido dañado.');
    } else if (uniqueUrls.size < levTracks.length) {
        console.log(`\n⚠️  PROBLEMA: ${levTracks.length} stems pero solo ${uniqueUrls.size} URLs únicas.`);
        const urlCount = {};
        urls.forEach(u => { urlCount[u] = (urlCount[u]||0)+1; });
        Object.entries(urlCount).filter(([,c]) => c > 1).forEach(([u,c]) => {
            const names = levTracks.filter(t => t.url === u).map(t => t.name);
            console.log(`   URL duplicada (${c}x): [${names.join(', ')}] → ${u.slice(0,70)}`);
        });
    } else {
        console.log('\n✅ Todas las URLs son únicas.');
    }

    // Test download
    console.log('\n=== TEST DESCARGA PROXY ===');
    if (levTracks[0]) await testUrl(levTracks[0].url, `Levanto/${levTracks[0].name}`);
    if (levTracks[1]) await testUrl(levTracks[1].url, `Levanto/${levTracks[1].name}`);
    if (vienTracks[0]) await testUrl(vienTracks[0].normalizedUrl || vienTracks[0].url, `Viento/${vienTracks[0].name}`);

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
