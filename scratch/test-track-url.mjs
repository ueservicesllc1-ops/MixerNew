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

// Get the actual URL for a new (non-normalized) track and test it
async function run() {
    const snap = await getDocs(collection(db, 'songs'));
    let newSong = null;
    snap.forEach(d => {
        const data = d.data();
        const name = (data.name || '').toLowerCase();
        // The newly uploaded VIENTO RECIO (non-normalized)
        if (name.includes('viento recio') && data.createdAt?.toDate?.()?.getFullYear() === 2026 && (data.tracks || []).length > 0) {
            const allNonNorm = (data.tracks || []).every(t => !t.normalizedReady);
            if (allNonNorm && !newSong) newSong = { id: d.id, ...data };
        }
    });

    if (!newSong) { console.log('No encontré el VIENTO RECIO nuevo'); process.exit(0); }

    // Pick first non-preview track
    const tr = (newSong.tracks || []).find(t => t.name !== '__PreviewMix' && t.url);
    if (!tr) { console.log('Sin tracks'); process.exit(0); }

    console.log(`\nTesting track: ${tr.name}`);
    console.log(`Direct B2 URL: ${tr.url}`);

    // Test direct B2 URL
    console.log('\n--- Test 1: Direct B2 URL ---');
    try {
        const r = await fetch(tr.url, { method: 'HEAD' });
        console.log(`  Status: ${r.status}`);
        console.log(`  Content-Type: ${r.headers.get('content-type')}`);
        console.log(`  Content-Length: ${r.headers.get('content-length')}`);
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    // Test via Railway proxy
    const proxyUrl = 'https://mixernew-production.up.railway.app';
    const proxiedUrl = `${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`;
    console.log(`\n--- Test 2: Via Railway Proxy ---`);
    console.log(`  URL: ${proxiedUrl.substring(0, 100)}...`);
    try {
        const r = await fetch(proxiedUrl, { method: 'HEAD' });
        console.log(`  Status: ${r.status}`);
        console.log(`  Content-Type: ${r.headers.get('content-type')}`);
        console.log(`  Content-Length: ${r.headers.get('content-length')}`);
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    // Download first 4 bytes to check magic number (MP3 starts with 0xFF 0xFB or ID3)
    console.log('\n--- Test 3: Check first bytes (file magic) via proxy ---');
    try {
        const r = await fetch(proxiedUrl);
        if (r.ok) {
            const buf = await r.arrayBuffer();
            const bytes = new Uint8Array(buf.slice(0, 16));
            const hex = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(' ');
            console.log(`  Total size: ${buf.byteLength} bytes`);
            console.log(`  First 16 bytes: ${hex}`);
            // ID3 = 49 44 33, MPEG = FF FB/FA/F3, FLAC = 66 4C 61 43
            const magic = hex.substring(0, 8);
            if (magic.startsWith('49 44 33')) console.log('  Format: MP3 (ID3 header) ✅');
            else if (hex.startsWith('ff fb') || hex.startsWith('ff fa') || hex.startsWith('ff f3')) console.log('  Format: MP3 (MPEG frame) ✅');
            else if (magic.startsWith('66 4c 61 43')) console.log('  Format: FLAC ✅');
            else console.log('  Format: UNKNOWN ❌ — this could be HTML/error page!');

            // Check if it looks like an HTML error response
            const text = new TextDecoder().decode(buf.slice(0, 200));
            if (text.includes('<html') || text.includes('<?xml') || text.includes('Error') || text.includes('error')) {
                console.log(`  WARNING: Response looks like HTML/error: ${text.substring(0, 150)}`);
            }
        } else {
            console.log(`  HTTP Error: ${r.status} ${r.statusText}`);
            const text = await r.text();
            console.log(`  Body: ${text.substring(0, 200)}`);
        }
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
