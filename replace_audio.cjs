const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const target = "import { audioEngine } from '../AudioEngine'";
const replacement = `// Desktop Mock AudioEngine wrapping window.zionNative
class DesktopAudioEngine {
    constructor() {
        this.tracks = new Map();
        this._durationHint = 0;
        this.isWASMReady = false;
        this.isPlaying = false;
        this.onProgress = null;
        this._trackMeta = new Map();
        this.ctx = null;
    }
    
    async play() {
        this.isPlaying = true;
        if (typeof window !== 'undefined' && window.zionNative) await window.zionNative.play();
    }
    async pause() {
        this.isPlaying = false;
        if (typeof window !== 'undefined' && window.zionNative) await window.zionNative.pause();
    }
    async stop() {
        this.isPlaying = false;
        if (typeof window !== 'undefined' && window.zionNative) await window.zionNative.stop();
    }
    async seek(pos) {
        if (typeof window !== 'undefined' && window.zionNative) await window.zionNative.seek(pos);
    }
    
    async clear() {
        this.tracks.clear();
        this._trackMeta.clear();
        if (typeof window !== 'undefined' && window.zionNative) await window.zionNative.stop();
    }
    
    async addTracksBatch(batch) {
        if (typeof window !== 'undefined' && window.zionNative) {
            await window.zionNative.loadSong(batch);
        }
        for (const t of batch) {
            this.tracks.set(t.id, t);
            this._trackMeta.set(t.id, { volume: 1, muted: false, solo: false });
        }
    }
    
    setMasterVolume(val) {
        // window.zionNative.setMasterVolume
    }
    setTrackVolume(id, vol) {
        if (typeof window !== 'undefined' && window.zionNative) window.zionNative.setTrackVolume(id, vol);
    }
    setTrackMute(id, val) {
        if (typeof window !== 'undefined' && window.zionNative) window.zionNative.setTrackMute(id, val);
    }
    setTrackSolo(id, val) {
        if (typeof window !== 'undefined' && window.zionNative) window.zionNative.setTrackSolo(id, val);
    }
    setSongPreparationActive(val) {}
    setTempo(ratio) {}
    setPitch(semis) {}
    getCurrentTime() { return 0; /* Poll or get from IPC later */ }
    getTrackLevel(id) { return 0; }
    removeTrack(id) { this.tracks.delete(id); }
    async init() {}
}
const audioEngine = new DesktopAudioEngine();
`;

c = c.replace(target, replacement);
fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Replaced audioEngine import with Desktop wrapper');
