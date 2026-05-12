import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitch from '../components/LanguageSwitch'
import { QRCodeSVG } from 'qrcode.react'
import { audioEngine } from '../AudioEngine.js'
import { isMixerClickStem, isMixerGuideStem } from '../mixerStemRoles.js'
import { resolveDesktopInstallerDownloadUrl } from '../utils/desktopInstallerUrl.js'
import { isRemoteReleaseNewer, isRemoteVersionNewerByName, semverToVersionCode } from '../utils/semverReleaseCompare.js'

/**
 * Electron: mismos offsets que la UI para reaplicar tempo/pitch tras cargar stems
 * (WASM web: SoundTouch; Desktop: JUCE DesktopMixSession).
 */
const electronMixerMusicalRef = { pitch: 0, tempoBpmOffset: 0 };

function isElectronDesktopMixer() {
    return typeof window !== 'undefined'
        && window.zionNative?.isDesktop === true
        && !window.Capacitor?.isNativePlatform?.();
}

/** Opciones de primer canal L para estéreo (1..16). */
const DESKTOP_PHYSICAL_OUT_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);

function defaultDesktopAudioRoutingState() {
    return {
        routingVersion: 2,
        /** Solo true: reconfigura el driver (N canales) y aplica orderedRouting. Por defecto = estéreo estable. */
        multiOutHardware: false,
        deviceName: '',
        outputChannelCount: 2,
        orderedRouting: [],
    };
}

function moveRouteRow(list, fromIdx, toIdx) {
    if (!Array.isArray(list) || fromIdx === toIdx || fromIdx < 0 || toIdx < 0
        || fromIdx >= list.length || toIdx >= list.length) {
        return list;
    }
    const next = [...list];
    const [row] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, row);
    return next;
}

/** Orden de la lista = orden de ruteo; conserva outStart por id y añade pistas nuevas al final. */
function buildOrderedRoutingFromTracks(tracks, prevOrdered) {
    const nonV = (tracks || []).filter((t) => t?.name && !t?.isVisualOnly);
    const prev = Array.isArray(prevOrdered) ? prevOrdered : [];
    const seen = new Set();
    const out = [];
    for (const row of prev) {
        if (!row?.id || seen.has(row.id)) continue;
        const tr = nonV.find((t) => t.id === row.id);
        if (tr) {
            seen.add(row.id);
            out.push({
                id: row.id,
                name: tr.name,
                outStart: Math.min(16, Math.max(1, Number(row.outStart) || 1)),
            });
        }
    }
    for (const tr of nonV) {
        if (seen.has(tr.id)) continue;
        const idx = out.length;
        const stagger = 1 + ((idx * 2) % 14);
        out.push({ id: tr.id, name: tr.name, outStart: stagger });
    }
    return out;
}

/** Mezcla stems ya decodificados en la caché RAM del setlist (misma canción / mismo path). */
function mergeZionEnrichedIntoPreload(songsPreloadMap, songId, enriched) {
    if (!enriched?.length) return;
    const m = new Map(songsPreloadMap.get(songId) || []);
    for (const t of enriched) {
        if (t.isVisualOnly || !t.name) continue;
        const prev = m.get(t.name) || {};
        m.set(t.name, {
            ...prev,
            path: t.path || t.filename || prev.path,
            audioBuf: t.audioBuffer ?? prev.audioBuf,
            rawBuf: null,
        });
    }
    songsPreloadMap.set(songId, m);
}

/** Zion Stage Electron: JUCE + IPC (disc / temp decrypt) — sin WASM ni decodeAudioData en renderer. */
async function loadDesktopNativeFromBatch(batch, song) {
    if (!window.zionNative?.loadSong) {
        throw new Error('[DESKTOP AUDIO] Native JUCE bridge missing');
    }
    delete window.__zionDesktopPlayback;
    window.zionNative.stop?.();
    await audioEngine.stop();
    await audioEngine.clear();
    await audioEngine.init();

    const stemBatch = [];
    for (const t of batch) {
        if (t.isVisualOnly) continue;
        const fn = t.filename || t.path || t.cacheKey || t.localPath;
        if (!fn || typeof fn !== 'string') continue;
        stemBatch.push({
            id: t.id,
            name: t.name,
            filename: String(fn).trim(),
            path: String(fn).trim(),
            isGuide: isMixerGuideStem(t.name),
            isClick: isMixerClickStem(t.name),
            isVisualOnly: false,
        });
    }
    if (stemBatch.length === 0) return { ok: false, enriched: [] };
    try {
        await audioEngine.addTracksBatch(stemBatch);
    } catch (e) {
        console.error('[DESKTOP AUDIO] addTracksBatch', e);
        return { ok: false, enriched: [] };
    }
    const bpm = song?.tempo ? parseFloat(song.tempo) : 120;
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    const ratio = (safeBpm + electronMixerMusicalRef.tempoBpmOffset) / safeBpm;
    audioEngine.setTempo(ratio);
    audioEngine.setPitch(electronMixerMusicalRef.pitch);
    window.__zionDesktopPlayback = 'native';
    try {
        const snap = await window.zionNative.getSnapshot?.();
        if (snap && typeof snap === 'string') {
            const s = JSON.parse(snap);
            const d = s.durationSec;
            if (Number.isFinite(d) && d > 1) audioEngine._durationHint = d;
        }
    } catch { /* ignore */ }
    return { ok: true, enriched: [] };
}

async function loadDesktopMixerFromBatch(batch, song) {
    if (isElectronDesktopMixer()) return loadDesktopNativeFromBatch(batch, song);
    return loadElectronZionWasmFromBatch(batch, song);
}

/** Solo navegador / sin bridge escritorio: WASM + descifrado en renderer. */
async function loadElectronZionWasmFromBatch(batch, song) {
    if (typeof window === 'undefined' || !window.zionNative?.readEncryptedTrack) return { ok: false };
    delete window.__zionDesktopPlayback;
    if (window.zionNative.stop) window.zionNative.stop();
    await audioEngine.stop();
    await audioEngine.clear();
    await audioEngine.init();
    if (!audioEngine.isWASMReady || !audioEngine.ctx) {
        console.error('[Desktop] Zion WASM no está listo; no se puede igualar tono/tempo a la web.');
        return { ok: false };
    }
    if (audioEngine.ctx.state === 'suspended') await audioEngine.ctx.resume();

    const enriched = [];
    let stemCount = 0;
    for (const t of batch) {
        if (t.isVisualOnly) continue;
        const existingBuf = t.audioBuffer;
        if (existingBuf && existingBuf.sampleRate > 0 && (existingBuf.numberOfChannels || 0) > 0) {
            enriched.push({ ...t, audioBuffer: existingBuf });
            stemCount += 1;
            continue;
        }
        const key = t.filename || t.path;
        if (!key || typeof key !== 'string') continue;
        const raw = await window.zionNative.readEncryptedTrack(key);
        if (!raw) {
            console.warn('[Desktop] sin buffer para', key);
            continue;
        }
        let ab;
        if (raw instanceof ArrayBuffer) ab = raw.slice(0);
        else if (raw.buffer && typeof raw.byteLength === 'number')
            ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        else continue;
        try {
            const audioBuffer = await audioEngine.ctx.decodeAudioData(ab);
            enriched.push({ ...t, audioBuffer });
            stemCount += 1;
        } catch (e) {
            console.warn('[Desktop] decodeAudioData', t.name, e);
        }
    }
    if (stemCount === 0) return { ok: false };

    await audioEngine.addTracksBatch(enriched);
    const bpm = song?.tempo ? parseFloat(song.tempo) : 120;
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    const ratio = (safeBpm + electronMixerMusicalRef.tempoBpmOffset) / safeBpm;
    audioEngine.setTempo(ratio);
    audioEngine.setPitch(electronMixerMusicalRef.pitch);
    window.__zionDesktopPlayback = 'wasm';
    try {
        const d = audioEngine.wasm.getDuration();
        if (Number.isFinite(d) && d > 1) audioEngine._durationHint = d;
    } catch {
        /* ignore */
    }
    return { ok: true, enriched };
}

import { Mixer } from '../components/Mixer'
import WaveformCanvas from '../components/WaveformCanvas'
import ProgressBar from '../components/ProgressBar'
import Metronome from '../components/Metronome';
import { Play, Pause, Square, SkipBack, SkipForward, Settings, Trash2, LogIn, LogOut, Moon, Sun, Network, Type, Drum, X, Check, Power, GripVertical, ListMusic, Search, ArrowRight, QrCode, Languages } from 'lucide-react'
import { db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from '../firebase'
import { collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit, serverTimestamp, doc, deleteDoc, updateDoc, setDoc, arrayUnion, arrayRemove, or } from 'firebase/firestore'
import { getSongMusicalKey } from '../utils/transposer.js'
import { trackUserUsage } from '../utils/usageMetrics'
import { DesktopProSubscribeModal } from '../desktop/DesktopProSubscribeModal.jsx'
import { LOGO_BLANCO_PNG } from '../utils/publicAssets.js'

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
import { BandSyncEngine, isBandSyncHostSupported } from '../BandSyncEngine'
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

const isAppNative = typeof window !== 'undefined' && (!!window.Capacitor?.isNativePlatform?.() || !!window.zionNative);
/** Electron con bridge Zion (sin Capacitor): más RAM para LRU de stems decodificados. */
const isCapacitorNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// Optimized Setlist Creator to fix lag
const SetlistCreator = React.memo(({ onSave, onCancel }) => {
    const [name, setName] = React.useState('');
    const inputRef = React.useRef(null);
    React.useEffect(() => {
        let cancelled = false;
        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (cancelled) return;
                try {
                    inputRef.current?.focus({ preventScroll: true });
                } catch {
                    inputRef.current?.focus();
                }
            });
        });
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
        };
    }, []);
    return (
        <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Nuevo Setlist</h4>
            <input 
                ref={inputRef}
                type="text" 
                placeholder="Nombre del setlist..." 
                value={name} 
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '5px' }}>
                <button className="play-btn" style={{ flex: 1, background: '#2ecc71', padding: '8px' }} onClick={() => onSave(name)}>✔ Guardar</button>
                <button className="transport-btn stop" style={{ width: 'auto', padding: '8px 15px' }} onClick={onCancel}>Cancelar</button>
            </div>
        </div>
    );
});


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
const FREE_SETLIST_SONG_LIMIT = 3;

/** SQLite `tracks_json`: manifest v1 o legado (solo array de pistas). */
function parseDesktopLibraryManifest(tracksJsonStr) {
    if (!tracksJsonStr) return { downloaded: false, tracks: [], previewMixLocalPath: null };
    try {
        const p = JSON.parse(tracksJsonStr);
        if (Array.isArray(p)) {
            // Fila SQLite sin wrapper v1: si hay pistas, se asume descarga completa previa.
            return { downloaded: p.length > 0, tracks: p, previewMixLocalPath: null };
        }
        const tracks = p.tracks || p.stems || [];
        return {
            downloaded: !!p.downloaded,
            tracks: Array.isArray(tracks) ? tracks : [],
            previewMixLocalPath: p.previewMixLocalPath || null,
        };
    } catch {
        return { downloaded: false, tracks: [], previewMixLocalPath: null };
    }
}

/** Filas SQLite `songs` → objetos de UI para Mi librería (tracks parseados). */
function mapSqliteLibraryRowsToSongs(localSongs) {
    return (localSongs || []).map((row) => {
        const parsed = parseDesktopLibraryManifest(row.tracks_json);
        return {
            ...row,
            tracks: parsed.tracks,
            downloaded: parsed.downloaded,
            previewMixLocalPath: parsed.previewMixLocalPath,
            isPcImport: (parsed.tracks || []).some((t) => t.isPcImportStem),
        };
    });
}

function desktopStemCacheKey(songId, tr) {
    const name = tr?.name;
    if (!name) return '';
    const useFlac = name !== PREVIEW_TRACK_NAME && tr.normalizedReady === true && tr.normalizedUrl;
    const ext = useFlac ? '.flac' : '.mp3';
    return `${songId}_${name}${ext}`;
}

function buildDesktopManifestTrackEntries(song) {
    return (song.tracks || []).map((t) => {
        const nm = (t.name || '').toLowerCase();
        const fn = t.cacheKey || t.localPath || desktopStemCacheKey(song.id, t);
        return {
            ...t,
            id: t.id || `${song.id}_${t.name}`,
            cacheKey: fn,
            localPath: t.localPath || fn,
            duration: t.duration ?? song.duration,
            isGuide: nm.includes('guide') || nm.includes('guia') || nm.includes('cue'),
            isClick: nm.includes('click'),
        };
    });
}

/** Batch para loadElectronZionWasmFromBatch desde manifiesto local (sin I/O de comprobación stem a stem). */
function buildWasmBatchFromDesktopManifest(song) {
    const batch = [];
    for (const tr of song.tracks || []) {
        const isPreview = tr.name === PREVIEW_TRACK_NAME;
        const abs = String(tr.sourceAbsolutePath || '').trim();
        const isAbs = abs && (/^[a-zA-Z]:[\\/]/.test(abs) || abs.startsWith('/'));
        const key = isAbs
            ? abs
            : String(tr.cacheKey || tr.localPath || desktopStemCacheKey(song.id, tr) || '').trim();
        if (!key) continue;
        const trackId = tr.id || `${song.id}_${tr.name}`;
        batch.push({
            id: trackId,
            name: tr.name,
            filename: key,
            path: key,
            audioBuffer: tr.audioBuffer || null,
            sourceData: tr.sourceData || null,
            isVisualOnly: isPreview,
        });
    }
    return batch;
}

/** ¿Hace falta regrabar tracks_json con cacheKey/localPath v1? */
function desktopSongManifestNeedsMigration(row) {
    if (!row?.id || !row.tracks_json) return false;
    try {
        const p = JSON.parse(row.tracks_json);
        if (Array.isArray(p)) return true;
        if (!p || typeof p !== 'object') return false;
        if (p.version !== 1) return true;
        if (p.tracks?.length && !p.downloaded) return true;
        const tracks = p.tracks || [];
        for (const t of tracks) {
            if (!t?.name) continue;
            const src = String(t.sourceAbsolutePath || '').trim();
            if (src) continue;
            if (!t.cacheKey || !String(t.cacheKey).trim()) return true;
            if (!t.localPath || !String(t.localPath).trim()) return true;
        }
        return false;
    } catch {
        return true;
    }
}

function buildMigratedDesktopManifestTracks(row) {
    const parsed = parseDesktopLibraryManifest(row.tracks_json);
    const tracks = (parsed.tracks || []).filter((t) => t?.name);
    const enriched = tracks.map((t) => {
        const nm = (t.name || '').toLowerCase();
        const fn = desktopStemCacheKey(row.id, t);
        const cacheKey = (t.cacheKey && String(t.cacheKey).trim()) ? String(t.cacheKey).trim() : fn;
        const localPath = (t.localPath && String(t.localPath).trim()) ? String(t.localPath).trim() : cacheKey;
        return {
            ...t,
            id: t.id || `${row.id}_${t.name}`,
            cacheKey,
            localPath,
            duration: t.duration ?? undefined,
            isGuide: !!(t.isGuide ?? isMixerGuideStem(t.name)),
            isClick: !!(t.isClick ?? isMixerClickStem(t.name)),
        };
    });
    const previewMixLocalPath = parsed.previewMixLocalPath
        || enriched.find((x) => x.name === PREVIEW_TRACK_NAME)?.cacheKey
        || null;
    return { enriched, previewMixLocalPath };
}

/** Una pasada al abrir la app: normaliza manifiestos viejos en SQLite (sin tocar caché cifrada). */
async function migrateDesktopLibraryRowsInSqlite(localSongs) {
    if (!window.zionNative?.saveSong || !window.zionNative?.getSongs) return localSongs;
    let any = false;
    for (const row of localSongs) {
        if (!desktopSongManifestNeedsMigration(row)) continue;
        const { enriched, previewMixLocalPath } = buildMigratedDesktopManifestTracks(row);
        if (!enriched.length) continue;
        try {
            await window.zionNative.saveSong({
                id: row.id,
                name: row.name,
                artist: row.artist,
                tempo: row.tempo,
                key: row.key,
                tracks: enriched,
                downloaded: true,
                previewMixLocalPath,
            });
            any = true;
            console.log('[LOCAL LIB] manifest migrated', row.id, enriched.length, 'tracks');
        } catch (e) {
            console.warn('[LOCAL LIB] manifest migrate failed', row.id, e);
        }
    }
    if (any) return await window.zionNative.getSongs();
    return localSongs;
}

// --- LOCAL LIBRARY SERVICE (ABSTRACTION FOR DESKTOP/MOBILE) ---
const LocalLibraryService = {
    getSong: async (songId) => {
        if (window.zionNative?.getSong) {
            return await window.zionNative.getSong(songId);
        }
        return null;
    },
    isTrackDownloaded: async (songId, trackName, isNormalized = false) => {
        if (window.zionNative?.resolveStem) {
            try {
                const r = await window.zionNative.resolveStem(songId, trackName, !!isNormalized);
                if (r && typeof r.ok === 'boolean') return r.ok;
            } catch { /* ignore */ }
        }
        const ext = isNormalized ? '.flac' : '.mp3';
        const filename = `${songId}_${trackName}${ext}`;
        if (window.zionNative?.isTrackDownloaded) {
            if (await window.zionNative.isTrackDownloaded(filename)) return true;
            if (!isNormalized) {
                const base = `${songId}_${trackName}`;
                if (await window.zionNative.isTrackDownloaded(`${base}.wav`)) return true;
                if (await window.zionNative.isTrackDownloaded(`${base}.mp3`)) return true;
            }
            return false;
        }
        return isNormalized 
            ? await NativeEngine.isNormalizedDownloaded(songId, trackName)
            : await NativeEngine.isTrackDownloaded(songId, trackName);
    },
    getTrackPath: async (songId, trackName, isNormalized = false) => {
        const ext = isNormalized ? '.flac' : '.mp3';
        const base = `${songId}_${trackName}`;
        if (window.zionNative?.resolveStem) {
            try {
                const r = await window.zionNative.resolveStem(songId, trackName, !!isNormalized);
                if (r?.ok && r.ref) return r.ref;
            } catch { /* ignore */ }
        }
        if (window.zionNative) {
            if (await window.zionNative.isTrackDownloaded(`${base}.mp3`)) return `${base}.mp3`;
            if (await window.zionNative.isTrackDownloaded(`${base}.wav`)) return `${base}.wav`;
            if (isNormalized && await window.zionNative.isTrackDownloaded(`${base}.flac`)) return `${base}.flac`;
            return `${base}${ext}`;
        }
        const filename = `${songId}_${trackName}${ext}`;
        return isNormalized
            ? await NativeEngine.getNormalizedPath(songId, trackName)
            : await NativeEngine.getTrackPath(songId, trackName);
    },
    saveTrack: async (songId, trackName, data, isNormalized = false) => {
        const ext = isNormalized ? '.flac' : '.mp3';
        const filename = `${songId}_${trackName}${ext}`;
        if (window.zionNative?.saveEncryptedTrack) {
            const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
            await window.zionNative.saveEncryptedTrack(filename, buffer);
            console.log(`[GLOBAL DOWNLOAD] track saved ${trackName}${ext} (Encrypted Cache)`);
            return filename;
        } else {
            const blob = data instanceof Blob ? data : new Blob([data], { type: isNormalized ? 'audio/flac' : 'audio/mpeg' });
            const path = await NativeEngine.saveTrackBlob(blob, filename);
            console.log(`[GLOBAL DOWNLOAD] track saved ${trackName}${ext} (Mobile Filesystem)`);
            return path;
        }
    },
    invalidateLegacyCache: async (songId, trackName) => {
        if (window.zionNative) return; // No-op on desktop for now
        await NativeEngine.invalidateLegacyCache(songId, trackName);
    },
    isSongDownloaded: async (song, formatPlan = null) => {
        const tracksData = filterCriticalDownloadableTracks(song.tracks);
        if (!tracksData.length) return false;
        const v2Set = formatPlan ? new Set(formatPlan.v2StemNames) : new Set();
        const { useFullFlac = false } = formatPlan || {};
        for (const tr of tracksData) {
            const useFlacStem = useFullFlac && v2Set.has(tr.name) && tr.normalizedReady === true && tr.normalizedUrl;
            const ok = await LocalLibraryService.isTrackDownloaded(song.id, tr.name, useFlacStem);
            if (!ok) return false;
        }
        return true;
    }
};

/** Stems required for NextGen playback; PreviewMix is visual-only and deferred. Incluye import PC (`local-file`). */
function filterCriticalDownloadableTracks(tracks) {
    return (tracks || []).filter((tr) => {
        if (!tr || tr.name === PREVIEW_TRACK_NAME) return false;
        if (tr.url === 'local-file' || tr.isPcImportStem) return true;
        return tr.url && tr.url !== 'undefined';
    });
}

/**
 * True if every critical stem is already on disk for the given format plan (FLAC vs MP3 per stem).
 */
async function nativeAllCriticalStemsOnDisk(song, formatPlan) {
    return await LocalLibraryService.isSongDownloaded(song, formatPlan);
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
        console.log(`[QUEUE] processing track ${si + 1}/${m} (format FLAC check)`);
        if (!(await LocalLibraryService.isTrackDownloaded(song.id, tr.name, true))) {
            missingFlac.push(tr.name);
        }
        si += 1;
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

/** Metadato remoto: APK/web (`downloadUrl`) y opcional escritorio (`desktopDownloadUrl` + `versionCode`). */
function mapRemoteAppUpdateRow(data) {
    if (!data || data.versionName == null) return null;
    const versionName = String(data.versionName).trim();
    if (!versionName) return null;
    const rawCode = data.versionCode;
    const versionCode = rawCode != null && rawCode !== '' && Number(rawCode) > 0
        ? Number(rawCode)
        : semverToVersionCode(versionName);
    return {
        versionName,
        versionCode,
        downloadUrl: data.downloadUrl != null ? String(data.downloadUrl).trim() : '',
        desktopDownloadUrl: data.desktopDownloadUrl != null ? String(data.desktopDownloadUrl).trim() : '',
        releaseNotes: data.releaseNotes != null ? String(data.releaseNotes).trim() : '',
    };
}

const DEFAULT_PROXY_FOR_UPDATES = 'https://mixernew-production.up.railway.app';

/** JSON estático tras `firebase deploy` (puede estar más al día que el `dist/` del proxy en Railway). */
const HOSTING_APP_LATEST_ORIGINS = [
    'https://www.zionstage.com',
    'https://zionstage.app',
];

/** Misma heurística que Landing: último doc con enlace de instalador escritorio. */
async function fetchLatestDesktopRowFromFirestore() {
    const q = query(collection(db, 'app_versions'), orderBy('createdAt', 'desc'), limit(40));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const withDesktop = rows.find((r) => String(r.desktopDownloadUrl || '').trim());
    if (!withDesktop) return null;
    return mapRemoteAppUpdateRow(withDesktop);
}

/** Igual idea que Multitrack `pickNewerMeta`: entre dos manifiestos con .exe válido, gana el semver más alto. */
function pickNewerDesktopManifest(a, b) {
    const okA = a && resolveDesktopInstallerDownloadUrl(a);
    const okB = b && resolveDesktopInstallerDownloadUrl(b);
    if (!okA && !okB) return null;
    if (!okA) return b;
    if (!okB) return a;
    return isRemoteVersionNewerByName(a.versionName, b.versionName) ? a : b;
}

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
    globalOnlineLocked,
    canPcImport = false,
    onPcImportOpen,
}) {
    const shouldHideFromVipGlobal = React.useCallback((song) => (
        song?.forSale === true && Number(song?.price || 0) > 0
    ), []);

    const baseSongs = React.useMemo(() => {
        if (libraryTab === 'global' && globalOnlineLocked) return [];
        const base = libraryTab === 'mine'
            ? librarySongs
            : globalSongs.filter(s =>
                Array.isArray(s.tracks) &&
                s.tracks.length > 0 &&
                !shouldHideFromVipGlobal(s)
            );
        if (!searchQuery) return base;
        const q = searchQuery.toLowerCase();
        return base.filter(s =>
            s.name?.toLowerCase().includes(q) ||
            s.artist?.toLowerCase().includes(q) ||
            s.uploadedBy?.toLowerCase().includes(q)
        );
    }, [libraryTab, librarySongs, globalSongs, searchQuery, shouldHideFromVipGlobal, globalOnlineLocked]);

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
                        🌐 Global ({(() => {
                            const n = globalSongs.filter(s => Array.isArray(s.tracks) && s.tracks.length > 0 && !shouldHideFromVipGlobal(s)).length;
                            return globalCatalogLoading && n === 0 ? '…' : n;
                        })()})
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

                {libraryTab === 'mine' && canPcImport && typeof onPcImportOpen === 'function' && (
                    <div style={{ marginBottom: '12px' }}>
                        <button
                            type="button"
                            onClick={onPcImportOpen}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(14, 165, 233, 0.45)',
                                background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                            }}
                        >
                            Cargar MT de PC
                        </button>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '6px', lineHeight: 1.35 }}>
                            Elige archivos o una carpeta (.mp3 / .wav). Luego defines el título de la canción para Mi librería. Opcional: metadatos en la nube si hay sesión.
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: '8px', border: '1px dashed #ccc', padding: '10px', overflowY: 'auto' }}>
                    {!currentUser ? (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '0.9rem' }}>
                            Debes iniciar sesión para ver la librería.
                        </div>
                    ) : globalOnlineLocked && libraryTab === 'global' ? (
                        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '28px', padding: '0 16px', lineHeight: 1.65, fontSize: '0.92rem' }}>
                            <div style={{ fontWeight: 800, color: '#0ea5e9', marginBottom: '10px' }}>Plan PRO (solo PC)</div>
                            Tu suscripción incluye usar tus propios multitracks en este equipo. El catálogo en línea de la base de datos requiere{' '}
                            <strong>PRO Online</strong> (US$5.99/mes). Pulsa <strong>Hazte PRO</strong> en la barra superior para cambiar de plan.
                        </div>
                    ) : globalCatalogLoading && libraryTab === 'global' ? (
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
                                const isLocal = librarySongs.some(ls => ls.id === song.id);
                                const isOtherUser = song.userId !== currentUser?.uid;
                                const listSongKey = getSongMusicalKey(song);
                                return (
                                    <div key={song.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'white', border: `1px solid ${isOtherUser ? '#e8d5f5' : '#eee'}`, borderRadius: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h4 style={{ margin: '0 0 3px 0', color: '#333' }}>{song.name}</h4>
                                                {isLocal && <span style={{ fontSize: '0.65rem', background: '#e0f7fa', color: '#00838f', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>OFFLINE</span>}
                                                {song.isPcImport && <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PC</span>}
                                            </div>
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
                                            style={{ 
                                                background: isDownloading ? '#f39c12' : (isLocal ? '#3498db' : (downloadProgress.songId ? '#ccc' : '#2ecc71')), 
                                                color: 'white', border: 'none', padding: '8px 10px', borderRadius: '4px', 
                                                cursor: (isDownloading || (downloadProgress.songId && !isLocal)) ? 'not-allowed' : 'pointer', 
                                                fontSize: '0.8rem', fontWeight: 'bold', minWidth: '85px' 
                                            }}
                                            title={isLocal ? "Añadir al Setlist" : "Descargar y Añadir"}
                                            onClick={() => !isDownloading && onDownloadAdd(song)}
                                            disabled={isDownloading || (!!downloadProgress.songId && !isLocal)}
                                        >
                                            {isDownloading ? '⏳ Bajando...' : (isLocal ? '➕ Añadir' : (downloadProgress.songId ? 'Espere...' : '➕ Añadir'))}
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

export default function Multitrack({ session }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const bundledVersion = import.meta.env.VITE_DESKTOP_APP_VERSION || import.meta.env.VITE_APP_VERSION || '0.0.0';
    const [installedRelease, setInstalledRelease] = useState({
        versionName: bundledVersion,
        versionCode: semverToVersionCode(bundledVersion),
    });
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const progressRef = useRef(0); // Replaces progress state — avoids 60fps re-renders of the full component
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentUser, setCurrentUser] = useState(session || null);
    const [proxyUrl, setProxyUrl] = useState(() => {
        const saved = localStorage.getItem('mixer_proxyUrl');
        if (saved) return saved;
        return 'https://mixernew-production.up.railway.app';
    });
    const [isDemo, setIsDemo] = useState(true);
    /** Escritorio: 'demo' | 'pro_local' | 'pro_online' (también legacy `pro` en SQLite → tratado como PC). */
    const [desktopLicenseTier, setDesktopLicenseTier] = useState(null);
    const [showProSubscribeModal, setShowProSubscribeModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
    const [authEmail, setAuthEmail] = useState('');
    const [authPass, setAuthPass] = useState('');
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    const isOnline = navigator.onLine;
    const useLocalLibrary = !!window.zionNative;

    useEffect(() => {
        if (typeof window !== 'undefined' && window.zionNative && window.zionNative.getLicense) {
            window.zionNative.getLicense().then((lic) => {
                const mode = lic?.mode || 'demo';
                if (mode === 'pro_online') {
                    setDesktopLicenseTier('pro_online');
                    setIsDemo(false);
                } else if (mode === 'pro_local' || mode === 'pro') {
                    setDesktopLicenseTier('pro_local');
                    setIsDemo(false);
                } else {
                    setDesktopLicenseTier('demo');
                    setIsDemo(true);
                }
            });
        }

        const loadLocalData = async () => {
            if (typeof window !== 'undefined' && window.zionNative) {
                try {
                    let localSongs = await window.zionNative.getSongs();
                    if (window.zionNative.isDesktop) {
                        localSongs = await migrateDesktopLibraryRowsInSqlite(localSongs);
                    }
                    setLibrarySongs(mapSqliteLibraryRowsToSongs(localSongs));
                    
                    const localSetlists = await window.zionNative.getSetlists();
                    setSetlists(localSetlists.map(s => ({ ...s, songs: s.songs_json ? JSON.parse(s.songs_json) : [] })));
                } catch (e) {
                    console.error('Error cargando BD local', e);
                }
            }
        };
        
        loadLocalData();

        // --- HÍBRIDO: CARGA DE USUARIO ---
        const initAuth = async () => {
            setIsAuthChecking(true);
            // 1. Intentar cargar usuario de SQLite (Sesión Offline)
            if (window.zionNative?.getUser) {
                const localUser = await window.zionNative.getUser();
                if (localUser) {
                    console.log("[AUTH] Restaurando sesión offline:", localUser.email);
                    setCurrentUser({ ...localUser, isOffline: true });
                }
            }
            setIsAuthChecking(false);
            // 2. El listener de Firebase se maneja en el useEffect principal para evitar duplicados.
        };
        initAuth();

        // --- HÍBRIDO: SINCRONIZACIÓN BACKGROUND ---
        const syncInterval = setInterval(async () => {
            if (!isOnline || !auth.currentUser || auth.currentUser.isAnonymous) {
                if (!isOnline) console.log("[FIRESTORE] skipped offline desktop sync (offline)");
                return;
            }
            
            if (window.zionNative?.getSetlists) {
                const localSetlists = await window.zionNative.getSetlists();
                const unsynced = localSetlists.filter(sl => sl.synced === 0);
                
                if (unsynced.length > 0) {
                    console.log(`[SYNC] Sincronizando ${unsynced.length} setlists con Firestore...`);
                    for (const sl of unsynced) {
                        try {
                            const songs = sl.songs_json ? JSON.parse(sl.songs_json) : [];
                            await setDoc(doc(db, 'setlists', sl.id), {
                                name: sl.name,
                                userId: auth.currentUser.uid,
                                songs: songs,
                                updatedAt: new Date().toISOString()
                            });
                            // Marcar como sincronizado en SQLite
                            await window.zionNative.saveSetlist({ ...sl, songs, synced: 1 });
                            console.log(`[FIRESTORE] Setlist ${sl.name} sincronizado.`);
                        } catch (e) {
                            console.error("[SYNC] Error sincronizando setlist:", sl.name, e);
                        }
                    }
                }
            }
        }, 30000); // Cada 30 segundos

        
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
            if (audioEngine) audioEngine.onProgress = null;
            clearInterval(syncInterval);
        };
    }, []);
    /** Descarga binaria vía proxy. Si url ya es /api/download?url=... (p. ej. normalizedUrl), no la envuelve otra vez. */
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
    /** No bloquea play: preview / overview en segundo plano. */
    const loadWaveformInBackground = useCallback((song) => {
        if (!isAppNative || !song?.id) return;
        const previewPath =
            song.previewMixLocalPath
            || (song.tracks || []).find((t) => t.name === PREVIEW_TRACK_NAME)?.localPath
            || (song.tracks || []).find((t) => t.name === PREVIEW_TRACK_NAME)?.cacheKey
            || '';
        console.log('[WAVEFORM] songId', song.id);
        console.log('[WAVEFORM] previewMixLocalPath', previewPath || '(none)');
        console.log('[WAVEFORM] peaks cache exists', !!localStorage.getItem(`peaks_${song.id}`));
        console.log('[WAVEFORM] loading background');
        void (async () => {
            try {
                if (song.previewMixLocalPath && await LocalLibraryService.isTrackDownloaded(song.id, PREVIEW_TRACK_NAME)) {
                    setPreviewMixOnDisk(true);
                    console.log('[WAVEFORM] ready');
                    return;
                }
                if (await LocalLibraryService.isTrackDownloaded(song.id, PREVIEW_TRACK_NAME)) {
                    setPreviewMixOnDisk(true);
                    console.log('[WAVEFORM] ready');
                    return;
                }
                const preview = (song.tracks || []).find((t) => t.name === PREVIEW_TRACK_NAME);
                if (!preview?.url || preview.url === 'undefined') {
                    console.log('[WAVEFORM] ready');
                    return;
                }
                const dl = await fetchBlobNative(preview.url);
                if (dl && dl.size > 500) {
                    await LocalLibraryService.saveTrack(song.id, PREVIEW_TRACK_NAME, dl);
                    setPreviewMixOnDisk(true);
                }
                console.log('[WAVEFORM] ready');
            } catch (e) {
                console.warn('[WAVEFORM] background error (non-blocking)', e);
                console.log('[WAVEFORM] ready');
            }
        })();
    }, [fetchBlobNative, isAppNative]);

    /**
     * Nativo: si cada pista ya está en disco, arma el Map para el motor.
     * Respeta `formatPlan`: o todos los stems v2 en FLAC, o todos en MP3 (sin mezcla).
     * No incluye __PreviewMix (opcional; no va al motor en la primera carga).
     */
    const tryBuildNativeTrackMapFromDisk = useCallback(async (song, formatPlan) => {
        
        const tracksData = filterCriticalDownloadableTracks(song.tracks);
        if (!tracksData.length) return null;
        const v2Set = new Set(formatPlan?.v2StemNames ?? []);
        const useFullFlac = formatPlan?.useFullFlac === true;
        const n = tracksData.length;

        let i = 0;
        for (const tr of tracksData) {
            const useFlacStem = useFullFlac && v2Set.has(tr.name) && tr.normalizedReady === true && tr.normalizedUrl;
            const ok = await LocalLibraryService.isTrackDownloaded(song.id, tr.name, useFlacStem);
            if (!ok) return null;
            await prepareYield();
        }

        const pathMap = new Map();
        for (const tr of tracksData) {
            const useFlacStem = useFullFlac && v2Set.has(tr.name) && tr.normalizedReady === true && tr.normalizedUrl;
            const path = await LocalLibraryService.getTrackPath(song.id, tr.name, useFlacStem);
            pathMap.set(tr.name, { path, audioBuf: null, rawBuf: null });
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
    const [localMarkerOverrides, setLocalMarkerOverrides] = useState({});
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
    const [bandSyncInfo, setBandSyncInfo] = useState(null);
    const [showBandSyncQr, setShowBandSyncQr] = useState(false);
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

    /** Importar carpeta de stems desde el PC (solo Electron + bridge). */
    const [pcImportOpen, setPcImportOpen] = useState(false);
    const [pcImportStep, setPcImportStep] = useState(1);
    const [pcPickResult, setPcPickResult] = useState(null);
    const [pcImportSaving, setPcImportSaving] = useState(false);
    const [pcSongTitle, setPcSongTitle] = useState('');
    const [pcArtist, setPcArtist] = useState('');
    const [pcTempo, setPcTempo] = useState('120');
    const [pcMusicalKey, setPcMusicalKey] = useState('C');

    const reloadLibraryFromSqlite = useCallback(async () => {
        if (!window.zionNative?.getSongs) return;
        try {
            let localSongs = await window.zionNative.getSongs();
            if (window.zionNative.isDesktop) {
                localSongs = await migrateDesktopLibraryRowsInSqlite(localSongs);
            }
            setLibrarySongs(mapSqliteLibraryRowsToSongs(localSongs));
        } catch (e) {
            console.error('[LIB] reloadLibraryFromSqlite', e);
        }
    }, []);

    const handlePcImportModalOpen = useCallback(() => {
        setPcImportOpen(true);
        setPcImportStep(1);
        setPcPickResult(null);
        setPcSongTitle('');
        setPcArtist('');
        setPcTempo('120');
        setPcMusicalKey('C');
    }, []);

    const applyPcPickSuccess = useCallback((r) => {
        setPcPickResult(r);
        const sug = typeof r?.suggestedSongTitle === 'string' ? r.suggestedSongTitle.trim() : '';
        setPcSongTitle(sug);
        setPcImportStep(2);
    }, []);

    const handlePcPickFolder = useCallback(async () => {
        if (!window.zionNative?.pickPcAudioFolder) return;
        setPcImportSaving(true);
        try {
            const r = await window.zionNative.pickPcAudioFolder();
            if (r?.canceled) return;
            if (!r?.files?.length) {
                alert('No se encontraron archivos .mp3 o .wav en esa carpeta.');
                return;
            }
            applyPcPickSuccess(r);
        } catch (e) {
            console.error(e);
            alert(String(e?.message || e));
        } finally {
            setPcImportSaving(false);
        }
    }, [applyPcPickSuccess]);

    const handlePcPickFiles = useCallback(async () => {
        if (!window.zionNative?.pickPcAudioFiles) return;
        setPcImportSaving(true);
        try {
            const r = await window.zionNative.pickPcAudioFiles();
            if (r?.canceled) {
                if (r?.error) alert(r.error);
                return;
            }
            if (!r?.files?.length) {
                alert('No se seleccionaron archivos .mp3 o .wav.');
                return;
            }
            applyPcPickSuccess(r);
        } catch (e) {
            console.error(e);
            alert(String(e?.message || e));
        } finally {
            setPcImportSaving(false);
        }
    }, [applyPcPickSuccess]);

    const handlePcImportSave = useCallback(async () => {
        if (!pcPickResult?.files?.length) return;
        if (!window.zionNative?.importPcSongFromFolder) return;
        const songId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `pc_${Date.now()}`;
        setPcImportSaving(true);
        try {
            const titleTrim = pcSongTitle.trim();
            if (!titleTrim) {
                alert('Escribe el título de la canción: es el nombre que verás en Mi librería (no tiene por qué coincidir con la carpeta ni con los archivos).');
                return;
            }
            const res = await window.zionNative.importPcSongFromFolder({
                songId,
                name: titleTrim,
                artist: pcArtist.trim(),
                tempo: parseInt(String(pcTempo), 10) || 120,
                key: pcMusicalKey.trim() || 'C',
                stems: pcPickResult.files,
            });
            if (!res?.ok) {
                alert(res?.error || 'No se pudo importar');
                return;
            }
            if (isOnline && auth.currentUser && !auth.currentUser.isAnonymous) {
                void setDoc(doc(db, 'users', auth.currentUser.uid, 'pcLibrary', songId), {
                    name: titleTrim,
                    artist: pcArtist.trim(),
                    tempo: parseInt(String(pcTempo), 10) || 120,
                    key: pcMusicalKey.trim() || 'C',
                    stemCount: pcPickResult.files.length,
                    source: 'desktop_pc_import',
                    updatedAt: serverTimestamp(),
                }, { merge: true }).catch((fe) => {
                    console.warn('[FIRESTORE] users/.../pcLibrary', fe);
                });
            }
            await reloadLibraryFromSqlite();
            setPcImportOpen(false);
            setIsLibraryMenuOpen(true);
            setLibraryTab('mine');
            alert('Canción importada en Mi Librería.');
        } catch (e) {
            console.error(e);
            alert(String(e?.message || e));
        } finally {
            setPcImportSaving(false);
        }
    }, [pcPickResult, pcSongTitle, pcArtist, pcTempo, pcMusicalKey, isOnline, reloadLibraryFromSqlite]);

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
        LocalLibraryService.isTrackDownloaded(activeSongId, PREVIEW_TRACK_NAME).then((ok) => {
            if (!cancelled) setPreviewMixOnDisk(!!ok);
        });
        return () => {
            cancelled = true;
        };
    }, [activeSongId]);

    const handleToggleBandSyncQr = useCallback(async () => {
        if (!isAppNative) return;
        if (showBandSyncQr) {
            setShowBandSyncQr(false);
            return;
        }
        if (!isBandSyncHostSupported()) {
            alert(t('multitrack.bandSyncUnavailableHost'));
            return;
        }
        const info = await BandSyncEngine.ensureServer(8080);
        if (!info?.running || !String(info.url || '').trim()) {
            alert(t('multitrack.bandSyncServerFailed'));
            setBandSyncInfo(info);
            return;
        }
        setBandSyncInfo(info);
        setShowBandSyncQr(true);
    }, [showBandSyncQr, t]);

    // Login Details
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginIsRegister, setLoginIsRegister] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [loginSuccess, setLoginSuccess] = useState('');

    // ΓöÇΓöÇ SETTINGS PANEL STATES ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [audioDevicesList, setAudioDevicesList] = useState([]);
    const [audioOutputStatus, setAudioOutputStatus] = useState(null);
    const [audioRoutingDraft, setAudioRoutingDraft] = useState(defaultDesktopAudioRoutingState);
    const [audioRoutingApplying, setAudioRoutingApplying] = useState(false);
    const [isPadsOpen, setIsPadsOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mixer_darkMode') === 'true');
    const [panMode, setPanMode] = useState(() => localStorage.getItem('mixer_panMode') || 'mono'); // 'L' | 'R' | 'mono'
    const [appFontSize, setAppFontSize] = useState(() => parseInt(localStorage.getItem('mixer_appFontSize') || '14'));
    const [dynamicClick, setDynamicClick] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);

    /** APK nativo / Electron: aviso si hay una versión más nueva (Firestore + app-latest.json). */
    const [appUpdateOffer, setAppUpdateOffer] = useState(null);
    const [appUpdateDownloading, setAppUpdateDownloading] = useState(false);
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

    // Versión del .exe (app.getVersion) + comprobación contra app-latest-desktop (sin carrera entre efectos).
    useEffect(() => {
        if (!isElectronDesktopMixer() || typeof window === 'undefined' || !window.zionNative) return;
        let cancelled = false;
        (async () => {
            let installed = {
                versionName: bundledVersion,
                versionCode: semverToVersionCode(bundledVersion),
            };
            if (window.zionNative.getDesktopReleaseInfo) {
                try {
                    const info = await window.zionNative.getDesktopReleaseInfo();
                    if (!cancelled && info?.versionName) {
                        const vn = String(info.versionName).trim();
                        const vc = Number.isFinite(Number(info.versionCode)) && Number(info.versionCode) > 0
                            ? Number(info.versionCode)
                            : semverToVersionCode(vn);
                        installed = { versionName: vn, versionCode: vc };
                        setInstalledRelease(installed);
                    }
                } catch (e) {
                    console.warn('getDesktopReleaseInfo:', e?.message || e);
                }
            }
            if (cancelled) return;

            let row = null;
            try {
                const savedProxy = typeof localStorage !== 'undefined'
                    ? localStorage.getItem('mixer_proxyUrl')
                    : null;
                const trimmed = (savedProxy && savedProxy.startsWith('http')) ? savedProxy.replace(/\/$/, '') : null;
                const isLocalHost = trimmed && /^(https?:\/\/)?(localhost|127\.0\.0\.1)([:/]|$)/i.test(trimmed);
                // Mismo espíritu que APK (Multitrack): Firestore + JSON, y el semver más alto con URL válida.
                // `npm run upload:desktop` con FIREBASE_SERVICE_ACCOUNT escribe app_versions → no hace falta redeploy del proxy ni variables LATEST_DESKTOP_*.
                const fromFsPromise = fetchLatestDesktopRowFromFirestore().catch((fe) => {
                    console.warn('Update check desktop (Firestore):', fe?.message || fe);
                    return null;
                });

                const fromJsonPromise = (async () => {
                    const bases = [...new Set([
                        trimmed && !isLocalHost ? trimmed : null,
                        ...HOSTING_APP_LATEST_ORIGINS,
                        DEFAULT_PROXY_FOR_UPDATES,
                    ].filter(Boolean))];
                    for (const base of bases) {
                        for (const jsonPath of ['/app-latest-desktop.json', '/api/app-latest-desktop']) {
                            const r = await fetch(`${base}${jsonPath}?cb=${Date.now()}`, { cache: 'no-store' });
                            if (!r.ok) continue;
                            const j = await r.json();
                            const candidate = mapRemoteAppUpdateRow(j);
                            if (candidate && resolveDesktopInstallerDownloadUrl(candidate)) return candidate;
                        }
                    }
                    return null;
                })();

                const [fromFs, fromJson] = await Promise.all([fromFsPromise, fromJsonPromise]);
                row = pickNewerDesktopManifest(fromFs, fromJson);
            } catch (e) {
                console.warn('Update check desktop (app-latest):', e?.message || e);
            }
            if (cancelled) return;

            const installerUrl = resolveDesktopInstallerDownloadUrl(row);
            if (!row?.versionName || !installerUrl) return;

            const dismissKey = `mixer_dismiss_update_${row.versionName}`;
            if (localStorage.getItem(dismissKey) === '1') return;

            const remote = {
                versionName: row.versionName,
                versionCode: row.versionCode ?? semverToVersionCode(row.versionName),
            };
            if (!isRemoteReleaseNewer(remote, installed)) return;

            setAppUpdateOffer({
                versionName: row.versionName,
                downloadUrl: installerUrl,
                releaseNotes: row.releaseNotes || '',
                isDesktopInstaller: true,
            });
        })();
        return () => { cancelled = true; };
    }, [bundledVersion]);

    // Electron: restaurar ruteo multi-salida guardado por usuario (SQLite).
    useEffect(() => {
        if (!isElectronDesktopMixer() || typeof window === 'undefined' || !window.zionNative?.getAudioRoutingPrefs) return;
        let cancelled = false;
        (async () => {
            try {
                const raw = await window.zionNative.getAudioRoutingPrefs();
                if (cancelled || !raw || typeof raw !== 'string' || raw.length < 3) return;
                await window.zionNative.applyAudioRoutingJson(raw);
            } catch (e) {
                console.warn('[AUDIO ROUTING] restaurar al inicio:', e?.message || e);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Modal Ruteo: dispositivos + borrador (orden de pistas = orden de la lista; arrastrá filas).
    useEffect(() => {
        if (!routeModalOpen || !isElectronDesktopMixer() || typeof window === 'undefined' || !window.zionNative?.getAudioOutputDevicesJson) return;
        let cancelled = false;
        (async () => {
            try {
                const [devsJson, statusJson, prefs] = await Promise.all([
                    window.zionNative.getAudioOutputDevicesJson(),
                    window.zionNative.getAudioOutputStatusJson(),
                    window.zionNative.getAudioRoutingPrefs(),
                ]);
                if (cancelled) return;
                try {
                    const devs = JSON.parse(devsJson || '[]');
                    setAudioDevicesList(Array.isArray(devs) ? devs : []);
                } catch {
                    setAudioDevicesList([]);
                }
                let statusObj = null;
                try {
                    statusObj = JSON.parse(statusJson || '{}');
                    setAudioOutputStatus(statusObj);
                } catch {
                    setAudioOutputStatus(null);
                }
                const maxNc = Number(statusObj?.maxOutputChannels);
                const canMultiHw = !Number.isFinite(maxNc) || maxNc > 2;
                let base = defaultDesktopAudioRoutingState();
                if (prefs && typeof prefs === 'string') {
                    try {
                        const p = JSON.parse(prefs);
                        base = {
                            ...defaultDesktopAudioRoutingState(),
                            ...p,
                            multiOutHardware: p.multiOutHardware === true && canMultiHw,
                        };
                    } catch { /* */ }
                }
                const ordered = buildOrderedRoutingFromTracks(tracks, base.orderedRouting);
                setAudioRoutingDraft({ ...base, orderedRouting: ordered });
            } catch (e) {
                console.warn('[AUDIO ROUTING] modal:', e?.message || e);
            }
        })();
        return () => { cancelled = true; };
    }, [routeModalOpen, tracks]);

    const applyDesktopAudioRouting = useCallback(async () => {
        if (!isElectronDesktopMixer() || typeof window === 'undefined' || !window.zionNative?.applyAudioRoutingJson) return;
        setAudioRoutingApplying(true);
        try {
            const multi = audioRoutingDraft.multiOutHardware === true;
            const orderedRouting = (audioRoutingDraft.orderedRouting || []).map((row) => ({
                id: row.id,
                outStart: Math.min(16, Math.max(1, parseInt(row.outStart, 10) || 1)),
            }));
            let nch = Math.min(16, Math.max(2, Number(audioRoutingDraft.outputChannelCount) || 2));
            if ((nch % 2) !== 0) nch -= 1;
            if (nch < 2) nch = 2;
            const payload = {
                routingVersion: 2,
                multiOutHardware: multi,
                deviceName: multi ? (audioRoutingDraft.deviceName || '') : '',
                outputChannelCount: multi ? nch : 2,
                orderedRouting,
            };
            const r = await window.zionNative.applyAudioRoutingJson(JSON.stringify(payload));
            if (!r?.ok) window.alert(r?.error || 'No se pudo aplicar el ruteo');
            const st = await window.zionNative.getAudioOutputStatusJson();
            try {
                setAudioOutputStatus(JSON.parse(st || '{}'));
            } catch { /* */ }
            setRouteModalOpen(false);
        } catch (e) {
            window.alert(String(e?.message || e));
        } finally {
            setAudioRoutingApplying(false);
        }
    }, [audioRoutingDraft]);

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
        const safeArg = (a) => {
            try {
                if (a === null || a === undefined) return String(a);
                const t = typeof a;
                if (t === 'string' || t === 'number' || t === 'boolean') return String(a);
                if (t === 'bigint') return String(a);
                if (t === 'symbol') return a.toString();
                if (a instanceof Error) return a.message || String(a);
                try {
                    return JSON.stringify(a);
                } catch {
                    return Object.prototype.toString.call(a);
                }
            } catch {
                return '[no serializable]';
            }
        };
        const push = (type, args) => {
            try {
                let msg = args.map(safeArg).join(' ');
                if (msg.length > 500) msg = msg.slice(0, 500) + '…[truncado]';
                setDebugLogs(prev => [...prev.slice(-80), { type, msg, t: new Date().toISOString().slice(11, 19) }]);
            } catch {
                /* no romper React.lazy / reconciliación si console recibe tipos raros */
            }
        };
        console.log = (...a) => { try { origLog(...a); } catch (_) {} try { push('log', a); } catch (_) {} };
        console.error = (...a) => { try { origErr(...a); } catch (_) {} try { push('err', a); } catch (_) {} };
        console.warn = (...a) => { try { origWarn(...a); } catch (_) {} try { push('warn', a); } catch (_) {} };
        return () => { console.log = origLog; console.error = origErr; console.warn = origWarn; };
    }, []);

    // ΓöÇΓöÇ PADS SYSTEM STATES ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const [padActive, setPadActive] = useState(false);
    const [padKey, setPadKey] = useState('C');
    const [padPitch, setPadPitch] = useState(0);
    const [padVolume, setPadVolume] = useState(0.8);
    const [padMute, setPadMute] = useState(false);
    const [padSolo, setPadSolo] = useState(false); // (El modo Solo ser├¡a m├ís complejo de integrar contra el otro motor, por ahora sirve visual)

    // Sincronizar pads con PadEngine (misma lógica que Multitrack.jsx / web)
    useEffect(() => {
        if (padActive) {
            padEngine.start(padKey);
        } else {
            padEngine.stop();
        }
    }, [padActive, padKey]);

    useEffect(() => {
        if (padMute) {
            padEngine.setVolume(0);
        } else {
            padEngine.setVolume(padVolume);
        }
    }, [padVolume, padMute]);

    useEffect(() => {
        padEngine.setPitch(padPitch);
    }, [padPitch]);

    // ΓöÇΓöÇ DND SENSORS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

    // FIXED PAN: click/guide always left, instruments always right
    // Applied automatically on every song load — no user setting needed.

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

    // APK (Capacitor): 1 canción decodificada en RAM. Electron (zionNative sin Capacitor): como web.
    // Web: AudioBuffers decodificados → limitamos por RAM disponible.
    const MAX_DECODED_SONGS = (typeof window !== 'undefined' && window.zionNative && !isCapacitorNative)
        ? (estimatedRAM <= 4 ? 3
            : estimatedRAM <= 8 ? 4
                : estimatedRAM <= 16 ? 5
                    : 6)
        : isAppNative
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
        const unsubAuth = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setCurrentUser(user);
                if (user && window.zionNative?.saveUser) {
                    await window.zionNative.saveUser({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email.split("@")[0]
                    });
                }
                void trackUserUsage(user);

                const qSongs = query(collection(db, "songs"), where("userId", "==", user.uid));
                const unsubSongs = onSnapshot(qSongs, async (snap) => {
                    const cloud = [];
                    snap.forEach((docu) => cloud.push({ id: docu.id, ...docu.data() }));
                    if (!window.zionNative?.getSongs) {
                        setLibrarySongs(cloud);
                        return;
                    }
                    try {
                        let rows = await window.zionNative.getSongs();
                        if (window.zionNative.isDesktop) {
                            rows = await migrateDesktopLibraryRowsInSqlite(rows);
                        }
                        const localMapped = mapSqliteLibraryRowsToSongs(rows);
                        const byId = new Map(localMapped.map((s) => [s.id, s]));
                        for (const c of cloud) {
                            if (!byId.has(c.id)) {
                                byId.set(c.id, { ...c, fromFirestoreLibrary: true });
                            }
                        }
                        setLibrarySongs(Array.from(byId.values()));
                    } catch (e) {
                        console.error('[LIB] merge Firestore + SQLite', e);
                    }
                });

                let unsubGlobal = () => {};
                if (!isAppNative) {
                    const qMT = query(collection(db, "songs"), where("tracks", "!=", null), limit(800));
                    const qG = query(collection(db, "songs"), or(where("isGlobal", "==", true), where("forSale", "==", true)), limit(400));
                    let resultsMT = []; let resultsG = [];
                    const updateMerged = () => {
                        const all = [...resultsMT];
                        resultsG.forEach(g => { if (!all.find(x => x.id === g.id)) all.push(g); });
                        setGlobalSongs(sortGlobalCatalogNewestFirst(all));
                    };
                    const uMT = onSnapshot(qMT, (snap) => { resultsMT = snap.docs.map(d => ({ id: d.id, ...d.data() })); updateMerged(); }, () => setGlobalCatalogLoading(false));
                    const uG = onSnapshot(qG, (snap) => { resultsG = snap.docs.map(d => ({ id: d.id, ...d.data() })); updateMerged(); }, () => setGlobalCatalogLoading(false));
                    unsubGlobal = () => { uMT(); uG(); };
                }

                const qSetlists = query(collection(db, "setlists"), where("userId", "==", user.uid));
                const unsubSetlists = onSnapshot(qSetlists, (snapshot) => {
                    const onlineList = snapshot.docs.map((d) => {
                        const data = d.data();
                        return { id: d.id, ...data, songs: data.songs || [] };
                    });
                    setSetlists((prev) => {
                        const pending = prev.filter((sl) => Number(sl?.synced) === 0);
                        const byId = new Map(pending.map((sl) => [sl.id, sl]));
                        for (const ol of onlineList) {
                            byId.set(ol.id, ol);
                        }
                        return Array.from(byId.values());
                    });
                    setActiveSetlist(prev => {
                        if (!prev) return prev;
                        const updated = onlineList.find(s => s.id === prev.id);
                        return updated ?? null;
                    });
                }, (error) => console.error("Error cargando setlists:", error));

                return () => { unsubSongs(); unsubGlobal(); unsubSetlists(); };
            } else {
                console.log("[AUTH] No hay sesión online activa.");
            }
        });
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

    useEffect(() => {
        if (!currentUser?.uid || typeof window === 'undefined' || !window.zionNative) return;
        const unsub = onSnapshot(
            doc(db, 'users', currentUser.uid),
            async (snap) => {
                const data = snap.data();
                const tier = data?.desktopLicenseTier;
                const revoked = data?.desktopProActive === false;
                const hasTier = tier === 'pro_local' || tier === 'pro_online';

                if (hasTier && !revoked) {
                    try {
                        await window.zionNative.saveLicense(currentUser.uid, tier);
                    } catch (e) {
                        console.warn('[desktop] sync license from cloud', e);
                    }
                    setDesktopLicenseTier(tier);
                    setIsDemo(false);
                } else if (revoked) {
                    try {
                        await window.zionNative.saveLicense(currentUser.uid, 'demo');
                    } catch (e) {
                        console.warn('[desktop] revoke license from cloud', e);
                    }
                    setDesktopLicenseTier('demo');
                    setIsDemo(true);
                }
            },
            (err) => console.error('users profile', err)
        );
        return () => unsub();
    }, [currentUser?.uid]);

    // APK: catálogo Global solo al elegir la pestaña (getDocs + RAM). Escritorio (Electron): precarga al abrir "+ Canciones"
    // para que el contador Global y la lista estén listos sin pulsar la pestaña.
    useEffect(() => {
        if (!isAppNative) return;
        const isElectronDesktop = typeof window !== 'undefined' && window.zionNative?.isDesktop === true;
        const shouldLoadGlobal =
            libraryTab === 'global' || (isElectronDesktop && isLibraryMenuOpen);
        if (!shouldLoadGlobal) {
            setGlobalSongs([]);
            setGlobalCatalogLoading(false);
            return;
        }
        const globalOnlineLocked = typeof window !== 'undefined' && !!window.zionNative && desktopLicenseTier === 'pro_local';
        if (globalOnlineLocked) {
            setGlobalSongs([]);
            setGlobalCatalogLoading(false);
            return;
        }
        let cancelled = false;
        setGlobalCatalogLoading(true);
        (async () => {
            try {
                // Query 1: Multitracks — docs with tracks[] array (user-uploaded ZIPs)
                const qMT = query(
                    collection(db, 'songs'),
                    where('tracks', '!=', null),
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
    }, [libraryTab, isAppNative, currentUser, desktopLicenseTier, isLibraryMenuOpen]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 300, tolerance: 8 }
        })
    );

    
    const handleCreateSetlist = async (name) => {
        if (!name.trim()) return;
        const demoSetlistCount = new Set((setlists || []).map((s) => s.id)).size;
        if (isDemo && demoSetlistCount >= 1) {
            alert('Zion Stage (plan gratis): solo puedes crear 1 setlist.');
            return;
        }
        


        try {
            const u = auth.currentUser;
            const newSl = {
                id: 'sl_' + Date.now(),
                name: name,
                songs: [],
                synced: u && !u.isAnonymous ? 1 : 0
            };

            if (u && !u.isAnonymous) {
                await setDoc(doc(db, 'setlists', newSl.id), {
                    name: newSl.name,
                    userId: u.uid,
                    songs: [],
                    updatedAt: new Date().toISOString()
                });
            }

            if (window.zionNative) {
                await window.zionNative.saveSetlist(newSl);
            }
            setSetlists((prev) => [...prev, newSl]);

            setNewSetlistName('');
            setIsCreatingSetlist(false);
        } catch (error) {
            console.error('Error creando setlist:', error);
        }
    };

    const handleSelectSetlist = (list) => {
        setActiveSetlist(list);
        setIsSetlistMenuOpen(false);
        localStorage.setItem('mixer_lastSetlistId', list.id);
        const subset = (list.songs || []).slice(0, 2);
        preloadSetlistSongs(subset);
    };

    useEffect(() => {
        if (activeSetlist && activeSetlist.songs) {
            const currentIndex = activeSetlist.songs.findIndex(s => s.id === activeSongId);
            const startIdx = Math.max(0, currentIndex === -1 ? 0 : currentIndex);
            const subset = activeSetlist.songs.slice(startIdx, startIdx + 3);
            preloadSetlistSongs(subset);
        }
    }, [activeSetlist?.songs, activeSongId]);

    const preloadSetlistSongs = async (songs) => {
        // En Desktop Nativo, el preload está desactivado en React 
        // para no colapsar la RAM. JUCE lo maneja bajo demanda.
    };

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

            // Persist to local SQLite
            if (window.zionNative) {
                try {
                    await window.zionNative.saveSetlist(updatedSetlist);
                    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));
                } catch (error) {
                    console.error('Error guardando orden de setlist:', error);
                }
            }
        }
    };

    const handleDeleteSetlist = async (id, name, e) => {
        e.stopPropagation(); // Avoid triggering selection
        if (window.confirm(`¿Seguro que deseas ELIMINAR permanentemente el setlist "${name}"? Esta acción no se puede deshacer.`)) {
            try {
                const u = auth.currentUser;
                if (u && !u.isAnonymous) {
                    try {
                        await deleteDoc(doc(db, 'setlists', id));
                    } catch (err) {
                        console.error('Error borrando setlist en Firestore:', err);
                        alert('No se pudo eliminar el setlist en la nube. Revisa la conexión e inténtalo de nuevo.');
                        return;
                    }
                }
                if (window.zionNative) {
                    await window.zionNative.saveSetlist({ id, _delete: true });
                }
                setSetlists((prev) => prev.filter((s) => s.id !== id));
                if (activeSetlist && activeSetlist.id === id) {
                    setActiveSetlist(null);
                    clearMixerLastSetlistId();
                }
            } catch (error) {
                console.error("Error borrando setlist:", error);
            }
        }
    };

    const handleRemoveSongFromSetlist = async (songIdToRemove, e) => {
        if (e) e.stopPropagation();
        if (!activeSetlist) return;

        if (window.confirm("¿Seguro que deseas remover esta canción del setlist activo?")) {
            try {
                const songToRemove = activeSetlist.songs.find(s => s.id === songIdToRemove);
                if (songToRemove && window.zionNative) {
                    const updatedSetlist = { 
                        ...activeSetlist, 
                        songs: activeSetlist.songs.filter(s => s.id !== songIdToRemove) 
                    };
                    
                    await window.zionNative.saveSetlist(updatedSetlist);
                    setActiveSetlist(updatedSetlist);
                    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));

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
                console.error("Error removiendo canción del setlist:", error);
            }
        }
    };

    const handleDownloadAndAdd = async (song) => {
        if (downloadProgress.songId) {
            console.log("[DOWNLOAD LOCK] acquired - already downloading");
            return;
        }
        if (isDemo && activeSetlist) {
            const alreadyInSetlist = (activeSetlist.songs || []).some((s) => s.id === song.id);
            const currentCount = (activeSetlist.songs || []).length;
            if (!alreadyInSetlist && currentCount >= FREE_SETLIST_SONG_LIMIT) {
                alert(`Zion Stage (plan gratis): máximo ${FREE_SETLIST_SONG_LIMIT} canciones por setlist.`);
                return;
            }
        }

        const isDownloaded = await LocalLibraryService.isSongDownloaded(song);
        if (isDownloaded) {
            console.log(`[LOAD] source local cache (already downloaded): ${song.id}`);
            // Si ya está descargada, saltamos el bucle de descarga pero seguimos con la lógica de añadir al setlist
        }

        console.log(`[GLOBAL DOWNLOAD] start ${song.id}`);
        console.log("[DOWNLOAD LOCK] acquired for", song.name);

        try {
            if (!isDownloaded) {
                setDownloadProgress({ songId: song.id, text: "Descargando..." });
                const tracks = song.tracks || [];
                
                for (let i = 0; i < tracks.length; i++) {
                    const tr = tracks[i];
                    if (!tr.url || tr.url === 'undefined' || tr.name === PREVIEW_TRACK_NAME) continue;
                    if (tr.url === 'local-file' || tr.isPcImportStem) {
                        const okLocal = await LocalLibraryService.isTrackDownloaded(song.id, tr.name);
                        if (!okLocal) throw new Error(`Falta archivo local para la pista «${tr.name}». Vuelve a importar la carpeta.`);
                        continue;
                    }

                    setDownloadProgress({ songId: song.id, text: `Bajando pista ${i + 1}/${tracks.length}: ${tr.name}` });

                    const exists = await LocalLibraryService.isTrackDownloaded(song.id, tr.name);
                    if (!exists) {
                        const r = await fetch(`${proxyUrl}/api/download?url=${encodeURIComponent(tr.url)}`);
                        if (!r.ok) throw new Error(`Error ${r.status} descargando ${tr.name}`);
                        const buffer = await r.arrayBuffer();
                        await LocalLibraryService.saveTrack(song.id, tr.name, buffer);
                    } else {
                        console.log(`[LOCAL CACHE] track already exists: ${tr.name}`);
                    }
                }
            }
            
            setDownloadProgress({ songId: song.id, text: "Finalizando..." });
            
            if (isAppNative) {
                const manifestTracks = buildDesktopManifestTrackEntries(song).map((t) => ({ ...t, isDownloaded: true }));
                const previewMixLocalPath = manifestTracks.find((t) => t.name === PREVIEW_TRACK_NAME)?.cacheKey || null;
                const localSong = {
                    ...song,
                    isLocal: true,
                    downloaded: true,
                    downloadedAt: new Date().toISOString(),
                    previewMixLocalPath,
                    tracks: manifestTracks,
                };

                if (window.zionNative) {
                    await window.zionNative.saveSong({
                        id: localSong.id,
                        name: localSong.name,
                        artist: localSong.artist,
                        tempo: localSong.tempo,
                        key: localSong.key || getSongMusicalKey(localSong),
                        tracks: manifestTracks,
                        downloaded: true,
                        previewMixLocalPath,
                    });
                    console.log(`[LOCAL LIBRARY] saved song ${song.id} tracks count: ${localSong.tracks.length}`);
                }

                setLibrarySongs((prev) => {
                    const filtered = prev.filter((s) => s.id !== song.id);
                    return [...filtered, localSong];
                });

                if (activeSetlist) {
                    const alreadyInSetlist = activeSetlist.songs.some(s => s.id === song.id);
                    if (alreadyInSetlist) {
                        alert("Esta canción ya está en tu setlist.");
                    } else {
                        const updatedSongs = [...activeSetlist.songs, localSong];
                        const updatedSetlist = { ...activeSetlist, songs: updatedSongs, synced: 0 };
                        if (window.zionNative) {
                            await window.zionNative.saveSetlist(updatedSetlist);
                            console.log(`[SETLIST] added local song ${song.id} tracks count: ${localSong.tracks.length}`);

                            if (isOnline && auth.currentUser && !auth.currentUser.isAnonymous) {
                                try {
                                    console.log("[FIRESTORE] Syncing updated setlist...");
                                    await setDoc(doc(db, "setlists", updatedSetlist.id), {
                                        name: updatedSetlist.name,
                                        userId: auth.currentUser.uid,
                                        songs: updatedSongs,
                                        updatedAt: new Date().toISOString()
                                    });
                                    updatedSetlist.synced = 1;
                                    await window.zionNative.saveSetlist(updatedSetlist);
                                } catch(e) { console.warn("[FIRESTORE] Sync falló", e); }
                            }
                        }
                        setActiveSetlist(updatedSetlist);
                        setSetlists(prev => prev.map(sl => sl.id === updatedSetlist.id ? updatedSetlist : sl));
                        alert(isDownloaded ? "¡Canción añadida al setlist!" : "¡Canción descargada y añadida al setlist!");
                    }
                } else {
                    alert("Por favor, selecciona o crea un Setlist primero en la pestaña \"Setlists\".");
                }
            }
        } catch (e) {
            console.error("[DOWNLOAD] Error:", e);
            alert("Error en la descarga");
        } finally {
            console.log("[DOWNLOAD LOCK] released");
            setDownloadProgress({ songId: null, text: "" });
        }
    };

    const handleLoadSong = async (songArg) => {
        let song = songArg;
        if (isDemo && activeSetlist?.songs?.length) {
            const idx = activeSetlist.songs.findIndex((s) => s.id === songArg?.id);
            if (idx >= FREE_SETLIST_SONG_LIMIT) {
                alert(`Zion Stage (plan gratis): solo puedes cargar las primeras ${FREE_SETLIST_SONG_LIMIT} canciones del setlist.`);
                return;
            }
        }
        // Fallback: si el objeto song no trae pistas (ej. guardado previo corrupto o setlist viejo)
        // intentamos buscarlas en la librería local o catálogo global.
        if (!song.tracks || song.tracks.length === 0) {
            const fullSong = librarySongs.find(s => s.id === song.id) || globalSongs.find(s => s.id === song.id);
            if (fullSong && fullSong.tracks && fullSong.tracks.length > 0) {
                song = fullSong;
            }
        }
        // Evitar carga duplicada si ya está en progreso (ej. de handleDownloadAndAdd)
        if (downloadProgress.songId === song.id) {
            console.log("[SELECT] Canción ya se está descargando/cargando.");
            setActiveSongId(song.id);
            return;
        }

        // Parar transporte al cambiar de canción (sin espera artificial: retrasa cada cambio ~1s).
        await audioEngine.stop();
        setIsPlaying(false);
        progressRef.current = 0;

        const isElectronDesktop = isElectronDesktopMixer();

        if (isElectronDesktop && isPreparingSong) {
            console.log('[DESKTOP NATIVE] ignored, already preparing');
            return;
        }
        if (isElectronDesktop) {
            const tFast0 = performance.now();
            try {
                const row = await LocalLibraryService.getSong(song.id);
                const parsed = parseDesktopLibraryManifest(row?.tracks_json);
                const mergedSong = {
                    ...song,
                    name: row?.name || song.name,
                    artist: row?.artist || song.artist,
                    tempo: row?.tempo ?? song.tempo,
                    key: row?.key || song.key,
                    tracks: (row && parsed.tracks?.length) ? parsed.tracks : buildDesktopManifestTrackEntries(song),
                    downloaded: !!(row && parsed.downloaded),
                    previewMixLocalPath: parsed.previewMixLocalPath,
                };
                console.log('[DESKTOP NATIVE] using JUCE engine');
                console.log('[FAST LOAD] local manifest found', song.id);
                console.log('[FAST LOAD] skipping download');
                console.log('[FAST LOAD] skipping Firestore');
                console.log('[FAST LOAD] skipping stem-by-stem delay');
                setActiveSongId(song.id);
                setViewedSongId(song.id);
                setSnapshotDurationSec(0);
                setPreloadStatus((prev) => ({ ...prev, [song.id]: 'loading' }));
                const skeleton = (mergedSong.tracks || [])
                    .filter((tr) => tr.name !== '__PreviewMix')
                    .map((tr) => ({
                        id: `${mergedSong.id}_${tr.name}`,
                        name: tr.name,
                        isPlaceholder: true,
                    }));
                setTracks(skeleton);
                setLoading(false);

                await audioEngine.init();
                const batch = buildWasmBatchFromDesktopManifest(mergedSong);
                const stemCount = batch.filter((b) => !b.isVisualOnly).length;
                console.log('[DESKTOP NATIVE] load paths count', stemCount);
                const { ok } = await loadDesktopNativeFromBatch(batch, mergedSong);
                if (!ok) throw new Error('[DESKTOP AUDIO] Native JUCE bridge missing');

                const newTracks = batch
                    .filter((b) => !b.isVisualOnly)
                    .map((b) => ({ id: b.id, name: b.name }));
                setTracks(newTracks);
                setPreloadStatus((prev) => ({ ...prev, [song.id]: 'ready' }));
                setAudioReady((prev) => prev + 1);
                setNativeLoadProgress(null);
                try {
                    const snap = await window.zionNative.getSnapshot();
                    const s = JSON.parse(snap);
                    const d = s.durationSec;
                    if (Number.isFinite(d) && d > 1) setSnapshotDurationSec(d);
                } catch { /* ignore */ }
                console.log('[JUCE] session ready in', Math.round(performance.now() - tFast0), 'ms');
                console.log('[DESKTOP NATIVE] ready in', Math.round(performance.now() - tFast0), 'ms');
                loadWaveformInBackground(mergedSong);
                setDownloadProgress({ songId: null, text: '' });
                return;
            } catch (e) {
                console.error('[DESKTOP AUDIO] native load failed', e?.message || e);
                setPreloadStatus((prev) => ({ ...prev, [song.id]: 'error' }));
                setDownloadProgress({ songId: null, text: '' });
                return;
            }
        }

        const isAppNativeLoad = isAppNative;

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
            // Web: igual que antes (p. ej. 2edda95): solo parar/limpiar el motor — no vaciar preloadCache.
            // Vaciar el Map borraba stems de otras canciones del setlist; al volver a una canción ya
            // precargada parecía "cargar de nuevo". LRU + evictOldestIfNeeded ya limitan RAM.
            if (!isAppNativeLoad) {
                await audioEngine.stop();
                await audioEngine.clear();
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
                    let merged = diskMap && diskMap.size > 0 ? new Map(diskMap) : null;
                    if (merged) {
                        const prev = preloadCache.current.get(song.id);
                        if (prev && prev.size > 0) {
                            for (const [name, ent] of merged.entries()) {
                                const old = prev.get(name);
                                if (old?.audioBuf?.sampleRate > 0 && old.path === ent.path) {
                                    merged.set(name, { ...ent, audioBuf: old.audioBuf, rawBuf: old.rawBuf ?? null });
                                }
                            }
                        }
                        cachedBuffers = merged;
                        preloadCache.current.set(song.id, new Map(cachedBuffers));
                    } else {
                        cachedBuffers = null;
                    }
                } else {
                    // Si no están todas localmente, y estamos en Desktop sin internet, avisar
                    if (!isOnline) {
                        alert("Esta canción no está disponible offline. Conéctate para descargarla.");
                        throw new Error("Song not available offline");
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
                if (isAppNativeLoad && window.zionNative) {
                    touchLRU(song.id);
                    evictOldestIfNeeded();
                }

                const batch = [];
                const newTracks = [];
                for (const [trackName, cached] of cachedBuffers.entries()) {
                    if (isAppNativeLoad && trackName === PREVIEW_TRACK_NAME) continue;
                    const trackId = `${song.id}_${trackName}`;
                    const isVisual = trackName === PREVIEW_TRACK_NAME;
                    batch.push({
                        id: trackId,
                        name: trackName,
                        filename: cached.path,
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
                if (isAppNativeLoad && window.zionNative) {
                    const { ok, enriched } = await loadDesktopMixerFromBatch(batch, song);
                    if (!ok) {
                        setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
                        throw new Error(isElectronDesktopMixer()
                            ? 'No se pudo cargar el motor de audio nativo (JUCE).'
                            : 'No se pudo cargar el mezclador WASM.');
                    }
                    mergeZionEnrichedIntoPreload(preloadCache.current, song.id, enriched);
                } else {
                    await audioEngine.addTracksBatch(batch);
                }
                if (isAppNativeLoad) {
                    await prepareYield();
                    console.log('[LOAD] ready');
                    setNativeLoadProgress(null);
                    loadWaveformInBackground(song);
                }

                // ALWAYS: click/guide = left ear (-1), all other tracks = right ear (+1)
                if (!isAppNativeLoad) {
                    for (const { id: tId, name: tName } of newTracks) {
                        const isClickOrGuide = isMixerClickStem(tName) || isMixerGuideStem(tName);
                        const pan = isClickOrGuide ? -1 : 1;
                        audioEngine.setTrackPan(tId, pan);
                    }
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
                            const alreadyCached = await LocalLibraryService.isTrackDownloaded(song.id, tr.name, useFlacStem);
                            if (alreadyCached) {
                                finalPath = await LocalLibraryService.getTrackPath(song.id, tr.name, useFlacStem);
                            } else {
                                const urlToFetch = useFlacStem ? tr.normalizedUrl : tr.url;
                                const dl = await fetchBlobNative(urlToFetch);
                                if (dl) {
                                    finalPath = await LocalLibraryService.saveTrack(song.id, tr.name, dl, useFlacStem);
                                    if (useFlacStem) await LocalLibraryService.invalidateLegacyCache(song.id, tr.name);
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
                    const stemFileKey = cached.path ? String(cached.path).trim() : '';
                    if (isAppNativeLoad && !stemFileKey) {
                        console.warn('[LOAD] stem sin clave de caché (omitido):', trackName);
                        continue;
                    }
                    batchMove.push({
                        id: trackId,
                        name: trackName,
                        filename: stemFileKey,
                        path: stemFileKey,
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
                if (isAppNativeLoad && window.zionNative) {
                    const { ok, enriched } = await loadDesktopMixerFromBatch(batchMove, song);
                    if (!ok) {
                        setPreloadStatus(prev => ({ ...prev, [song.id]: 'error' }));
                        throw new Error(isElectronDesktopMixer()
                            ? 'No se pudo cargar el motor de audio nativo (JUCE).'
                            : 'No se pudo cargar el mezclador WASM.');
                    }
                    mergeZionEnrichedIntoPreload(preloadCache.current, song.id, enriched);
                } else {
                    await audioEngine.addTracksBatch(batchMove);
                }
                if (isAppNativeLoad) {
                    await prepareYield();
                    console.log('[LOAD] ready');
                    setNativeLoadProgress(null);
                    loadWaveformInBackground(song);
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
            setDownloadProgress({ songId: null, text: "" });
            console.log("[DOWNLOAD LOCK] released");
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
            } else {
                alert('Por favor, selecciona o crea un Setlist primero en la pestaña \"Setlists\".');
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
            localStorage.removeItem('zion_offline_credentials');
            localStorage.removeItem('zion_offline_user');
            localStorage.removeItem('zion_desktop_session');
            window.location.reload();
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
        const count = audioEngine.getTrackCount();
        if (count === 0 && isAppNative) {
            console.error("[PLAY] blocked: no tracks loaded");
            return;
        }
        await audioEngine.init();
        if (isPlaying) {
            await audioEngine.pause();
            setIsPlaying(false);
        } else {
            if (!canStartPlayback) return;
            await audioEngine.play();
            setIsPlaying(true);
            console.log(`[AUDIO] engine track count: ${count}`);
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
        electronMixerMusicalRef.tempoBpmOffset = newOffset;
        const newRatio = (originalBPM + newOffset) / originalBPM;
        audioEngine.setTempo(newRatio);
    };
    const handleTempoReset = () => {
        setTempoOffset(0);
        electronMixerMusicalRef.tempoBpmOffset = 0;
        audioEngine.setTempo(1.0);
    };

    // Pitch / Key control — APK ±3; web y escritorio (WASM) ±12 como el sitio.
    const [pitchOffset, setPitchOffset] = useState(0);
    const pitchClampCapacitor =
        typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
    const handlePitchChange = (delta) => {
        const min = pitchClampCapacitor ? -3 : -12;
        const max = pitchClampCapacitor ? 3 : 12;
        const newOffset = Math.max(min, Math.min(max, pitchOffset + delta));
        setPitchOffset(newOffset);
        electronMixerMusicalRef.pitch = newOffset;
        audioEngine.setPitch(newOffset);
    };
    const handlePitchReset = () => {
        setPitchOffset(0);
        electronMixerMusicalRef.pitch = 0;
        audioEngine.setPitch(0);
    };

    useEffect(() => {
        setPitchOffset(0);
        setTempoOffset(0);
        electronMixerMusicalRef.pitch = 0;
        electronMixerMusicalRef.tempoBpmOffset = 0;
        audioEngine.setPitch(0);
        audioEngine.setTempo(1);
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
    const activeMarkers = React.useMemo(() => {
        if (!activeSong?.id) return [];
        const override = localMarkerOverrides[activeSong.id];
        if (Array.isArray(override)) return override;
        if (Array.isArray(activeSong.markers)) return activeSong.markers;
        try {
            const raw = localStorage.getItem(`markers_${activeSong.id}`);
            const parsed = JSON.parse(raw || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, [activeSong, localMarkerOverrides]);

    const onNextGenPlaybackSnapshot = useCallback(({ positionSec, durationSec }) => {
        progressRef.current = positionSec;
        if (durationSec > 1) setSnapshotDurationSec(durationSec);
    }, []);

    const totalDuration = React.useMemo(() => {
        const isNative =
            typeof window !== 'undefined' &&
            (!!window.Capacitor?.isNativePlatform?.() || !!window.zionNative);
        const validDur = (v) => Number.isFinite(v) && v > 1;

        // Android contract: no fake 180 fallback.
        if (isNative) {
            if (
                typeof window !== 'undefined' &&
                window.__zionDesktopPlayback === 'wasm' &&
                audioEngine.isWASMReady &&
                audioEngine.wasm
            ) {
                try {
                    const d = audioEngine.wasm.getDuration();
                    if (validDur(d)) return d;
                } catch {
                    /* ignore */
                }
            }
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

    useEffect(() => {
        if (!isAppNative || !isBandSyncHostSupported()) return undefined;
        if (!bandSyncInfo?.running) return undefined;
        const fullTeleprompterText = (text) => {
            if (typeof text !== 'string') return '';
            if (text === 'loading') return '';
            return text;
        };
        const markerForTime = (markers, t) => {
            if (!Array.isArray(markers) || !markers.length) return 'INTRO';
            let best = markers[0];
            for (const m of markers) {
                if (typeof m?.time !== 'number') continue;
                if (m.time <= t) best = m;
            }
            return String(best?.label || 'INTRO');
        };
        const pushNow = async () => {
            const t = Number.isFinite(progressRef.current) ? progressRef.current : 0;
            const viewMode = activeTab || 'none';
            const lyricsText = fullTeleprompterText(activeLyrics);
            const chordsText = fullTeleprompterText(activeChords);
            const lyricsSection = viewMode === 'chords' ? chordsText : lyricsText;
            const setlistSongs = (activeSetlist?.songs || []).map((s) => ({
                id: s.id,
                name: s.name || 'Sin nombre',
            }));
            const state = {
                songName: activeSong?.name || 'Esperando canción...',
                activeSongId: activeSong?.id || null,
                activeSongIndex: (activeSetlist?.songs || []).findIndex((s) => s.id === activeSong?.id),
                setlistName: activeSetlist?.name || '',
                setlistSongs,
                time: t,
                isPlaying: !!isPlaying,
                activeMarkerLabel: markerForTime(activeMarkers, t),
                lyricsSection: lyricsSection || 'Sin texto activo',
                lyricsText: lyricsText || '',
                chordsText: chordsText || '',
                viewMode,
                partituras: (activePartituras || []).map((p) => ({
                    id: p.id,
                    instrument: p.instrument || '',
                    title: p.title || p.instrument || 'Partitura',
                    pdfUrl: p.pdfUrl || '',
                })),
                selectedPartitura: selectedPartitura
                    ? {
                        id: selectedPartitura.id,
                        instrument: selectedPartitura.instrument || '',
                        title: selectedPartitura.title || selectedPartitura.instrument || 'Partitura',
                        pdfUrl: selectedPartitura.pdfUrl || '',
                    }
                    : null,
            };
            await BandSyncEngine.pushState(state, 280);
        };
        void pushNow();
        const id = setInterval(() => {
            void pushNow();
        }, 500);
        return () => clearInterval(id);
    }, [activeSong, activeSetlist, activePartituras, activeTab, activeLyrics, activeChords, activeMarkers, isPlaying, selectedPartitura, bandSyncInfo?.running]);

    useEffect(() => {
        if (!isAppNative || !isBandSyncHostSupported() || !bandSyncInfo?.running) return undefined;
        const poll = async () => {
            const info = await BandSyncEngine.getInfo();
            setBandSyncInfo(info);
        };
        void poll();
        const id = setInterval(() => {
            void poll();
        }, 3000);
        return () => clearInterval(id);
    }, [bandSyncInfo?.running]);

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
        const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
        if (!isNative) return;
        const lockOrientation = async () => {
            try {
                if (!currentUser) await ScreenOrientation.lock({ orientation: "portrait" });
                else await ScreenOrientation.lock({ orientation: "landscape" });
            } catch (err) { console.warn("ScreenOrientation error:", err); }
        };
        lockOrientation();
    }, [currentUser]);


    useEffect(() => {
        const hasSongs = (activeSetlist?.songs || []).length > 0;
        const hasAnythingLoading = Object.values(preloadStatus).some(s => s === "loading");
        if (hasSongs && hasAnythingLoading) {
            setShowPreloader(true); setCountdown(10);
            clearInterval(countdownRef.current);
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) { clearInterval(countdownRef.current); setShowPreloader(false); return 0; }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(countdownRef.current);
    }, [activeSetlist?.id]);

    useEffect(() => {
        const hasSongs = (activeSetlist?.songs || []).length > 0;
        if (!hasSongs) return;
        const allReady = (activeSetlist.songs).every(s => preloadCache.current.has(s.id) || preloadStatus[s.id] === "ready");
        if (allReady && showPreloader) {
            clearInterval(countdownRef.current);
            setTimeout(() => setShowPreloader(false), 600);
        }
    }, [preloadStatus]);

    if (isAuthChecking) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={LOGO_BLANCO_PNG} alt="Zion" style={{ height: '40px', opacity: 0.5, animation: 'pulse 2s infinite' }} />
            </div>
        );
    }



    return (
        <div className="multitrack-layout multitrack-main-layout" style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: darkMode ? '#020617' : '#f8fafc', color: darkMode ? '#f1f5f9' : '#0f172a', fontSize: `${appFontSize}px` }}>
            {(showLoginModal) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1c1c1e', padding: '30px', borderRadius: '12px', width: '320px', border: '1px solid #333', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}><X size={20} /></button>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <img src={LOGO_BLANCO_PNG} alt="Zion Stage" style={{ height: '36px' }} />
                        </div>
                        <h2 style={{ color: 'white', marginTop: 0, marginBottom: '10px', textAlign: 'center', fontWeight: '800' }}>Activar Zion Stage</h2>
                        <p style={{color: '#aaa', fontSize: '0.85rem', textAlign: 'center', marginBottom: '15px'}}>Ingresa tu serial para desbloquear la versión completa.</p>
                        <input type="text" placeholder="ZION-XXXX-XXXX" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2c', color: 'white', fontSize: '1rem', outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }} />
                        {loginError && <div style={{ color: '#ff5252', fontSize: '0.85rem', textAlign: 'center', padding: '8px', borderRadius: '6px', background: 'rgba(255,82,82,0.1)', marginTop: '10px' }}>{loginError}</div>}
                        {loginSuccess && <div style={{ color: '#4ade80', fontSize: '0.82rem', textAlign: 'center', padding: '10px', borderRadius: '6px', background: 'rgba(74,222,128,0.1)', marginTop: '10px' }}>{loginSuccess}</div>}
                        <button onClick={async () => {
                            setLoginError('');
                            if(loginEmail.length >= 8) {
                                if (window.zionNative && window.zionNative.saveLicense) {
                                    await window.zionNative.saveLicense(loginEmail, 'pro');
                                    setIsDemo(false);
                                }
                                setLoginSuccess('Activación exitosa. Reinicia la app.');
                                setTimeout(() => setShowLoginModal(false), 2000);
                            } else {
                                setLoginError('Serial inválido.');
                            }
                        }} style={{ width: '100%', padding: '12px', background: '#00d2d3', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '15px' }}>Activar Ahora</button>
                        <button onClick={() => setShowLoginModal(false)} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #444', borderRadius: '8px', color: '#aaa', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>Continuar en modo Demo</button>
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
                        <img src={LOGO_BLANCO_PNG} alt="Zion Stage" style={{ height: '45px', animation: 'pulse 2s infinite' }} className="preloader-text" />
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
                    <img src={LOGO_BLANCO_PNG} alt="Zion Stage" style={{ height: '28px', flexShrink: 0 }} />
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
                        Nueva versión {appUpdateOffer.versionName} disponible (tenés la {installedRelease.versionName}, código {installedRelease.versionCode})
                    </span>
                    <button
                        type="button"
                        disabled={appUpdateDownloading}
                        onClick={async () => {
                            const canNative = appUpdateOffer.isDesktopInstaller
                                && typeof window.zionNative?.downloadAndLaunchDesktopUpdate === 'function';
                            if (canNative) {
                                setAppUpdateDownloading(true);
                                try {
                                    const r = await window.zionNative.downloadAndLaunchDesktopUpdate(
                                        appUpdateOffer.downloadUrl
                                    );
                                    if (!r?.ok) {
                                        window.alert(r?.error || 'No se pudo iniciar la actualización');
                                    }
                                } finally {
                                    setAppUpdateDownloading(false);
                                }
                            } else {
                                window.open(appUpdateOffer.downloadUrl, '_blank');
                            }
                        }}
                        style={{
                            background: '#00d2d3',
                            color: '#0f172a',
                            border: 'none',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            fontWeight: '800',
                            cursor: appUpdateDownloading ? 'wait' : 'pointer',
                            fontSize: '0.85rem',
                            opacity: appUpdateDownloading ? 0.75 : 1,
                        }}
                    >
                        {appUpdateDownloading
                            ? 'Descargando…'
                            : (appUpdateOffer.isDesktopInstaller ? 'Descargar e instalar' : 'Descargar APK')}
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
                <div style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#ffea00', fontWeight: 'bold', zIndex: 1000, pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '0 8px', borderRadius: '4px', letterSpacing: '1px' }}>
                    V{installedRelease.versionName} · #{installedRelease.versionCode} — ZION STAGE ({typeof window !== 'undefined' && window.zionNative ? 'ZION CORE WASM + SoundTouch' : isAppNative ? 'ZION CORE C++' : (audioEngine.isWASMReady ? 'ZION CORE C++ WASM' : 'WEB AUDIO ENGINE')})
                </div>
                {!isAppNative && (
                    <button
                        onClick={() => navigate('/dashboard')}
                        title={t('multitrack.backDashTitle')}
                        style={{
                            height: '34px',
                            minWidth: '92px',
                            padding: '0 14px',
                            borderRadius: '999px',
                            border: '1px solid rgba(148, 163, 184, 0.45)',
                            background: 'rgba(15, 23, 42, 0.9)',
                            color: '#e2e8f0',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            letterSpacing: '0.2px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            lineHeight: 1
                        }}
                    >
                        {t('multitrack.dashboard')}
                    </button>
                )}
                
                {isDemo && (
                    <button
                        type="button"
                        onClick={() => {
                            if (!currentUser) {
                                alert('Inicia sesión para suscribirte a PRO.');
                                setShowLoginModal(true);
                                return;
                            }
                            setShowProSubscribeModal(true);
                        }}
                        title="Conviértete en PRO — planes desde US$1.99/mes"
                        style={{
                            height: '34px',
                            padding: '0 16px',
                            borderRadius: '999px',
                            border: '1px solid rgba(180, 140, 40, 0.95)',
                            background: 'linear-gradient(180deg, #fcefb7 0%, #e6c35c 38%, #c9a227 72%, #a67c00 100%)',
                            color: '#1a1408',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 12px rgba(180, 130, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
                            textShadow: '0 1px 0 rgba(255, 255, 255, 0.35)',
                        }}
                    >
                        Hazte PRO
                    </button>
                )}
                {!isDemo && desktopLicenseTier && typeof window !== 'undefined' && window.zionNative && (
                    <span
                        title={desktopLicenseTier === 'pro_online' ? 'Plan PRO Online — catálogo en línea incluido' : 'Plan PRO — multitracks propios en este PC'}
                        style={{
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            letterSpacing: '0.04em',
                            padding: '6px 10px',
                            borderRadius: '999px',
                            border: '1px solid rgba(148,163,184,0.35)',
                            color: desktopLicenseTier === 'pro_online' ? '#c4b5fd' : '#5eead4',
                            background: 'rgba(15,23,42,0.5)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {desktopLicenseTier === 'pro_online' ? 'PRO Online' : 'PRO'}
                    </span>
                )}

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
                        {t('multitrack.master')}
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
                            aria-label={t('multitrack.volMaster')}
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
                    <button className="transport-btn" title={t('multitrack.skipBack')} onClick={handleSkipBack}><SkipBack size={26} /></button>
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
                        title={isPlaying ? t('multitrack.pause') : canStartPlayback ? t('multitrack.play') : t('multitrack.playWait')}
                        style={{
                            background: isPlaying ? '#f39c12' : undefined,
                            opacity: !isPlaying && !canStartPlayback ? 0.45 : 1,
                            cursor: !isPlaying && !canStartPlayback ? 'not-allowed' : 'pointer',
                            pointerEvents: !isPlaying && !canStartPlayback ? 'none' : 'auto',
                        }}
                    >
                        {isPlaying ? <Pause size={26} /> : <Play size={26} />}
                    </button>
                    <button className="transport-btn stop" onClick={handleStop} title={t('multitrack.stop')}><Square size={26} /></button>
                    <button className="transport-btn" title={t('multitrack.skipFwd')} onClick={handleSkipForward}><SkipForward size={26} /></button>
                </div>

                <div className="audio-info">
                    {!isAppNative ? <span ref={timeDisplayRef} /> : <span ref={timeDisplayRef} style={{ display: 'none' }} aria-hidden="true" />}

                    {/* TEMPO CONTROL — web y APK (NextGen setTempoRatio vía AudioEngine) */}
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
                            {transposeKey(songKeyForUi, pitchOffset) || songKeyForUi || '--'}
                            {pitchOffset !== 0 && <span style={{ fontSize: '0.6rem', color: '#f39c12', marginLeft: '2px' }}>({pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset})</span>}
                        </span>
                        <button onClick={() => handlePitchChange(+1)} className="square-btn">+</button>
                    </span>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {!currentUser || (currentUser && currentUser.isAnonymous) ? (
                        <button
                            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                            style={{ background: '#00d2d3', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <LogIn size={16} /> Iniciar Sesión
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="desktop-only" style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>
                                {currentUser.isOffline ? '⚡ OFFLINE: ' : ''}{currentUser.displayName || currentUser?.email?.split('@')[0] || 'Anónimo'}
                            </span>
                            <button onClick={handleLogout} className="transport-btn" title={t('multitrack.logoutTitle')}><LogOut size={18} /></button>
                        </div>
                    )}
                    {isAppNative && isBandSyncHostSupported() && (
                        <button
                            className={`transport-btn ${showBandSyncQr ? 'active' : ''}`}
                            title={t('multitrack.bandSyncTitle')}
                            onClick={handleToggleBandSyncQr}
                            style={{ background: showBandSyncQr ? '#00bcd4' : undefined, color: showBandSyncQr ? 'white' : undefined }}
                        >
                            <QrCode size={20} />
                        </button>
                    )}
                    <button
                        className={`transport-btn ${isSettingsOpen ? 'active' : ''}`}
                        onClick={() => setIsSettingsOpen(o => !o)}
                        title={t('multitrack.settings')}
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

            {isAppNative && isBandSyncHostSupported() && showBandSyncQr && bandSyncInfo?.url && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(2, 6, 23, 0.76)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                    }}
                    onClick={() => setShowBandSyncQr(false)}
                >
                    <div
                        style={{
                            width: 'min(92vw, 430px)',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: 14,
                            padding: '12px 12px 14px',
                            boxShadow: '0 16px 50px rgba(0,0,0,0.45)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.9rem' }}>Band Sync QR</div>
                            <button
                                type="button"
                                onClick={() => setShowBandSyncQr(false)}
                                title="Cerrar"
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 999,
                                    border: '1px solid #475569',
                                    background: '#0b1220',
                                    color: '#e2e8f0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <QRCodeSVG value={bandSyncInfo.url} size={196} bgColor="#ffffff" fgColor="#0f172a" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.82rem' }}>Escanea para entrar</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Clientes conectados: {bandSyncInfo.clients || 0}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.7rem', lineHeight: 1.35 }}>
                                    Misma Wi‑Fi que este PC. Si no escanea, abre la URL en el móvil.
                                </div>
                                <div
                                    style={{
                                        color: '#22d3ee',
                                        fontSize: '0.68rem',
                                        wordBreak: 'break-all',
                                        fontFamily: 'ui-monospace, monospace',
                                        marginTop: 4,
                                    }}
                                >
                                    {bandSyncInfo.url}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isElectronDesktopMixer() && routeModalOpen && (
                <div
                    role="presentation"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10001,
                        background: 'rgba(2, 6, 23, 0.82)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                    }}
                    onClick={() => { if (!audioRoutingApplying) setRouteModalOpen(false); }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="route-modal-title"
                        style={{
                            width: 'min(96vw, 520px)',
                            maxHeight: 'min(88vh, 640px)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: 14,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0369a1,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Network size={18} color="white" />
                                </div>
                                <div>
                                    <div id="route-modal-title" style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1rem' }}>Ruteo de audio</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Activá «Ruteo físico multi-salida» solo si tu interfaz tiene más de 2 salidas; si no, el audio queda en modo estéreo estable.</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={audioRoutingApplying}
                                onClick={() => setRouteModalOpen(false)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: '1px solid #475569',
                                    background: '#0b1220',
                                    color: '#e2e8f0',
                                    cursor: audioRoutingApplying ? 'wait' : 'pointer',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                Activas: <strong style={{ color: '#e2e8f0' }}>{audioOutputStatus?.activeOutputChannels ?? '—'}</strong>
                                {' · '}Máx: <strong style={{ color: '#e2e8f0' }}>{audioOutputStatus?.maxOutputChannels ?? '—'}</strong>
                                {audioOutputStatus?.deviceName ? (
                                    <span>{' · '}{String(audioOutputStatus.deviceName)}</span>
                                ) : null}
                            </div>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    cursor: (Number.isFinite(Number(audioOutputStatus?.maxOutputChannels))
                                        && Number(audioOutputStatus.maxOutputChannels) <= 2) ? 'default' : 'pointer',
                                    fontSize: '0.8rem',
                                    color: '#e2e8f0',
                                    lineHeight: 1.35,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={audioRoutingDraft.multiOutHardware === true}
                                    disabled={
                                        Number.isFinite(Number(audioOutputStatus?.maxOutputChannels))
                                        && Number(audioOutputStatus.maxOutputChannels) <= 2
                                    }
                                    onChange={(e) => setAudioRoutingDraft((d) => ({
                                        ...d,
                                        multiOutHardware: e.target.checked,
                                    }))}
                                    style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                                />
                                <span>
                                    <strong>Ruteo físico multi-salida</strong>
                                    <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem', marginTop: 4 }}>
                                        Desactivado: audio estable en estéreo (sin pedir más canales al driver). Activá solo si tu interfaz tiene más de 2 salidas y necesitás pares físicos por pista.
                                    </span>
                                    {Number.isFinite(Number(audioOutputStatus?.maxOutputChannels))
                                        && Number(audioOutputStatus.maxOutputChannels) <= 2 ? (
                                            <span style={{ display: 'block', color: '#fbbf24', fontSize: '0.72rem', marginTop: 6 }}>
                                                Esta salida reporta solo {String(audioOutputStatus.maxOutputChannels)} canal(es); el ruteo multi-par no está disponible.
                                            </span>
                                        ) : null}
                                </span>
                            </label>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                                Dispositivo
                                <select
                                    disabled={audioRoutingDraft.multiOutHardware !== true}
                                    value={audioRoutingDraft.deviceName}
                                    onChange={(e) => setAudioRoutingDraft((d) => ({ ...d, deviceName: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        marginTop: 6,
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        border: '1px solid #475569',
                                        background: '#1e293b',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    <option value="">(Mantener dispositivo actual)</option>
                                    {audioDevicesList.map((d, i) => (
                                        <option key={`${d.type || 't'}-${d.name || i}-${i}`} value={d.name}>
                                            [{d.type || 'audio'}] {d.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                                Canales de salida (máx. 16, par)
                                <select
                                    disabled={audioRoutingDraft.multiOutHardware !== true}
                                    value={String(audioRoutingDraft.outputChannelCount)}
                                    onChange={(e) => setAudioRoutingDraft((d) => ({
                                        ...d,
                                        outputChannelCount: parseInt(e.target.value, 10) || 2,
                                    }))}
                                    style={{
                                        width: '100%',
                                        marginTop: 6,
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        border: '1px solid #475569',
                                        background: '#1e293b',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    {(() => {
                                        const maxHw = Math.max(2, Math.min(16, Math.floor((Number(audioOutputStatus?.maxOutputChannels) || 16) / 2) * 2));
                                        const opts = [2, 4, 6, 8, 10, 12, 14, 16].filter((c) => c <= maxHw);
                                        return (opts.length ? opts : [2]).map((c) => (
                                            <option key={c} value={String(c)}>{c} canales</option>
                                        ));
                                    })()}
                                </select>
                            </label>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                Con 2 salidas físicas: click/guía a la izquierda, resto a la derecha (motor).
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#cbd5e1', marginTop: 4 }}>Orden de pistas → salida L (estéreo usa L y L+1)</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {(audioRoutingDraft.orderedRouting || []).length === 0 ? (
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', padding: 12, textAlign: 'center' }}>Cargá una canción con stems para configurar el ruteo.</div>
                                ) : (
                                    (audioRoutingDraft.orderedRouting || []).map((row, idx) => (
                                        <div
                                            key={row.id}
                                            draggable={audioRoutingDraft.multiOutHardware === true}
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('routeRowIdx', String(idx));
                                                e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            onDragOver={(e) => { e.preventDefault(); }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const from = parseInt(e.dataTransfer.getData('routeRowIdx'), 10);
                                                if (!Number.isFinite(from)) return;
                                                setAudioRoutingDraft((d) => ({
                                                    ...d,
                                                    orderedRouting: moveRouteRow(d.orderedRouting || [], from, idx),
                                                }));
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: '8px 10px',
                                                borderRadius: 10,
                                                border: '1px solid #334155',
                                                background: '#1e293b',
                                                cursor: audioRoutingDraft.multiOutHardware === true ? 'grab' : 'default',
                                            }}
                                        >
                                            <GripVertical size={16} color="#64748b" style={{ flexShrink: 0 }} />
                                            <span style={{ width: 22, textAlign: 'center', fontWeight: 800, color: '#38bdf8', flexShrink: 0 }}>{idx + 1}</span>
                                            <span style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                                                Salida L
                                                <select
                                                    disabled={audioRoutingDraft.multiOutHardware !== true}
                                                    value={String(row.outStart ?? 1)}
                                                    onChange={(e) => {
                                                        const v = parseInt(e.target.value, 10) || 1;
                                                        setAudioRoutingDraft((d) => {
                                                            const next = [...(d.orderedRouting || [])];
                                                            if (next[idx]) next[idx] = { ...next[idx], outStart: v };
                                                            return { ...d, orderedRouting: next };
                                                        });
                                                    }}
                                                    style={{
                                                        padding: '4px 6px',
                                                        borderRadius: 8,
                                                        border: '1px solid #475569',
                                                        background: '#0f172a',
                                                        color: '#f8fafc',
                                                        fontSize: '0.75rem',
                                                    }}
                                                >
                                                    {DESKTOP_PHYSICAL_OUT_OPTIONS.map((n) => (
                                                        <option key={n} value={String(n)}>Canal {n}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid #334155', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                disabled={audioRoutingApplying}
                                onClick={() => setRouteModalOpen(false)}
                                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={audioRoutingApplying || (audioRoutingDraft.multiOutHardware === true && !(audioRoutingDraft.orderedRouting || []).length)}
                                onClick={() => { applyDesktopAudioRouting(); }}
                                style={{
                                    padding: '10px 18px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: '#0284c7',
                                    color: 'white',
                                    fontWeight: 800,
                                    cursor: audioRoutingApplying ? 'wait' : 'pointer',
                                    opacity: (audioRoutingDraft.multiOutHardware === true && !(audioRoutingDraft.orderedRouting || []).length) ? 0.45 : 1,
                                }}
                            >
                                {audioRoutingApplying ? 'Guardando…' : 'Aplicar y guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* WAVEFORM OVERVIEW / SCRUBBER — Android nativo: ProgressBar; web y Electron: WaveformCanvas (marcas intro/verso/coro, etc.) */}
            <div className="waveform-section" style={{ height: isAppNative && !isElectronDesktopMixer() ? '96px' : '115px' }}>
                {isAppNative && !isElectronDesktopMixer() ? (
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
                        ) : activeSongId ? (
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
                                    previewMixLocalPath={
                                        activeSong?.previewMixLocalPath
                                        || activeSong?.tracks?.find((t) => t.name === PREVIEW_TRACK_NAME)?.localPath
                                        || activeSong?.tracks?.find((t) => t.name === PREVIEW_TRACK_NAME)?.cacheKey
                                        || ''
                                    }
                                    localWaveformFallbacks={(activeSong?.tracks || [])
                                        .filter((t) => t?.name && t.name !== PREVIEW_TRACK_NAME)
                                        .map((t) => t.localPath || t.cacheKey || '')
                                        .filter(Boolean)}
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
                ) : isElectronDesktopMixer() ? (
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
                        ) : activeSongId ? (
                            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                                <WaveformCanvas
                                    songId={activeSong?.id}
                                    tracks={tracks}
                                    isPlaying={isPlaying}
                                    duration={totalDuration}
                                    hasPreview={activeSong?.tracks?.some(t => t.name === '__PreviewMix')}
                                    suppressHeavyWork={nativePrepareBusy}
                                    markers={localMarkerOverrides[activeSong?.id] || activeSong?.markers || (() => { try { return JSON.parse(localStorage.getItem(`markers_${activeSong?.id}`) || '[]'); } catch { return []; } })()}
                                    onUpdateMarkers={async (newMarkers) => {
                                        if (!activeSong?.id) return;
                                        setLocalMarkerOverrides(prev => ({ ...prev, [activeSong.id]: newMarkers }));
                                        try {
                                            localStorage.setItem(`markers_${activeSong.id}`, JSON.stringify(newMarkers));
                                        } catch (e) {}
                                        try {
                                            await updateDoc(doc(db, 'multitracks', activeSong.id), { markers: newMarkers });
                                        } catch (e) {
                                            console.log('Sincronización en la nube omitida: Guardado localmente (Pista Global de Solo-Lectura).');
                                        }
                                    }}
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
                        markers={localMarkerOverrides[activeSong?.id] || activeSong?.markers || (() => { try { return JSON.parse(localStorage.getItem(`markers_${activeSong?.id}`) || '[]'); } catch { return []; } })()}
                        onUpdateMarkers={async (newMarkers) => {
                            if (!activeSong?.id) return;
                            
                            // Optimistic UI Update 
                            setLocalMarkerOverrides(prev => ({ ...prev, [activeSong.id]: newMarkers }));
                            
                            // Always save to local cache as fallback for global / read-only tracks
                            try {
                                localStorage.setItem(`markers_${activeSong.id}`, JSON.stringify(newMarkers));
                            } catch (e) {}

                            try {
                                // Attempt cloud sync (will fail if user isn't owner of the track)
                                await updateDoc(doc(db, 'multitracks', activeSong.id), { markers: newMarkers });
                            } catch (e) {
                                console.log('Sincronización en la nube omitida: Guardado localmente (Pista Global de Solo-Lectura).');
                            }
                        }}
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
                    { id: 'metronome', label: 'Metrónomo' },
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

            <div
                className="main-content"
                style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}
            >
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
                                                {activeTab === 'lyrics' ? 'Teleprompter' : activeTab === 'chords' ? 'Cifrado' : activeTab === 'metronome' ? 'Metrónomo Digital' : activeTab === 'partituras' ? '🎼 Partituras' : activeTab}
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
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <div style={{ position: 'relative', width: 'min(100%, 320px)', maxWidth: '100%', flex: '1 1 220px', marginLeft: '0px' }}>
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
                                        {activeTab === 'metronome' && (
                                            <Metronome />
                                        )}
                                        {activeTab === 'partituras' && (
                                            <div style={{ flex: 1, display: 'flex', gap: '0', overflow: 'hidden', background: '#0a0a0e', borderRadius: '12px', minHeight: 0 }}>
                                                {/* Instrument selector sidebar */}
                                                <div style={{ width: 'clamp(120px, 24vw, 200px)', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                <div className="mixer-wrapper desktop-mixer-scroll-host">
                                    <Mixer tracks={tracks} />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Panel derecho escritorio: altura fija, scroll solo en canciones; pads abajo (ver .desktop-* en index.css) */}
                <aside className="desktop-right-panel">
                    <div className="desktop-setlist-card">
                        <div className="desktop-setlist-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
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
                        <div className="desktop-setlist-songs">
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

                    <div className="desktop-pads-card">
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

                {/* ── Idioma (ES / EN) ─────────────────────────────── */}
                <div className="settings-section">
                    <div className="settings-row">
                        <div className="settings-label">
                            <div className="settings-icon-wrap" style={{ background: darkMode ? '#2d3748' : '#eef2ff' }}>
                                <Languages size={16} color="#6366f1" />
                            </div>
                            <div>
                                <div className="settings-title">Idioma</div>
                                <div className="settings-sub">Interfaz en español o inglés</div>
                            </div>
                        </div>
                        <LanguageSwitch light={!darkMode} />
                    </div>
                </div>

                {/* ── Ruteo de audio (solo app escritorio) ─────────── */}
                {isElectronDesktopMixer() && (
                    <div className="settings-section">
                        <div className="settings-row">
                            <div className="settings-label">
                                <div className="settings-icon-wrap" style={{ background: darkMode ? '#2d3748' : '#e0f2fe' }}>
                                    <Network size={16} color="#0369a1" />
                                </div>
                                <div>
                                    <div className="settings-title">Ruteo de audio</div>
                                    <div className="settings-sub">Multi-salida y orden de pistas por canal</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`transport-btn ${routeModalOpen ? 'active' : ''}`}
                                title="Abrir configuración de ruteo"
                                onClick={() => {
                                    setIsSettingsOpen(false);
                                    setRouteModalOpen(true);
                                }}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    background: routeModalOpen ? '#0369a1' : (darkMode ? '#334155' : '#f8fafc'),
                                    color: routeModalOpen ? '#fff' : (darkMode ? '#e2e8f0' : '#0f172a'),
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <Network size={18} />
                                Configurar
                            </button>
                        </div>
                    </div>
                )}

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
                        <SetlistCreator 
                            onSave={handleCreateSetlist} 
                            onCancel={() => setIsCreatingSetlist(false)} 
                        />
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
                globalOnlineLocked={typeof window !== 'undefined' && !!window.zionNative && desktopLicenseTier === 'pro_local'}
                canPcImport={isElectronDesktopMixer() && (!!window.zionNative?.pickPcAudioFolder || !!window.zionNative?.pickPcAudioFiles)}
                onPcImportOpen={handlePcImportModalOpen}
            />
            {pcImportOpen && (
                <div
                    role="presentation"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 400000,
                        background: 'rgba(0,0,0,0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !pcImportSaving) setPcImportOpen(false);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        style={{
                            background: '#0f172a',
                            borderRadius: 16,
                            maxWidth: 460,
                            width: '100%',
                            padding: 22,
                            border: '1px solid #334155',
                            color: '#e2e8f0',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>Cargar multitrack desde tu PC</h3>
                        {pcImportStep === 1 && (
                            <>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: 14 }}>
                                    Stems en <strong>.mp3</strong> o <strong>.wav</strong>. El nombre de cada <em>archivo</em> (sin extensión) será el nombre de la pista en el mezclador. En el siguiente paso podrás poner el <strong>título de la canción</strong> para Mi librería.
                                </p>
                                {!!window.zionNative?.pickPcAudioFiles && (
                                    <button
                                        type="button"
                                        disabled={pcImportSaving}
                                        onClick={handlePcPickFiles}
                                        style={{
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 10,
                                            border: 'none',
                                            background: '#0ea5e9',
                                            color: '#fff',
                                            fontWeight: 800,
                                            cursor: pcImportSaving ? 'wait' : 'pointer',
                                            marginBottom: 10,
                                        }}
                                    >
                                        {pcImportSaving ? 'Abriendo…' : 'Elegir archivos…'}
                                    </button>
                                )}
                                {!!window.zionNative?.pickPcAudioFolder && (
                                    <button
                                        type="button"
                                        disabled={pcImportSaving}
                                        onClick={handlePcPickFolder}
                                        style={{
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 10,
                                            border: '1px solid #38bdf8',
                                            background: 'transparent',
                                            color: '#e0f2fe',
                                            fontWeight: 700,
                                            cursor: pcImportSaving ? 'wait' : 'pointer',
                                        }}
                                    >
                                        {pcImportSaving ? 'Abriendo…' : 'Elegir carpeta (todos los .mp3/.wav)'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={pcImportSaving}
                                    onClick={() => setPcImportOpen(false)}
                                    style={{
                                        marginTop: 12,
                                        width: '100%',
                                        padding: 10,
                                        borderRadius: 10,
                                        border: '1px solid #475569',
                                        background: 'transparent',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancelar
                                </button>
                            </>
                        )}
                        {pcImportStep === 2 && pcPickResult && (
                            <>
                                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: 6, fontWeight: 700 }}>
                                    Título en Mi librería
                                </p>
                                <p style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.45, marginBottom: 8 }}>
                                    Este es el nombre de la <strong>canción</strong> en la lista (independiente del nombre de la carpeta o de los archivos).
                                </p>
                                <input
                                    value={pcSongTitle}
                                    onChange={(e) => setPcSongTitle(e.target.value)}
                                    placeholder="Ej. Mi tema en vivo"
                                    autoComplete="off"
                                    style={{
                                        width: '100%',
                                        marginBottom: 12,
                                        padding: 10,
                                        borderRadius: 8,
                                        border: '2px solid #38bdf8',
                                        background: '#020617',
                                        color: '#f8fafc',
                                        boxSizing: 'border-box',
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                    }}
                                />
                                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4 }}>Artista</label>
                                <input
                                    value={pcArtist}
                                    onChange={(e) => setPcArtist(e.target.value)}
                                    style={{
                                        width: '100%',
                                        marginBottom: 10,
                                        padding: 8,
                                        borderRadius: 8,
                                        border: '1px solid #334155',
                                        background: '#020617',
                                        color: '#f8fafc',
                                        boxSizing: 'border-box',
                                    }}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4 }}>Tempo (BPM)</label>
                                        <input
                                            value={pcTempo}
                                            onChange={(e) => setPcTempo(e.target.value)}
                                            type="number"
                                            min={40}
                                            max={300}
                                            style={{
                                                width: '100%',
                                                padding: 8,
                                                borderRadius: 8,
                                                border: '1px solid #334155',
                                                background: '#020617',
                                                color: '#f8fafc',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4 }}>Tonalidad</label>
                                        <input
                                            value={pcMusicalKey}
                                            onChange={(e) => setPcMusicalKey(e.target.value)}
                                            placeholder="C, Am…"
                                            style={{
                                                width: '100%',
                                                padding: 8,
                                                borderRadius: 8,
                                                border: '1px solid #334155',
                                                background: '#020617',
                                                color: '#f8fafc',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 12, marginBottom: 6, wordBreak: 'break-all' }}>
                                    Origen: {pcPickResult.folderPath}
                                </p>
                                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6 }}>
                                    {pcPickResult.files.length} pista(s) — nombre de cada pista según el archivo:
                                </p>
                                <div
                                    style={{
                                        maxHeight: 100,
                                        overflowY: 'auto',
                                        fontSize: '0.72rem',
                                        color: '#94a3b8',
                                        marginBottom: 4,
                                        border: '1px solid #1e293b',
                                        borderRadius: 8,
                                        padding: 8,
                                    }}
                                >
                                    {pcPickResult.files.map((f) => (
                                        <div key={f.absolutePath}>{f.stemName}</div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                    <button
                                        type="button"
                                        disabled={pcImportSaving}
                                        onClick={() => {
                                            setPcImportStep(1);
                                            setPcPickResult(null);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: 10,
                                            borderRadius: 10,
                                            border: '1px solid #475569',
                                            background: 'transparent',
                                            color: '#e2e8f0',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="button"
                                        disabled={pcImportSaving}
                                        onClick={handlePcImportSave}
                                        style={{
                                            flex: 2,
                                            padding: 10,
                                            borderRadius: 10,
                                            border: 'none',
                                            background: '#22c55e',
                                            color: '#052e16',
                                            fontWeight: 800,
                                            cursor: pcImportSaving ? 'wait' : 'pointer',
                                        }}
                                    >
                                        {pcImportSaving ? 'Guardando…' : 'Guardar en Mi librería'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <DesktopProSubscribeModal
                open={showProSubscribeModal}
                onClose={() => setShowProSubscribeModal(false)}
                currentUser={currentUser}
                onLicenseApplied={(tier) => {
                    setDesktopLicenseTier(tier);
                    setIsDemo(false);
                }}
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

