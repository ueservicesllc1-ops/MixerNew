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
        this._progressListeners = new Set();
        
        // High-res timing for 60fps interpolation
        this.lastFetchPos = 0;
        this.lastFetchTime = 0; 
        
        // Drag Synchronization
        this.isDragging = false;
        this.dragTime = 0;

        // Frame limiter: notify at max ~15 FPS to reduce JS bridge pressure
        this._lastNotifyTime = 0;
        this._NOTIFY_INTERVAL = 66; // ms (approx 15 Hz)

        this.workletLoaded = false;
        this.masterSoundTouchNode = null;

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

        if (!this.workletLoaded && !IS_NATIVE) {
            try {
                await this.ctx.audioWorklet.addModule('/soundtouch-worklet.js');
                this.workletLoaded = true;
                console.log("[AudioEngine] SoundTouchWorklet loaded.");
            } catch (err) {
                console.error("[AudioEngine] Failed to load soundtouch-worklet.js", err);
            }
        }
    }

    /**
     * NATIVE MODE / WEB BATCH: Loads multiple tracks at once for maximum speed.
     */
    async addTracksBatch(tracksArray) {
        this.resetTiming(); // Total reset BEFORE loading new song
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
                
                if (!arrayBuf || arrayBuf.byteLength < 500) {
                    throw new Error(`Buffer de audio corrupto o demasiado pequeño (${arrayBuf?.byteLength || 0} bytes).`);
                }

                try {
                    buffer = await this.ctx.decodeAudioData(arrayBuf);
                } catch (decodeErr) {
                    console.error(`[AudioEngine] Error de decodificación para ${id}. Es posible que el archivo no sea un audio válido.`, decodeErr);
                    throw decodeErr;
                }
            }

            if (!buffer) {
                // Si no hay buffer, no creamos la cadena de nodos para esta pista
                return;
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
        
        try {
            if (IS_NATIVE) {
                const n = await getNative();
                await n.stop();
                await n.clearTracks();
            } else {
                for (const id of Array.from(this.tracks.keys())) this.removeTrack(id);
            }
        } catch (e) {
            console.warn("[AudioEngine] Error en clear:", e);
        }
        
        this.tracks.clear();
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
            const m = this._trackMeta.get(id);
            if (!m || m.muted) return 0;
            // More organic "living" meter behavior
            const seed = (typeof id === 'string' ? id.length : id) % 10;
            const time = performance.now() / 120;
            const base = 0.35 + Math.sin(time + seed) * 0.15;
            const twitch = Math.random() * 0.2;
            return (base + twitch) * (m.volume || 1);
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
                if (t.source) { try { t.source.stop(); } catch (e) { console.debug("WebAudio stop error", e); } }
                t.gain.disconnect();
                t.panner.disconnect();
                if (t.analyser) t.analyser.disconnect();
                this.tracks.delete(id);
            }
        }
    }

    _updateWorkletParams() {
        if (this.masterSoundTouchNode) {
            const tempoParam = this.masterSoundTouchNode.parameters.get('tempo');
            const pitchParam = this.masterSoundTouchNode.parameters.get('pitchSemitones');
            
            // Fix "utututu" starvation: Worklet must NEVER process time stretching.
            // Native AudioBufferSourceNode handles time-stretching smoothly.
            if (tempoParam) tempoParam.value = 1.0; 
            
            // Compensate for the physical pitch shift introduced by playbackRate
            const pitchOffset = 12 * Math.log2(this.tempoRatio || 1);
            const targetWorkletPitch = this.pitchSemitones - pitchOffset;
            
            if (pitchParam) pitchParam.value = targetWorkletPitch;
        }
    }

    setTempo(ratio) {
        if (!IS_NATIVE && this.isPlaying) {
            // Anchor real-world time to avoid playhead jumps
            const elapsed = this.ctx.currentTime - this._playStartTime;
            this.pausePosition = this.pausePosition + elapsed * this.tempoRatio;
            this._playStartTime = this.ctx.currentTime;
        }

        this.tempoRatio = ratio;
        if (IS_NATIVE) { 
            getNative().then(n => n.setSpeed && n.setSpeed(ratio)); 
        } else {
            for (const [, track] of this.tracks.entries()) {
                if (track.source && track.source.playbackRate) {
                    track.source.playbackRate.setTargetAtTime(ratio, this.ctx.currentTime, 0.05);
                }
            }
            this._updateWorkletParams();
        }
    }
    
    setPitch(semitones) { 
        this.pitchSemitones = semitones; 
        if (IS_NATIVE) {
            getNative().then(n => n.setPitch && n.setPitch(semitones));
        } else {
            this._updateWorkletParams();
        }
    }

    async play() {
        if (this.isPlaying) return;
        if (!IS_NATIVE && this.ctx.state === 'suspended') await this.ctx.resume();

        if (IS_NATIVE) {
            const native = await getNative();
            if (this.pausePosition > 0) await native.seek(this.pausePosition);
            await native.play();
            
            this.lastFetchPos = this.pausePosition;
            this.lastFetchTime = performance.now();
            this.progress = this.pausePosition;
            this.isPlaying = true;
            this._startRAF();
            return;
        }

        // Web Audio Play...
        this._playStartTime = this.ctx.currentTime;
        this.lastFetchPos = this.pausePosition;
        this.lastFetchTime = performance.now();
        this.progress = this.pausePosition;
        this.isPlaying = true;
        this._startRAF();

        if (this.masterSoundTouchNode) {
            try { this.masterSoundTouchNode.disconnect(); } catch (e) { console.debug("Worklet disconnect", e); }
            this.masterSoundTouchNode = null;
        }
        try { this.stSumBus.disconnect(); } catch (e) { console.debug("stSumBus disconnect", e); }

        if (this.workletLoaded) {
            this.masterSoundTouchNode = new AudioWorkletNode(this.ctx, 'soundtouch-processor');
            this._updateWorkletParams();

            this.stSumBus.connect(this.masterSoundTouchNode);
            this.masterSoundTouchNode.connect(this.masterGain);
        } else {
            this.stSumBus.connect(this.masterGain);
        }

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
            src.playbackRate.value = this.tempoRatio;

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
        this.pausePosition = seconds;
        this.progress = seconds;
        this.lastFetchPos = seconds;
        this.lastFetchTime = performance.now();
        this.isDragging = false;

        if (IS_NATIVE) {
            const n = await getNative();
            // Anti-pop protection (hardware buffer wipe)
            n.setVolume(0);
            await n.seek(seconds);
            setTimeout(() => n.setVolume(1), 30);
        } else {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) {
                const stopTime = this.ctx.currentTime + 0.03;
                for (const [, t] of this.tracks.entries()) { 
                    if (t.source && t.gainNode) {
                         try {
                             t.gainNode.gain.linearRampToValueAtTime(0, stopTime);
                             t.source.stop(stopTime);
                         } catch(e){}
                    } 
                }
                this.isPlaying = false;
                setTimeout(() => { if (this.pausePosition === seconds) this.play(); }, 35);
            }
        }
        this._notifyProgress();
    }

    // ── DRAG SYNC METHODS ──────────────────────────────────────────
    // Visual decoupling: update state but DO NOT trigger global React state
    startDrag(time) {
        this.isDragging = true;
        this.dragTime = time;
    }

    updateDrag(time) {
        this.dragTime = time;
    }

    endDrag(time) {
        this.isDragging = false;
        this.seek(time);
    }

    async stop() {
        if (IS_NATIVE) {
            const native = await getNative();
            await native.stop();
        } else {
            for (const [, t] of this.tracks.entries()) { 
                if (t.source) {
                    try {
                        // Anti-pop fade out
                        const stopTime = this.ctx.currentTime + 0.05;
                        t.gainNode.gain.linearRampToValueAtTime(0, stopTime);
                        t.source.stop(stopTime);
                    } catch(e) {}
                } 
            }
        }
        this.resetTiming();
        this.isPlaying = false;
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    resetTiming() {
        this.progress = 0;
        this.pausePosition = 0;
        this.lastFetchPos = 0;
        this.lastFetchTime = performance.now();
        this._playStartTime = 0;
    }

    /** Subscribe to progress updates. Callback receives (timeInSeconds). */
    addProgressListener(fn) {
        this._progressListeners.add(fn);
    }

    /** Unsubscribe from progress updates. */
    removeProgressListener(fn) {
        this._progressListeners.delete(fn);
    }

    _notifyProgress() {
        const now = performance.now();
        // If dragging, we notify at much higher rate for visual fluidity
        const minInterval = this.isDragging ? 16 : this._NOTIFY_INTERVAL;
        if (now - this._lastNotifyTime < minInterval) return;
        this._lastNotifyTime = now;
        
        const current = this.getCurrentTime();
        if (this.onProgress) this.onProgress(current);
        for (const fn of this._progressListeners) fn(current);
    }

    getCurrentTime() {
        if (this.isDragging) return this.dragTime;
        if (!this.isPlaying) return this.progress;
        
        const now = performance.now();
        const delta = (now - this.lastFetchTime) / 1000;
        const safeDelta = Math.max(0, Math.min(0.5, delta));
        const interp = this.lastFetchPos + (safeDelta * (this.tempoRatio || 1));
        return Math.max(0, Math.min(this._durationHint || 9999, interp));
    }

    _startRAF() {
        const update = async () => {
            if (!this.isPlaying) return;
            
            try {
                let currentPos = 0;
                if (IS_NATIVE) {
                    const n = await getNative();
                    currentPos = await n.getPosition();
                } else {
                    const elapsed = this.ctx.currentTime - this._playStartTime;
                    currentPos = this.pausePosition + (elapsed * this.tempoRatio);
                }
                
                // If we detected a jump (e.g. new song or native seek finished)
                // or if it's been more than 100ms since last fetch, sync the interpolation base.
                if (Math.abs(currentPos - this.lastFetchPos) > 0.1 || (performance.now() - this.lastFetchTime > 100)) {
                    this.lastFetchPos = currentPos;
                    this.lastFetchTime = performance.now();
                }

                this.progress = currentPos;
                this._notifyProgress();
                
                if (this.isPlaying) {
                    this._updater = requestAnimationFrame(update);
                }
            } catch (e) {
                console.error("RAF Update Error:", e);
                if (this.isPlaying) this._updater = requestAnimationFrame(update);
            }
        };
        this._updater = requestAnimationFrame(update);
    }
}

export const audioEngine = new AudioEngine();
