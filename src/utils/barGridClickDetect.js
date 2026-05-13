/**
 * Bar / beat grid from a click track (transients), not from t=0 assumptions.
 * Default time signature 4/4 unless overridden in saved barGrid.
 */

export const BAR_GRID_STORAGE_PREFIX = 'barGrid_';
export const PROGRESS_DISPLAY_MODE_KEY = 'mixer_progress_display_mode';

/** @param {string} s */
export function parseTimeSignature(s) {
    const m = String(s || '').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return { beatsPerBar: 4, den: 4 };
    const beats = Math.max(1, Math.min(32, parseInt(m[1], 10) || 4));
    return { beatsPerBar: beats, den: Math.max(1, parseInt(m[2], 10) || 4) };
}

/**
 * @param {string} name stem display name
 * @returns {number} 0 = not a click stem
 */
export function scoreClickStemName(name) {
    const raw = String(name || '').trim();
    const n = raw.toLowerCase().replace(/\s+/g, ' ');
    if (!n || n.includes('__preview') || n.includes('previewmix')) return 0;
    if (n === 'click' || n === 'guide click') return 100;
    if (n.includes('guide') && n.includes('click')) return 96;
    if (n === 'cue click' || n === 'cue_click') return 98;
    if (n.includes('metronome')) return 92;
    if (n === 'click ') return 0;
    if (n.endsWith(' click') && n.length < 24) return 88;
    if (n.includes('click') && n.length <= 18) return 75;
    return 0;
}

/**
 * @param {{ name?: string }[]} stemRows
 * @returns {string} stem name or ''
 */
export function pickBestClickStemName(stemRows) {
    if (!Array.isArray(stemRows)) return '';
    let best = '';
    let score = 0;
    for (const row of stemRows) {
        const s = scoreClickStemName(row?.name);
        if (s > score) {
            score = s;
            best = String(row?.name || '').trim();
        }
    }
    return score >= 70 ? best : '';
}

/**
 * @param {Float32Array} ch0 mono or first channel (may be downsampled)
 * @param {number} sampleRate
 * @param {{ beatsPerBar?: number }} [opts]
 * @returns {{ ok: boolean, barGrid?: object, error?: string }}
 */
export function detectBarGridFromClickChannel(ch0, sampleRate, opts = {}) {
    const beatsPerBar = opts.beatsPerBar ?? parseTimeSignature(opts.timeSignature).beatsPerBar;
    if (!ch0 || ch0.length < sampleRate * 0.5 || sampleRate < 8000) {
        return { ok: false, error: 'Audio demasiado corto o sample rate inválido' };
    }

    const win = Math.max(128, Math.floor(sampleRate * 0.012));
    const hop = Math.max(32, Math.floor(win / 3));
    const env = [];
    for (let i = 0; i + win < ch0.length; i += hop) {
        let e = 0;
        for (let j = 0; j < win; j++) {
            const v = ch0[i + j];
            e += v * v;
        }
        env.push({ t: (i + win * 0.5) / sampleRate, e: Math.sqrt(e / win) });
    }
    if (env.length < 40) return { ok: false, error: 'Sin suficiente energía para analizar' };

    const sorted = [...env.map((x) => x.e)].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
    const floor = q(0.55);
    const thresh = Math.max(floor * 4, q(0.92) * 0.35);

    const minGapSec = 0.11;
    const minIdxGap = Math.max(1, Math.floor((minGapSec * sampleRate) / hop));

    const peaks = [];
    for (let i = 1; i < env.length - 1; i++) {
        if (env[i].e < thresh) continue;
        if (env[i].e < env[i - 1].e || env[i].e < env[i + 1].e) continue;
        if (peaks.length && i - peaks[peaks.length - 1].idx < minIdxGap) {
            if (env[i].e > env[peaks[peaks.length - 1].idx].e) peaks[peaks.length - 1] = { idx: i, t: env[i].t };
            continue;
        }
        peaks.push({ idx: i, t: env[i].t });
    }
    if (peaks.length < 10) return { ok: false, error: 'Pocos pulsos detectados en la pista Click' };

    const deltas = [];
    for (let i = 1; i < peaks.length; i++) deltas.push(peaks[i].t - peaks[i - 1].t);

    const sortedD = [...deltas].sort((a, b) => a - b);
    const med = sortedD[Math.floor(sortedD.length / 2)];

    const stable = deltas.filter((d) => d > med * 0.65 && d < med * 1.45);
    if (stable.length < 6) return { ok: false, error: 'Tempo irregular o click muy ruidoso' };

    const T =
        stable.sort((a, b) => a - b)[Math.floor(stable.length / 2)];

    const bpm = 60 / T;
    if (bpm < 36 || bpm > 320) return { ok: false, error: 'BPM fuera de rango' };

    const mean = stable.reduce((a, b) => a + b, 0) / stable.length;
    const variance = stable.reduce((a, d) => a + (d - mean) ** 2, 0) / stable.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > 0.22) return { ok: false, error: 'Inestabilidad de intervalos demasiado alta' };

    let anchorIdx = 0;
    for (let i = 1; i + 3 < deltas.length; i++) {
        const slice = deltas.slice(i, i + 4);
        if (slice.every((d) => d > T * 0.72 && d < T * 1.28)) {
            anchorIdx = i;
            break;
        }
    }
    const firstDownbeatOffset = peaks[anchorIdx].t;

    const beatDuration = T;
    const barDuration = beatDuration * beatsPerBar;
    const generatedAt = new Date().toISOString();

    const barGrid = {
        bpm: Math.round(bpm * 1000) / 1000,
        timeSignature: `${beatsPerBar}/4`,
        beatsPerBar,
        firstDownbeatOffset: Math.max(0, Math.round(firstDownbeatOffset * 10000) / 10000),
        beatDuration: Math.round(beatDuration * 100000) / 100000,
        barDuration: Math.round(barDuration * 100000) / 100000,
        generatedAt,
        source: 'auto-click-detect',
    };
    return { ok: true, barGrid };
}

/** @param {object} raw */
export function normalizeBarGrid(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const bpm = Number(raw.bpm);
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) return null;
    const ts = raw.timeSignature || '4/4';
    const { beatsPerBar } = parseTimeSignature(ts);
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * beatsPerBar;
    const firstDownbeatOffset = Number.isFinite(raw.firstDownbeatOffset)
        ? Math.max(0, raw.firstDownbeatOffset)
        : 0;
    return {
        bpm: Math.round(bpm * 1000) / 1000,
        timeSignature: ts,
        beatsPerBar,
        firstDownbeatOffset: Math.round(firstDownbeatOffset * 10000) / 10000,
        beatDuration: Math.round(beatDuration * 100000) / 100000,
        barDuration: Math.round(barDuration * 100000) / 100000,
        generatedAt: raw.generatedAt || new Date().toISOString(),
        source: raw.source || 'manual',
    };
}

/**
 * @param {number} t sec
 * @param {object} barGrid normalized
 */
export function timeToBarBeat(t, barGrid) {
    if (!barGrid || !Number.isFinite(t)) return { beforeGrid: true, bar: 0, beat: 0 };
    const { firstDownbeatOffset, beatDuration, beatsPerBar } = barGrid;
    if (t < firstDownbeatOffset) return { beforeGrid: true, bar: 0, beat: 0 };
    const beatsFromDownbeat = (t - firstDownbeatOffset) / beatDuration;
    const bar = Math.floor(beatsFromDownbeat / beatsPerBar) + 1;
    const beat = (Math.floor(beatsFromDownbeat) % beatsPerBar) + 1;
    return { beforeGrid: false, bar, beat };
}

/**
 * @param {number} t
 * @param {number} dur
 * @param {object|null} barGrid
 */
export function formatBarBeatTransport(t, dur, barGrid) {
    if (!barGrid) return 'Compás no disponible';
    const { beforeGrid, bar, beat } = timeToBarBeat(t, barGrid);
    if (beforeGrid) return `Intro · ${formatClock(t)} / ${formatClock(dur)}`;
    return `Compás ${bar} · Beat ${beat}`;
}

function formatClock(s) {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function barGridFromSongTempo(tempo, beatsPerBar = 4) {
    const bpm = parseFloat(tempo);
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) return null;
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * beatsPerBar;
    return normalizeBarGrid({
        bpm,
        timeSignature: `${beatsPerBar}/4`,
        firstDownbeatOffset: 0,
        beatDuration,
        barDuration,
        beatsPerBar,
        generatedAt: new Date().toISOString(),
        source: 'metadata-bpm',
    });
}
