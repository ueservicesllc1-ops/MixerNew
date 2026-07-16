import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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

const SONGS_TO_FIND = ['levanto mis manos', 'viento recio'];

function summarizeTrack(tr) {
    return {
        name: tr.name,
        url: tr.url ? tr.url.substring(0, 60) + '...' : '(none)',
        normalizedReady: tr.normalizedReady ?? false,
        normalizedUrl: tr.normalizedUrl ? tr.normalizedUrl.substring(0, 60) + '...' : '(none)',
        hasUrl: !!tr.url && tr.url !== 'undefined',
        hasNormalizedUrl: !!tr.normalizedUrl,
    };
}

async function run() {
    console.log('Buscando canciones en coleccion "songs"...\n');

    // Try 'songs' collection
    const collections = ['songs', 'multitrack_songs', 'catalog'];
    for (const col of collections) {
        try {
            const snap = await getDocs(collection(db, col));
            if (snap.empty) continue;

            const found = [];
            snap.forEach(docSnap => {
                const d = docSnap.data();
                const name = (d.name || d.title || '').toLowerCase();
                if (SONGS_TO_FIND.some(s => name.includes(s))) {
                    found.push({ id: docSnap.id, ...d });
                }
            });

            if (found.length > 0) {
                console.log(`=== Encontradas ${found.length} canciones en coleccion '${col}' ===\n`);
                for (const song of found) {
                    console.log(`\n---- ${song.name || song.title} (id: ${song.id}) ----`);
                    console.log(`  createdAt: ${song.createdAt?.toDate?.() ?? song.createdAt ?? '(sin fecha)'}`);
                    console.log(`  tempo: ${song.tempo ?? '(none)'}`);
                    console.log(`  tracks count: ${(song.tracks || []).length}`);
                    console.log(`  Tracks:`);
                    for (const tr of (song.tracks || [])) {
                        const s = summarizeTrack(tr);
                        console.log(`    [${s.name}]`);
                        console.log(`      url ok:           ${s.hasUrl}`);
                        console.log(`      normalizedReady:  ${s.normalizedReady}`);
                        console.log(`      normalizedUrl ok: ${s.hasNormalizedUrl}`);
                        if (s.hasNormalizedUrl) console.log(`      normalizedUrl:    ${s.normalizedUrl}`);
                        if (s.hasUrl)           console.log(`      url:              ${s.url}`);
                    }
                }
            }
        } catch (e) {
            // collection doesn't exist or access denied
        }
    }

    // Also search in user song subcollections if not found at root
    console.log('\n--- Buscando en subcolecciones de usuarios (library/songs)... ---');
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const userDoc of usersSnap.docs) {
            for (const sub of ['songs', 'library', 'tracks']) {
                try {
                    const subSnap = await getDocs(collection(db, 'users', userDoc.id, sub));
                    subSnap.forEach(docSnap => {
                        const d = docSnap.data();
                        const name = (d.name || d.title || '').toLowerCase();
                        if (SONGS_TO_FIND.some(s => name.includes(s))) {
                            console.log(`\n[users/${userDoc.id}/${sub}] ${d.name || d.title} (id: ${docSnap.id})`);
                            console.log(`  tracks count: ${(d.tracks || []).length}`);
                            for (const tr of (d.tracks || [])) {
                                const s = summarizeTrack(tr);
                                console.log(`    [${s.name}] url=${s.hasUrl} normalizedReady=${s.normalizedReady} normalizedUrl=${s.hasNormalizedUrl}`);
                            }
                        }
                    });
                } catch { /* subcolección no existe */ }
            }
        }
    } catch (e) {
        console.warn('No se pudo acceder a subcolecciones de usuarios:', e.message);
    }

    console.log('\nDone.');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
