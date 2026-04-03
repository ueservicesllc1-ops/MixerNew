import React, { useRef, useEffect, useState } from 'react';
import { audioEngine } from '../AudioEngine';

/**
 * Waveform Scrubber.
 * Displays the best possible waveform, prioritizing "__PreviewMix".
 */
export default function WaveformCanvas({ songId, tracks, progress, duration, hasPreview }) {
    const canvasRef = useRef(null);

    // Lazy init: read persisted peaks from localStorage on first mount
    const [peaks, setPeaks] = useState(() => {
        if (!songId) return null;
        try {
            const saved = localStorage.getItem(`peaks_${songId}`);
            return saved ? new Float32Array(JSON.parse(saved)) : null;
        } catch { return null; }
    });
    const [statusInfo, setStatusInfo] = useState(() => {
        if (!songId) return { isReal: false, source: 'Analizando...', color: '#64748b' };
        try {
            const saved = localStorage.getItem(`peaks_${songId}`);
            return saved
                ? { isReal: true, source: 'ONDA GUARDADA', color: '#10b981' }
                : { isReal: false, source: 'Analizando...', color: '#64748b' };
        } catch { return { isReal: false, source: 'Analizando...', color: '#64748b' }; }
    });

    const actualDuration = duration || 180;

    // ── Reset when songId changes (after initial mount) ──
    useEffect(() => {
        if (!songId) return;
        try {
            const saved = localStorage.getItem(`peaks_${songId}`);
            if (saved) {
                setPeaks(new Float32Array(JSON.parse(saved)));
                setStatusInfo({ isReal: true, source: 'ONDA GUARDADA', color: '#10b981' });
            } else {
                setPeaks(null);
                setStatusInfo({ isReal: false, source: 'Analizando...', color: '#64748b' });
            }
        } catch (e) {
            console.error("Error cargando picos persistentes:", e);
        }
    }, [songId]);

    useEffect(() => {
        if (!canvasRef.current || !songId) return;
        const displayW = canvasRef.current.offsetWidth || 800;
        const p = new Float32Array(Math.floor(displayW));

        const updateWaveform = () => {
            if (!audioEngine.tracks && !audioEngine._trackMeta) return;

            let bufferToUse = null;
            let bestScore = -1;
            let currentSource = 'Analizando...';

            let engineTracks = Array.from(audioEngine.tracks.entries());
            if (engineTracks.length === 0 && audioEngine._trackMeta) {
                engineTracks = Array.from(audioEngine._trackMeta.entries());
            }

            const previewTrack = engineTracks.find(([id]) => id.toLowerCase().includes('__previewmix'));

            if (hasPreview) {
                if (previewTrack && previewTrack[1].buffer) {
                    bufferToUse = previewTrack[1].buffer;
                    currentSource = 'MEZCLA TOTAL';
                    bestScore = 5000;
                }
            } else {
                for (const [id, t] of engineTracks) {
                    if (!t.buffer) continue;
                    const name = id.toLowerCase();
                    let score = 10;
                    if (name.includes('__previewmix')) score = 5000;
                    else if (name.includes('click') || name.includes('metronomo')) score = 0;
                    else if (name.includes('guide') || name.includes('guia') || name.includes('cue')) score = 1;
                    else if (name.includes('perc') || name.includes('drum') || name.includes('bat')) score = 30;
                    else if (name.includes('piano') || name.includes('pno') || name.includes('pianosala')) score = 25;
                    else if (name.includes('guit') || name.includes('acous')) score = 20;
                    else if (name.includes('bass') || name.includes('bajo')) score = 15;

                    if (score > bestScore) {
                        bestScore = score;
                        bufferToUse = t.buffer;
                        currentSource = id.split('_').pop();
                    }
                }
            }

            // 2. Si encontramos un buffer, extraemos picos y GUARDAMOS
            if (bufferToUse && bestScore > 1 && typeof bufferToUse.getChannelData === 'function') {
                const data = bufferToUse.getChannelData(0);
                if (!data || data.length === 0) return;
                const step = Math.floor(data.length / p.length);
                const subStep = Math.max(1, Math.floor(step / 15));
                const realP = new Float32Array(p.length);

                for (let i = 0; i < realP.length; i++) {
                    let max = 0;
                    const start = i * step;
                    for (let j = 0; j < step; j += subStep) {
                        const idx = start + j;
                        if (idx >= data.length) break;
                        const v = Math.abs(data[idx]);
                        if (v > max) max = v;
                    }
                    realP[i] = max;
                }

                let m = 0;
                for (let i = 0; i < realP.length; i++) if (realP[i] > m) m = realP[i];
                if (m > 0) {
                    for (let i = 0; i < realP.length; i++) {
                        realP[i] = (realP[i] / m) * 0.9 + 0.1;
                    }
                }

                setPeaks(realP);
                // PERSISTENCIA: Guardar en localStorage (convertido a Array normal para JSON)
                localStorage.setItem(`peaks_${songId}`, JSON.stringify(Array.from(realP)));

                const isMix = currentSource.toLowerCase().includes('previewmix');
                setStatusInfo({
                    isReal: true,
                    source: isMix ? 'ONDA MEZCLA (MÁXIMA PRECISIÓN)' : `ONDA: ${currentSource.toUpperCase()} (SIN MEZCLA)`,
                    color: isMix ? '#00e5ff' : '#ffb300'
                });
            } else {
                // FALLBACK: Clean simulation si no hay nada en caché NI en motor
                if (!peaks) {
                    for (let x = 0; x < p.length; x++) {
                        const base = Math.abs(Math.sin((x / p.length) * Math.PI * 8)) * 0.3;
                        const noise = Math.random() * 0.1;
                        p[x] = base + noise;
                    }
                    setPeaks(p);
                    setStatusInfo({ isReal: false, source: 'Listo para sonar...', color: '#64748b' });
                }
            }
        };

        const timer = setInterval(updateWaveform, 1500); // Menos frecuencia para ahorrar CPU
        updateWaveform();
        return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tracks, duration, songId]);

    // ── Drawing ──────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);

        if (!peaks) return;

        // Subtle background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 12; i++) {
            const gx = (i / 12) * W;
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }

        const centerY = H / 2;
        const playheadX = (progress / actualDuration) * W;

        // Final Waveform Rendering
        for (let x = 0; x < peaks.length; x++) {
            const val = peaks[x];
            const h = Math.max(2, val * (H * 0.85));
            const played = x < playheadX;

            ctx.fillStyle = played ? (statusInfo.isReal ? statusInfo.color : '#00bcd4') : '#334155';
            ctx.fillRect(x, centerY - h / 2, 1, h);
        }

        // Professional Playhead
        const px = Math.min(W - 1, Math.max(0, playheadX));
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(px - 1, 0, 2, H);

        const grad = ctx.createLinearGradient(px - 25, 0, px, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(255, 82, 82, 0.25)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - 25, 0, 25, H);

    }, [progress, actualDuration, peaks, statusInfo]);

    const handleInteraction = async (e) => {
        if (!actualDuration || actualDuration <= 1) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches?.[0]?.clientX);

        if (clientX === undefined) return;

        const x = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const targetTime = pct * actualDuration;

        // Optimización visual inmediata
        // setProgress(targetTime); 

        await audioEngine.seek(targetTime);
    };

    const [isDragging, setIsDragging] = useState(false);

    const onStart = (e) => {
        setIsDragging(true);
        handleInteraction(e);
    };

    const onMove = (e) => {
        if (isDragging) handleInteraction(e);
    };

    const onEnd = () => {
        setIsDragging(false);
    };

    return (
        <div
            onMouseDown={onStart}
            onMouseMove={onMove}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchStart={onStart}
            onTouchMove={onMove}
            onTouchEnd={onEnd}
            className="professional-scrubber"
            style={{
                position: 'relative', width: '100%', height: '100%', cursor: 'pointer',
                borderRadius: '12px', overflow: 'hidden', background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                userSelect: 'none', touchAction: 'none' // Evita scroll al mover en movil
            }}
        >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

            {/* Timecodes */}
            <div style={{ position: 'absolute', top: '6px', left: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px', pointerEvents: 'none' }}>
                {formatTime(progress)}
            </div>
            <div style={{ position: 'absolute', bottom: '6px', right: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px', pointerEvents: 'none' }}>
                {formatTime(actualDuration)}
            </div>

            {/* Source Tag */}
            <div style={{
                position: 'absolute', top: '6px', right: '12px',
                color: statusInfo.color, fontSize: '8px', fontWeight: '900',
                textTransform: 'uppercase', letterSpacing: '1px',
                padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)',
                pointerEvents: 'none'
            }}>
                {statusInfo.source}
            </div>
        </div>
    );
}

function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
