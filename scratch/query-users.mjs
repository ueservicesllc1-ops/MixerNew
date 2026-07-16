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

console.log("Initializing Firebase with project ID:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        console.log(`Found ${snap.size} user documents in Firestore.`);
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`- Document ID: ${doc.id}`);
            console.log(`  Email: ${data.email || '(missing)'}`);
            console.log(`  DisplayName: ${data.displayName || '(missing)'}`);
            console.log(`  Plan: ${data.planId || '(missing)'}`);
            if (data.usageMetrics) {
                console.log(`  UsageMetrics lastPlatform: ${data.usageMetrics.lastPlatform || '(missing)'}`);
                console.log(`  Platforms: ${Object.keys(data.usageMetrics.platforms || {}).join(', ')}`);
            } else {
                console.log(`  UsageMetrics: (missing)`);
            }
        });
    } catch (err) {
        console.error("Error fetching users:", err);
    }
}

run();
