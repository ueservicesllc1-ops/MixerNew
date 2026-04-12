const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Musical key as stored on Firestore / UI: top-level `key`, or nested `metadata.key`,
 * `metadata.tono`, etc. (trimmed string or empty).
 */
export function getSongMusicalKey(song) {
    if (!song || typeof song !== 'object') return '';
    const m = song.metadata;
    const nested =
        m && typeof m === 'object'
            ? m.key ?? m.tono ?? m.musicalKey ?? m.tonalidad ?? ''
            : '';
    const raw = song.key ?? song.tono ?? song.musicalKey ?? nested ?? '';
    const s = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw).trim() : '';
    return s;
}

export const transposeChord = (chord, semitones) => {
    // Regex to match the base note and its accidental (e.g., C, C#, Bb)
    const chordRegex = /^([A-G][#b]?)(.*)/;
    const match = chord.match(chordRegex);

    if (!match) return chord;

    let note = match[1];
    const suffix = match[2];

    // Convert to index in sharps or flats array
    let index = notes.indexOf(note);
    if (index === -1) index = flats.indexOf(note);
    if (index === -1) return chord;

    // Calculate new index
    let newIndex = (index + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    // Decide whether to use sharps or flats (simplified rule)
    const resultNote = semitones >= 0 ? notes[newIndex] : flats[newIndex];

    return resultNote + suffix;
};

export const transposeText = (text, semitones) => {
    // This regex looks for things that look like chords: 
    // Start with A-G, optional #/b, might have m, 7, maj7, sus4, etc.
    // We look for patterns bounded by spaces or start/end of line
    const chordSearchRegex = /\b([A-G][#b]?(?:m|maj|min|aug|dim|sus|add|7|9|11|13)*)(?=\s|$|\/)/g;

    return text.replace(chordSearchRegex, (match) => {
        // Handle slash chords like C/E
        if (match.includes('/')) {
            return match.split('/').map(part => transposeChord(part, semitones)).join('/');
        }
        return transposeChord(match, semitones);
    });
};
