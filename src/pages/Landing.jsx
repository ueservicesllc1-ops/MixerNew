import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, ShoppingCart, Play, CheckCircle2, Menu, X, ArrowRight, User, KeyRound, Timer, Layers, Music2, Globe, Camera, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import Footer from '../components/Footer';
import { HorizontalMixer } from '../components/HorizontalMixer';

export default function Landing() {
    const navigate = useNavigate();
    const [showHeroPopup, setShowHeroPopup] = useState(false);
    const [showSellerInfoModal, setShowSellerInfoModal] = useState(false);
    const [email, setEmail] = useState('');

    useEffect(() => {
        const showTimer = setTimeout(() => {
            setShowHeroPopup(true);
        }, 1000);

        const hideTimer = setTimeout(() => {
            setShowHeroPopup(false);
        }, 7000); // 1s wait + 6s duration

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, []);
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
    const [latestApp, setLatestApp] = useState(null);

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
        setToast(`"${song.name}" añadida al carrito`);
        setTimeout(() => setToast(null), 3000);
    };

    const handlePwaInstall = async () => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (standalone) {
            setToast('La app ya esta instalada en este equipo.');
            setTimeout(() => setToast(null), 3000);
            return;
        }
        localStorage.setItem('mixer_pwa_install_flow', '1');
        navigate('/multitrack?installPwa=1');
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);

        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
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
                    const proxy = 'https://mixernew-production.up.railway.app';
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
            try {
                const q = query(collection(db, 'app_versions'), orderBy('createdAt', 'desc'), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setLatestApp(snap.docs[0].data());
                }
            } catch (err) {
                console.error("Error fetching latest app:", err);
            }
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
            setErrorMsg("Por favor, ingresa tu correo electrónico primero.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setErrorMsg('');
            alert("Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.");
        } catch (error) {
            console.error("Reset Password Error:", error);
            setErrorMsg("Error al enviar el correo: " + error.message);
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
            `}</style>

            {/* TOP BAR PROMO */}
            <div style={{ backgroundColor: '#1e293b', padding: '8px 0', fontSize: '0.75rem', textAlign: 'center', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>NUEVA ACTUALIZACIÓN: MOTOR DE AUDIO NATIVO Y WAVEFORMS MEJORADOS — </span>
                <span style={{ color: '#00d2d3', marginLeft: '5px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>VER MÁS</span>
            </div>

            {/* GLASS NAVBAR */}
            <nav className={scrolled ? 'glass-nav' : ''} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: scrolled ? '12px 60px' : '20px 60px',
                transition: 'all 0.3s ease',
                position: 'fixed',
                top: scrolled ? 0 : '35px',
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
                            { label: 'Canciones', path: '/store' },
                            { label: 'Software', path: '/software' },
                            { label: 'Recursos', path: '/recursos' },
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
                        {latestApp && (
                            <span
                                onClick={() => window.open(latestApp.downloadUrl, window.Capacitor?.isNativePlatform?.() ? '_system' : '_blank')}
                                style={{ cursor: 'pointer', transition: 'color 0.2s', textDecoration: 'none', color: '#3ddc84', fontWeight: 'bold' }}
                                onMouseEnter={e => e.target.style.color = '#fff'}
                                onMouseLeave={e => e.target.style.color = '#3ddc84'}
                            >
                                ↓ Android
                            </span>
                        )}
                        <span
                            onClick={handlePwaInstall}
                            style={{ cursor: 'pointer', transition: 'color 0.2s', textDecoration: 'none', color: '#60a5fa', fontWeight: 'bold' }}
                            onMouseEnter={e => e.target.style.color = '#fff'}
                            onMouseLeave={e => e.target.style.color = '#60a5fa'}
                        >
                            ↓ Windows
                        </span>
                        <span
                            onClick={() => document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth' })}
                            style={{ cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s', textDecoration: 'none' }}
                            onMouseEnter={e => e.target.style.color = '#f1c40f'}
                            onMouseLeave={e => e.target.style.color = '#94a3b8'}
                        >
                            Precios
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {!currentUser ? (
                        <>
                            <span onClick={() => setShowLoginPanel(true)} style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: '#ccc' }}>Iniciar sesión</span>
                            <button className="btn-teal" onClick={() => { setIsLogin(false); setShowLoginPanel(true); }}>
                                Únete gratis
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
                                            { label: 'Nube principal', icon: <Globe size={18} />, onClick: () => navigate('/dashboard') },
                                            { label: 'Tienda de Pistas', icon: <ShoppingCart size={18} />, onClick: () => navigate('/store') },
                                            { label: 'Lista de deseos', icon: <CheckCircle2 size={18} />, onClick: () => navigate('/store') },
                                            { label: 'Ajustes', icon: <Menu size={18} />, onClick: () => navigate('/dashboard') },
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
                                            <span style={{ color: '#94a3b8' }}><ArrowRight size={18} /></span> Finalizar la sesión
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
                            Pistas para adoración<br />hechas con excelencia
                        </h1>
                        <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: '1.6', maxWidth: '450px', margin: '0 0 32px' }}>
                            Zion Stage es la plataforma definitiva para líderes de alabanza. Multitracks o Secuencias de alta calidad, sincroniza con tu equipo y lleva tu sonido al siguiente nivel con nuestro motor de audio nativo.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                            {!currentUser ? (
                                <button className="btn-teal" style={{ padding: '14px 32px', fontSize: '0.95rem' }} onClick={() => { setIsLogin(false); setShowLoginPanel(true); }}>
                                    Comienza gratis ahora
                                </button>
                            ) : (
                                <button className="btn-teal" style={{ padding: '14px 32px', fontSize: '0.95rem' }} onClick={() => navigate('/dashboard')}>
                                    Ir a la Nube Principal
                                </button>
                            )}
                            <button className="btn-ghost" style={{ padding: '14px 32px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Play size={18} fill="currentColor" /> Ver cómo funciona
                            </button>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {latestApp && (
                                <button
                                    onClick={() => window.open(latestApp.downloadUrl, window.Capacitor?.isNativePlatform?.() ? '_system' : '_blank')}
                                    style={{ padding: '12px 22px', fontSize: '0.82rem', background: 'linear-gradient(135deg,#3ddc84,#2a9d5c)', border: 'none', color: 'white', borderRadius: '50px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 15px rgba(61,220,132,0.35)' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24A9.822 9.822 0 0 0 12 8c-1.53 0-2.97.38-4.47 1L5.65 5.67a.644.644 0 0 0-.84-.22c-.3.16-.42.54-.26.85l1.84 3.18C3.93 10.91 2.5 12.97 2.5 15.25c0 .22.02.44.05.65h18.9c.03-.21.05-.43.05-.65 0-2.28-1.43-4.34-3.9-5.77zM9 13.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>
                                    Descargar Android {latestApp.versionName}
                                </button>
                            )}
                            {!window.matchMedia('(display-mode: standalone)').matches && (
                                <button
                                    onClick={handlePwaInstall}
                                    style={{ padding: '12px 22px', fontSize: '0.82rem', background: 'linear-gradient(135deg,#0078d4,#005a9e)', border: 'none', color: 'white', borderRadius: '50px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 15px rgba(0,120,212,0.35)' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                                    Instalar Windows (PWA)
                                </button>
                            )}
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
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 12px' }}>Pistas en Venta</h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Lleva tu servicio al siguiente nivel con nuestras multipistas.</p>
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
                            ENTRAR A LA TIENDA
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
                        <div style={{ color: '#00d2d3', fontWeight: '800', fontSize: '0.9rem', marginBottom: '16px', letterSpacing: '2px' }}>COMUNIDAD DE CREADORES</div>
                        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: '900', color: 'white', lineHeight: '1.2', marginBottom: '20px' }}>Hazte vendedor y comparte tu talento hoy mismo</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px' }}>Únete a cientos de músicos que ya están monetizando sus secuencias y multitracks en Zion Stage.</p>
                    </div>
                    <div style={{ flex: '0 0 auto' }}>
                        <button 
                            onClick={() => setShowSellerInfoModal(true)} 
                            className="btn-teal" 
                            style={{ padding: '18px 48px', fontSize: '1.1rem', boxShadow: '0 20px 40px rgba(0,210,211,0.2)' }}
                        >
                            Hazte vendedor
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
                        <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '32px', lineHeight: '1.2' }}>Más que simples pistas de audio.</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {[
                                { title: 'Motor Nativo de Alto Rendimiento', info: 'Reproducción sin latencia y procesamiento en tiempo real directo en tu hardware.', icon: <CheckCircle2 size={24} color="#00d2d3" /> },
                                { title: 'Sube tu Propia Biblioteca Cloud', info: 'Personaliza tu mezcla. Sube tus WAVs, mézclalos en el dashboard y llévalos a cualquier lugar.', icon: <CheckCircle2 size={24} color="#00d2d3" /> },
                                { title: 'Letras y Cifrados Integrados', info: 'Visualiza letras y acordes perfectamente sincronizados mientras mezclas tus pistas en vivo.', icon: <CheckCircle2 size={24} color="#00d2d3" /> },
                                { title: 'Sincronización Multiplataforma', info: 'Edita tu setlist en la oficina y ensaya en el teléfono. Todo en perfecta sincronía.', icon: <CheckCircle2 size={24} color="#00d2d3" /> }
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
                    <h2 style={{ textAlign: 'center', fontSize: '2.5rem', fontWeight: '800', marginBottom: '60px' }}>Top 10 de este Mes</h2>
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
                                        Ver Pistas
                                    </button>
                                </div>
                            ))}
                            {songsForSale.length === 0 && <p style={{ color: '#64748b', textAlign: 'center' }}>Cargando canciones...</p>}
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
                                        Ver Pistas
                                    </button>
                                </div>
                            ))}
                            {songsForSale.length <= 5 && songsForSale.length > 0 && <p style={{ color: '#64748b', textAlign: 'center', marginTop: '20px' }}>Más pistas próximamente...</p>}
                        </div>
                    </div>
                </div>
            </section >

            {/* PRICING SECTION */}
            <section id="precios" style={{ padding: '100px 60px', backgroundColor: '#020617' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                        <h2 style={{ fontSize: '3rem', fontWeight: '900', margin: '0 0 16px' }}>Planes diseñados para tu equipo</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', margin: '0 0 30px' }}>
                            Comienza gratis y mejora según tus necesidades de almacenamiento o acceso a la biblioteca global.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '30px', display: 'flex', gap: '5px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <button onClick={() => setIsAnnual(false)} style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: !isAnnual ? '#00d2d3' : 'transparent', color: !isAnnual ? '#000' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>Mensual</button>
                                <button onClick={() => setIsAnnual(true)} style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: isAnnual ? '#00d2d3' : 'transparent', color: isAnnual ? '#000' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>Anual (-30%)</button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                        {/* ESTANDAR */}
                        <div style={{ backgroundColor: '#0f172a', padding: '40px', borderRadius: '24px', border: '1px solid rgba(0,210,211,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#00d2d3' }}>
                                <Globe size={24} />
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Estándar</h3>
                            </div>
                            <p style={{ color: '#94a3b8', marginBottom: '30px', minHeight: '48px' }}>
                                Almacenamiento seguro en la nube para tus pistas personales. Todo privado.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {[
                                    { name: 'Básico', gb: 2, price: 4.99, annual: 41.92, originalAnnual: 59.88 },
                                    { name: 'Estándar', gb: 5, price: 6.99, annual: 58.72, originalAnnual: 83.88 },
                                    { name: 'Plus', gb: 10, price: 9.99, annual: 83.92, originalAnnual: 119.88 }
                                ].map((plan, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{plan.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{plan.gb} GB Storage</div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                            {isAnnual && (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'line-through', marginBottom: '-2px' }}>
                                                    ${plan.originalAnnual}
                                                </span>
                                            )}
                                            <div>
                                                <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>${isAnnual ? plan.annual : plan.price}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}> /{isAnnual ? 'año' : 'mes'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => { setIsLogin(false); setShowLoginPanel(true); }} className="btn-teal" style={{ width: '100%', marginTop: '30px', padding: '16px', fontSize: '1.1rem' }}>
                                Empezar
                            </button>
                        </div>

                        {/* VIP */}
                        <div style={{ backgroundColor: '#0f172a', padding: '40px', borderRadius: '24px', border: '1px solid rgba(241,196,15,0.3)', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f1c40f', color: '#000', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '1px' }}>
                                MÁS POPULAR
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#f1c40f' }}>
                                <KeyRound size={24} />
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Premium VIP</h3>
                            </div>
                            <p style={{ color: '#94a3b8', marginBottom: '30px', minHeight: '48px' }}>
                                Todo lo de Estándar + <strong>Acceso total a la biblioteca global</strong> de canciones de la comunidad.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {[
                                    { name: 'Básico VIP', gb: 2, price: 7.99, annual: 67.12, originalAnnual: 95.88 },
                                    { name: 'Estándar VIP', gb: 5, price: 9.99, annual: 83.92, originalAnnual: 119.88 },
                                    { name: 'Plus VIP', gb: 10, price: 12.99, annual: 109.12, originalAnnual: 155.88 }
                                ].map((plan, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(241,196,15,0.05)', borderRadius: '12px', border: '1px solid rgba(241,196,15,0.1)' }}>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#f1c40f' }}>{plan.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(241,196,15,0.7)' }}>{plan.gb} GB Storage</div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                            {isAnnual && (
                                                <span style={{ fontSize: '0.8rem', color: 'rgba(241,196,15,0.5)', textDecoration: 'line-through', marginBottom: '-2px' }}>
                                                    ${plan.originalAnnual}
                                                </span>
                                            )}
                                            <div>
                                                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f1c40f' }}>${isAnnual ? plan.annual : plan.price}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}> /{isAnnual ? 'año' : 'mes'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => { setIsLogin(false); setShowLoginPanel(true); }} style={{ width: '100%', marginTop: '30px', padding: '16px', fontSize: '1.1rem', backgroundColor: '#f1c40f', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                                Elegir VIP
                            </button>
                        </div>
                    </div>
                </div>
            </section >

            {/* PRE-FOOTER / PARTNERS FEATURE */}
            <section style={{ padding: '100px 40px', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ color: '#00d2d3', fontWeight: '800', fontSize: '0.9rem', marginBottom: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}>EL ESTÁNDAR DE LA INDUSTRIA</div>
                            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: '900', color: 'white', lineHeight: '1.1', marginBottom: '24px' }}>
                                Un ecosistema diseñado para servir.
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '32px' }}>
                                Nuestra misión es simplificar tu domingo. Importa tus propios tracks, gestiona tus setlists en la nube y mezcla en vivo con la potencia del motor nativo más avanzado del mercado.
                            </p>
                            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem' }}>Cloud</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Sincronización Total</div>
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem' }}>Native</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Audio Engine v2.0</div>
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem' }}>Multi</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>iOS, Android & Web</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#1e293b', borderRadius: '32px', padding: '40px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px' }}>Estandares Profesionales</h3>
                                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '30px' }}>Zion Stage está construido sobre las tecnologías que prefieren los profesionales.</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    {['Multi-Track Ready', 'Cloud Sync', 'Low Latency', 'Auto Mixing'].map((p, i) => (
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
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>PREVIEW MODE</span>
                                            <span style={{ width: '3px', height: '3px', background: '#334155', borderRadius: '50%' }}></span>
                                            <span style={{ fontSize: '0.7rem', color: '#00d2d3', fontWeight: '800' }}>20 SECONDS</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={closePreview} style={{ background: '#1e293b', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.target.style.background = '#ef4444'} onMouseLeave={e => e.target.style.background = '#1e293b'}><X size={16} /></button>
                            </div>

                            <div style={{ padding: '20px 25px' }}>
                                {previewLoading ? (
                                    <div style={{ textAlign: 'center', padding: '50px 0' }}>
                                        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,210,211,0.1)', borderTopColor: '#00d2d3', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
                                        <p style={{ color: '#00d2d3', fontSize: '0.9rem', fontWeight: '900', letterSpacing: '1px' }}>INITIALIZING MIXER...</p>
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
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.5px' }}>PLAYBACK (20s-40s)</span>
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
                                                <ShoppingCart size={16} /> ADD TO CART
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
                                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>{isLogin ? '¡Bienvenido de nuevo!' : 'Crea tu cuenta gratis'}</h1>
                                    <p style={{ color: '#6b7280' }}>Únete a la comunidad de líderes de alabanza.</p>
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
                                                    title="Agregar foto de perfil (opcional)"
                                                >
                                                    {!avatarPreview && <Camera size={30} color="#9ca3af" />}
                                                    {avatarPreview && (
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="avatar-overlay">
                                                            <Camera size={22} color="white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Foto de perfil <em>(opcional)</em></span>
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
                                                    placeholder="Nombre"
                                                    value={firstName}
                                                    onChange={e => setFirstName(e.target.value)}
                                                    required
                                                    style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Apellido"
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
                                        placeholder="Correo electrónico"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        style={{ padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Contraseña"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        style={{ padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                    />
                                    {!isLogin && (
                                        <input
                                            type="password"
                                            placeholder="Confirmar Contraseña"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            required
                                            style={{ padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                                        />
                                    )}
                                    <button type="submit" className="btn-teal" style={{ padding: '14px', width: '100%', fontSize: '1rem', marginTop: '8px' }}>
                                        {isLogin ? 'Entrar ahora' : 'Registrarme'}
                                    </button>

                                    {isLogin && (
                                        <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                                            <span 
                                                onClick={handleForgotPassword} 
                                                style={{ fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                ¿Olvidaste tu contraseña?
                                            </span>
                                        </div>
                                    )}
                                    <div style={{ position: 'relative', textAlign: 'center', margin: '10px 0' }}>
                                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
                                        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '0 12px', color: '#9ca3af', fontSize: '0.8rem' }}>O CONTINÚA CON</span>
                                    </div>
                                    <button type="button" onClick={handleGoogleAuth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google" />
                                        Google
                                    </button>
                                </form>

                                <div style={{ marginTop: '32px', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem' }}>
                                    {isLogin ? (
                                        <>¿No tienes una cuenta? <span onClick={() => setIsLogin(false)} style={{ color: '#00bcd4', fontWeight: '700', cursor: 'pointer' }}>Regístrate</span></>
                                    ) : (
                                        <>¿Ya tienes cuenta? <span onClick={() => setIsLogin(true)} style={{ color: '#00bcd4', fontWeight: '700', cursor: 'pointer' }}>Inicia sesión</span></>
                                    )}
                                </div>
                            </div>

                            {/* Info Column */}
                            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '40px', paddingTop: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '16px' }}>Todo lo que necesitas en un solo lugar.</h3>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {[
                                            { title: 'Gestión de Canciones Cloud', info: 'Accede a tus multipistas desde cualquier dispositivo.', icon: <CheckCircle2 size={22} color="#00bcd4" /> },
                                            { title: 'App para Móvil y Web', icon: <CheckCircle2 size={22} color="#00bcd4" /> },
                                            { title: 'Letras y Cifrados Integrados', icon: <CheckCircle2 size={22} color="#00bcd4" /> }
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
                                        <strong>¿Sabías que?</strong> Miles de líderes de alabanza ya usan Zion Stage para simplificar sus servicios de domingo. ¡Únete a la revolución!
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
                        <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '16px', color: 'white' }}>Hazte Vendedor</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '32px', fontSize: '1.1rem' }}>Genera ingresos compartiendo tu talento con la comunidad de Zion Stage.</p>
                        
                        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00d2d3', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem', flexShrink: 0 }}>1</div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}><strong>Inicia Sesión</strong> o regístrate en la plataforma.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00d2d3', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem', flexShrink: 0 }}>2</div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>Ve a tu <strong>Dashboard</strong> principal.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00d2d3', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem', flexShrink: 0 }}>3</div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>Haz clic en el botón <strong>"Hacerte Vendedor"</strong> y completa tus datos.</p>
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
                            {currentUser ? 'Ir al Dashboard' : 'Iniciar Sesión'}
                        </button>
                    </div>
                </div>
            )}
            {/* HERO POPUP SELLERS */}
            {showHeroPopup && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', width: '100%', maxWidth: '850px', borderRadius: '32px', border: '1px solid rgba(0,210,211,0.3)', overflow: 'hidden', position: 'relative', boxShadow: '0 50px 100px rgba(0,0,0,0.5)' }}>
                        <button onClick={() => setShowHeroPopup(false)} style={{ position: 'absolute', top: '30px', right: '30px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><X size={24} /></button>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 450px', padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ background: 'rgba(0,210,211,0.1)', color: '#00d2d3', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', alignSelf: 'flex-start', marginBottom: '20px', letterSpacing: '1px' }}>OPORTUNIDAD EXCLUSIVA</div>
                                <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '900', color: 'white', lineHeight: '1.1', marginBottom: '24px' }}>Monetiza tu <span style={{ color: '#00d2d3' }}>Talento Musical</span></h2>
                                <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '40px' }}>Únete a la comunidad de vendedores de Zion Stage y empieza a generar ingresos compartiendo tus secuencias y multitracks con el mundo.</p>
                                
                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    <button 
                                        onClick={() => {
                                            setShowHeroPopup(false);
                                            setShowSellerInfoModal(true);
                                        }} 
                                        className="btn-teal" 
                                        style={{ padding: '16px 32px', fontSize: '1rem', fontWeight: '800', borderRadius: '16px', border: 'none', cursor: 'pointer' }}
                                    >
                                        Ver Pasos para Vender
                                    </button>
                                    <button 
                                        onClick={() => setShowHeroPopup(false)} 
                                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '16px 32px', fontSize: '1rem', fontWeight: '800', borderRadius: '16px', cursor: 'pointer' }}
                                    >
                                        Quizás luego
                                    </button>
                                </div>
                            </div>
                             <div style={{ flex: '1 1 300px', background: 'rgba(0,210,211,0.03)', position: 'relative', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                 <TrendingUp size={220} color="#00d2d3" opacity={0.05} style={{ position: 'absolute' }} />
                                 <div style={{ position: 'relative', textAlign: 'center', padding: '40px' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: '900', color: '#00d2d3', lineHeight: '1.1', marginBottom: '10px' }}>GENERA</div>
                                    <div style={{ color: 'white', fontWeight: '800', fontSize: '1.3rem', letterSpacing: '1px' }}>INGRESOS EXTRA</div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '15px', maxWidth: '200px', margin: '15px auto 0' }}>Únete a la mayor red de creadores de secuencias y multitracks.</div>
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
