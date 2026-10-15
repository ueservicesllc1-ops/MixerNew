// Engine de Audio dedicado exclusivamente a la reproducción de Fundamental Ambient Pads
// Soporta Web Audio en Web, Capacitor Android / iOS y Electron.

function normalizePadKey(k) {
    if (!k) return 'C';
    const map = {
        'C#': 'Db',
        'D#': 'Eb',
        'F#': 'Gb',
        'G#': 'Ab',
        'A#': 'Bb',
    };
    const clean = String(k).trim();
    return map[clean] || clean;
}

export class PadEngine {
    constructor() {
        this._ctx = null;
        this.buffers = {};
        this.loadingPromises = {};
        this.currentSource = null;
        this.currentGain = null;
        this.lowShelf = null;
        this.highShelf = null;
        this.masterGain = null;

        this.volume = 0.8;
        this.pitchState = 0; // -1, 0, 1
        this.isPlaying = false;
        this.currentKey = null;
    }

    get ctx() {
        if (!this._ctx) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this._ctx = new AudioCtx();
                    this.initNodes();
                }
            } catch (e) {
                console.warn('[PadEngine] Error instanciando AudioContext:', e);
            }
        }
        return this._ctx;
    }

    set ctx(val) {
        this._ctx = val;
    }

    ensureContext() {
        const c = this.ctx;
        if (c && (c.state === 'suspended' || c.state === 'interrupted')) {
            c.resume().then(() => {
                console.log('[PadEngine] AudioContext resumido correctamente, state:', c.state);
            }).catch(e => console.warn('[PadEngine] resume error', e));
        }
        return c;
    }

    initNodes() {
        if (!this._ctx) return;
        try {
            // Filtro EQ para simular "Octavas" sin deformar el audio ni pitch
            this.lowShelf = this._ctx.createBiquadFilter();
            this.lowShelf.type = 'lowshelf';
            this.lowShelf.frequency.value = 300;
            this.lowShelf.gain.value = 0;

            this.highShelf = this._ctx.createBiquadFilter();
            this.highShelf.type = 'highshelf';
            this.highShelf.frequency.value = 2000;
            this.highShelf.gain.value = 0;

            // Master Gain
            this.masterGain = this._ctx.createGain();
            this.masterGain.gain.value = this.volume;

            // Enrutamiento: Filtros -> MasterGain -> Salida
            this.lowShelf.connect(this.highShelf);
            this.highShelf.connect(this.masterGain);
            this.masterGain.connect(this._ctx.destination);
        } catch (e) {
            console.warn('[PadEngine] initNodes error', e);
        }
    }

    async loadBuffer(key) {
        const normKey = normalizePadKey(key);
        if (this.buffers[normKey]) return this.buffers[normKey];
        if (this.loadingPromises[normKey]) return await this.loadingPromises[normKey];

        const p = (async () => {
            const candidates = [
                `pads/${normKey}.mp3`,
                `./pads/${normKey}.mp3`,
                `/pads/${normKey}.mp3`
            ];
            if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file')) {
                candidates.unshift(`${window.location.origin}/pads/${normKey}.mp3`);
            }

            let audioBuffer = null;
            for (const url of candidates) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) continue;

                    const ctype = response.headers.get('content-type') || '';
                    if (ctype.includes('text/html')) {
                        // Evita el fallback SPA de Capacitor
                        continue;
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    if (!arrayBuffer || arrayBuffer.byteLength < 100) continue;

                    const head = new Uint8Array(arrayBuffer.slice(0, 4));
                    if (head[0] === 0x3c) { // '<' de HTML
                        continue;
                    }

                    this.ensureContext();
                    const ctx = this.ctx;
                    if (!ctx) continue;

                    // Decodificar con promesa y callback para compatibilidad universal
                    audioBuffer = await new Promise((resolve, reject) => {
                        let settled = false;
                        const onOk = (buf) => {
                            if (!settled) {
                                settled = true;
                                resolve(buf);
                            }
                        };
                        const onErr = (err) => {
                            if (!settled) {
                                settled = true;
                                reject(err);
                            }
                        };
                        try {
                            const res = ctx.decodeAudioData(arrayBuffer.slice(0), onOk, onErr);
                            if (res && typeof res.then === 'function') {
                                res.then(onOk).catch(onErr);
                            }
                        } catch (err) {
                            onErr(err);
                        }
                    });

                    if (audioBuffer) {
                        console.log(`[PadEngine] Pad ${normKey} cargado exitosamente desde ${url}`);
                        break;
                    }
                } catch (err) {
                    console.warn(`[PadEngine] Intento fallido para ${url}:`, err);
                }
            }

            if (audioBuffer) {
                this.buffers[normKey] = audioBuffer;
                return audioBuffer;
            } else {
                console.error(`[PadEngine] No se pudo cargar pad para tono: ${normKey}`);
                return null;
            }
        })();

        this.loadingPromises[normKey] = p;
        try {
            return await p;
        } finally {
            delete this.loadingPromises[normKey];
        }
    }

    async start(key) {
        this.isPlaying = true;
        this.ensureContext();
        await this.playPad(key);
    }

    stop() {
        this.isPlaying = false;
        if (!this._ctx) return;
        const now = this._ctx.currentTime;
        if (this.currentGain) {
            try {
                this.currentGain.gain.cancelScheduledValues(now);
                this.currentGain.gain.setValueAtTime(this.currentGain.gain.value, now);
                this.currentGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
            } catch (e) {}
        }
        if (this.currentSource) {
            const src = this.currentSource;
            setTimeout(() => {
                try { src.stop(); src.disconnect(); } catch (e) {}
            }, 600);
        }
        this.currentSource = null;
        this.currentGain = null;
        this.currentKey = null;
    }

    async playPad(key) {
        const normKey = normalizePadKey(key);
        if (normKey === this.currentKey && this.currentSource && this.isPlaying) return;
        this.currentKey = normKey;

        this.ensureContext();
        const buffer = await this.loadBuffer(normKey);
        if (!buffer || !this.isPlaying || this.currentKey !== normKey) return;

        const ctx = this.ctx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const isFirstPlay = !this.currentSource;

        // FADE OUT suave de la nota anterior
        if (this.currentGain && this.currentSource) {
            const oldGain = this.currentGain;
            const oldSource = this.currentSource;
            try {
                oldGain.gain.cancelScheduledValues(now);
                oldGain.gain.setValueAtTime(oldGain.gain.value, now);
                oldGain.gain.linearRampToValueAtTime(0.0001, now + 1.0);
                setTimeout(() => {
                    try {
                        oldSource.stop();
                        oldSource.disconnect();
                    } catch (e) {}
                }, 1100);
            } catch (e) {
                console.warn('[PadEngine] oldSource fadeout error', e);
            }
        }

        // FADE IN del nuevo pad
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNode = ctx.createGain();
        const fadeInDur = isFirstPlay ? 0.35 : 1.0;
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(1.0, now + fadeInDur);

        source.connect(gainNode);
        if (this.lowShelf) {
            gainNode.connect(this.lowShelf);
        } else if (this.masterGain) {
            gainNode.connect(this.masterGain);
        } else {
            gainNode.connect(ctx.destination);
        }

        source.start(now);

        this.currentSource = source;
        this.currentGain = gainNode;
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.8));
        if (this.masterGain && this._ctx) {
            try {
                this.masterGain.gain.cancelScheduledValues(this._ctx.currentTime);
                this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this._ctx.currentTime);
                this.masterGain.gain.linearRampToValueAtTime(this.volume, this._ctx.currentTime + 0.05);
            } catch (e) {
                this.masterGain.gain.value = this.volume;
            }
        }
    }

    setPitch(octave) {
        this.pitchState = octave;
        if (!this._ctx || !this.lowShelf || !this.highShelf) return;
        const now = this._ctx.currentTime;
        try {
            if (octave === 1) {
                this.lowShelf.gain.setTargetAtTime(-15, now, 0.2);
                this.highShelf.gain.setTargetAtTime(10, now, 0.2);
            } else if (octave === -1) {
                this.lowShelf.gain.setTargetAtTime(12, now, 0.2);
                this.highShelf.gain.setTargetAtTime(-15, now, 0.2);
            } else {
                this.lowShelf.gain.setTargetAtTime(0, now, 0.2);
                this.highShelf.gain.setTargetAtTime(0, now, 0.2);
            }
        } catch (e) {}
    }
}

export const padEngine = new PadEngine();
