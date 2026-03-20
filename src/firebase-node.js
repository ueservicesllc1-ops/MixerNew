
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyB3GHmCQB-yvJr3iJ82CxAEgUU_N8QjgBU",
    authDomain: "freedommix-c5c3e.firebaseapp.com",
    projectId: "freedommix-c5c3e",
    storageBucket: "freedommix-c5c3e.firebasestorage.app",
    messagingSenderId: "830247648726",
    appId: "1:830247648726:web:fab37de48098e10184f877"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
