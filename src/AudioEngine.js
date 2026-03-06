class AudioEngine {
    constructor() {
        /** @type {AudioContext} */
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive'
        });

        this.tracks = new Map();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.isPlaying = false;
        this.startTime = 0;
        this.pausePosition = 0;
        this.tempoRatio = 1.0;
        this.pitchSemitones = 0; // 0 = original key, +1 = half-step up, -1 = half-step down

        this.onProgress = null;
        this._updater = null;

        // SoundTouch Worklet Module loading state
        this.workletLoaded = false;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        if (!this.workletLoaded) {
            try {
                await this.ctx.audioWorklet.addModule('/soundtouch-worklet.js');
                this.workletLoaded = true;
                console.log("SoundTouchWorklet loaded successfully.");
            } catch (err) {
                console.error("Failed to load soundtouch-worklet.js", err);
            }
        }
    }

    // Creates a complete channel strip per buffer
    // rawArrayBuffer: the original compressed bytes (WAV/MP3) — used for tempo shift via Audio element
    addTrack(id, audioBuffer, rawArrayBuffer = null) {
        const gainNode = this.ctx.createGain();
        const pannerNode = this.ctx.createStereoPanner
            ? this.ctx.createStereoPanner()
            : this.ctx.createPanner();

        // AnalyserNode for VU meter LEDs
        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;

        // Signal chain: Source → Panner → Gain → Analyser → Master
        pannerNode.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(this.masterGain);

        this.tracks.set(id, {
            buffer: audioBuffer,
            rawBuffer: rawArrayBuffer, // Kept for resetting/re-creating sources
            source: null,
            soundtouchNode: null, // Holds the AudioWorkletNode
            gain: gainNode,
            panner: pannerNode,
            analyser: analyser,
            volume: 1,
            muted: false,
            solo: false
        });
    }

    // Returns 0-1 RMS level for a track (used by VU meter LEDs)
    getTrackLevel(id) {
        const t = this.tracks.get(id);
        if (!t || !t.analyser) return 0;
        const data = new Uint8Array(t.analyser.frequencyBinCount);
        t.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const norm = (data[i] - 128) / 128;
            sum += norm * norm;
        }
        return Math.sqrt(sum / data.length);
    }

    clearTracks() {
        this.stop();
        for (const [, track] of this.tracks.entries()) {
            this._cleanupSource(track);
            track.gain.disconnect();
            track.panner.disconnect();
        }
        this.tracks.clear();
    }

    _cleanupSource(track) {
        if (track.source) {
            try { track.source.stop(); } catch (e) { }
            try { track.source.disconnect(); } catch (e) { }
            track.source = null;
        }
        if (track.soundtouchNode) {
            try { track.soundtouchNode.disconnect(); } catch (e) { }
            track.soundtouchNode = null;
        }
    }

    _applyStates() {
        let isAnySolo = false;
        for (const [, track] of this.tracks.entries()) {
            if (track.solo) isAnySolo = true;
        }
        for (const [, track] of this.tracks.entries()) {
            let finalGain = track.volume;
            if (track.muted) finalGain = 0;
            if (isAnySolo && !track.solo) finalGain = 0;
            track.gain.gain.setTargetAtTime(finalGain, this.ctx.currentTime, 0.015);
        }
    }

    setTrackVolume(id, vol) {
        const t = this.tracks.get(id);
        if (t) { t.volume = vol; this._applyStates(); }
    }

    setTrackMute(id, val) {
        const t = this.tracks.get(id);
        if (t) { t.muted = val; this._applyStates(); }
    }

    setTrackSolo(id, val) {
        const t = this.tracks.get(id);
        if (t) { t.solo = val; this._applyStates(); }
    }

    // ── Master Tempo / Pitch ────────────────────────────────────────────────
    setTempo(ratio) {
        this.tempoRatio = ratio;
        this._updateWorkletParams();
    }

    setPitch(semitones) {
        this.pitchSemitones = semitones;
        this._updateWorkletParams();
    }

    _updateWorkletParams() {
        for (const [, track] of this.tracks.entries()) {
            if (track.soundtouchNode) {
                const tempoParam = track.soundtouchNode.parameters.get('tempo');
                const pitchParam = track.soundtouchNode.parameters.get('pitchSemitones');
                if (tempoParam) tempoParam.value = this.tempoRatio;
                if (pitchParam) pitchParam.value = this.pitchSemitones;
            }
        }
    }

    play() {
        if (this.isPlaying) return;
        this._applyStates();

        const syncTime = this.ctx.currentTime + 0.08;
        this.playStartTime = this.ctx.currentTime;

        for (const [, track] of this.tracks.entries()) {
            this._cleanupSource(track);

            const source = this.ctx.createBufferSource();
            source.buffer = track.buffer;

            if (this.workletLoaded) {
                // ── SOUNDTOUCH AUDIO WORKLET NODE ──
                const stNode = new AudioWorkletNode(this.ctx, 'soundtouch-processor');

                // Initialize parameters
                const tempoParam = stNode.parameters.get('tempo');
                const pitchParam = stNode.parameters.get('pitchSemitones');
                if (tempoParam) tempoParam.value = this.tempoRatio;
                if (pitchParam) pitchParam.value = this.pitchSemitones;

                source.connect(stNode);
                stNode.connect(track.panner);
                track.soundtouchNode = stNode;
            } else {
                // Flashback to normal buffer if worklet failed to load
                source.connect(track.panner);
            }

            source.start(syncTime, Math.max(0, this.pausePosition));
            track.source = source;
        }

        this.isPlaying = true;
        this._startRAF();
    }

    pause() {
        if (!this.isPlaying) return;

        // Calculate pause position based on elapsed time and tempo
        const realElapsed = this.ctx.currentTime - this.playStartTime;
        this.pausePosition = this.pausePosition + (realElapsed * this.tempoRatio);

        for (const [, track] of this.tracks.entries()) {
            this._cleanupSource(track);
        }

        this.isPlaying = false;
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    seek(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            // Stop current sources
            for (const [, track] of this.tracks.entries()) {
                this._cleanupSource(track);
            }
            this.isPlaying = false;
        }

        this.pausePosition = time;

        if (wasPlaying) {
            this.play();
        } else {
            if (this.onProgress) this.onProgress(this.pausePosition);
        }
    }


    stop() {
        this.pause();
        this.pausePosition = 0;
        if (this.onProgress) this.onProgress(0);
        // Cleanup all media elements fully
        for (const [, track] of this.tracks.entries()) this._cleanupSource(track);
    }

    _startRAF() {
        const update = () => {
            if (this.isPlaying && this.onProgress) {
                // Since AudioWorklets consume buffer over time at a mutated rate, we estimate position
                const realElapsed = this.ctx.currentTime - this.playStartTime;
                const currentPos = this.pausePosition + (realElapsed * this.tempoRatio);
                this.onProgress(currentPos);
            }
            if (this.isPlaying) {
                this._updater = requestAnimationFrame(update);
            }
        };
        this._updater = requestAnimationFrame(update);
    }
}

export const audioEngine = new AudioEngine();
