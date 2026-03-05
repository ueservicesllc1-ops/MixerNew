// Script de migración: agrega userId a setlists existentes que no lo tienen.
// Ejecutar UNA sola vez desde la consola del navegador (en http://localhost:5173)
// estando logueado como el usuario dueño de los setlists.
//
// Pega esto en la consola del navegador (F12 → Console):

import { db } from '/src/firebase.js';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { auth } from '/src/firebase.js';

const user = auth.currentUser;
if (!user) { console.error('No hay usuario logueado'); }
else {
    const snap = await getDocs(query(collection(db, 'setlists')));
    let updated = 0;
    for (const d of snap.docs) {
        if (!d.data().userId) {
            await updateDoc(doc(db, 'setlists', d.id), { userId: user.uid });
            console.log('Migrado:', d.id, d.data().name);
            updated++;
        }
    }
    console.log(`✅ Migración completa. ${updated} setlists actualizados.`);
}
