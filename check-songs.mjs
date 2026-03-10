import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

// Cargar config de App.jsx o similar
const firebaseConfig = {
  apiKey: "AIzaSyB...", // Needs to be real
  authDomain: "mixercur.firebaseapp.com",
  projectId: "mixercur",
  storageBucket: "mixercur.firebasestorage.app",
  messagingSenderId: "542757279323",
  appId: "1:542757279323:web:9f8e438c6428d086a987d3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSongs() {
    const snap = await getDocs(collection(db, 'songs'));
    const results = [];
    snap.forEach(doc => {
        const d = doc.data();
        results.push({
            id: doc.id,
            name: d.name,
            artist: d.artist,
            status: d.status,
            isGlobal: d.isGlobal,
            userId: d.userId,
            forSale: d.forSale
        });
    });
    console.log(JSON.stringify(results, null, 2));
}

checkSongs();
