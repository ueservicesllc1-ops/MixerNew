/**
 * AudioEngine.js
 * Optimized for Native Storage: Direct file loading, minimum RAM usage.
 */

let _nativeEngine = null;
async function getNative() {
    if (!_nativeEngine) {
        const mod = await import('./NativeEngine');
        _nativeEngine = mod.NativeEngine;
    }
    return _nativeEngine;
}

const IS_NATIVE =
    typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

class AudioEngine {
    constructor() {
        this.isPlaying = false;
        this.pausePosition = 0;
        this.tempoRatio = 1.0;
        this.pitchSemitones = 0;
        this.progress = 0;
        this._updater = null;

        // trackId => { path, volume, muted, solo, buffer }
        this._trackMeta = new Map();
        this.tracks = new Map();
        this._playStartWall = 0;
        this._playStartPos = 0;

        if (!IS_NATIVE) {
            this._initWebAudio();
        }
    }

    _initWebAudio() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        this.stSumBus = this.ctx.createGain();
        this.masterGain = this.ctx.createGain();
        this.stSumBus.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    async init() {
        this._initWebAudio();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    /**
     * NATIVE MODE / WEB BATCH: Loads multiple tracks at once for maximum speed.
     */
    async addTracksBatch(tracksArray) {
        if (IS_NATIVE) {
            const batch = [];
            for (const t of tracksArray) {
                const trackInfo = {
                    path: t.path,
                    volume: 1,
                    muted: false,
                    solo: false,
                    isVisualOnly: !!t.isVisualOnly,
                    buffer: t.audioBuffer // Guardar buffer para visuales
                };
                this._trackMeta.set(t.id, trackInfo);
                if (t.path) batch.push({ id: t.id, path: t.path });
            }
            if (batch.length > 0) {
                const n = await getNative();
                await n.loadTracks(batch);
            }
            return;
        }

        // Web Audio Batch
        for (const t of tracksArray) {
            await this.addTrack(t.id, t.audioBuffer, t.sourceData, { isVisualOnly: t.isVisualOnly });
        }
    }

    async addTrack(id, audioBuffer, sourceData = null, options = {}) {
        if (IS_NATIVE) {
            const trackInfo = { path: null, volume: 1, muted: false, solo: false, isVisualOnly: !!options.isVisualOnly };
            this._trackMeta.set(id, trackInfo);

            if (typeof sourceData === 'string') {
                trackInfo.path = sourceData;
                this._pushToNative(id, sourceData);
            } else if (sourceData instanceof Blob) {
                const n = await getNative();
                const path = await n.saveTrackBlob(sourceData, `track_${id}.mp3`);
                trackInfo.path = path;
                this._pushToNative(id, path);
            }
            return;
        }

        // Web Audio logic
        try {
            let buffer = audioBuffer;
            if (!buffer && sourceData) {
                const arrayBuf = (sourceData instanceof Blob) ? await sourceData.arrayBuffer() : sourceData;
                buffer = await this.ctx.decodeAudioData(arrayBuf);
            }

            const pannerNode = this.ctx.createStereoPanner();
            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 256;
            const gainNode = this.ctx.createGain();

            pannerNode.connect(analyser);
            analyser.connect(gainNode);

            if (!options.isVisualOnly) {
                gainNode.connect(this.stSumBus);
            }

            this.tracks.set(id, {
                buffer: buffer,
                gain: gainNode,
                analyser: analyser,
                panner: pannerNode,
                volume: 1,
                muted: false,
                solo: false,
                isVisualOnly: options.isVisualOnly || false
            });
        } catch (e) {
            console.error(`[AudioEngine] Error decoding web audio for ${id}:`, e);
        }
    }

    _pushToNative(id, path) {
        getNative().then(n => n.loadSingleTrack(id, path)).catch(e => console.error(e));
    }

    async clear() {
        this._trackMeta.clear();
        this.tracks.clear();
        try {
            if (IS_NATIVE) {
                const n = await getNative();
                await n.stop();
                await n.clearTracks();
            } else {
                for (const id of this.tracks.keys()) this.removeTrack(id);
            }
        } catch (e) {
            console.warn("[AudioEngine] Error en clear:", e);
        }
        this.pausePosition = 0;
        this.isPlaying = false;
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    // -- Volume / Mute --
    setMasterVolume(vol) {
        if (IS_NATIVE) { getNative().then(n => n.setMasterVolume(vol)); }
        else { this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.015); }
    }

    setTrackVolume(id, vol) {
        if (IS_NATIVE) {
            const m = this._trackMeta.get(id);
            if (m) { m.volume = vol; getNative().then(n => n.setTrackVolume(id, vol)); }
        } else {
            const t = this.tracks.get(id);
            if (t) {
                t.volume = vol;
                this._updateMuteSoloState();
            }
        }
    }

    setTrackMute(id, val) {
        if (IS_NATIVE) {
            const m = this._trackMeta.get(id);
            if (m) { m.muted = val; getNative().then(n => n.setTrackMute(id, val)); }
        } else {
            const t = this.tracks.get(id);
            if (t) {
                t.muted = val;
                this._updateMuteSoloState();
            }
        }
    }

    setTrackPan(id, pan) {
        if (IS_NATIVE) {
            getNative().then(n => n.setTrackPan && n.setTrackPan(id, pan));
        } else {
            const t = this.tracks.get(id);
            if (t && t.panner) {
                t.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.05);
            }
        }
    }

    setTrackSolo(id, val) {
        if (IS_NATIVE) {
            const m = this._trackMeta.get(id);
            if (m) {
                m.solo = val;
                getNative().then(n => {
                    if (n.setTrackSolo) n.setTrackSolo(id, val);
                });
            }
        } else {
            const t = this.tracks.get(id);
            if (t) {
                t.solo = val;
                this._updateMuteSoloState();
            }
        }
    }

    _updateMuteSoloState() {
        if (IS_NATIVE) return;
        let anySolo = false;
        for (const t of this.tracks.values()) {
            if (t.solo) { anySolo = true; break; }
        }
        for (const t of this.tracks.values()) {
            let muteIt = t.muted;
            if (anySolo && !t.solo) muteIt = true;
            t.gain.gain.setTargetAtTime(muteIt ? 0 : t.volume, this.ctx.currentTime, 0.01);
        }
    }

    getTrackLevel(id) {
        if (!this.isPlaying) return 0;
        if (IS_NATIVE) {
            // Fake level for native since no native meter implemented yet
            const m = this._trackMeta.get(id);
            if (!m || m.muted) return 0;
            return (Math.random() * 0.4 + 0.3) * (m.volume || 1);
        } else {
            const t = this.tracks.get(id);
            if (!t || !t.analyser) return 0;
            const dataArray = new Uint8Array(t.analyser.frequencyBinCount);
            t.analyser.getByteTimeDomainData(dataArray);

            let max = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const v = Math.abs(dataArray[i] - 128) / 128;
                if (v > max) max = v;
            }
            return max * t.volume;
        }
    }

    removeTrack(id) {
        if (IS_NATIVE) {
            this._trackMeta.delete(id);
            getNative().then(n => n.removeTrack && n.removeTrack(id));
        } else {
            const t = this.tracks.get(id);
            if (t) {
                if (t.source) { try { t.source.stop(); } catch (e) { } }
                t.gain.disconnect();
                t.panner.disconnect();
                if (t.analyser) t.analyser.disconnect();
                this.tracks.delete(id);
            }
        }
    }

    setTempo(ratio) { this.tempoRatio = ratio; }
    setPitch(semitones) { this.pitchSemitones = semitones; }

    async play() {
        if (this.isPlaying) return;
        if (!IS_NATIVE && this.ctx.state === 'suspended') await this.ctx.resume();

        if (IS_NATIVE) {
            const native = await getNative();
            if (this.pausePosition > 0) await native.seek(this.pausePosition);
            await native.play();
            this._playStartWall = performance.now();
            this._playStartPos = this.pausePosition;
            this.isPlaying = true;
            this._startRAF();
            return;
        }

        // Web Audio Play...
        this._playStartTime = this.ctx.currentTime;
        this.isPlaying = true;
        this._startRAF();
        for (const [, track] of this.tracks.entries()) {
            if (track.isVisualOnly) continue;
            if (!track.buffer) {
                console.warn("[AudioEngine] No se puede reproducir pista sin buffer.");
                continue;
            }
            const src = this.ctx.createBufferSource();
            src.buffer = track.buffer;

            // Connect to the chain START (panner)
            src.connect(track.panner);

            src.start(0, Math.max(0, this.pausePosition));
            track.source = src;
        }
    }

    async pause() {
        if (!this.isPlaying) return;
        if (IS_NATIVE) {
            const elapsed = (performance.now() - this._playStartWall) / 1000;
            this.pausePosition = this._playStartPos + elapsed;
            const native = await getNative();
            await native.pause();
        } else {
            const elapsed = this.ctx.currentTime - this._playStartTime;
            this.pausePosition = this.pausePosition + elapsed * this.tempoRatio;
            for (const [, t] of this.tracks.entries()) { if (t.source) t.source.stop(); }
        }
        this.isPlaying = false;
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    async seek(seconds) {
        if (IS_NATIVE) {
            const native = await getNative();
            await native.seek(seconds);
            this._playStartWall = performance.now();
            this._playStartPos = seconds;
            this.pausePosition = seconds;
            this.progress = seconds;
            return;
        }

        // Web Audio logic
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            // No podemos usar this.pause() porque sumaria tiempo extra
            for (const [, t] of this.tracks.entries()) { if (t.source) t.source.stop(); }
        }
        this.pausePosition = seconds;
        this.progress = seconds;
        if (wasPlaying) {
            this.isPlaying = false; // Forzar reinicio en play()
            await this.play();
        } else {
            if (this.onProgress) this.onProgress(this.progress);
        }
    }

    async stop() {
        if (IS_NATIVE) {
            const native = await getNative();
            await native.stop();
        } else {
            for (const [, t] of this.tracks.entries()) { if (t.source) t.source.stop(); }
        }
        this.pausePosition = 0;
        this.isPlaying = false;
        this.progress = 0;
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    _startRAF() {
        const update = async () => {
            if (!this.isPlaying) return;
            if (IS_NATIVE) {
                const n = await getNative();
                this.progress = await n.getPosition();
            } else {
                const elapsed = this.ctx.currentTime - this._playStartTime;
                this.progress = this.pausePosition + (elapsed * this.tempoRatio);
            }
            if (this.onProgress) {
                this.onProgress(this.progress);
            }
            this._updater = requestAnimationFrame(update);
        };
        this._updater = requestAnimationFrame(update);
    }
}

export const audioEngine = new AudioEngine();
