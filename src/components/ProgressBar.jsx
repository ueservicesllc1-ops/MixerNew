/**
 * ProgressBar.jsx
 * ──────────────────────────────────────────────────────────────────
 * Versión DAW-Grade (PRO): Interpolación a 60 FPS + Seek Responsivo.
 * 
 * CARACTERÍSTICAS:
 *  - Loop interno de 60 FPS (requestAnimationFrame).
 *  - Interpolación: Calcula la posición suave entre ticks del motor nativo.
 *  - Seek Inmediato: Visualización instantánea al tocar la barra.
 *  - Aislamiento Total: Cero re-renders del padre.
 * ──────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { audioEngine } from '../AudioEngine';

function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const ProgressBar = React.memo(({ duration, onSeek }) => {
    const fillRef = useRef(null);
    const timeRef = useRef(null);
    const trackRef = useRef(null);
    
    // Boolean to prevent the raf loop from overriding the user's finger/mouse
    const isDraggingRef = useRef(false);

    useEffect(() => {
        let rafId;

        const updateVisuals = () => {
            // Only update from engine if NOT dragging
            if (!isDraggingRef.current) {
                const currentT = audioEngine.getCurrentTime();
                
                const dur = duration || 1;
                const pct = Math.min(100, (currentT / dur) * 100);
                
                if (fillRef.current) fillRef.current.style.width = `${pct}%`;
                if (timeRef.current) {
                    timeRef.current.textContent = `${formatTime(currentT)} / ${formatTime(duration)}`;
                }
            }
            rafId = requestAnimationFrame(updateVisuals);
        };

        rafId = requestAnimationFrame(updateVisuals);
        return () => cancelAnimationFrame(rafId);
    }, [duration]);

    // Internal helper to calculate and apply visual feedback immediately
    const updatePreview = (clientX) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const previewTime = pct * (duration || 0);
        
        if (fillRef.current) fillRef.current.style.width = `${pct * 100}%`;
        if (timeRef.current) {
            timeRef.current.textContent = `${formatTime(previewTime)} / ${formatTime(duration)}`;
        }
        return previewTime;
    };

    const handleMouseDown = (e) => {
        const calculateTime = (clientX) => {
            if (!trackRef.current) return 0;
            const rect = trackRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return pct * (duration || 0);
        };

        const initialTime = calculateTime(e.clientX);
        audioEngine.startDrag(initialTime);
        
        const onMouseMove = (moveEvent) => {
            audioEngine.updateDrag(calculateTime(moveEvent.clientX));
        };
        
        const onMouseUp = (upEvent) => {
            const finalTime = calculateTime(upEvent.clientX);
            audioEngine.endDrag(finalTime);
            
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleTouchStart = (e) => {
        if (e.touches.length > 0) {
            const rect = trackRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
            audioEngine.startDrag(pct * (duration || 0));
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length > 0) {
            const rect = trackRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
            audioEngine.updateDrag(pct * (duration || 0));
        }
    };

    const handleTouchEnd = (e) => {
        let finalX = 0;
        if (e.changedTouches.length > 0) finalX = e.changedTouches[0].clientX;
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (finalX - rect.left) / rect.width));
        audioEngine.endDrag(pct * (duration || 0));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px', padding: '0 4px', userSelect: 'none' }}>
            <span
                ref={timeRef}
                style={{
                    fontSize: '0.82rem',
                    fontWeight: '900',
                    color: '#fff',
                    opacity: 0.95,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.05em',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}
            >
                0:00 / {formatTime(duration)}
            </span>

            <div
                ref={trackRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    width: '100%',
                    height: '10px', // Slightly taller for better touch target
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <div
                    ref={fillRef}
                    style={{
                        height: '100%',
                        width: '0%',
                        background: 'linear-gradient(90deg, #00d2d3, #0097a7)',
                        boxShadow: '0 0 10px rgba(0,210,211,0.5)',
                        pointerEvents: 'none'
                    }}
                />
            </div>
        </div>
    );
});

export default ProgressBar;
