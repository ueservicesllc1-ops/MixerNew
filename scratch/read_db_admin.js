import admin from 'firebase-admin';

// Initialize Firebase Admin using Application Default Credentials
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}
const dbAdmin = admin.firestore();

async function run() {
    try {
        console.log("Fetching users from Firestore via Admin SDK...");
        const querySnapshot = await dbAdmin.collection("users").get();
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
        console.error("Error reading database via Admin SDK:", e);
    }
}

run();
