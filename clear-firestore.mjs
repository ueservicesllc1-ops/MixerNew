import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function listDocs(collectionName) {
    const url = `${BASE}/${collectionName}?key=${API_KEY}&pageSize=300`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) { console.error('List error:', JSON.stringify(data)); return []; }
    return data.documents || [];
}

async function deleteDoc(name) {
    const url = `https://firestore.googleapis.com/v1/${name}?key=${API_KEY}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); console.error('Delete error:', JSON.stringify(err)); }
}

(async () => {
    console.log('Borrando colección songs de Firestore...');
    const docs = await listDocs('songs');
    if (docs.length === 0) { console.log('La colección songs ya está vacía.'); process.exit(0); }
    console.log(`Encontrados ${docs.length} documentos. Borrando...`);
    for (const d of docs) {
        await deleteDoc(d.name);
        console.log(`Borrado: ${d.name.split('/').pop()}`);
    }
    console.log('Listo. Firestore limpio.');
    process.exit(0);
})();
