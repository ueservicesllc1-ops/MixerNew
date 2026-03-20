
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSongs() {
    try {
        const { where } = await import('firebase/firestore');
        const q = query(collection(db, 'songs'), where('forSale', '==', true), limit(50));
        const snap = await getDocs(q);
        console.log(`Found ${snap.size} songs with forSale: true.`);
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}, Name: ${data.name}, User: ${data.userEmail}, forSale: ${data.forSale}, status: ${data.status}`);
        });
    } catch (e) {
        console.error("Query for forSale == true failed:", e);
    }

    try {
        const qAll = query(collection(db, 'songs'), limit(10));
        await getDocs(qAll);
        console.log("Query ALL correctly allowed (unlikely).");
    } catch (e) {
        console.log("Query ALL failed as expected (Rules working).");
    }
}

checkSongs().catch(console.error);
