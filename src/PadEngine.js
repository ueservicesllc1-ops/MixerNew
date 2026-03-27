export class PadEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.currentSource = null;
        this.currentGain = null;

        // Equal Power Crossfade Arrays
        this.fadeInCurve = new Float32Array(100);
        this.fadeOutCurve = new Float32Array(100);
        for (let i = 0; i < 100; i++) {
            const x = i / 99; // de 0 a 1
            this.fadeInCurve[i] = Math.cos((1.0 - x) * 0.5 * Math.PI);
            this.fadeOutCurve[i] = Math.cos(x * 0.5 * Math.PI);
        }

        // Filtro EQ para simular "Octavas" sin deformar el audio
        this.lowShelf = this.ctx.createBiquadFilter();
        this.lowShelf.type = 'lowshelf';
        this.lowShelf.frequency.value = 300;
        this.lowShelf.gain.value = 0;

        this.highShelf = this.ctx.createBiquadFilter();
        this.highShelf.type = 'highshelf';
        this.highShelf.frequency.value = 2000;
        this.highShelf.gain.value = 0;

        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;

        // Enrutamiento: Filtros -> MasterGain -> Salida
        this.lowShelf.connect(this.highShelf);
        this.highShelf.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.fadeTime = 3.5; // Transición muy larga y atmosférica
        this.isPlaying = false;
        this.currentKey = null;
        this.pitchState = 0; // -1, 0, 1
    }

    async loadBuffer(key) {
        if (this.buffers[key]) return this.buffers[key];

        const extensions = ['m4a', 'mp3', 'wav', 'ogg'];
        let buffer = null;

        for (const ext of extensions) {
            try {
                const response = await fetch(`/pads/${key}.${ext}`);
                if (!response.ok) continue;

                const arrayBuffer = await response.arrayBuffer();
                buffer = await this.ctx.decodeAudioData(arrayBuffer);
                break;
            } catch (error) {
                console.debug('loadBuffer try format error', error);
                // Siguiente formato
            }
        }

        if (buffer) {
            this.buffers[key] = buffer;
            return buffer;
        } else {
            console.error(`Pad no encontrado para: ${key}`);
            return null;
        }
    }

    start(key) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.isPlaying = true;
        this.playPad(key);
    }

    stop() {
        this.isPlaying = false;
        const now = this.ctx.currentTime;
        if (this.currentGain) {
            this.currentGain.gain.cancelScheduledValues(now);
            this.currentGain.gain.setValueCurveAtTime(this.fadeOutCurve, now, 2.0); // Fade out más rápido
        }

        if (this.currentSource) {
            const src = this.currentSource;
            setTimeout(() => {
                try { src.stop(); src.disconnect(); } catch (e) { console.warn('pad stop error', e); }
            }, 2100);
        }

        this.currentSource = null;
        this.currentGain = null;
        this.currentKey = null;
    }

    async playPad(key) {
        if (key === this.currentKey && this.currentSource) return;
        this.currentKey = key;

        const buffer = await this.loadBuffer(key);
        if (!buffer || !this.isPlaying || this.currentKey !== key) return;

        const now = this.ctx.currentTime;

        // FADE OUT suave (Equal Power) del archivo anterior
        if (this.currentGain && this.currentSource) {
            const oldGain = this.currentGain;
            const oldSource = this.currentSource;
            oldGain.gain.cancelScheduledValues(now);
            oldGain.gain.setValueCurveAtTime(this.fadeOutCurve, now, this.fadeTime);

            setTimeout(() => {
                try { oldSource.stop(); oldSource.disconnect(); } catch (e) { console.warn('pad stop error', e); }
            }, this.fadeTime * 1000 + 100);
        }

        // FADE IN suave (Equal Power) del nuevo archivo
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueCurveAtTime(this.fadeInCurve, now, this.fadeTime);

        // Conectar al filtro EQ en lugar de directamente al master
        source.connect(gainNode);
        gainNode.connect(this.lowShelf);

        source.start(now);

        this.currentSource = source;
        this.currentGain = gainNode;
    }

    setVolume(value) {
        if (this.masterGain) {
            // Suavizar el volumen
            this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
        }
    }

    setPitch(octave) {
        this.pitchState = octave;
        const now = this.ctx.currentTime;

        // En lugar de acelerar la pista y arruinarla, 
        // usamos ecualización de estudio (Filtros LowShelf y HighShelf)
        if (octave === 1) {
            // "Octava arriba" -> Cortamos graves, subimos agudos brillosos
            this.lowShelf.gain.setTargetAtTime(-15, now, 0.5);   // Elimina opacidad
            this.highShelf.gain.setTargetAtTime(10, now, 0.5);  // Añade brillo/aire
        }
        else if (octave === -1) {
            // "Octava abajo" -> Subimos graves profundos, cortamos agudos
            this.lowShelf.gain.setTargetAtTime(12, now, 0.5);   // Añade peso/cuerpo
            this.highShelf.gain.setTargetAtTime(-15, now, 0.5); // Elimina brillo
        }
        else {
            // "Normal" -> Plano, sin filtros
            this.lowShelf.gain.setTargetAtTime(0, now, 0.5);
            this.highShelf.gain.setTargetAtTime(0, now, 0.5);
        }
    }
}

export const padEngine = new PadEngine();
