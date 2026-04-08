/**
 * lyricsExtractor.js
 * Extracts clean lyrics from a chord-chart / cifrado text.
 *
 * Removes:
 *   - Lines that are ONLY chord names/tokens  (G, Em7, Cadd2 F, Am7/E …)
 *   - Guitar / bass tablature string rows     (e 3 3 1 0 0 / e|--0-2-- / etc.)
 *   - Chord-section header lines              (ESTAS SON LOS ACORDES…, Capo:, Tuning:…)
 *   - Structural markers without lyrics       ([Intro], Coro:, Bridge…)
 *   - Lines opened with // that contain only chords
 *
 * Keeps:
 *   - All lines that contain actual lyric words
 *   - Section NAME lines that have real words (e.g. "TUYO SOY")
 *   - Up to 2 consecutive blank lines (to preserve verse separation)
 */

// ─── Chord token regex ──────────────────────────────────────────────────────
// Matches a single chord token: G, Am, F#m7, Cadd2, Em7, Dsus4, Bb/F, Bm/F# …
const CHORD_TOKEN_RE =
    /^[A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add|dom|5)?(?:\d{0,2})(?:\/[A-G][#b]?)?$/;

/**
 * Is every non-whitespace token on this line a chord symbol?
 */
function isChordOnlyLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const tokens = trimmed.split(/\s+/);
    // Need at least 1 token and ALL tokens must be chord-shaped
    return tokens.length >= 1 && tokens.every(t => CHORD_TOKEN_RE.test(t));
}

/**
 * Is this line a guitar/bass tablature row?
 *  e  3  3  3  1  0  0
 *  e|--0--2--3--|
 *  B  3  3  3  1  2  1
 *  |--0--------||
 */
function isTabLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Standard tab with pipe notation: "e|", "E|", "B|", "G|", "D|", "A|"
    if (/^[eEBGDA]\s*\|/.test(trimmed)) return true;

    // String-number shorthand: single letter then only digits/spaces
    // e.g. "e 3 3 3 1 0 0"  "A 2 2 3 3 0 3"
    if (/^[eEBGDA]\s+[\d\s]+$/.test(trimmed)) return true;

    // Pure dash/digit/pipe line (strum patterns or tab bars)
    if (trimmed.length > 2 && /^[\d\s\-|x/\\hpb~()[\]]+$/i.test(trimmed)) return true;

    return false;
}

/**
 * Is this line a chord-section header / instrument instruction?
 *   ESTAS SON LOS ACORDES QUE SE NECESITAN:
 *   Acordes usados:
 *   Capotraste en traste 2
 *   Tuning: Standard
 *   [Intro]   [Coro]   [Bridge]  (markers without lyric content)
 */
function isChordHeader(line) {
    const t = line.trim();

    // Square-bracket structural markers: [Intro], [Chorus], [Verse 1] …
    if (/^\[.{1,25}\]$/.test(t)) return true;

    // Common Spanish/English chord-chart headers
    if (/acorde[s]?\s*(usado[s]?|necesario[s]?|utilizado[s]?|que se necesitan)/i.test(t)) return true;
    if (/estas son los acordes/i.test(t)) return true;
    if (/^tuning[:\s]/i.test(t)) return true;
    if (/^afinaci[oó]n[:\s]/i.test(t)) return true;
    if (/^capo(traste)?[:\s\d]/i.test(t)) return true;
    if (/^capejado[:\s]/i.test(t)) return true;
    if (/^barre[:\s]/i.test(t)) return true;
    if (/^tempo[:\s]/i.test(t)) return true;
    if (/^compás[:\s]/i.test(t)) return true;

    // Bare section-name lines (only the word, no lyric):
    // Intro: / Coro: / Puente: / Bridge: / Estribillo: etc.
    if (/^(?:intro|verso|coro|puente|bridge|chorus|pre[-\s]?chorus|outro|estribillo|estrofa|pre[-\s]?coro|refr[aá]n)\s*[:\d]*$/i.test(t)) return true;

    return false;
}

/**
 * extractLyricsOnly(rawText)
 *
 * Pass the full text of a cifrado / chord-chart document.
 * Returns a clean string containing only the lyric lines.
 */
export function extractLyricsOnly(rawText) {
    if (!rawText) return '';

    const lines = rawText.split('\n');
    const out = [];
    let blankRun = 0;

    for (const line of lines) {
        const display = line.trimEnd();   // keep leading indent for readability
        const trimmed = display.trim();

        // ── Empty line handling ───────────────────────────────────────────
        if (!trimmed) {
            blankRun++;
            if (blankRun <= 2) out.push('');
            continue;
        }
        blankRun = 0;

        // ── Lines starting with // ────────────────────────────────────────
        // In many cifrados // marks a chorus/bridge lyric. Strip the marker
        // but keep the actual lyric — unless it's just a chord after //.
        if (trimmed.startsWith('//')) {
            const afterSlash = trimmed.slice(2).trim();
            if (!afterSlash) continue;                        // empty marker
            if (isChordOnlyLine(afterSlash)) continue;        // just chords
            if (isChordHeader(afterSlash)) continue;          // header after //
            out.push(afterSlash);                             // keep lyric content
            continue;
        }

        // ── Skip tab rows ─────────────────────────────────────────────────
        if (isTabLine(display)) continue;

        // ── Skip chord headers ────────────────────────────────────────────
        if (isChordHeader(display)) continue;

        // ── Skip pure-chord lines ─────────────────────────────────────────
        if (isChordOnlyLine(trimmed)) continue;

        // ── Everything else is a lyric line ──────────────────────────────
        out.push(display);
    }

    // Remove leading / trailing blank lines
    while (out.length && out[0] === '') out.shift();
    while (out.length && out[out.length - 1] === '') out.pop();

    return out.join('\n');
}
