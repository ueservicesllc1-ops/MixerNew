import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ShoppingCart, Search, Music2, ArrowLeft, X, CheckCircle2, Play, Pause, Loader2, LogOut } from 'lucide-react';
import Footer from '../components/Footer';
import { HorizontalMixer } from '../components/HorizontalMixer';

const SongCard = ({ song, onPreview, onBuy, navigate }) => {
    const [realSellerName, setRealSellerName] = useState(song.sellerName || 'Vendedor Zion');

    useEffect(() => {
        if (!song.sellerName || song.sellerName === 'Vendedor Zion') {
            const fetchName = async () => {
                try {
                    const userSnap = await getDoc(doc(db, 'users', song.userId));
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const fullName = userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : userData.displayName;
                        if (fullName) setRealSellerName(fullName);
                    }
                } catch (e) { console.error("Error fetching seller name:", e); }
            };
            fetchName();
        } else {
            Promise.resolve().then(() => setRealSellerName(song.sellerName));
        }
    }, [song.sellerName, song.userId]);

    const previewUrl = song.tracks?.find(t => t.name === '__PreviewMix')?.previewUrl || 
                      song.tracks?.find(t => t.name === '__PreviewMix')?.url ||
                      song.tracks?.[0]?.previewUrl;

    return (
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer', height: '100%', position: 'relative' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ height: '140px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }} className="group">
                {song.coverUrl ? (
                    <img src={song.coverUrl} alt={song.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'filter 0.3s' }} className="song-cover" />
                ) : (
                    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                        <img src="/generic_cover.png" alt="Generic Cover" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)' }}>
                            <Music2 size={32} color="white" style={{ opacity: 0.5 }} />
                        </div>
                    </div>
                )}
                
                {/* Play Button Overlay */}
                {previewUrl && (
                    <div 
                        onClick={(e) => { e.stopPropagation(); onPreview(); }}
                        style={{ 
                            position: 'absolute', 
                            inset: 0, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            transition: 'all 0.3s',
                            opacity: 0
                        }} 
                        className="play-overlay"
                    >
                        <div style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '50%', 
                            background: '#00d2d3', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#000',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                        }}>
                            <Play size={20} fill="currentColor" style={{ marginLeft: '3px' }} />
                        </div>
                    </div>
                )}

                <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '800', backdropFilter: 'blur(4px)', zIndex: 5 }}>{song.tempo ? `${song.tempo} BPM` : 'BPM variable'}</div>
            </div>
            
            <style>{`
                .group:hover .song-cover { filter: brightness(0.4); }
                .group:hover .play-overlay { opacity: 1 !important; background: rgba(0,0,0,0.3) !important; }
            `}</style>

            <div style={{ padding: '12px' }}>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</h3>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
                <div
                    onClick={(e) => { e.stopPropagation(); navigate(`/seller/${song.userId}`); }}
                    style={{ color: '#00d2d3', fontSize: '0.7rem', marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }}
                >
                    {realSellerName}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff' }}>${song.price || '9.99'}</div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onBuy(); }}
                        style={{ background: '#00d2d3', border: 'none', color: '#000', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function Store() {
    const navigate = useNavigate();
    const [storeSongs, setStoreSongs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false); // Nuevo: Estado para dropdown de usuario

    // Nueva lógica de carrito
    const [cart, setCart] = useState([]);

    const [toast, setToast] = useState(null); // { message, type }
    
    // Preview Engine States (Like Landing)
    const [previewSong, setPreviewSong] = useState(null);
    const [previewTracks, setPreviewTracks] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewProgress, setPreviewProgress] = useState(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const previewEngineRef = React.useRef(null);

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

            // Filtrar solo tracks que no sean __PreviewMix para el mixer real o si solo hay Preview usar ese
            const validTracks = song.tracks?.filter(t => t.name !== '__PreviewMix') || [];
            
            // Si hay tracks reales, detectamos si son clips o completos.
            // Si NO hay tracks reales (solo __PreviewMix), entonces ES un clip (generado por el proxy).
            const isUsingPreviewMixOnly = validTracks.length === 0;
            const useClips = isUsingPreviewMixOnly || validTracks.some(t => t.previewUrl && t.previewUrl !== t.url);
            
            const rawTracks = (!isUsingPreviewMixOnly)
                ? validTracks.map(t => ({ id: t.id || Math.random().toString(), name: t.name || 'UNNAMED', url: (useClips ? t.previewUrl : t.url) || t.url }))
                : song.tracks?.filter(t => t.name === '__PreviewMix').map(t => ({ id: 'preview', name: 'DEMO CLIP', url: t.url || t.previewUrl }));

            const getProxyUrl = (url) => {
                if (!url) return '';
                if (url.startsWith('/') || url.includes('localhost')) return url;
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const baseProxy = isLocal ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';
                return `${baseProxy}/api/download?url=${encodeURIComponent(url)}`;
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
                } catch (e) { console.warn(`Failed track ${t.name}`, e); }
            }

            if (batch.length === 0) throw new Error("No tracks loaded");
            await audioEngine.addTracksBatch(batch);
            
            const startPos = useClips ? 0 : 20;
            await audioEngine.seek(startPos);
            await audioEngine.play();
            setIsPreviewPlaying(true);
            setPreviewLoading(false);

            audioEngine.onProgress = (p) => {
                const displayTime = useClips ? (20 + p) : p;
                setPreviewProgress(displayTime);
                if (displayTime >= 40) {
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
        setIsPreviewPlaying(false);
    };

    const togglePreviewPlayback = async () => {
        const engine = previewEngineRef.current;
        if (!engine) return;
        if (isPreviewPlaying) {
            await engine.pause();
            setIsPreviewPlaying(false);
        } else {
            await engine.play();
            setIsPreviewPlaying(true);
        }
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
        previewEngineRef.current?.setTrackPan(id, pan);
    };

    useEffect(() => {
        const savedCart = localStorage.getItem('zion_cart');
        if (savedCart) {
            try { setCart(JSON.parse(savedCart)); } catch { setCart([]); }
        }
    }, []);

    const addToCart = (song) => {
        setCart(prev => {
            if (prev.some(item => item.id === song.id)) return prev;
            const newCart = [...prev, { id: song.id, name: song.name, artist: song.artist, price: song.price || 9.99, coverUrl: song.coverUrl }];
            localStorage.setItem('zion_cart', JSON.stringify(newCart));
            return newCart;
        });

        // Mostrar notificación visual en lugar de alert
        setToast({ message: `"${song.name}" añadida al carrito`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
    };



    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });

        // Solo traer lo que es para venta. Filtramos en cliente para evitar problemas de índices incompletos
        const q = query(
            collection(db, 'songs'), 
            where('forSale', '==', true)
        );
        
        const unsubSongs = onSnapshot(q, (snap) => {
            const songs = [];
            snap.forEach(doc => {
                const data = doc.data();
                // Permitir 'active' o 'pending_review' (el usuario quiere verlas aunque estén en revisión)
                // Pero SOLO si es para venta (forSale ya está en la query)
                if (data.status === 'active' || data.status === 'pending_review' || data.status === 'pending') {
                    songs.push({ id: doc.id, ...data });
                }
            });
            
            // Ordenar por fecha: nuevos arriba
            const sorted = songs.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
            setStoreSongs(sorted);
        });

        return () => { unsubAuth(); unsubSongs(); };
    }, []);


    const filteredStore = storeSongs.filter(s =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>

            {/* NOTIFICACIÓN TIPO TOAST */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    background: '#1e293b', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#00d2d3'}`, color: 'white',
                    padding: '12px 24px', borderRadius: '50px', zIndex: 5000,
                    boxShadow: '0 10px 30px rgba(0,0,10,0.5)', display: 'flex', alignItems: 'center', gap: '12px',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: toast.type === 'error' ? '#ef4444' : '#00d2d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {toast.type === 'error' ? <X size={14} color="white" /> : <CheckCircle2 size={16} color="black" />}
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 50px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>

            <nav style={{
                padding: '15px 40px',
                background: '#0f172a',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '36px' }} />
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', borderRadius: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.85rem' }}
                    >
                        <ArrowLeft size={16} /> Volver al Inicio
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ position: 'relative' }} className="hide-mobile">
                        <input
                            type="text"
                            placeholder="Buscar en el marketplace..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 15px 10px 40px', borderRadius: '30px', width: '250px', fontSize: '0.9rem' }}
                        />
                        <Search size={16} style={{ position: 'absolute', top: '11px', left: '15px', color: '#64748b' }} />
                    </div>

                    <button
                        onClick={() => navigate('/checkout')}
                        style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', cursor: 'pointer' }}
                    >
                        <ShoppingCart size={18} />
                        {cart.length > 0 && (
                            <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#00d2d3', color: '#000', fontSize: '0.7rem', fontWeight: '900', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a' }}>
                                {cart.length}
                            </span>
                        )}
                    </button>

                    {currentUser && (
                        <div style={{ position: 'relative' }}>
                            <div
                                onClick={() => setShowDropdown(!showDropdown)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '5px 5px 5px 12px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#e2e8f0' }} className="hide-mobile">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#00d2d3,#9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.8rem' }}>
                                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                                </div>
                            </div>

                            {showDropdown && (
                                <div style={{ position: 'absolute', top: '45px', right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 2000 }}>
                                    <div
                                        onClick={() => navigate('/dashboard')}
                                        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.9rem', fontWeight: '600', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                                    >
                                        <Globe size={16} color="#94a3b8" /> Dashboard
                                    </div>
                                    <div
                                        onClick={() => auth.signOut()}
                                        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', fontWeight: '600' }}
                                    >
                                        <LogOut size={16} /> Cerrar Sesión
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            <header style={{ padding: '60px 40px', textAlign: 'center', background: 'radial-gradient(circle at center, rgba(0,210,211,0.1), transparent)' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '20px' }}>Pistas Premium Multitrack</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>Descubre y compra secuencias directamente de los creadores originales, listas para nuestro potente motor de audio.</p>
            </header>

            <style>{`
                .store-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 15px;
                    padding: 40px 0;
                }
                @media (max-width: 1600px) {
                    .store-grid { grid-template-columns: repeat(5, 1fr); }
                }
                @media (max-width: 1300px) {
                    .store-grid { grid-template-columns: repeat(4, 1fr); }
                }
                @media (max-width: 1000px) {
                    .store-grid { grid-template-columns: repeat(3, 1fr); }
                }
                @media (max-width: 700px) {
                    .store-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 500px) {
                    .store-grid { grid-template-columns: repeat(1, 1fr); }
                }
            `}</style>

            <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                {searchQuery ? (
                    <div style={{ padding: '40px' }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '30px' }}>Resultados de búsqueda</h2>
                        <div className="store-grid">
                            {filteredStore.map(song => (
                                <SongCard 
                                    key={song.id} 
                                    song={song} 
                                    onPreview={() => openPreview(song)}
                                    onBuy={() => addToCart(song)} 
                                    navigate={navigate} 
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ paddingBottom: '80px' }}>
                        <div style={{ marginTop: '40px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0', marginBottom: '10px' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: '900' }}>Catálogo de Canciones</h2>
                                {storeSongs.length > 0 && (
                                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{storeSongs.length} temas disponibles</span>
                                )}
                            </div>
                            
                            <div className="store-grid">
                                {storeSongs.length > 0 ? (
                                    storeSongs.map(song => (
                                        <div key={song.id}>
                                            <SongCard 
                                                song={song} 
                                                onPreview={() => openPreview(song)}
                                                onBuy={() => addToCart(song)} 
                                                navigate={navigate} 
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: '1/-1', padding: '100px 0', textAlign: 'center', color: '#64748b' }}>
                                        <Music2 size={48} style={{ margin: '0 auto 15px', opacity: 0.2 }} />
                                        <p>No hay canciones disponibles en este momento.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PREVIEW MODAL (Multitrack Mixer) */}
            {previewSong && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
                    <div style={{ background: '#020617', width: '100%', maxWidth: '700px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.7)', color: 'white' }}>

                        <div style={{ padding: '14px 25px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,210,211,0.3)' }}>
                                    <img src={previewSong.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                            <button onClick={closePreview} style={{ background: '#1e293b', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}><X size={16} /></button>
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
            )}

            <Footer />
        </div>
    );
}



