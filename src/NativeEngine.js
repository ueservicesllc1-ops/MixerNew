import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { NextGenMixerBridge } from './NextGenNativeEngine.js';

const IS_NATIVE =
    typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

let _snapCache = { t: 0, s: {} };
const SNAPSHOT_TTL_MS = 80;

async function nextGenSnapshot() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - _snapCache.t < SNAPSHOT_TTL_MS && _snapCache.s && Object.keys(_snapCache.s).length) {
        return _snapCache.s;
    }
    try {
        const { json } = await NextGenMixerBridge.getSnapshot();
        if (!json || typeof json !== 'string') {
            _snapCache = { t: now, s: {} };
            return {};
        }
        const s = JSON.parse(json);
        _snapCache = { t: now, s };
        return s;
    } catch {
        return {};
    }
}

/** CSV "id:rms,..." para AudioEngine — desde trackLevels en getSnapshot(). */
function trackLevelsCsvFromSnapshot(s) {
    if (!s || typeof s !== 'object') return '';
    if (typeof s.trackLevelsCsv === 'string' && s.trackLevelsCsv.length) return s.trackLevelsCsv;
    if (typeof s.trackLevelsStr === 'string' && s.trackLevelsStr.length) return s.trackLevelsStr;
    const m = s.trackLevels ?? s.levels ?? s.vuLevels ?? s.meterLevels;
    if (m && typeof m === 'object' && !Array.isArray(m)) {
        const parts = [];
        for (const id of Object.keys(m)) {
            const v = m[id];
            const n = typeof v === 'number' ? v : parseFloat(v);
            parts.push(`${id}:${Number.isFinite(n) ? n : 0}`);
        }
        return parts.join(',');
    }
    if (Array.isArray(s.tracks)) {
        const parts = [];
        for (const e of s.tracks) {
            if (!e || typeof e !== 'object') continue;
            const id = e.id;
            if (id == null) continue;
            const v = e.rms ?? e.level ?? e.peak ?? 0;
            const n = typeof v === 'number' ? v : parseFloat(v);
            parts.push(`${id}:${Number.isFinite(n) ? n : 0}`);
        }
        if (parts.length) return parts.join(',');
    }
    if (Array.isArray(s.trackLevels)) {
        const parts = [];
        for (const e of s.trackLevels) {
            if (!e || typeof e !== 'object') continue;
            const id = e.id ?? e.trackId ?? e.name;
            if (id == null) continue;
            const v = e.level ?? e.rms ?? e.peak ?? e.value ?? 0;
            const n = typeof v === 'number' ? v : parseFloat(v);
            parts.push(`${id}:${Number.isFinite(n) ? n : 0}`);
        }
        return parts.join(',');
    }
    return '';
}

setTimeout(async () => {
    if (!IS_NATIVE) return;
    try {
        const s = await nextGenSnapshot();
        console.log('[NativeEngine] NextGen engine:', s.engine || 'NextGen', 'tracks:', s.trackCount);
    } catch (e) {
        console.warn('[NativeEngine] NextGen probe:', e);
    }
}, 2500);

/**
 * UTILITY: Get absolute path of a file in persistent storage
 */
async function getFilePath(filename) {
    const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Data,
    });
    return decodeURIComponent(uri.replace('file://', ''));
}

// Cache to avoid spamming 'stat' on missing files
const fileCache = new Set();
let cacheInitialized = false;

// Minimum file size in bytes to consider a track valid (avoids partial/corrupt downloads).
const MIN_VALID_TRACK_BYTES = 1024; // 1 KB

/**
 * UTILITY: Check if file exists
 */
function isStatMissingFileError(err) {
    const code = err?.code;
    const msg = String(err?.message ?? '');
    return (
        code === 'OS-PLUG-FILE-0008' ||
        msg.includes('does not exist') ||
        msg.includes('not exist')
    );
}

/**
 * Returns true only if the file exists AND has at least MIN_VALID_TRACK_BYTES bytes.
 * This prevents a partial/truncated download from blocking a fresh re-download.
 */
async function fileExists(filename) {
    if (fileCache.has(filename)) {
        // Even if cached, verify it is still valid on disk (size check).
        try {
            const info = await Filesystem.stat({ path: filename, directory: Directory.Data });
            const size = info?.size ?? 0;
            if (size < MIN_VALID_TRACK_BYTES) {
                // Corrupted / partial download — evict from cache so it gets re-downloaded.
                fileCache.delete(filename);
                console.warn(`[NativeEngine] fileExists: '${filename}' too small (${size}B), evicting cache.`);
                return false;
            }
            return true;
        } catch (err) {
            fileCache.delete(filename);
            return false;
        }
    }

    try {
        const info = await Filesystem.stat({
            path: filename,
            directory: Directory.Data,
        });
        const size = info?.size ?? 0;
        if (size < MIN_VALID_TRACK_BYTES) {
            console.warn(`[NativeEngine] fileExists: '${filename}' exists but too small (${size}B), skipping.`);
            return false;
        }
        fileCache.add(filename);
        return true;
    } catch (err) {
        if (!isStatMissingFileError(err)) {
            console.warn('[NativeEngine] fileExists:', filename, err);
        }
        return false;
    }
}

/**
 * Initialize cache by reading the directory Once
 */
async function initFileCache() {
    if (cacheInitialized) return;
    try {
        const { files } = await Filesystem.readdir({
            path: '',
            directory: Directory.Data
        });
        files.forEach(f => fileCache.add(f.name));
        cacheInitialized = true;
        console.log(`[NativeEngine] File list cached: ${fileCache.size} files.`);
    } catch (err) {
        console.warn('[NativeEngine] Could not initialize file cache:', err);
    }
}
initFileCache();

async function detectAudioExtension(blob, defaultExt = '.mp3') {
    if (!blob || !(blob instanceof Blob) || blob.size < 12) {
        return defaultExt;
    }
    try {
        const slice = blob.slice(0, 16);
        const buf = await slice.arrayBuffer();
        const bytes = new Uint8Array(buf);
        
        // 1. WAV (RIFF ... WAVE)
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
            if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
                return '.wav';
            }
        }
        // 2. FLAC (fLaC)
        if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
            return '.flac';
        }
        // 3. MP3 (ID3v2 or MPEG sync frame)
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
            return '.mp3';
        }
        if (bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xFA || bytes[1] === 0xF3 || bytes[1] === 0xF2)) {
            return '.mp3';
        }
    } catch (e) {
        console.warn('[NativeEngine] detectAudioExtension failed:', e);
    }
    return defaultExt;
}

async function autoFixFileExtension(songId, trackName) {
    const baseFilename = `${songId}_${trackName}`;
    const mp3Filename = `${baseFilename}.mp3`;
    
    if (!(await fileExists(mp3Filename))) {
        return;
    }
    
    try {
        const { uri } = await Filesystem.getUri({
            path: mp3Filename,
            directory: Directory.Data,
        });
        const url = Capacitor.convertFileSrc(uri);
        const res = await fetch(url);
        if (!res.ok) return;
        
        const blob = await res.blob();
        const ext = await detectAudioExtension(blob, '.mp3');
        if (ext !== '.mp3') {
            const newFilename = `${baseFilename}${ext}`;
            try {
                await Filesystem.deleteFile({ path: newFilename, directory: Directory.Data });
                fileCache.delete(newFilename);
            } catch {}
            
            await Filesystem.rename({
                from: mp3Filename,
                to: newFilename,
                directory: Directory.Data,
            });
            fileCache.delete(mp3Filename);
            fileCache.add(newFilename);
            console.log(`[NativeEngine] autoFixFileExtension: Corrected mismatched extension for ${mp3Filename} -> ${newFilename}`);
        }
    } catch (err) {
        console.warn('[NativeEngine] autoFixFileExtension failed:', err);
    }
}

export const NativeEngine = {
    /**
     * Checks if a track is already in the phone storage.
     * Use this to avoid downloading again.
     */
    isTrackDownloaded: async (songId, trackName) => {
        await autoFixFileExtension(songId, trackName);
        if (await fileExists(`${songId}_${trackName}.mp3`)) return true;
        if (await fileExists(`${songId}_${trackName}.wav`)) return true;
        if (await fileExists(`${songId}_${trackName}.flac`)) return true;
        return false;
    },

    /**
     * Gets the direct path to a track for the C++ engine.
     */
    getTrackPath: async (songId, trackName) => {
        await autoFixFileExtension(songId, trackName);
        const wavFilename = `${songId}_${trackName}.wav`;
        if (await fileExists(wavFilename)) return await getFilePath(wavFilename);
        const flacFilename = `${songId}_${trackName}.flac`;
        if (await fileExists(flacFilename)) return await getFilePath(flacFilename);
        const mp3Filename = `${songId}_${trackName}.mp3`;
        return await getFilePath(mp3Filename);
    },

    /**
     * Saves a Blob to app DATA without one giant base64 bridge payload (OOM / proceso matado).
     * Escribe en trozos con writeFile + appendFile y cede el hilo entre trozos.
     */
    saveTrackBlob: async (blob, filename) => {
        let finalFilename = filename;
        if (filename.endsWith('.mp3')) {
            const ext = await detectAudioExtension(blob, '.mp3');
            if (ext !== '.mp3') {
                finalFilename = filename.slice(0, -4) + ext;
                console.log(`[NativeEngine] saveTrackBlob: Auto-detected ${ext} format for ${filename} -> saving as ${finalFilename}`);
            }
        }

        const buf = await blob.arrayBuffer();
        const u8 = new Uint8Array(buf);
        const len = u8.length;
        if (len === 0) throw new Error('[NativeEngine] saveTrackBlob: empty blob');

        // Each chunk must be an exact multiple of 3 bytes so that btoa() never emits
        // intermediate padding ('=' chars). Capacitor's appendFile decodes each base64
        // segment independently before appending raw bytes; a padded segment boundary
        // causes byte misalignment in the reconstructed file → scratchy/corrupt audio.
        // 192 * 1024 = 196608, and 196608 % 3 === 0, so this is already safe.
        const CHUNK = 192 * 1024; // must remain a multiple of 3

        const toB64 = (bytes) => {
            let binary = '';
            const step = 0x8000;
            for (let i = 0; i < bytes.length; i += step) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
            }
            return btoa(binary);
        };

        // Remove any pre-existing (possibly corrupted) file before writing.
        fileCache.delete(finalFilename);
        try {
            await Filesystem.deleteFile({ path: finalFilename, directory: Directory.Data });
        } catch { /* file may not exist yet — that is fine */ }

        let offset = 0;
        let first = true;
        while (offset < len) {
            const end = Math.min(offset + CHUNK, len);
            const piece = u8.subarray(offset, end);
            const b64 = toB64(piece);
            if (first) {
                await Filesystem.writeFile({
                    path: finalFilename,
                    data: b64,
                    directory: Directory.Data,
                });
                first = false;
            } else {
                await Filesystem.appendFile({
                    path: finalFilename,
                    data: b64,
                    directory: Directory.Data,
                });
            }
            offset = end;
            await new Promise((r) => setTimeout(r, 0));
        }

        // Validate that the written file is at least as large as our minimum threshold.
        // This catches partial writes caused by low-storage or OS interruption.
        try {
            const info = await Filesystem.stat({ path: finalFilename, directory: Directory.Data });
            if ((info?.size ?? 0) < MIN_VALID_TRACK_BYTES) {
                throw new Error(`[NativeEngine] saveTrackBlob: written file too small (${info?.size}B) for '${finalFilename}'`);
            }
        } catch (statErr) {
            if (String(statErr?.message || '').includes('saveTrackBlob')) throw statErr;
            // stat itself failed — tolerate and continue; the read will fail later if corrupt
            console.warn('[NativeEngine] saveTrackBlob: post-write stat failed:', statErr);
        }

        fileCache.add(finalFilename);
        return await getFilePath(finalFilename);
    },

    /**
     * Lee un archivo del filesystem nativo y lo devuelve como Blob.
     * Útil para recuperar el blob de __PreviewMix cuando localforage fue limpiado.
     */
    readTrackBlob: async (songId, trackName) => {
        await autoFixFileExtension(songId, trackName);
        let filename = `${songId}_${trackName}.mp3`;
        if (await fileExists(`${songId}_${trackName}.wav`)) {
            filename = `${songId}_${trackName}.wav`;
        } else if (await fileExists(`${songId}_${trackName}.flac`)) {
            filename = `${songId}_${trackName}.flac`;
        }

        const blobFromBase64 = (data) => {
            const binaryString = atob(data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            return new Blob([bytes.buffer], { type: filename.endsWith('.wav') ? 'audio/wav' : (filename.endsWith('.flac') ? 'audio/flac' : 'audio/mpeg') });
        };
        try {
            const { uri } = await Filesystem.getUri({
                path: filename,
                directory: Directory.Data,
            });
            const url = Capacitor.convertFileSrc(uri);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`readTrackBlob fetch ${res.status}`);
            return await res.blob();
        } catch (e) {
            try {
                const { data } = await Filesystem.readFile({ path: filename, directory: Directory.Data });
                return blobFromBase64(data);
            } catch (e2) {
                console.warn('[NativeEngine] readTrackBlob failed:', trackName, e2);
                return null;
            }
        }
    },

    /** @deprecated Prefer loadTracks batch — NextGen loads whole session at once. */
    loadSingleTrack: async (id, path) => {
        try {
            console.log('[NEXTGEN_UI] load song (single)', id);
            await NextGenMixerBridge.loadSongSession({ tracks: [{ id, path }] });
        } catch (err) {
            console.error('[NativeEngine] loadSingleTrack error:', err);
        }
    },

    getTrackCount: async () => {
        try {
            const s = await nextGenSnapshot();
            if (typeof s.trackCount === 'number') return s.trackCount;
            if (Array.isArray(s.tracks)) return s.tracks.length;
            return 0;
        } catch (err) {
            console.warn('[NativeEngine] getTrackCount error', err);
            return 0;
        }
    },

    loadTracks: async (tracks) => {
        try {
            console.log('[NEXTGEN_UI] load song', tracks?.length ?? 0);
            await NextGenMixerBridge.loadSongSession({ tracks });
        } catch (err) {
            console.error('[NativeEngine] loadTracks error:', err);
        }
    },

    /** Legacy preload queue — not used by NextGen (no-op). */
    preloadTracks: async () => {
        console.log('[NEXTGEN_UI] preload disabled (NextGen)');
    },

    /** Legacy swap — not used by NextGen. */
    swapToPending: async () => {
        console.log('[NEXTGEN_UI] swap disabled (NextGen)');
        return false;
    },

    clearPending: async () => {},

    play: async () => {
        try {
            console.log('[NEXTGEN_UI] play');
            await NextGenMixerBridge.play();
        } catch (err) {
            console.warn('play error', err);
        }
    },

    pause: async () => {
        try {
            console.log('[NEXTGEN_UI] pause');
            await NextGenMixerBridge.pause();
        } catch (err) {
            console.warn('pause error', err);
        }
    },

    stop: async () => {
        try {
            console.log('[NEXTGEN_UI] stop');
            await NextGenMixerBridge.stop();
        } catch (err) {
            console.warn('stop error', err);
        }
    },

    clearTracks: async () => {
        try {
            await NextGenMixerBridge.stop();
        } catch (err) {
            console.warn('[NativeEngine] clearTracks error', err);
        }
    },

    seek: async (seconds) => {
        try {
            console.log('[NEXTGEN_UI] seek', seconds);
            await NextGenMixerBridge.seek({ seconds });
        } catch (err) {
            console.warn('seek error', err);
        }
    },

    setMasterVolume: async (volume) => {
        try {
            const v = typeof volume === 'number' && Number.isFinite(volume) ? volume : 1;
            await NextGenMixerBridge.setMasterVolume({ volume: v });
        } catch (err) {
            console.warn('setMasterVolume error', err);
        }
    },

    setTrackVolume: async (id, volume) => {
        try {
            console.log('[NEXTGEN_UI] volume change', id, volume);
            await NextGenMixerBridge.setTrackVolume({ id, volume });
        } catch (err) {
            console.warn('setTrackVol error', err);
        }
    },

    setTrackMute: async (id, muted) => {
        try {
            console.log('[NEXTGEN_UI] mute', id, muted);
            await NextGenMixerBridge.setTrackMute({ id, muted });
        } catch (err) {
            console.warn('mute error', err);
        }
    },
    setTrackSolo: async (id, solo) => {
        try {
            console.log('[NEXTGEN_UI] solo', id, solo);
            await NextGenMixerBridge.setTrackSolo({ id, solo });
        } catch (err) {
            console.warn('solo error', err);
        }
    },
    setTrackPan: async (id, pan) => {
        try {
            console.log('[NEXTGEN_UI] pan change', id, pan);
            await NextGenMixerBridge.setTrackPan({ id, pan });
        } catch (err) {
            console.warn('setTrackPan error', err);
        }
    },

    setSpeed: async (ratio) => {
        try {
            const r = typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : 1;
            await NextGenMixerBridge.setTempoRatio({ ratio: r });
        } catch (err) {
            console.warn('setSpeed/tempo error', err);
        }
    },

    getPosition: async () => {
        try {
            const s = await nextGenSnapshot();
            const p = s.positionSec;
            return typeof p === 'number' && Number.isFinite(p) ? p : 0;
        } catch (err) {
            console.warn('[NativeEngine] getPosition error', err);
            return 0;
        }
    },

    getDuration: async () => {
        try {
            const s = await nextGenSnapshot();
            const d = s.durationSec;
            return typeof d === 'number' && Number.isFinite(d) ? d : 0;
        } catch (err) {
            console.warn('[NativeEngine] getDuration error', err);
            return 0;
        }
    },

    setPitch: async (semitones) => {
        try {
            const s = typeof semitones === 'number' ? semitones : 0;
            await NextGenMixerBridge.setPitchSemiTones({ semitones: s });
        } catch (err) {
            console.warn('setPitch error', err);
        }
    },

    getTrackLevels: async () => {
        try {
            const s = await nextGenSnapshot();
            return trackLevelsCsvFromSnapshot(s);
        } catch {
            return '';
        }
    },

    // ── Audio Format v2 (FLAC) helpers ───────────────────────────────────────
    // Tracks marked normalizedReady===true are stored on device as .flac files.
    // These helpers parallel the .mp3 equivalents for those tracks.

    /**
     * Returns true if a v2 (FLAC) cached file exists for this track.
     */
    isNormalizedDownloaded: async (songId, trackName) => {
        const filename = `${songId}_${trackName}.flac`;
        return await fileExists(filename);
    },

    /**
     * Absolute file path to the v2 FLAC cache for this track.
     */
    getNormalizedPath: async (songId, trackName) => {
        const filename = `${songId}_${trackName}.flac`;
        return await getFilePath(filename);
    },

    /**
     * Deletes the legacy v1 MP3 or WAV cache file for a track (if it exists).
     * Called after a FLAC download so old MP3/WAV storage is freed.
     */
    invalidateLegacyCache: async (songId, trackName) => {
        const mp3Filename = `${songId}_${trackName}.mp3`;
        const wavFilename = `${songId}_${trackName}.wav`;
        try {
            await Filesystem.deleteFile({ path: mp3Filename, directory: Directory.Data });
            fileCache.delete(mp3Filename);
            console.log('[NativeEngine] Legacy MP3 deleted:', mp3Filename);
        } catch {
            // File didn't exist — nothing to do.
        }
        try {
            await Filesystem.deleteFile({ path: wavFilename, directory: Directory.Data });
            fileCache.delete(wavFilename);
            console.log('[NativeEngine] Legacy WAV deleted:', wavFilename);
        } catch {
            // File didn't exist — nothing to do.
        }
    },
};
