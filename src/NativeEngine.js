import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const MultitrackPlugin = registerPlugin('MixerBridge', {
    web: () => import('./MultitrackPluginWeb').then(m => new m.MultitrackPluginWeb()),
});

// Logs for debugging
setTimeout(async () => {
    try {
        const { value } = await MultitrackPlugin.echo({ value: 'CONEXION' });
        console.log('[NativeEngine] Puente OK:', value);
        const status = await MultitrackPlugin.checkStatus();
        console.log('[NativeEngine] C++:', status.info);
    } catch (e) {
        console.error('[NativeEngine] Puente Fallo:', e);
    }
}, 2000);

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

/**
 * UTILITY: Check if file exists
 */
async function fileExists(filename) {
    if (fileCache.has(filename)) return true;

    try {
        await Filesystem.stat({
            path: filename,
            directory: Directory.Data,
        });
        fileCache.add(filename);
        return true;
    } catch {
        console.warn('[NativeEngine] fileExists error: unknown');
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

export const NativeEngine = {
    /**
     * Checks if a track is already in the phone storage.
     * Use this to avoid downloading again.
     */
    isTrackDownloaded: async (songId, trackName) => {
        const filename = `${songId}_${trackName}.mp3`;
        return await fileExists(filename);
    },

    /**
     * Gets the direct path to a track for the C++ engine.
     */
    getTrackPath: async (songId, trackName) => {
        const filename = `${songId}_${trackName}.mp3`;
        return await getFilePath(filename);
    },

    /**
     * Saves a Blob (downloaded from B2) directly to phone storage.
     */
    saveTrackBlob: async (blob, filename) => {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                resolve(result.substring(result.indexOf(',') + 1));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });

        await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Data,
        });

        fileCache.add(filename);
        return await getFilePath(filename);
    },

    loadSingleTrack: async (id, path) => {
        try {
            await MultitrackPlugin.loadTracks({ tracks: [{ id, path }] });
        } catch (err) {
            console.error('[NativeEngine] loadSingleTrack error:', err);
        }
    },

    getTrackCount: async () => {
        try {
            const { count } = await MultitrackPlugin.getTrackCount();
            return count;
        } catch (err) { 
            console.warn('[NativeEngine] getTrackCount error', err); 
            return 0; 
        }
    },

    loadTracks: async (tracks) => {
        try {
            await MultitrackPlugin.clearTracks();
            // tracks is [{id, path}, ...]
            await MultitrackPlugin.loadTracks({ tracks });
            console.log(`[NativeEngine] Pistas cargadas en C++: ${tracks.length}`);
        } catch (err) {
            console.error('[NativeEngine] loadTracks error:', err);
        }
    },

    play: async () => {
        try { await MultitrackPlugin.play(); } catch (err) { console.warn('play error', err); }
    },

    pause: async () => {
        try { await MultitrackPlugin.pause(); } catch (err) { console.warn('pause error', err); }
    },

    stop: async () => {
        try { await MultitrackPlugin.stop(); } catch (err) { console.warn('stop error', err); }
    },

    seek: async (seconds) => {
        try { await MultitrackPlugin.seek({ seconds }); } catch (err) { console.warn('seek error', err); }
    },

    setMasterVolume: async (volume) => {
        try { await MultitrackPlugin.setVolume({ volume }); } catch (err) { console.warn('setVolume error', err); }
    },

    setTrackVolume: async (id, volume) => {
        try { await MultitrackPlugin.setTrackVolume({ id, volume }); } catch (err) { console.warn('setTrackVol error', err); }
    },

    setTrackMute: async (id, muted) => {
        try { await MultitrackPlugin.setTrackMute({ id, muted }); } catch (err) { console.warn('mute error', err); }
    },
    setTrackSolo: async (id, solo) => {
        try { await MultitrackPlugin.setTrackSolo({ id, solo }); } catch (err) { console.warn('solo error', err); }
    },

    setSpeed: async (speed) => {
        try { await MultitrackPlugin.setSpeed({ speed }); } catch (err) { console.warn('speed error', err); }
    },

    getPosition: async () => {
        try {
            const { position } = await MultitrackPlugin.getPosition();
            return position;
        } catch (err) {
            console.warn('[NativeEngine] getPosition error', err);
            return 0;
        }
    },
};
