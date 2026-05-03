import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const getUsagePlatform = () => {
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
    if (isNative) return 'native';

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

    try {
        await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
        if (isFirstSeenOnThisDevice && typeof localStorage !== 'undefined') {
            localStorage.setItem(firstSeenKey, '1');
        }
    } catch (err) {
        console.warn('usageMetrics tracking failed:', err);
    }
}
