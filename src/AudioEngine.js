class AudioEngine {
    constructor() {
        /** @type {AudioContext} */
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive' // DAW-level low latency
        });

        this.tracks = new Map(); // Stores track info, gain node, panner, spatial info
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.isPlaying = false;
        this.startTime = 0;
        this.pausePosition = 0;

        this.onProgress = null; // Callback for UI time updates
        this._updater = null;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // Creates a complete channel strip per buffer
    addTrack(id, audioBuffer) {
        const gainNode = this.ctx.createGain();
        const pannerNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createPanner();

        // AnalyserNode for VU meter LEDs — high frequency refresh
        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;

        // Signal chain: Source -> Panner -> Gain -> Analyser -> Master
        pannerNode.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(this.masterGain);

        this.tracks.set(id, {
            buffer: audioBuffer,
            source: null,
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
        // Compute RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const norm = (data[i] - 128) / 128;
            sum += norm * norm;
        }
        return Math.sqrt(sum / data.length);
    }

    clearTracks() {
        this.stop();
        for (const [id, track] of this.tracks.entries()) {
            if (track.source) {
                try { track.source.stop(); track.source.disconnect(); } catch (e) { }
            }
            track.gain.disconnect();
            track.panner.disconnect();
        }
        this.tracks.clear();
    }

    _applyStates() {
        let isAnySolo = false;
        for (const [id, track] of this.tracks.entries()) {
            if (track.solo) isAnySolo = true;
        }

        for (const [id, track] of this.tracks.entries()) {
            let finalGain = track.volume;
            if (track.muted) finalGain = 0;
            if (isAnySolo && !track.solo) finalGain = 0;

            // Apply smoothly to avoid clicks (JUCE style ramp)
            track.gain.gain.setTargetAtTime(finalGain, this.ctx.currentTime, 0.015);
        }
    }

    setTrackVolume(id, vol) {
        const t = this.tracks.get(id);
        if (t) {
            t.volume = vol;
            this._applyStates();
        }
    }

    setTrackMute(id, val) {
        const t = this.tracks.get(id);
        if (t) {
            t.muted = val;
            this._applyStates();
        }
    }

    setTrackSolo(id, val) {
        const t = this.tracks.get(id);
        if (t) {
            t.solo = val;
            this._applyStates();
        }
    }

    play() {
        if (this.isPlaying) return;
        this._applyStates();

        this.startTime = this.ctx.currentTime - this.pausePosition;

        // Schedule all sources to start at the exact same atomic clock tick
        const syncTime = this.ctx.currentTime + 0.05; // 50ms buffer for thread locking

        for (const [id, track] of this.tracks.entries()) {
            // Re-create sources (they are single-use in WebAudio)
            const source = this.ctx.createBufferSource();
            source.buffer = track.buffer;
            source.connect(track.panner);

            source.start(syncTime, this.pausePosition);
            track.source = source;
        }

        this.isPlaying = true;
        this._startRAF();
    }

    pause() {
        if (!this.isPlaying) return;

        for (const [id, track] of this.tracks.entries()) {
            if (track.source) {
                track.source.stop();
                track.source.disconnect();
                track.source = null;
            }
        }

        // Record where we left off
        this.pausePosition = this.ctx.currentTime - this.startTime;
        this.isPlaying = false;

        if (this._updater) cancelAnimationFrame(this._updater);
    }

    stop() {
        this.pause();
        this.pausePosition = 0;
        if (this.onProgress) this.onProgress(0);
    }

    _startRAF() {
        const update = () => {
            if (this.isPlaying && this.onProgress) {
                const currentPos = this.ctx.currentTime - this.startTime;
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
