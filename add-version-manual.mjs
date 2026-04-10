import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyB3GHmCQB-yvJr3iJ82CxAEgUU_N8QjgBU",
    authDomain: "freedommix-c5c3e.firebaseapp.com",
    projectId: "freedommix-c5c3e",
    storageBucket: "freedommix-c5c3e.firebasestorage.app",
    messagingSenderId: "830247648726",
    appId: "1:830247648726:web:fab37de48098e10184f877"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addVersion() {
    try {
        console.log('📝 Adding version 1.7.0 to Firestore...');
        
        const docRef = await addDoc(collection(db, 'app_versions'), {
            versionName: "1.7.0",
            versionCode: 37,
            downloadUrl: "https://f005.backblazeb2.com/file/mixercur/apps/zion-stage-v1.7.0-1775833924376.apk",
            fileId: "zion-stage-v1.7.0-1775833924376.apk",
            fileSize: 66753536, // ~63.67 MB
            createdAt: serverTimestamp(),
            releaseNotes: "Versión 1.7.0 - Correcciones críticas de timing (seek, drag, pause) y sistema de versionado automático"
        });
        
        console.log(`✅ Success! Document created with ID: ${docRef.id}`);
        console.log(`🎉 Version 1.7.0 is now live and users will be notified!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 You can add it manually via Firebase Console:');
        console.log('   Collection: app_versions');
        console.log('   Data: {');
        console.log('     versionName: "1.7.0",');
        console.log('     versionCode: 37,');
        console.log('     downloadUrl: "https://f005.backblazeb2.com/file/mixercur/apps/zion-stage-v1.7.0-1775833924376.apk",');
        console.log('     fileSize: 66753536,');
        console.log('     createdAt: [server timestamp],');
        console.log('     releaseNotes: "Versión 1.7.0 - Correcciones críticas"');
        console.log('   }');
        process.exit(1);
    }
}

addVersion();
