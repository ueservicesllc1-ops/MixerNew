import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { audioEngine } from '../AudioEngine'
import { Mixer } from '../components/Mixer'
import WaveformCanvas from '../components/WaveformCanvas'
import { Play, Pause, Square, SkipBack, SkipForward, Settings, Menu, RefreshCw, Trash2, LogIn, LogOut, Moon, Sun, Headphones, Type, Drum, X, Check, Power, GripVertical, ListMusic, Library as LibraryIcon } from 'lucide-react'
import { db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from '../firebase'
import { collection, addDoc, getDocs, onSnapshot, query, where, serverTimestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { LocalFileManager } from '../LocalFileManager'
import { NativeEngine } from '../NativeEngine'
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

const isAppNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

export default function Multitrack() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [proxyUrl, setProxyUrl] = useState(() => {
        const saved = localStorage.getItem('mixer_proxyUrl');
        // En nativo (Capacitor), window.location.hostname también es 'localhost'
        // por eso hay que detectar nativo PRIMERO antes de revisar hostname
        const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
        if (isNative) return saved || 'https://mixernew-production.up.railway.app';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) return 'http://localhost:3001';
        return saved || 'https://mixernew-production.up.railway.app';
    });

    // Setlist States
    const [isSetlistMenuOpen, setIsSetlistMenuOpen] = useState(false);
    const [isCurrentListOpen, setIsCurrentListOpen] = useState(false);
    const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useState(false);
    const [setlists, setSetlists] = useState([]);
    const [activeSetlist, setActiveSetlist] = useState(null);
    const [isCreatingSetlist, setIsCreatingSetlist] = useState(false);
    const [newSetlistName, setNewSetlistName] = useState('');
    const [librarySongs, setLibrarySongs] = useState([]);
    const [globalSongs, setGlobalSongs] = useState([]);
    const [libraryTab, setLibraryTab] = useState('mine'); // 'mine' | 'global'
    const [searchQuery, setSearchQuery] = useState('');

    // Download States
    const [downloadProgress, setDownloadProgress] = useState({ songId: null, text: '' });
    // Active loaded song
    const [activeSongId, setActiveSongId] = useState(null);
    const [audioReady, setAudioReady] = useState(0); // Trigger re-renders when buffers finish decoding
    // Bottom tab panel
    const [activeTab, setActiveTab] = useState(null); // null | 'lyrics' | 'chords' | 'video' | 'settings' | 'partituras'

    // ── PARTITURAS STATES ──────────────────────────────────────────
    const [activePartituras, setActivePartituras] = useState([]); // list of {id, instrument, pdfUrl, songId}
    const [selectedPartitura, setSelectedPartitura] = useState(null); // currently opened partitura object
    const [pvFullscreen, setPvFullscreen] = useState(false);

    // ESC key closes fullscreen partitura
    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') setPvFullscreen(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Login Details
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginIsRegister, setLoginIsRegister] = useState(false);
    const [loginError, setLoginError] = useState('');

    // ΓöÇΓöÇ SETTINGS PANEL STATES ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPadsOpen, setIsPadsOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mixer_darkMode') === 'true');
    const [panMode, setPanMode] = useState(() => localStorage.getItem('mixer_panMode') || 'mono'); // 'L' | 'R' | 'mono'
    const [appFontSize, setAppFontSize] = useState(() => parseInt(localStorage.getItem('mixer_appFontSize') || '14'));
    const [dynamicClick, setDynamicClick] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);


    // Intercept console.log/error to show on-screen (for debugging without USB)
    useEffect(() => {
        const origLog = console.log;
        const origErr = console.error;
        const origWarn = console.warn;
        const push = (type, args) => {
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            setDebugLogs(prev => [...prev.slice(-80), { type, msg, t: new Date().toISOString().slice(11, 19) }]);
        };
        console.log = (...a) => { origLog(...a); push('log', a); };
        console.error = (...a) => { origErr(...a); push('err', a); };
        console.warn = (...a) => { origWarn(...a); push('warn', a); };
        return () => { console.log = origLog; console.error = origErr; console.warn = origWarn; };
    }, []);

    // ΓöÇΓöÇ PADS SYSTEM STATES ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const [padActive, setPadActive] = useState(false);
    const [padKey, setPadKey] = useState('C');
    const [padPitch, setPadPitch] = useState(0);
    const [padVolume] = useState(0.8);
    const [padMute, setPadMute] = useState(false);
    const [padSolo, setPadSolo] = useState(false); // (El modo Solo ser├¡a m├ís complejo de integrar contra el otro motor, por ahora sirve visual)

    // ΓöÇΓöÇ DND SENSORS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

    // Force landscape orientation on load for mobiles/tablets
    useEffect(() => {
        const lockOrientation = async () => {
            try {
                if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
                    await ScreenOrientation.lock({ orientation: 'landscape' });
                }
            } catch (e) {
                console.warn('Orientation lock not supported or failed', e);
            }
        };
        lockOrientation();

        // Optional: Re-lock on window resize if needed for certain browsers, though Capacitor is the main target
    }, []);

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

    // ΓöÇΓöÇ DYNAMIC CLICK ENGINE ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

    // Click din├ímico: solo suena cuando la canci├│n est├í reproduciendo (Play)
    // El switch solo "arma" el modo ΓÇö el click real respeta el transport.
    // NOTA: No usamos `activeSong` aqu├¡ porque se declara m├ís abajo (TDZ).
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
    // ΓöÇΓöÇ Smart LRU Preload Cache ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

    // Song limits per estimated RAM (Safe levels for Web Browser process):
    //   <= 4 GB  -> 1 song
    //   <= 8 GB  -> 2 songs
    //   <= 16 GB -> 4 songs
    //   > 16 GB  -> 6 songs
    const MAX_DECODED_SONGS = estimatedRAM <= 4 ? 1
        : estimatedRAM <= 8 ? 2
            : estimatedRAM <= 16 ? 4
                : 6;


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
            if (!candidate) break; // All cached songs are active ΓÇö don't evict anything
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
                    // Preload only the start of the setlist
                    const subset = (found.songs || []).slice(0, 4);
                    preloadSetlistSongs(subset);
                }
            }
            hasAutoLoaded.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [librarySongs, globalSongs, activeSetlist]);

    useEffect(() => {
        // Track User Auth and load their library
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);

            if (user) {
                // ΓöÇΓöÇ Songs: solo las del usuario autenticado ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
                const q = query(collection(db, 'songs'), where('userId', '==', user.uid));
                const unsubSongs = onSnapshot(q, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    setLibrarySongs(songs);
                });

                // Global/VIP tab ΓÇö todas las canciones (sin filtro de due├▒o, solo lectura de metadata)
                const qGlobal = query(collection(db, 'songs'));
                const unsubGlobal = onSnapshot(qGlobal, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    setGlobalSongs(songs);
                });

                // ΓöÇΓöÇ Setlists: SOLO los del usuario autenticado ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
                    // Sync el setlist activo si Firestore lo actualiz├│
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
                // Usuario sin sesi├│n ΓåÆ limpiar todo
                setLibrarySongs([]);
                setGlobalSongs([]);
                setSetlists([]);
                setActiveSetlist(null);
            }
        });

        // Inicializar canales vac├¡os del engine
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
            if (audioEngine) audioEngine.onProgress = null;
        };
    }, []);

    const handleCreateSetlist = async () => {
        if (!newSetlistName.trim()) return;
        if (!currentUser) {
            alert('Debes iniciar sesi├│n para crear un setlist.');
            return;
        }

        try {
            await addDoc(collection(db, 'setlists'), {
                name: newSetlistName,
                userId: currentUser.uid,          // ΓåÉ REQUERIDO para seguridad
                createdAt: serverTimestamp(),
                songs: []
            });
            setNewSetlistName('');
            setIsCreatingSetlist(false);
        } catch (error) {
            console.error("Error creando setlist:", error);
            alert("No se pudo crear. Aseg├║rate de tener permisos (Reglas de Firestore).");
        }
    };

    const handleSelectSetlist = (list) => {
        setActiveSetlist(list);
        setIsSetlistMenuOpen(false);
        localStorage.setItem('mixer_lastSetlistId', list.id);
        // Preload only the start of the setlist
        const subset = (list.songs || []).slice(0, 4);
        preloadSetlistSongs(subset);
    };

    // Auto-preload songs when active setlist changes or gets new songs
    useEffect(() => {
        if (activeSetlist && activeSetlist.songs) {
            // Only preload the "nearby" songs (current + next 3) to avoid RAM saturation
            const currentIndex = activeSetlist.songs.findIndex(s => s.id === activeSongId);
            const startIdx = Math.max(0, currentIndex === -1 ? 0 : currentIndex);
            const subset = activeSetlist.songs.slice(startIdx, startIdx + 4);
            preloadSetlistSongs(subset);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSetlist?.songs]);


    // Silently preload/cache songs (either in native FileSystem or Web RAM)
    const preloadSetlistSongs = async (songs) => {
        const isAppNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

        for (const song of songs) {
            if (preloadCache.current.has(song.id)) {
                touchLRU(song.id); // Already cached ΓÇö refresh recency
                continue;
            }

            // Evict oldest song if we're at the RAM limit
            evictOldestIfNeeded();

            setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));
            try {
                const trackBuffers = new Map();
                const tracksData = song.tracks || [];

                // Carga secuencial o en batches pequeños para evitar picos de RAM
                // En lugar de Promise.all, usamos un loop simple o batches
                for (let i = 0; i < tracksData.length; i += 3) {
                    const batch = tracksData.slice(i, i + 3);
                    await Promise.all(batch.map(async (tr) => {
                        if (!tr.url || tr.url === 'undefined') return;

                        if (isAppNative) {
                            let finalPath = '';
                            let blob = null;
                            const alreadyHasFile = await NativeEngine.isTrackDownloaded(song.id, tr.name);

                            if (alreadyHasFile) {
                                finalPath = await NativeEngine.getTrackPath(song.id, tr.name);
                                if (tr.name === '__PreviewMix') {
                                    blob = await LocalFileManager.getTrackLocal(song.id, tr.name);
                                    if (!blob) {
                                        const res = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                                        if (res.ok) blob = await res.blob();
                                    }
                                }
                            } else {
                                let legacyRawBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                                if (legacyRawBuf) {
                                    finalPath = await NativeEngine.saveTrackBlob(legacyRawBuf, `${song.id}_${tr.name}.mp3`);
                                    blob = legacyRawBuf;
                                } else {
                                    const res = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                                    if (!res.ok) return;
                                    blob = await res.blob();
                                    finalPath = await NativeEngine.saveTrackBlob(blob, `${song.id}_${tr.name}.mp3`);
                                }
                            }

                            if (tr.name === '__PreviewMix' && blob) {
                                try {
                                    const ab = await blob.arrayBuffer();
                                    const audioBuf = await audioEngine.ctx.decodeAudioData(ab);
                                    trackBuffers.set(tr.name, { path: finalPath, audioBuf });
                                } catch (e) {
                                    console.error("Error decodificando visual native:", e);
                                    trackBuffers.set(tr.name, { path: finalPath });
                                }
                            } else {
                                trackBuffers.set(tr.name, { path: finalPath });
                            }
                        } else {
                            let rawBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                            if (!rawBuf) {
                                const res = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                                if (!res.ok) return;
                                rawBuf = await res.blob();
                                await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                            }

                            try {
                                const arrayBuf = await rawBuf.arrayBuffer();
                                if (arrayBuf.byteLength < 500) {
                                    throw new Error("Contenido no válido (demasiado pequeño)");
                                }
                                const audioBuf = await audioEngine.ctx.decodeAudioData(arrayBuf);
                                trackBuffers.set(tr.name, { audioBuf }); 
                            } catch (e) {
                                console.error(`[PRE-CARGA] Corrupción en ${tr.name} para ${song.name}:`, e.message);
                                await LocalFileManager.removeTrackLocal(song.id, tr.name);
                                trackBuffers.set(tr.name, { error: true });
                            }
                        }
                    }));
                }
                preloadCache.current.set(song.id, trackBuffers);
                touchLRU(song.id);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
                console.log(`[PRELOAD] "${song.name}" in Cache. Size: ${preloadCache.current.size}/${MAX_DECODED_SONGS}`);
            } catch (e) {
                console.warn(`[PRELOAD] Failed "${song.name}":`, e);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
            }
        }
    };


    const handleDeleteSetlist = async (id, name, e) => {
        e.stopPropagation(); // Avoid triggering selection
        if (window.confirm(`┬┐Seguro que deseas ELIMINAR permanentemente el setlist "${name}"? Esta acci├│n no se puede deshacer.`)) {
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

    const handleRemoveSongFromSetlist = async (songIdToRemove, e) => {
        if (e) e.stopPropagation();
        if (!activeSetlist) return;

        if (window.confirm("┬┐Seguro que deseas remover esta canci├│n del setlist activo?")) {
            try {
                // Find the song object in the active setlist to use with arrayRemove
                const songToRemove = activeSetlist.songs.find(s => s.id === songIdToRemove);
                if (songToRemove) {
                    await updateDoc(doc(db, 'setlists', activeSetlist.id), {
                        songs: arrayRemove(songToRemove)
                    });

                    // If the removed song is playing/active, we could stop it
                    if (activeSongId === songIdToRemove) {
                        await audioEngine.stop();
                        audioEngine.clear();
                        setIsPlaying(false);
                        setProgress(0);
                        setActiveSongId(null);
                        setTracks([]);
                    }
                }
            } catch (error) {
                console.error("Error removiendo canci├│n del setlist:", error);
                alert("No se pudo remover la canci├│n del setlist.");
            }
        }
    };

    const handleDownloadAndAdd = async (song) => {
        if (!activeSetlist) {
            return alert("Por favor, selecciona un setlist primero antes de a├▒adir canciones.");
        }

        setDownloadProgress({ songId: song.id, text: 'Iniciando descarga B2...' });

        try {
            const tracks = song.tracks || [];
            const isAppNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

            // Loop tracks to download
            for (let i = 0; i < tracks.length; i++) {
                const tr = tracks[i];
                setDownloadProgress({ songId: song.id, text: `Bajando pista ${i + 1}/${tracks.length}: ${tr.name}` });

                // Fetch the binary stream from our proxy (which hooks to B2)
                if (!tr.url || tr.url === 'undefined') {
                    console.warn(`[DOWNLOAD] Saltando pista ${tr.name} porque no tiene URL v├ílida.`);
                    continue;
                }

                if (isAppNative) {
                    const alreadyHasFile = await NativeEngine.isTrackDownloaded(song.id, tr.name);
                    if (!alreadyHasFile) {
                        const res = await fetch(`${proxyUrl}/download?url=${encodeURIComponent(tr.url)}`);
                        if (!res.ok) {
                            const errorData = await res.json().catch(() => ({}));
                            const msg = errorData.error || `Error ${res.status}`;
                            throw new Error(`Error en ${tr.name}: ${msg}`);
                        }
                        const blobData = await res.blob();
                        await NativeEngine.saveTrackBlob(blobData, `${song.id}_${tr.name}.mp3`);
                    }
                } else {
                    let rawBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                    if (!rawBuf) {
                        const res = await fetch(`${proxyUrl}/download?url=${encodeURIComponent(tr.url)}`);
                        if (!res.ok) {
                            const errorData = await res.json().catch(() => ({}));
                            const msg = errorData.error || `Error ${res.status}`;
                            throw new Error(`Error en ${tr.name}: ${msg}`);
                        }
                        const blobData = await res.blob();
                        await LocalFileManager.saveTrackLocal(song.id, tr.name, blobData);
                    }
                }
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
            alert("Hubo un error descargando la canci├│n. Verifica la consola.");
        } finally {
            setDownloadProgress({ songId: null, text: '' });
        }
    };

    const handleLoadSong = async (song) => {
        // Evitar carga duplicada si ya está en progreso (ej. de handleDownloadAndAdd)
        if (downloadProgress.songId === song.id) {
            console.log("[SELECT] Canción ya se está descargando/cargando.");
            // Si ya está en medio de algo, simplemente seleccionamos el ID para UI
            setActiveSongId(song.id);
            return;
        }

        // ΓöÇΓöÇ ACTUALIZACI├ôN INMEDIATA DE UI ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        console.log(`[SELECT] Seleccionando "${song.name}"...`);
        // Visual feedback inmediato antes de cualquier await bloqueante
        setActiveSongId(song.id);
        setTracks([]); // Limpiar mixer mientras carga (evita confusi├│n)
        setIsPlaying(false);
        setProgress(0);
        setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));

        await audioEngine.stop();
        await audioEngine.clear();

        // [SKELETON] Show faders immediately with track names
        const skeleton = (song.tracks || [])
            .filter(tr => tr.name !== '__PreviewMix')
            .map(tr => ({
                id: `${song.id}_${tr.name}`,
                name: tr.name,
                isPlaceholder: true
            }));
        setTracks(skeleton);
        setLoading(false);

        // Inicializamos audio (puede suspender la ejecuci├│n si es el primer click en safari/ios,
        // pero la UI ya cambi├│)
        await audioEngine.init();

        // ΓöÇΓöÇ VERIFICAR SI YA EST├ü EN RAM O DISCO LOCAL ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const cachedBuffers = preloadCache.current.get(song.id);
        if (cachedBuffers && cachedBuffers.size > 0) {
            touchLRU(song.id);

            const batch = [];
            const newTracks = [];
            for (const [trackName, cached] of cachedBuffers.entries()) {
                const trackId = `${song.id}_${trackName}`;
                const isVisual = trackName === '__PreviewMix';
                batch.push({
                    id: trackId,
                    path: cached.path,
                    audioBuffer: cached.audioBuf,
                    sourceData: cached.rawBuf,
                    isVisualOnly: isVisual
                });
                if (!isVisual) newTracks.push({ id: trackId, name: trackName });
            }

            await audioEngine.addTracksBatch(batch);
            setTracks(newTracks);
            setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
            setAudioReady(prev => prev + 1);

            // Pre-cargar siguientes secuencialmente
            if (activeSetlist?.songs) {
                const allSongs = activeSetlist.songs;
                const currentIdx = allSongs.findIndex(s => s.id === song.id);
                if (currentIdx !== -1) {
                    const subset = allSongs.slice(currentIdx + 1, currentIdx + 4).filter(s => !preloadCache.current.has(s.id));
                    if (subset.length > 0) preloadSetlistSongs(subset);
                }
            }
            return;
        }

        const isAppNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
        setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));

        try {
            evictOldestIfNeeded();
            const trackBuffers = new Map();
            const tracksData = song.tracks || [];

            // Descarga/Lectura en batches para evitar picos de RAM
            for (let i = 0; i < tracksData.length; i += 3) {
                const batchChunk = tracksData.slice(i, i + 3);
                await Promise.all(batchChunk.map(async (tr) => {
                    if (!tr.url || tr.url === 'undefined') return;

                    if (isAppNative) {
                        let finalPath = '';
                        let blob = null;
                        try {
                            const alreadyHasFile = await NativeEngine.isTrackDownloaded(song.id, tr.name);
                            if (alreadyHasFile) {
                                finalPath = await NativeEngine.getTrackPath(song.id, tr.name);
                                if (tr.name === '__PreviewMix') {
                                    blob = await LocalFileManager.getTrackLocal(song.id, tr.name);
                                }
                            } else {
                                const res = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                                if (res.ok) {
                                    blob = await res.blob();
                                    finalPath = await NativeEngine.saveTrackBlob(blob, `${song.id}_${tr.name}.mp3`);
                                    await LocalFileManager.saveTrackLocal(song.id, tr.name, blob);
                                }
                            }
                        } catch (e) { console.error("Error loading track file native:", tr.name, e); }

                        let audioBuf = null;
                        if (tr.name === '__PreviewMix' && blob) {
                            try {
                                const ab = await blob.arrayBuffer();
                                audioBuf = await audioEngine.ctx.decodeAudioData(ab);
                            } catch {
                                await LocalFileManager.removeTrackLocal(song.id, tr.name);
                            }
                        }
                        trackBuffers.set(tr.name, { path: finalPath, audioBuf, rawBuf: blob });
                    } else {
                        let rawBuf = await LocalFileManager.getTrackLocal(song.id, tr.name);
                        if (!rawBuf) {
                            try {
                                const res = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                                if (res.ok) {
                                    rawBuf = await res.blob();
                                    await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                                }
                            } catch { /* ignore */ }
                        }

                        let audioBuf = null;
                        if (rawBuf) {
                            try {
                                const arrayBuf = await rawBuf.arrayBuffer();
                                audioBuf = await audioEngine.ctx.decodeAudioData(arrayBuf);
                            } catch {
                                await LocalFileManager.removeTrackLocal(song.id, tr.name);
                            }
                        }
                        trackBuffers.set(tr.name, { rawBuf, audioBuf });
                    }
                }));
            }

            preloadCache.current.set(song.id, trackBuffers);
            touchLRU(song.id);
            setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));

            const batchMove = [];
            const newTracksList = [];
            for (const [trackName, cached] of trackBuffers.entries()) {
                const trackId = `${song.id}_${trackName}`;
                const isVisual = trackName === '__PreviewMix';
                batchMove.push({
                    id: trackId,
                    path: cached.path,
                    audioBuffer: cached.audioBuf,
                    sourceData: cached.rawBuf,
                    isVisualOnly: isVisual
                });
                if (!isVisual) newTracksList.push({ id: trackId, name: trackName });
            }

            await audioEngine.addTracksBatch(batchMove);
            setTracks(newTracksList);
            setAudioReady(prev => prev + 1);

        } catch (err) {
            console.error(`[ERROR] No se pudo cargar "${song.name}":`, err);
            setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
        }
    };


    const handleLogin = async () => {
        setShowLoginModal(true);
        try {
            if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
                await ScreenOrientation.lock({ orientation: 'portrait' });
            }
        } catch { /* ignore */ }
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

    const handleForgotPasswordMultitrack = async () => {
        if (!loginEmail) {
            setLoginError('Ingresa tu correo primero.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, loginEmail);
            setLoginError('');
            alert("Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.");
        } catch (error) {
            console.error("Reset Password Error:", error);
            setLoginError("Error: " + error.message);
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
            console.error("Logout fall├│:", error);
        }
    };

    const handlePlay = async () => {
        await audioEngine.init();
        if (isPlaying) {
            await audioEngine.pause();
            setIsPlaying(false);
        } else {
            await audioEngine.play();
            setIsPlaying(true);
        }
    };

    const handleStop = async () => {
        await audioEngine.stop();
        setIsPlaying(false);
        setProgress(0);
    };

    const handleRewind = async () => {
        await audioEngine.stop();
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

    const handleSkipBack = async () => {
        if (progress > 3) {
            await audioEngine.stop();
            setIsPlaying(false);
            setProgress(0);
        } else if (activeSetlist?.songs?.length && activeSongId) {
            const songs = activeSetlist.songs;
            const currentIdx = songs.findIndex(s => s.id === activeSongId);
            if (currentIdx > 0) {
                handleLoadSong(songs[currentIdx - 1]);
            } else {
                await audioEngine.stop();
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
        // audioEngine.setMasterVolume maneja nativo y web internamente
        audioEngine.setMasterVolume(val);
    };

    // Tempo control (┬▒15 BPM from original, pitch preserved via SoundTouch)
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

    // Pitch / Key control (┬▒6 semitones via SoundTouch)
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
        if (!audioEngine.tracks || audioEngine.tracks.size === 0) {
            return activeSong?.duration || 180;
        }
        for (const [, track] of audioEngine.tracks.entries()) {
            if (track.buffer) return track.buffer.duration;
        }
        return activeSong?.duration || 180;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tracks, activeSong, audioReady]); // Recalculate when tracks or audioReady change

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

    // Fetch partituras for active song
    useEffect(() => {
        if (!activeSongId) {
            setActivePartituras([]);
            setSelectedPartitura(null);
            return;
        }
        const q = query(collection(db, 'partituras'), where('songId', '==', activeSongId));
        const unsub = onSnapshot(q, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a, b) => (a.instrument || '').localeCompare(b.instrument || ''));
            setActivePartituras(list);
            // Auto-select first if none selected
            setSelectedPartitura(prev => {
                if (prev && list.find(p => p.id === prev.id)) return prev;
                return list[0] || null;
            });
        }, (err) => {
            console.error('[PARTITURAS] Error cargando:', err);
        });
        return () => unsub();
    }, [activeSongId]);

    // Fetch lyrics and chords with offline-first + live sync hybrid approach
    useEffect(() => {
        if (!activeSongId) {
            setActiveLyrics(null);
            setActiveChords(null);
            return;
        }

        console.log(`[TEXTS] ≡ƒöì Buscando Letras y Acordes para ID: ${activeSongId}`);
        setActiveLyrics('loading');
        setActiveChords('loading');

        let unsubLyrics = () => { };
        let unsubChords = () => { };

        const loadTexts = async () => {
            // 1. CARGA R├üPIDA OFFLINE
            const offlineLyrics = await LocalFileManager.getTextLocal(activeSongId, 'lyrics');
            const offlineChords = await LocalFileManager.getTextLocal(activeSongId, 'chords');

            if (offlineLyrics) setActiveLyrics(offlineLyrics);
            if (offlineChords) setActiveChords(offlineChords);

            // 2. SINCRONIZACI├ôN EN VIVO DESDE FIRESTORE (si hay internet)
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

    // ΓöÇΓöÇ PRELOADER OVERLAY ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const [showPreloader, setShowPreloader] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const countdownRef = useRef(null);

    // ΓöÇΓöÇ ORIENTATION MANAGEMENT ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preloadStatus]);

    return (
        <div className="multitrack-layout">

            {/* ── ALERTS / LOGIN SYSTEM ────────────────────────────────────────────────── */}

            {(!currentUser || showLoginModal) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1c1c1e', padding: '30px', borderRadius: '12px', width: '320px', border: '1px solid #333', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        {currentUser && (
                            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}><X size={20} /></button>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '36px' }} />
                        </div>
                        <h2 style={{ color: 'white', marginTop: 0, marginBottom: '20px', textAlign: 'center', fontWeight: '800' }}>{loginIsRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
                        <form onSubmit={handleEmailAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="email" placeholder="Correo electrónico" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2c', color: 'white', fontSize: '1rem', outline: 'none' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input type="password" placeholder="Contraseña" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2c', color: 'white', fontSize: '1rem', outline: 'none' }} />
                                {!loginIsRegister && (
                                    <div style={{ textAlign: 'right' }}>
                                        <span 
                                            onClick={handleForgotPasswordMultitrack} 
                                            style={{ fontSize: '0.75rem', color: '#888', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </span>
                                    </div>
                                )}
                            </div>
                            {loginError && <div style={{ color: '#ff5252', fontSize: '0.85rem', textAlign: 'center' }}>{loginError}</div>}
                            <button type="submit" style={{ padding: '12px', background: '#00d2d3', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>{loginIsRegister ? 'Registrarse' : 'Entrar'}</button>
                        </form>



                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <span onClick={() => { setLoginIsRegister(!loginIsRegister); setLoginError(''); }} style={{ color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'none' }}>
                                {loginIsRegister ? '┬┐Ya tienes cuenta? Inicia sesi├│n' : '┬┐No tienes cuenta? reg├¡strate aqu├¡'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ΓöÇΓöÇ PRELOADER OVERLAY ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            {showPreloader && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'linear-gradient(160deg, #0a0a12 0%, #0d1a2e 60%, #0a1520 100%)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Inter", "Segoe UI", sans-serif'
                }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '52px' }}>
                        <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '45px', animation: 'pulse 2s infinite' }} className="preloader-text" />
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
                <div className="mobile-only-flex" style={{ display: 'flex', gap: '4px' }}>
                    <button className="transport-btn-mini" onClick={() => setIsSetlistMenuOpen(true)} title="Setlists">
                        <ListMusic size={18} />
                    </button>
                    <button className="transport-btn-mini" onClick={() => setIsLibraryMenuOpen(true)} title="Librería">
                        <LibraryIcon size={18} />
                    </button>
                </div>

                {/* MASTER VOLUME SLIDER */}
                <div className="master-fader-mini" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 10px',
                    minWidth: window.innerWidth < 800 ? '110px' : '200px',
                    height: '38px',
                    flexShrink: 1,
                    whiteSpace: 'nowrap'
                }}>
                    <span className="desktop-only" style={{ display: window.innerWidth < 1000 ? 'none' : 'block', color: 'white', fontSize: '0.65rem', fontWeight: '900', letterSpacing: '0.1em', whiteSpace: 'nowrap', opacity: 0.9 }}>MASTER</span>
                    <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={masterVolume}
                        onChange={handleMasterVolume}
                        onInput={handleMasterVolume}
                        style={{ flex: 1, accentColor: 'white', cursor: 'pointer', height: '4px' }}
                    />
                    <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: '900', paddingLeft: '4px' }}>{Math.round(masterVolume * 100)}%</span>
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

                    {/* TEMPO CONTROL with ┬▒ buttons */}
                    <span style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => handleTempoChange(-1)} className="square-btn">-</button>
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
                        <button onClick={() => handlePitchChange(-1)} className="square-btn">-</button>
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

            {/* WAVEFORM OVERVIEW / SCRUBBER */}
            <div className="waveform-section" style={{ height: '85px' }}>
                <WaveformCanvas
                    songId={activeSong?.id}
                    tracks={tracks}
                    progress={progress}
                    isPlaying={isPlaying}
                    duration={totalDuration}
                    hasPreview={activeSong?.tracks?.some(t => t.name === '__PreviewMix')}
                />
            </div>

            {/* TAB BAR — modern & dark optimized */}
            <div className="tab-bar">
                {[
                    { id: 'setlist', label: 'Lista' },
                    { id: 'library', label: 'Biblioteca' },
                    { id: 'pads', label: 'Pads' },
                    { id: 'partituras', label: '🎼 Partituras' },
                    { id: 'lyrics', label: 'Lyrics' },
                    { id: 'chords', label: 'Acordes' },
                    { id: 'debug', label: 'DEBUG' },
                    { id: 'settings', label: 'Ajustes' },
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    // Lista and Pads open drawers directly (especially useful on mobile)
                    if (tab.id === 'setlist') {
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setIsCurrentListOpen(true)}
                                className="tab-btn"
                            >
                                {tab.label}
                            </button>
                        );
                    }
                    if (tab.id === 'library') {
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setIsLibraryMenuOpen(true)}
                                className="tab-btn"
                            >
                                {tab.label}
                            </button>
                        );
                    }
                    if (tab.id === 'pads') {
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setIsPadsOpen(o => !o)}
                                className={`tab-btn ${isPadsOpen ? 'active' : ''}`}
                            >
                                {tab.label}
                            </button>
                        );
                    }
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

            <div className="main-content">
                {/* MAIN STAGE (Mixer or Tab Content) */}
                <div className="main-stage-wrapper">
                    {loading ? (
                        <div style={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div className="loader"></div>
                        </div>
                    ) : (
                        <>
                            {activeTab ? (
                                <div className="tab-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                                                {activeTab === 'lyrics' ? 'Teleprompter' : activeTab === 'chords' ? 'Cifrado' : activeTab === 'debug' ? 'Sistema de Diagnóstico' : activeTab === 'partituras' ? '🎼 Partituras' : activeTab}
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
                                        {activeTab === 'debug' && (
                                            <div style={{ flex: 1, background: '#0a0a0e', borderRadius: '12px', padding: '20px', overflowY: 'auto', fontFamily: 'monospace' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '15px', alignItems: 'center' }}>
                                                    <span style={{ color: '#00bcd4', fontWeight: '800', fontSize: '1.1rem' }}>SISTEMA DE DIAGNÓSTICO ({debugLogs.length})</span>
                                                    <button onClick={() => setDebugLogs([])} style={{ background: '#f44336', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>LIMPIAR TODO</button>
                                                </div>
                                                {debugLogs.length === 0 && (
                                                    <div style={{ textAlign: 'center', padding: '100px 20px', color: '#444', fontSize: '1.1rem' }}>
                                                        No hay logs técnicos registrados.<br />
                                                        Presiona PLAY o cambia de canción para generar datos.
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {debugLogs.map((l, i) => (
                                                        <div key={i} style={{ color: l.type === 'err' ? '#f87171' : l.type === 'warn' ? '#fbbf24' : '#86efac', marginBottom: '2px', fontSize: '0.9rem', whiteSpace: 'pre-wrap', borderLeft: `4px solid ${l.type === 'err' ? '#f87171' : l.type === 'warn' ? '#fbbf24' : '#333'}`, paddingLeft: '12px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
                                                            <div style={{ color: '#555', fontSize: '0.7rem', marginBottom: '4px' }}>[{l.t}] - {l.type.toUpperCase()}</div>
                                                            {l.msg}
                                                        </div>
                                                    )).reverse()}
                                                </div>
                                            </div>
                                        )}
                                        {activeTab === 'partituras' && (
                                            <div style={{ flex: 1, display: 'flex', gap: '0', overflow: 'hidden', background: '#0a0a0e', borderRadius: '12px' }}>
                                                {/* Instrument selector sidebar */}
                                                <div style={{ width: '180px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px', paddingLeft: '6px' }}>Instrumento</div>
                                                    {activePartituras.length === 0 ? (
                                                        <div style={{ color: '#555', fontSize: '0.85rem', padding: '12px 6px', lineHeight: 1.5 }}>No hay partituras para esta canción.<br/>Súbelas desde el Dashboard.</div>
                                                    ) : (
                                                        activePartituras.map(p => (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => setSelectedPartitura(p)}
                                                                style={{
                                                                    background: selectedPartitura?.id === p.id ? 'rgba(0,188,212,0.15)' : 'rgba(255,255,255,0.03)',
                                                                    border: selectedPartitura?.id === p.id ? '1px solid #00bcd4' : '1px solid rgba(255,255,255,0.06)',
                                                                    borderRadius: '10px',
                                                                    color: selectedPartitura?.id === p.id ? '#00bcd4' : '#94a3b8',
                                                                    padding: '10px 10px',
                                                                    textAlign: 'left',
                                                                    cursor: 'pointer',
                                                                    fontWeight: selectedPartitura?.id === p.id ? '800' : '600',
                                                                    fontSize: '0.82rem',
                                                                    transition: 'all 0.18s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '7px'
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '1.1rem' }}>{{
                                                                    'Guitarra': '🎸', 'Piano': '🎹', 'Bajo': '🎸', 'Batería': '🥁',
                                                                    'Violín': '🎻', 'Acordeón': '🪗', 'Trompeta': '🎺', 'Saxofón': '🎷',
                                                                    'Flauta': '🎶', 'Teclado': '🎹', 'Ukulele': '🪕', 'Mandolina': '🪕',
                                                                    'Cello': '🎻', 'Contrabajo': '🎸', 'Clarinete': '🎷', 'Oboe': '🎶',
                                                                    'Coro': '🎤', 'Voz': '🎤',
                                                                }[p.instrument] || '🎵'}</span>
                                                                {p.instrument}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>

                                                {/* PDF Viewer area */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                    {selectedPartitura ? (
                                                        <>
                                                        {/* Toolbar bar above PDF */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#111', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                                                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>
                                                                {selectedPartitura.instrument}
                                                            </span>
                                                            <button
                                                                onClick={() => setPvFullscreen(true)}
                                                                title="Pantalla completa"
                                                                style={{ background: 'rgba(0,188,212,0.15)', border: '1px solid rgba(0,188,212,0.3)', borderRadius: '8px', color: '#00bcd4', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,188,212,0.3)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,188,212,0.15)'}
                                                            >
                                                                ⛶ Pantalla Completa
                                                            </button>
                                                        </div>
                                                        <iframe
                                                            key={selectedPartitura.id}
                                                            src={selectedPartitura.pdfUrl + '#toolbar=1&navpanes=0'}
                                                            title={`Partitura ${selectedPartitura.instrument}`}
                                                            style={{ flex: 1, border: 'none', width: '100%', height: '100%', background: 'white' }}
                                                        />
                                                        </>
                                                    ) : (
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', flexDirection: 'column', gap: '12px' }}>
                                                            <span style={{ fontSize: '3rem' }}>🎼</span>
                                                            <p style={{ fontSize: '1.1rem', color: '#555' }}>
                                                                {activeSongId ? 'Selecciona un instrumento para ver la partitura.' : 'Carga una canción primero.'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="mixer-wrapper">
                                    <Mixer tracks={tracks} />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* DESKTOP SIDEBAR — visible on web, hidden on mobile */}
                <aside className="sidebar desktop-only">
                    {/* Active Setlist Panel */}
                    <div className="setlist-panel">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ListMusic size={20} color="#00bcd4" />
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>{activeSetlist?.name || 'Lista de Canciones'}</h3>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => setIsLibraryMenuOpen(true)}
                                    style={{
                                        background: 'rgba(155, 89, 182, 0.1)',
                                        color: '#9b59b6',
                                        border: '1px solid rgba(155, 89, 182, 0.3)',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        transition: '0.2s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#9b59b6'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(155, 89, 182, 0.1)'; e.currentTarget.style.color = '#9b59b6'; }}
                                >
                                    +Canciones
                                </button>
                                <button
                                    onClick={() => setIsSetlistMenuOpen(true)}
                                    style={{
                                        background: 'rgba(0, 188, 212, 0.1)',
                                        color: '#00bcd4',
                                        border: '1px solid rgba(0, 188, 212, 0.3)',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        transition: '0.2s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#00bcd4'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 188, 212, 0.1)'; e.currentTarget.style.color = '#00bcd4'; }}
                                >
                                    +Setlist
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {!activeSetlist ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                    <p>No hay un setlist activo.</p>
                                    <button onClick={() => setIsSetlistMenuOpen(true)} className="action-btn">Mis Setlists</button>
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
                                                    onRemove={handleRemoveSongFromSetlist}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>

                    {/* Ambient Pads Panel */}
                    <div className="pads-panel" style={{ marginTop: '5px' }}>
                        <div className="pads-header" style={{ marginBottom: '10px' }}>
                            <button className={`pad-power-btn ${padActive ? 'active' : ''}`} onClick={() => setPadActive(!padActive)} style={{ width: '45px', height: '45px' }}>
                                <Power size={22} />
                            </button>
                            <div className="pad-title-section">
                                <h4 className="pad-title">Ambient Pads</h4>
                                <div className="pad-subtitle" style={{ fontSize: '0.7rem' }}>Fundamental Pads</div>
                            </div>
                            <div className="pad-pitch-control">
                                <button className="pad-pitch-btn" onClick={() => setPadPitch(p => Math.max(-1, p - 1))}>-</button>
                                <div className="pad-pitch-val">{padPitch > 0 ? `+${padPitch}` : padPitch}</div>
                                <button className="pad-pitch-btn" onClick={() => setPadPitch(p => Math.min(1, p + 1))}>+</button>
                            </div>
                        </div>
                        <div className="pad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                            {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                                <button key={k} className={`pad-key-btn ${padKey === k ? 'active' : ''}`} onClick={() => setPadKey(k)} style={{ height: '35px', fontSize: '0.85rem' }}>{k}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                            <button className={`pad-ms-btn ${padMute ? 'm-active' : ''}`} onClick={() => setPadMute(!padMute)} style={{ width: '45px', height: '32px' }}>M</button>
                            <button className={`pad-ms-btn ${padSolo ? 's-active' : ''}`} onClick={() => setPadSolo(!padSolo)} style={{ width: '45px', height: '32px' }}>S</button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* SLIDE-OUT MENUS (Overlay + Drawers) */}
            <div
                className={`drawer-overlay ${isSetlistMenuOpen || isLibraryMenuOpen || isSettingsOpen || isCurrentListOpen || isPadsOpen ? 'open' : ''}`}
                onClick={() => { setIsSetlistMenuOpen(false); setIsLibraryMenuOpen(false); setIsSettingsOpen(false); setIsCurrentListOpen(false); setIsPadsOpen(false); }}
            />

            {/* ── SETTINGS DRAWER ───────────────────────────────────────────────────────────── */}
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

                {/* ── 1. Dark Mode ──────────────────────────────────── */}
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
                        {[{ id: 'L', label: '◄ L', desc: 'Solo Izquierda' }, { id: 'mono', label: '● Mono', desc: 'Centro' }, { id: 'R', label: 'R ►', desc: 'Solo Derecha' }].map(opt => (
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
                            >-</button>
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

                {/* ── 4. Click Dinámico ────────────────────────────────── */}
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

            {/* 0. PADS DRAWER — mobile drawer for Pads */}
            <div className={`setlist-drawer ${isPadsOpen ? 'open' : ''}`} style={{ zIndex: 1005 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Ambient Pads</h2>
                    <button onClick={() => setIsPadsOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>&times;</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div className="pads-header" style={{ marginBottom: '20px' }}>
                        <button className={`pad-power-btn ${padActive ? 'active' : ''}`} onClick={() => setPadActive(!padActive)} style={{ width: '55px', height: '55px' }}><Power size={26} /></button>
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
                    <div className="pad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                        {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                            <button key={k} className={`pad-key-btn ${padKey === k ? 'active' : ''}`} onClick={() => setPadKey(k)} style={{ height: '60px', fontSize: '1.1rem' }}>{k}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button className={`pad-ms-btn ${padMute ? 'm-active' : ''}`} onClick={() => setPadMute(!padMute)} style={{ width: '60px', height: '40px' }}>M</button>
                        <button className={`pad-ms-btn ${padSolo ? 's-active' : ''}`} onClick={() => setPadSolo(!padSolo)} style={{ width: '60px', height: '40px' }}>S</button>
                    </div>
                </div>
            </div>

            {/* 0.5 CURRENT LIST DRAWER (Active Setlist Songs) */}
            <div className={`setlist-drawer ${isCurrentListOpen ? 'open' : ''}`} style={{ zIndex: 1006 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ListMusic size={22} color="#00bcd4" />
                        <h2 style={{ margin: 0 }}>{activeSetlist?.name || 'Lista de Canciones'}</h2>
                    </div>
                    <button onClick={() => setIsCurrentListOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>&times;</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
                    {!activeSetlist ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
                            No hay un setlist activo.
                            <button onClick={() => { setIsCurrentListOpen(false); setIsSetlistMenuOpen(true); }} className="action-btn" style={{ marginTop: '10px', width: '100%' }}>Abrir Mis Setlists</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            {(activeSetlist.songs || []).length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>Sin canciones en este setlist.</div>
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
                                                    onSelect={() => {
                                                        handleLoadSong(song);
                                                        setIsCurrentListOpen(false); // Close drawer on selection
                                                    }}
                                                    onRemove={handleRemoveSongFromSetlist}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                            <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                                <button onClick={() => setIsLibraryMenuOpen(true)} className="action-btn" style={{ flex: 1 }}>+ Añadir Pistas</button>
                                <button onClick={() => { setIsCurrentListOpen(false); setIsSetlistMenuOpen(true); }} className="action-btn secondary" style={{ flex: 1 }}>Mis Setlists</button>
                            </div>
                        </div>
                    )}
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

                    {/* Buscador de Pistas */}
                    <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <input
                            type="text"
                            placeholder={libraryTab === 'mine' ? "Buscar en mi librería..." : "Buscar pistas Global (VIP)..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                                color: '#333',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: '8px', border: '1px dashed #ccc', padding: '10px', overflowY: 'auto' }}>
                        {!currentUser ? (
                            <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '0.9rem' }}>
                                Debes iniciar sesión para ver la librería.
                            </div>
                        ) : (() => {
                            const songs = (libraryTab === 'mine' ? librarySongs : globalSongs).filter(song => {
                                if (!searchQuery) return true;
                                const q = searchQuery.toLowerCase();
                                return (
                                    song.name?.toLowerCase().includes(q) ||
                                    song.artist?.toLowerCase().includes(q) ||
                                    song.uploadedBy?.toLowerCase().includes(q)
                                );
                            });
                            if (songs.length === 0) return (
                                <div style={{ textAlign: 'center', color: '#666', marginTop: '30px', padding: '0 20px' }}>
                                    {searchQuery ? (
                                        <div style={{ fontSize: '0.9rem' }}>No se encontraron coincidencias para "{searchQuery}".</div>
                                    ) : (
                                        libraryTab === 'mine' ? (
                                        <>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>Tu librería está vacía</div>
                                            {!isAppNative && (
                                                <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                                    Para subir tus propias canciones, ingresa desde tu computadora a:<br />
                                                    <a href="https://www.zionstage.com" target="_blank" rel="noreferrer" style={{ color: '#00bcd4', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginTop: '8px', fontSize: '1rem' }}>www.zionstage.com</a>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.9rem' }}>No hay canciones globales todavía.</div>
                                    )
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
                                                    style={{
                                                        background: isDownloading ? '#f39c12' : (downloadProgress.songId ? '#ccc' : '#2ecc71'),
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '8px 10px',
                                                        borderRadius: '4px',
                                                        cursor: (isDownloading || downloadProgress.songId) ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                    title="Añadir a Setlist y Guardar Local"
                                                    onClick={() => !downloadProgress.songId && handleDownloadAndAdd(song)}
                                                    disabled={!!downloadProgress.songId}
                                                >
                                                    {isDownloading ? '⏳ Bajando...' : (downloadProgress.songId ? 'Espere...' : '➕ Añadir')}
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
            {/* PARTITURA FULLSCREEN OVERLAY */}
            {pvFullscreen && selectedPartitura && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: '#000',
                    display: 'flex', flexDirection: 'column'
                }}>
                    {/* Top bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#0a0a0e', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.3rem' }}>🎼</span>
                            <span style={{ color: 'white', fontWeight: '800', fontSize: '1rem' }}>{selectedPartitura.instrument}</span>
                        </div>
                        <button
                            onClick={() => setPvFullscreen(false)}
                            title="Cerrar (ESC)"
                            style={{
                                background: 'rgba(239,68,68,0.15)',
                                border: '2px solid rgba(239,68,68,0.4)',
                                borderRadius: '12px',
                                color: '#ef4444',
                                width: '46px', height: '46px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.35)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            <X size={26} />
                        </button>
                    </div>
                    {/* Full PDF */}
                    <iframe
                        key={`fs_${selectedPartitura.id}`}
                        src={selectedPartitura.pdfUrl + '#toolbar=1&navpanes=0&view=FitH'}
                        title={`Partitura FS ${selectedPartitura.instrument}`}
                        style={{ flex: 1, border: 'none', width: '100%', background: 'white' }}
                    />
                </div>
            )}
        </div>
    )
}

function SortableSongItem({ song, idx, isActive, pStatus, onSelect, onRemove }) {
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
            style={{ ...style, cursor: 'pointer' }}
            className={`setlist-song-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={onSelect}
        >
            <div className="song-item-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {/* Reorder handle */}
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }} onClick={(e) => e.stopPropagation()}>
                        <GripVertical size={16} />
                    </div>
                    <span className="song-index-badge">{idx + 1}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(song.id, e);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ff5252',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            marginLeft: '4px',
                            opacity: 0.7
                        }}
                        title="Eliminar del setlist"
                    >
                        <Trash2 size={16} />
                    </button>
                </span>
            </div>
            <div className="song-item-meta" style={{ marginLeft: '24px' }}>
                {song.artist && `${song.artist} • `}
                {song.key && `${song.key} • `}
                {song.tempo && `${song.tempo} BPM`}
            </div>
        </div>
    );
}
