import {
    BAR_GRID_STORAGE_PREFIX,
    detectBarGridFromClickChannel,
    normalizeBarGrid,
    barGridFromSongTempo,
    pickBestClickStemName,
    parseTimeSignature,
} from './barGridClickDetect';
import { loadClickStemAudioBuffer, audioBufferToMonoFloat32 } from './barGridLoadClickBuffer';

export function readLocalBarGrid(songId) {
    try {
        const raw = localStorage.getItem(`${BAR_GRID_STORAGE_PREFIX}${songId}`);
        if (!raw) return null;
        return normalizeBarGrid(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function writeLocalBarGrid(songId, barGrid) {
    try {
        localStorage.setItem(`${BAR_GRID_STORAGE_PREFIX}${songId}`, JSON.stringify(barGrid));
    } catch {
        /* ignore */
    }
}

/**
 * @param {{
 *   songId: string,
 *   song: { tempo?: string|number, barGrid?: object, tracks?: { name?: string }[] } | null,
 *   forceRedetect?: boolean
 * }} args
 * @returns {Promise<{ barGrid: object|null, source: string, error?: string }>}
 */
export async function resolveBarGridForSong(args) {
    const { songId, song, forceRedetect } = args;
    if (!songId) return { barGrid: null, source: 'none', error: 'Sin canción' };

    const fromDoc = song?.barGrid ? normalizeBarGrid(song.barGrid) : null;
    const fromLocal = readLocalBarGrid(songId);

    const pickNewer = () => {
        if (fromDoc && fromLocal) {
            const td = Date.parse(fromDoc.generatedAt || 0) || 0;
            const tl = Date.parse(fromLocal.generatedAt || 0) || 0;
            return td >= tl ? fromDoc : fromLocal;
        }
        return fromDoc || fromLocal;
    };

    if (!forceRedetect) {
        const merged = pickNewer();
        if (merged) return { barGrid: merged, source: 'cache' };
    }

    const stemName = pickBestClickStemName(song?.tracks || []);
    if (stemName) {
        try {
            const buf = await loadClickStemAudioBuffer(songId, stemName);
            if (buf) {
                const { data, sampleRate } = audioBufferToMonoFloat32(buf, { maxSamples: 3_500_000 });
                const ts = fromDoc?.timeSignature || fromLocal?.timeSignature || '4/4';
                const { beatsPerBar } = parseTimeSignature(ts);
                const det = detectBarGridFromClickChannel(data, sampleRate, {
                    beatsPerBar,
                    timeSignature: ts,
                });
                if (det.ok && det.barGrid) {
                    const norm = normalizeBarGrid(det.barGrid);
                    writeLocalBarGrid(songId, norm);
                    return { barGrid: norm, source: 'auto-click-detect' };
                }
            }
        } catch (e) {
            console.warn('[BAR GRID] click analysis', e);
        }
    }

    const meta = barGridFromSongTempo(song?.tempo);
    if (meta) {
        writeLocalBarGrid(songId, meta);
        return { barGrid: meta, source: 'metadata-bpm' };
    }

    return {
        barGrid: null,
        source: 'failed',
        error: '[BAR GRID] auto detect failed',
    };
}
