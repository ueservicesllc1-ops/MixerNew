import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { audioEngine } from '../AudioEngine'
import { Mixer } from '../components/Mixer'
import WaveformCanvas from '../components/WaveformCanvas'
import { Play, Pause, Square, SkipBack, SkipForward, Settings, Menu, RefreshCw, Trash2, LogIn, LogOut, Moon, Sun, Headphones, Type, Drum, X, Check, Power, GripVertical, ListMusic, Library as LibraryIcon } from 'lucide-react'
import { db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../firebase'
import { collection, addDoc, getDocs, onSnapshot, query, where, serverTimestamp, doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { LocalFileManager } from '../LocalFileManager'
import { padEngine } from '../PadEngine'
import { ScreenOrientation } from '@capacitor/screen-orientation';
import {
    DndContext,
    closestCenter,
    TouchSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

export default function Multitrack() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem('mixer_proxyUrl') || 'https://mixernew-production.up.railway.app');

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
    // Bottom tab panel
    const [activeTab, setActiveTab] = useState(null); // null | 'lyrics' | 'chords' | 'video' | 'settings'

    // Login Details
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginIsRegister, setLoginIsRegister] = useState(false);
    const [loginError, setLoginError] = useState('');

    // ── SETTINGS PANEL STATES ─────────────────────────────────────────────
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mixer_darkMode') === 'true');
    const [panMode, setPanMode] = useState(() => localStorage.getItem('mixer_panMode') || 'mono'); // 'L' | 'R' | 'mono'
    const [appFontSize, setAppFontSize] = useState(() => parseInt(localStorage.getItem('mixer_appFontSize') || '14'));
    const [dynamicClick, setDynamicClick] = useState(false);

    // ── PADS SYSTEM STATES ───────────────────────────────────────────────
    const [padActive, setPadActive] = useState(false);
    const [padKey, setPadKey] = useState('C');
    const [padPitch, setPadPitch] = useState(0);
    const [padVolume, setPadVolume] = useState(0.8);
    const [padMute, setPadMute] = useState(false);
    const [padSolo, setPadSolo] = useState(false); // (El modo Solo sería más complejo de integrar contra el otro motor, por ahora sirve visual)

    // ── DND SENSORS ──────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 300, tolerance: 8 }
        })
    );

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !activeSetlist) return;

        const oldIndex = activeSetlist.songs.findIndex(s => s.id === active.id);
        const newIndex = activeSetlist.songs.findIndex(s => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newSongs = arrayMove(activeSetlist.songs, oldIndex, newIndex);

            // Optimistic update
            const updatedSetlist = { ...activeSetlist, songs: newSongs };
            setActiveSetlist(updatedSetlist);

            // Persist to Firebase
            try {
                await updateDoc(doc(db, 'setlists', activeSetlist.id), {
                    songs: newSongs
                });
            } catch (err) {
                console.error("Error al guardar orden en Firebase:", err);
            }
        }
    };

    // Sincronizar encendido y tecla con el motor de audio
    useEffect(() => {
        if (padActive) {
            padEngine.start(padKey);
        } else {
            padEngine.stop();
        }
    }, [padActive, padKey]);

    // Sincronizar el Mute y Volumen del Fader con el motor de audio
    useEffect(() => {
        if (padMute) {
            padEngine.setVolume(0);
        } else {
            padEngine.setVolume(padVolume);
        }
    }, [padVolume, padMute]);

    // Sincronizar el Pitch (Octava)
    useEffect(() => {
        padEngine.setPitch(padPitch);
    }, [padPitch]);

    // ── DYNAMIC CLICK ENGINE ─────────────────────────────────────────────
    const clickCtxRef = useRef(null);
    const clickSchedulerRef = useRef(null);
    const clickNextBeatRef = useRef(0);
    const clickBeatCountRef = useRef(0);

    const stopDynamicClick = useCallback(() => {
        if (clickSchedulerRef.current) {
            clearInterval(clickSchedulerRef.current);
            clickSchedulerRef.current = null;
        }
    }, []);

    const startDynamicClick = useCallback((bpm) => {
        stopDynamicClick();
        if (!bpm || bpm <= 0) return;

        // Create (or reuse) a dedicated AudioContext for the click
        if (!clickCtxRef.current || clickCtxRef.current.state === 'closed') {
            clickCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = clickCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const secondsPerBeat = 60.0 / bpm;
        const scheduleAhead = 0.1; // schedule 100ms ahead
        const lookahead = 25; // call scheduler every 25ms

        clickNextBeatRef.current = ctx.currentTime + 0.05;
        clickBeatCountRef.current = 0;

        const scheduleClick = () => {
            while (clickNextBeatRef.current < ctx.currentTime + scheduleAhead) {
                const isAccent = clickBeatCountRef.current % 4 === 0;

                // High-click oscillator (wood block feel)
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(isAccent ? 1200 : 800, clickNextBeatRef.current);
                gainNode.gain.setValueAtTime(isAccent ? 0.7 : 0.4, clickNextBeatRef.current);
                gainNode.gain.exponentialRampToValueAtTime(0.001, clickNextBeatRef.current + 0.06);

                osc.start(clickNextBeatRef.current);
                osc.stop(clickNextBeatRef.current + 0.08);

                clickNextBeatRef.current += secondsPerBeat;
                clickBeatCountRef.current++;
            }
        };

        scheduleClick();
        clickSchedulerRef.current = setInterval(scheduleClick, lookahead);
    }, [stopDynamicClick]);

    // Click dinámico: solo suena cuando la canción está reproduciendo (Play)
    // El switch solo "arma" el modo — el click real respeta el transport.
    // NOTA: No usamos `activeSong` aquí porque se declara más abajo (TDZ).
    //       Derivamos el tempo directamente desde los arrays disponibles.
    useEffect(() => {
        const song = librarySongs.find(s => s.id === activeSongId)
            || globalSongs.find(s => s.id === activeSongId);
        const tempo = song?.tempo ? parseFloat(song.tempo) : null;

        if (dynamicClick && isPlaying && tempo) {
            startDynamicClick(tempo);
        } else {
            stopDynamicClick();
        }
        return () => stopDynamicClick();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicClick, isPlaying, activeSongId]);

    // Apply darkMode to body
    useEffect(() => {
        document.body.classList.toggle('dark-mode', darkMode);
        localStorage.setItem('mixer_darkMode', darkMode);
    }, [darkMode]);

    // Apply appFontSize to root
    useEffect(() => {
        document.documentElement.style.fontSize = `${appFontSize}px`;
        localStorage.setItem('mixer_appFontSize', appFontSize);
    }, [appFontSize]);

    // Apply pan mode to audio engine
    useEffect(() => {
        if (!audioEngine?.masterGain?.context) return;
        const ctx = audioEngine.masterGain.context;
        // Create/reuse a stereoPanel node
        if (!audioEngine._pannerNode) {
            try {
                audioEngine._pannerNode = ctx.createStereoPanner();
                audioEngine.masterGain.disconnect();
                audioEngine.masterGain.connect(audioEngine._pannerNode);
                audioEngine._pannerNode.connect(ctx.destination);
            } catch (e) { console.warn('StereoPanner not supported', e); }
        }
        if (audioEngine._pannerNode) {
            const panVal = panMode === 'L' ? -1 : panMode === 'R' ? 1 : 0;
            audioEngine._pannerNode.pan.setTargetAtTime(panVal, ctx.currentTime, 0.05);
        }
        localStorage.setItem('mixer_panMode', panMode);
    }, [panMode]);
    // ── Smart LRU Preload Cache ──────────────────────────────────────────────
    // Detects device RAM and sets how many decoded songs to keep in cache.
    // navigator.deviceMemory is privacy-capped at 8 even on 32/64GB machines.
    // We supplement with performance.memory (Chromium only) to detect real available heap.
    const deviceRAM = navigator.deviceMemory || 4;
    const estimatedRAM = (() => {
        // performance.memory.jsHeapSizeLimit is the real JS heap ceiling in bytes (Chromium only)
        if (performance?.memory?.jsHeapSizeLimit) {
            const heapGB = performance.memory.jsHeapSizeLimit / (1024 ** 3);
            // A 32GB machine typically gets a ~4GB JS heap limit
            if (heapGB > 3) return 32;  // high-end desktop / workstation
            if (heapGB > 1.5) return 16;  // mid desktop / MBP
            if (heapGB > 0.7) return 8;   // standard laptop
        }
        return deviceRAM; // fallback to navigator.deviceMemory
    })();

    // Song limits per estimated RAM:
    //   ≤4 GB  → 2 songs  (phones)
    //   ≤8 GB  → 4 songs  (tablets / old laptops)
    //   ≤16 GB → 8 songs  (laptop / iPad Pro)
    //   > 16 GB→ 14 songs (desktop / workstation)
    const MAX_DECODED_SONGS = estimatedRAM <= 4 ? 2
        : estimatedRAM <= 8 ? 4
            : estimatedRAM <= 16 ? 8
                : 14;


    // preloadCache: Map<songId, Map<trackName, {audioBuf, rawBuf}>>
    const preloadCache = useRef(new Map());
    // LRU order: most-recent last
    const lruOrder = useRef([]);
    const [preloadStatus, setPreloadStatus] = useState({});
    const hasAutoLoaded = useRef(false);

    // Evict the oldest decoded song from RAM when cache is full.
    // NEVER evicts the currently active song (it's playing!).
    const evictOldestIfNeeded = () => {
        while (preloadCache.current.size >= MAX_DECODED_SONGS) {
            // Find the oldest entry that is NOT the active song
            const candidate = lruOrder.current.find(id => id !== activeSongId && preloadCache.current.has(id));
            if (!candidate) break; // All cached songs are active — don't evict anything
            lruOrder.current = lruOrder.current.filter(id => id !== candidate);
            preloadCache.current.delete(candidate);
            setPreloadStatus(prev => { const n = { ...prev }; delete n[candidate]; return n; });
            console.log(`[LRU] Evicted from RAM (limit ${MAX_DECODED_SONGS} on ~${estimatedRAM}GB). Cache size: ${preloadCache.current.size}`);
        }
    };

    // Touch a song in LRU order (move it to most-recent)
    const touchLRU = (songId) => {
        lruOrder.current = lruOrder.current.filter(id => id !== songId);
        lruOrder.current.push(songId);
    };

    // Auto-load last active setlist on mount once setlists are fetched
    useEffect(() => {
        if (!hasAutoLoaded.current && setlists.length > 0 && !activeSetlist) {
            const lastId = localStorage.getItem('mixer_lastSetlistId');
            if (lastId) {
                const found = setlists.find(s => s.id === lastId);
                if (found) {
                    console.log("Auto-loading last setlist:", found.name);
                    setActiveSetlist(found);
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                    preloadSetlistSongs(found.songs || []);
                }
            }
            hasAutoLoaded.current = true;
        }
    }, [setlists, activeSetlist]);

    // Auto-load a pending song from the Dashboard if present
    useEffect(() => {
        const pendingSongId = localStorage.getItem('mixer_pendingSongId');
        if (pendingSongId) {
            const songToLoad = librarySongs.find(s => s.id === pendingSongId)
                || globalSongs.find(s => s.id === pendingSongId)
                || activeSetlist?.songs?.find(s => s.id === pendingSongId);

            if (songToLoad) {
                console.log("Auto-loading pending song:", songToLoad.name);
                localStorage.removeItem('mixer_pendingSongId');
                handleLoadSong(songToLoad);
            }
        }
    }, [librarySongs, globalSongs, activeSetlist]);

    useEffect(() => {
        // Track User Auth and load their library
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);

            if (user) {
                // ── Songs: solo las del usuario autenticado ──────────────────
                const q = query(collection(db, 'songs'), where('userId', '==', user.uid));
                const unsubSongs = onSnapshot(q, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    setLibrarySongs(songs);
                });

                // Global/VIP tab — todas las canciones (sin filtro de dueño, solo lectura de metadata)
                const qGlobal = query(collection(db, 'songs'));
                const unsubGlobal = onSnapshot(qGlobal, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    setGlobalSongs(songs);
                });

                // ── Setlists: SOLO los del usuario autenticado ───────────────
                // SECURITY FIX: filtrar por userId para que nadie vea setlists ajenos
                const qSetlists = query(
                    collection(db, 'setlists'),
                    where('userId', '==', user.uid)
                );
                const unsubSetlists = onSnapshot(qSetlists, (snapshot) => {
                    const list = [];
                    snapshot.forEach((d) => {
                        list.push({ id: d.id, ...d.data() });
                    });
                    setSetlists(list);
                    // Sync el setlist activo si Firestore lo actualizó
                    setActiveSetlist(prev => {
                        if (!prev) return prev;
                        const updated = list.find(s => s.id === prev.id);
                        return updated || prev;
                    });
                }, (error) => {
                    console.error('Error cargando setlists:', error);
                });

                return () => { unsubSongs(); unsubGlobal(); unsubSetlists(); };
            } else {
                // Usuario sin sesión → limpiar todo
                setLibrarySongs([]);
                setGlobalSongs([]);
                setSetlists([]);
                setActiveSetlist(null);
            }
        });

        // Inicializar canales vacíos del engine
        const initCore = async () => {
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

        return () => {
            unsubAuth();
        };
    }, []);

    const handleCreateSetlist = async () => {
        if (!newSetlistName.trim()) return;
        if (!currentUser) {
            alert('Debes iniciar sesión para crear un setlist.');
            return;
        }

        try {
            await addDoc(collection(db, 'setlists'), {
                name: newSetlistName,
                userId: currentUser.uid,          // ← REQUERIDO para seguridad
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
        localStorage.setItem('mixer_lastSetlistId', list.id);
        // Start preloading all songs in background (Prime-style)
        preloadSetlistSongs(list.songs || []);
    };

    // Auto-preload songs when active setlist changes or gets new songs
    useEffect(() => {
        if (activeSetlist && activeSetlist.songs) {
            preloadSetlistSongs(activeSetlist.songs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSetlist?.songs]);


    // Silently decode songs into RAM with LRU eviction
    const preloadSetlistSongs = async (songs) => {
        for (const song of songs) {
            if (preloadCache.current.has(song.id)) {
                touchLRU(song.id); // Already cached — refresh recency
                continue;
            }

            // Evict oldest song if we're at the RAM limit
            evictOldestIfNeeded();

            setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));
            try {
                const trackBuffers = new Map();
                const tracksData = song.tracks || [];
                for (const tr of tracksData) {
                    if (!tr.url || tr.url === 'undefined') {
                        console.warn(`[PRELOAD] Saltando pista ${tr.name} — URL inválida`);
                        continue;
                    }
                    let rawBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                    if (!rawBuf) {
                        const res = await fetch(`${proxyUrl}/download?url=${encodeURIComponent(tr.url)}`);
                        if (!res.ok) {
                            console.error(`[PRELOAD] Error descarga: ${tr.name}`, res.status);
                            continue;
                        }
                        rawBuf = await res.arrayBuffer();
                        await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                    }
                    const audioBuf = await audioEngine.ctx.decodeAudioData(rawBuf.slice(0));
                    trackBuffers.set(tr.name, { audioBuf, rawBuf });
                }
                preloadCache.current.set(song.id, trackBuffers);
                touchLRU(song.id);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
                console.log(`[PRELOAD] "${song.name}" in RAM. Cache: ${preloadCache.current.size}/${MAX_DECODED_SONGS}`);
            } catch (e) {
                console.warn(`[PRELOAD] Failed "${song.name}":`, e);
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
                if (!tr.url || tr.url === 'undefined') {
                    console.warn(`[DOWNLOAD] Saltando pista ${tr.name} porque no tiene URL válida.`);
                    continue;
                }
                const res = await fetch(`${proxyUrl}/download?url=${encodeURIComponent(tr.url)}`);

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const msg = errorData.error || `Error ${res.status}`;
                    throw new Error(`Error en ${tr.name}: ${msg}`);
                }

                const arrayBuf = await res.arrayBuffer();
                await LocalFileManager.saveTrackLocal(song.id, tr.name, arrayBuf);
            }

            setDownloadProgress({ songId: song.id, text: 'Guardando Letra y Acordes offline...' });

            // Descargar Letra offline
            try {
                const lyricsQuery = query(collection(db, 'lyrics'), where('songId', '==', song.id));
                const lyricsSnap = await getDocs(lyricsQuery);
                let lyricsText = song.lyrics || '';
                if (!lyricsSnap.empty) {
                    lyricsText = lyricsSnap.docs[0].data().text || '';
                }
                if (lyricsText) {
                    await LocalFileManager.saveTextLocal(song.id, 'lyrics', lyricsText);
                }

                // Descargar Acordes offline
                const chordsQuery = query(collection(db, 'chords'), where('songId', '==', song.id));
                const chordsSnap = await getDocs(chordsQuery);
                let chordsText = song.chords || '';
                if (!chordsSnap.empty) {
                    chordsText = chordsSnap.docs[0].data().text || '';
                }
                if (chordsText) {
                    await LocalFileManager.saveTextLocal(song.id, 'chords', chordsText);
                }
            } catch (err) {
                console.warn("[OFFLINE] No se pudieron guardar letras o acordes offline", err);
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
        await audioEngine.init();

        // ── SONG IS ALREADY IN RAM → instant switch, no blocking ──────────
        const cachedBuffers = preloadCache.current.get(song.id);
        if (cachedBuffers && cachedBuffers.size > 0) {
            console.log(`[INSTANT] "${song.name}" is Ready.`);
            touchLRU(song.id);

            audioEngine.clearTracks();
            setIsPlaying(false);
            setProgress(0);
            setActiveSongId(song.id);

            const newTracks = [];
            for (const [trackName, cached] of cachedBuffers.entries()) {
                const trackId = `${song.id}_${trackName}`;
                audioEngine.addTrack(trackId, cached.audioBuf || cached, cached.rawBuf || null);
                newTracks.push({ id: trackId, name: trackName });
            }
            setTracks(newTracks);

            // Sliding window: start loading the next songs in background
            if (activeSetlist?.songs) {
                const allSongs = activeSetlist.songs;
                const currentIdx = allSongs.findIndex(s => s.id === song.id);
                if (currentIdx !== -1) {
                    const lookahead = [];
                    for (let i = currentIdx + 1; i < allSongs.length && lookahead.length < MAX_DECODED_SONGS - 1; i++) {
                        if (!preloadCache.current.has(allSongs[i].id)) lookahead.push(allSongs[i]);
                    }
                    if (lookahead.length > 0) preloadSetlistSongs(lookahead);
                }
            }
            return; // Done — no blocking, current song plays immediately
        }

        // ── SONG NOT IN RAM → background load, DON'T interrupt current song ─
        // If already loading this song in background, ignore the second click
        if (preloadStatus[song.id] === 'loading') {
            console.log(`[BG] "${song.name}" ya está cargando en segundo plano...`);
            return;
        }

        // Mark as loading (shows badge in sidebar) but DON'T stop current song
        console.log(`[BG] "${song.name}" not in RAM — loading in background. Current song keeps playing.`);
        setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));

        // Fire-and-forget background decode
        (async () => {
            try {
                evictOldestIfNeeded();
                const tracksData = song.tracks || [];
                const trackBuffers = new Map();

                for (const tr of tracksData) {
                    if (!tr.url || tr.url === 'undefined') continue;

                    let rawBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                    if (!rawBuf) {
                        const res = await fetch(`${proxyUrl}/download?url=${encodeURIComponent(tr.url)}`);
                        if (!res.ok) throw new Error(`Error en ${tr.name}: ${res.status}`);
                        rawBuf = await res.arrayBuffer();
                        await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                    }
                    const audioBuf = await audioEngine.ctx.decodeAudioData(rawBuf.slice(0));
                    trackBuffers.set(tr.name, { audioBuf, rawBuf });
                }

                preloadCache.current.set(song.id, trackBuffers);
                touchLRU(song.id);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
                console.log(`[BG] "${song.name}" now Ready — click to switch instantly.`);
            } catch (err) {
                console.warn(`[BG] Failed loading "${song.name}":`, err);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
            }
        })();
        // Returns immediately — current song is untouched
    };


    const handleLogin = async () => {
        setShowLoginModal(true);
        try {
            if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
                await ScreenOrientation.lock({ orientation: 'portrait' });
            }
        } catch (e) { }
    };

    const handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            setShowLoginModal(false);
        } catch (error) {
            console.error("Login con Google falló:", error);
            setLoginError("Error con Google: " + error.message);
        }
    };

    const handleEmailAuthSubmit = async (e) => {
        e.preventDefault();
        setLoginError('');
        try {
            if (loginIsRegister) {
                await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
            } else {
                await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            }
            setShowLoginModal(false);
            setLoginEmail('');
            setLoginPassword('');
            // Automatically handled by the useEffect on [currentUser], but we double call it just in case
            if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
                await ScreenOrientation.lock({ orientation: 'landscape' });
            }
        } catch (error) {
            console.error("Auth falló:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                setLoginError('Correo o contraseña incorrectos');
            } else if (error.code === 'auth/email-already-in-use') {
                setLoginError('Este correo ya está registrado');
            } else {
                setLoginError(error.message);
            }
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
                await ScreenOrientation.lock({ orientation: 'portrait' });
            }
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

    const handleSkipForward = () => {
        if (!activeSetlist?.songs?.length || !activeSongId) return;
        const songs = activeSetlist.songs;
        const currentIdx = songs.findIndex(s => s.id === activeSongId);
        if (currentIdx !== -1 && currentIdx < songs.length - 1) {
            handleLoadSong(songs[currentIdx + 1]);
        }
    };

    const handleSkipBack = () => {
        // If more than 3 seconds in, restart the song; else go to prev song
        if (progress > 3) {
            audioEngine.stop();
            setIsPlaying(false);
            setProgress(0);
        } else if (activeSetlist?.songs?.length && activeSongId) {
            const songs = activeSetlist.songs;
            const currentIdx = songs.findIndex(s => s.id === activeSongId);
            if (currentIdx > 0) {
                handleLoadSong(songs[currentIdx - 1]);
            } else {
                audioEngine.stop();
                setIsPlaying(false);
                setProgress(0);
            }
        } else {
            handleRewind();
        }
    };

    const [masterVolume, setMasterVolume] = useState(1);
    const handleMasterVolume = (e) => {
        const val = parseFloat(e.target.value);
        setMasterVolume(val);
        audioEngine.masterGain.gain.setTargetAtTime(val, audioEngine.ctx.currentTime, 0.015);
    };

    // Tempo control (±15 BPM from original, pitch preserved via SoundTouch)
    const [tempoOffset, setTempoOffset] = useState(0); // offset in BPM from original
    const handleTempoChange = (delta) => {
        const originalBPM = activeSong?.tempo ? parseFloat(activeSong.tempo) : 120;
        const newOffset = Math.max(-15, Math.min(15, tempoOffset + delta));
        setTempoOffset(newOffset);
        const newRatio = (originalBPM + newOffset) / originalBPM;
        audioEngine.setTempo(newRatio);
    };
    const handleTempoReset = () => {
        setTempoOffset(0);
        audioEngine.setTempo(1.0);
    };

    // Pitch / Key control (±6 semitones via SoundTouch)
    const [pitchOffset, setPitchOffset] = useState(0);
    const handlePitchChange = (delta) => {
        const newOffset = Math.max(-12, Math.min(12, pitchOffset + delta));
        setPitchOffset(newOffset);
        audioEngine.setPitch(newOffset);
    };
    const handlePitchReset = () => {
        setPitchOffset(0);
        audioEngine.setPitch(0);
    };


    // Format time (e.g. 02:03)
    const formatTime = (secs) => {
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Derive active song metadata - prioritize live library data over setlist snapshots
    const liveSong = librarySongs.find(s => s.id === activeSongId)
        || globalSongs.find(s => s.id === activeSongId);

    // Final active song object
    const activeSong = liveSong || (activeSetlist?.songs || []).find(s => s.id === activeSongId) || null;

    const totalDuration = React.useMemo(() => {
        for (const [, track] of audioEngine.tracks.entries()) {
            if (track.buffer) return track.buffer.duration;
        }
        return 0;
    }, [tracks]); // Recalculate when tracks change

    // AUTO-STOP when song finishes
    useEffect(() => {
        if (isPlaying && totalDuration > 0 && progress >= totalDuration) {
            console.log("[AUTO-STOP] Song finished.");
            handleStop();
        }
    }, [progress, totalDuration, isPlaying]);

    // Teleprompter and Chords states
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [autoScrollSpeed, setAutoScrollSpeed] = useState(1.0); // 1.0 is normal speed
    const [lyricsFontSize, setLyricsFontSize] = useState(24);

    const [activeLyrics, setActiveLyrics] = useState('loading'); // 'loading', null, or string
    const lyricsScrollRef = useRef(null);

    const [activeChords, setActiveChords] = useState('loading'); // 'loading', null, or string
    const chordsScrollRef = useRef(null);

    // Fetch lyrics and chords with offline-first + live sync hybrid approach
    useEffect(() => {
        if (!activeSongId) {
            setActiveLyrics(null);
            setActiveChords(null);
            return;
        }

        console.log(`[TEXTS] 🔍 Buscando Letras y Acordes para ID: ${activeSongId}`);
        setActiveLyrics('loading');
        setActiveChords('loading');

        let unsubLyrics = () => { };
        let unsubChords = () => { };

        const loadTexts = async () => {
            // 1. CARGA RÁPIDA OFFLINE
            const offlineLyrics = await LocalFileManager.getTextLocal(activeSongId, 'lyrics');
            const offlineChords = await LocalFileManager.getTextLocal(activeSongId, 'chords');

            if (offlineLyrics) setActiveLyrics(offlineLyrics);
            if (offlineChords) setActiveChords(offlineChords);

            // 2. SINCRONIZACIÓN EN VIVO DESDE FIRESTORE (si hay internet)
            // Lyrics sync
            const qLyrics = query(collection(db, 'lyrics'), where('songId', '==', activeSongId));
            unsubLyrics = onSnapshot(qLyrics, (snap) => {
                if (!snap.empty) {
                    const text = snap.docs[0].data().text;
                    setActiveLyrics(text);
                    LocalFileManager.saveTextLocal(activeSongId, 'lyrics', text); // Update local cache
                } else if (!offlineLyrics) {
                    setActiveLyrics(activeSong?.lyrics || null);
                }
            }, (err) => {
                console.error("[LYRICS] Offline / error", err);
                if (!offlineLyrics) setActiveLyrics(activeSong?.lyrics || null);
            });

            // Chords sync
            const qChords = query(collection(db, 'chords'), where('songId', '==', activeSongId));
            unsubChords = onSnapshot(qChords, (snap) => {
                if (!snap.empty) {
                    const text = snap.docs[0].data().text;
                    setActiveChords(text);
                    LocalFileManager.saveTextLocal(activeSongId, 'chords', text); // Update local cache
                } else if (!offlineChords) {
                    setActiveChords(activeSong?.chords || null);
                }
            }, (err) => {
                console.error("[CHORDS] Offline / error", err);
                if (!offlineChords) setActiveChords(activeSong?.chords || null);
            });
        };

        loadTexts();

        return () => {
            unsubLyrics();
            unsubChords();
        };
    }, [activeSongId, activeSong?.lyrics, activeSong?.chords]);

    const handleRetryLyrics = () => {
        const id = activeSongId;
        setActiveSongId(null);
        setTimeout(() => setActiveSongId(id), 50);
    };

    // Auto-scroll effect with manual override support for both views
    const [manualScrollOffset, setManualScrollOffset] = useState(0);
    const lastAutoScrollTop = useRef(0);
    const isProgrammaticScroll = useRef(false);

    useEffect(() => {
        if (isAutoScroll && totalDuration > 0) {
            // Apply scroll to whatever the active scroll ref is
            const container = activeTab === 'lyrics' ? lyricsScrollRef.current :
                activeTab === 'chords' ? chordsScrollRef.current : null;

            if (!container) return;
            const scrollHeight = container.scrollHeight - container.clientHeight;

            // Calculate base scroll position based on progress and speed
            const baseScroll = ((progress * autoScrollSpeed) / totalDuration) * scrollHeight;

            // Add user's manual offset
            const targetScroll = baseScroll + manualScrollOffset;

            // Prevent going out of bounds
            const finalScroll = Math.max(0, Math.min(targetScroll, scrollHeight));

            isProgrammaticScroll.current = true;
            lastAutoScrollTop.current = finalScroll;

            container.scrollTo({
                top: finalScroll,
                behavior: 'smooth'
            });

            // Allow time for the smooth scroll to start processing before reacting to scroll events
            setTimeout(() => {
                isProgrammaticScroll.current = false;
            }, 100);
        }
    }, [progress, totalDuration, isAutoScroll, autoScrollSpeed, manualScrollOffset, activeTab]);

    const handleTextScroll = (e) => {
        if (!isAutoScroll) return;

        // If this scroll event was triggered by our own code, ignore it
        if (isProgrammaticScroll.current) return;

        // If it's a user scroll (touch/mouse wheel), calculate the difference
        const currentTop = e.target.scrollTop;
        if (Math.abs(currentTop - lastAutoScrollTop.current) > 2) { // 2px threshold to ignore micro-bounces
            const difference = currentTop - lastAutoScrollTop.current;
            setManualScrollOffset(prevOffset => prevOffset + difference);
            lastAutoScrollTop.current = currentTop;
        }
    };

    // When switching tabs, reset the manual scroll offset so it doesn't jump weirdly
    useEffect(() => {
        setManualScrollOffset(0);
    }, [activeTab]);

    // ── PRELOADER OVERLAY ──────────────────────────────────────────────────
    const [showPreloader, setShowPreloader] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const countdownRef = useRef(null);

    // ── ORIENTATION MANAGEMENT ──────────────────────────────────────────
    useEffect(() => {
        // Detect native environment
        const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
        if (!isNative) return;

        const lockOrientation = async () => {
            try {
                if (!currentUser) {
                    await ScreenOrientation.lock({ orientation: 'portrait' });
                } else {
                    await ScreenOrientation.lock({ orientation: 'landscape' });
                }
            } catch (err) {
                console.warn("ScreenOrientation error:", err);
            }
        };

        lockOrientation();
    }, [currentUser]);

    // Trigger preloader whenever preloading starts (setlist is loaded with songs)
    useEffect(() => {
        const hasSongs = (activeSetlist?.songs || []).length > 0;
        const hasAnythingLoading = Object.values(preloadStatus).some(s => s === 'loading');
        if (hasSongs && hasAnythingLoading) {
            setShowPreloader(true);
            setCountdown(10);
            clearInterval(countdownRef.current);
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownRef.current);
                        setShowPreloader(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(countdownRef.current);
    }, [activeSetlist?.id]); // only fire when a new setlist is activated

    // Also dismiss early if all songs are ready before countdown ends
    useEffect(() => {
        const hasSongs = (activeSetlist?.songs || []).length > 0;
        if (!hasSongs) return;
        const allReady = (activeSetlist.songs).every(
            s => preloadCache.current.has(s.id) || preloadStatus[s.id] === 'ready'
        );
        if (allReady && showPreloader) {
            clearInterval(countdownRef.current);
            // Short delay so user sees the complete state before dismissing
            setTimeout(() => setShowPreloader(false), 600);
        }
    }, [preloadStatus]);

    return (
        <div className="multitrack-layout">

            {/* ── LOGIN MODAL ──────────────────────────────────────────────── */}
            {showLoginModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1c1c1e', padding: '30px', borderRadius: '12px', width: '320px', border: '1px solid #333', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}><X size={20} /></button>
                        <h2 style={{ color: 'white', marginTop: 0, marginBottom: '20px', textAlign: 'center', fontWeight: '800' }}>{loginIsRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
                        <form onSubmit={handleEmailAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="email" placeholder="Correo electrónico" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2c', color: 'white', fontSize: '1rem', outline: 'none' }} />
                            <input type="password" placeholder="Contraseña" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2c', color: 'white', fontSize: '1rem', outline: 'none' }} />
                            {loginError && <div style={{ color: '#ff5252', fontSize: '0.85rem', textAlign: 'center' }}>{loginError}</div>}
                            <button type="submit" style={{ padding: '12px', background: '#00d2d3', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>{loginIsRegister ? 'Registrarse' : 'Entrar'}</button>
                        </form>



                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <span onClick={() => { setLoginIsRegister(!loginIsRegister); setLoginError(''); }} style={{ color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'none' }}>
                                {loginIsRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? regístrate aquí'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PRELOADER OVERLAY ──────────────────────────────────────────── */}
            {showPreloader && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'linear-gradient(160deg, #0a0a12 0%, #0d1a2e 60%, #0a1520 100%)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Inter", "Segoe UI", sans-serif'
                }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '52px' }}>
                        <div style={{ width: '38px', height: '38px', background: '#00bcd4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%' }} />
                        </div>
                        <span className="preloader-text" style={{ fontWeight: '800', fontSize: '1.5rem', color: 'white', letterSpacing: '-0.5px' }}>MixCommunity</span>
                    </div>

                    {/* Spinner + Countdown stacked */}
                    <div style={{ position: 'relative', width: '140px', height: '140px', marginBottom: '40px' }}>
                        {/* SVG spinning ring */}
                        <svg width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', inset: 0 }}>
                            {/* Track ring */}
                            <circle cx="70" cy="70" r="60" fill="none" stroke="#ffffff10" strokeWidth="8" />
                            {/* Animated arc */}
                            <circle
                                cx="70" cy="70" r="60"
                                fill="none" stroke="#00bcd4" strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray="120 260"
                                style={{ transformOrigin: '70px 70px', animation: 'spin 1.1s linear infinite' }}
                            />
                            {/* Pulse dot accent */}
                            <circle cx="70" cy="10" r="5" fill="#00e5ff"
                                style={{ transformOrigin: '70px 70px', animation: 'spin 1.1s linear infinite' }}
                            />
                        </svg>
                        {/* Countdown number */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <span style={{
                                fontSize: '3.8rem', fontWeight: '800',
                                color: countdown <= 3 ? '#00e5ff' : 'white',
                                lineHeight: 1,
                                transition: 'color 0.4s'
                            }}>{countdown}</span>
                            <span style={{ fontSize: '0.72rem', color: '#ffffff55', marginTop: '4px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>seg</span>
                        </div>
                    </div>

                    {/* Status text */}
                    <p style={{ color: '#ffffff88', fontSize: '1rem', margin: '0 0 10px', fontWeight: '500' }}>
                        Preparando tus canciones...
                    </p>

                    {/* Song progress dots */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '28px' }}>
                        {(activeSetlist?.songs || []).map(song => {
                            const st = preloadStatus[song.id];
                            return (
                                <div key={song.id} style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: st === 'ready' ? '#00bcd4'
                                        : st === 'loading' ? '#f39c12'
                                            : '#ffffff22',
                                    transition: 'background 0.4s',
                                    boxShadow: st === 'ready' ? '0 0 8px #00bcd4' : 'none'
                                }} />
                            );
                        })}
                    </div>

                    {/* Skip button */}
                    <button
                        onClick={() => { clearInterval(countdownRef.current); setShowPreloader(false); }}
                        style={{
                            marginTop: '40px', background: 'transparent',
                            border: '1px solid #ffffff22', color: '#ffffff66',
                            padding: '8px 24px', borderRadius: '100px',
                            cursor: 'pointer', fontSize: '0.85rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.target.style.borderColor = '#ffffff55'; e.target.style.color = '#ffffffaa'; }}
                        onMouseLeave={e => { e.target.style.borderColor = '#ffffff22'; e.target.style.color = '#ffffff66'; }}
                    >
                        Saltar
                    </button>
                </div>
            )}

            {/* PRIME TOP TRANSPORT HEADER */}
            <div className="transport-bar">
                <button className="transport-btn" onClick={() => navigate('/dashboard')} title="Menu">
                    <Menu size={20} />
                </button>

                {/* MOBILE DRAWER BUTTONS */}
                <div className="mobile-only-flex" style={{ display: 'none', gap: '8px' }}>
                    <button className="transport-btn" onClick={() => setIsSetlistMenuOpen(true)} title="Setlists">
                        <ListMusic size={20} />
                    </button>
                    <button className="transport-btn" onClick={() => setIsLibraryMenuOpen(true)} title="Librería">
                        <LibraryIcon size={20} />
                    </button>
                </div>

                {/* MASTER VOLUME SLIDER */}
                <div className="master-volume-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--transport-blue)', borderRadius: '8px', padding: '5px 12px', minWidth: '100px', flexShrink: 2 }}>
                    <span className="desktop-only" style={{ color: 'white', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>MASTER</span>
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
                    <button className="transport-btn" title="Rebobinar" onClick={handleSkipBack}><SkipBack size={20} /></button>
                    <button
                        className={`transport-btn ${isPlaying ? 'active' : 'play'}`}
                        onClick={handlePlay}
                        title={isPlaying ? 'Pausar' : 'Reproducir'}
                        style={{ background: isPlaying ? '#f39c12' : undefined }}
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button className="transport-btn stop" onClick={handleStop} title="Detener"><Square size={20} /></button>
                    <button className="transport-btn" title="Siguiente" onClick={handleSkipForward}><SkipForward size={20} /></button>
                </div>

                <div className="audio-info">
                    <span>{formatTime(progress)} / {totalDuration ? formatTime(totalDuration) : '--:--'}</span>

                    {/* TEMPO CONTROL with ± buttons */}
                    <span style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => handleTempoChange(-1)} className="square-btn">−</button>
                        <span
                            onClick={tempoOffset !== 0 ? handleTempoReset : undefined}
                            className="control-value"
                            style={{ minWidth: '75px', color: tempoOffset !== 0 ? '#f39c12' : 'inherit' }}
                        >
                            {activeSong?.tempo
                                ? `${(parseFloat(activeSong.tempo) + tempoOffset).toFixed(1)} BPM`
                                : '-- BPM'}
                            {tempoOffset !== 0 && <span style={{ fontSize: '0.6rem', marginLeft: '2px' }}>{tempoOffset > 0 ? `▲${tempoOffset}` : `▼${Math.abs(tempoOffset)}`}</span>}
                        </span>
                        <button onClick={() => handleTempoChange(+1)} className="square-btn">+</button>
                    </span>

                    {/* PITCH/KEY CONTROL */}
                    <span style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => handlePitchChange(-1)} className="square-btn">−</button>
                        <span
                            onClick={pitchOffset !== 0 ? handlePitchReset : undefined}
                            className="control-value"
                            style={{ minWidth: '45px', color: pitchOffset !== 0 ? '#f39c12' : 'inherit' }}
                        >
                            {activeSong?.key || '--'}
                            {pitchOffset !== 0 && <span style={{ fontSize: '0.6rem', marginLeft: '2px' }}>{pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset}</span>}
                        </span>
                        <button onClick={() => handlePitchChange(+1)} className="square-btn">+</button>
                    </span>
                    {activeSong && (
                        <span className="song-name-display">
                            {activeSong.name}
                        </span>
                    )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="desktop-only" style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>{currentUser.displayName || currentUser.email.split('@')[0]}</span>
                            <button onClick={handleLogout} className="transport-btn" title="Cerrar Sesión"><LogOut size={18} /></button>
                        </div>
                    )}
                    <button className="transport-btn" title="Reiniciar canción" onClick={handleRewind}><RefreshCw size={20} /></button>
                    <button
                        className={`transport-btn ${isSettingsOpen ? 'active' : ''}`}
                        onClick={() => setIsSettingsOpen(o => !o)}
                        title="Ajustes"
                        style={{
                            background: isSettingsOpen ? '#00bcd4' : undefined,
                            color: isSettingsOpen ? 'white' : undefined,
                            transition: 'all 0.2s'
                        }}
                    >
                        <Settings size={20} style={{ transition: 'transform 0.4s', transform: isSettingsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                    </button>
                </div>
            </div>

            {/* WAVEFORM OVERVIEW */}
            <div className="waveform-section">
                <WaveformCanvas tracks={tracks} progress={progress} isPlaying={isPlaying} />
            </div>

            {/* TAB BAR — modern & dark optimized */}
            <div className="tab-bar">
                {[
                    { id: 'lyrics', label: 'Lyrics' },
                    { id: 'chords', label: 'Acordes' },
                    { id: 'video', label: 'Video' },
                    { id: 'settings', label: 'Ajustes' },
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(isActive ? null : tab.id)}
                            className={`tab-btn ${isActive ? 'active' : ''}`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* MAIN CONTENT SPLIT — dynamic height calculation */}
            <div className="main-content" style={{
                height: activeTab ? 'calc(100vh - 200px)' : 'calc(100vh - 145px)',
                marginTop: '0'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                        <div className="loader"></div>
                    </div>
                ) : (
                    <>
                        {activeTab ? (
                            <div className="tab-content-area">
                                {/* Shared Tab Header */}
                                <div className="tab-header">
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                        <button
                                            onClick={() => setActiveTab(null)}
                                            className="back-to-mixer-btn"
                                        >
                                            <SkipBack size={16} /> MIXER
                                        </button>
                                        <h2>
                                            {activeTab === 'lyrics' ? 'Teleprompter' : activeTab}
                                        </h2>
                                    </div>

                                    {(activeTab === 'lyrics' || activeTab === 'chords') && (
                                        <div className="lyrics-controls-bar">
                                            <div className="control-group">
                                                <button
                                                    onClick={() => setIsAutoScroll(!isAutoScroll)}
                                                    className={`control-btn ${isAutoScroll ? 'primary' : 'secondary'}`}
                                                >
                                                    {isAutoScroll ? 'AUTO-SCROLL ON' : 'AUTO-SCROLL OFF'}
                                                </button>
                                                {isAutoScroll && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span className="control-label" style={{ marginLeft: '8px' }}>VEL:</span>
                                                        <button onClick={() => setAutoScrollSpeed(s => Math.max(0.2, s - 0.2))} className="square-btn">-</button>
                                                        <span className="control-value">{autoScrollSpeed.toFixed(1)}x</span>
                                                        <button onClick={() => setAutoScrollSpeed(s => Math.min(3.0, s + 0.2))} className="square-btn">+</button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="control-group">
                                                <span className="control-label">TEXTO:</span>
                                                <button onClick={() => setLyricsFontSize(f => Math.max(14, f - 2))} className="square-btn">-</button>
                                                <span className="control-value">{lyricsFontSize}</span>
                                                <button onClick={() => setLyricsFontSize(f => Math.min(60, f + 2))} className="square-btn">+</button>
                                            </div>
                                            {activeTab === 'lyrics' && activeLyrics === 'loading' && <span style={{ fontSize: '0.8rem', color: '#00bcd4', fontWeight: '700', animation: 'pulse 1.5s infinite' }}>Cargando Letra...</span>}
                                            {activeTab === 'chords' && activeChords === 'loading' && <span style={{ fontSize: '0.8rem', color: '#00bcd4', fontWeight: '700', animation: 'pulse 1.5s infinite' }}>Cargando Acordes...</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Content Area */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    {activeTab === 'lyrics' && (
                                        <div
                                            ref={lyricsScrollRef}
                                            onScroll={handleTextScroll}
                                            style={{
                                                flex: 1,
                                                background: '#0a0a0e',
                                                borderRadius: '12px',
                                                overflowY: 'auto',
                                                padding: '200px 60px',
                                                textAlign: 'center',
                                                scrollBehavior: 'smooth',
                                                position: 'relative',
                                                boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
                                                touchAction: 'pan-y'
                                            }}
                                        >
                                            {activeLyrics === 'loading' ? (
                                                <div style={{ color: '#00bcd4', fontSize: '1.2rem', fontWeight: '600' }}>Cargando letra...</div>
                                            ) : activeLyrics ? (
                                                <pre className="lyrics-text-area" style={{ fontSize: `${lyricsFontSize}px` }}>
                                                    {activeLyrics}
                                                </pre>
                                            ) : (
                                                <div style={{ padding: '60px', color: '#777', textAlign: 'center' }}>
                                                    <p style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>No hay letra disponible</p>
                                                    <p style={{ margin: '15px 0', fontSize: '1rem', color: '#aaa' }}>ID de canción: {activeSongId}</p>
                                                    <button
                                                        onClick={handleRetryLyrics}
                                                        style={{ background: '#00bcd4', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                                                    >
                                                        REINTENTAR CARGA
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {activeTab === 'chords' && (
                                        <div
                                            ref={chordsScrollRef}
                                            onScroll={handleTextScroll}
                                            style={{
                                                flex: 1,
                                                background: '#0a0a0e',
                                                borderRadius: '12px',
                                                overflowY: 'auto',
                                                padding: '200px 60px',
                                                textAlign: 'left', // Chords usually better left-aligned or center-left
                                                scrollBehavior: 'smooth',
                                                position: 'relative',
                                                boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
                                                touchAction: 'pan-y'
                                            }}
                                        >
                                            {activeChords === 'loading' ? (
                                                <div style={{ color: '#00bcd4', fontSize: '1.2rem', fontWeight: '600', textAlign: 'center' }}>Cargando acordes...</div>
                                            ) : activeChords ? (
                                                <pre className="lyrics-text-area" style={{ fontSize: `${lyricsFontSize}px`, textAlign: 'left' }}>
                                                    {activeChords}
                                                </pre>
                                            ) : (
                                                <div style={{ padding: '60px', color: '#777', textAlign: 'center' }}>
                                                    <p style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>No hay acordes disponibles</p>
                                                    <p style={{ margin: '15px 0', fontSize: '1rem', color: '#aaa' }}>Agrega acordes en formato [C]Texto</p>
                                                    <button
                                                        onClick={handleRetryLyrics}
                                                        style={{ background: '#00e5ff', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                                                    >
                                                        REINTENTAR CARGA
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {activeTab === 'video' && (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '1.2rem' }}>
                                            Módulo de Video — Próximamente
                                        </div>
                                    )}
                                    {activeTab === 'settings' && (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', borderRadius: '12px', color: '#888', fontSize: '1.2rem' }}>
                                            Ajustes Avanzados — Próximamente
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <Mixer tracks={tracks} />
                        )}

                        <div className="sidebar">
                            <div className="right-panel-item">
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <button
                                        onClick={() => setIsSetlistMenuOpen(true)}
                                        className="tab-btn active"
                                        style={{ flex: 1 }}
                                    >
                                        Setlists
                                    </button>
                                </div>

                                {!activeSetlist ? (
                                    <div style={{ padding: '10px', color: '#888', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
                                        Abre el menú Setlists para crear tu primer bloque de canciones.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                        {/* Setlist Name Header */}
                                        <div style={{ padding: '0 5px 12px', borderBottom: '1px solid #eee', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ListMusic size={18} color="#00bcd4" />
                                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: darkMode ? '#eee' : '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {activeSetlist.name}
                                            </h3>
                                        </div>

                                        {/* Scrollable Song List Area */}
                                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px', paddingRight: '5px' }}>
                                            {(activeSetlist.songs || []).length === 0 ? (
                                                <div style={{ padding: '10px', color: '#aaa', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
                                                    Sin canciones. Dale + Añadir Canción.
                                                </div>
                                            ) : (
                                                <DndContext
                                                    sensors={sensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={handleDragEnd}
                                                    modifiers={[restrictToVerticalAxis]}
                                                >
                                                    <SortableContext
                                                        items={(activeSetlist.songs || []).map(s => s.id)}
                                                        strategy={verticalListSortingStrategy}
                                                    >
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {(activeSetlist.songs || []).map((song, idx) => (
                                                                <SortableSongItem
                                                                    key={song.id}
                                                                    song={song}
                                                                    idx={idx}
                                                                    isActive={activeSongId === song.id}
                                                                    pStatus={preloadStatus[song.id]}
                                                                    onSelect={() => handleLoadSong(song)}
                                                                />
                                                            ))}
                                                        </div>
                                                    </SortableContext>
                                                </DndContext>
                                            )}
                                        </div>

                                        <button onClick={() => setIsLibraryMenuOpen(true)} className="action-btn" style={{ flexShrink: 0 }}>
                                            + Añadir Canción
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── PADS PANEL ────────────────────────────────────────── */}
                            <div className="pads-panel">
                                {/* Header */}
                                <div className="pads-header">
                                    <button
                                        className={`pad-power-btn ${padActive ? 'active' : ''}`}
                                        onClick={() => setPadActive(!padActive)}
                                    >
                                        <Power size={22} />
                                    </button>
                                    <div className="pad-title-section">
                                        <h3 className="pad-title">Fundamental Ambient Pads</h3>
                                        <div className="pad-subtitle">Loop Community</div>
                                    </div>
                                    <div className="pad-pitch-control">
                                        <button className="pad-pitch-btn" onClick={() => setPadPitch(p => Math.max(-1, p - 1))}>−</button>
                                        <div className="pad-pitch-val">{padPitch > 0 ? `+${padPitch}` : padPitch}</div>
                                        <button className="pad-pitch-btn" onClick={() => setPadPitch(p => Math.min(1, p + 1))}>+</button>
                                    </div>
                                </div>
                                {/* Body */}
                                <div className="pads-body">
                                    <div className="pad-grid">
                                        {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                                            <button
                                                key={k}
                                                className={`pad-key-btn ${padKey === k ? 'active' : ''}`}
                                                onClick={() => setPadKey(k)}
                                            >
                                                {k}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="pad-master-section">
                                        <div
                                            className="pad-fader-container"
                                            onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const val = 1 - (e.clientY - rect.top) / rect.height;
                                                setPadVolume(Math.max(0, Math.min(1, val)));
                                            }}
                                            onMouseMove={(e) => {
                                                if (e.buttons === 1) { // dragging
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const val = 1 - (e.clientY - rect.top) / rect.height;
                                                    setPadVolume(Math.max(0, Math.min(1, val)));
                                                }
                                            }}
                                        >
                                            <div className="pad-fader-fill" style={{ height: `${padVolume * 100}%` }}></div>
                                        </div>
                                        <div className="pad-ms-group">
                                            <button
                                                className={`pad-ms-btn ${padMute ? 'm-active' : ''}`}
                                                onClick={() => setPadMute(!padMute)}
                                            >
                                                M
                                            </button>
                                            <button
                                                className={`pad-ms-btn ${padSolo ? 's-active' : ''}`}
                                                onClick={() => setPadSolo(!padSolo)}
                                            >
                                                S
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* SLIDE-OUT MENUS (Overlay + Drawers) */}
            <div
                className={`drawer-overlay ${isSetlistMenuOpen || isLibraryMenuOpen || isSettingsOpen ? 'open' : ''}`}
                onClick={() => { setIsSetlistMenuOpen(false); setIsLibraryMenuOpen(false); setIsSettingsOpen(false); }}
            />

            {/* ── SETTINGS DRAWER ─────────────────────────────────────────── */}
            <div className={`settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #00bcd4, #0097a7)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,188,212,0.3)' }}>
                            <Settings size={18} color="white" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: darkMode ? '#fff' : '#222' }}>Ajustes</h2>
                            <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: '500' }}>Personaliza tu experiencia</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSettingsOpen(false)}
                        style={{ background: darkMode ? '#333' : '#f0f0f0', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── 1. Dark Mode ────────────────────────────────── */}
                <div className="settings-section">
                    <div className="settings-row">
                        <div className="settings-label">
                            <div className="settings-icon-wrap" style={{ background: darkMode ? '#2d3748' : '#fef9e7' }}>
                                {darkMode ? <Moon size={16} color="#a0aec0" /> : <Sun size={16} color="#f6ad55" />}
                            </div>
                            <div>
                                <div className="settings-title">Modo Oscuro</div>
                                <div className="settings-sub">{darkMode ? 'Tema oscuro activo' : 'Tema claro activo'}</div>
                            </div>
                        </div>
                        <button
                            className={`toggle-switch ${darkMode ? 'on' : ''}`}
                            onClick={() => setDarkMode(d => !d)}
                            aria-label="Toggle dark mode"
                        >
                            <div className="toggle-thumb" />
                        </button>
                    </div>
                </div>

                {/* ── 2. Pan ────────────────────────────────────────── */}
                <div className="settings-section">
                    <div className="settings-row" style={{ alignItems: 'flex-start' }}>
                        <div className="settings-label">
                            <div className="settings-icon-wrap" style={{ background: '#f0f8ff' }}>
                                <Headphones size={16} color="#4299e1" />
                            </div>
                            <div>
                                <div className="settings-title">Panorama (Pan)</div>
                                <div className="settings-sub">Salida de audio estéreo</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        {[{ id: 'L', label: '◄ L', desc: 'Solo Izquierda' }, { id: 'mono', label: '◆ Mono', desc: 'Centro' }, { id: 'R', label: 'R ►', desc: 'Solo Derecha' }].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setPanMode(opt.id)}
                                title={opt.desc}
                                style={{
                                    flex: 1,
                                    padding: '10px 4px',
                                    borderRadius: '10px',
                                    border: panMode === opt.id ? '2px solid #00bcd4' : '2px solid #e2e8f0',
                                    background: panMode === opt.id ? 'linear-gradient(135deg, rgba(0,188,212,0.15), rgba(0,188,212,0.05))' : (darkMode ? '#2d3748' : '#f8f9fa'),
                                    color: panMode === opt.id ? '#00bcd4' : (darkMode ? '#aaa' : '#555'),
                                    fontWeight: panMode === opt.id ? '800' : '600',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: panMode === opt.id ? '0 2px 12px rgba(0,188,212,0.2)' : 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {panMode === opt.id && <Check size={12} />}
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── 3. Tamaño de fuente ────────────────────────────── */}
                <div className="settings-section">
                    <div className="settings-row">
                        <div className="settings-label">
                            <div className="settings-icon-wrap" style={{ background: '#f0fff4' }}>
                                <Type size={16} color="#48bb78" />
                            </div>
                            <div>
                                <div className="settings-title">Tamaño de Fuente</div>
                                <div className="settings-sub">Interfaz global de la app</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => setAppFontSize(f => Math.max(11, f - 1))}
                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: darkMode ? '#3a4a5a' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >−</button>
                            <span style={{ fontWeight: '800', fontSize: '1rem', minWidth: '32px', textAlign: 'center', color: '#00bcd4' }}>{appFontSize}</span>
                            <button
                                onClick={() => setAppFontSize(f => Math.min(20, f + 1))}
                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: darkMode ? '#3a4a5a' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >+</button>
                        </div>
                    </div>
                    {/* Font size visual preview */}
                    <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: darkMode ? '#1a2433' : '#f8f9fa', border: '1px solid #e2e8f0', fontSize: `${appFontSize}px`, color: darkMode ? '#ccc' : '#555', lineHeight: '1.4', transition: 'font-size 0.2s' }}>
                        Vista previa del texto de la app
                    </div>
                </div>

                {/* ── 4. Click Dinámico ──────────────────────────────── */}
                <div className="settings-section">
                    <div className="settings-row">
                        <div className="settings-label">
                            <div className="settings-icon-wrap" style={{ background: dynamicClick ? '#fff5f5' : '#f8f9fa', transition: '0.3s' }}>
                                <Drum size={16} color={dynamicClick ? '#fc8181' : '#a0aec0'} />
                            </div>
                            <div>
                                <div className="settings-title">Click Dinámico</div>
                                <div className="settings-sub">
                                    {activeSong?.tempo
                                        ? `Metrónomo generado a ${activeSong.tempo} BPM`
                                        : 'Activa una canción con tempo primero'}
                                </div>
                            </div>
                        </div>
                        <button
                            className={`toggle-switch ${dynamicClick ? 'on danger' : ''}`}
                            onClick={() => {
                                if (!activeSong?.tempo && !dynamicClick) {
                                    alert('Carga una canción con BPM definido primero.');
                                    return;
                                }
                                const next = !dynamicClick;
                                setDynamicClick(next);
                                if (next && activeSong?.tempo) {
                                    startDynamicClick(parseFloat(activeSong.tempo));
                                } else {
                                    stopDynamicClick();
                                }
                            }}
                            aria-label="Toggle dynamic click"
                            disabled={!activeSong?.tempo && !dynamicClick}
                            style={{ opacity: (!activeSong?.tempo && !dynamicClick) ? 0.4 : 1 }}
                        >
                            <div className="toggle-thumb" />
                        </button>
                    </div>
                    {dynamicClick && (
                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(252,129,129,0.12), rgba(252,129,129,0.05))', border: '1px solid rgba(252,129,129,0.3)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fc8181', animation: 'pulse 0.6s ease-in-out infinite alternate', boxShadow: '0 0 8px rgba(252,129,129,0.8)' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#fc8181' }}>CLICK ACTIVO — {activeSong?.tempo} BPM</span>
                        </div>
                    )}
                </div>

                {/* ── 5. Proxy B2 ───────────────────────────────────── */}
                <div className="settings-section">
                    <div className="settings-label">
                        <div className="settings-icon-wrap" style={{ background: darkMode ? '#2d3748' : '#e0f7fa' }}>
                            <Settings size={16} color="#00bcd4" />
                        </div>
                        <div>
                            <div className="settings-title">Servidor Proxy B2</div>
                            <div className="settings-sub">URL para descargas (Ej: http://192.168.1.50:3001)</div>
                        </div>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <input
                            type="text"
                            value={proxyUrl}
                            onChange={(e) => {
                                const val = e.target.value;
                                setProxyUrl(val);
                                localStorage.setItem('mixer_proxyUrl', val);
                            }}
                            placeholder="https://mixernew-production.up.railway.app"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                background: darkMode ? '#1a2433' : 'white',
                                color: darkMode ? '#fff' : '#000',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                {/* Reset defaults */}
                <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                        onClick={() => {
                            setDarkMode(false);
                            setPanMode('mono');
                            setAppFontSize(14);
                            setDynamicClick(false);
                            stopDynamicClick();
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', color: '#888', transition: '0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.color = '#555'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
                    >
                        Restaurar valores por defecto
                    </button>
                </div>
            </div>

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
                                <div style={{ textAlign: 'center', color: '#666', marginTop: '30px', padding: '0 20px' }}>
                                    {libraryTab === 'mine' ? (
                                        <>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>Tu librería está vacía</div>
                                            <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                                Para subir tus propias canciones, ingresa desde tu computadora a:<br />
                                                <a href="https://www.zionstage.com" target="_blank" rel="noreferrer" style={{ color: '#00bcd4', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginTop: '8px', fontSize: '1rem' }}>www.zionstage.com</a>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.9rem' }}>No hay canciones globales todavía.</div>
                                    )}
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

function SortableSongItem({ song, idx, isActive, pStatus, onSelect }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: song.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : (pStatus === 'loading' && !isActive ? 0.7 : 1),
        zIndex: isDragging ? 100 : 1,
        touchAction: 'none',
        position: 'relative',
        transformOrigin: '0 0'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`setlist-song-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
        >
            <div className="song-item-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {/* Reorder handle */}
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                        <GripVertical size={16} />
                    </div>
                    <span className="song-index-badge">{idx + 1}</span>
                    <span
                        onClick={onSelect}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                    >
                        {song.name}
                    </span>
                </div>
                <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {pStatus === 'loading' && !isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f39c12', boxShadow: '0 0 5px #f39c12' }} />
                            <span style={{ fontSize: '0.6rem', color: '#f39c12', fontWeight: '800', textTransform: 'uppercase' }}>Loading</span>
                        </div>
                    )}
                    {pStatus === 'ready' && !isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(46, 204, 113, 0.1)', padding: '2px 6px', borderRadius: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }} />
                            <span style={{ fontSize: '0.6rem', color: '#2ecc71', fontWeight: '800', textTransform: 'uppercase' }}>Ready</span>
                        </div>
                    )}
                    {!pStatus && !isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5252' }} />
                            <span style={{ fontSize: '0.6rem', color: '#ff5252', fontWeight: '800', textTransform: 'uppercase' }}>Off</span>
                        </div>
                    )}
                    {isActive && <span className="active-badge">▶ LINE</span>}
                </span>
            </div>
            <div className="song-item-meta" onClick={onSelect} style={{ cursor: 'pointer', marginLeft: '24px' }}>
                {song.artist && `${song.artist} • `}
                {song.key && `${song.key} • `}
                {song.tempo && `${song.tempo} BPM`}
            </div>
        </div>
    );
}
