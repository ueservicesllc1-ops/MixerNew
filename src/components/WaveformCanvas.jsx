import React, { useRef, useEffect, useState } from 'react';
import { audioEngine } from '../AudioEngine';

function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function WaveformCanvas({ songId, tracks, duration, hasPreview }) {
    const canvasRef = useRef(null);
    const [peaks, setPeaks] = useState(null);
    const [statusInfo, setStatusInfo] = useState({ isReal: false, source: 'Analizando...', color: '#64748b' });
    const actualDuration = duration || 180;

    // Load peaks from cache
    useEffect(() => {
        if (!songId) return;
        const saved = localStorage.getItem(`peaks_${songId}`);
        if (saved) {
            setPeaks(new Float32Array(JSON.parse(saved)));
            setStatusInfo({ isReal: true, source: 'ONDA GUARDADA', color: '#10b981' });
        } else {
            setPeaks(null);
            setStatusInfo({ isReal: false, source: 'Analizando...', color: '#64748b' });
        }
    }, [songId]);

    // Periodically try to analyze buffers if not loaded yet
    useEffect(() => {
        if (!songId) return;
        const updateWaveform = () => {
            if (!audioEngine.tracks) return;
            let bufferToUse = null;
            let currentSource = 'Analizando...';
            let bestScore = -1;

            const engineTracks = Array.from(audioEngine.tracks.entries());
            if (engineTracks.length === 0) return;

            for (const [id, t] of engineTracks) {
                if (!t.buffer) continue;
                const name = id.toLowerCase();
                let score = 10;
                if (name.includes('__previewmix')) score = 100;
                else if (name.includes('drum')) score = 50;
                else if (name.includes('bat')) score = 50;
                
                if (score > bestScore) {
                    bestScore = score;
                    bufferToUse = t.buffer;
                    currentSource = id;
                }
            }

            if (bufferToUse && typeof bufferToUse.getChannelData === 'function') {
                const data = bufferToUse.getChannelData(0);
                const displayW = 800; 
                const realP = new Float32Array(displayW);
                const step = Math.floor(data.length / displayW);
                
                for (let i = 0; i < displayW; i++) {
                    let max = 0;
                    for (let j = 0; j < step; j += Math.max(1, Math.floor(step/10))) {
                        const v = Math.abs(data[i * step + j]);
                        if (v > max) max = v;
                    }
                    realP[i] = max;
                }
                
                // Normalizar
                const m = Math.max(...realP);
                if (m > 0) for (let i = 0; i < realP.length; i++) realP[i] /= m;

                setPeaks(realP);
                localStorage.setItem(`peaks_${songId}`, JSON.stringify(Array.from(realP)));
                setStatusInfo({ isReal: true, source: 'ONDA GENERADA', color: '#00e5ff' });
            }
        };

        if (!peaks) {
            const timer = setInterval(updateWaveform, 2000);
            updateWaveform();
            return () => clearInterval(timer);
        }
    }, [songId, tracks, peaks]);

    const isDraggingRef = useRef(false);
    const offscreenRef = useRef({ dark: null, bright: null, W: 0, H: 0 });

    // ── O(1) PRE-RENDER ──────────────────────────────────────────────
    useEffect(() => {
        if (!peaks || !canvasRef.current) return;
        const W = canvasRef.current.offsetWidth || 800;
        const H = canvasRef.current.offsetHeight || 100;

        const makeCanvas = () => {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            return { c, ctx: c.getContext('2d') };
        };

        const dark = makeCanvas();
        dark.ctx.fillStyle = '#1e293b';
        dark.ctx.fillRect(0, 0, W, H);
        dark.ctx.fillStyle = '#475569';

        const bright = makeCanvas();
        bright.ctx.fillStyle = statusInfo.color;

        const stepW = Math.ceil(W / peaks.length);
        for (let x = 0; x < peaks.length; x++) {
            const h = Math.max(2, peaks[x] * (H * 0.8));
            const rectX = (x / peaks.length) * W;
            const rectY = H/2 - h/2;
            dark.ctx.fillRect(rectX, rectY, stepW, h);
            bright.ctx.fillRect(rectX, rectY, stepW, h);
        }

        offscreenRef.current = { dark: dark.c, bright: bright.c, W, H };
    }, [peaks, statusInfo.color]);

    // Update local duration ref for stable RAF
    const durationRef = useRef(actualDuration);
    useEffect(() => { durationRef.current = actualDuration; }, [actualDuration]);

    // ── HIGH PERFORMANCE RENDER LOOP (60 FPS) ────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        let rafId;

        const render = () => {
            const W = canvas.offsetWidth;
            const H = canvas.offsetHeight;
            if (canvas.width !== W || canvas.height !== H) {
                canvas.width = W;
                canvas.height = H;
            }

            // Interpolated Progress - IF dragging, use global dragTime
            const currentT = audioEngine.isDragging ? audioEngine.dragTime : audioEngine.getCurrentTime();
            const activeDur = durationRef.current || 1;

            const playheadX = Math.max(0, Math.min(W, (currentT / activeDur) * W));
            const { dark, bright } = offscreenRef.current;

            if (dark && bright) {
                // 1. Draw base dark layer entirely
                ctx.drawImage(dark, 0, 0, W, H);
                // 2. Draw bright layer clipped to playhead
                if (playheadX > 0) {
                    ctx.drawImage(bright, 0, 0, playheadX, H, 0, 0, playheadX, H);
                }
            } else {
                 ctx.fillStyle = '#1e293b'; 
                 ctx.fillRect(0, 0, W, H);
            }

            // 3. Playhead Cursor
            ctx.fillStyle = '#ef4444'; // Red
            ctx.fillRect(playheadX - 1, 0, 2, H);

            rafId = requestAnimationFrame(render);
        };

        rafId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(rafId);
    }, []); // Run ONCE on mount, use Refs for data

    const handleInteraction = (clientX) => {
        if (!actualDuration || !canvasRef.current) return 0;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        return pct * actualDuration;
    };

    const handleMouseDown = (e) => {
        audioEngine.startDrag(handleInteraction(e.clientX));
        
        const onMouseMove = (moveEvent) => {
            audioEngine.updateDrag(handleInteraction(moveEvent.clientX));
        };
        
        const onMouseUp = (upEvent) => {
            audioEngine.endDrag(handleInteraction(upEvent.clientX));
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleTouchStart = (e) => {
        if (e.touches.length > 0) {
            audioEngine.startDrag(handleInteraction(e.touches[0].clientX));
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length > 0) {
            audioEngine.updateDrag(handleInteraction(e.touches[0].clientX));
        }
    };

    const handleTouchEnd = (e) => {
        let finalX = 0;
        if (e.changedTouches.length > 0) finalX = e.changedTouches[0].clientX;
        audioEngine.endDrag(handleInteraction(finalX));
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ position: 'relative', width: '100%', height: '100%', cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}
        >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', top: '5px', left: '10px', color: '#fff', fontSize: '10px', opacity: 0.5 }}>{statusInfo.source}</div>
        </div>
    );
}
