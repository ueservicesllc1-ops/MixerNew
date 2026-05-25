/**
 * SongMapService.js
 * Beat Grid & Song Map — Zion Stage Desktop
 *
 * Provee:
 *  - generateBeatGrid(songMap, durationSec) → beats[], bars[], sections[], markers[]
 *  - secondsToBarBeat(positionSec, songMap)  → { bar, beat, fraction }
 *  - barBeatToSeconds(bar, beat, songMap)    → number
 *  - createDefaultSongMap(bpm, timeSignature, durationSec, firstDownbeatOffset?)
 *  - mergeSongMapFromCloud(localMap, cloudMap) → merged
 *
 * Reglas:
 *  - firstDownbeatOffset es el tiempo real del primer pulso del compás 1.
 *    Puede ser 0 (inicio del audio) o positivo (intro/silencio antes del primer beat).
 *  - bars[0] = tiempo del compás 1 en segundos.
 *  - beats[0] = tiempo del primer beat del compás 1 en segundos.
 *  - No se asume que el compás 1 empieza en 0.
 *  - Soporta 4/4, 3/4, 6/8.
 *  - No bloquea reproducción (sin async).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Beats por compás según timeSignature. */
export function beatsPerBar(timeSignature) {
    switch (timeSignature) {
        case '3/4': return 3;
        case '6/8': return 6;
        case '4/4':
        default:    return 4;
    }
}

/** Segundos por beat = 60 / bpm. */
export function secPerBeat(bpm) {
    const b = typeof bpm === 'number' && bpm > 0 ? bpm : 120;
    return 60.0 / b;
}

/** Segundos por compás. */
export function secPerBar(bpm, timeSignature) {
    return secPerBeat(bpm) * beatsPerBar(timeSignature);
}

/**
 * Genera el Beat Grid completo.
 * Retorna listas ordenadas con el tiempo exacto en segundos para beats, compases y secciones.
 */
export function generateBeatGrid(songMap, durationSec) {
    if (!songMap) {
        return { beats: [], bars: [], sections: [], markers: [] };
    }

    const bpm = typeof songMap.bpm === 'number' && songMap.bpm > 0 ? songMap.bpm : 120;
    const timeSig = songMap.timeSignature || '4/4';
    const offset = typeof songMap.firstDownbeatOffset === 'number' ? songMap.firstDownbeatOffset : 0.0;
    const limit = typeof durationSec === 'number' && durationSec > 0 ? durationSec : 300.0;

    const bPerBar = beatsPerBar(timeSig);
    const sPerBeat = secPerBeat(bpm);
    const sPerBar = sPerBeat * bPerBar;

    const beats = [];
    const bars = [];

    // Generar compases y pulsos desde el offset de inicio hasta la duración total
    let currentBarSec = offset;
    let barIndex = 0;

    while (currentBarSec <= limit) {
        bars.push(currentBarSec);
        for (let beatIndex = 0; beatIndex < bPerBar; beatIndex++) {
            const beatSec = currentBarSec + beatIndex * sPerBeat;
            if (beatSec <= limit) {
                beats.push(beatSec);
            }
        }
        barIndex++;
        currentBarSec = offset + barIndex * sPerBar;
    }

    // Alinear secciones
    const sections = [];
    if (Array.isArray(songMap.sections)) {
        for (const sec of songMap.sections) {
            const barNum = typeof sec.bar === 'number' && sec.bar > 0 ? sec.bar : 1;
            const startSec = offset + (barNum - 1) * sPerBar;
            sections.push({
                ...sec,
                label: sec.name || sec.label || 'Sección',
                startSec: Math.min(startSec, limit)
            });
        }
        sections.sort((a, b) => a.startSec - b.startSec);
    }

    // Alinear marcadores
    const markers = [];
    if (Array.isArray(songMap.markers)) {
        for (const mark of songMap.markers) {
            markers.push({ ...mark });
        }
    }

    return { beats, bars, sections, markers };
}

/**
 * Convierte una posición en segundos a compás, pulso y fracción.
 */
export function secondsToBarBeat(positionSec, songMap) {
    if (!songMap) {
        return { bar: 1, beat: 1, fraction: 0.0, totalBeats: 0.0 };
    }

    const bpm = typeof songMap.bpm === 'number' && songMap.bpm > 0 ? songMap.bpm : 120;
    const timeSig = songMap.timeSignature || '4/4';
    const offset = typeof songMap.firstDownbeatOffset === 'number' ? songMap.firstDownbeatOffset : 0.0;

    const elapsed = positionSec - offset;
    if (elapsed < 0) {
        return { bar: 1, beat: 1, fraction: 0.0, totalBeats: 0.0 };
    }

    const sPerBeat = secPerBeat(bpm);
    const bPerBar = beatsPerBar(timeSig);

    const totalBeats = elapsed / sPerBeat;
    const bar = Math.floor(totalBeats / bPerBar) + 1;
    const beat = Math.floor(totalBeats % bPerBar) + 1;
    const fraction = totalBeats % 1.0;

    return { bar, beat, fraction, totalBeats };
}

/**
 * Convierte un compás y pulso musical a segundos.
 */
export function barBeatToSeconds(bar, beat, songMap) {
    if (!songMap) return 0.0;

    const bpm = typeof songMap.bpm === 'number' && songMap.bpm > 0 ? songMap.bpm : 120;
    const timeSig = songMap.timeSignature || '4/4';
    const offset = typeof songMap.firstDownbeatOffset === 'number' ? songMap.firstDownbeatOffset : 0.0;

    const sPerBeat = secPerBeat(bpm);
    const bPerBar = beatsPerBar(timeSig);
    const sPerBar = sPerBeat * bPerBar;

    const barOffset = Math.max(0, bar - 1) * sPerBar;
    const beatOffset = Math.max(0, beat - 1) * sPerBeat;

    return offset + barOffset + beatOffset;
}

/**
 * Crea un SongMap por defecto.
 */
export function createDefaultSongMap(bpm, timeSignature, durationSec, firstDownbeatOffset = 0.0) {
    const finalBpm = typeof bpm === 'number' && bpm > 0 ? bpm : 120;
    const finalSig = timeSignature || '4/4';
    return {
        bpm: finalBpm,
        timeSignature: finalSig,
        firstDownbeatOffset,
        sections: [
            { name: 'Intro', bar: 1 }
        ],
        markers: []
    };
}

/**
 * Fusiona un mapa local con el de la nube.
 */
export function mergeSongMapFromCloud(localMap, cloudMap) {
    if (!localMap) return cloudMap;
    if (!cloudMap) return localMap;
    return {
        ...cloudMap,
        bpm: localMap.bpm || cloudMap.bpm || 120,
        timeSignature: localMap.timeSignature || cloudMap.timeSignature || '4/4',
        firstDownbeatOffset: typeof localMap.firstDownbeatOffset === 'number' ? localMap.firstDownbeatOffset : cloudMap.firstDownbeatOffset,
        sections: localMap.sections?.length ? localMap.sections : cloudMap.sections,
        markers: localMap.markers?.length ? localMap.markers : cloudMap.markers,
    };
}

// ---------------------------------------------------------------------------
// SongMapService Class
// ---------------------------------------------------------------------------

class SongMapService {
    constructor() {
        this._maps = new Map();
    }

    /**
     * Carga el songMap desde SQLite nativo o de la memoria.
     */
    async loadForSong(songId) {
        if (!songId) return null;
        if (this._maps.has(songId)) {
            return this._maps.get(songId);
        }

        try {
            if (window.zionNative?.getSongMap) {
                const raw = await window.zionNative.getSongMap(songId);
                if (raw) {
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    this._maps.set(songId, parsed);
                    console.log(`[SONG MAP] loaded songId=${songId} bpm=${parsed.bpm}`);
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[SONG MAP] loadForSong error:', e);
        }
        return null;
    }

    /**
     * Obtiene un mapa de canción existente o crea uno predeterminado.
     */
    async getOrCreate(songId, bpm, timeSignature, durationSec, firstDownbeatOffset = 0.0, cloudSongMap = null) {
        if (!songId) return null;
        let localMap = await this.loadForSong(songId);
        let finalMap = localMap;
        let regenerated = false;

        if (!finalMap) {
            if (cloudSongMap) {
                finalMap = cloudSongMap;
                console.log(`[SONG MAP] loaded from cloud songId=${songId} bpm=${finalMap.bpm}`);
            } else {
                finalMap = createDefaultSongMap(bpm, timeSignature, durationSec, firstDownbeatOffset);
                console.log(`[SONG MAP] generated songId=${songId} bpm=${finalMap.bpm} sig=${timeSignature} offset=${firstDownbeatOffset}`);
            }
            this._maps.set(songId, finalMap);
            regenerated = true;
        }

        // Persistir en SQLite si no existía localmente o si se regeneró
        if (!localMap || regenerated) {
            this._saveSilently(songId, finalMap);
        }

        return finalMap;
    }

    /**
     * Guardar songMap en SQLite (no bloquea reproducción).
     */
    async save(songId, songMap) {
        if (!songId || !songMap) return;
        this._maps.set(songId, songMap);
        this._saveSilently(songId, songMap);
    }

    /**
     * Retorna el songMap en memoria para una canción (sync).
     */
    get(songId) {
        return this._maps.get(songId) ?? null;
    }

    /** secondsToBarBeat con el mapa en memoria. */
    secondsToBarBeat(songId, positionSec) {
        const map = this._maps.get(songId);
        if (!map) return { bar: 1, beat: 1, fraction: 0.0, totalBeats: 0.0 };
        return secondsToBarBeat(positionSec, map);
    }

    /** barBeatToSeconds con el mapa en memoria. */
    barBeatToSeconds(songId, bar, beat) {
        const map = this._maps.get(songId);
        if (!map) return 0.0;
        return barBeatToSeconds(bar, beat, map);
    }

    _saveSilently(songId, songMap) {
        try {
            if (window.zionNative?.saveSongMap) {
                window.zionNative.saveSongMap(songId, JSON.stringify(songMap))
                    .then(() => console.log(`[SONG MAP] saved local songId=${songId}`))
                    .catch((e) => console.warn('[SONG MAP] save error:', e));
            }
        } catch (e) {
            console.warn('[SONG MAP] saveSilently error:', e);
        }
    }
}

// Singleton global accesible desde cualquier módulo JS
export const songMapService = new SongMapService();
