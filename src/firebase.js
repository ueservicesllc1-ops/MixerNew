import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB3GHmCQB-yvJr3iJ82CxAEgUU_N8QjgBU",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "freedommix-c5c3e.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "freedommix-c5c3e",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "freedommix-c5c3e.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "830247648726",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:830247648726:web:fab37de48098e10184f877"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Exporting specifically for other components like Multitrack.jsx
export { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
