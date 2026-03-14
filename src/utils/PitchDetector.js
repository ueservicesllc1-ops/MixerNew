/**
 * PitchDetector.js
 * Algoritmo de detección de frecuencia fundamental (Pitch) usando el método de correlación (YIN-light).
 */

export class PitchDetector {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.bufferLength = this.analyser.fftSize;
        this.dataArray = new Float32Array(this.bufferLength);
    }

    async start(stream) {
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
    }

    getPitch() {
        this.analyser.getFloatTimeDomainData(this.dataArray);
        const pitch = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);
        if (pitch === -1) return null;
        
        return {
            frequency: pitch,
            note: this.noteFromPitch(pitch),
            detune: this.centsOffFromPitch(pitch)
        };
    }

    autoCorrelate(buf, sampleRate) {
        // RMS - Root Mean Square (verificamos si hay suficiente volumen)
        let size = buf.length;
        let rms = 0;
        for (let i = 0; i < size; i++) {
            let val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / size);
        if (rms < 0.01) return -1; // Ruido de fondo insuficiente

        // Recorte de señal para mejorar precisión
        let r1 = 0, r2 = size - 1, thres = 0.2;
        for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }

        buf = buf.slice(r1, r2);
        size = buf.length;

        let c = new Float32Array(size).fill(0);
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size - i; j++) {
                c[i] = c[i] + buf[j] * buf[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < size; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        let T0 = maxpos;
        return sampleRate / T0;
    }

    noteFromPitch(frequency) {
        const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const n = Math.round(12 * (Math.log(frequency / 440) / Math.log(2))) + 69;
        return noteStrings[n % 12];
    }

    centsOffFromPitch(frequency) {
        return Math.floor(1200 * Math.log(frequency / (440 * Math.pow(2, (Math.round(12 * (Math.log(frequency / 440) / Math.log(2))) / 12)))) / Math.log(2));
    }
}
