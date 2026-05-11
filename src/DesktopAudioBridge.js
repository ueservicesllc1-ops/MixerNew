const IS_DESKTOP = typeof window !== 'undefined' && (
    window.electronAPI?.isDesktop === true || window.zionNative?.isDesktop === true
);

function getBridge() {
    return window.electronAPI || window.zionNative || null;
}

function basenameKey(p) {
    if (!p || typeof p !== 'string') return '';
    const s = String(p).trim();
    const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return i >= 0 ? s.slice(i + 1) : s;
}

function inferSongIdFromTrack(t) {
    const id = String(t?.id || '');
    const name = String(t?.name || '');
    if (!id || !name) return '';
    const suf = `_${name}`;
    if (id.endsWith(suf)) return id.slice(0, -suf.length);
    const u = id.indexOf('_');
    return u > 0 ? id.slice(0, u) : '';
}

function parseSnapshot(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    if (typeof raw === 'object') return raw;
    return {};
}

export const DesktopAudioBridge = {
    isDesktop() {
        return IS_DESKTOP;
    },

    async loadSongFromPaths(tracks) {
        const bridge = getBridge();
        if (!IS_DESKTOP || !bridge?.loadSong) {
            throw new Error('[DESKTOP AUDIO] Native JUCE bridge missing');
        }
        const payload = (tracks || [])
            .filter((t) => !t?.isVisualOnly)
            .map((t) => {
                const key0 = basenameKey(t.localPath || t.path || t.cacheKey || t.filename);
                const songId = inferSongIdFromTrack(t);
                const fallback = songId && t.name ? `${songId}_${t.name}.mp3` : '';
                return {
                    id: t.id,
                    name: t.name,
                    filename: key0 || fallback,
                    isGuide: !!t.isGuide,
                    isClick: !!t.isClick,
                };
            })
            .filter((t) => typeof t.filename === 'string' && t.filename.trim().length > 0);
        console.log('[DESKTOP NATIVE] using JUCE engine');
        console.log('[DESKTOP NATIVE] load paths count', payload.length);
        const t0 = performance.now();
        const ok = await bridge.loadSong(payload);
        if (!ok) throw new Error('[DESKTOP AUDIO] loadSong failed');
        console.log('[DESKTOP NATIVE] ready in', Math.round(performance.now() - t0), 'ms');
        return true;
    },

    play() { getBridge()?.play?.(); },
    pause() { getBridge()?.pause?.(); },
    stop() { getBridge()?.stop?.(); },
    seek(seconds) { getBridge()?.seek?.(seconds); },

    async getSnapshot() {
        const raw = await getBridge()?.getSnapshot?.();
        return parseSnapshot(raw);
    },
    async getPosition() {
        const s = await this.getSnapshot();
        return Number.isFinite(s.positionSec) ? s.positionSec : 0;
    },
    async getDuration() {
        const s = await this.getSnapshot();
        return Number.isFinite(s.durationSec) ? s.durationSec : 0;
    },

    setTrackVolume(id, volume) { getBridge()?.setTrackVolume?.(id, volume); },
    setTrackMute(id, muted) { getBridge()?.setTrackMute?.(id, muted); },
    setTrackSolo(id, solo) { getBridge()?.setTrackSolo?.(id, solo); },
    setTempoRatio(ratio) { getBridge()?.setTempoRatio?.(ratio); },
    setPitchSemitones(semitones) { getBridge()?.setPitchSemitones?.(semitones); },

    async getTrackLevels() {
        const s = await this.getSnapshot();
        return s.trackLevelsCsv || '';
    },
};

