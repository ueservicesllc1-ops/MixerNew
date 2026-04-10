import React, { useRef, useEffect, useState } from 'react';
import { audioEngine } from '../AudioEngine';
import { NativeEngine } from '../NativeEngine';

function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function WaveformCanvas({ songId, tracks, duration, hasPreview, progress }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const lastDragSecRef = useRef(0);
    const actualDurationRef = useRef(1);
    const [peaks, setPeaks] = useState(null);
    /** Duración del buffer usado para generar peaks (nativo: evita actualDuration=1 cuando aún no llega duration del padre). */
    const [peakDuration, setPeakDuration] = useState(0);
    const [statusInfo, setStatusInfo] = useState({ isReal: false, source: 'Analizando...', color: '#64748b' });
    const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
    const actualDuration = isNative
        ? ((duration && duration > 0)
            ? duration
            : (peakDuration > 0 ? peakDuration : Math.max(progress || 0, 1)))
        : (duration || 180);

    actualDurationRef.current = actualDuration;

    // Load peaks from cache
    useEffect(() => {
        if (!songId) return;
        setPeakDuration(0);
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

        const pickBufferFromEngine = () => {
            // Web: decoded buffers live on audioEngine.tracks. Native: only _trackMeta has optional buffer (tracks Map stays empty).
            const map = isNative ? audioEngine._trackMeta : audioEngine.tracks;
            if (!map || map.size === 0) return null;

            let bufferToUse = null;
            let bestScore = -1;

            for (const [id, t] of map.entries()) {
                if (!t || !t.buffer || typeof t.buffer.getChannelData !== 'function') continue;
                const name = id.toLowerCase();
                let score = 10;
                if (name.includes('__previewmix')) score = 100;
                else if (name.includes('drum')) score = 50;
                else if (name.includes('bat')) score = 50;

                if (score > bestScore) {
                    bestScore = score;
                    bufferToUse = t.buffer;
                }
            }
            return bufferToUse;
        };

        const buildPeaksFromBuffer = (bufferToUse) => {
            const data = bufferToUse.getChannelData(0);
            const displayW = 800;
            const realP = new Float32Array(displayW);
            const step = Math.max(1, Math.floor(data.length / displayW));

            for (let i = 0; i < displayW; i++) {
                let max = 0;
                for (let j = 0; j < step; j += Math.max(1, Math.floor(step / 10))) {
                    const idx = i * step + j;
                    if (idx >= data.length) break;
                    const v = Math.abs(data[idx]);
                    if (v > max) max = v;
                }
                realP[i] = max;
            }

            const m = Math.max(...realP);
            if (m > 0) for (let i = 0; i < realP.length; i++) realP[i] /= m;

            setPeakDuration(bufferToUse.duration || 0);
            setPeaks(realP);
            localStorage.setItem(`peaks_${songId}`, JSON.stringify(Array.from(realP)));
            setStatusInfo({ isReal: true, source: 'ONDA GENERADA', color: '#00e5ff' });
        };

        const updateWaveform = async () => {
            let bufferToUse = pickBufferFromEngine();

            // Native: leer __PreviewMix directo del filesystem (fuente de verdad)
            if (!bufferToUse && isNative && audioEngine.ctx) {
                try {
                    const raw = await NativeEngine.readTrackBlob(songId, '__PreviewMix');
                    if (raw) {
                        const ab = raw instanceof ArrayBuffer ? raw.slice(0) : await raw.arrayBuffer();
                        bufferToUse = await audioEngine.ctx.decodeAudioData(ab);
                    }
                } catch {
                    /* ignore */
                }
            }

            if (bufferToUse) buildPeaksFromBuffer(bufferToUse);
        };

        if (!peaks) {
            const timer = setInterval(updateWaveform, 2000);
            updateWaveform();
            return () => clearInterval(timer);
        }
    }, [songId, tracks, peaks, isNative]);

    const isDraggingRef = useRef(false);

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

            // Playhead: siempre tiempo del motor (60 FPS); el state `progress` del padre va más lento y en Android dejaba la línea “muerta”.
            const currentT = audioEngine.isDragging
                ? audioEngine.dragTime
                : audioEngine.getCurrentTime();

            // Background
            ctx.fillStyle = '#1e293b'; 
            ctx.fillRect(0, 0, W, H);

            if (peaks) {
                const playheadX = Math.max(0, Math.min(W, (currentT / actualDuration) * W));
                const centerY = H / 2;
                
                // High contrast on dark bar: white tones (unplayed slightly dimmer than played accent)
                const wavePlayed = statusInfo.isReal ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)';
                const waveUnplayed = 'rgba(255,255,255,0.28)';
                for (let x = 0; x < peaks.length; x++) {
                    const canvasX = (x / peaks.length) * W;
                    const val = peaks[x];
                    const h = Math.max(2, val * (H * 0.8));
                    const played = canvasX < playheadX;
                    
                    ctx.fillStyle = played ? wavePlayed : waveUnplayed;
                    ctx.fillRect(canvasX, centerY - h / 2, Math.ceil(W/peaks.length), h);
                }

                // Playhead (amarillo visible sobre la onda)
                const px = Math.round(playheadX);
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 4;
                ctx.fillStyle = '#facc15';
                ctx.fillRect(px - 2, 0, 4, H);
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fffef0';
                ctx.fillRect(px - 1, 0, 2, H);
            }

            rafId = requestAnimationFrame(render);
        };

        rafId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(rafId);
    }, [peaks, statusInfo, actualDuration, isNative]);

    const handleInteraction = (clientX) => {
        const dur = actualDurationRef.current;
        if (!dur || !canvasRef.current) return 0;
        const rect = canvasRef.current.getBoundingClientRect();
        const w = rect.width || 1;
        const x = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / w));
        return pct * dur;
    };

    const handleMouseDown = (e) => {
        const t = handleInteraction(e.clientX);
        lastDragSecRef.current = t;
        audioEngine.startDrag(t);

        const onMouseMove = (moveEvent) => {
            const tt = handleInteraction(moveEvent.clientX);
            lastDragSecRef.current = tt;
            audioEngine.updateDrag(tt);
        };

        const onMouseUp = (upEvent) => {
            const tt = handleInteraction(upEvent.clientX);
            lastDragSecRef.current = tt;
            void audioEngine.endDrag(tt);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Android: touchmove con passive:false + preventDefault para que el scrub no lo robe el scroll/zoom.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const opts = { passive: false };

        const touchStart = (e) => {
            if (!e.touches?.length) return;
            e.preventDefault();
            const t = handleInteraction(e.touches[0].clientX);
            lastDragSecRef.current = t;
            audioEngine.startDrag(t);
        };
        const touchMove = (e) => {
            if (!e.touches?.length) return;
            e.preventDefault();
            const t = handleInteraction(e.touches[0].clientX);
            lastDragSecRef.current = t;
            audioEngine.updateDrag(t);
        };
        const touchEnd = (e) => {
            e.preventDefault();
            let t = lastDragSecRef.current;
            if (e.changedTouches?.length) {
                t = handleInteraction(e.changedTouches[0].clientX);
                lastDragSecRef.current = t;
            }
            void audioEngine.endDrag(t);
        };

        el.addEventListener('touchstart', touchStart, opts);
        el.addEventListener('touchmove', touchMove, opts);
        el.addEventListener('touchend', touchEnd, opts);
        el.addEventListener('touchcancel', touchEnd, opts);
        return () => {
            el.removeEventListener('touchstart', touchStart, opts);
            el.removeEventListener('touchmove', touchMove, opts);
            el.removeEventListener('touchend', touchEnd, opts);
            el.removeEventListener('touchcancel', touchEnd, opts);
        };
    }, [songId, actualDuration]);

    return (
        <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#0f172a',
                touchAction: 'none'
            }}
        >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', top: '5px', left: '10px', color: '#fff', fontSize: '10px', opacity: 0.5 }}>{statusInfo.source}</div>
        </div>
    );
}
