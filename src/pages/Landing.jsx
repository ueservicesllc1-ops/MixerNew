import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, ShoppingCart, Play, CheckCircle2, Menu, X, ArrowRight, User, KeyRound, Timer, Layers, Music2, Globe, Camera } from 'lucide-react';
import Footer from '../components/Footer';

export default function Landing() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
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

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);

        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            unsubscribe();
        };
    }, []);

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
                    createdAt: serverTimestamp()
                }, { merge: true });
            }
            setShowLoginPanel(false);
        } catch (error) {
            console.error("Auth error:", error);
            setErrorMsg(error.message);
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
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, overflowX: 'hidden', color: 'white', fontFamily: '"Inter", sans-serif' }}>

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
                        <img src="/zion-logo-white.png" alt="Zion Stage" style={{ height: '36px' }} />
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
                        <ShoppingCart size={19} color="#94a3b8" style={{ cursor: 'pointer' }} />
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <header className="hero-gradient" style={{ paddingTop: '160px', paddingBottom: '100px', textAlign: 'center', padding: '160px 20px 100px' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <h1 className="text-gradient" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: '900', lineHeight: '1.1', margin: '0 0 24px 0', letterSpacing: '-1px' }}>
                        Pistas para adoración<br />hechas con excelencia
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: '#94a3b8', lineHeight: '1.6', maxWidth: '700px', margin: '0 auto 40px' }}>
                        Zion Stage es la plataforma definitiva para líderes de alabanza. Sube tus propias pistas, sincroniza con tu equipo y lleva tu sonido al siguiente nivel con nuestro motor de audio nativo.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        {!currentUser ? (
                            <button className="btn-teal" style={{ padding: '16px 40px', fontSize: '1.1rem' }} onClick={() => { setIsLogin(false); setShowLoginPanel(true); }}>
                                Comienza gratis ahora
                            </button>
                        ) : (
                            <button className="btn-teal" style={{ padding: '16px 40px', fontSize: '1.1rem' }} onClick={() => navigate('/dashboard')}>
                                Ir a la Nube Principal
                            </button>
                        )}
                        <button className="btn-ghost" style={{ padding: '16px 40px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Play size={18} fill="currentColor" /> Ver cómo funciona
                        </button>
                    </div>
                </div>

                {/* APP MOCKUP PREVIEW */}
                <div style={{ marginTop: '80px', position: 'relative', maxWidth: '1100px', margin: '80px auto 0' }}>
                    <div style={{
                        borderRadius: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: '#0e1421'
                    }}>
                        <img
                            src="/hero_mockup_mixer_1772898901088.png"
                            alt="Mixer App Mockup"
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    </div>
                    {/* Floating accents */}
                    <div style={{ position: 'absolute', top: '-30px', left: '-30px', width: '100px', height: '100px', background: 'rgba(0,188,212,0.3)', filter: 'blur(40px)', zIndex: -1 }}></div>
                    <div style={{ position: 'absolute', bottom: '-40px', right: '-30px', width: '150px', height: '150px', background: 'rgba(155,89,182,0.2)', filter: 'blur(50px)', zIndex: -1 }}></div>
                </div>
            </header>

            {/* FEATURED TRACKS CAROUSEL SECTION */}
            <section style={{ padding: '100px 60px', backgroundColor: '#0f172a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px', maxWidth: '1300px', margin: '0 auto 48px' }}>
                    <div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 12px' }}>Pistas Top de la Comunidad</h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Descubre lo que otros líderes de alabanza están usando.</p>
                    </div>
                    <span style={{ color: '#00d2d3', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Ver todas <ArrowRight size={18} />
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', maxWidth: '1300px', margin: '0 auto' }}>
                    {[
                        { title: 'RADIANT LIGHT', artist: 'Zion Stage Music', badge: 'MASTER', img: '/worship_album_cover_1_1772899057302.png' },
                        { title: 'Firm Foundation', artist: 'Cody Carnes', badge: 'PREMIUM', img: 'https://picsum.photos/300/300?random=11' },
                        { title: 'House Of The Lord', artist: 'Phil Wickham', badge: 'MASTER', img: 'https://picsum.photos/300/300?random=12' },
                        { title: 'Gratitude', artist: 'Brandon Lake', badge: 'COMMUNITY', img: 'https://picsum.photos/300/300?random=13' },
                        { title: 'I Believe', artist: 'Phil Wickham', badge: 'MASTER', img: 'https://picsum.photos/300/300?random=14' }
                    ].map((track, i) => (
                        <div key={i} className="card-premium">
                            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                                <img src={track.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={track.title} />
                                <div style={{ position: 'absolute', top: '10px', right: '10px', background: track.badge === 'MASTER' ? '#00d2d3' : (track.badge === 'PREMIUM' ? '#f59e0b' : '#94a3b8'), color: 'white', fontSize: '0.65rem', fontWeight: '800', padding: '4px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                                    {track.badge}
                                </div>
                            </div>
                            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: '700' }}>{track.title}</h4>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{track.artist}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* INFO SECTION: BEYOND THE TRACKS */}
            <section style={{ backgroundColor: '#020617', padding: '100px 60px' }}>
                <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', gap: '60px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 500px' }}>
                        <img
                            src="/worship_community_banner_1772898920206.png"
                            alt="Worship Community"
                            style={{ width: '100%', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}
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
            </section>

            {/* TOP 10 RANKING SECTION */}
            <section style={{ padding: '100px 60px', backgroundColor: '#0f172a' }}>
                <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center', fontSize: '2.5rem', fontWeight: '800', marginBottom: '60px' }}>Top 10 de este Mes</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '32px' }}>
                            {[
                                { rank: 1, song: 'Washed', artist: 'Elevation Rhythm' },
                                { rank: 2, song: 'Gratitude', artist: 'Brandon Lake' },
                                { rank: 3, song: 'Joy Out Of Nowhere', artist: 'Seu Worship' },
                                { rank: 4, song: 'Hold On To Me', artist: 'Lauren Daigle' },
                                { rank: 5, song: 'Firm Foundation', artist: 'Cody Carnes' }
                            ].map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: i === 0 ? '#00d2d3' : '#334155', width: '40px' }}>{s.rank}</span>
                                    <div style={{ marginLeft: '12px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{s.song}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.artist}</div>
                                    </div>
                                    <button className="btn-ghost" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '0.8rem' }}>Ver Pistas</button>
                                </div>
                            ))}
                        </div>
                        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '32px' }}>
                            {[
                                { rank: 6, song: 'I Believe', artist: 'Phil Wickham' },
                                { rank: 7, song: 'Holy Forever', artist: 'Chris Tomlin' },
                                { rank: 8, song: 'Trust In God', artist: 'Elevation Worship' },
                                { rank: 9, song: 'Always', artist: 'Kristian Stanfill' },
                                { rank: 10, song: 'Praise', artist: 'Elevation Worship' }
                            ].map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#334155', width: '40px' }}>{s.rank}</span>
                                    <div style={{ marginLeft: '12px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{s.song}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.artist}</div>
                                    </div>
                                    <button className="btn-ghost" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '0.8rem' }}>Ver Pistas</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

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
            </section>

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
            </section>

            {/* FOOTER */}
            <Footer />

            {/* FULLSCREEN AUTH OVERLAY (Improved Design) */}
            {showLoginPanel && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: '#f9fafb', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', color: '#111827' }}>
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
                                    <img src="/zion-logo-blue.png" alt="Zion Stage" style={{ height: '40px' }} />
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
            )}
        </div>
    );
}
