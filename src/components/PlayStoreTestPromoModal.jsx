import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { ExternalLink } from 'lucide-react';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.zionstagelive.app';
const SESSION_KEY = 'zion_play_store_promo_session_v1';
const PATHS_WITH_PROMO = ['/', '/dashboard', '/multitrack'];

function isNativeApp() {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

export default function PlayStoreTestPromoModal() {
    const location = useLocation();
    const [user, setUser] = useState(() => auth.currentUser);
    const [visible, setVisible] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(6);
    const triggeredRef = useRef(false);

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    useEffect(() => {
        if (isNativeApp()) return;
        if (!user) return;
        if (sessionStorage.getItem(SESSION_KEY)) return;
        if (!PATHS_WITH_PROMO.includes(location.pathname)) return;
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        const boot = window.setTimeout(() => {
            setSecondsLeft(6);
            setVisible(true);
        }, 0);
        return () => clearTimeout(boot);
    }, [user, location.pathname]);

    useEffect(() => {
        if (!visible) return;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        let intervalId;
        const boot = window.setTimeout(() => {
            setSecondsLeft(6);
            let elapsed = 0;
            intervalId = setInterval(() => {
                elapsed += 1;
                if (elapsed >= 6) {
                    clearInterval(intervalId);
                    sessionStorage.setItem(SESSION_KEY, '1');
                    setVisible(false);
                    return;
                }
                setSecondsLeft(6 - elapsed);
            }, 1000);
        }, 0);
        return () => {
            clearTimeout(boot);
            if (intervalId) clearInterval(intervalId);
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-promo-title"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                background: 'rgba(2, 6, 23, 0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                fontFamily: '"Outfit", sans-serif',
            }}
        >
            <div
                style={{
                    maxWidth: 440,
                    width: '100%',
                    background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: 20,
                    border: '1px solid rgba(0, 210, 211, 0.35)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
                    padding: '28px 26px 24px',
                    textAlign: 'center',
                    color: '#e2e8f0',
                }}
            >
                <div
                    id="play-promo-title"
                    style={{
                        fontSize: '1.35rem',
                        fontWeight: 900,
                        marginBottom: 12,
                        lineHeight: 1.25,
                        color: '#fff',
                    }}
                >
                    🔥 Acceso anticipado a Zion Stage
                </div>
                <p style={{ margin: '0 0 14px', fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.55 }}>
                    Sé de los primeros en probar la app en Android. Ayúdanos a testearla en Google Play antes del
                    lanzamiento oficial: instala, usa el mezclador y si algo falla, cuéntanos.
                </p>
                <a
                    href={PLAY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#00d2d3',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        wordBreak: 'break-all',
                        marginBottom: 18,
                        textDecoration: 'underline',
                    }}
                >
                    <ExternalLink size={18} />
                    👉 {PLAY_URL}
                </a>
                <div
                    style={{
                        fontSize: '2.5rem',
                        fontWeight: 900,
                        color: '#f59e0b',
                        marginBottom: 8,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {secondsLeft}
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    La página está bloqueada unos segundos…
                </p>
            </div>
        </div>
    );
}
