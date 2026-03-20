/**
 * academyAudio.js — Zion Academy Audio Engine v2.0
 * Real piano samples via Tone.js Salamander + Web Audio API fallback
 */
import * as Tone from 'tone';

class AcademyAudio {
    constructor() {
        this.isLoaded = false;
        this.isStarted = false;
        this.synth = null;
        this._initSynth();
    }

    _initSynth() {
        this.synth = new Tone.Sampler({
            urls: {
                A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
                A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
                A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
                A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
                A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
                A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
                A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
                A7: 'A7.mp3', C8: 'C8.mp3',
            },
            release: 1.5,
            baseUrl: 'https://tonejs.github.io/audio/salamander/',
            onload: () => {
                console.log('🎹 Salamander Piano loaded!');
                this.isLoaded = true;
            },
        }).toDestination();
    }

    async _start() {
        if (!this.isStarted) {
            await Tone.start();
            this.isStarted = true;
        }
    }

    /**
     * Play a single note
     * @param {string} note - e.g. 'C4', 'G#4'
     * @param {string} duration - Tone.js duration string (default '4n' = quarter note)
     */
    async playNote(note, duration = '4n') {
        if (!note) return;
        try {
            await this._start();
            if (this.isLoaded) {
                this.synth.triggerAttackRelease(note, duration);
            } else {
                // Immediate fallback using simple oscillator
                const fallback = new Tone.Synth({
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.8 },
                }).toDestination();
                fallback.triggerAttackRelease(note, duration);
                setTimeout(() => fallback.dispose(), 2000);
            }
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    /**
     * Play two notes as a melodic interval (sequential)
     */
    async playInterval(note1, note2, gap = 0.6) {
        try {
            await this._start();
            const now = Tone.now();
            if (this.isLoaded) {
                this.synth.triggerAttackRelease(note1, '4n', now);
                this.synth.triggerAttackRelease(note2, '4n', now + gap);
            } else {
                const s = new Tone.PolySynth(Tone.Synth).toDestination();
                s.triggerAttackRelease(note1, '4n', now);
                s.triggerAttackRelease(note2, '4n', now + gap);
                setTimeout(() => s.dispose(), 3000);
            }
        } catch (e) {
            console.warn('Interval error:', e);
        }
    }

    /**
     * Play notes simultaneously as a chord
     */
    async playChord(notes, duration = '2n') {
        try {
            await this._start();
            if (this.isLoaded) {
                this.synth.triggerAttackRelease(notes, duration);
            } else {
                const s = new Tone.PolySynth(Tone.Synth).toDestination();
                s.triggerAttackRelease(notes, duration);
                setTimeout(() => s.dispose(), 3000);
            }
        } catch (e) {
            console.warn('Chord error:', e);
        }
    }

    /**
     * Play a full diatonic scale
     * @param {string} root - e.g. 'C4'
     */
    async playScale(root = 'C4') {
        try {
            await this._start();
            const noteNames = ['C','D','E','F','G','A','B','C'];
            const octave = parseInt(root.slice(-1));

            const scale = noteNames.map((n, i) => {
                const oct = n === 'C' && i === 7 ? octave + 1 : octave;
                return `${n}${oct}`;
            });
            const now = Tone.now();
            scale.forEach((note, i) => {
                if (this.isLoaded) {
                    this.synth.triggerAttackRelease(note, '8n', now + i * 0.35);
                }
            });
        } catch (e) {
            console.warn('Scale error:', e);
        }
    }

    /**
     * Play a metronome click pattern
     */
    async playMetronome(bpm = 80, beats = 4) {
        try {
            await this._start();
            const beatDur = 60 / bpm;
            const now = Tone.now();
            for (let i = 0; i < beats; i++) {
                const osc = new Tone.Oscillator(i === 0 ? 880 : 660, 'sine').toDestination();
                const env = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 }).toDestination();
                osc.connect(env);
                osc.start(now + i * beatDur);
                osc.stop(now + i * beatDur + 0.08);
            }
        } catch (e) {
            console.warn('Metronome error:', e);
        }
    }

    /**
     * Play correct answer sound (happy chime)
     */
    async playCorrect() {
        try {
            await this._start();
            const now = Tone.now();
            if (this.isLoaded) {
                this.synth.triggerAttackRelease('E5', '16n', now);
                this.synth.triggerAttackRelease('G5', '16n', now + 0.1);
                this.synth.triggerAttackRelease('C6', '8n', now + 0.2);
            }
        } catch { /* ignore */ }
    }

    /**
     * Play wrong answer sound (buzzer)
     */
    async playWrong() {
        try {
            await this._start();
            const synth = new Tone.Synth({
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
            }).toDestination();
            synth.triggerAttackRelease('C2', '8n');
            setTimeout(() => synth.dispose(), 1000);
        } catch { /* ignore */ }
    }

    /**
     * Play level complete fanfare
     */
    async playLevelComplete() {
        try {
            await this._start();
            const now = Tone.now();
            if (this.isLoaded) {
                ['C4','E4','G4','C5'].forEach((note, i) => {
                    this.synth.triggerAttackRelease(note, '8n', now + i * 0.15);
                });
                this.synth.triggerAttackRelease(['C4','E4','G4','C5'], '2n', now + 0.7);
            }
        } catch { /* ignore */ }
    }
}

export const academyAudio = new AcademyAudio();
