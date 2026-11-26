/**
 * AudioEngine.js
 * Unified Audio Engine: Native (Capacitor) | C++ WASM | Legacy Web Audio fallback
 */

import { NextGenMixerBridge } from './NextGenNativeEngine.js';
import { DesktopAudioBridge } from './DesktopAudioBridge.js';
import { isMixerClickStem, isMixerGuideStem } from './mixerStemRoles.js';
import soundtouchWorkletUrl from './worklets/soundtouch-worklet.js?url';

let _nativeEngine = null;
async function getNative() {
    if (!_nativeEngine) {
        const mod = await import('./NativeEngine');
        _nativeEngine = mod.NativeEngine;
    }
    return _nativeEngine;
}

const IS_NATIVE = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const IS_DESKTOP = typeof window !== 'undefined' && (
    window.electronAPI?.isDesktop === true || window.zionNative?.isDesktop === true
);

class AudioEngine {
    constructor() {
        this.isPlaying = false;
        // Loop State (Sample-accurate transport)
        this.loopActive = false;
        this.loopStart = null;
        this.loopEnd = null;
        this.loopExitPending = false;
        this.pausePosition = 0;
        this.tempoRatio = 1.0;
        this.pitchSemitones = 0;
        this.progress = 0;
        this._updater = null;
        this._progressListeners = new Set();
        this.onProgress = null;
        this.lastFetchPos = 0;
        this.lastFetchTime = 0;
        this.isDragging = false;
        this.dragTime = 0;
        /** Callback cuando el motor termina la canción por sí solo (fin de pista). */
        this.onEnded = null;
        this._wasmPlayIssued = false;
        this._lastNotifyTime = 0;
        this._NOTIFY_INTERVAL = 66;
        this.workletLoaded = false;
        this.masterSoundTouchNode = null;
        this._trackMeta = new Map();
        this.tracks = new Map();
        this._playStartWall = 0;
        this._playStartPos = 0;
        this._sessionId = 0;
        this._nativeLevels = new Map();
        this._levelPollInterval = null;
        this._songPreparationActive = false;
        this._durationHint = 0;
        this.masterVolume = 1.0;
        /** Stems loaded into Zion WASM (Electron desktop mixer). */
        this._wasmTrackCount = 0;
        /** Desktop WASM: throttled [VU] console logs (~3/s). */
        this._wasmVuLogInterval = null;
        /** ~30fps batch read of WASM VU peaks (reduces per-LED FFI churn). */
        this._wasmVuPollInterval = null;
        this._wasmVuPeakMap = new Map();
        this._wasmVuLastBatchLog = 0;

        // WASM State (disabled on Web in favor of native multi-threaded Web Audio API)
        this.wasm = null;
        this.isWASMReady = false;
        this._wasmScriptProcessor = null;
        this._isLoopSeeking = false;

        if (!IS_NATIVE && !IS_DESKTOP) {
            this._initWebAudio();
        }
    }

    _initWebAudio() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive', sampleRate: 44100 });
            this.stSumBus = this.ctx.createGain();
            this.stSumBus.gain.value = 0.70;
            this.guideBus = this.ctx.createGain();
            this.guideBus.gain.value = 0.85;
            this.guideDelayNode = this.ctx.createDelay(0.5);
            this.guideDelayNode.delayTime.value = 0;
            this.limiter = this.ctx.createGain();
            this.limiter.gain.value = 1.0;
            this.masterGain = this.ctx.createGain();
            this.stSumBus.connect(this.limiter);
            this.guideBus.connect(this.guideDelayNode);
            this.guideDelayNode.connect(this.limiter);
            this.limiter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn("[AudioEngine] Web Audio context creation failed:", e);
        }
    }

    // ---- WASM ScriptProcessor: calls C++ processBlock() each audio frame ----
    _startWASMProcessor() {
        if (!this.wasm || !this.ctx || this._wasmScriptProcessor) return;

        const BLOCK_SIZE = 4096; // bloque mayor = menos cortes/crujidos cuando el hilo principal está ocupado (iPad / equipos lentos)
        // 4 output channels: [MusicL, MusicR, GuideL, GuideR]
        const proc = this.ctx.createScriptProcessor(BLOCK_SIZE, 0, 4);

        proc.onaudioprocess = (e) => {
            const frames = e.outputBuffer.length;
            const ptr = this.wasm.processBlock(frames);
            // Access WASM heap directly — zero-copy
            const interleaved = new Float32Array(this.wasm.HEAPF32.buffer, ptr, frames * 4);
            const outMusicL = e.outputBuffer.getChannelData(0);
            const outMusicR = e.outputBuffer.getChannelData(1);
            const outGuideL = e.outputBuffer.getChannelData(2);
            const outGuideR = e.outputBuffer.getChannelData(3);
            for (let i = 0; i < frames; i++) {
                outMusicL[i] = interleaved[i * 4];
                outMusicR[i] = interleaved[i * 4 + 1];
                outGuideL[i] = interleaved[i * 4 + 2];
                outGuideR[i] = interleaved[i * 4 + 3];
            }
        };

        // Split the 4 channels into two stereo streams
        const splitter = this.ctx.createChannelSplitter(4);
        proc.connect(splitter);

        const mergerMusic = this.ctx.createChannelMerger(2);
        splitter.connect(mergerMusic, 0, 0); // Music L
        splitter.connect(mergerMusic, 1, 1); // Music R
        
        const mergerGuide = this.ctx.createChannelMerger(2);
        splitter.connect(mergerGuide, 2, 0); // Guide L
        splitter.connect(mergerGuide, 3, 1); // Guide R

        // Route Music to stSumBus (which goes through SoundTouch/Limiter)
        mergerMusic.connect(this.stSumBus);
        
        // Route Guide directly to Limiter (bypassing SoundTouch pitch shifting)
        mergerGuide.connect(this.limiter);

        this._wasmScriptProcessor = proc;
        this._wasmSplitter = splitter;
        this._wasmMergerMusic = mergerMusic;
        this._wasmMergerGuide = mergerGuide;
    }

    _stopWASMProcessor() {
        if (this._wasmScriptProcessor) {
            this._wasmScriptProcessor.disconnect();
            this._wasmScriptProcessor = null;
        }
        if (this._wasmSplitter) {
            this._wasmSplitter.disconnect();
            this._wasmSplitter = null;
        }
        if (this._wasmMergerMusic) {
            this._wasmMergerMusic.disconnect();
            this._wasmMergerMusic = null;
        }
        if (this._wasmMergerGuide) {
            this._wasmMergerGuide.disconnect();
            this._wasmMergerGuide = null;
        }
    }

    async init() {
        if (IS_DESKTOP) {
            if (!DesktopAudioBridge.isDesktop()) {
                console.warn('[DESKTOP AUDIO] zionNative.loadSong not available — carga fallará hasta que el preload exponga el bridge');
            }
            this.isWASMReady = false;
            this.wasm = null;
            console.log('[DESKTOP AUDIO] JUCE native path — WASM not loaded');
            return;
        }

        if (!IS_NATIVE && !IS_DESKTOP && !this.isWASMReady) {
            try {
                console.log("[AudioEngine] Initializing Zion Core C++ WASM...");
                const ZionAudioCoreModule = (await import('./wasm/zion_audio_core_wasm.js')).default;
                const wasmUrl = new URL('./wasm/zion_audio_core_wasm.wasm', import.meta.url).href;

                const response = await fetch(wasmUrl);
                const wasmBinary = await response.arrayBuffer();

                this.wasm = await ZionAudioCoreModule({
                    wasmBinary: wasmBinary,
                    locateFile: (path) => {
                        if (path.endsWith('.wasm')) return wasmUrl;
                        return path;
                    }
                });

                if (this.wasm) {
                    const sr = this.ctx?.sampleRate || 44100;
                    this.wasm.initEngine(sr);
                    this.isWASMReady = true;
                    this._startWASMProcessor();
                    if (this.ctx && !this.workletLoaded) {
                        try {
                            if (this.ctx.state === 'suspended') await this.ctx.resume();
                            await this.ctx.audioWorklet.addModule(soundtouchWorkletUrl);
                            this.workletLoaded = true;
                        } catch (err) {
                            console.warn('[AudioEngine] soundtouch-worklet not available (pitch will not work):', err);
                        }
                    }
                    this._updateWorkletGraph();
                    console.log("[AudioEngine] Zion Core C++ WASM ready at", sr, "Hz");
                    return;
                }
            } catch (error) {
                console.warn("[AudioEngine] WASM load failed, falling back to Web Audio.", error);
                this.isWASMReady = false;
                this.wasm = null;
            }
        }

        if (IS_NATIVE) return;

        this._initWebAudio();
        if (this.ctx?.state === 'suspended') await this.ctx.resume();

        if (!this.workletLoaded && this.ctx?.audioWorklet) {
            try {
                await this.ctx.audioWorklet.addModule(soundtouchWorkletUrl);
                this.workletLoaded = true;
            } catch (err) {
                console.warn("[AudioEngine] soundtouch-worklet not available:", err);
            }
        }
        this._updateWorkletGraph();
    }

    // ---- Track loading ----
    async addTracksBatch(tracksArray) {
        this.resetTiming();

        if (IS_DESKTOP) {
            if (!DesktopAudioBridge.isDesktop()) {
                const msg = '[DESKTOP AUDIO] Native JUCE bridge missing (zionNative.loadSong)';
                console.error(msg);
                throw new Error(msg);
            }
            console.log('[DESKTOP AUDIO] loading native JUCE engine, not WASM');
            this._trackMeta.clear();
            const payload = [];
            for (const t of tracksArray) {
                if (t.isVisualOnly) continue;
                const filename = t.filename || t.path || t.cacheKey || t.localPath;
                if (!filename || typeof filename !== 'string') continue;
                const fn = String(filename).trim();
                this._trackMeta.set(t.id, {
                    path: fn,
                    volume: 1,
                    muted: false,
                    solo: false,
                    isVisualOnly: false,
                    buffer: null,
                });
                const stemName = t.name || '';
                payload.push({
                    id: t.id,
                    name: t.name,
                    filename: fn,
                    isGuide: !!t.isGuide || isMixerGuideStem(stemName),
                    isClick: !!t.isClick || isMixerClickStem(stemName),
                });
            }
            await DesktopAudioBridge.loadSongFromPaths(payload);
            try {
                const d = await DesktopAudioBridge.getDuration();
                if (typeof d === 'number' && d > 1) this._durationHint = d;
            } catch { /* ignore */ }
            return;
        }

        if (this.isWASMReady && this.wasm) {
            const myGen = (this._batchGen = (this._batchGen || 0) + 1);
            this._wasmTrackCount = 0;
            this._trackMeta.clear();
            let idx = 0;
            for (const t of tracksArray) {
                if (this._batchGen !== myGen) return;
                if (t.isVisualOnly) {
                    if (t.audioBuffer) {
                        this._trackMeta.set(t.id, {
                            buffer: t.audioBuffer,
                            volume: 0,
                            muted: true,
                            solo: false,
                            isVisualOnly: true,
                        });
                    }
                    continue;
                }
                const buffer = await this._loadTrackToWASM(t.id, t.audioBuffer, t.sourceData);
                if (this._batchGen !== myGen) return;
                if (buffer) {
                    const chanL = buffer.getChannelData(0);
                    const chanR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chanL;
                    this._trackMeta.set(t.id, {
                        buffer,
                        chanL,
                        chanR,
                        volume: 1,
                        muted: false,
                        solo: false,
                        isVisualOnly: false,
                        smoothedPeak: 0,
                    });
                    this._wasmTrackCount += 1;
                }
                const stemName = t.name || t.id || '';
                const isGuideOrClick = isMixerClickStem(stemName) || isMixerGuideStem(stemName);
                if (buffer && isGuideOrClick) {
                    this.wasm.setTrackIsGuide(t.id, true);
                }
                idx++;
                if (idx % 2 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                    if (this._batchGen !== myGen) return;
                }
            }
            return;
        }

        if (IS_NATIVE) {
            this._trackMeta.clear();
            const batch = [];
            for (const t of tracksArray) {
                const info = { path: t.path, volume: 1, muted: false, solo: false, isVisualOnly: !!t.isVisualOnly, buffer: t.audioBuffer };
                this._trackMeta.set(t.id, info);
                if (t.path) batch.push({ id: t.id, path: t.path });
            }
            const n = await getNative();
            if (batch.length > 0) {
                await n.loadTracks(batch);
                try { const dur = await n.getDuration(); if (dur > 1) this._durationHint = dur; } catch {}
            }
            return;
        }

        for (const t of tracksArray) {
            await this.addTrack(t.id, t.audioBuffer, t.sourceData, {
                isVisualOnly: t.isVisualOnly,
                name: t.name || t.id,
                isGuide: t.isGuide,
                isClick: t.isClick,
            });
        }
    }

    async _loadTrackToWASM(id, audioBuffer, sourceData) {
        try {
            let buffer = audioBuffer;
            if (!buffer && sourceData && this.ctx) {
                const arrayBuf = (sourceData instanceof Blob) ? await sourceData.arrayBuffer() : sourceData;
                if (arrayBuf && arrayBuf.byteLength >= 500) {
                    buffer = await this.ctx.decodeAudioData(arrayBuf.slice(0));
                }
            }
            if (!buffer) return null;

            const length = buffer.length;
            // Get channel data — always stereo in C++
            const chanL = buffer.getChannelData(0);
            const chanR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chanL;

            // IMPORTANTE: allocateBuffer() del WASM devuelve SIEMPRE el mismo scratch buffer compartido.
            // Antes se llamaba dos veces (L y R) y ambos punteros apuntaban a la misma memoria, por lo que
            // el canal R sobrescribía al L (todos los stems sonaban dual-mono del canal derecho).
            // Ahora se reserva un solo bloque de 2*length floats y se usa la 1.ª mitad para L y la 2.ª para R.
            const base = this.wasm.allocateBuffer(length * 2);
            const ptrL = base;
            const ptrR = base + length * 4; // punteros en bytes (Float32 = 4 bytes)
            const heap = this.wasm.HEAPF32.buffer;
            new Float32Array(heap, ptrL, length).set(chanL);
            new Float32Array(heap, ptrR, length).set(chanR);
            this.wasm.loadTrackData(id, ptrL, ptrR, length);

            console.log(`[ZionCore] Track '${id}' loaded: ${(length / (buffer.sampleRate || 44100)).toFixed(1)}s`);
            return buffer;
        } catch (e) {
            console.error(`[ZionCore] Failed to load track '${id}':`, e);
            return null;
        }
    }

    async addTrack(id, audioBuffer, sourceData = null, options = {}) {
        if (IS_DESKTOP) return;
        if (this.isWASMReady && this.wasm) {
            if (!options.isVisualOnly) {
                const buf = await this._loadTrackToWASM(id, audioBuffer, sourceData);
                if (buf) {
                    const chanL = buf.getChannelData(0);
                    const chanR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : chanL;
                    this._trackMeta.set(id, {
                        buffer: buf,
                        chanL,
                        chanR,
                        volume: 1,
                        muted: false,
                        solo: false,
                        isVisualOnly: false,
                        smoothedPeak: 0
                    });
                }
            }
            return;
        }

        if (IS_NATIVE) {
            const info = { path: null, volume: 1, muted: false, solo: false, isVisualOnly: !!options.isVisualOnly };
            this._trackMeta.set(id, info);
            if (typeof sourceData === 'string') { info.path = sourceData; this._pushToNative(id, sourceData); }
            else if (sourceData instanceof Blob) {
                const n = await getNative();
                const path = await n.saveTrackBlob(sourceData, `track_${id}.mp3`);
                info.path = path; this._pushToNative(id, path);
            }
            return;
        }

        try {
            let buffer = audioBuffer;
            if (!buffer && sourceData) {
                const arrayBuf = (sourceData instanceof Blob) ? await sourceData.arrayBuffer() : sourceData;
                if (arrayBuf && arrayBuf.byteLength >= 500) buffer = await this.ctx.decodeAudioData(arrayBuf);
            }
            if (!buffer) return;

            const pannerNode = this.ctx.createStereoPanner();
            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 128;
            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 0;
            pannerNode.connect(analyser);
            analyser.connect(gainNode);
            const stemLabel = options.name || id || '';
            const isGuideOrClick = Boolean(
                options.isGuide || options.isClick || isMixerClickStem(stemLabel) || isMixerGuideStem(stemLabel)
            );
            if (!options.isVisualOnly) {
                gainNode.connect(isGuideOrClick && this.guideBus ? this.guideBus : this.stSumBus);
            }
            this.tracks.set(id, {
                buffer,
                gain: gainNode,
                analyser,
                vuBuffer: new Uint8Array(analyser.frequencyBinCount),
                smoothedPeak: 0,
                panner: pannerNode,
                pan: 0,
                isGuideOrClick,
                volume: 1,
                muted: false,
                solo: false,
                isVisualOnly: options.isVisualOnly || false,
            });
        } catch (e) {
            console.error(`[AudioEngine] Error decoding track ${id}:`, e);
        }
    }

    _pushToNative(id, path) {
        getNative().then(n => n.loadSingleTrack(id, path)).catch(e => console.error(e));
    }

    async clear() {
        this._batchGen = (this._batchGen || 0) + 1;
        this.resetTiming();
        if (IS_DESKTOP) {
            this._trackMeta.clear();
            try {
                DesktopAudioBridge.stop();
            } catch { /* ignore */ }
            return;
        }
        if (this.isWASMReady && this.wasm) {
            this.wasm.clearTracks();
            this._wasmTrackCount = 0;
            this._trackMeta.clear();
            return;
        }
        this._trackMeta.clear();
        try {
            if (IS_NATIVE) { const n = await getNative(); await n.stop(); await n.clearTracks(); }
            else {
                if (this.isPlaying && this.ctx) {
                    for (const [, t] of this.tracks.entries()) {
                        if (t.gain) { const now = this.ctx.currentTime; t.gain.gain.cancelScheduledValues(now); t.gain.gain.setTargetAtTime(0, now, 0.02); }
                    }
                    await new Promise(r => setTimeout(r, 40));
                }
                for (const id of Array.from(this.tracks.keys())) this.removeTrack(id);
            }
        } catch (e) { console.warn("[AudioEngine] Error in clear:", e); }
        this.tracks.clear();
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    // ---- Volume / Mute / Solo / Pan ----
    setMasterVolume(vol) {
        const v = Math.max(0, Math.min(1, isFinite(vol) ? vol : 1));
        this.masterVolume = v;
        if (IS_DESKTOP) {
            DesktopAudioBridge.setMasterVolume(v);
            return;
        }
        if (this.isWASMReady && this.wasm) { this.wasm.setVolume(v); }
        else if (IS_NATIVE) { void NextGenMixerBridge.setMasterVolume({ volume: v }); }
        else if (this.masterGain) { this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015); }
    }

    setTrackVolume(id, vol) {
        if (IS_DESKTOP) {
            const m = this._trackMeta.get(id);
            if (m) { m.volume = vol; DesktopAudioBridge.setTrackVolume(id, vol); }
            return;
        }
        if (this.isWASMReady && this.wasm) {
            const m = this._trackMeta.get(id);
            if (m) m.volume = vol;
            this.wasm.setTrackVolume(id, vol);
        }
        else if (IS_NATIVE) { const m = this._trackMeta.get(id); if (m) { m.volume = vol; getNative().then(n => n.setTrackVolume(id, vol)); } }
        else { const t = this.tracks.get(id); if (t) { t.volume = vol; this._updateMuteSoloState(); } }
    }

    setTrackMute(id, val) {
        if (IS_DESKTOP) {
            const m = this._trackMeta.get(id);
            if (m) { m.muted = val; DesktopAudioBridge.setTrackMute(id, val); }
            return;
        }
        if (this.isWASMReady && this.wasm) {
            const m = this._trackMeta.get(id);
            if (m) m.muted = val;
            this.wasm.setTrackMute(id, val);
        }
        else if (IS_NATIVE) { const m = this._trackMeta.get(id); if (m) { m.muted = val; getNative().then(n => n.setTrackMute(id, val)); } }
        else { const t = this.tracks.get(id); if (t) { t.muted = val; this._updateMuteSoloState(); } }
    }

    setTrackPan(id, pan) {
        if (IS_DESKTOP) { return; }
        if (this.isWASMReady && this.wasm) { /* future C++ pan */ }
        else if (IS_NATIVE) { getNative().then(n => n.setTrackPan?.(id, pan)); }
        else {
            const t = this.tracks.get(id);
            if (t?.panner) {
                const p = Math.max(-1, Math.min(1, Number(pan) || 0));
                t.pan = p;
                t.panner.pan.setTargetAtTime(p, this.ctx.currentTime, 0.03);
                this._updateMuteSoloState();
            }
        }
    }

    setTrackSolo(id, val) {
        if (IS_DESKTOP) {
            const m = this._trackMeta.get(id);
            if (m) { m.solo = val; DesktopAudioBridge.setTrackSolo(id, val); }
            return;
        }
        if (this.isWASMReady && this.wasm) {
            const m = this._trackMeta.get(id);
            if (m) m.solo = val;
            this.wasm.setTrackSolo(id, val);
        }
        else if (IS_NATIVE) { const m = this._trackMeta.get(id); if (m) { m.solo = val; getNative().then(n => n.setTrackSolo?.(id, val)); } }
        else { const t = this.tracks.get(id); if (t) { t.solo = val; this._updateMuteSoloState(); } }
    }

    _updateMuteSoloState() {
        if (IS_NATIVE || IS_DESKTOP || (this.isWASMReady && this.wasm)) return;
        let anySolo = false;
        for (const t of this.tracks.values()) { if (t.solo) { anySolo = true; break; } }
        for (const t of this.tracks.values()) { this._updateTrackNodeGain(t, anySolo); }
    }

    _effectiveTrackGain(track, anySolo) {
        const muteIt = track.muted || (anySolo && !track.solo);
        if (muteIt) return 0;
        // Web Audio StereoPannerNode sums L+R (2x amplitude / +6dB) when pan is +/-1 on stereo buffers.
        // Multiply by 0.5 at pan = +/-1 (matching C++ 0.5f * (L + R)) so summed stems never clip or compress.
        const panComp = 1 / (1 + Math.abs(track.pan || 0));
        return track.volume * panComp;
    }

    _updateTrackNodeGain(track, anySolo) {
        if (IS_NATIVE || !track.gain || !this.ctx) return;
        const target = this._effectiveTrackGain(track, anySolo);
        const now = this.ctx.currentTime;
        try {
            track.gain.gain.cancelScheduledValues(now);
            track.gain.gain.setTargetAtTime(target, now, 0.015);
        } catch {}
    }

    getTrackLevel(id) {
        if (IS_DESKTOP) {
            if (!this.isPlaying) return 0;
            const m = this._trackMeta.get(id);
            if (!m || m.muted) return 0;
            return this._nativeLevels.get(id) ?? 0;
        }
        if (this.isWASMReady && this.wasm) {
            if (!this.isPlaying) return 0;
            if (typeof this.wasm.getTrackMeterPeak === 'function') {
                if (this._wasmVuPollInterval && this._wasmVuPeakMap.has(id)) {
                    const p = this._wasmVuPeakMap.get(id);
                    return Math.min(1, Math.max(0, typeof p === 'number' ? p : 0));
                }
                try {
                    const p = this.wasm.getTrackMeterPeak(id);
                    if (typeof p === 'number' && Number.isFinite(p)) return Math.min(1, Math.max(0, p));
                } catch {
                    return 0;
                }
            }

            // Fallback para WASM cuando getTrackMeterPeak no está en el binario compilado:
            const m = this._trackMeta.get(id);
            if (!m || m.muted || m.isVisualOnly) return 0;

            let anySolo = false;
            for (const [, meta] of this._trackMeta) {
                if (meta.solo) { anySolo = true; break; }
            }
            if (anySolo && !m.solo) return 0;

            const chanL = m.chanL || (m.buffer ? m.buffer.getChannelData(0) : null);
            if (!chanL) return 0;
            const chanR = m.chanR || (m.buffer && m.buffer.numberOfChannels > 1 ? m.buffer.getChannelData(1) : chanL);

            const sr = m.buffer?.sampleRate || 44100;
            const currentPos = this.lastFetchPos || 0;
            const centerIdx = Math.floor(currentPos * sr);
            const trackLen = chanL.length;
            if (centerIdx < 0 || centerIdx >= trackLen) return 0;

            const win = 512;
            const start = Math.max(0, centerIdx - (win >> 1));
            const end = Math.min(trackLen, start + win);

            let max = 0;
            for (let i = start; i < end; i += 16) {
                const absL = Math.abs(chanL[i]);
                const absR = Math.abs(chanR[i]);
                if (absL > max) max = absL;
                if (absR > max) max = absR;
            }

            const vol = (m.volume ?? 1) * (this.masterVolume ?? 1);
            const instant = max * vol;
            m.smoothedPeak = (m.smoothedPeak ?? 0) * 0.72 + instant * 0.28;
            return Math.min(1, Math.max(0, m.smoothedPeak));
        }
        if (!this.isPlaying) return 0;
        if (IS_NATIVE) { const m = this._trackMeta.get(id); if (!m || m.muted) return 0; return this._nativeLevels.get(id) ?? 0; }
        const t = this.tracks.get(id);
        if (!t?.analyser || t.muted) return 0;
        const d = t.vuBuffer || new Uint8Array(t.analyser.frequencyBinCount);
        t.analyser.getByteTimeDomainData(d);
        let max = 0;
        for (let i = 0; i < d.length; i += 2) {
            const v = Math.abs(d[i] - 128) / 128;
            if (v > max) max = v;
        }
        const instant = max * t.volume * (this.masterVolume ?? 1);
        t.smoothedPeak = (t.smoothedPeak ?? 0) * 0.65 + instant * 0.35;
        return Math.min(1, Math.max(0, t.smoothedPeak));
    }

    /**
     * Zion Desktop (WASM): snapshot of per-track peak/rms from C++ engine (real audio, not simulated).
     * @returns {{ trackId: string, peak: number, rms: number }[]}
     */
    getTrackLevels() {
        if (IS_DESKTOP) return [];
        if (!this.isWASMReady || !this.wasm?.getTrackLevelsJson) return [];
        try {
            return JSON.parse(this.wasm.getTrackLevelsJson());
        } catch {
            return [];
        }
    }

    _startWasmVuLogging() {
        if (this._wasmVuLogInterval || !this.isWASMReady || !this.wasm?.getTrackLevelsJson) return;
        this._wasmVuLogInterval = setInterval(() => {
            if (!this.isPlaying || !this.isWASMReady || !this.wasm?.getTrackLevelsJson) return;
            try {
                const levels = JSON.parse(this.wasm.getTrackLevelsJson());
                if (!levels.length) return;
                console.log('[VU] levels updated', levels.length, 'tracks');
                for (const row of levels) {
                    const pk = typeof row.peak === 'number' ? row.peak : 0;
                    const rm = typeof row.rms === 'number' ? row.rms : 0;
                    if (pk > 0.01 || rm > 0.01) {
                        console.log(`[VU] track ${row.trackId} peak ${pk.toFixed(2)} rms ${rm.toFixed(2)}`);
                    }
                }
            } catch { /* ignore */ }
        }, 330);
    }

    _stopWasmVuLogging() {
        if (this._wasmVuLogInterval) {
            clearInterval(this._wasmVuLogInterval);
            this._wasmVuLogInterval = null;
        }
    }

    _startWasmVuPoll() {
        if (this._wasmVuPollInterval || !this.isWASMReady || !this.wasm?.getTrackLevelsJson) return;
        this._wasmVuPollInterval = setInterval(() => {
            if (!this.isPlaying || !this.isWASMReady || !this.wasm?.getTrackLevelsJson) return;
            try {
                const levels = JSON.parse(this.wasm.getTrackLevelsJson());
                this._wasmVuPeakMap.clear();
                for (const row of levels) {
                    const tid = row.trackId || row.id;
                    if (tid) this._wasmVuPeakMap.set(tid, Math.min(1, Math.max(0, row.peak ?? 0)));
                }
                const now = performance.now();
                if (now - this._wasmVuLastBatchLog > 450) {
                    this._wasmVuLastBatchLog = now;
                    console.log('[VU] native levels received', levels.length);
                    console.log('[VU] mapped track levels count', this._wasmVuPeakMap.size);
                }
            } catch { /* ignore */ }
        }, 33);
    }

    _stopWasmVuPoll() {
        if (this._wasmVuPollInterval) {
            clearInterval(this._wasmVuPollInterval);
            this._wasmVuPollInterval = null;
        }
        this._wasmVuPeakMap.clear();
    }

    setSongPreparationActive(preparing) {
        if (!IS_NATIVE && !IS_DESKTOP) return;
        this._songPreparationActive = !!preparing;
        if (this._songPreparationActive) {
            if (this._levelPollInterval) { clearInterval(this._levelPollInterval); this._levelPollInterval = null; }
            if (this._updater) { cancelAnimationFrame(this._updater); this._updater = null; }
        } else if (this.isPlaying) {
            if (IS_NATIVE) {
                getNative().then(n => { if (this.isPlaying) { this._startRAF(this._sessionId); this._startNativeLevelPoll(n); } });
            } else if (IS_DESKTOP) {
                this._startRAF(this._sessionId);
                this._startDesktopLevelPoll();
            }
        }
    }

    _startDesktopLevelPoll() {
        if (this._levelPollInterval) clearInterval(this._levelPollInterval);
        this._levelPollInterval = setInterval(async () => {
            if (!this.isPlaying || this._songPreparationActive) return;
            try {
                const raw = await DesktopAudioBridge.getTrackLevels();
                if (raw) {
                    raw.split(',').forEach((entry) => {
                        const colon = entry.indexOf(':');
                        if (colon > 0) {
                            this._nativeLevels.set(
                                entry.slice(0, colon),
                                parseFloat(entry.slice(colon + 1)) || 0
                            );
                        }
                    });
                }
            } catch { /* ignore */ }
        }, 50);
    }

    _startNativeLevelPoll(native) {
        if (this._levelPollInterval) clearInterval(this._levelPollInterval);
        this._levelPollInterval = setInterval(async () => {
            if (!this.isPlaying || this._songPreparationActive) return;
            try {
                const raw = await native.getTrackLevels();
                if (raw) raw.split(',').forEach(entry => {
                    const colon = entry.indexOf(':');
                    if (colon > 0) this._nativeLevels.set(entry.slice(0, colon), parseFloat(entry.slice(colon + 1)) || 0);
                });
            } catch {}
        }, 50);
    }

    _stopNativeLevelPoll() {
        if (this._levelPollInterval) { clearInterval(this._levelPollInterval); this._levelPollInterval = null; }
        this._nativeLevels.clear();
    }

    removeTrack(id) {
        if (this.isWASMReady && this.wasm) {
            this.wasm.removeTrack(id);
            this._trackMeta.delete(id);
            return;
        }
        if (IS_DESKTOP) { this._trackMeta.delete(id); return; }
        if (IS_NATIVE) { this._trackMeta.delete(id); getNative().then(n => n.removeTrack?.(id)); return; }
        const t = this.tracks.get(id);
        if (t) {
            if (t.source) try { t.source.stop(); } catch {}
            t.gain.disconnect(); t.panner.disconnect(); if (t.analyser) t.analyser.disconnect();
            this.tracks.delete(id);
        }
    }

    // ---- Tempo / Pitch ----
    setTempo(ratio) {
        const prevRatio = this.tempoRatio || 1.0;
        this.tempoRatio = ratio;
        if (IS_DESKTOP) {
            DesktopAudioBridge.setTempoRatio(ratio);
            return;
        }
        if (IS_NATIVE) { getNative().then(n => n.setSpeed(ratio)); return; }
        
        if (this.isWASMReady && this.wasm) {
            this.wasm.setTempoRatio(ratio);
        }
        
        // Advance playback time correctly for UI before switching ratio
        if (this.isPlaying && (!this.isWASMReady || !this.wasm)) {
            const elapsed = Math.max(0, this.ctx.currentTime - this._playStartTime);
            this.pausePosition += elapsed * prevRatio;
            this._playStartTime = this.ctx.currentTime;
        }
        
        // For WebAudio fallback
        if (!this.isWASMReady || !this.wasm) {
            for (const [, track] of this.tracks.entries()) {
                if (track.source?.playbackRate) track.source.playbackRate.setTargetAtTime(ratio, this.ctx.currentTime, 0.05);
            }
        }
        
        this._updateWorkletGraph();
    }

    setPitch(semitones) {
        this.pitchSemitones = semitones;
        if (IS_DESKTOP) {
            DesktopAudioBridge.setPitchSemitones(semitones);
            return;
        }
        if (IS_NATIVE) { void NextGenMixerBridge.setPitchSemiTones({ semitones }); return; }
        
        this._updateWorkletGraph();
    }

    _updateWorkletGraph() {
        if (!this.ctx) return;
        const needsWorklet = (this.pitchSemitones !== 0 || Math.abs(this.tempoRatio - 1.0) > 0.001);
        
        if (this.workletLoaded && needsWorklet) {
            // 1. Music SoundTouch Node (Pitch shifted)
            if (!this.masterSoundTouchNode) {
                this.masterSoundTouchNode = new AudioWorkletNode(this.ctx, 'soundtouch-processor');
                this.stSumBus.disconnect();
                this.stSumBus.connect(this.masterSoundTouchNode);
                this.masterSoundTouchNode.connect(this.limiter);
            }
            
            // 2. Guide SoundTouch Node (Zero pitch, purely for latency synchronization)
            // Only needed if we are in WASM mode (which splits the guide into mergerGuide)
            if (this.isWASMReady && this._wasmMergerGuide) {
                if (!this.guideSoundTouchNode) {
                    this.guideSoundTouchNode = new AudioWorkletNode(this.ctx, 'soundtouch-processor');
                    this._wasmMergerGuide.disconnect();
                    this._wasmMergerGuide.connect(this.guideSoundTouchNode);
                    this.guideSoundTouchNode.connect(this.limiter);
                }
                const guideTempo = this.guideSoundTouchNode.parameters.get('tempo');
                const guidePitch = this.guideSoundTouchNode.parameters.get('pitchSemitones');
                const gNow = this.ctx.currentTime;
                if (guideTempo) guideTempo.setValueAtTime(1.0, gNow);
                // Guía/click: sin transposición de tono, pero SÍ compensan el cambio de tempo
                // (el motor WASM cambia la velocidad por remuestreo, lo que sube el tono de la guía).
                const guideTempoPitchFix = -12 * Math.log2(this.tempoRatio || 1);
                if (guidePitch) guidePitch.setValueAtTime(guideTempoPitchFix, gNow);
            }

            const tempoParam = this.masterSoundTouchNode.parameters.get('tempo');
            const pitchParam = this.masterSoundTouchNode.parameters.get('pitchSemitones');
            const now = this.ctx.currentTime;
            if (tempoParam) tempoParam.setValueAtTime(1.0, now);
            const pitchOffset = 12 * Math.log2(this.tempoRatio || 1);
            if (pitchParam)
                pitchParam.setValueAtTime(this.pitchSemitones - pitchOffset, now);
            if (this.guideDelayNode) {
                this.guideDelayNode.delayTime.setValueAtTime(0.105, now);
            }
        } else if (!needsWorklet) {
            if (this.masterSoundTouchNode) {
                this.stSumBus.disconnect();
                this.masterSoundTouchNode.disconnect();
                this.masterSoundTouchNode = null;
                this.stSumBus.connect(this.limiter);
            }
            if (this.guideDelayNode && this.ctx) {
                this.guideDelayNode.delayTime.setValueAtTime(0, this.ctx.currentTime);
            }
            if (this.guideSoundTouchNode) {
                if (this._wasmMergerGuide) {
                    this._wasmMergerGuide.disconnect();
                    this._wasmMergerGuide.connect(this.limiter);
                }
                this.guideSoundTouchNode.disconnect();
                this.guideSoundTouchNode = null;
            }
        }
    }

    // ---- Transport ----
    async play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        const sessionId = ++this._sessionId;

        if (IS_DESKTOP) {
            if (this.pausePosition > 0) DesktopAudioBridge.seek(this.pausePosition);
            DesktopAudioBridge.play();
            this._playStartWall = performance.now();
            this._playStartPos = this.pausePosition;
            this.lastFetchPos = this.pausePosition;
            this.lastFetchTime = performance.now();
            this._startRAF(sessionId);
            this._startDesktopLevelPoll();
            return;
        }

        if (this.isWASMReady && this.wasm) {
            if (this.ctx?.state === 'suspended') await this.ctx.resume();
            this.wasm.seek(this.pausePosition); // Ensure we start at the seeked position
            this.wasm.play();
            this._wasmPlayIssued = true;
            this._playStartWall = performance.now();
            this._playStartPos = this.pausePosition;
            this.lastFetchPos = this.pausePosition;
            this.lastFetchTime = performance.now();
            this._startRAF(sessionId);
            return;
        }

        if (IS_NATIVE) {
            const native = await getNative();
            if (this.pausePosition > 0) await native.seek(this.pausePosition);
            await native.play();
            this._playStartWall = performance.now();
            this._playStartPos = this.pausePosition;
            this.lastFetchPos = this.pausePosition;
            this.lastFetchTime = performance.now();
            this._startRAF(sessionId);
            this._startNativeLevelPoll(native);
            return;
        }

        if (this.ctx?.state === 'suspended') await this.ctx.resume();
        const now = this.ctx.currentTime;
        const syncTime = now + 0.025;
        const startOffset = Math.max(0, this.pausePosition);
        this._playStartTime = syncTime;
        this.lastFetchPos = startOffset;
        this.lastFetchTime = performance.now();
        this._startRAF(sessionId);

        this._updateWorkletGraph();

        let anySolo = false;
        for (const t of this.tracks.values()) { if (t.solo) { anySolo = true; break; } }

        for (const [, track] of this.tracks.entries()) {
            if (track.isVisualOnly || !track.buffer) continue;
            if (track.source) { try { track.source.stop(); } catch {} }
            if (track.gain) {
                const targetGain = this._effectiveTrackGain(track, anySolo);
                track.gain.gain.cancelScheduledValues(now);
                track.gain.gain.setValueAtTime(0, now);
                track.gain.gain.linearRampToValueAtTime(targetGain, syncTime + 0.015);
            }
            const src = this.ctx.createBufferSource();
            src.buffer = track.buffer;
            src.connect(track.panner);
            src.playbackRate.value = this.tempoRatio;
            src.start(syncTime, startOffset);
            track.source = src;
        }
    }

    async pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this._sessionId += 1;

        if (this.isWASMReady && this.wasm) {
            this.pausePosition = this.wasm.getCurrentPosition();
            this.progress = this.pausePosition;
            this._wasmPlayIssued = false;
            this.wasm.pause();
            this._stopWasmVuLogging();
            this._stopWasmVuPoll();
            if (this._updater) cancelAnimationFrame(this._updater);
            return;
        }

        if (IS_DESKTOP) {
            try {
                this.pausePosition = await DesktopAudioBridge.getPosition();
            } catch {
                this.pausePosition = this.lastFetchPos;
            }
            DesktopAudioBridge.pause();
            this._stopNativeLevelPoll();
            if (this._updater) cancelAnimationFrame(this._updater);
            return;
        }

        if (IS_NATIVE) {
            const native = await getNative();
            try { this.pausePosition = await native.getPosition() || (this._playStartPos + (performance.now() - this._playStartWall) / 1000); }
            catch { this.pausePosition = this._playStartPos + (performance.now() - this._playStartWall) / 1000; }
            await native.pause();
            this._stopNativeLevelPoll();
        } else {
            const elapsed = Math.max(0, this.ctx.currentTime - this._playStartTime);
            this.pausePosition += elapsed * this.tempoRatio;
            for (const [, t] of this.tracks.entries()) { if (t.source) { try { t.source.stop(); } catch {} t.source = null; } }
        }
        if (this._updater) cancelAnimationFrame(this._updater);
    }

    async seek(seconds) {
        this._sessionId += 1;
        this.pausePosition = seconds;
        this.progress = seconds;
        this.lastFetchPos = seconds;
        this.lastFetchTime = performance.now();
        this.isDragging = false;

        if (this.isWASMReady && this.wasm) {
            this.wasm.seek(seconds);
            if (this.isPlaying) this._startRAF(this._sessionId);
        } else if (IS_DESKTOP) {
            DesktopAudioBridge.seek(seconds);
            if (this.isPlaying) {
                this._playStartWall = performance.now();
                this._playStartPos = seconds;
                this._startRAF(this._sessionId);
            }
        } else if (IS_NATIVE) {
            const n = await getNative();
            await n.seek(seconds);
            if (this.isPlaying) { this._playStartWall = performance.now(); this._playStartPos = seconds; this._startRAF(this._sessionId); }
        } else {
            if (this.isPlaying) {
                for (const [, t] of this.tracks.entries()) { if (t.source) { try { t.source.stop(); } catch {} t.source = null; } }
                this.isPlaying = false;
                await this.play();
            }
        }
        this._notifyProgress();
    }

    async stop() {
        this._sessionId += 1;
        this.isPlaying = false;

        if (this.isWASMReady && this.wasm) {
            this._wasmPlayIssued = false;
            this.wasm.stop();
            this._stopWasmVuLogging();
            this._stopWasmVuPoll();
        } else if (IS_DESKTOP) {
            DesktopAudioBridge.stop();
            this._stopNativeLevelPoll();
        } else if (IS_NATIVE) {
            const native = await getNative();
            await native.stop();
            this._stopNativeLevelPoll();
        } else {
            for (const [, t] of this.tracks.entries()) {
                if (t.source) {
                    const now = this.ctx.currentTime;
                    if (t.gain) { t.gain.gain.cancelScheduledValues(now); t.gain.gain.setTargetAtTime(0, now, 0.02); }
                    t.source.stop(now + 0.03); t.source = null;
                }
            }
        }
        this.resetTiming();
        if (this._updater) cancelAnimationFrame(this._updater);
        
        // Wait briefly to allow anti-pop fades to complete and native threads to settle
        await new Promise(r => setTimeout(r, 60));
    }

    resetTiming() {
        this._sessionId += 1;
        this.progress = 0;
        this.pausePosition = 0;
        this.lastFetchPos = 0;
        this.lastFetchTime = performance.now();
        this._playStartTime = 0;
        this._playStartWall = 0;
        this._playStartPos = 0;
        this._durationHint = 0;
    }

    addProgressListener(fn) { this._progressListeners.add(fn); }
    removeProgressListener(fn) { this._progressListeners.delete(fn); }

    _notifyProgress() {
        const now = performance.now();
        if (now - this._lastNotifyTime < (this.isDragging ? 16 : this._NOTIFY_INTERVAL)) return;
        this._lastNotifyTime = now;
        const current = this.getCurrentTime();
        if (this.onProgress) this.onProgress(current);
        for (const fn of this._progressListeners) fn(current);
    }

    getCurrentPosition() {
        return this.getCurrentTime();
    }

    getCurrentTime() {
        if (this.isDragging) return this.dragTime;
        if (!this.isPlaying) return this.progress;
        if (IS_DESKTOP) return Math.max(0, this.lastFetchPos);
        if (this.isWASMReady && this.wasm) return this.wasm.getCurrentPosition();
        const delta = Math.max(0, Math.min(0.5, (performance.now() - this.lastFetchTime) / 1000));
        return Math.max(0, this.lastFetchPos + delta * (this.tempoRatio || 1));
    }

    setLoop(active, startSec, endSec) {
        this.loopActive = !!active;
        this.loopStart = startSec != null ? Number(startSec) : null;
        this.loopEnd = endSec != null ? Number(endSec) : null;
        this.loopExitPending = false;
        console.log(`[AUDIO ENGINE] Loop set: active=${this.loopActive}, start=${this.loopStart}, end=${this.loopEnd}`);
    }

    exitLoop() {
        if (this.loopActive) {
            this.loopExitPending = true;
            console.log('[AUDIO ENGINE] Loop exit pending');
        }
    }

    _handleEngineEnded() {
        this.isPlaying = false;
        this._sessionId += 1;
        this._wasmPlayIssued = false;
        this.pausePosition = 0;
        this.progress = 0;
        this.lastFetchPos = 0;
        this.lastFetchTime = performance.now();
        if (this._updater) cancelAnimationFrame(this._updater);
        this._stopWasmVuPoll();
        this._lastNotifyTime = 0;
        this._notifyProgress();
        if (typeof this.onEnded === 'function') {
            try { this.onEnded(); } catch (e) { console.warn('[AudioEngine] onEnded error', e); }
        }
    }

    _startRAF(sessionId) {
        const update = async () => {
            if (!this.isPlaying || sessionId !== this._sessionId) return;
            if ((IS_NATIVE || IS_DESKTOP) && this._songPreparationActive) return;
            try {
                let currentPos = 0;
                if (this.isWASMReady && this.wasm) {
                    // Fin de canción: el motor C++ se detiene solo y vuelve a 0; avisar a la UI
                    if (this._wasmPlayIssued && typeof this.wasm.isPlaying === 'function' && !this.wasm.isPlaying()) {
                        this._handleEngineEnded();
                        return;
                    }
                    currentPos = this.wasm.getCurrentPosition();
                } else if (IS_DESKTOP) {
                    currentPos = await DesktopAudioBridge.getPosition();
                } else if (IS_NATIVE) {
                    const n = await getNative();
                    currentPos = await n.getPosition();
                    if (currentPos === 0 && this.lastFetchPos > 1) currentPos = this.lastFetchPos;
                } else {
                    const elapsed = Math.max(0, this.ctx.currentTime - this._playStartTime);
                    currentPos = this.pausePosition + (elapsed * this.tempoRatio);
                }
                
                // Sample-Accurate Loop Check
                if (this.loopActive && this.loopStart !== null && this.loopEnd !== null && !this._isLoopSeeking) {
                    if (currentPos >= this.loopEnd) {
                        if (this.loopExitPending) {
                            this.loopActive = false;
                            this.loopExitPending = false;
                        } else {
                            this._isLoopSeeking = true;
                            currentPos = this.loopStart;
                            try {
                                await this.seek(this.loopStart);
                            } finally {
                                this._isLoopSeeking = false;
                            }
                            return;
                        }
                    }
                }

                if (sessionId !== this._sessionId || !this.isPlaying) return;
                this.lastFetchPos = currentPos;
                this.lastFetchTime = performance.now();
                this.progress = currentPos;
                this._notifyProgress();
            } catch {}
            this._updater = requestAnimationFrame(update);
        };
        this._updater = requestAnimationFrame(update);
    }

    /** Stem count in the active engine (WASM, Capacitor native meta, or Web Audio map). */
    getTrackCount() {
        if (this.isWASMReady && this.wasm) return this._wasmTrackCount;
        if (IS_NATIVE || IS_DESKTOP) return this._trackMeta.size;
        return this.tracks.size;
    }

    startDrag(seconds) {
        this.isDragging = true;
        this.dragTime = seconds;
        this._notifyProgress();
    }

    updateDrag(seconds) {
        if (!this.isDragging) return;
        this.dragTime = seconds;
        this._notifyProgress();
    }

    async endDrag(seconds) {
        this.isDragging = false;
        await this.seek(seconds);
    }
}

export const audioEngine = new AudioEngine();
