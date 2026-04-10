/**
 * ProgressBar.jsx
 * ──────────────────────────────────────────────────────────────────
 * Componente AISLADO para el progreso del audio.
 * 
 * CÓMO FUNCIONA:
 *  - Se suscribe directamente al AudioEngine mediante addProgressListener.
 *  - Actualiza el DOM de forma directa (refs) SIN llamar a setState.
 *  - Limita la actualización visual a ~15 FPS para reducir carga en tablets.
 *  - CERO re-renders del componente raíz Multitrack cuando el tiempo cambia.
 * ──────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { audioEngine } from '../AudioEngine';

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const ProgressBar = React.memo(({ duration, onSeek }) => {
    const fillRef = useRef(null);
    const timeRef = useRef(null);
    const trackRef = useRef(null);

    // Internal frame limiter: ~15 FPS (one update every 66ms)
    const lastUpdateRef = useRef(0);
    const FRAME_INTERVAL = 66; // ms

    useEffect(() => {
        const onProgress = (t) => {
            const now = performance.now();
            if (now - lastUpdateRef.current < FRAME_INTERVAL) return;
            lastUpdateRef.current = now;

            const dur = duration || 1;
            const pct = Math.min(100, (t / dur) * 100);

            // Direct DOM manipulation — ZERO React state changes
            if (fillRef.current) {
                fillRef.current.style.width = `${pct}%`;
            }
            if (timeRef.current) {
                timeRef.current.textContent = `${formatTime(t)} / ${formatTime(dur)}`;
            }
        };

        audioEngine.addProgressListener(onProgress);
        return () => audioEngine.removeProgressListener(onProgress);
    }, [duration]);

    const handleClick = useCallback((e) => {
        if (!trackRef.current || !onSeek) return;
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(pct * (duration || 0));
    }, [duration, onSeek]);

    const handleTouchEnd = useCallback((e) => {
        if (!trackRef.current || !onSeek) return;
        const touch = e.changedTouches[0];
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        onSeek(pct * (duration || 0));
    }, [duration, onSeek]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px', padding: '0 4px' }}>
            {/* Time Display */}
            <span
                ref={timeRef}
                style={{
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    color: 'white',
                    opacity: 0.9,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.05em'
                }}
            >
                0:00 / {formatTime(duration)}
            </span>

            {/* Seeker Track */}
            <div
                ref={trackRef}
                onClick={handleClick}
                onTouchEnd={handleTouchEnd}
                style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    position: 'relative',
                    touchAction: 'none',
                }}
            >
                {/* Fill bar — updated directly via ref, no React */}
                <div
                    ref={fillRef}
                    style={{
                        height: '100%',
                        width: '0%',
                        background: 'linear-gradient(90deg, #00d2d3, #00bcd4)',
                        borderRadius: '3px',
                        transition: 'width 0.08s linear',
                        pointerEvents: 'none',
                    }}
                />
            </div>
        </div>
    );
});

export default ProgressBar;
