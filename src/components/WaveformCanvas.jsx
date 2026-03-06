import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../AudioEngine';

/**
 * Draws a combined waveform of all loaded tracks on a canvas.
 * The playhead travels over it as the song plays.
 */
export default function WaveformCanvas({ tracks, progress, isPlaying }) {
    const canvasRef = useRef(null);
    // duration from any loaded buffer
    const durationRef = useRef(1);

    // ── Draw waveform whenever tracks change ────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.offsetWidth;
        const H = canvas.height = canvas.offsetHeight;

        ctx.clearRect(0, 0, W, H);

        // If no tracks yet, show placeholder background
        if (!tracks || tracks.length === 0) {
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#bbb';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Selecciona una canción para ver la forma de onda', W / 2, H / 2 + 5);
            return;
        }

        // Collect AudioBuffers from engine
        const buffers = [];
        for (const track of tracks) {
            const engineTrack = audioEngine.tracks.get(track.id);
            if (engineTrack && engineTrack.buffer) {
                buffers.push(engineTrack.buffer);
            }
        }
        if (buffers.length === 0) return;

        // Use the longest duration
        const duration = Math.max(...buffers.map(b => b.duration));
        durationRef.current = duration;

        // Sum all channel data into a mono peak array of W points
        const peaks = new Float32Array(W);
        for (const buf of buffers) {
            for (let ch = 0; ch < buf.numberOfChannels; ch++) {
                const data = buf.getChannelData(ch);
                const samplesPerPixel = Math.floor(data.length / W);
                for (let x = 0; x < W; x++) {
                    let max = 0;
                    const start = x * samplesPerPixel;
                    for (let s = 0; s < samplesPerPixel; s++) {
                        const abs = Math.abs(data[start + s] || 0);
                        if (abs > max) max = abs;
                    }
                    peaks[x] += max;
                }
            }
        }

        // Normalize
        let maxPeak = 0;
        for (let i = 0; i < W; i++) if (peaks[i] > maxPeak) maxPeak = peaks[i];
        if (maxPeak === 0) maxPeak = 1;
        for (let i = 0; i < W; i++) peaks[i] /= maxPeak;

        // ── Grey DAW background ──────────────────────────────────────
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(0, 0, W, H);

        // Grid lines (subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += Math.floor(W / 16)) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }

        // Center line
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

        // ── Waveform fill ────────────────────────────────────────────
        const waveGrad = ctx.createLinearGradient(0, 0, 0, H);
        waveGrad.addColorStop(0, 'rgba(0, 210, 211, 0.9)');
        waveGrad.addColorStop(0.5, 'rgba(0, 188, 212, 0.7)');
        waveGrad.addColorStop(1, 'rgba(0, 210, 211, 0.9)');

        ctx.fillStyle = waveGrad;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        for (let x = 0; x < W; x++) {
            const amplitude = (peaks[x] * H) / 2;
            ctx.lineTo(x, H / 2 - amplitude);
        }
        for (let x = W - 1; x >= 0; x--) {
            const amplitude = (peaks[x] * H) / 2;
            ctx.lineTo(x, H / 2 + amplitude);
        }
        ctx.closePath();
        ctx.fill();

        // Bright top edge
        ctx.strokeStyle = 'rgba(0, 230, 230, 1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
            const amplitude = (peaks[x] * H) / 2;
            if (x === 0) ctx.moveTo(x, H / 2 - amplitude);
            else ctx.lineTo(x, H / 2 - amplitude);
        }
        ctx.stroke();

        ctx.beginPath();
        for (let x = 0; x < W; x++) {
            const amplitude = (peaks[x] * H) / 2;
            if (x === 0) ctx.moveTo(x, H / 2 + amplitude);
            else ctx.lineTo(x, H / 2 + amplitude);
        }
        ctx.stroke();

    }, [tracks]);

    // ── Playhead overlay on canvas ──────────────────────────────────
    const duration = durationRef.current;
    const playheadPct = duration > 0 ? (progress / duration) * 100 : 0;

    const handleSeek = (e) => {
        if (!duration || duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const seekTime = pct * duration;
        audioEngine.seek(seekTime);
    };

    return (
        <div
            onClick={handleSeek}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                cursor: 'pointer'
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block', borderRadius: '10px' }}
            />
            {/* Playhead */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: `${playheadPct}%`,
                width: '2px',
                height: '100%',
                background: '#ff5252',
                boxShadow: '0 0 6px #ff525299',
                zIndex: 10,
                pointerEvents: 'none',
                transition: isPlaying ? 'none' : 'left 0.1s linear'
            }} />
            {/* Played region dim */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${playheadPct}%`,
                height: '100%',
                background: 'rgba(0,0,0,0.35)',
                borderRadius: '10px 0 0 10px',
                pointerEvents: 'none',
                transition: isPlaying ? 'none' : 'width 0.1s linear'
            }} />
        </div>
    );
}
