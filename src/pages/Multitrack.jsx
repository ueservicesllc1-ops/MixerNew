import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { audioEngine } from '../AudioEngine'
import { Mixer } from '../components/Mixer'
import WaveformCanvas from '../components/WaveformCanvas'
import ProgressBar from '../components/ProgressBar'
import { Play, Pause, Square, SkipBack, SkipForward, Settings, Menu, RefreshCw, Trash2, LogIn, LogOut, Moon, Sun, Headphones, Type, Drum, X, Check, Power, GripVertical, ListMusic, Library as LibraryIcon, Search, ArrowRight } from 'lucide-react'
import { db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from '../firebase'
import { collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit, serverTimestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, or } from 'firebase/firestore'
import { getSongMusicalKey } from '../utils/transposer.js'

/** updateDoc sin documento → code `not-found` (SDK puede decir que no existe el documento / fila). */
function isFirestoreDocMissing(err) {
    return err?.code === 'not-found';
}

function clearMixerLastSetlistId() {
    try { localStorage.removeItem('mixer_lastSetlistId'); } catch { /* ignore */ }
}
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

/** Serializa preparación en APK: evita solapar getUri / I-O y picos de RAM. */
let isPreparingSong = false;
const PREPARE_YIELD_MS = 15;
const PREPARE_STAGGER_MS = 18;
function prepareYield() {
    return new Promise((r) => setTimeout(r, PREPARE_YIELD_MS));
}
function prepareStagger() {
    return new Promise((r) => setTimeout(r, PREPARE_STAGGER_MS));
}

const PREVIEW_TRACK_NAME = '__PreviewMix';

/** Stems required for NextGen playback; PreviewMix is visual-only and deferred. */
function filterCriticalDownloadableTracks(tracks) {
    return (tracks || []).filter(tr => tr.url && tr.url !== 'undefined' && tr.name !== PREVIEW_TRACK_NAME);
}

/**
 * True if every critical stem is already on disk for the given format plan (FLAC vs MP3 per stem).
 */
async function nativeAllCriticalStemsOnDisk(song, formatPlan) {
    const tracksData = filterCriticalDownloadableTracks(song.tracks);
    if (!tracksData.length) return true;
    const v2Set = new Set(formatPlan.v2StemNames);
    const { useFullFlac } = formatPlan;
    for (const tr of tracksData) {
        const useFlacStem = useFullFlac && v2Set.has(tr.name) && tr.normalizedReady === true && tr.normalizedUrl;
        const ok = useFlacStem
            ? await NativeEngine.isNormalizedDownloaded(song.id, tr.name)
            : await NativeEngine.isTrackDownloaded(song.id, tr.name);
        if (!ok) return false;
        await prepareYield();
    }
    return true;
}

/** Texto UI (español) según `nativeLoadProgress.phase` — solo presentación. */
function nativeLoadPhaseLabelEs(phase, loaded, total) {
    if (phase === 'downloading') {
        const n = Number(total) || 0;
        const l = Number(loaded) || 0;
        return n > 0 ? `Descargando stems... ${l}/${n}` : 'Descargando stems...';
    }
    if (phase === 'preparing') return 'Preparando canción...';
    return '';
}

/**
 * Nativo: formato único por canción — todos los stems v2 en FLAC local, o todos en MP3 originales.
 * No mezclar FLAC + MP3 entre stems en la misma carga.
 * Excluye __PreviewMix (no forma parte del plan de stems críticos).
 */
async function computeNativeSongFormatPlan(song) {
    const tracksData = filterCriticalDownloadableTracks(song.tracks);
    const v2Stems = tracksData.filter(tr => tr.normalizedReady === true && tr.normalizedUrl);
    const missingFlac = [];
    const m = v2Stems.length;
    let si = 0;
    for (const tr of v2Stems) {
        si++;
        console.log(`[QUEUE] processing track ${si}/${m} (format FLAC check)`);
        if (!(await NativeEngine.isNormalizedDownloaded(song.id, tr.name))) {
            missingFlac.push(tr.name);
        }
        await prepareYield();
        console.log('[QUEUE] delay inserted');
    }
    const allFlacAvailable = v2Stems.length > 0 && missingFlac.length === 0;
    const useFullFlac = allFlacAvailable;
    const v2StemNames = v2Stems.map(t => t.name);
    await prepareYield();

    return {
        useFullFlac,
        missingFlacNames: missingFlac,
        v2StemNames,
    };
}

/** Límite docs Global VIP (`isGlobal`) por query. La UI solo muestra entradas con `tracks.length > 0`. */
const WEB_GLOBAL_CATALOG_MAX = 600;
const NATIVE_GLOBAL_CATALOG_MAX = 400;

function sortGlobalCatalogNewestFirst(songs) {
    return [...songs].sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
    });
}

function parseSemverParts(s) {
    const m = String(s || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return [0, 0, 0];
    return [parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0, parseInt(m[3], 10) || 0];
}

/** True si remoteName es una versión más nueva que installedName (ej. 1.7.6 > 1.7.5). */
function isRemoteVersionNewer(remoteName, installedName) {
    const a = parseSemverParts(remoteName);
    const b = parseSemverParts(installedName);
    for (let i = 0; i < 3; i++) {
        if (a[i] > b[i]) return true;
        if (a[i] < b[i]) return false;
    }
    return false;
}

/** Entre dos metadatos remotos, el de versión semver más alta (para combinar Firestore + app-latest.json). */
function pickNewerMeta(a, b) {
    if (!a?.versionName) return b || null;
    if (!b?.versionName) return a || null;
    return isRemoteVersionNewer(a.versionName, b.versionName) ? a : b;
}

const DEFAULT_PROXY_FOR_UPDATES = 'https://mixernew-production.up.railway.app';

// ─── KEY TRANSPOSITION ────────────────────────────────────────────────────────
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };
function transposeKey(baseKey, semitones) {
    if (!baseKey || semitones === 0) return baseKey;
    const isMinor = baseKey.endsWith('m');
    const root = isMinor ? baseKey.slice(0, -1) : baseKey;
    const normalized = FLAT_TO_SHARP[root] ?? root;
    const idx = CHROMATIC.indexOf(normalized);
    if (idx === -1) return baseKey; // unknown format, show as-is
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    return CHROMATIC[newIdx] + (isMinor ? 'm' : '');
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── LIBRARY DRAWER ──────────────────────────────────────────────────────────
// Memoized to prevent re-renders when unrelated Multitrack state changes.
const LibraryDrawer = React.memo(function LibraryDrawer({
    isOpen, onClose,
    librarySongs, globalSongs,
    libraryTab, onTabChange,
    searchQuery, onSearchChange,
    currentUser, isAppNative,
    globalCatalogLoading,
    downloadProgress, onDownloadAdd,
    globalCatalogDocCount,
}) {
    const baseSongs = React.useMemo(() => {
        const base = libraryTab === 'mine'
            ? librarySongs
            : globalSongs.filter(s => Array.isArray(s.tracks) && s.tracks.length > 0);
        if (!searchQuery) return base;
        const q = searchQuery.toLowerCase();
        return base.filter(s =>
            s.name?.toLowerCase().includes(q) ||
            s.artist?.toLowerCase().includes(q) ||
            s.uploadedBy?.toLowerCase().includes(q)
        );
    }, [libraryTab, librarySongs, globalSongs, searchQuery]);

    return (
        <div className={`library-drawer ${isOpen ? 'open' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Pistas en la Nube</h2>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '2.5rem', cursor: 'pointer', color: '#666', padding: '10px' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* TABS */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: '#f0f0f0', padding: '4px', borderRadius: '8px' }}>
                    <button
                        onClick={() => onTabChange('mine')}
                        style={{ flex: 1, padding: '9px', background: libraryTab === 'mine' ? '#00d2d3' : 'transparent', color: libraryTab === 'mine' ? 'white' : '#555', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                    >
                        🎵 Mi Librería ({librarySongs.length})
                    </button>
                    <button
                        onClick={() => onTabChange('global')}
                        style={{ flex: 1, padding: '9px', background: libraryTab === 'global' ? '#9b59b6' : 'transparent', color: libraryTab === 'global' ? 'white' : '#555', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                    >
                        🌐 Global ({globalSongs.filter(s => Array.isArray(s.tracks) && s.tracks.length > 0).length})
                    </button>
                </div>

                {/* Buscador */}
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                    <input
                        type="text"
                        placeholder={libraryTab === 'mine' ? "Buscar en mi librería..." : "Buscar pistas Global (VIP)..."}
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#333', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
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
                    ) : globalCatalogLoading ? (
                        <div style={{ textAlign: 'center', color: '#666', marginTop: '40px', fontSize: '0.95rem' }}>
                            Cargando catálogo Global…
                        </div>
                    ) : baseSongs.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#666', marginTop: '30px', padding: '0 20px' }}>
                            {searchQuery ? (
                                <div style={{ fontSize: '0.9rem' }}>No se encontraron coincidencias para "{searchQuery}".</div>
                            ) : libraryTab === 'mine' ? (
                                <>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>Tu librería está vacía</div>
                                    {!isAppNative && (
                                        <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                            Para subir tus propias canciones, ingresa desde tu computadora a:<br />
                                            <a href="https://www.zionstage.com" target="_blank" rel="noreferrer" style={{ color: '#00bcd4', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginTop: '8px', fontSize: '1rem' }}>www.zionstage.com</a>
                                        </div>
                                    )}
                                </>
                            ) : libraryTab === 'global' && globalCatalogDocCount > 0 ? (
                                <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#555' }}>
                                    Hay {globalCatalogDocCount} tema(s) en el catálogo Global VIP, pero ninguno trae{' '}
                                    <strong>pistas multitrack</strong> en Firestore. Solo se listan canciones con al menos una pista.
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.9rem', lineHeight: 1.45, color: '#555' }}>
                                    No hay canciones Global VIP con pistas. Las publicadas en el marketplace aparecen aquí cuando tienen{' '}
                                    <code style={{ fontSize: '0.85rem' }}>isGlobal</code> y archivos en <code style={{ fontSize: '0.85rem' }}>tracks</code>.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {baseSongs.map(song => {
                                const isDownloading = downloadProgress.songId === song.id;
                                const isOtherUser = song.userId !== currentUser?.uid;
                                const listSongKey = getSongMusicalKey(song);
                                return (
                                    <div key={song.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'white', border: `1px solid ${isOtherUser ? '#e8d5f5' : '#eee'}`, borderRadius: '8px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 3px 0', color: '#333' }}>{song.name}</h4>
                                            <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                                {isOtherUser && song.uploadedBy && <span style={{ color: '#9b59b6', fontWeight: 'bold', marginRight: '6px' }}>👤 {song.uploadedBy}</span>}
                                                {song.artist && `${song.artist} • `}
                                                {listSongKey && `${listSongKey} • `}
                                                {song.tempo && `${song.tempo} BPM`}
                                            </div>
                                            {isDownloading && (
                                                <div style={{ color: '#00d2d3', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '4px' }}>
                                                    {downloadProgress.text}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            style={{ background: isDownloading ? '#f39c12' : (downloadProgress.songId ? '#ccc' : '#2ecc71'), color: 'white', border: 'none', padding: '8px 10px', borderRadius: '4px', cursor: (isDownloading || downloadProgress.songId) ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                            title="Añadir a Setlist y Guardar Local"
                                            onClick={() => !downloadProgress.songId && onDownloadAdd(song)}
                                            disabled={!!downloadProgress.songId}
                                        >
                                            {isDownloading ? '⏳ Bajando...' : (downloadProgress.songId ? 'Espere...' : '➕ Añadir')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
// ─────────────────────────────────────────────────────────────────────────────

export default function Multitrack() {
    const navigate = useNavigate();
    const location = useLocation();
    const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || "1.8.7";
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const progressRef = useRef(0); // Replaces progress state — avoids 60fps re-renders of the full component
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [proxyUrl, setProxyUrl] = useState(() => {
        const saved = localStorage.getItem('mixer_proxyUrl');
        if (saved) return saved;
        // Always default to Railway proxy — the local proxy (localhost:3001) also runs on the
        // same machine/ISP that may block B2, making it useless as a fallback. Railway can
        // always reach B2 regardless of the user's ISP.
        return 'https://mixernew-production.up.railway.app';
    });

    /** Descarga binaria vía proxy. Si `url` ya es `/api/download?url=...` (p. ej. normalizedUrl), no la envuelve otra vez. */
    const fetchBlobNative = useCallback(async (url) => {
        if (!url) return null;
        const u = String(url).trim();
        const alreadyProxied = u.includes('/api/download?url=');
        const reqUrl = alreadyProxied ? u : `${proxyUrl}/api/download?url=${encodeURIComponent(u)}`;
        const r2 = await fetch(reqUrl);
        if (!r2.ok) return null;
        return await r2.blob();
    }, [proxyUrl]);

    /** No bloquea la sesión NextGen: guarda __PreviewMix en disco para waveform/otros usos. */
    const deferPreviewMixDownload = useCallback((song) => {
        if (!isAppNative) return;
        const preview = (song.tracks || []).find(t => t.name === PREVIEW_TRACK_NAME);
        if (!preview?.url || preview.url === 'undefined') return;
        void (async () => {
            try {
                if (await NativeEngine.isTrackDownloaded(song.id, PREVIEW_TRACK_NAME)) return;
                console.log('[PreviewMix] deferred download start');
                const dl = await fetchBlobNative(preview.url);
                if (dl && dl.size > 500) {
                    await NativeEngine.saveTrackBlob(dl, `${song.id}_${preview.name}.mp3`);
                    console.log('[PreviewMix] deferred download done');
                }
            } catch (e) {
                console.warn('[PreviewMix] deferred download failed', e);
            }
        })();
    }, [fetchBlobNative]);

    /**
     * Nativo: si cada pista ya está en disco, arma el Map para el motor.
     * Respeta `formatPlan`: o todos los stems v2 en FLAC, o todos en MP3 (sin mezcla).
     * No incluye __PreviewMix (opcional; no va al motor en la primera carga).
     */
    const tryBuildNativeTrackMapFromDisk = useCallback(async (song, formatPlan) => {
        if (!isAppNative || !formatPlan) return null;
        const tracksData = filterCriticalDownloadableTracks(song.tracks);
        if (!tracksData.length) return null;
        const v2Set = new Set(formatPlan.v2StemNames);
        const { useFullFlac } = formatPlan;
        const n = tracksData.length;

        let i = 0;
        for (const tr of tracksData) {
            i++;
            console.log(`[QUEUE] processing track ${i}/${n} (disk exists check)`);
            const useFlacStem = useFullFlac && v2Set.has(tr.name) && tr.normalizedReady === true && tr.normalizedUrl;
            const ok = useFlacStem
                ? await NativeEngine.isNormalizedDownloaded(song.id, tr.name)
                : await NativeEngine.isTrackDownloaded(song.id, tr.name);
            if (!ok) return null;
            await prepareYield();
            console.log('[QUEUE] delay inserted');
        }

        const pathMap = new Map();
        i = 0;
        for (const tr of tracksData) {
            i++;
            console.log(`[QUEUE] processing track ${i}/${n} (resolve path)`);
            console.log('[QUEUE] getUri start');
            const useFlacStem = useFullFlac && v2Set.has(tr.name) && tr.normalizedReady === true && tr.normalizedUrl;
            let finalPath = '';
            if (useFlacStem) {
                finalPath = await NativeEngine.getNormalizedPath(song.id, tr.name);
            } else {
                finalPath = await NativeEngine.getTrackPath(song.id, tr.name);
            }
            console.log('[QUEUE] getUri done');
            pathMap.set(tr.name, { path: finalPath, audioBuf: null, rawBuf: null });
            await prepareYield();
            console.log('[QUEUE] delay inserted');
        }
        return pathMap;
    }, []);

    // Onda de preview en nativo: solo WaveformCanvas (evita doble fetch+decodeAudioData del __PreviewMix).

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
    const [globalCatalogLoading, setGlobalCatalogLoading] = useState(false);
    const [libraryTab, setLibraryTab] = useState('mine'); // 'mine' | 'global'
    const [searchQuery, setSearchQuery] = useState('');

    // Download States
    const [downloadProgress, setDownloadProgress] = useState({ songId: null, text: '' });
    const [nativeLoadProgress, setNativeLoadProgress] = useState(null); // { songId, loaded, total }
    // Active loaded song
    const [activeSongId, setActiveSongId] = useState(null);
    const [audioReady, setAudioReady] = useState(0); // Trigger re-renders when buffers finish decoding
    /** NextGen getSnapshot() durationSec — transport duration on native. */
    const [snapshotDurationSec, setSnapshotDurationSec] = useState(0);
    // Bottom tab panel
    const [activeTab, setActiveTab] = useState(null); // null | 'lyrics' | 'chords' | 'video' | 'settings' | 'partituras'

    // ── PARTITURAS STATES ──────────────────────────────────────────
    const [activePartituras, setActivePartituras] = useState([]); // list of {id, instrument, pdfUrl, songId}
    const [selectedPartitura, setSelectedPartitura] = useState(null); // currently opened partitura object
    const [pvFullscreen, setPvFullscreen] = useState(false);

    // ── QUICK TEXT SEARCH STATES ───────────────────────────────────
    const [viewedSongId, setViewedSongId] = useState(null);
    /** Nativo: mientras prepara una canción, evita letras/acordes y ondas pesadas en paralelo. */
    const [nativePrepareBusy, setNativePrepareBusy] = useState(false);
    /** APK: __PreviewMix puede existir en disco sin estar en tracks del setlist. */
    const [previewMixOnDisk, setPreviewMixOnDisk] = useState(false);
    const [quickTextSearch, setQuickTextSearch] = useState('');
    const [isSearchingTexts, setIsSearchingTexts] = useState(false);

    // ESC key closes fullscreen partitura
    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') setPvFullscreen(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        if (!isAppNative || !activeSongId) {
            setPreviewMixOnDisk(false);
            return undefined;
        }
        let cancelled = false;
        NativeEngine.isTrackDownloaded(activeSongId, PREVIEW_TRACK_NAME).then((ok) => {
            if (!cancelled) setPreviewMixOnDisk(!!ok);
        });
        return () => {
            cancelled = true;
        };
    }, [activeSongId]);

    // Login Details
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginIsRegister, setLoginIsRegister] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [loginSuccess, setLoginSuccess] = useState('');

    // ΓöÇΓöÇ SETTINGS PANEL STATES ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPadsOpen, setIsPadsOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mixer_darkMode') === 'true');
    const [panMode, setPanMode] = useState(() => localStorage.getItem('mixer_panMode') || 'mono'); // 'L' | 'R' | 'mono'
    const [appFontSize, setAppFontSize] = useState(() => parseInt(localStorage.getItem('mixer_appFontSize') || '14'));
    const [dynamicClick, setDynamicClick] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);

    /** APK nativo: aviso si en Firestore hay una versión más nueva que la embebida en el bundle. */
    const [appUpdateOffer, setAppUpdateOffer] = useState(null);
    const [showPwaInstallBanner, setShowPwaInstallBanner] = useState(false);
    const [showPwaInstallHint, setShowPwaInstallHint] = useState(false);
    const [pwaHintCountdown, setPwaHintCountdown] = useState(5);

    useEffect(() => {
        const params = new URLSearchParams(location.search || '');
        const fromInstallFlow = params.get('installPwa') === '1' || localStorage.getItem('mixer_pwa_install_flow') === '1';
        if (!fromInstallFlow) return;
        localStorage.removeItem('mixer_pwa_install_flow');
        if (params.get('installPwa') === '1') navigate('/multitrack', { replace: true });

        // Don't show banner if already running as installed PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (isStandalone) return;

        setShowPwaInstallBanner(true);
        setShowPwaInstallHint(false);

        // Auto-dismiss after 5s if browser hasn't offered the install prompt
        const timer = setTimeout(() => {
            if (!window._pwaInstallPrompt) setShowPwaInstallBanner(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, [location.search, navigate]);

    const handleDesktopPwaInstall = async () => {
        const prompt = window._pwaInstallPrompt;
        if (prompt) {
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') {
                window._pwaInstallPrompt = null;
                setShowPwaInstallBanner(false);
                return;
            }
        }
        setPwaHintCountdown(5);
        setShowPwaInstallHint(true);
        let secs = 5;
        const cd = setInterval(() => {
            secs -= 1;
            setPwaHintCountdown(secs);
            if (secs <= 0) {
                clearInterval(cd);
                setShowPwaInstallBanner(false);
                setShowPwaInstallHint(false);
            }
        }, 1000);
    };

    // Intercept console.log/error to show on-screen (for debugging without USB). Desactivado en APK: los callbacks
    // de Capacitor loguean objetos enormes (p. ej. base64 de readFile) y guardarlos en estado React dispara OOM.
    useEffect(() => {
        if (isAppNative) return;
        const origLog = console.log;
        const origErr = console.error;
        const origWarn = console.warn;
        const push = (type, args) => {
            let msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            if (msg.length > 500) msg = msg.slice(0, 500) + '…[truncado]';
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
    const [padVolume, setPadVolume] = useState(0.8);
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
                if (isFirestoreDocMissing(err)) {
                    console.warn('[Setlist] Documento no existe; limpiando selección.');
                    setActiveSetlist(null);
                    clearMixerLastSetlistId();
                    return;
                }
                console.error("Error al guardar orden en Firebase:", err);
                setActiveSetlist(activeSetlist);
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

    // Comprobar actualización (solo nativo): Firestore + /app-latest.json en el proxy (no depende de que el CLI escriba en Firestore).
    useEffect(() => {
        if (!isAppNative) return;
        let cancelled = false;
        (async () => {
            let fromFirestore = null;
            try {
                if (db) {
                    const q = query(collection(db, 'app_versions'), orderBy('createdAt', 'desc'), limit(1));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const row = snap.docs[0].data();
                        if (row.versionName && row.downloadUrl) {
                            fromFirestore = {
                                versionName: String(row.versionName),
                                downloadUrl: String(row.downloadUrl),
                                releaseNotes: row.releaseNotes ? String(row.releaseNotes) : ''
                            };
                        }
                    }
                }
            } catch (e) {
                console.warn('Update check (Firestore):', e?.message || e);
            }
            if (cancelled) return;

            let fromJson = null;
            try {
                const savedProxy = typeof localStorage !== 'undefined'
                    ? localStorage.getItem('mixer_proxyUrl')
                    : null;
                const bases = [...new Set([
                    (savedProxy && savedProxy.startsWith('http')) ? savedProxy.replace(/\/$/, '') : null,
                    DEFAULT_PROXY_FOR_UPDATES
                ].filter(Boolean))];

                for (const base of bases) {
                    for (const path of ['/app-latest.json', '/api/app-latest']) {
                        const r = await fetch(`${base}${path}?cb=${Date.now()}`, { cache: 'no-store' });
                        if (!r.ok) continue;
                        const j = await r.json();
                        if (j?.versionName && j?.downloadUrl) {
                            fromJson = {
                                versionName: String(j.versionName),
                                downloadUrl: String(j.downloadUrl),
                                releaseNotes: j.releaseNotes ? String(j.releaseNotes) : ''
                            };
                            break;
                        }
                    }
                    if (fromJson) break;
                }
            } catch (e) {
                console.warn('Update check (app-latest.json):', e?.message || e);
            }
            if (cancelled) return;

            const row = pickNewerMeta(fromFirestore, fromJson);
            if (!row?.versionName || !row.downloadUrl) return;

            const dismissKey = `mixer_dismiss_update_${row.versionName}`;
            if (localStorage.getItem(dismissKey) === '1') return;
            if (!isRemoteVersionNewer(row.versionName, CURRENT_VERSION)) return;

            setAppUpdateOffer({
                versionName: row.versionName,
                downloadUrl: row.downloadUrl,
                releaseNotes: row.releaseNotes || ''
            });
        })();
        return () => { cancelled = true; };
    }, [CURRENT_VERSION]);

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

    // APK: sin precarga en segundo plano — no usar este límite en nativo (preloadSetlistSongs es no-op).
    // Web: AudioBuffers decodificados → limitamos por RAM disponible.
    const MAX_DECODED_SONGS = isAppNative
        ? 1
        : estimatedRAM <= 4 ? 3
            : estimatedRAM <= 8 ? 4
                : estimatedRAM <= 16 ? 5
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
                    const subset = (found.songs || []).slice(0, 2);
                    preloadSetlistSongs(subset);
                }
            }
            hasAutoLoaded.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setlists, activeSetlist]);

    // Preload first 2 songs whenever the active setlist changes (covers manual selection too)
    useEffect(() => {
        if (!activeSetlist?.songs?.length) return;
        const subset = (activeSetlist.songs).slice(0, 2).filter(s => !preloadCache.current.has(s.id));
        if (subset.length > 0) preloadSetlistSongs(subset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSetlist?.id]);

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

                // Global VIP: solo docs con isGlobal (marketplace / catálogo publicado). La UI filtra las que tienen tracks[].
                let unsubGlobal = () => {};
                if (!isAppNative) {
                    // Query 1: Multitracks (items with tempo field, which CIF lack)
                    const qMT = query(
                        collection(db, 'songs'),
                        where('tempo', '>=', ''),
                        limit(800)
                    );
                    
                    // Query 2: Marketplace / Global explicitly marked
                    const qG = query(
                        collection(db, 'songs'),
                        or(
                            where('isGlobal', '==', true),
                            where('forSale', '==', true)
                        ),
                        limit(400)
                    );

                    let resultsMT = [];
                    let resultsG = [];
                    
                    const updateMerged = () => {
                        const all = [...resultsMT];
                        resultsG.forEach(g => {
                            if (!all.find(x => x.id === g.id)) all.push(g);
                        });
                        setGlobalSongs(sortGlobalCatalogNewestFirst(all));
                    };

                    const unsubMT = onSnapshot(qMT, (snap) => {
                        resultsMT = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        updateMerged();
                    }, () => setGlobalCatalogLoading(false));

                    const unsubG = onSnapshot(qG, (snap) => {
                        resultsG = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        updateMerged();
                    }, () => setGlobalCatalogLoading(false));

                    unsubGlobal = () => { unsubMT(); unsubG(); };
                }

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
                        if (!updated) clearMixerLastSetlistId();
                        // Si el doc fue borrado (otro dispositivo / consola), no dejar copia local obsoleta
                        return updated ?? null;
                    });
                }, (error) => {
                    console.error('Error cargando setlists:', error);
                });

                return () => { unsubSongs(); unsubGlobal(); unsubSetlists(); };
            } else {
                // Usuario sin sesi├│n ΓåÆ limpiar todo
                setLibrarySongs([]);
                setGlobalSongs([]);
                setGlobalCatalogLoading(false);
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
            audioEngine.onProgress = (t) => {
                if (!window.Capacitor?.isNativePlatform?.()) progressRef.current = t;
            };
            setLoading(false);
        };
        initCore();

        return () => {
            unsubAuth();
            if (audioEngine) audioEngine.onProgress = null;
        };
    }, []);

    // APK: catálogo Global solo al elegir la pestaña (getDocs acotado). Al volver a "Mi librería" se vacía para liberar RAM.
    useEffect(() => {
        if (!isAppNative || !currentUser) return;
        if (libraryTab !== 'global') {
            setGlobalSongs([]);
            setGlobalCatalogLoading(false);
            return;
        }
        let cancelled = false;
        setGlobalCatalogLoading(true);
        (async () => {
            try {
                const qMT = query(
                    collection(db, 'songs'),
                    where('tempo', '>=', ''),
                    limit(600)
                );
                const qG = query(
                    collection(db, 'songs'),
                    or(
                        where('isGlobal', '==', true),
                        where('forSale', '==', true)
                    ),
                    limit(400)
                );
                
                const [snapMT, snapG] = await Promise.all([getDocs(qMT), getDocs(qG)]);
                const songs = [];
                snapMT.forEach(d => songs.push({ id: d.id, ...d.data() }));
                snapG.forEach(d => {
                    if (!songs.find(x => x.id === d.id)) songs.push({ id: d.id, ...d.data() });
                });

                if (!cancelled) setGlobalSongs(sortGlobalCatalogNewestFirst(songs));
            } catch (e) {
                console.error('[Global catalog]', e);
                if (!cancelled) setGlobalSongs([]);
            } finally {
                if (!cancelled) setGlobalCatalogLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [libraryTab, currentUser, isAppNative]);

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
        const subset = (list.songs || []).slice(0, 2);
        preloadSetlistSongs(subset);
    };

    // Precarga vecinos al cambiar setlist o la canción activa (antes solo [songs] → no se movía al tocar otra fila).
    useEffect(() => {
        if (activeSetlist && activeSetlist.songs) {
            const currentIndex = activeSetlist.songs.findIndex(s => s.id === activeSongId);
            const startIdx = Math.max(0, currentIndex === -1 ? 0 : currentIndex);
            const subset = activeSetlist.songs.slice(startIdx, startIdx + 3);
            preloadSetlistSongs(subset);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSetlist?.songs, activeSongId]);


    // Precarga solo en web (IndexedDB + AudioBuffers). En APK desactivado: llenaba memoria y C++ colas → cierres en 4.º tema.
    const preloadSetlistSongs = async (songs) => {
        if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return;

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

                        // Web: prefer FLAC v2 when server has normalized the track
                        const useFlacWeb = tr.normalizedReady === true && tr.normalizedUrl;
                        let rawBuf = useFlacWeb
                            ? await LocalFileManager.getTrackLocalV2(song.id, tr.name)
                            : await LocalFileManager.getTrackLocal(song.id, tr.name);

                        if (!rawBuf) {
                            const downloadUrl = useFlacWeb ? tr.normalizedUrl
                                : `${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`;
                            const res = await fetch(downloadUrl);
                            if (!res.ok) return;
                            rawBuf = await res.blob();
                            if (rawBuf) {
                                if (useFlacWeb) {
                                    await LocalFileManager.saveTrackLocalV2(song.id, tr.name, rawBuf);
                                    // Remove stale v1 entry if present
                                    await LocalFileManager.removeTrackLocal(song.id, tr.name);
                                } else {
                                    await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                                }
                            }
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
                            if (useFlacWeb) await LocalFileManager.removeTrackLocalV2(song.id, tr.name);
                            else await LocalFileManager.removeTrackLocal(song.id, tr.name);
                            trackBuffers.set(tr.name, { error: true });
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

                    if (activeSongId === songIdToRemove) {
                        await audioEngine.stop();
                        audioEngine.clear();
                        setIsPlaying(false);
                        progressRef.current = 0;
                        setActiveSongId(null);
                        setTracks([]);
                    }
                }
            } catch (error) {
                if (isFirestoreDocMissing(error)) {
                    console.warn('[Setlist] Documento no existe al remover canción.');
                    setActiveSetlist(null);
                    clearMixerLastSetlistId();
                    alert('Este setlist ya no existe en la nube. Elegí otro setlist.');
                    return;
                }
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

                /**
                 * Descarga una pista via Railway proxy.
                 */
                const downloadBlob = async () => {
                    const r = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                    if (!r.ok) throw new Error(`Error ${r.status} descargando ${tr.name}`);
                    return await r.blob();
                };

                if (isAppNative) {
                    const useFlac = tr.normalizedReady === true && tr.normalizedUrl;
                    if (useFlac) {
                        const flacCached = await NativeEngine.isNormalizedDownloaded(song.id, tr.name);
                        if (!flacCached) {
                            const blob = await fetch(tr.normalizedUrl).then(r => r.blob()).catch(() => null);
                            if (blob && blob.size > 500) {
                                await NativeEngine.saveTrackBlob(blob, `${song.id}_${tr.name}.flac`);
                                await NativeEngine.invalidateLegacyCache(song.id, tr.name);
                            }
                        }
                    } else {
                        const alreadyHasFile = await NativeEngine.isTrackDownloaded(song.id, tr.name);
                        if (!alreadyHasFile) {
                            const blobData = await downloadBlob();
                            await NativeEngine.saveTrackBlob(blobData, `${song.id}_${tr.name}.mp3`);
                        }
                    }
                } else {
                    // Web path: prefer FLAC v2 if available
                    const useFlacWeb = tr.normalizedReady === true && tr.normalizedUrl;
                    let rawBuf = useFlacWeb
                        ? await LocalFileManager.getTrackLocalV2(song.id, tr.name)
                        : await LocalFileManager.getTrackLocal(song.id, tr.name);
                    if (!rawBuf) {
                        rawBuf = useFlacWeb
                            ? await fetch(tr.normalizedUrl).then(r => r.blob()).catch(() => null)
                            : await downloadBlob();
                        if (rawBuf) {
                            if (useFlacWeb) {
                                await LocalFileManager.saveTrackLocalV2(song.id, tr.name, rawBuf);
                                await LocalFileManager.removeTrackLocal(song.id, tr.name);
                            } else {
                                await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                            }
                        }
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

            await updateDoc(doc(db, 'setlists', activeSetlist.id), {
                songs: arrayUnion(song)
            });

            setIsLibraryMenuOpen(false);
        } catch (error) {
            if (isFirestoreDocMissing(error)) {
                console.warn('[Setlist] Documento no existe al añadir canción.');
                setActiveSetlist(null);
                clearMixerLastSetlistId();
                alert('Este setlist ya no existe en la nube. Creá o elegí otro setlist e intentá de nuevo.');
                return;
            }
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
            setActiveSongId(song.id);
            return;
        }

        const isAppNativeLoad = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

        if (isAppNativeLoad && isPreparingSong) {
            console.log('[PREPARE] ignored, already running');
            return;
        }

        // Nativo: primero cortar polling y audio (antes de setState/render) para no acumular callbacks al bridge.
        if (isAppNativeLoad) {
            isPreparingSong = true;
            audioEngine.setSongPreparationActive(true);
            await audioEngine.stop();
            console.log('[SELECT] native stop (inmediato, antes de UI)');
            setNativePrepareBusy(true);
        }

        console.log(`[SELECT] start "${song.name}" (${song.id})`);
        console.log(`[SELECT] Seleccionando "${song.name}"...`);
        setActiveSongId(song.id);
        setViewedSongId(song.id);
        setTracks([]);
        setIsPlaying(false);
        progressRef.current = 0;
        setSnapshotDurationSec(0);
        setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));

        try {
            // Web: al seleccionar se libera el motor anterior.
            if (!isAppNativeLoad) {
                await audioEngine.stop();
                await audioEngine.clear();
                preloadCache.current.clear();
                lruOrder.current = [];
            }

            const skeleton = (song.tracks || [])
                .filter(tr => tr.name !== '__PreviewMix')
                .map(tr => ({
                    id: `${song.id}_${tr.name}`,
                    name: tr.name,
                    isPlaceholder: true
                }));
            setTracks(skeleton);
            setLoading(false);

            let nativeFormatPlan = null;
            if (isAppNativeLoad) {
                await prepareStagger();
                console.log('[PREPARE] begin');
                nativeFormatPlan = await computeNativeSongFormatPlan(song);
            }

            await audioEngine.init();

            let cachedBuffers = null;
            if (isAppNativeLoad) {
                const allStemsLocal = await nativeAllCriticalStemsOnDisk(song, nativeFormatPlan);
                console.log('[CACHE] all stems local =', allStemsLocal);
                if (allStemsLocal) {
                    const diskMap = await tryBuildNativeTrackMapFromDisk(song, nativeFormatPlan);
                    cachedBuffers = diskMap && diskMap.size > 0 ? diskMap : null;
                    if (cachedBuffers) {
                        preloadCache.current.set(song.id, new Map(cachedBuffers));
                    }
                }
            } else {
                cachedBuffers = preloadCache.current.get(song.id);
                if (!cachedBuffers || cachedBuffers.size === 0) {
                    const diskMap = await tryBuildNativeTrackMapFromDisk(song, null);
                    if (diskMap && diskMap.size > 0) {
                        preloadCache.current.set(song.id, diskMap);
                        touchLRU(song.id);
                        cachedBuffers = diskMap;
                    }
                }
            }

            if (cachedBuffers && cachedBuffers.size > 0) {
                if (!isAppNativeLoad) touchLRU(song.id);

                const batch = [];
                const newTracks = [];
                for (const [trackName, cached] of cachedBuffers.entries()) {
                    if (isAppNativeLoad && trackName === PREVIEW_TRACK_NAME) continue;
                    const trackId = `${song.id}_${trackName}`;
                    const isVisual = trackName === PREVIEW_TRACK_NAME;
                    batch.push({
                        id: trackId,
                        path: cached.path,
                        audioBuffer: cached.audioBuf,
                        sourceData: cached.rawBuf,
                        isVisualOnly: isVisual
                    });
                    if (!isVisual) newTracks.push({ id: trackId, name: trackName });
                }

                if (isAppNativeLoad) {
                    setNativeLoadProgress({
                        songId: song.id,
                        phase: 'preparing',
                        label: 'Preparing song...',
                        loaded: 1,
                        total: 1,
                    });
                    console.log('[LOAD] start local session');
                    await prepareYield();
                }
                await audioEngine.addTracksBatch(batch);
                if (isAppNativeLoad) {
                    await prepareYield();
                    console.log('[LOAD] ready');
                    setNativeLoadProgress(null);
                    deferPreviewMixDownload(song);
                }
                setTracks(newTracks);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
                setAudioReady(prev => prev + 1);

                if (!isAppNativeLoad && activeSetlist?.songs) {
                    const allSongs = activeSetlist.songs;
                    const currentIdx = allSongs.findIndex(s => s.id === song.id);
                    if (currentIdx !== -1) {
                        const subset = allSongs.slice(currentIdx + 1, currentIdx + 2).filter(s => !preloadCache.current.has(s.id));
                        if (subset.length > 0) preloadSetlistSongs(subset);
                    }
                }
                return;
            }

            setPreloadStatus(prev => ({ ...prev, [song.id]: 'loading' }));

            try {
                if (!isAppNativeLoad) evictOldestIfNeeded();
                const trackBuffers = new Map();
                const tracksData = song.tracks || [];

                const downloadableTracks = isAppNativeLoad
                    ? filterCriticalDownloadableTracks(tracksData)
                    : tracksData.filter(tr => tr.url && tr.url !== 'undefined');
                let loadedCount = 0;
                if (isAppNativeLoad) {
                    console.log('[DOWNLOAD] start');
                    setNativeLoadProgress({
                        songId: song.id,
                        phase: 'downloading',
                        label: 'Downloading stems...',
                        loaded: 0,
                        total: Math.max(1, downloadableTracks.length),
                    });
                }

                if (isAppNativeLoad) {
                    let ti = 0;
                    for (const tr of downloadableTracks) {
                        ti++;
                        console.log(`[QUEUE] processing track ${ti}/${downloadableTracks.length}`);
                        await prepareStagger();

                        let finalPath = '';
                        const blob = null;
                        const useFlacStem = nativeFormatPlan?.useFullFlac === true
                            && tr.normalizedReady === true
                            && tr.normalizedUrl;
                        try {
                            if (useFlacStem) {
                                const flacCached = await NativeEngine.isNormalizedDownloaded(song.id, tr.name);
                                if (flacCached) {
                                    console.log('[QUEUE] getUri start');
                                    finalPath = await NativeEngine.getNormalizedPath(song.id, tr.name);
                                    console.log('[QUEUE] getUri done');
                                } else {
                                    const dl = await fetchBlobNative(tr.normalizedUrl);
                                    if (dl) {
                                        finalPath = await NativeEngine.saveTrackBlob(dl, `${song.id}_${tr.name}.flac`);
                                        await NativeEngine.invalidateLegacyCache(song.id, tr.name);
                                    }
                                }
                            } else {
                                const alreadyHasFile = await NativeEngine.isTrackDownloaded(song.id, tr.name);
                                if (alreadyHasFile) {
                                    console.log('[QUEUE] getUri start');
                                    finalPath = await NativeEngine.getTrackPath(song.id, tr.name);
                                    console.log('[QUEUE] getUri done');
                                } else {
                                    const dl = await fetchBlobNative(tr.url);
                                    if (dl) {
                                        finalPath = await NativeEngine.saveTrackBlob(dl, `${song.id}_${tr.name}.mp3`);
                                    }
                                }
                            }
                        } catch (e) { console.error("Error loading track file native:", tr.name, e); }

                        const audioBuf = null;
                        trackBuffers.set(tr.name, { path: finalPath, audioBuf, rawBuf: blob });
                        loadedCount++;
                        setNativeLoadProgress({
                            songId: song.id,
                            phase: 'downloading',
                            label: 'Downloading stems...',
                            loaded: loadedCount,
                            total: Math.max(1, downloadableTracks.length),
                        });
                        await prepareYield();
                        console.log('[QUEUE] delay inserted');
                    }
                    console.log('[DOWNLOAD] done');
                    setNativeLoadProgress({
                        songId: song.id,
                        phase: 'preparing',
                        label: 'Preparing song...',
                        loaded: Math.max(1, downloadableTracks.length),
                        total: Math.max(1, downloadableTracks.length),
                    });
                } else {
                    const batchSize = 3;
                    for (let i = 0; i < tracksData.length; i += batchSize) {
                        const batchChunk = tracksData.slice(i, i + batchSize);
                        await Promise.all(batchChunk.map(async (tr) => {
                            if (!tr.url || tr.url === 'undefined') return;

                            const useFlacWeb = tr.normalizedReady === true && tr.normalizedUrl;
                            let rawBuf = useFlacWeb
                                ? await LocalFileManager.getTrackLocalV2(song.id, tr.name)
                                : await LocalFileManager.getTrackLocal(song.id, tr.name);

                            if (!rawBuf) {
                                try {
                                    const downloadUrl = useFlacWeb ? tr.normalizedUrl
                                        : `${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`;
                                    const res = await fetch(downloadUrl);
                                    if (res.ok) rawBuf = await res.blob();
                                } catch { /* ignore */ }
                                if (rawBuf) {
                                    if (useFlacWeb) {
                                        await LocalFileManager.saveTrackLocalV2(song.id, tr.name, rawBuf);
                                        await LocalFileManager.removeTrackLocal(song.id, tr.name);
                                    } else {
                                        await LocalFileManager.saveTrackLocal(song.id, tr.name, rawBuf);
                                    }
                                }
                            }

                            let audioBuf = null;
                            if (rawBuf) {
                                try {
                                    const arrayBuf = await rawBuf.arrayBuffer();
                                    audioBuf = await audioEngine.ctx.decodeAudioData(arrayBuf);
                                } catch {
                                    if (useFlacWeb) await LocalFileManager.removeTrackLocalV2(song.id, tr.name);
                                    else await LocalFileManager.removeTrackLocal(song.id, tr.name);
                                }
                            }
                            trackBuffers.set(tr.name, { rawBuf, audioBuf });
                        }));
                    }
                }

                preloadCache.current.set(song.id, trackBuffers);
                if (!isAppNativeLoad) touchLRU(song.id);

                const batchMove = [];
                const newTracksList = [];
                for (const [trackName, cached] of trackBuffers.entries()) {
                    if (isAppNativeLoad && trackName === PREVIEW_TRACK_NAME) continue;
                    const trackId = `${song.id}_${trackName}`;
                    const isVisual = trackName === PREVIEW_TRACK_NAME;
                    batchMove.push({
                        id: trackId,
                        path: cached.path,
                        audioBuffer: cached.audioBuf,
                        sourceData: cached.rawBuf,
                        isVisualOnly: isVisual
                    });
                    if (!isVisual) newTracksList.push({ id: trackId, name: trackName });
                }

                if (isAppNativeLoad) {
                    console.log('[LOAD] start local session');
                    await prepareYield();
                }
                await audioEngine.addTracksBatch(batchMove);
                if (isAppNativeLoad) {
                    await prepareYield();
                    console.log('[LOAD] ready');
                    setNativeLoadProgress(null);
                    deferPreviewMixDownload(song);
                }
                if (!isAppNativeLoad && !(audioEngine._durationHint > 1)) {
                    const previewEntry = trackBuffers.get(PREVIEW_TRACK_NAME);
                    const bufDur = previewEntry?.audioBuf?.duration;
                    if (bufDur > 1) audioEngine._durationHint = bufDur;
                    else if (song.duration > 1) audioEngine._durationHint = song.duration;
                }

                if (!isAppNativeLoad && !(audioEngine._durationHint > 1)) {
                    const previewEntry2 = trackBuffers.get(PREVIEW_TRACK_NAME);
                    const bufDur2 = previewEntry2?.audioBuf?.duration;
                    if (bufDur2 > 1) audioEngine._durationHint = bufDur2;
                }

                setTracks(newTracksList);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
                setAudioReady(prev => prev + 1);

            } catch (err) {
                console.error(`[ERROR] No se pudo cargar "${song.name}":`, err);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
            }
        } finally {
            if (isAppNativeLoad) {
                isPreparingSong = false;
                setNativePrepareBusy(false);
                audioEngine.setSongPreparationActive(false);
            }
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
            setLoginSuccess('');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, loginEmail);
            setLoginError('');
            setLoginSuccess('✓ Correo enviado. Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.');
        } catch (error) {
            console.error("Reset Password Error:", error);
            setLoginSuccess('');
            if (error.code === 'auth/user-not-found') {
                setLoginError('No existe una cuenta con ese correo.');
            } else if (error.code === 'auth/invalid-email') {
                setLoginError('El correo ingresado no es válido.');
            } else {
                setLoginError('Error al enviar el correo. Intenta de nuevo.');
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
            console.error("Logout fall├│:", error);
        }
    };

    /** Pistas reales en el mezclador (no placeholders del esqueleto mientras carga). */
    const tracksReadyForEngine =
        tracks.length > 0 && tracks.every((t) => !t.isPlaceholder);

    /** Incluye descarga/preparación nativa visible y progreso de stems. */
    const loadBlockingPlayback =
        !!(nativeLoadProgress?.songId === activeSongId && nativeLoadProgress?.phase);

    /** Misma idea que la onda nativa: `ready`, motor libre, stems reales cargados. */
    const canStartPlayback = Boolean(
        activeSongId &&
            tracksReadyForEngine &&
            preloadStatus[activeSongId] === 'ready' &&
            !nativePrepareBusy &&
            !loadBlockingPlayback,
    );

    const handlePlay = async () => {
        await audioEngine.init();
        if (isPlaying) {
            await audioEngine.pause();
            setIsPlaying(false);
        } else {
            if (!canStartPlayback) return;
            await audioEngine.play();
            setIsPlaying(true);
        }
    };

    const handleStop = async () => {
        await audioEngine.stop();
        setIsPlaying(false);
        progressRef.current = 0;
    };

    const handleRewind = async () => {
        await audioEngine.stop();
        setIsPlaying(false);
        progressRef.current = 0;
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
        if (progressRef.current > 3) {
            await audioEngine.stop();
            setIsPlaying(false);
            progressRef.current = 0;
        } else if (activeSetlist?.songs?.length && activeSongId) {
            const songs = activeSetlist.songs;
            const currentIdx = songs.findIndex(s => s.id === activeSongId);
            if (currentIdx > 0) {
                handleLoadSong(songs[currentIdx - 1]);
            } else {
                await audioEngine.stop();
                setIsPlaying(false);
                progressRef.current = 0;
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
        // NextGen native (SoundTouch) clamps to ±3 semitones — keep UI in sync so +/- is audible.
        const min = isAppNative ? -3 : -12;
        const max = isAppNative ? 3 : 12;
        const newOffset = Math.max(min, Math.min(max, pitchOffset + delta));
        setPitchOffset(newOffset);
        audioEngine.setPitch(newOffset);
    };
    const handlePitchReset = () => {
        setPitchOffset(0);
        audioEngine.setPitch(0);
    };

    useEffect(() => {
        setPitchOffset(0);
        audioEngine.setPitch(0);
    }, [activeSongId]);

    // Format time (e.g. 02:03)
    const formatTime = (secs) => {
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Canción activa: mezclar entrada del setlist con el doc vivo de Firestore (librería / global)
    // para no perder `key`, `tempo`, etc. si el array del setlist está desactualizado o es mínimo.
    const fromSetlist = (activeSetlist?.songs || []).find(s => s.id === activeSongId) || null;
    const liveSong = librarySongs.find(s => s.id === activeSongId)
        || globalSongs.find(s => s.id === activeSongId);
    const activeSong = liveSong
        ? { ...fromSetlist, ...liveSong }
        : fromSetlist;

    const songKeyForUi = getSongMusicalKey(activeSong);

    const onNextGenPlaybackSnapshot = useCallback(({ positionSec, durationSec }) => {
        progressRef.current = positionSec;
        if (durationSec > 1) setSnapshotDurationSec(durationSec);
    }, []);

    const totalDuration = React.useMemo(() => {
        const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
        const validDur = (v) => Number.isFinite(v) && v > 1;

        // Android contract: no fake 180 fallback.
        if (isNative) {
            if (snapshotDurationSec > 1) return snapshotDurationSec;
            // 1) Prefer decoded buffers already loaded in web map (if any)
            let best = 0;
            if (audioEngine.tracks && audioEngine.tracks.size > 0) {
                for (const [, track] of audioEngine.tracks.entries()) {
                    if (validDur(track?.buffer?.duration)) best = Math.max(best, track.buffer.duration);
                }
            }
            // 2) Native metadata map may hold preview decoded buffer for visuals
            if (audioEngine._trackMeta && audioEngine._trackMeta.size > 0) {
                for (const [, meta] of audioEngine._trackMeta.entries()) {
                    if (validDur(meta?.buffer?.duration)) best = Math.max(best, meta.buffer.duration);
                }
            }
            // 3) Song metadata duration from DB
            if (validDur(activeSong?.duration)) best = Math.max(best, activeSong.duration);
            // 4) Engine hint if available
            if (validDur(audioEngine._durationHint)) best = Math.max(best, audioEngine._durationHint);
            return best || 0;
        }

        // Web path unchanged
        if (!audioEngine.tracks || audioEngine.tracks.size === 0) {
            return activeSong?.duration || 180;
        }
        for (const [, track] of audioEngine.tracks.entries()) {
            if (track.buffer) return track.buffer.duration;
        }
        return activeSong?.duration || 180;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tracks, activeSong, audioReady, snapshotDurationSec]); // snapshotDurationSec = NextGen getSnapshot durationSec

    const nativeAutoStopFiredRef = useRef(false);

    // Time display (transport): Web Audio only — native uses getSnapshot via ProgressBar + onNextGenPlaybackSnapshot.
    const timeDisplayRef = useRef(null);
    useEffect(() => {
        const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
        if (isNative) return undefined;
        let rafId;
        const tick = () => {
            if (timeDisplayRef.current) {
                const t = audioEngine.getCurrentTime();
                progressRef.current = t;
                timeDisplayRef.current.textContent =
                    `${formatTime(t)} / ${totalDuration ? formatTime(totalDuration) : '--:--'}`;
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [totalDuration]);
    // AUTO-STOP when song finishes — interval-based so it doesn't depend on progress state (avoids 60fps re-renders)
    useEffect(() => {
        const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
        if (!isPlaying || totalDuration <= 0) {
            nativeAutoStopFiredRef.current = false;
            return;
        }
        const id = setInterval(() => {
            const t = progressRef.current;
            if (isNative) {
                if (t >= totalDuration - 0.05) {
                    if (!nativeAutoStopFiredRef.current) {
                        nativeAutoStopFiredRef.current = true;
                        console.log("[AUTO-STOP][NATIVE] Song finished.");
                        handleStop();
                    }
                } else if (t < totalDuration - 1) {
                    nativeAutoStopFiredRef.current = false;
                }
            } else {
                if (t >= totalDuration) {
                    console.log("[AUTO-STOP] Song finished.");
                    handleStop();
                }
            }
        }, 200);
        return () => clearInterval(id);
    }, [isPlaying, totalDuration]);

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
        });
        return () => unsub();
    }, [activeSongId]);

    // Update viewedSongId when activeSong changes if not already set
    useEffect(() => {
        if (activeSongId && !viewedSongId) {
            setViewedSongId(activeSongId);
        }
    }, [activeSongId]);

    // Fetch lyrics and chords with offline-first + live sync hybrid approach
    useEffect(() => {
        if (!viewedSongId) {
            setActiveLyrics(null);
            setActiveChords(null);
            return;
        }

        if (isAppNative && nativePrepareBusy) {
            setActiveLyrics('loading');
            setActiveChords('loading');
            return;
        }

        console.log(`[TEXTS] 🔍 Buscando Letras y Acordes para ID: ${viewedSongId}`);
        setActiveLyrics('loading');
        setActiveChords('loading');

        let unsubLyrics = () => { };
        let unsubChords = () => { };

        const loadTexts = async () => {
            // 1. CARGA R├üPIDA OFFLINE
            const offlineLyrics = await LocalFileManager.getTextLocal(viewedSongId, 'lyrics');
            const offlineChords = await LocalFileManager.getTextLocal(viewedSongId, 'chords');

            if (offlineLyrics) setActiveLyrics(offlineLyrics);
            if (offlineChords) setActiveChords(offlineChords);

            // 2. SINCRONIZACI├ôN EN VIVO DESDE FIRESTORE (si hay internet)
            // Lyrics sync
            const qLyrics = query(collection(db, 'lyrics'), where('songId', '==', viewedSongId));
            unsubLyrics = onSnapshot(qLyrics, (snap) => {
                if (!snap.empty) {
                    const text = snap.docs[0].data().text;
                    setActiveLyrics(text);
                    LocalFileManager.saveTextLocal(viewedSongId, 'lyrics', text); // Update local cache
                } else if (!offlineLyrics) {
                    const song = globalSongs.find(s => s.id === viewedSongId) || librarySongs.find(s => s.id === viewedSongId);
                    setActiveLyrics(song?.lyrics || null);
                }
            }, (err) => {
                console.error("[LYRICS] Offline / error", err);
                const song = globalSongs.find(s => s.id === viewedSongId) || librarySongs.find(s => s.id === viewedSongId);
                if (!offlineLyrics) setActiveLyrics(song?.lyrics || null);
            });

            // Chords sync
            const qChords = query(collection(db, 'chords'), where('songId', '==', viewedSongId));
            unsubChords = onSnapshot(qChords, (snap) => {
                if (!snap.empty) {
                    const text = snap.docs[0].data().text;
                    setActiveChords(text);
                    LocalFileManager.saveTextLocal(viewedSongId, 'chords', text); // Update local cache
                } else if (!offlineChords) {
                    const song = globalSongs.find(s => s.id === viewedSongId) || librarySongs.find(s => s.id === viewedSongId);
                    setActiveChords(song?.chords || null);
                }
            }, (err) => {
                console.error("[CHORDS] Offline / error", err);
                const song = globalSongs.find(s => s.id === viewedSongId) || librarySongs.find(s => s.id === viewedSongId);
                if (!offlineChords) setActiveChords(song?.chords || null);
            });
        };

        loadTexts();

        return () => {
            unsubLyrics();
            unsubChords();
        };
    }, [viewedSongId, nativePrepareBusy, globalSongs, librarySongs]);

    const handleRetryLyrics = () => {
        const id = activeSongId;
        setActiveSongId(null);
        setTimeout(() => setActiveSongId(id), 50);
    };

    // Auto-scroll effect with manual override support for both views
    const [manualScrollOffset, setManualScrollOffset] = useState(0);
    const lastAutoScrollTop = useRef(0);
    const isProgrammaticScroll = useRef(false);

    // Lyric auto-scroll — interval-based so it doesn't depend on progress state (avoids 60fps re-renders)
    useEffect(() => {
        if (!isAutoScroll || totalDuration <= 0) return;
        const id = setInterval(() => {
            const container = activeTab === 'lyrics' ? lyricsScrollRef.current :
                activeTab === 'chords' ? chordsScrollRef.current : null;
            if (!container) return;
            const scrollHeight = container.scrollHeight - container.clientHeight;
            const baseScroll = ((progressRef.current * autoScrollSpeed) / totalDuration) * scrollHeight;
            const finalScroll = Math.max(0, Math.min(baseScroll + manualScrollOffset, scrollHeight));
            isProgrammaticScroll.current = true;
            lastAutoScrollTop.current = finalScroll;
            container.scrollTo({ top: finalScroll, behavior: 'smooth' });
            setTimeout(() => { isProgrammaticScroll.current = false; }, 100);
        }, 500);
        return () => clearInterval(id);
    }, [isAutoScroll, totalDuration, autoScrollSpeed, manualScrollOffset, activeTab]);

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

    // ── ORIENTATION MANAGEMENT ───────────────────────────────────
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
                                            style={{ fontSize: '0.75rem', color: '#00d2d3', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </span>
                                    </div>
                                )}
                            </div>
                            {loginError && <div style={{ color: '#ff5252', fontSize: '0.85rem', textAlign: 'center', padding: '8px', borderRadius: '6px', background: 'rgba(255,82,82,0.1)' }}>{loginError}</div>}
                            {loginSuccess && <div style={{ color: '#4ade80', fontSize: '0.82rem', textAlign: 'center', padding: '10px', borderRadius: '6px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', lineHeight: '1.4' }}>{loginSuccess}</div>}
                            <button type="submit" style={{ padding: '12px', background: '#00d2d3', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>{loginIsRegister ? 'Registrarse' : 'Entrar'}</button>
                        </form>



                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <span onClick={() => { setLoginIsRegister(!loginIsRegister); setLoginError(''); setLoginSuccess(''); }} style={{ color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'none' }}>
                                {loginIsRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? regístrate aquí'}
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

            {showPwaInstallBanner && (
                <div
                    style={{
                        position: 'fixed',
                        top: appUpdateOffer ? 56 : 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 199999,
                        background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
                        border: '1px solid rgba(96,165,250,0.55)',
                        borderRadius: '16px',
                        boxShadow: '0 18px 45px rgba(2,6,23,0.75)',
                        padding: '14px 16px',
                        width: 'min(940px, calc(100vw - 20px))',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap'
                    }}
                >
                    <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '28px', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.2px' }}>
                        Instalar en escritorio
                    </span>
                    <button
                        type="button"
                        onClick={handleDesktopPwaInstall}
                        style={{
                            background: '#00d2d3',
                            color: '#0f172a',
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        Instalar ahora
                    </button>
                    {showPwaInstallHint && (
                        <span style={{ fontSize: '0.86rem', color: '#dbeafe', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            Presiona <span style={{ color: '#bfdbfe' }}>Open in app / Instalar app</span> <span>→</span> arriba a la derecha
                            <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '2px 10px', color: '#f8fafc', fontWeight: 900 }}>{pwaHintCountdown}s</span>
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowPwaInstallBanner(false)}
                        style={{
                            marginLeft: 'auto',
                            background: 'transparent',
                            color: '#93c5fd',
                            border: '1px solid rgba(147,197,253,0.4)',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {appUpdateOffer && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 200000,
                        background: 'linear-gradient(90deg, #0f172a, #1e3a5f)',
                        borderBottom: '2px solid #00d2d3',
                        padding: '10px 14px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                    }}
                >
                    <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: '700', textAlign: 'center' }}>
                        Nueva versión {appUpdateOffer.versionName} disponible (tenés la {CURRENT_VERSION})
                    </span>
                    <button
                        type="button"
                        onClick={() => window.open(appUpdateOffer.downloadUrl, '_system')}
                        style={{
                            background: '#00d2d3',
                            color: '#0f172a',
                            border: 'none',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        Descargar APK
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            localStorage.setItem(`mixer_dismiss_update_${appUpdateOffer.versionName}`, '1');
                            setAppUpdateOffer(null);
                        }}
                        style={{
                            background: 'transparent',
                            color: '#94a3b8',
                            border: '1px solid #475569',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                        }}
                    >
                        Más tarde
                    </button>
                </div>
            )}

            {/* PRIME TOP TRANSPORT HEADER */}
            <div className="transport-bar" style={appUpdateOffer ? { marginTop: '52px' } : undefined}>
                <div style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#ffea00', fontWeight: 'bold', zIndex: 1000, pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '0 8px', borderRadius: '4px', letterSpacing: '1px' }}>V{CURRENT_VERSION} - ZION STAGE (STABLE SYNC)</div>
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

                {/* MASTER VOLUME SLIDER — % fijo junto al rail para que no quede fuera en tablets */}
                <div
                    className="master-fader-mini"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 6px',
                        height: '38px',
                        flex: '1 1 0',
                        minWidth: 0,
                        maxWidth: 'min(240px, 32vw)',
                    }}
                >
                    <span
                        className="desktop-only"
                        style={{
                            display: window.innerWidth < 1000 ? 'none' : 'block',
                            color: 'white',
                            fontSize: '0.65rem',
                            fontWeight: '900',
                            letterSpacing: '0.1em',
                            whiteSpace: 'nowrap',
                            opacity: 0.9,
                            flex: '0 0 auto',
                        }}
                    >
                        MASTER
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flex: '1 1 0',
                            minWidth: 0,
                        }}
                    >
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={masterVolume}
                            onChange={handleMasterVolume}
                            onInput={handleMasterVolume}
                            aria-label="Volumen master"
                            style={{
                                flex: '1 1 0',
                                minWidth: 0,
                                width: '100%',
                                accentColor: 'white',
                                cursor: 'pointer',
                                height: '4px',
                            }}
                        />
                        <span
                            style={{
                                flex: '0 0 2.65rem',
                                width: '2.65rem',
                                textAlign: 'right',
                                color: 'white',
                                fontSize: '0.72rem',
                                fontWeight: '900',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {Math.round(masterVolume * 100)}%
                        </span>
                    </div>
                </div>

                <div className="controls-group multitrack-main-transport">
                    <button className="transport-btn" title="Rebobinar" onClick={handleSkipBack}><SkipBack size={26} /></button>
                    <button
                        type="button"
                        className={`transport-btn ${isPlaying ? 'active' : 'play'}`}
                        onClick={(e) => {
                            if (!isPlaying && !canStartPlayback) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                            }
                            handlePlay();
                        }}
                        disabled={!isPlaying && !canStartPlayback}
                        aria-disabled={!isPlaying && !canStartPlayback}
                        title={isPlaying ? 'Pausar' : canStartPlayback ? 'Reproducir' : 'Espera a que las pistas estén listas'}
                        style={{
                            background: isPlaying ? '#f39c12' : undefined,
                            opacity: !isPlaying && !canStartPlayback ? 0.45 : 1,
                            cursor: !isPlaying && !canStartPlayback ? 'not-allowed' : 'pointer',
                            pointerEvents: !isPlaying && !canStartPlayback ? 'none' : 'auto',
                        }}
                    >
                        {isPlaying ? <Pause size={26} /> : <Play size={26} />}
                    </button>
                    <button className="transport-btn stop" onClick={handleStop} title="Detener"><Square size={26} /></button>
                    <button className="transport-btn" title="Siguiente" onClick={handleSkipForward}><SkipForward size={26} /></button>
                </div>

                <div className="audio-info">
                    {!isAppNative ? <span ref={timeDisplayRef} /> : <span ref={timeDisplayRef} style={{ display: 'none' }} aria-hidden="true" />}

                    {/* TEMPO CONTROL — hidden on native (NextGen realtime tempo disabled in stable build) */}
                    {!isAppNative && (
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
                    )}

                    {/* PITCH/KEY CONTROL */}
                    <span style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => handlePitchChange(-1)} className="square-btn">-</button>
                        <span
                            onClick={pitchOffset !== 0 ? handlePitchReset : undefined}
                            className="control-value"
                            style={{ minWidth: '45px', color: pitchOffset !== 0 ? '#f39c12' : 'inherit' }}
                        >
                            {transposeKey(songKeyForUi, pitchOffset) || songKeyForUi || '--'}
                            {pitchOffset !== 0 && <span style={{ fontSize: '0.6rem', color: '#f39c12', marginLeft: '2px' }}>({pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset})</span>}
                        </span>
                        <button onClick={() => handlePitchChange(+1)} className="square-btn">+</button>
                    </span>
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

            {/* WAVEFORM OVERVIEW / SCRUBBER — web: WaveformCanvas; native: NextGen ProgressBar + lightweight fake overview (no decode pipeline) */}
            <div className="waveform-section" style={{ height: '85px' }}>
                {isAppNative ? (
                    <div
                        style={{
                            height: '100%',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            padding: '0 4px',
                        }}
                    >
                        {nativeLoadProgress?.songId === activeSongId && nativeLoadProgress.phase ? (
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.55)',
                                    fontSize: 12,
                                    textAlign: 'center',
                                }}
                            >
                                <span style={{ lineHeight: 1.35 }}>
                                    {nativeLoadPhaseLabelEs(nativeLoadProgress.phase, nativeLoadProgress.loaded, nativeLoadProgress.total)}
                                </span>
                            </div>
                        ) : nativeLoadProgress?.songId === activeSongId && nativeLoadProgress.label ? (
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.55)',
                                    fontSize: 12,
                                    textAlign: 'center',
                                }}
                            >
                                <span style={{ lineHeight: 1.35 }}>
                                    {nativeLoadProgress.phase === 'downloading' && nativeLoadProgress.total > 0
                                        ? `${nativeLoadProgress.label} ${nativeLoadProgress.loaded}/${nativeLoadProgress.total}`
                                        : nativeLoadProgress.label}
                                </span>
                            </div>
                        ) : activeSongId && preloadStatus[activeSongId] === 'ready' && tracks.length > 0 ? (
                            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                                <ProgressBar
                                    songId={activeSongId || ''}
                                    duration={totalDuration}
                                    nativeUi
                                    disabled={nativePrepareBusy}
                                    onSnapshot={onNextGenPlaybackSnapshot}
                                    hasPreviewMix={
                                        !!(activeSong?.tracks?.some((t) => t.name === PREVIEW_TRACK_NAME)
                                            || previewMixOnDisk)
                                    }
                                />
                            </div>
                        ) : (
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.25)',
                                    fontSize: 12,
                                }}
                            >
                                <span>Overview (off)</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <WaveformCanvas
                        songId={activeSong?.id}
                        tracks={tracks}
                        isPlaying={isPlaying}
                        duration={totalDuration}
                        hasPreview={activeSong?.tracks?.some(t => t.name === '__PreviewMix')}
                        suppressHeavyWork={isAppNative && nativePrepareBusy}
                    />
                )}
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
                                <div className="tab-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 15px' }}>
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
                                        
                                        {(activeTab === 'lyrics' || activeTab === 'chords') && (
                                            <div style={{ position: 'relative', marginTop: '10px', marginBottom: '10px', marginLeft: '2px', marginRight: '10px' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <div style={{ position: 'relative', width: '250px', transform: 'translateX(-40px)', marginLeft: '0px' }}>
                                                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                                        <input 
                                                            type="text" 
                                                            placeholder={`Buscar otra ${activeTab === 'lyrics' ? 'letra' : 'progresion'}...`}
                                                            value={quickTextSearch}
                                                            onChange={(e) => setQuickTextSearch(e.target.value)}
                                                            onFocus={() => setIsSearchingTexts(true)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '10px 15px 10px 40px',
                                                                background: '#ffffff',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '8px',
                                                                color: '#000000',
                                                                fontSize: '0.9rem'
                                                            }}
                                                        />
                                                    </div>
                                                    {viewedSongId !== activeSongId && (
                                                        <button 
                                                            onClick={() => { setViewedSongId(activeSongId); setQuickTextSearch(''); setIsSearchingTexts(false); }}
                                                            style={{ padding: '0 15px', background: 'rgba(0,188,212,0.1)', color: '#00bcd4', border: '1px solid rgba(0,188,212,0.3)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
                                                        >
                                                            VOLVER AL MIX
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Resultados rápidos del buscador */}
                                                {isSearchingTexts && quickTextSearch && (
                                                    <div style={{ 
                                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                                                        background: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', 
                                                        marginTop: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
                                                        maxHeight: '250px', overflowY: 'auto' 
                                                    }}>
                                                        {[...globalSongs, ...librarySongs]
                                                            .filter(s => s.name.toLowerCase().includes(quickTextSearch.toLowerCase()) || (s.artist || '').toLowerCase().includes(quickTextSearch.toLowerCase()))
                                                            .slice(0, 10)
                                                            .map(song => (
                                                                <div 
                                                                    key={song.id} 
                                                                    onClick={() => { setViewedSongId(song.id); setQuickTextSearch(''); setIsSearchingTexts(false); }}
                                                                    style={{ padding: '12px 15px', borderBottom: '1px solid #333', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = '#2c2c2e'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    <div>
                                                                        <div style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem' }}>{song.name}</div>
                                                                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{song.artist || 'Artista desconocido'}</div>
                                                                    </div>
                                                                    <ArrowRight size={16} color="#00bcd4" />
                                                                </div>
                                                            ))
                                                        }
                                                        <div onClick={() => setIsSearchingTexts(false)} style={{ padding: '10px', textAlign: 'center', color: '#555', fontSize: '0.75rem', cursor: 'pointer' }}>Cerrar buscador</div>
                                                    </div>
                                                )}
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
                                                    loadProgress={nativeLoadProgress?.songId === song.id ? nativeLoadProgress : null}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, margin: '0 12px' }}>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={padVolume}
                                    onChange={e => setPadVolume(parseFloat(e.target.value))}
                                    style={{ flex: 1, accentColor: '#00bcd4', height: '4px' }}
                                    title={`Volumen: ${Math.round(padVolume * 100)}%`}
                                />
                                <span style={{ fontSize: '0.6rem', color: '#00bcd4', minWidth: '24px', textAlign: 'right' }}>{Math.round(padVolume * 100)}%</span>
                            </div>
                            <div className="pad-pitch-control">
                                <button className="pad-pitch-btn" onClick={() => setPadPitch(p => Math.max(-1, p - 1))}>-</button>
                                <div className="pad-pitch-val">{padPitch > 0 ? `+${padPitch}` : padPitch}</div>
                                <button className="pad-pitch-btn" onClick={() => setPadPitch(p => Math.min(1, p + 1))}>+</button>
                            </div>
                        </div>
                        <div className="pad-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px' }}>
                            {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                                <button key={k} className={`pad-key-btn ${padKey === k ? 'active' : ''}`} onClick={() => setPadKey(k)} style={{ height: '28px', fontSize: '0.75rem' }}>{k}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                            <button className={`pad-ms-btn ${padMute ? 'm-active' : ''}`} onClick={() => setPadMute(!padMute)} style={{ width: '32px', height: '32px' }}>M</button>
                            <button className={`pad-ms-btn ${padSolo ? 's-active' : ''}`} onClick={() => setPadSolo(!padSolo)} style={{ width: '32px', height: '32px' }}>S</button>
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
                        style={{ background: darkMode ? '#333' : '#f0f0f0', border: 'none', width: '48px', height: '48px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}
                    >
                        <X size={24} />
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
                    <button onClick={() => setIsPadsOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '2.5rem', cursor: 'pointer', color: '#666', padding: '10px' }}>&times;</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div className="pads-header" style={{ marginBottom: '20px' }}>
                        <button className={`pad-power-btn ${padActive ? 'active' : ''}`} onClick={() => setPadActive(!padActive)} style={{ width: '55px', height: '55px' }}><Power size={26} /></button>
                        <div className="pad-title-section">
                            <h3 className="pad-title">Fundamental Ambient Pads</h3>
                            <div className="pad-subtitle">Loop Community</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, margin: '0 16px' }}>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={padVolume}
                                onChange={e => setPadVolume(parseFloat(e.target.value))}
                                style={{ flex: 1, accentColor: '#00bcd4', height: '5px' }}
                                title={`Volumen: ${Math.round(padVolume * 100)}%`}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#00bcd4', minWidth: '32px', textAlign: 'right', fontWeight: 600 }}>{Math.round(padVolume * 100)}%</span>
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
                    <button onClick={() => setIsCurrentListOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '2.5rem', cursor: 'pointer', color: '#666', padding: '10px' }}>&times;</button>
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
                                                    loadProgress={nativeLoadProgress?.songId === song.id ? nativeLoadProgress : null}
                                                    onSelect={() => {
                                                        handleLoadSong(song);
                                                        setIsCurrentListOpen(false);
                                                    }}
                                                    onRemove={handleRemoveSongFromSetlist}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                            <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                                <button onClick={() => { setIsCurrentListOpen(false); setIsLibraryMenuOpen(true); }} className="action-btn" style={{ flex: 1 }}>+ Añadir Pistas</button>
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
                    <button onClick={() => setIsSetlistMenuOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '2.5rem', cursor: 'pointer', color: '#666', padding: '10px' }}>&times;</button>
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

            {/* 2. LIBRARY DRAWER (memoized — no re-renders from unrelated state) */}
            <LibraryDrawer
                isOpen={isLibraryMenuOpen}
                onClose={() => setIsLibraryMenuOpen(false)}
                librarySongs={librarySongs}
                globalSongs={globalSongs}
                libraryTab={libraryTab}
                onTabChange={setLibraryTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                currentUser={currentUser}
                isAppNative={isAppNative}
                globalCatalogLoading={globalCatalogLoading}
                downloadProgress={downloadProgress}
                onDownloadAdd={handleDownloadAndAdd}
                globalCatalogDocCount={globalSongs.length}
            />
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
        );
    }

const SortableSongItem = React.memo(function SortableSongItem({ song, idx, isActive, pStatus, loadProgress, onSelect, onRemove }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: song.id });

    const rowSongKey = getSongMusicalKey(song);

    useEffect(() => {
        const ph = loadProgress?.phase;
        if (ph === 'downloading') console.log('[UI] showing downloading state', { songId: song.id });
        if (ph === 'preparing') console.log('[UI] showing preparing state', { songId: song.id });
    }, [loadProgress?.phase, song.id]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : (pStatus === 'loading' ? 0.92 : 1),
        zIndex: isDragging ? 100 : 1,
        touchAction: 'pan-y',
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
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5, touchAction: 'none' }} onClick={(e) => e.stopPropagation()}>
                        <GripVertical size={16} />
                    </div>
                    <span className="song-index-badge">{idx + 1}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {song.name}
                    </span>
                </div>
                <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {pStatus === 'loading' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f39c12', boxShadow: '0 0 5px #f39c12' }} />
                            <span style={{ fontSize: '0.6rem', color: '#f39c12', fontWeight: '800', textTransform: 'none' }}>
                                {loadProgress?.phase
                                    ? nativeLoadPhaseLabelEs(loadProgress.phase, loadProgress.loaded, loadProgress.total)
                                    : (loadProgress
                                        ? `${loadProgress.loaded}/${loadProgress.total}`
                                        : (isActive ? 'Motor…' : 'Cargando'))}
                            </span>
                        </div>
                    )}
                    {pStatus === 'ready' && (
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
                {rowSongKey && `${rowSongKey} • `}
                {song.tempo && `${song.tempo} BPM`}
            </div>
            {pStatus === 'loading' && loadProgress && loadProgress.total > 0 && isActive && loadProgress.phase === 'downloading' && (
                <div style={{ margin: '4px 0 2px 24px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%`,
                        background: 'linear-gradient(90deg, #f39c12, #f1c40f)',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            )}
        </div>
    );
});
