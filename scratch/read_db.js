import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function run() {
    try {
        console.log("Fetching users from Firestore...");
        const querySnapshot = await getDocs(collection(db, "users"));
        console.log(`Found ${querySnapshot.size} users:`);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`- Email: ${data.email || 'N/A'}, UID: ${doc.id}`);
            console.log(`  planId: ${data.planId || 'N/A'}`);
            console.log(`  customStorageGB: ${data.customStorageGB || 'N/A'}`);
            console.log(`  desktopLicenseTier: ${data.desktopLicenseTier || 'N/A'}`);
            console.log(`  desktopProActive: ${data.desktopProActive || 'N/A'}`);
            console.log(`  stripeSubscriptionStatus: ${data.stripeSubscriptionStatus || 'N/A'}`);
        });
    } catch (e) {
        console.error("Error reading database:", e);
    }
}

run();
