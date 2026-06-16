import { doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const getUsagePlatform = () => {
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
    if (isNative) return 'native';

    /** Zion Stage .exe (Electron): debe ir antes de `web` / PWA. */
    const isElectronDesktop =
        typeof window !== 'undefined'
        && window.zionNative?.isDesktop === true
        && !isNative;
    if (isElectronDesktop) return 'desktop_win';

    const isStandalone = typeof window !== 'undefined' &&
        (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true);
    if (isStandalone) return 'pwa';

    return 'web';
};

export async function trackUserUsage(user) {
    if (!user?.uid) return;

    const platform = getUsagePlatform();
    const firstSeenKey = `mixer_usage_first_seen_${user.uid}_${platform}`;
    const isFirstSeenOnThisDevice = typeof localStorage !== 'undefined' && !localStorage.getItem(firstSeenKey);

    const userDocRef = doc(db, 'users', user.uid);
    let existingData = null;
    try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            existingData = snap.data();
        }
    } catch (err) {
        console.warn('Failed to fetch existing user doc in trackUserUsage:', err);
    }

    const payload = {
        usageMetrics: {
            lastSeenAt: serverTimestamp(),
            lastPlatform: platform,
            platforms: {
                [platform]: {
                    lastSeenAt: serverTimestamp(),
                    ...(isFirstSeenOnThisDevice ? { firstSeenAt: serverTimestamp() } : {}),
                },
            },
        },
    };

    // Safely initialize missing profile fields
    if (!existingData || !existingData.email) {
        payload.email = user.email || '';
    }
    if (!existingData || !existingData.displayName) {
        payload.displayName = user.displayName || '';
    }
    if (!existingData || !existingData.planId) {
        payload.planId = 'free';
    }
    if (!existingData || !existingData.customStorageGB) {
        payload.customStorageGB = 1;
    }
    if (!existingData || !existingData.createdAt) {
        payload.createdAt = serverTimestamp();
    }

    try {
        await setDoc(userDocRef, payload, { merge: true });
        if (isFirstSeenOnThisDevice && typeof localStorage !== 'undefined') {
            localStorage.setItem(firstSeenKey, '1');
        }
    } catch (err) {
        console.warn('usageMetrics tracking failed:', err);
    }
}
