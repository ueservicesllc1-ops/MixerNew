import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { audioEngine } from '../AudioEngine';
import { NativeEngine } from '../NativeEngine';

function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** JUCE desktop: no hay `audioEngine.ctx`; mismo patrón que ProgressBar.jsx */
async function decodeArrayBufferToAudioBuffer(ab) {
    const slice = ab instanceof ArrayBuffer ? ab.slice(0) : ab;
    if (audioEngine?.ctx && typeof audioEngine.ctx.decodeAudioData === 'function') {
        return await audioEngine.ctx.decodeAudioData(slice);
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) throw new Error('No decodeAudioData context available');
    const ctx = new AC();
    try {
        return await ctx.decodeAudioData(slice);
    } finally {
        if (typeof ctx.close === 'function') {
            try { await ctx.close(); } catch { /* ignore */ }
        }
    }
}

export default function WaveformCanvas({ songId, tracks, duration, hasPreview, suppressHeavyWork, markers = [], onUpdateMarkers }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const lastDragSecRef = useRef(0);
    const actualDurationRef = useRef(1);
    const [peaks, setPeaks] = useState(null);
    const [peakDuration, setPeakDuration] = useState(0);
    const [statusInfo, setStatusInfo] = useState({ isReal: false, source: 'Analizando...', color: '#64748b' });
    const [zoom, setZoom] = useState(1);
    
    // Markers Context Menu State
    const [contextMenu, setContextMenu] = useState(null);

    const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
    const isZionElectronDesktop = typeof window !== 'undefined'
        && !!window.zionNative
        && !window.Capacitor?.isNativePlatform?.();
    const actualDuration = (isNative || isZionElectronDesktop)
        ? ((duration && duration > 0)
            ? duration
            : (peakDuration > 0 ? peakDuration : Math.max(audioEngine.getCurrentTime() || 0, 1)))
        : (duration || 180);

    actualDurationRef.current = actualDuration;

    // Load peaks from cache
    useEffect(() => {
        if (!songId) return;
        setPeakDuration(0);
        try {
            localStorage.removeItem(`peaks_${songId}`);
            localStorage.removeItem(`peaks_v2_${songId}`);
            localStorage.removeItem(`peaks_v3_${songId}`);
        } catch {}
        const saved = localStorage.getItem(`peaks_v4_${songId}`);
        if (saved) {
            try {
                const arr = JSON.parse(saved);
                if (Array.isArray(arr) && arr.length >= 100) {
                    setPeaks(new Float32Array(arr));
                    setStatusInfo({ isReal: true, source: 'ONDA REAL', color: '#10b981' });
                    return;
                }
            } catch {}
        }
        setPeaks(null);
        setStatusInfo({ isReal: false, source: 'Analizando...', color: '#64748b' });
    }, [songId]);

    // Periodically try to analyze buffers if not loaded yet
    useEffect(() => {
        if (!songId) return;
        if (suppressHeavyWork) return;
        // Esperar a que Multitrack termine de cargar todos los stems de ESTA canción (no placeholders)
        if (!isNative && !isZionElectronDesktop) {
            if (!tracks || tracks.length === 0 || tracks.some(t => t.isPlaceholder)) {
                return;
            }
        }

        const collectBuffersFromEngine = () => {
            const buffers = [];
            const prefix = `${songId}_`;
            const pushFromMap = (map) => {
                if (!map || map.size === 0) return;
                for (const [id, t] of map.entries()) {
                    const key = String(id);
                    if (!key.startsWith(prefix)) continue;
                    if (!t || !t.buffer || typeof t.buffer.getChannelData !== 'function') continue;
                    buffers.push({ id: key, buf: t.buffer });
                }
            };
            if (isNative) {
                pushFromMap(audioEngine._trackMeta);
            } else {
                pushFromMap(audioEngine.tracks);
                if (buffers.length === 0) {
                    pushFromMap(audioEngine._trackMeta);
                }
            }
            return buffers;
        };

        const buildPeaksFromBuffers = (buffersList) => {
            if (!buffersList || buffersList.length === 0) return;

            // Excluir Click, Guía y Cues para que la onda refleje únicamente la música real
            const musicalBuffers = buffersList.filter(b => {
                const s = String(b.id || '').toLowerCase();
                return !s.includes('__previewmix') &&
                       !s.includes('click') && !s.includes('clic') && !s.includes('metronom') &&
                       !s.includes('guia') && !s.includes('guía') && !s.includes('guide') && !s.includes('cue');
            });

            const previewMix = buffersList.find(b => String(b.id || '').toLowerCase().includes('__previewmix'));
            // Preferir la suma de todos los stems musicales si están en RAM; si solo hay PreviewMix (ej. Desktop), usar PreviewMix
            const finalStems = musicalBuffers.length > 0
                ? musicalBuffers
                : (previewMix ? [previewMix] : buffersList);

            const displayW = 1000;
            const realP = new Float32Array(displayW);

            const stemChannels = finalStems.map(s => {
                try {
                    const ch0 = s.buf.getChannelData(0);
                    const ch1 = s.buf.numberOfChannels > 1 ? s.buf.getChannelData(1) : ch0;
                    return {
                        ch0,
                        ch1,
                        len: s.buf.length,
                        duration: s.buf.duration || 0
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            if (stemChannels.length === 0) return;

            const maxLen = Math.max(...stemChannels.map(s => s.len));
            const maxDur = Math.max(...stemChannels.map(s => s.duration));
            if (maxLen <= 0) return;

            const step = Math.max(1, Math.floor(maxLen / displayW));
            const sampleStride = Math.max(1, Math.floor(step / 64));

            for (let i = 0; i < displayW; i++) {
                let sumSq = 0;
                let count = 0;
                for (let j = 0; j < step; j += sampleStride) {
                    const idx = i * step + j;
                    if (idx >= maxLen) break;

                    let mixL = 0;
                    let mixR = 0;
                    for (let s = 0; s < stemChannels.length; s++) {
                        const sc = stemChannels[s];
                        if (idx < sc.len) {
                            mixL += sc.ch0[idx];
                            mixR += sc.ch1[idx];
                        }
                    }
                    const mono = (mixL + mixR) * 0.5;
                    sumSq += mono * mono;
                    count++;
                }
                realP[i] = count > 0 ? Math.sqrt(sumSq / count) : 0;
            }

            let m = 0;
            for (let i = 0; i < realP.length; i++) {
                if (realP[i] > m) m = realP[i];
            }
            if (m > 0) {
                for (let i = 0; i < realP.length; i++) {
                    realP[i] = Math.min(1, realP[i] / m);
                }
            }

            setPeakDuration(maxDur);
            setPeaks(realP);
            try {
                localStorage.setItem(`peaks_v4_${songId}`, JSON.stringify(Array.from(realP)));
            } catch {}
            setStatusInfo({ isReal: true, source: `ONDA REAL (${finalStems.length} PISTAS)`, color: '#00e5ff' });
        };

        const updateWaveform = async () => {
            const engineBuffers = collectBuffersFromEngine();
            if (engineBuffers.length > 0) {
                buildPeaksFromBuffers(engineBuffers);
                return;
            }

            // Desktop / Native: __PreviewMix desde disco + decodeAudioData
            if ((isNative || window.zionNative) && !suppressHeavyWork) {
                try {
                    await new Promise((r) => setTimeout(r, 0));

                    // Electron: el motor va por JUCE (sin buffers en audioEngine); no retrasar el I/O con idle largo.
                    await new Promise((r) => {
                        if (isZionElectronDesktop) {
                            setTimeout(r, 80);
                            return;
                        }
                        if (typeof requestIdleCallback !== 'undefined') {
                            requestIdleCallback(() => r(), { timeout: 60000 });
                        } else {
                            setTimeout(r, 4000);
                        }
                    });

                    let ab = null;
                    if (window.zionNative?.readWaveformStemBuffer) {
                        try {
                            const rawBuf = await window.zionNative.readWaveformStemBuffer(songId);
                            if (rawBuf) {
                                ab = rawBuf instanceof ArrayBuffer ? rawBuf.slice(0)
                                    : (rawBuf.buffer && typeof rawBuf.byteLength === 'number'
                                        ? rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength)
                                        : null);
                            }
                        } catch (e) {
                            console.warn('[WAVEFORM] readWaveformStemBuffer', e);
                        }
                    }
                    if (!ab && window.zionNative?.readEncryptedTrack) {
                        const candidates = [
                            `${songId}___PreviewMix.mp3`,
                            `${songId}___PreviewMix.flac`,
                            `${songId}___PreviewMix`,
                        ];
                        for (const filename of [...new Set(candidates)]) {
                            console.log(`[WAVEFORM] Desktop read try: ${filename}`);
                            const buffer = await window.zionNative.readEncryptedTrack(filename);
                            if (buffer) {
                                ab = buffer instanceof ArrayBuffer ? buffer.slice(0)
                                    : (buffer.buffer && typeof buffer.byteLength === 'number'
                                        ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
                                        : null);
                                if (ab) break;
                            }
                        }
                    }
                    if (!ab && isNative) {
                        const raw = await NativeEngine.readTrackBlob(songId, '__PreviewMix');
                        if (raw) {
                            ab = raw instanceof ArrayBuffer ? raw.slice(0) : await raw.arrayBuffer();
                        }
                    }

                    if (ab) {
                        const bufferToUse = await decodeArrayBufferToAudioBuffer(ab);
                        if (bufferToUse) buildPeaksFromBuffers([{ id: '__PreviewMix', buf: bufferToUse }]);
                    }
                } catch (e) {
                    console.warn('[WAVEFORM] decode failed', e);
                }
            }
        };

        if (!peaks) {
            if (!isNative) {
                const timer = setInterval(updateWaveform, 2000);
                updateWaveform();
                return () => clearInterval(timer);
            }

            // Nativo: no disparar al montar (coincide con swap/GC). Solo cuando la barra entra en vista
            // o un fallback tardío; una sola pasada fuerte, sin intervalos cada 2s.
            let cancelled = false;
            let io = null;
            let fallbackTimer = null;
            let ran = false;

            const runOnce = () => {
                if (cancelled || ran) return;
                ran = true;
                void updateWaveform();
            };

            const arm = () => {
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(
                        () => {
                            setTimeout(() => {
                                if (!cancelled) runOnce();
                            }, 2500);
                        },
                        { timeout: 45000 }
                    );
                } else {
                    setTimeout(runOnce, 12000);
                }
            };

            const el = containerRef.current;
            if (el && typeof IntersectionObserver !== 'undefined') {
                io = new IntersectionObserver(
                    (entries) => {
                        if (entries.some((e) => e.isIntersecting && e.intersectionRatio > 0)) {
                            if (fallbackTimer) {
                                clearTimeout(fallbackTimer);
                                fallbackTimer = null;
                            }
                            arm();
                            if (io) io.disconnect();
                        }
                    },
                    { root: null, rootMargin: '120px', threshold: [0, 0.05] }
                );
                io.observe(el);
            }

            fallbackTimer = setTimeout(() => {
                fallbackTimer = null;
                arm();
            }, 22000);

            return () => {
                cancelled = true;
                if (io) io.disconnect();
                if (fallbackTimer) clearTimeout(fallbackTimer);
            };
        }
    }, [songId, tracks, peaks, isNative, isZionElectronDesktop, suppressHeavyWork]);

    const isDraggingRef = useRef(false);

    // ── HIGH PERFORMANCE RENDER LOOP (60 FPS) ────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        let rafId;
        let lastFrameTs = 0;
        let lastDrawnT = -1;
        let lastW = -1;
        let lastH = -1;

        const render = (ts) => {
            // Limitar a ~24 FPS y no redibujar si nada cambió (iPad / equipos lentos)
            if (ts && ts - lastFrameTs < 40) {
                rafId = requestAnimationFrame(render);
                return;
            }
            const W = canvas.offsetWidth;
            const H = canvas.offsetHeight;
            const currentT = audioEngine.isDragging
                ? audioEngine.dragTime
                : audioEngine.getCurrentTime();
            if (currentT === lastDrawnT && W === lastW && H === lastH) {
                rafId = requestAnimationFrame(render);
                return;
            }
            lastFrameTs = ts || 0;
            lastDrawnT = currentT;
            lastW = W;
            lastH = H;
            if (canvas.width !== W || canvas.height !== H) {
                canvas.width = W;
                canvas.height = H;
            }

            // Background
            ctx.fillStyle = '#1e293b'; 
            ctx.fillRect(0, 0, W, H);

            // Draw Ruler (Time Guide)
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, W, 22);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px "Outfit", sans-serif';
            ctx.textAlign = 'center';

            const pxPerSec = W / actualDuration;
            let tickStep = 60; // default 1 tick per min
            if (pxPerSec > 2) tickStep = 30; // every 30s
            if (pxPerSec > 5) tickStep = 10; // every 10s
            if (pxPerSec > 20) tickStep = 5;  // every 5s
            if (pxPerSec > 80) tickStep = 1;  // every 1s

            for (let s = 0; s < actualDuration; s += tickStep) {
                const x = s * pxPerSec;
                // Main tick
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(x, 0, 1, 8);
                ctx.fillText(formatTime(s), x, 18);
                
                // Sub ticks
                if (tickStep >= 5) {
                    const subStep = tickStep === 60 ? 10 : tickStep === 30 ? 5 : 1;
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    for (let subs = s + subStep; subs < s + tickStep; subs += subStep) {
                        const sx = subs * pxPerSec;
                        ctx.fillRect(sx, 0, 1, 4);
                    }
                }
            }

            if (peaks) {
                const playheadX = Math.max(0, Math.min(W, (currentT / actualDuration) * W));
                const centerY = (H + 22) / 2; // Offset below ruler
                const maxWaveH = H - 22;
                
                // High contrast on dark bar
                const wavePlayed = statusInfo.isReal ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)';
                const waveUnplayed = 'rgba(255,255,255,0.28)';

                // Use gradient to split colors at playhead exactly
                const progressPct = Math.max(0, Math.min(1, currentT / actualDuration));
                const gradient = ctx.createLinearGradient(0, 0, W, 0);
                
                // Fallbacks if progress is 0 or 1
                if (progressPct <= 0) {
                    gradient.addColorStop(0, waveUnplayed);
                    gradient.addColorStop(1, waveUnplayed);
                } else if (progressPct >= 1) {
                    gradient.addColorStop(0, wavePlayed);
                    gradient.addColorStop(1, wavePlayed);
                } else {
                    gradient.addColorStop(0, wavePlayed);
                    gradient.addColorStop(progressPct, wavePlayed);
                    gradient.addColorStop(progressPct + 0.0001, waveUnplayed);
                    gradient.addColorStop(1, waveUnplayed);
                }

                ctx.beginPath();
                
                // Top half curve
                ctx.moveTo(0, centerY);
                for (let x = 0; x < peaks.length; x++) {
                    const canvasX = (x / peaks.length) * W;
                    const val = peaks[x];
                    const h = Math.max(2, val * maxWaveH * 0.9);
                    ctx.lineTo(canvasX, centerY - h / 2);
                }
                
                // Bottom half curve
                for (let x = peaks.length - 1; x >= 0; x--) {
                    const canvasX = (x / peaks.length) * W;
                    const val = peaks[x];
                    const h = Math.max(2, val * maxWaveH * 0.9);
                    ctx.lineTo(canvasX, centerY + h / 2);
                }
                
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                // Playhead
                const px = Math.round(playheadX);
                ctx.fillStyle = '#facc15';
                ctx.fillRect(px - 2, 0, 4, H);
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

    const handleWheel = (e) => {
        if (e.deltaY < 0) {
            setZoom(z => Math.min(10, z + 0.4));
        } else if (e.deltaY > 0) {
            setZoom(z => Math.max(1, z - 0.4));
        }
    };

    // Android: Handle native long press specifically since touch events steal right click
    useEffect(() => {
        let timer;
        const el = containerRef.current;
        if (!el) return;

        const onTouchStart = (e) => {
            if (e.touches.length === 1) {
                timer = setTimeout(() => {
                    const t = handleInteraction(e.touches[0].clientX);
                    setContextMenu({ x: e.touches[0].clientX, y: e.touches[0].clientY - 50, time: t });
                }, 600); // 600ms = long press
            }
        };

        const onTouchMove = () => clearTimeout(timer);
        const onTouchEnd = () => clearTimeout(timer);

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            clearTimeout(timer);
        };
    }, [actualDuration]);

    const handleContextMenu = (e) => {
        e.preventDefault(); // Block browser right-click menu
        const t = handleInteraction(e.clientX);
        setContextMenu({ x: e.clientX, y: e.clientY - 50, time: t });
    };

    const addMarker = (label, color) => {
        if (!contextMenu || !onUpdateMarkers) return;
        const newMarker = { label, color, time: contextMenu.time, id: Date.now().toString() };
        const updated = [...markers, newMarker].sort((a, b) => a.time - b.time);
        onUpdateMarkers(updated);
        setContextMenu(null);
    };

    const removeMarker = (e, id) => {
        e.stopPropagation();
        if (!onUpdateMarkers) return;
        if (window.confirm('¿Borrar marcador?')) {
            onUpdateMarkers(markers.filter(m => m.id !== id));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            
            {/* Context Menu Modal via Portal to escape transform/overflow traps */}
            {contextMenu && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, pointerEvents: 'auto' }}>
                    <div style={{ position: 'absolute', inset: 0 }} onClick={() => setContextMenu(null)} />
                    <div style={{ 
                        position: 'absolute', left: Math.min(contextMenu.x, window.innerWidth - 220), top: Math.max(10, Math.min(contextMenu.y, window.innerHeight - 300)), 
                        background: '#1e293b', border: '1px solid #475569', borderRadius: '12px', padding: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.8)', width: '210px'
                    }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textAlign: 'center' }}>
                            Añadir marcador en {formatTime(contextMenu.time)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <button onClick={() => addMarker('Intro', '#06b6d4')} style={{ background: '#06b6d4', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Intro</button>
                            <button onClick={() => addMarker('Verso', '#3b82f6')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Verso</button>
                            <button onClick={() => addMarker('Pre-Coro', '#8b5cf6')} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>PreCoro</button>
                            <button onClick={() => addMarker('Coro', '#ef4444')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Coro</button>
                            <button onClick={() => addMarker('Instrumental', '#f59e0b')} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', gridColumn: 'span 2' }}>Instrumental</button>
                            <button onClick={() => addMarker('Puente', '#ec4899')} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Puente</button>
                            <button onClick={() => addMarker('Final', '#10b981')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Final</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div style={{ flex: 1, position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#0f172a', display: 'flex' }} onWheel={handleWheel}>
                
                <div 
                    ref={containerRef}
                    onContextMenu={handleContextMenu}
                    style={{
                        width: '100%',
                        height: '100%',
                        overflowX: zoom > 1 ? 'auto' : 'hidden',
                        overflowY: 'hidden',
                        position: 'relative'
                    }}
                >
                    <div 
                        onMouseDown={handleMouseDown}
                        style={{
                            position: 'relative',
                            width: `${zoom * 100}%`,
                            height: '100%',
                            cursor: 'crosshair',
                            touchAction: 'none'
                        }}
                    >
                        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                        
                        {/* Markers Overlay on Waveform */}
                        {markers.map((m) => (
                            <div key={m.id} onContextMenu={(e) => removeMarker(e, m.id)} title="Click derecho para borrar" style={{ 
                                position: 'absolute', top: 0, bottom: 0, left: `${(m.time / actualDurationRef.current) * 100}%`, 
                                borderLeft: `2px solid ${m.color}`, zIndex: 15, pointerEvents: 'auto'
                            }}>
                                <div onClick={(e) => { e.stopPropagation(); audioEngine.seek(m.time); }} style={{ 
                                    background: m.color, color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', 
                                    borderBottomRightRadius: '4px', cursor: 'pointer', opacity: 0.9, textTransform: 'uppercase' 
                                }}>
                                    {m.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status overlay */}
                <div style={{ position: 'absolute', top: '25px', left: '10px', color: '#fff', fontSize: '10px', opacity: 0.5, pointerEvents: 'none', zIndex: 2 }}>
                    {statusInfo.source}
                </div>

            {/* Zoom Controls Overlay */}
            <div style={{ 
                position: 'absolute', bottom: '6px', right: '6px', 
                background: 'rgba(0,0,0,0.6)', padding: '4px 6px',
                display: 'flex', alignItems: 'center', gap: '5px',
                borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                zIndex: 10, backdropFilter: 'blur(4px)'
            }}>
                <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '4px', lineHeight: 1 }}>-</button>
                <span style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '800' }}>{Math.round(zoom * 10)/10}X</span>
                <button onClick={() => setZoom(z => Math.min(10, z + 0.5))} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '4px', lineHeight: 1 }}>+</button>
            </div>
            {/* Jump Bar Console (Floating Overlay) */}
            {markers && markers.length > 0 && (
                <div style={{ 
                    position: 'absolute', bottom: '0px', left: '0px', width: 'calc(100% - 90px)',
                    display: 'flex', gap: '6px', padding: '6px 8px', 
                    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                    background: 'linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0) 100%)',
                    zIndex: 10, pointerEvents: 'auto', alignItems: 'flex-end', minHeight: '36px'
                }}>
                    {markers.map(m => (
                        <button 
                            key={m.id} 
                            onClick={(e) => { e.stopPropagation(); audioEngine.seek(m.time); }}
                            style={{ 
                                background: `rgba(${parseInt(m.color.slice(1,3), 16)}, ${parseInt(m.color.slice(3,5), 16)}, ${parseInt(m.color.slice(5,7), 16)}, 0.4)`,
                                border: `1px solid rgba(255,255,255,0.25)`, color: '#fff',
                                padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', 
                                cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', transition: 'all 0.2s', flexShrink: 0,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)'
                            }}
                            onMouseEnter={e => { e.target.style.background = m.color; e.target.style.color = '#fff'; }}
                            onMouseLeave={e => { 
                                e.target.style.background = `rgba(${parseInt(m.color.slice(1,3), 16)}, ${parseInt(m.color.slice(3,5), 16)}, ${parseInt(m.color.slice(5,7), 16)}, 0.4)`; 
                                e.target.style.color = '#fff'; 
                            }}
                        >
                            {m.label} <span style={{ opacity: 0.7, fontSize: '8px', marginLeft: '4px'}}>{formatTime(m.time)}</span>
                        </button>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}
