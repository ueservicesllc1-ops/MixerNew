/**
 * Load decoded AudioBuffer (or raw float channel) for click-track analysis.
 */
import { audioEngine } from '../AudioEngine';
import { NativeEngine } from '../NativeEngine';

async function decodeArrayBufferToAudioBuffer(ab) {
    const slice = ab instanceof ArrayBuffer ? ab.slice(0) : ab;
    if (audioEngine?.ctx && typeof audioEngine.ctx.decodeAudioData === 'function') {
        return await audioEngine.ctx.decodeAudioData(slice);
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) throw new Error('No decodeAudioData context available');
    const ctx = new AC();
    try {
        return await ctx.decodeAudioData(slice);
    } finally {
        if (typeof ctx.close === 'function') {
            try { await ctx.close(); } catch { /* ignore */ }
        }
    }
}

function toArrayBufferMaybe(raw) {
    if (!raw) return null;
    if (raw instanceof ArrayBuffer) return raw.slice(0);
    if (raw?.buffer instanceof ArrayBuffer && typeof raw.byteLength === 'number') {
        const offset = raw.byteOffset || 0;
        return raw.buffer.slice(offset, offset + raw.byteLength);
    }
    return null;
}

/**
 * @param {string} songId
 * @param {string} stemName
 * @returns {Promise<AudioBuffer|null>}
 */
export async function loadClickStemAudioBuffer(songId, stemName) {
    if (!songId || !stemName) return null;
    const id = `${songId}_${stemName}`;

    const fromMeta = audioEngine._trackMeta?.get(id)?.buffer;
    if (fromMeta && typeof fromMeta.getChannelData === 'function') return fromMeta;

    const fromTrack = audioEngine.tracks?.get(id)?.buffer;
    if (fromTrack && typeof fromTrack.getChannelData === 'function') return fromTrack;

    const isCap = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    const isDesktop = typeof window !== 'undefined' && !!window.zionNative;

    if (isDesktop && window.zionNative?.readEncryptedTrack) {
        const base = `${songId}_${stemName}`;
        const candidates = [
            `${base}.mp3`,
            `${base}.flac`,
            `${base}.wav`,
            base,
        ];
        for (const key of [...new Set(candidates)]) {
            try {
                const raw = await window.zionNative.readEncryptedTrack(key);
                const ab = toArrayBufferMaybe(raw);
                if (ab) return await decodeArrayBufferToAudioBuffer(ab);
            } catch {
                /* try next */
            }
        }
    }

    if (isCap) {
        try {
            const raw = await NativeEngine.readTrackBlob(songId, stemName);
            if (raw) {
                const ab = raw instanceof ArrayBuffer ? raw.slice(0) : await raw.arrayBuffer();
                return await decodeArrayBufferToAudioBuffer(ab);
            }
        } catch {
            /* ignore */
        }
    }

    return null;
}

/**
 * Downmix first channel (or max of channels) to Float32Array, optional decimation for speed.
 * @param {AudioBuffer} buf
 * @param {{ maxSamples?: number }} [opts]
 */
export function audioBufferToMonoFloat32(buf, opts = {}) {
    const maxSamples = opts.maxSamples ?? 4_000_000;
    const n0 = buf.length;
    const ratio = n0 > maxSamples ? Math.ceil(n0 / maxSamples) : 1;
    const n = Math.floor(n0 / ratio);
    const out = new Float32Array(n);
    const chCount = buf.numberOfChannels;
    if (chCount === 1) {
        const s = buf.getChannelData(0);
        for (let i = 0, j = 0; j < n; i += ratio, j++) out[j] = s[i] || 0;
        return { data: out, sampleRate: buf.sampleRate / ratio };
    }
    for (let i = 0, j = 0; j < n; i += ratio, j++) {
        let m = 0;
        for (let c = 0; c < chCount; c++) {
            const v = buf.getChannelData(c)[i] || 0;
            if (Math.abs(v) > Math.abs(m)) m = v;
        }
        out[j] = m;
    }
    return { data: out, sampleRate: buf.sampleRate / ratio };
}
