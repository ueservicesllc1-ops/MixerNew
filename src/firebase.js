import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyB3GHmCQB-yvJr3iJ82CxAEgUU_N8QjgBU",
    authDomain: "freedommix-c5c3e.firebaseapp.com",
    projectId: "freedommix-c5c3e",
    storageBucket: "freedommix-c5c3e.firebasestorage.app",
    messagingSenderId: "830247648726",
    appId: "1:830247648726:web:fab37de48098e10184f877"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Exporting specifically for other components like Multitrack.jsx
export { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
