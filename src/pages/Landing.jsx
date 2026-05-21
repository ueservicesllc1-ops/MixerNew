import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitch from '../components/LanguageSwitch';
import { auth, db, storage } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, limit, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, ShoppingCart, Play, CheckCircle2, Menu, X, ArrowRight, User, KeyRound, Timer, Layers, Music2, Globe, Camera, ChevronLeft, ChevronRight, TrendingUp, Monitor } from 'lucide-react';
import Footer from '../components/Footer';
import { HorizontalMixer } from '../components/HorizontalMixer';
import { trackUserUsage } from '../utils/usageMetrics';
import { isPlausibleWindowsInstallerHttpsUrl } from '../utils/desktopInstallerUrl';
import { getMixerApiBase, getMixerApiBaseCandidates } from '../mixerApiBase';
import { DESKTOP_PRO_PLANS } from '../desktop/desktopProPlans';

/** URL hardcodeada del .exe actual. Cuando subas una versión nueva, actualizá estas dos constantes y listo: instantáneo, sin Firestore, sin manifiesto, sin esperas. */
const HARDCODED_DESKTOP_INSTALLER_URL = 'https://mixernew-production.up.railway.app/api/download?url=https%3A%2F%2Ff005.backblazeb2.com%2Ffile%2Fmixercur%2Fapps%2Fzion-stage-desktop-v1.1.9-1778611080599.exe';
const HARDCODED_DESKTOP_VERSION_NAME = '1.1.9';
const HARDCODED_ANDROID_APK_URL = 'https://mixernew-production.up.railway.app/api/download?url=https%3A%2F%2Ff005.backblazeb2.com%2Ffile%2Fmixercur%2Fapps%2Fzion-stage-v1.8.58-1776137302918.apk';
const HARDCODED_ANDROID_VERSION_NAME = '1.8.58';

export default function Landing() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    /** Promo instalador Windows: siempre en inglés (CTA global), independiente del idioma del sitio. */
    const tDesktopPromo = React.useCallback(
        (key, opts) => t(`landing.${key}`, { ...opts, lng: 'en' }),
        [t],
    );
    const [showSellerInfoModal, setShowSellerInfoModal] = useState(false);
    /** Modal de entrada: descarga escritorio; 20 s y se cierra solo. */
    const [showDesktopDownloadPromo, setShowDesktopDownloadPromo] = useState(false);
    const [desktopPromoSecondsLeft, setDesktopPromoSecondsLeft] = useState(20);
    const [email, setEmail] = useState('');

    useEffect(() => {
        const openId = setTimeout(() => setShowDesktopDownloadPromo(true), 500);
        return () => clearTimeout(openId);
    }, []);

    useEffect(() => {
        if (!showDesktopDownloadPromo) return undefined;
        setDesktopPromoSecondsLeft(20);
        const hideId = setTimeout(() => setShowDesktopDownloadPromo(false), 20000);
        const tickId = setInterval(() => {
            setDesktopPromoSecondsLeft((n) => Math.max(0, n - 1));
        }, 1000);
        return () => {
            clearTimeout(hideId);
            clearInterval(tickId);
        };
    }, [showDesktopDownloadPromo]);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const avatarInputRef = React.useRef();
    const [isLogin, setIsLogin] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [showLoginPanel, setShowLoginPanel] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isAnnual, setIsAnnual] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [songsForSale, setSongsForSale] = useState([]);
    const [previewSong, setPreviewSong] = useState(null);
    const [previewTracks, setPreviewTracks] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewProgress, setPreviewProgress] = useState(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const carouselRef = React.useRef(null);
    const previewEngineRef = React.useRef(null);
    const [cart, setCart] = useState([]);
    const [toast, setToast] = useState(null);
    const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
    const [latestApp, setLatestApp] = useState({
        versionName: HARDCODED_ANDROID_VERSION_NAME,
        downloadUrl: HARDCODED_ANDROID_APK_URL,
        desktopVersionName: HARDCODED_DESKTOP_VERSION_NAME,
        desktopDownloadUrl: HARDCODED_DESKTOP_INSTALLER_URL,
        releaseNotes: ''
    });

    const [heroSlides, setHeroSlides] = useState([]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [heroSlides.length]);

    useEffect(() => {
        const savedCart = localStorage.getItem('zion_cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch { /* ignore */
                setCart([]);
            }
        }
    }, []);

    const addToCart = (song) => {
        setCart(prev => {
            if (prev.some(item => item.id === song.id)) return prev;
            const newCart = [...prev, { id: song.id, name: song.name, artist: song.artist, price: song.price || 9.99, coverUrl: song.coverUrl }];
            localStorage.setItem('zion_cart', JSON.stringify(newCart));
            return newCart;
        });
        setToast(t('landing.toastAdded', { name: song.name }));
        setTimeout(() => setToast(null), 3000);
    };

    /** URL hardcodeada: siempre lista, sin esperar nada. */
    const desktopWinUrlReady = true;

    const handleDesktopInstallerDownload = () => {
        window.open(HARDCODED_DESKTOP_INSTALLER_URL, '_blank', 'noopener,noreferrer');
        void addDoc(collection(db, 'desktop_download_events'), {
            source: 'landing_modal',
            versionName: HARDCODED_DESKTOP_VERSION_NAME,
            createdAt: serverTimestamp(),
            locale: typeof navigator !== 'undefined' ? String(navigator.language || '').slice(0, 47) : '',
        }).catch((err) => {
            console.warn('[desktop_download_events]', err?.code || err?.message || err);
        });
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);

        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            if (user) void trackUserUsage(user);
        });

        const fetchSongs = async () => {
            try {
                const q = query(collection(db, 'songs'), where('forSale', '==', true), limit(20));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Ordenar por fecha: nuevos arriba para que el Top 10 sea "lo más reciente"
                    const sorted = fetched.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis() || 0;
                        const timeB = b.createdAt?.toMillis() || 0;
                        return timeB - timeA;
                    });
                    setSongsForSale(sorted);
                } else {
                    setSongsForSale([]);
                }
            } catch {
                // Maintain placeholders if there's an error
            }
        };
        fetchSongs();

        const fetchBanners = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'banners'), orderBy('createdAt', 'desc')));
                if (!snap.empty) {
                    const proxy = getMixerApiBase();
                    const proxyImg = (url) => {
                        if (!url) return url;
                        if (url.includes('backblazeb2.com') || url.includes('f005.')) {
                            return `${proxy}/api/download?url=${encodeURIComponent(url)}`;
                        }
                        return url;
                    };
                    const fetched = snap.docs.map(doc => {
                        const d = doc.data();
                        const rawImg = d.image || d.imageUrl || d.url || d.photoUrl || '';
                        return { id: doc.id, ...d, image: proxyImg(rawImg) };
                    });
                    setHeroSlides(fetched);
                }
            } catch (e) {
                console.error("Error fetching banners:", e);
            }
        };

        const fetchLatestApp = async () => {
            const isApkUrl = (u) => {
                const s = String(u || '').trim().toLowerCase();
                return s.length > 0 && (s.includes('.apk') || s.includes('package'));
            };
            const isExeUrl = (u) => {
                const s = String(u || '').trim().toLowerCase();
                return s.length > 0 && s.endsWith('.exe');
            };

            let androidRow = null;
            let rows = [];
            let withDesktopField = null;
            let desktopUrlFs = '';

            try {
                const q = query(collection(db, 'app_versions'), orderBy('createdAt', 'desc'), limit(25));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    androidRow = rows.find((r) => r.downloadUrl && isApkUrl(r.downloadUrl));
                    if (!androidRow) {
                        androidRow = rows.find((r) => r.downloadUrl && !isExeUrl(r.downloadUrl));
                    }
                    /** Primer doc con `desktopDownloadUrl` en lista ya ordenada por `createdAt` desc = el más nuevo con ese campo. */
                    withDesktopField = rows.find((r) => String(r.desktopDownloadUrl || '').trim()) || null;
                    if (withDesktopField) {
                        desktopUrlFs = String(withDesktopField.desktopDownloadUrl).trim();
                    }
                }
            } catch (err) {
                console.error('Error fetching latest app (Firestore):', err);
            }

            /** Proxy: API primero; varias bases (local + Railway) para dev sin `b2-proxy` en :3001. */
            let desktopJson = null;
            try {
                const semverParts = (s) => {
                    const m = String(s || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
                    return m ? [+m[1], +(m[2] || 0), +(m[3] || 0)] : [0, 0, 0];
                };
                const semverGt = (a, b) => {
                    const x = semverParts(a);
                    const y = semverParts(b);
                    for (let i = 0; i < 3; i++) {
                        if (x[i] !== y[i]) return x[i] > y[i];
                    }
                    return false;
                };
                let best = null;
                const bases = getMixerApiBaseCandidates();
                for (const base of bases) {
                    for (const path of ['/api/app-latest-desktop', '/app-latest-desktop.json']) {
                        try {
                            const r = await fetch(`${base}${path}?cb=${Date.now()}`, { cache: 'no-store' });
                            if (!r.ok) continue;
                            const j = await r.json();
                            const u = String(j?.desktopDownloadUrl || '').trim();
                            if (!u || !isPlausibleWindowsInstallerHttpsUrl(u)) continue;
                            const vn = String(j?.versionName || '').trim() || '0.0.0';
                            if (!best || semverGt(vn, String(best.versionName || '').trim() || '0.0.0')) best = j;
                        } catch {
                            /* siguiente base / ruta */
                        }
                    }
                }
                desktopJson = best;
            } catch (e) {
                console.warn('app-latest-desktop (proxy):', e?.message || e);
            }

            /** Firestore y JSON del proxy: elegir la URL de escritorio con semver más alto (no `fs || json`). */
            const jsonDeskUrl = desktopJson && String(desktopJson.desktopDownloadUrl || '').trim();
            const jsonDeskVer = (desktopJson && String(desktopJson.versionName || '').trim()) || '0.0.0';
            const fsDeskVer = (withDesktopField && String(withDesktopField.versionName || '').trim()) || '0.0.0';
            const deskCandidates = [];
            if (desktopUrlFs && isPlausibleWindowsInstallerHttpsUrl(desktopUrlFs)) {
                deskCandidates.push({ url: desktopUrlFs, ver: fsDeskVer });
            }
            if (jsonDeskUrl && isPlausibleWindowsInstallerHttpsUrl(jsonDeskUrl)) {
                deskCandidates.push({ url: jsonDeskUrl, ver: jsonDeskVer });
            }
            const semverPartsPick = (s) => {
                const m = String(s || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
                return m ? [+m[1], +(m[2] || 0), +(m[3] || 0)] : [0, 0, 0];
            };
            const semverGtPick = (a, b) => {
                const x = semverPartsPick(a);
                const y = semverPartsPick(b);
                for (let i = 0; i < 3; i++) {
                    if (x[i] !== y[i]) return x[i] > y[i];
                }
                return false;
            };
            let desktopWinner = null;
            for (const c of deskCandidates) {
                if (!desktopWinner || semverGtPick(c.ver, desktopWinner.ver)) desktopWinner = c;
            }
            const desktopUrl = desktopWinner?.url || '';
            const exeRow = rows.find((r) => r.downloadUrl && isExeUrl(r.downloadUrl));
            const desktopVersionName =
                (desktopWinner && String(desktopWinner.ver || '').trim())
                || (withDesktopField && String(withDesktopField.versionName || '').trim())
                || (desktopJson && String(desktopJson.versionName || '').trim())
                || (exeRow && String(exeRow.versionName || '').trim())
                || '';
            const versionName =
                (androidRow && String(androidRow.versionName || '').trim())
                || (withDesktopField && String(withDesktopField.versionName || '').trim())
                || (desktopJson && String(desktopJson.versionName || '').trim())
                || (rows[0] && String(rows[0].versionName || '').trim())
                || '';



            setLatestApp({
                versionName: versionName || HARDCODED_ANDROID_VERSION_NAME,
                downloadUrl: androidRow?.downloadUrl ? String(androidRow.downloadUrl) : HARDCODED_ANDROID_APK_URL,
                desktopDownloadUrl: desktopUrl || HARDCODED_DESKTOP_INSTALLER_URL,
                desktopVersionName: desktopVersionName || HARDCODED_DESKTOP_VERSION_NAME,
                releaseNotes:
                    androidRow?.releaseNotes
                    || withDesktopField?.releaseNotes
                    || desktopJson?.releaseNotes
                    || rows[0]?.releaseNotes
                    || '',
            });
        };
        fetchLatestApp();
        fetchBanners();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            unsubscribe();
            // Clear engines callback when unmounting
            import('../AudioEngine').then(({ audioEngine }) => {
                if (audioEngine.onProgress) audioEngine.onProgress = null;
            }).catch(() => {});
        };
    }, []);

    const scrollCarousel = (dir) => {
        if (!carouselRef.current) return;
        const { scrollLeft, clientWidth } = carouselRef.current;
        const scrollAmount = clientWidth * 0.8;
        carouselRef.current.scrollTo({
            left: dir === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
            behavior: 'smooth'
        });
    };

    const openPreview = async (song) => {
        setPreviewSong(song);
        setPreviewLoading(true);
        setPreviewProgress(20);

        try {
            const { audioEngine } = await import('../AudioEngine');
            await audioEngine.init();
            await audioEngine.stop();
            await audioEngine.clear();
            previewEngineRef.current = audioEngine;

            // Logic similar to Store.jsx for consistent behavior
            const validTracks = song.tracks?.filter(t => t.name !== '__PreviewMix') || [];
            const isUsingPreviewMixOnly = validTracks.length === 0;
            const useClips = isUsingPreviewMixOnly || validTracks.some(t => t.previewUrl && t.previewUrl !== t.url);
            
            console.log(useClips ? "🚀 Usando clips recortados (Carga rápida)" : "🐌 Usando tracks completos (Carga lenta)");

            const rawTracks = (!isUsingPreviewMixOnly)
                ? validTracks.map(t => ({ id: t.id || Math.random().toString(), name: t.name || 'UNNAMED', url: (useClips ? t.previewUrl : t.url) || t.url }))
                : song.tracks?.filter(t => t.name === '__PreviewMix').map(t => ({ id: 'preview', name: 'DEMO CLIP', url: t.url || t.previewUrl })) || [
                    { id: 'full_demo', name: 'FULL MIX DEMO', url: song.demoUrl || '/pads/E.mp3' }
                ];

            const getProxyUrl = (url) => {
                if (!url) return '';
                if (url.startsWith('/') || url.includes('localhost')) return url;
                return `https://mixernew-production.up.railway.app/api/download?url=${encodeURIComponent(url)}`;
            };

            const tracksToLoad = rawTracks.map(t => ({ ...t, proxyUrl: getProxyUrl(t.url) }));
            setPreviewTracks(tracksToLoad.map(t => ({ id: t.id, name: t.name, muted: false, solo: false, volume: 0.8, pan: 0 })));

            const batch = [];
            for (const t of tracksToLoad) {
                try {
                    const res = await fetch(t.proxyUrl);
                    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                    const blob = await res.blob();
                    batch.push({ id: t.id, name: t.name, sourceData: blob });
                } catch (e) {
                    console.warn(`Failed track ${t.name}`, e);
                }
            }

            if (batch.length === 0) throw new Error("No tracks loaded");

            await audioEngine.addTracksBatch(batch);

            if (useClips) {
                await audioEngine.seek(0); // El clip ya empieza en el segundo 20 real
            } else {
                await audioEngine.seek(20); // Track completo, hay que saltar
            }

            await audioEngine.play();
            setIsPreviewPlaying(true);
            setPreviewLoading(false);

            audioEngine.onProgress = (p) => {
                const displayTime = useClips ? (20 + p) : p;
                setPreviewProgress(displayTime);

                const stopTime = useClips ? 40 : 40; // En ambos casos queremos llegar al 40 total
                if (displayTime >= stopTime) {
                    audioEngine.pause();
                    audioEngine.seek(useClips ? 0 : 20);
                    setPreviewProgress(20);
                    setIsPreviewPlaying(false);
                }
            };
        } catch (err) {
            console.error("Preview error:", err);
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        if (previewEngineRef.current) {
            previewEngineRef.current.stop();
            previewEngineRef.current.clear();
        }
        setPreviewSong(null);
    };

    const handleVolumeChange = (id, vol) => {
        setPreviewTracks(prev => prev.map(t => t.id === id ? { ...t, volume: vol } : t));
        previewEngineRef.current?.setTrackVolume(id, vol);
    };

    const handleMuteToggle = (id) => {
        setPreviewTracks(prev => prev.map(t => {
            if (t.id === id) {
                const next = !t.muted;
                previewEngineRef.current?.setTrackMute(id, next);
                return { ...t, muted: next };
            }
            return t;
        }));
    };

    const handleSoloToggle = (id) => {
        setPreviewTracks(prev => prev.map(t => {
            if (t.id === id) {
                const next = !t.solo;
                previewEngineRef.current?.setTrackSolo(id, next);
                return { ...t, solo: next };
            }
            return t;
        }));
    };

    const handlePanChange = (id, pan) => {
        setPreviewTracks(prev => prev.map(t => t.id === id ? { ...t, pan } : t));
        const engine = previewEngineRef.current;
        if (engine && engine.setTrackPan) engine.setTrackPan(id, pan);
    };

    const togglePreviewPlayback = async () => {
        if (!previewEngineRef.current) return;
        await previewEngineRef.current.init();
        if (isPreviewPlaying) {
            previewEngineRef.current.pause();
            setIsPreviewPlaying(false);
        } else {
            const useClips = previewSong?.tracks?.some(t => t.previewUrl && t.previewUrl !== t.url);
            if (previewProgress >= 40) {
                await previewEngineRef.current.seek(useClips ? 0 : 20);
                setPreviewProgress(20);
            }
            await previewEngineRef.current.play();
            setIsPreviewPlaying(true);
        }
    };



    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (password !== confirmPassword) {
                    setErrorMsg("Las contraseñas no coinciden.");
                    return;
                }
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                const fullName = `${firstName} ${lastName}`.trim();

                // Upload avatar if provided
                let photoURL = null;
                if (avatarFile) {
                    const avatarRef = ref(storage, `avatars/${userCred.user.uid}`);
                    await uploadBytes(avatarRef, avatarFile);
                    photoURL = await getDownloadURL(avatarRef);
                }

                await updateProfile(userCred.user, { displayName: fullName, ...(photoURL && { photoURL }) });

                // Set initial user doc in Firestore
                await setDoc(doc(db, 'users', userCred.user.uid), {
                    firstName,
                    lastName,
                    email,
                    ...(photoURL && { photoURL }),
                    planId: 'free',
                    customStorageGB: 1,
                    createdAt: serverTimestamp()
                }, { merge: true });
            }
            setShowLoginPanel(false);
        } catch (error) {
            console.error("Auth error:", error);
            setErrorMsg(error.message);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setErrorMsg(t('landing.enterEmailFirst'));
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setErrorMsg('');
            setToast(t('landing.resetEmailSent'));
            setTimeout(() => setToast(null), 5000);
        } catch (error) {
            console.error("Reset Password Error:", error);
            setErrorMsg(error.message || String(error));
        }
    };

    const handleGoogleAuth = async () => {
        setErrorMsg('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            setShowLoginPanel(false);
        } catch (error) {
            console.error("Google Auth error:", error);
            setErrorMsg(error.message);
        }
    };

    return (
        <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', fontFamily: '"Outfit", sans-serif' }}>

            {/* TOAST DE NOTIFICACIÓN PROFESIONAL */}
            {toast && (
                <div key="toast-notification" style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    background: '#0f172a', border: '1px solid #00d2d3', color: 'white',
                    padding: '12px 24px', borderRadius: '50px', zIndex: 5000,
                    boxShadow: '0 10px 30px rgba(0,210,211,0.2)', display: 'flex', alignItems: 'center', gap: '12px',
                    animation: 'slideUp 0.3s ease-out', pointerEvents: 'none'
                }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#00d2d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={14} color="black" />
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{toast}</span>
                </div>
            )}

            <style key="local-styles">{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 50px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes landingDesktopPromoFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes landingDesktopPromoRise {
                    from { opacity: 0; transform: translateY(22px) scale(0.985); filter: blur(4px); }
                    to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                }
                @keyframes landingDesktopPromoLine {
                    from { transform: scaleX(0.2); opacity: 0; }
                    to { transform: scaleX(1); opacity: 1; }
                }
                @keyframes landingDesktopPromoGlow {
                    0%, 100% { opacity: 0.45; }
                    50% { opacity: 0.85; }
                }
                .landing-desktop-promo-backdrop {
                    animation: landingDesktopPromoFadeIn 0.5s ease-out both;
                }
                .landing-desktop-promo-card {
                    animation: landingDesktopPromoRise 0.62s cubic-bezier(0.22, 1, 0.32, 1) 0.06s both;
                }
                .landing-desktop-promo-accent-line {
                    animation: landingDesktopPromoLine 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
                }
                .landing-desktop-promo-cta {
                    transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
                }
                .landing-desktop-promo-cta:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 14px 36px -8px rgba(6, 182, 212, 0.45), inset 0 1px 0 rgba(255,255,255,0.22);
                    filter: brightness(1.04);
                }
                .landing-desktop-promo-cta:active {
                    transform: translateY(0);
                }
            `}</style>

            {/* GLASS NAVBAR */}
            <nav className={scrolled ? 'glass-nav' : ''} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: scrolled ? '12px 60px' : '20px 60px',
                transition: 'all 0.3s ease',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: scrolled ? 'rgba(15, 23, 42, 0.9)' : 'transparent',
                borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '35px' }}>
                    <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '36px' }} />
                    </div>

                    <div className="hide-mobile" style={{ display: 'flex', gap: '25px', marginLeft: '20px', fontSize: '0.95rem', fontWeight: '600', color: '#94a3b8' }}>
                        {[
                            { label: t('nav.songs'), path: '/store' },
                            { label: t('nav.software'), path: '/software' },
                            { label: t('nav.resources'), path: '/recursos' },
                        ].map(item => (
                            <span
                                key={item.label}
                                onClick={() => navigate(item.path)}
                                style={{ cursor: 'pointer', transition: 'color 0.2s', textDecoration: 'none' }}
                                onMouseEnter={e => e.target.style.color = '#fff'}
                                onMouseLeave={e => e.target.style.color = '#94a3b8'}
                            >
                                {item.label}
                            </span>
                        ))}
                        {latestApp?.downloadUrl && (
                            <span
                                onClick={() => window.open(latestApp.downloadUrl, window.Capacitor?.isNativePlatform?.() ? '_system' : '_blank')}
                                style={{ cursor: 'pointer', transition: 'color 0.2s', textDecoration: 'none', color: '#3ddc84', fontWeight: 'bold' }}
                                onMouseEnter={e => e.target.style.color = '#fff'}
                                onMouseLeave={e => e.target.style.color = '#3ddc84'}
                            >
                                {t('nav.android')}
                            </span>
                        )}
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={handleDesktopInstallerDownload}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDesktopInstallerDownload(); } }}
                            style={{
                                cursor: 'pointer',
                                transition: 'color 0.2s, opacity 0.2s',
                                textDecoration: 'none',
                                color: desktopWinUrlReady ? '#60a5fa' : '#64748b',
                                fontWeight: 'bold',
                                opacity: desktopWinUrlReady ? 1 : 0.85,
                            }}
                            onMouseEnter={(e) => { if (desktopWinUrlReady) e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = desktopWinUrlReady ? '#60a5fa' : '#64748b';
                            }}
                        >
                            {t('nav.windows')}
                        </span>
                        <span
                            onClick={() => document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth' })}
                            style={{ cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s', textDecoration: 'none' }}
                            onMouseEnter={e => e.target.style.color = '#f1c40f'}
                            onMouseLeave={e => e.target.style.color = '#94a3b8'}
                        >
                            {t('nav.prices')}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <LanguageSwitch />
                    {!currentUser ? (
                        <>
                            <span onClick={() => setShowLoginPanel(true)} style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: '#ccc' }}>{t('nav.login')}</span>
                            <button className="btn-teal" onClick={() => { setIsLogin(false); setShowLoginPanel(true); }}>
                                {t('nav.joinFree')}
                            </button>
                        </>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <div
                                onClick={() => setShowDropdown(!showDropdown)}
                                style={{
                                    width: '38px', height: '38px', borderRadius: '50%',
                                    background: currentUser?.photoURL ? 'transparent' : 'linear-gradient(135deg,#00d2d3,#9b59b6)',
                                    backgroundImage: currentUser?.photoURL ? `url(${currentUser.photoURL})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: '800', cursor: 'pointer',
                                    border: '2px solid rgba(255,255,255,0.2)'
                                }}
                            >
                                {!currentUser?.photoURL && (currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()}
                            </div>

                            {showDropdown && (
                                <div style={{
                                    position: 'absolute', top: '50px', right: 0, background: '#0f172a',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '250px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 2000
                                }}>
                                    <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '14px', alignItems: 'center' }}>
                                        {/* Avatar inside dropdown */}
                                        <div style={{
                                            width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                                            background: currentUser?.photoURL ? `url(${currentUser.photoURL}) center/cover` : 'linear-gradient(135deg,#00d2d3,#9b59b6)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: '800', fontSize: '1.1rem', border: '2px solid rgba(255,255,255,0.1)'
                                        }}>
                                            {!currentUser?.photoURL && (currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()}
                                        </div>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontWeight: '800', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {currentUser?.displayName || currentUser?.email?.split('@')[0]}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {currentUser?.email}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {[
                                            { label: t('nav.mainCloud'), icon: <Globe size={18} />, onClick: () => navigate('/dashboard') },
                                            { label: t('nav.trackStore'), icon: <ShoppingCart size={18} />, onClick: () => navigate('/store') },
                                            { label: t('nav.wishlist'), icon: <CheckCircle2 size={18} />, onClick: () => navigate('/store') },
                                            { label: t('nav.settings'), icon: <Menu size={18} />, onClick: () => navigate('/dashboard') },
                                        ].map((item, idx) => (
                                            <div
                                                key={idx}
                                                onClick={item.onClick}
                                                style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '600', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span style={{ color: '#94a3b8' }}>{item.icon}</span> {item.label}
                                            </div>
                                        ))}

                                        <div
                                            onClick={() => { auth.signOut(); setShowDropdown(false); }}
                                            style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '600', transition: 'background 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ color: '#94a3b8' }}><ArrowRight size={18} /></span> {t('nav.signOut')}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginLeft: '10px' }}>
                        <Search size={19} color="#94a3b8" style={{ cursor: 'pointer' }} />
                        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/checkout')}>
                            <ShoppingCart size={19} color="#94a3b8" />
                            {cart.length > 0 && (
                                <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#00d2d3', color: 'black', fontSize: '0.65rem', fontWeight: '900', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(0,210,211,0.5)' }}>
                                    {cart.length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </nav >

            {/* HERO SECTION */}
            <header className="hero-gradient" style={{ 
                paddingTop: '120px', 
                paddingBottom: '140px', 
                paddingLeft: '60px', 
                paddingRight: '60px' 
            }}>
                <div style={{ 
                    maxWidth: '1600px', 
                    margin: '0 auto', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '100px',
                    flexWrap: 'wrap',
                    textAlign: 'left'
                }}>
                    <div style={{ flex: '0.6 1 350px' }}>
                        <h1 className="text-gradient" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: '900', lineHeight: '1.1', margin: '0 0 20px 0', letterSpacing: '-1px' }}>
                            {t('landing.heroLine1')}<br />{t('landing.heroLine2')}
                        </h1>
                        <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: '1.6', maxWidth: '450px', margin: '0 0 32px' }}>
                            {t('landing.heroSub')}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                            {!currentUser ? (
                                <button className="btn-teal" style={{ padding: '14px 32px', fontSize: '0.95rem' }} onClick={() => { setIsLogin(false); setShowLoginPanel(true); }}>
                                    {t('landing.ctaStart')}
                                </button>
                            ) : (
                                <button className="btn-teal" style={{ padding: '14px 32px', fontSize: '0.95rem' }} onClick={() => navigate('/dashboard')}>
                                    {t('landing.ctaCloud')}
                                </button>
                            )}
                            <button className="btn-ghost" style={{ padding: '14px 32px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Play size={18} fill="currentColor" /> {t('landing.ctaWatch')}
                            </button>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {latestApp?.downloadUrl && (
                                <button
                                    onClick={() => window.open(latestApp.downloadUrl, window.Capacitor?.isNativePlatform?.() ? '_system' : '_blank')}
                                    style={{ padding: '12px 22px', fontSize: '0.82rem', background: 'linear-gradient(135deg,#3ddc84,#2a9d5c)', border: 'none', color: 'white', borderRadius: '50px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 15px rgba(61,220,132,0.35)' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24A9.822 9.822 0 0 0 12 8c-1.53 0-2.97.38-4.47 1L5.65 5.67a.644.644 0 0 0-.84-.22c-.3.16-.42.54-.26.85l1.84 3.18C3.93 10.91 2.5 12.97 2.5 15.25c0 .22.02.44.05.65h18.9c.03-.21.05-.43.05-.65 0-2.28-1.43-4.34-3.9-5.77zM9 13.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>
                                    {t('landing.downloadAndroid', { ver: latestApp.versionName })}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleDesktopInstallerDownload}
                                style={{
                                    padding: '12px 22px',
                                    fontSize: '0.82rem',
                                    background: 'linear-gradient(135deg,#0078d4,#005a9e)',
                                    border: 'none',
                                    color: 'white',
                                    borderRadius: '50px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '9px',
                                    boxShadow: desktopWinUrlReady ? '0 4px 15px rgba(0,120,212,0.35)' : 'none',
                                    opacity: desktopWinUrlReady ? 1 : 0.72,
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                                {t('landing.installWin', {
                                    ver: latestApp?.desktopVersionName || latestApp?.versionName || '—',
                                })}
                            </button>
                        </div>
                    </div>

                    {/* HERO CAROUSEL BANNER */}
                    <div style={{ 
                        flex: '2 1 800px', 
                        position: 'relative',
                        minWidth: '320px'
                    }}>
                        <div style={{
                            borderRadius: '30px',
                            overflow: 'hidden',
                            boxShadow: '0 50px 100px rgba(0,0,0,0.8)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: '#020617',
                            aspectRatio: '16/9',
                            position: 'relative'
                        }}>
                            {heroSlides.length > 0 ? heroSlides.map((slide, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: currentHeroSlide === idx ? 1 : 0,
                                        transition: 'opacity 1s ease-in-out',
                                        zIndex: currentHeroSlide === idx ? 1 : 0
                                    }}
                                >
                                    <img
                                        src={slide.image || slide.imageUrl || slide.url || slide.photoUrl || ''}
                                        alt={slide.title || ''}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        padding: '30px 40px',
                                        background: 'linear-gradient(to top, rgba(2,6,23,0.9), transparent)',
                                        textAlign: 'left',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'flex-end'
                                    }}>
                                        <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: '800', color: '#00d2d3' }}>{slide.title}</h3>
                                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{slide.subtitle}</p>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.8))',
                                    gap: '15px'
                                }}>
                                    <img src="/logo2blanco.png" alt="Loading" style={{ height: '30px', opacity: 0.2, filter: 'grayscale(1)' }} />
                                    <div className="skeleton-pulse" style={{ width: '40px', height: '4px', background: 'rgba(0,210,211,0.2)', borderRadius: '2px' }}></div>
                                </div>
                            )}

                            {/* Slide Indicators */}
                            <div style={{ position: 'absolute', bottom: '20px', right: '30px', display: 'flex', gap: '8px', zIndex: 10 }}>
                                {heroSlides.map((_, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setCurrentHeroSlide(idx)}
                                        style={{
                                            width: currentHeroSlide === idx ? '25px' : '6px',
                                            height: '6px',
                                            borderRadius: '3px',
                                            background: currentHeroSlide === idx ? '#00d2d3' : 'rgba(255,255,255,0.3)',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {heroSlides.length > 1 && (
                            <>
                                <button
                                    onClick={() => setCurrentHeroSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                                    style={{ position: 'absolute', left: '-25px', top: '50%', transform: 'translateY(-50%)', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(10px)' }}
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={() => setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length)}
                                    style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(10px)' }}
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}

                        {/* Decorative accents */}
                        <div style={{ position: 'absolute', top: '-40px', left: '-40px', width: '200px', height: '200px', background: 'rgba(0,210,211,0.2)', filter: 'blur(80px)', zIndex: -1 }}></div>
                        <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '250px', height: '250px', background: 'rgba(155,89,182,0.15)', filter: 'blur(80px)', zIndex: -1 }}></div>
                    </div>
                </div>
            </header>

            {/* FEATURED TRACKS CAROUSEL SECTION */}
            <section style={{ padding: '100px 0', backgroundColor: '#0f172a', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px', maxWidth: '1300px', margin: '0 auto 48px', padding: '0 60px' }}>
                    <div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 12px' }}>{t('landing.tracksForSale')}</h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>{t('landing.tracksForSaleSub')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <button 
                            onClick={() => navigate('/store')} 
                            className="btn-ghost" 
                            style={{ 
                                padding: '10px 20px', 
                                border: '1px solid #00d2d3', 
                                color: '#00d2d3', 
                                fontSize: '0.9rem', 
                                fontWeight: '700',
                                borderRadius: '12px'
                            }}
                        >
                            {t('landing.enterStore')}
                        </button>
                        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }}></div>
                        <button onClick={() => scrollCarousel('left')} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={24} /></button>
                        <button onClick={() => scrollCarousel('right')} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={24} /></button>
                    </div>
                </div>

                <div
                    ref={carouselRef}
                    style={{
                        display: 'flex',
                        gap: '24px',
                        overflowX: 'auto',
                        padding: '0 60px 40px',
                        scrollBehavior: 'smooth',
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none'
                    }}
                    className="hide-scrollbar"
                >
                    {songsForSale.map((track, i) => (
                        <div
                            key={i}
                            className="card-compact"
                            onClick={() => navigate('/store')}
                            style={{
                                width: '160px',
                                flex: '0 0 160px',
                                transform: 'translateY(0)',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                padding: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                <img src={track.coverUrl || '/generic_cover.png'} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: track.coverUrl ? 1 : 0.8 }} alt={track.name} />
                                <div style={{ position: 'absolute', top: '5px', right: '5px', background: track.badge === 'MASTER' ? '#00d2d3' : (track.badge === 'PREMIUM' ? '#f59e0b' : '#1e293b'), color: 'white', fontSize: '0.45rem', fontWeight: '900', padding: '2px 5px', borderRadius: '3px', letterSpacing: '0.3px' }}>
                                    {track.badge || 'MASTER'}
                                </div>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div style={{ fontWeight: '800', color: '#00d2d3', fontSize: '0.75rem' }}>${track.price || '9.90'}</div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openPreview(track); }}
                                        style={{ background: '#00d2d3', border: 'none', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 0 10px rgba(0,210,211,0.4)' }}
                                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.15)'}
                                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                    >
                                        <Play size={14} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                            <h4 style={{ margin: '0 0 1px', fontSize: '0.75rem', fontWeight: '800', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</h4>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.65rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SELLER CTA BANNER */}
            <section style={{ padding: '60px 20px', background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'rgba(0,210,211,0.05)', border: '1px solid rgba(0,210,211,0.2)', borderRadius: '32px', padding: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
                    <div style={{ flex: '1 1 500px' }}>
                        <div style={{ color: '#00d2d3', fontWeight: '800', fontSize: '0.9rem', marginBottom: '16px', letterSpacing: '2px' }}>{t('landing.communityBadge')}</div>
                        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: '900', color: 'white', lineHeight: '1.2', marginBottom: '20px' }}>{t('landing.sellerTitle')}</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px' }}>{t('landing.sellerSub')}</p>
                    </div>
                    <div style={{ flex: '0 0 auto' }}>
                        <button 
                            onClick={() => setShowSellerInfoModal(true)} 
                            className="btn-teal" 
                            style={{ padding: '18px 48px', fontSize: '1.1rem', boxShadow: '0 20px 40px rgba(0,210,211,0.2)' }}
                        >
                            {t('landing.sellerBtn')}
                        </button>
                    </div>
                </div>
            </section>

            {/* INFO SECTION: BEYOND THE TRACKS */}
            <section style={{ backgroundColor: '#020617', padding: '100px 60px' }}>
                <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', gap: '60px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 500px' }}>
                        <img
                            src="/worship_community_banner_1772898920206.png"
                            alt="Worship Community"
                            style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}
                        />
                    </div>
                    <div style={{ flex: '1 1 500px' }}>
                        <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '32px', lineHeight: '1.2' }}>{t('landing.moreThanTitle')}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {[
                                { title: t('landing.feat1t'), info: t('landing.feat1d'), icon: <CheckCircle2 size={24} color="#00d2d3" /> },
                                { title: t('landing.feat2t'), info: t('landing.feat2d'), icon: <CheckCircle2 size={24} color="#00d2d3" /> },
                                { title: t('landing.feat3t'), info: t('landing.feat3d'), icon: <CheckCircle2 size={24} color="#00d2d3" /> },
                                { title: t('landing.feat4t'), info: t('landing.feat4d'), icon: <CheckCircle2 size={24} color="#00d2d3" /> }
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ flexShrink: 0 }}>{item.icon}</div>
                                    <div>
                                        <h4 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: '700' }}>{item.title}</h4>
                                        <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.6' }}>{item.info}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section >

            {/* TOP 10 RANKING SECTION */}
            <section style={{ padding: '100px 60px', backgroundColor: '#0f172a' }}>
                <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center', fontSize: '2.5rem', fontWeight: '800', marginBottom: '60px' }}>{t('landing.top10')}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '32px' }}>
                            {songsForSale.slice(0, 5).map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: i === 0 ? '#00d2d3' : '#334155', width: '40px' }}>{i + 1}</span>
                                    <div style={{ marginLeft: '12px', flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.artist}</div>
                                    </div>
                                    <button 
                                        onClick={() => openPreview(s)}
                                        className="btn-ghost" 
                                        style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '0.8rem', border: '1px solid rgba(0,210,211,0.3)', color: '#00d2d3' }}
                                    >
                                        {t('landing.viewTracks')}
                                    </button>
                                </div>
                            ))}
                            {songsForSale.length === 0 && <p style={{ color: '#64748b', textAlign: 'center' }}>{t('common.loadingSongs')}</p>}
                        </div>
                        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '32px' }}>
                            {songsForSale.slice(5, 10).map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#334155', width: '40px' }}>{i + 6}</span>
                                    <div style={{ marginLeft: '12px', flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.artist}</div>
                                    </div>
                                    <button 
                                        onClick={() => openPreview(s)}
                                        className="btn-ghost" 
                                        style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '0.8rem', border: '1px solid rgba(0,210,211,0.3)', color: '#00d2d3' }}
                                    >
                                        {t('landing.viewTracks')}
                                    </button>
                                </div>
                            ))}
                            {songsForSale.length <= 5 && songsForSale.length > 0 && <p style={{ color: '#64748b', textAlign: 'center', marginTop: '20px' }}>{t('common.moreTracksSoon')}</p>}
                        </div>
                    </div>
                </div>
            </section >

            {/* PRICING SECTION — app Windows (PRO / PRO Online), referencia; la compra es en la app */}
            <section id="precios" style={{ padding: '100px 60px', backgroundColor: '#020617' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                        <h2 style={{ fontSize: '3rem', fontWeight: '900', margin: '0 0 16px' }}>{t('landing.pricingTitle')}</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '640px', margin: '0 auto 30px' }}>
                            {t('landing.pricingSub')}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '30px', display: 'flex', gap: '5px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <button type="button" onClick={() => setIsAnnual(false)} style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: !isAnnual ? '#00d2d3' : 'transparent', color: !isAnnual ? '#000' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>{t('common.monthly')}</button>
                                <button type="button" onClick={() => setIsAnnual(true)} style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: isAnnual ? '#00d2d3' : 'transparent', color: isAnnual ? '#000' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>{t('common.annual')}</button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                        {DESKTOP_PRO_PLANS.map((plan) => {
                            const isOnline = plan.tier === 'pro_online';
                            const title = isOnline ? t('landing.desktopWinProOnlineTitle') : t('landing.desktopWinProTitle');
                            const desc = isOnline ? t('landing.desktopWinProOnlineDesc') : t('landing.desktopWinProDesc');
                            const accent = isOnline ? '#c4b5fd' : '#00d2d3';
                            const border = isOnline ? '1px solid rgba(167, 139, 250, 0.35)' : '1px solid rgba(0,210,211,0.2)';
                            const rowBg = isOnline ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.03)';
                            const rowBorder = isOnline ? '1px solid rgba(167, 139, 250, 0.12)' : 'none';
                            const price = isAnnual ? plan.annualUsd : plan.monthlyUsd;
                            const fullYearAtMonthly = Math.round(plan.monthlyUsd * 12 * 100) / 100;
                            return (
                                <div
                                    key={plan.id}
                                    style={{
                                        backgroundColor: '#0f172a',
                                        padding: '40px',
                                        borderRadius: '24px',
                                        border,
                                        position: 'relative',
                                    }}
                                >
                                    {isOnline ? (
                                        <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f1c40f', color: '#000', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '1px' }}>
                                            {t('landing.planVipBadge')}
                                        </div>
                                    ) : null}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: accent }}>
                                        {isOnline ? <KeyRound size={24} /> : <Monitor size={24} />}
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>{title}</h3>
                                    </div>
                                    <p style={{ color: '#94a3b8', marginBottom: '28px', minHeight: '52px', lineHeight: 1.55 }}>{desc}</p>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '18px 16px',
                                            backgroundColor: rowBg,
                                            borderRadius: '12px',
                                            border: rowBorder,
                                        }}
                                    >
                                        <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#e2e8f0' }}>
                                            {isOnline ? t('landing.desktopWinPriceRowOnline') : t('landing.desktopWinPriceRowPro')}
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                            {isAnnual ? (
                                                <span style={{ fontSize: '0.8rem', color: isOnline ? 'rgba(196,181,253,0.55)' : '#64748b', textDecoration: 'line-through', marginBottom: '2px' }}>
                                                    ${fullYearAtMonthly.toFixed(2)}
                                                </span>
                                            ) : null}
                                            <div>
                                                <span style={{ fontSize: '1.35rem', fontWeight: '800', color: isOnline ? '#e9d5ff' : '#fff' }}>${price.toFixed(2)}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}> {isAnnual ? t('common.perYear') : t('common.perMonth')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '22px', lineHeight: 1.5, marginBottom: 0 }}>
                                        {t('landing.desktopWinPricingDisclaimer')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section >

            {/* PRE-FOOTER / PARTNERS FEATURE */}
            <section style={{ padding: '100px 40px', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ color: '#00d2d3', fontWeight: '800', fontSize: '0.9rem', marginBottom: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}>{t('landing.industryBadge')}</div>
                            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: '900', color: 'white', lineHeight: '1.1', marginBottom: '24px' }}>
                                {t('landing.industryTitle')}
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '32px' }}>
                                {t('landing.industrySub')}
                            </p>
                            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem' }}>Cloud</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('landing.cloudSync')}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem' }}>Native</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('landing.audioEngine')}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem' }}>Multi</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('landing.platforms')}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#1e293b', borderRadius: '32px', padding: '40px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px' }}>{t('landing.standardsTitle')}</h3>
                                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '30px' }}>{t('landing.standardsSub')}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    {[t('landing.chip1'), t('landing.chip2'), t('landing.chip3'), t('landing.chip4')].map((p, i) => (
                                        <div key={i} style={{ backgroundColor: 'rgba(0,210,211,0.03)', padding: '16px', borderRadius: '12px', color: '#00d2d3', fontSize: '0.9rem', fontWeight: '700', border: '1px solid rgba(0,210,211,0.1)' }}>
                                            {p}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Decorative glow */}
                            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(0,210,211,0.15), transparent)', borderRadius: '50%', filter: 'blur(40px)' }} />
                        </div>
                    </div>
                </div>
            </section >

            <Footer />

            {/* PREVIEW MODAL (Horizontal Studio Design) - Compact Version */}
            {
                previewSong && (
                    <div key="preview-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
                        <div style={{ background: '#020617', width: '100%', maxWidth: '700px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.7)', color: 'white' }}>

                            <div style={{ padding: '14px 25px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,210,211,0.3)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {previewSong.coverUrl ? (
                                            <img src={previewSong.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Music2 size={20} color="#00d2d3" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#00d2d3' }}>{previewSong.name}</h3>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>{t('landing.previewMode')}</span>
                                            <span style={{ width: '3px', height: '3px', background: '#334155', borderRadius: '50%' }}></span>
                                            <span style={{ fontSize: '0.7rem', color: '#00d2d3', fontWeight: '800' }}>{t('landing.previewSec')}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={closePreview} style={{ background: '#1e293b', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.target.style.background = '#ef4444'} onMouseLeave={e => e.target.style.background = '#1e293b'}><X size={16} /></button>
                            </div>

                            <div style={{ padding: '20px 25px' }}>
                                {previewLoading ? (
                                    <div style={{ textAlign: 'center', padding: '50px 0' }}>
                                        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,210,211,0.1)', borderTopColor: '#00d2d3', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
                                        <p style={{ color: '#00d2d3', fontSize: '0.9rem', fontWeight: '900', letterSpacing: '1px' }}>{t('landing.previewInit')}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ marginBottom: '20px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                                            <HorizontalMixer
                                                tracks={previewTracks}
                                                onVolumeChange={handleVolumeChange}
                                                onMuteToggle={handleMuteToggle}
                                                onSoloToggle={handleSoloToggle}
                                                onPanChange={handlePanChange}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '15px 20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <button
                                                onClick={togglePreviewPlayback}
                                                style={{ background: '#00d2d3', border: 'none', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', cursor: 'pointer', boxShadow: '0 0 20px rgba(0,210,211,0.3)', transition: 'transform 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                {isPreviewPlaying ? <X size={24} color="black" /> : <Play size={24} fill="black" color="black" style={{ marginLeft: '3px' }} />}
                                            </button>

                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.5px' }}>{t('landing.previewPlayback')}</span>
                                                    <span style={{ color: '#00d2d3', fontSize: '1rem', fontWeight: '900', fontFamily: 'monospace' }}>{previewProgress.toFixed(1)}s</span>
                                                </div>
                                                <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ width: `${Math.max(0, Math.min(100, ((previewProgress - 20) / 20) * 100))}%`, height: '100%', background: 'linear-gradient(to right, #00d2d3, #00ffff)', boxShadow: '0 0 10px rgba(0,210,211,0.4)', transition: 'width 0.1s linear' }}></div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    addToCart(previewSong);
                                                    closePreview();
                                                    navigate('/checkout');
                                                }}
                                                style={{ background: '#f1c40f', color: 'black', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                <ShoppingCart size={16} /> {t('landing.previewAddCart')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }



            {/* FULLSCREEN AUTH OVERLAY (Improved Design) */}
            {
                showLoginPanel && (
                    <div key="auth-modal" style={{ position: 'fixed', inset: 0, backgroundColor: '#f9fafb', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', color: '#111827' }}>
                        <div style={{ position: 'absolute', top: '24px', right: '32px' }}>
                            <button onClick={() => setShowLoginPanel(false)} style={{ background: '#e5e7eb', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20} color="#6b7280" />
                            </button>
                        </div>

                        <div style={{ width: '100%', maxWidth: '1000px', padding: '80px 24px', display: 'flex', gap: '60px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {/* Auth Card */}
                            <div style={{ flex: '1 1 420px', backgroundColor: 'white', borderRadius: '16px', padding: '48px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #f3f4f6' }}>
                                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                        <img src="/logo2.png" alt="Zion Stage" style={{ height: '40px' }} />
                                    </div>
                                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>{isLogin ? t('landing.authWelcome') : t('landing.authCreate')}</h1>
                                    <p style={{ color: '#6b7280' }}>{t('landing.authJoinSub')}</p>
                                </div>

                                {errorMsg && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', textAlign: 'center' }}>{errorMsg}</div>}

                                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {!isLogin && (
                                        <>
                                            {/* ─── Avatar Picker ─── */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <div
                                                    onClick={() => avatarInputRef.current.click()}
                                                    style={{
                                                        width: '90px', height: '90px', borderRadius: '50%',
                                                        background: avatarPreview ? `url(${avatarPreview}) center/cover` : '#e5e7eb',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', border: '3px dashed #d1d5db',
                                                        position: 'relative', overflow: 'hidden', flexShrink: 0,
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                    title={t('landing.authAvatarHint')}
                                                >
                                                    {!avatarPreview && <Camera size={30} color="#9ca3af" />}
                                                    {avatarPreview && (
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="avatar-overlay">
                                                            <Camera size={22} color="white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{t('landing.authAvatarHint')}</span>
                                                <input
                                                    ref={avatarInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={e => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        setAvatarFile(file);
                                                        setAvatarPreview(URL.createObjectURL(file));
                                                    }}
                                                />
                                            </div>

                                            {/* ─── Name row ─── */}
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input
                                                    type="text"
                                                    placeholder={t('landing.phFirst')}
                                                    value={firstName}
                                                    onChange={e => setFirstName(e.target.value)}
                                                    required
                                                    style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder={t('landing.phLast')}
                                                    value={lastName}
                                                    onChange={e => setLastName(e.target.value)}
                                                    required
                                                    style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <input
                                        type="email"
                                        placeholder={t('landing.phEmail')}
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        style={{ padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                    />
                                    <input
                                        type="password"
                                        placeholder={t('landing.phPass')}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        style={{ padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                    />
                                    {!isLogin && (
                                        <input
                                            type="password"
                                            placeholder={t('landing.phConfirm')}
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            required
                                            style={{ padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                        />
                                    )}
                                    {isLogin && (
                                        <button
                                            type="button"
                                            onClick={handleForgotPassword}
                                            style={{
                                                alignSelf: 'flex-start',
                                                marginTop: '4px',
                                                padding: 0,
                                                border: 'none',
                                                background: 'none',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                color: '#0891b2',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                textUnderlineOffset: '3px',
                                            }}
                                        >
                                            {t('landing.forgot')}
                                        </button>
                                    )}
                                    <button type="submit" className="btn-teal" style={{ padding: '14px', width: '100%', fontSize: '1rem', marginTop: '8px' }}>
                                        {isLogin ? t('landing.authLoginBtn') : t('landing.authRegisterBtn')}
                                    </button>
                                    <div style={{ position: 'relative', textAlign: 'center', margin: '10px 0' }}>
                                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
                                        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '0 12px', color: '#9ca3af', fontSize: '0.8rem' }}>{t('landing.orContinue')}</span>
                                    </div>
                                    <button type="button" onClick={handleGoogleAuth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google" />
                                        Google
                                    </button>
                                </form>

                                <div style={{ marginTop: '32px', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem' }}>
                                    {isLogin ? (
                                        <>{t('landing.noAccount')} <span onClick={() => setIsLogin(false)} style={{ color: '#00bcd4', fontWeight: '700', cursor: 'pointer' }}>{t('landing.register')}</span></>
                                    ) : (
                                        <>{t('landing.hasAccount')} <span onClick={() => setIsLogin(true)} style={{ color: '#00bcd4', fontWeight: '700', cursor: 'pointer' }}>{t('landing.signInLink')}</span></>
                                    )}
                                </div>
                            </div>

                            {/* Info Column */}
                            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '40px', paddingTop: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '16px' }}>{t('landing.authInfoTitle')}</h3>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {[
                                            { title: t('landing.authBul1t'), info: t('landing.authBul1d'), icon: <CheckCircle2 size={22} color="#00bcd4" /> },
                                            { title: t('landing.authBul2t'), icon: <CheckCircle2 size={22} color="#00bcd4" /> },
                                            { title: t('landing.authBul3t'), icon: <CheckCircle2 size={22} color="#00bcd4" /> }
                                        ].map((item, i) => (
                                            <li key={i} style={{ display: 'flex', gap: '14px' }}>
                                                <div style={{ flexShrink: 0, marginTop: '2px' }}>{item.icon}</div>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{item.title}</div>
                                                    {item.info && <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>{item.info}</div>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '24px', borderRadius: '12px' }}>
                                    <p style={{ margin: 0, color: '#0f766e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                        <strong>{t('landing.authTipTitle')}</strong> {t('landing.authTipBody')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SELLER INFO MODAL */}
            {showSellerInfoModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: '#0f172a', width: '100%', maxWidth: '500px', borderRadius: '24px', border: '1px solid rgba(0,210,211,0.2)', padding: '40px', position: 'relative', textAlign: 'center' }}>
                        <button onClick={() => setShowSellerInfoModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                        <div style={{ background: 'rgba(0,210,211,0.1)', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#00d2d3' }}><TrendingUp size={40} /></div>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '16px', color: 'white' }}>{t('landing.sellerModalTitle')}</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '32px', fontSize: '1.1rem' }}>{t('landing.sellerModalSub')}</p>
                        
                        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00d2d3', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem', flexShrink: 0 }}>1</div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>{t('landing.sellerStep1')}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00d2d3', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem', flexShrink: 0 }}>2</div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>{t('landing.sellerStep2')}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00d2d3', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem', flexShrink: 0 }}>3</div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>{t('landing.sellerStep3')}</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                setShowSellerInfoModal(false);
                                if (!currentUser) setShowLoginPanel(true);
                                else navigate('/dashboard');
                            }} 
                            className="btn-teal" 
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem', border: 'none', cursor: 'pointer', borderRadius: '12px', fontWeight: '700' }}
                        >
                            {currentUser ? t('landing.sellerGoDash') : t('landing.sellerLogin')}
                        </button>
                    </div>
                </div>
            )}

            {/* Modal entrada: descarga escritorio (5 s, cierre automático) */}
            {showDesktopDownloadPromo && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="desktop-promo-title"
                    className="landing-desktop-promo-backdrop"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 5000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px 18px',
                        background: 'radial-gradient(ellipse 90% 70% at 50% 20%, rgba(15, 118, 110, 0.12) 0%, transparent 55%), radial-gradient(ellipse 80% 50% at 50% 100%, rgba(8, 145, 178, 0.08) 0%, transparent 45%), rgba(2, 6, 23, 0.86)',
                        backdropFilter: 'blur(18px) saturate(1.2)',
                        WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
                    }}
                >
                    <div
                        className="landing-desktop-promo-card"
                        style={{
                            width: '100%',
                            maxWidth: '420px',
                            position: 'relative',
                            borderRadius: '22px',
                            overflow: 'hidden',
                            background: 'linear-gradient(165deg, rgba(30, 41, 59, 0.55) 0%, rgba(15, 23, 42, 0.98) 42%, #0a0f18 100%)',
                            boxShadow: `
                                0 0 0 1px rgba(148, 163, 184, 0.14),
                                0 1px 0 rgba(255, 255, 255, 0.06) inset,
                                0 40px 80px -20px rgba(0, 0, 0, 0.65)
                            `,
                        }}
                    >
                        <div
                            aria-hidden
                            style={{
                                position: 'absolute',
                                inset: '-40% -20% auto -20%',
                                height: '120px',
                                background: 'radial-gradient(ellipse at 50% 0%, rgba(45, 212, 191, 0.14) 0%, transparent 70%)',
                                animation: 'landingDesktopPromoGlow 4s ease-in-out infinite',
                                pointerEvents: 'none',
                            }}
                        />
                        <div
                            className="landing-desktop-promo-accent-line"
                            style={{
                                height: '2px',
                                width: '100%',
                                transformOrigin: '50% 50%',
                                background: 'linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.15) 12%, #2dd4bf 42%, #5eead4 50%, #2dd4bf 58%, rgba(45, 212, 191, 0.15) 88%, transparent)',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowDesktopDownloadPromo(false)}
                            style={{
                                position: 'absolute',
                                top: '14px',
                                right: '14px',
                                zIndex: 2,
                                background: 'rgba(15, 23, 42, 0.55)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                width: '38px',
                                height: '38px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#e2e8f0';
                                e.currentTarget.style.borderColor = 'rgba(94, 234, 212, 0.35)';
                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.55)';
                            }}
                            aria-label={tDesktopPromo('desktopPromoClose')}
                        >
                            <X size={18} strokeWidth={2.25} />
                        </button>

                        <div style={{ padding: '30px 32px 32px', position: 'relative', zIndex: 1 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '16px',
                                    marginBottom: '26px',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                                    <img
                                        src="/logo2blanco.png"
                                        alt=""
                                        style={{ height: '30px', width: 'auto', opacity: 0.95, flexShrink: 0 }}
                                    />
                                    <span
                                        style={{
                                            display: 'block',
                                            width: '1px',
                                            height: '28px',
                                            background: 'linear-gradient(180deg, transparent, rgba(148,163,184,0.35), transparent)',
                                            flexShrink: 0,
                                        }}
                                        aria-hidden
                                    />
                                    <Monitor size={26} color="#5eead4" strokeWidth={1.75} style={{ flexShrink: 0, opacity: 0.88 }} aria-hidden />
                                </div>
                                <div
                                    title={tDesktopPromo('desktopPromoSub', { seconds: desktopPromoSecondsLeft })}
                                    style={{
                                        flexShrink: 0,
                                        minWidth: '52px',
                                        padding: '8px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(94, 234, 212, 0.22)',
                                        background: 'rgba(6, 78, 59, 0.22)',
                                        fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace',
                                        fontSize: '0.95rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.06em',
                                        color: '#5eead4',
                                        lineHeight: 1,
                                    }}
                                >
                                    {String(Math.max(0, desktopPromoSecondsLeft)).padStart(2, '0')}
                                </div>
                            </div>

                            <p
                                style={{
                                    margin: '0 0 10px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.28em',
                                    textTransform: 'uppercase',
                                    color: '#64748b',
                                }}
                            >
                                {tDesktopPromo('desktopPromoEyebrow')}
                            </p>
                            <h2
                                id="desktop-promo-title"
                                style={{
                                    margin: '0 0 16px',
                                    fontSize: 'clamp(1.42rem, 4.2vw, 1.72rem)',
                                    fontWeight: 650,
                                    letterSpacing: '-0.03em',
                                    lineHeight: 1.18,
                                    color: '#f8fafc',
                                }}
                            >
                                {tDesktopPromo('desktopPromoTitle')}
                            </h2>
                            <p
                                style={{
                                    margin: '0 0 28px',
                                    maxWidth: '34ch',
                                    fontSize: '0.9rem',
                                    lineHeight: 1.65,
                                    fontWeight: 500,
                                    color: '#94a3b8',
                                }}
                            >
                                {tDesktopPromo('desktopPromoSub', { seconds: desktopPromoSecondsLeft })}
                            </p>

                            <div
                                aria-hidden
                                style={{
                                    height: '1px',
                                    margin: '0 0 22px',
                                    background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.25) 20%, rgba(148,163,184,0.25) 80%, transparent)',
                                }}
                            />

                            <button
                                type="button"
                                className="landing-desktop-promo-cta"
                                onClick={() => {
                                    handleDesktopInstallerDownload();
                                }}
                                style={{
                                    width: '100%',
                                    padding: '15px 22px',
                                    fontSize: '0.94rem',
                                    fontWeight: 750,
                                    letterSpacing: '0.04em',
                                    borderRadius: '14px',
                                    border: 'none',
                                    cursor: desktopWinUrlReady ? 'pointer' : 'not-allowed',
                                    color: '#042f2e',
                                    background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 38%, #2dd4bf 72%, #5eead4 100%)',
                                    boxShadow: '0 10px 28px -6px rgba(13, 148, 136, 0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
                                    opacity: desktopWinUrlReady ? 1 : 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <span style={{ flex: 1, textAlign: 'center' }}>
                                    {tDesktopPromo('desktopPromoDownload')}
                                    {latestApp?.desktopVersionName ? (
                                        <span style={{ fontWeight: 650, opacity: 0.92 }}>
                                            {' '}
                                            · v{latestApp.desktopVersionName}
                                        </span>
                                    ) : null}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDesktopDownloadPromo(false)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: '14px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#64748b',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.04em',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
                            >
                                {tDesktopPromo('desktopPromoClose')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
