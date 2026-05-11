/** Quitar marcas diacríticas (guía → guia). */
export function normalizeStemLabel(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}

/**
 * Click / metrónomo y variantes: click, clik, clic, metronomo, metronome, metronom…
 */
export function isMixerClickStem(name) {
    const raw = String(name || '').toLowerCase();
    const n = normalizeStemLabel(name);
    if (/\b(click|clik|metronom|metronome|metronomo)\b/.test(n)) return true;
    if (/\bclic\b/.test(raw) || /\bclic\b/.test(n)) return true;
    if (raw.includes('click') || raw.includes('clik') || raw.includes('metronom')) return true;
    return false;
}

/**
 * Guía / cue y variantes (no clasifica como guía si ya es click).
 */
export function isMixerGuideStem(name) {
    if (isMixerClickStem(name)) return false;
    const raw = String(name || '').toLowerCase();
    const n = normalizeStemLabel(name);
    if (/\b(guides?|guia[s]?|cue[s]?)\b/.test(n)) return true;
    if (raw.includes('guide') || raw.includes('guia') || raw.includes('cue')) return true;
    return false;
}
