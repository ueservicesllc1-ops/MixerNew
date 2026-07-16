import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import 'dotenv/config';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET = 'levanto mis manos';
const COMPARE = 'viento recio';

async function testUrl(url, label) {
    try {
        const proxyUrl = 'https://mixernew-production.up.railway.app';
        const proxied = `${proxyUrl}/api/download?url=${encodeURIComponent(url)}`;
        const r = await fetch(proxied);
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf.slice(0, 4));
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(' ');
        let fmt = 'UNKNOWN ❌';
        if (hex.startsWith('49 44 33')) fmt = 'MP3/ID3 ✅';
        else if (hex.startsWith('ff fb') || hex.startsWith('ff fa') || hex.startsWith('ff f3')) fmt = 'MP3 ✅';
        else if (hex.startsWith('66 4c 61 43')) fmt = 'FLAC ✅';
        else {
            const txt = new TextDecoder().decode(buf.slice(0, 80));
            fmt = `UNKNOWN — preview: ${txt.replace(/\n/g,' ')}`;
        }
        console.log(`  [${label}] status=${r.status} size=${buf.byteLength}B fmt=${fmt}`);
        return buf.byteLength;
    } catch(e) {
        console.log(`  [${label}] ERROR: ${e.message}`);
        return 0;
    }
}

async function run() {
    console.log('Buscando en coleccion setlists...\n');
    const setlistSnap = await getDocs(collection(db, 'setlists'));

    let foundLevanto = null;
    let foundViento = null;

    setlistSnap.forEach(d => {
        const data = d.data();
        const songs = data.songs || [];
        for (const song of songs) {
            const name = (song.name || '').toLowerCase();
            if (name.includes(TARGET) && (song.tracks || []).length > 0) {
                foundLevanto = song;
            }
            if (name.includes(COMPARE) && (song.tracks || []).length > 0 && !foundViento) {
                foundViento = song;
            }
        }
    });

    // Also check songs collection directly
    if (!foundLevanto) {
        console.log('No encontrado en setlists, buscando en songs collection...');
        const songsSnap = await getDocs(collection(db, 'songs'));
        songsSnap.forEach(d => {
            const data = d.data();
            const name = (data.name || '').toLowerCase();
            if (name.includes(TARGET) && (data.tracks || []).length > 0) foundLevanto = data;
            if (name.includes(COMPARE) && (data.tracks || []).length > 0 && !foundViento) foundViento = data;
        });
    }

    if (!foundLevanto) {
        console.log('❌ No se encontró "Levanto mis manos" con tracks en ningún lugar.');
        console.log('Verificar: ¿Está en un setlist? ¿Se subió correctamente?');
        process.exit(0);
    }

    console.log(`\n✅ Encontrado: ${foundLevanto.name}`);
    console.log(`   tracks: ${(foundLevanto.tracks || []).length}`);

    const levTracks = (foundLevanto.tracks || []).filter(t => t.name !== '__PreviewMix' && t.url);
    const vienTracks = (foundViento?.tracks || []).filter(t => t.name !== '__PreviewMix' && t.url);

    console.log(`\n=== LEVANTO MIS MANOS tracks (${levTracks.length}) ===`);
    for (const tr of levTracks) {
        console.log(`  [${tr.name}] normalizedReady=${tr.normalizedReady ?? false} hasNormUrl=${!!tr.normalizedUrl}`);
    }

    console.log(`\n=== VIENTO RECIO tracks (${vienTracks.length}) ===`);
    for (const tr of vienTracks.slice(0, 3)) {
        console.log(`  [${tr.name}] normalizedReady=${tr.normalizedReady ?? false} hasNormUrl=${!!tr.normalizedUrl}`);
    }

    // Test first track URL of each song
    console.log('\n=== URL DOWNLOAD TEST ===');
    if (levTracks[0]) {
        const url = levTracks[0].normalizedUrl || levTracks[0].url;
        await testUrl(url, `Levanto/${levTracks[0].name}`);
    }
    if (vienTracks[0]) {
        const url = vienTracks[0].normalizedUrl || vienTracks[0].url;
        await testUrl(url, `Viento/${vienTracks[0].name}`);
    }

    // Key diagnostic: check if Levanto tracks point to same B2 file (wrong upload)
    console.log('\n=== URL COMPARISON (first 80 chars) ===');
    const levUrls = levTracks.map(t => ({ name: t.name, url: (t.url || '').substring(0, 80) }));
    const allSame = levUrls.every(u => u.url === levUrls[0]?.url);
    if (allSame && levUrls.length > 1) {
        console.log('🚨 TODOS LOS STEMS DE LEVANTO APUNTAN A LA MISMA URL DE B2!');
        console.log(`   URL común: ${levUrls[0]?.url}`);
    } else {
        levUrls.forEach(u => console.log(`  [${u.name}]: ${u.url}`));
    }

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
