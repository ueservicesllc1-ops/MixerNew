/**
 * Telemetría mínima escritorio → Firestore (`desktop_clients`).
 * ID estable por instalación (localStorage); sin PII obligatorio.
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const CLIENT_ID_KEY = 'zion_desktop_client_id';
const FIRST_PING_KEY = 'zion_desktop_first_ping_done';

function makeUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** UUID v4 persistente por navegador / instalación Electron. */
export function getDesktopClientId() {
    if (typeof window === 'undefined') return null;
    try {
        let id = localStorage.getItem(CLIENT_ID_KEY);
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            id = makeUuid();
            localStorage.setItem(CLIENT_ID_KEY, id);
        }
        return id;
    } catch {
        return null;
    }
}

/**
 * Heartbeat: actualiza `lastSeenAt` y metadatos. `firstSeenAt` solo la primera vez.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} versionName ej. 1.1.8
 * @param {string|null} [firebaseUid] opcional si hay sesión Firebase
 */
export async function pingDesktopClient(db, versionName, firebaseUid = null) {
    if (!db || !versionName) return;
    const clientId = getDesktopClientId();
    if (!clientId) return;

    const ref = doc(db, 'desktop_clients', clientId);
    const vn = String(versionName).trim().slice(0, 32);
    if (!vn) return;

    let firstSeenAt;
    try {
        const firstDone = localStorage.getItem(FIRST_PING_KEY) === '1';
        if (!firstDone) {
            firstSeenAt = serverTimestamp();
            localStorage.setItem(FIRST_PING_KEY, '1');
        }
    } catch {
        /* ignore */
    }

    const payload = {
        lastSeenAt: serverTimestamp(),
        versionName: vn,
        platform: 'electron_win',
    };
    if (firstSeenAt) payload.firstSeenAt = firstSeenAt;
    if (firebaseUid && typeof firebaseUid === 'string') {
        payload.firebaseUid = firebaseUid.slice(0, 128);
    }

    await setDoc(ref, payload, { merge: true });
}
