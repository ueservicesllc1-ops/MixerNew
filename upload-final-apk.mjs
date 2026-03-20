
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { db } from './src/firebase-node.js'; // I'll create a node-compatible firebase file
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

async function uploadApk() {
    const apkPath = 'android/app/build/outputs/apk/release/app-release.apk';
    const stats = fs.statSync(apkPath);
    console.log(`Building APK... Done. File size: ${ (stats.size / 1024 / 1024).toFixed(2) } MB`);

    const form = new FormData();
    form.append('audioFile', fs.createReadStream(apkPath));
    form.append('fileName', `apps/zion-stage-release-${Date.now()}.apk`);
    form.append('generatePreview', 'false');

    console.log("Uploading APK to B2...");
    const resp = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: form
    });
    const data = await resp.json();

    if (data.success) {
        console.log("Success! APK uploaded to B2.");
        console.log("URL:", data.url);
        
        // Use Node-friendly Firebase to record version
        try {
            await addDoc(collection(db, 'app_versions'), {
                versionName: "1.0-release",
                downloadUrl: data.url,
                fileId: data.fileId,
                createdAt: serverTimestamp()
            });
            console.log("Firestore updated! New version is now live.");
        } catch (e) {
            console.error("Firestore Error:", e.message);
        }
    } else {
        console.error("Upload failed:", data.error);
    }
}

uploadApk();
