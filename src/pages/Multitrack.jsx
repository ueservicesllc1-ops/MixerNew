import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { audioEngine } from '../AudioEngine'
import { Mixer } from '../components/Mixer'
import WaveformCanvas from '../components/WaveformCanvas'
import { Play, Pause, Square, SkipBack, SkipForward, Settings, Menu, RefreshCw, Trash2, LogIn, LogOut } from 'lucide-react'
import { db, auth, GoogleAuthProvider, signInWithPopup, signOut } from '../firebase'
import { collection, addDoc, getDocs, onSnapshot, query, where, serverTimestamp, doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { LocalFileManager } from '../LocalFileManager'

export default function Multitrack() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Setlist States
    const [isSetlistMenuOpen, setIsSetlistMenuOpen] = useState(false);
    const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useState(false);
    const [setlists, setSetlists] = useState([]);
    const [activeSetlist, setActiveSetlist] = useState(null);
    const [isCreatingSetlist, setIsCreatingSetlist] = useState(false);
    const [newSetlistName, setNewSetlistName] = useState('');
    const [librarySongs, setLibrarySongs] = useState([]);
    const [globalSongs, setGlobalSongs] = useState([]);
    const [libraryTab, setLibraryTab] = useState('mine'); // 'mine' | 'global'

    // Download States
    const [downloadProgress, setDownloadProgress] = useState({ songId: null, text: '' });
    // Active loaded song
    const [activeSongId, setActiveSongId] = useState(null);
    const [isLoadingSong, setIsLoadingSong] = useState(false);
    // Pre-load cache: Map<songId, Map<trackName, AudioBuffer>>
    const preloadCache = useRef(new Map());
    const [preloadStatus, setPreloadStatus] = useState({}); // { [songId]: 'loading' | 'ready' }

    useEffect(() => {
        // Track User Auth and load their library
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                // Fetch this user's library songs
                const q = query(collection(db, 'songs'), where('userId', '==', user.uid));
                const unsubSongs = onSnapshot(q, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    setLibrarySongs(songs);
                });
                // Also load ALL songs (Global/VIP tab) — no userId filter
                const qGlobal = query(collection(db, 'songs'));
                const unsubGlobal = onSnapshot(qGlobal, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    setGlobalSongs(songs);
                });
                return () => { unsubSongs(); unsubGlobal(); };
            } else {
                setLibrarySongs([]);
            }
        });

        // Inicializar canales limpios pero conectados reales (Sin audio falso por ahora)
        const initCore = async () => {
            console.log("Inicializando Audio Engine y WebAudio API...");

            const emptyTracks = [
                { id: '1', name: 'Master' },
                { id: '2', name: 'Canal 1' },
                { id: '3', name: 'Canal 2' },
                { id: '4', name: 'Canal 3' },
            ];

            setTracks(emptyTracks);
            audioEngine.onProgress = (t) => setProgress(t);
            setLoading(false);
        };
        initCore();

        // Escuchar cambios reales en Firestore para la colección setlists
        const q = query(collection(db, 'setlists'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((d) => {
                list.push({ id: d.id, ...d.data() });
            });
            setSetlists(list);
            // Sync the active setlist object when Firestore updates it
            setActiveSetlist(prev => {
                if (!prev) return prev;
                const updated = list.find(s => s.id === prev.id);
                return updated || prev;
            });
        }, (error) => {
            console.error("Error cargando setlists (revisa reglas de Firestore):", error);
        });

        return () => {
            unsubscribe();
            unsubAuth();
        };
    }, []);

    const handleCreateSetlist = async () => {
        if (!newSetlistName.trim()) return;

        try {
            await addDoc(collection(db, 'setlists'), {
                name: newSetlistName,
                createdAt: serverTimestamp(),
                songs: []
            });
            setNewSetlistName('');
            setIsCreatingSetlist(false);
        } catch (error) {
            console.error("Error creando setlist:", error);
            alert("No se pudo crear. Asegúrate de tener permisos (Reglas de Firestore).");
        }
    };

    const handleSelectSetlist = (list) => {
        setActiveSetlist(list);
        setIsSetlistMenuOpen(false);
        // Start preloading all songs in background (Prime-style)
        preloadSetlistSongs(list.songs || []);
    };

    // Silently decode every song in the setlist into RAM
    const preloadSetlistSongs = async (songs) => {
        await audioEngine.init();
        for (const song of songs) {
            if (preloadCache.current.has(song.id)) continue; // already cached
            setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));
            try {
                const trackBuffers = new Map();
                const tracksData = song.tracks || [];
                for (const tr of tracksData) {
                    let arrayBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                    if (!arrayBuf) {
                        const res = await fetch(`http://localhost:3001/download?url=${encodeURIComponent(tr.url)}`);
                        if (!res.ok) continue;
                        arrayBuf = await res.arrayBuffer();
                        await LocalFileManager.saveTrackLocal(song.id, tr.name, arrayBuf);
                    }
                    const audioBuf = await audioEngine.ctx.decodeAudioData(arrayBuf.slice(0));
                    trackBuffers.set(tr.name, audioBuf);
                }
                preloadCache.current.set(song.id, trackBuffers);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
                console.log(`⚡ [PRELOAD] "${song.name}" lista en RAM.`);
            } catch (e) {
                console.warn(`[PRELOAD] Fallo pre-cargando "${song.name}":`, e);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
            }
        }
    };

    const handleDeleteSetlist = async (id, name, e) => {
        e.stopPropagation(); // Avoid triggering selection
        if (window.confirm(`¿Seguro que deseas ELIMINAR permanentemente el setlist "${name}"? Esta acción no se puede deshacer.`)) {
            try {
                await deleteDoc(doc(db, 'setlists', id));
                if (activeSetlist && activeSetlist.id === id) {
                    setActiveSetlist(null);
                }
            } catch (error) {
                console.error("Error borrando setlist:", error);
                alert("No se pudo borrar el setlist. Verifica tus permisos de Firebase.");
            }
        }
    };

    const handleDownloadAndAdd = async (song) => {
        if (!activeSetlist) {
            return alert("Por favor, selecciona un setlist primero antes de añadir canciones.");
        }

        setDownloadProgress({ songId: song.id, text: 'Iniciando descarga B2...' });

        try {
            const tracks = song.tracks || [];

            // Loop tracks to download to IndexedDB cache
            for (let i = 0; i < tracks.length; i++) {
                const tr = tracks[i];
                setDownloadProgress({ songId: song.id, text: `Bajando pista ${i + 1}/${tracks.length}: ${tr.name}` });

                // Fetch the binary stream from our proxy (which hooks to B2)
                const res = await fetch(`http://localhost:3001/download?url=${encodeURIComponent(tr.url)}`);
                if (!res.ok) throw new Error(`Fallo red B2 en track ${tr.name}`);

                const arrayBuf = await res.arrayBuffer();
                await LocalFileManager.saveTrackLocal(song.id, tr.name, arrayBuf);
            }

            setDownloadProgress({ songId: song.id, text: 'Guardando en Setlist...' });

            // Update Firestore Setlist array
            await updateDoc(doc(db, 'setlists', activeSetlist.id), {
                songs: arrayUnion(song)
            });

            setIsLibraryMenuOpen(false);
        } catch (error) {
            console.error(error);
            alert("Hubo un error descargando la canción. Verifica la consola.");
        } finally {
            setDownloadProgress({ songId: null, text: '' });
        }
    };

    const handleLoadSong = async (song) => {
        if (isLoadingSong) return;
        setIsLoadingSong(true);
        setActiveSongId(song.id);

        try {
            await audioEngine.init();
            // Auto-stop: reset transport before loading new song
            audioEngine.clearTracks();
            setIsPlaying(false);
            setProgress(0);

            const newTracks = [];

            // ⚡ CHECK RAM CACHE FIRST (Prime-style instant switch)
            const cachedBuffers = preloadCache.current.get(song.id);
            if (cachedBuffers && cachedBuffers.size > 0) {
                console.log(`⚡ [INSTANT] "${song.name}" desde RAM — sin espera.`);
                for (const [trackName, audioBuf] of cachedBuffers.entries()) {
                    const trackId = `${song.id}_${trackName}`;
                    audioEngine.addTrack(trackId, audioBuf);
                    newTracks.push({ id: trackId, name: trackName });
                }
            } else {
                // FALLBACK: decode from IndexedDB or B2 (first time)
                console.log(`[LOAD] Cache miss, decodificando "${song.name}"...`);
                const tracksData = song.tracks || [];
                const trackBuffers = new Map();

                for (const tr of tracksData) {
                    const trackId = `${song.id}_${tr.name}`;
                    let arrayBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                    if (!arrayBuf) {
                        const res = await fetch(`http://localhost:3001/download?url=${encodeURIComponent(tr.url)}`);
                        if (!res.ok) throw new Error(`Fallo red: ${tr.name}`);
                        arrayBuf = await res.arrayBuffer();
                        await LocalFileManager.saveTrackLocal(song.id, tr.name, arrayBuf);
                    }
                    const audioBuf = await audioEngine.ctx.decodeAudioData(arrayBuf.slice(0));
                    trackBuffers.set(tr.name, audioBuf);
                    audioEngine.addTrack(trackId, audioBuf);
                    newTracks.push({ id: trackId, name: tr.name });
                }
                // Store in RAM for next switch
                preloadCache.current.set(song.id, trackBuffers);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
            }

            setTracks(newTracks);
            console.log(`✅ "${song.name}" lista con ${newTracks.length} pistas.`);
        } catch (err) {
            console.error('[LOAD] Error:', err);
            alert(`Error cargando "${song.name}": ${err.message}`);
            setActiveSongId(null);
        } finally {
            setIsLoadingSong(false);
        }
    };


    const handleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login falló:", error);
            alert("Error al iniciar sesión: " + error.message);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/'); // Regresar a inicio
        } catch (error) {
            console.error("Logout falló:", error);
        }
    };

    const handlePlay = async () => {
        await audioEngine.init();
        if (isPlaying) {
            // Pause
            audioEngine.pause();
            setIsPlaying(false);
        } else {
            // Play or Resume
            audioEngine.play();
            setIsPlaying(true);
        }
    };

    const handleStop = () => {
        audioEngine.stop();
        setIsPlaying(false);
        setProgress(0);
    };

    const handleRewind = () => {
        audioEngine.stop();
        setIsPlaying(false);
        setProgress(0);
    };

    const [masterVolume, setMasterVolume] = useState(1);
    const handleMasterVolume = (e) => {
        const val = parseFloat(e.target.value);
        setMasterVolume(val);
        audioEngine.masterGain.gain.setTargetAtTime(val, audioEngine.ctx.currentTime, 0.015);
    };

    // Format time (e.g. 02:03)
    const formatTime = (secs) => {
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="multitrack-layout">

            {/* PRIME TOP TRANSPORT HEADER */}
            <div className="transport-bar">
                <button className="transport-btn" onClick={() => navigate('/dashboard')} title="Menu">
                    <Menu size={20} />
                </button>

                {/* MASTER VOLUME SLIDER */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--transport-blue)', borderRadius: '8px', padding: '5px 12px', minWidth: '170px' }}>
                    <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>MASTER</span>
                    <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={masterVolume}
                        onChange={handleMasterVolume}
                        style={{ flex: 1, accentColor: 'white', cursor: 'pointer', height: '4px' }}
                    />
                    <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '700', minWidth: '30px' }}>{Math.round(masterVolume * 100)}%</span>
                </div>

                <div className="controls-group">
                    <button className="transport-btn" title="Rebobinar" onClick={handleRewind}><SkipBack size={20} /></button>
                    <button
                        className={`transport-btn ${isPlaying ? 'active' : 'play'}`}
                        onClick={handlePlay}
                        title={isPlaying ? 'Pausar' : 'Reproducir'}
                        style={{ background: isPlaying ? '#f39c12' : undefined }}
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button className="transport-btn stop" onClick={handleStop} title="Detener"><Square size={20} /></button>
                    <button className="transport-btn" title="Siguiente"><SkipForward size={20} /></button>
                </div>

                <div className="audio-info">
                    <span>{formatTime(progress)} / 04:00</span>
                    <span style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px' }}>128 BPM</span>
                    <span style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px' }}>C</span>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {!currentUser ? (
                        <button
                            onClick={handleLogin}
                            style={{ background: '#00d2d3', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <LogIn size={16} /> Entrar
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>{currentUser.displayName || currentUser.email.split('@')[0]}</span>
                            <button onClick={handleLogout} className="transport-btn" title="Cerrar Sesión"><LogOut size={18} /></button>
                        </div>
                    )}
                    <button className="transport-btn"><RefreshCw size={20} /></button>
                    <button className="transport-btn"><Settings size={20} /></button>
                </div>
            </div>

            {/* WAVEFORM OVERVIEW */}
            <div className="waveform-section">
                <WaveformCanvas tracks={tracks} progress={progress} />
            </div>

            {/* PRIME BOTTOM GRID MIXER AND RIGHT PANEL */}
            <div className="main-content">
                {loading ? (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                        <div className="loader"></div>
                    </div>
                ) : (
                    <>
                        <Mixer tracks={tracks} />

                        <div className="sidebar">
                            <div className="setlist-panel">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{activeSetlist ? activeSetlist.name : 'Ning\u00fan Setlist Activo'}</h3>
                                    <button
                                        className="btn-setlist"
                                        onClick={() => setIsSetlistMenuOpen(true)}
                                    >
                                        Setlists
                                    </button>
                                </div>

                                {!activeSetlist ? (
                                    <div style={{ padding: '10px', color: '#888', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
                                        Abre el men\u00fa Setlists para crear tu primer bloque de canciones.
                                    </div>
                                ) : (
                                    <>
                                        {/* Songs list */}
                                        {(activeSetlist.songs || []).length === 0 ? (
                                            <div style={{ padding: '10px', color: '#aaa', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
                                                Sin canciones. Dale + Añadir Canción.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '200px', marginBottom: '10px' }}>
                                                {(activeSetlist.songs || []).map((song, idx) => {
                                                    const isActive = activeSongId === song.id;
                                                    const isThisLoading = isLoadingSong && isActive;
                                                    const pStatus = preloadStatus[song.id]; // 'loading' | 'ready' | undefined
                                                    return (
                                                        <div
                                                            key={song.id || idx}
                                                            onClick={() => handleLoadSong(song)}
                                                            style={{
                                                                padding: '8px 10px',
                                                                background: isActive ? '#e0f7fa' : '#f0fdff',
                                                                borderLeft: `3px solid ${isActive ? '#00bcd4' : '#00d2d3'}`,
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                boxShadow: isActive ? '0 2px 8px rgba(0,210,211,0.3)' : 'none',
                                                                opacity: isLoadingSong && !isActive ? 0.5 : 1
                                                            }}
                                                        >
                                                            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span>{song.name}</span>
                                                                <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                                    {/* Preload badge */}
                                                                    {pStatus === 'loading' && <span title="Pre-cargando en RAM..." style={{ fontSize: '0.7rem', color: '#f39c12' }}>⏳</span>}
                                                                    {pStatus === 'ready' && !isActive && <span title="Lista en RAM — cambio instantáneo" style={{ fontSize: '0.7rem', color: '#2ecc71' }}>⚡</span>}
                                                                    {isThisLoading && <span style={{ color: '#00bcd4', fontSize: '0.72rem' }}>Cargando...</span>}
                                                                    {isActive && !isThisLoading && <span style={{ color: '#2ecc71', fontSize: '0.72rem' }}>▶ Activa</span>}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                                                {song.artist && `${song.artist} • `}
                                                                {song.key && `${song.key} • `}
                                                                {song.tempo && `${song.tempo} BPM`}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <button onClick={() => setIsLibraryMenuOpen(true)} style={{ width: '100%', marginTop: '4px', padding: '10px', background: '#e0e0e0', color: '#333', border: '1px dashed #aaa', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            + Añadir Canción
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="pad-panel">
                                <h3 style={{ margin: '0 0 15px 0', fontSize: '0.9rem' }}>Pad Player</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                                    {['Db', 'Eb', 'Gb', 'Ab', 'Bb'].map(k => (
                                        <button key={k} style={{ padding: '20px 0', background: '#00d2d3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>{k}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* SLIDE-OUT SETLIST MENU */}
            <div className={`drawer-overlay ${isSetlistMenuOpen || isLibraryMenuOpen ? 'open' : ''}`} onClick={() => { setIsSetlistMenuOpen(false); setIsLibraryMenuOpen(false); }}></div>

            {/* 1. SETLISTS DRAWER */}
            <div className={`setlist-drawer ${isSetlistMenuOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Mis Setlists</h2>
                    <button onClick={() => setIsSetlistMenuOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>&times;</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>
                        Crea y organiza tus listas. Estas se guardan en vivo en Firestore.
                    </p>

                    {isCreatingSetlist ? (
                        <div style={{ marginBottom: '20px', background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
                            <input
                                type="text"
                                placeholder="Nombre (Ej: Domingo AM)"
                                value={newSetlistName}
                                onChange={e => setNewSetlistName(e.target.value)}
                                style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button className="play-btn" style={{ flex: 1, background: '#2ecc71', padding: '8px' }} onClick={handleCreateSetlist}>✔ Guardar</button>
                                <button className="transport-btn stop" style={{ width: 'auto', padding: '8px 15px' }} onClick={() => setIsCreatingSetlist(false)}>Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <button className="play-btn" style={{ width: '100%', marginBottom: '20px', background: '#2ecc71' }} onClick={() => setIsCreatingSetlist(true)}>
                            + Crear Nuevo Setlist
                        </button>
                    )}

                    <div className="setlist-items">
                        {setlists.length === 0 && !isCreatingSetlist && (
                            <div style={{ color: '#aaa', textAlign: 'center', fontSize: '0.85rem' }}>No hay Setlists disponibles.</div>
                        )}
                        {setlists.map(list => (
                            <div key={list.id} className="setlist-item-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: (activeSetlist && activeSetlist.id === list.id) ? '#e0f7fa' : '#fafafa', borderColor: (activeSetlist && activeSetlist.id === list.id) ? '#00bcd4' : '#eee' }} onClick={() => handleSelectSetlist(list)}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{list.name}</h4>
                                    <span style={{ fontSize: '0.8rem', color: '#999' }}>{list.songs ? list.songs.length : 0} Canciones</span>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteSetlist(list.id, list.name, e)}
                                    title="Eliminar Setlist"
                                    style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer', padding: '5px', display: 'flex' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. LIBRARY DRAWER (Separated from Setlists) */}
            <div className={`library-drawer ${isLibraryMenuOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Pistas en la Nube</h2>
                    <button onClick={() => setIsLibraryMenuOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>&times;</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    {/* TABS */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: '#f0f0f0', padding: '4px', borderRadius: '8px' }}>
                        <button
                            onClick={() => setLibraryTab('mine')}
                            style={{ flex: 1, padding: '9px', background: libraryTab === 'mine' ? '#00d2d3' : 'transparent', color: libraryTab === 'mine' ? 'white' : '#555', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                        >
                            🎵 Mi Librería
                        </button>
                        <button
                            onClick={() => setLibraryTab('global')}
                            style={{ flex: 1, padding: '9px', background: libraryTab === 'global' ? '#9b59b6' : 'transparent', color: libraryTab === 'global' ? 'white' : '#555', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                        >
                            🌐 Global (VIP)
                        </button>
                    </div>

                    <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: '8px', border: '1px dashed #ccc', padding: '10px', overflowY: 'auto' }}>
                        {!currentUser ? (
                            <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '0.9rem' }}>
                                Debes iniciar sesión para ver la librería.
                            </div>
                        ) : (() => {
                            const songs = libraryTab === 'mine' ? librarySongs : globalSongs;
                            if (songs.length === 0) return (
                                <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '0.9rem' }}>
                                    {libraryTab === 'mine'
                                        ? 'No tienes canciones. Sube algunas desde el Dashboard.'
                                        : 'No hay canciones globales todavía.'}
                                </div>
                            );
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {songs.map(song => {
                                        const isDownloading = downloadProgress.songId === song.id;
                                        const isOtherUser = song.userId !== currentUser?.uid;
                                        return (
                                            <div key={song.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'white', border: `1px solid ${isOtherUser ? '#e8d5f5' : '#eee'}`, borderRadius: '8px' }}>
                                                <div>
                                                    <h4 style={{ margin: '0 0 3px 0', color: '#333' }}>{song.name}</h4>
                                                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                                        {isOtherUser && song.uploadedBy && <span style={{ color: '#9b59b6', fontWeight: 'bold', marginRight: '6px' }}>👤 {song.uploadedBy}</span>}
                                                        {song.artist && `${song.artist} • `}
                                                        {song.key && `${song.key} • `}
                                                        {song.tempo && `${song.tempo} BPM`}
                                                    </div>
                                                    {isDownloading && (
                                                        <div style={{ color: '#00d2d3', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '4px' }}>
                                                            {downloadProgress.text}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    style={{ background: isDownloading ? '#f39c12' : '#2ecc71', color: 'white', border: 'none', padding: '8px 10px', borderRadius: '4px', cursor: isDownloading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                                    title="Añadir a Setlist y Guardar Local"
                                                    onClick={() => !isDownloading && handleDownloadAndAdd(song)}
                                                    disabled={isDownloading}
                                                >
                                                    {isDownloading ? '⏳ Descargando...' : '➕ Añadir'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

        </div>
    )
}
