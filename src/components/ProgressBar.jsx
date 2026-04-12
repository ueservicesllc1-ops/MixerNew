/**
 * ProgressBar.jsx — Zion transport scrubber.
 * Web: audioEngine + light RAF for fill (legacy Web Audio).
 * Native (NextGen): NextGenMixerBridge.getSnapshot() only @ ~135ms — no heavy RAF logic.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { audioEngine } from '../AudioEngine';
import {
    NEXTGEN_UI_POLL_MS,
    fetchNextGenPlaybackSnapshot,
} from '../nextGenPlaybackUi';

function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function effectiveTrackDur(snapshotDur, durationProp) {
    if (typeof snapshotDur === 'number' && snapshotDur > 1) return snapshotDur;
    return durationProp > 1 ? durationProp : 1;
}

/** Deterministic fake overview peaks — no audio decode (Zion-style strip on Android). */
function makeZionFakePeaks(seedKey, count) {
    const s = String(seedKey || 'default');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    const peaks = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        h = Math.imul(h ^ (i + 1), 2246822519);
        const t = ((h >>> 0) % 1000) / 1000;
        peaks[i] = 0.18 + t * 0.82;
    }
    return peaks;
}

export const ProgressBar = React.memo(
    ({ duration: durationProp, onSnapshot, nativeUi, disabled, songId }) => {
        const fillRef = useRef(null);
        const timeRef = useRef(null);
        const trackRef = useRef(null);
        const canvasRef = useRef(null);
        const fakePeaksRef = useRef(null);
        const isDraggingRef = useRef(false);
        const lastSnapshotRef = useRef({ positionSec: 0, durationSec: 0 });
        const lastDurationLogRef = useRef(null);
        const lastPosLogAtRef = useRef(0);
        const lastPctRef = useRef(0);
        const seekMoveLogLastAtRef = useRef(0);
        const SEEK_MOVE_LOG_MIN_MS = 120;

        const logNativeSeekUi = (message, detail) => {
            if (!nativeUi || typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) return;
            if (detail !== undefined) console.log(message, detail);
            else console.log(message);
        };

        const logSeekMoveThrottled = (detail) => {
            if (!nativeUi || typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) return;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now - seekMoveLogLastAtRef.current < SEEK_MOVE_LOG_MIN_MS) return;
            seekMoveLogLastAtRef.current = now;
            console.log('[NEXTGEN_UI] seek move', detail);
        };

        const redrawZion = useCallback(() => {
            if (!nativeUi) return;
            const canvas = canvasRef.current;
            const wrap = trackRef.current;
            const peaks = fakePeaksRef.current;
            if (!canvas || !wrap || !peaks || !peaks.length) return;
            const rect = wrap.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            if (w < 4 || h < 4) return;
            const pct = Math.max(0, Math.min(1, lastPctRef.current));
            const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, w, h);
            const playheadX = Math.max(0, Math.min(w, pct * w));
            const n = peaks.length;
            const barW = w / n;
            const centerY = h / 2;
            for (let i = 0; i < n; i++) {
                const x = (i / n) * w;
                const val = peaks[i];
                const bh = Math.max(2, val * (h * 0.8));
                ctx.fillStyle = x < playheadX ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.28)';
                ctx.fillRect(x, centerY - bh / 2, Math.ceil(barW) + 0.5, bh);
            }
            const px = Math.round(playheadX);
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#facc15';
            ctx.fillRect(px - 2, 0, 4, h);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fffef0';
            ctx.fillRect(px - 1, 0, 2, h);
        }, [nativeUi]);

        useEffect(() => {
            if (!nativeUi) return undefined;
            fakePeaksRef.current = makeZionFakePeaks(songId || 'default', 128);
            const id = requestAnimationFrame(() => redrawZion());
            return () => cancelAnimationFrame(id);
        }, [nativeUi, songId, redrawZion]);

        useEffect(() => {
            if (!nativeUi || disabled) return undefined;
            const el = trackRef.current;
            if (!el || typeof ResizeObserver === 'undefined') return undefined;
            const ro = new ResizeObserver(() => redrawZion());
            ro.observe(el);
            return () => ro.disconnect();
        }, [nativeUi, disabled, redrawZion]);

        // ── Native: controlled polling (no RAF for snapshot / scrub math) ──
        useEffect(() => {
            if (!nativeUi || disabled) return undefined;

            let cancelled = false;
            const tick = async () => {
                if (cancelled || isDraggingRef.current) return;
                try {
                    const s = await fetchNextGenPlaybackSnapshot();
                    if (cancelled || isDraggingRef.current) return;
                    lastSnapshotRef.current = s;
                    const dur = effectiveTrackDur(s.durationSec, durationProp);
                    const pos = Math.max(0, Math.min(dur, s.positionSec));
                    const pct01 = dur > 0 ? pos / dur : 0;
                    lastPctRef.current = pct01;
                    redrawZion();
                    if (timeRef.current) {
                        timeRef.current.textContent = `${formatTime(pos)} / ${formatTime(dur)}`;
                    }
                    onSnapshot?.({ positionSec: pos, durationSec: s.durationSec });

                    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                    if (now - lastPosLogAtRef.current > 400) {
                        lastPosLogAtRef.current = now;
                        console.log('[NEXTGEN_UI] position update', pos.toFixed(3));
                    }
                    if (
                        typeof s.durationSec === 'number' &&
                        s.durationSec > 1 &&
                        s.durationSec !== lastDurationLogRef.current
                    ) {
                        lastDurationLogRef.current = s.durationSec;
                        console.log('[NEXTGEN_UI] duration', s.durationSec.toFixed(3));
                    }
                } catch {
                    /* ignore */
                }
            };

            tick();
            const id = setInterval(tick, NEXTGEN_UI_POLL_MS);
            return () => {
                cancelled = true;
                clearInterval(id);
            };
        }, [nativeUi, disabled, onSnapshot, durationProp, redrawZion]);

        // ── Web: RAF only updates visuals from audioEngine (Web Audio path) ──
        useEffect(() => {
            if (nativeUi) return undefined;
            let rafId;
            const updateVisuals = () => {
                if (!isDraggingRef.current) {
                    const currentT = audioEngine.getCurrentTime();
                    const dur = durationProp || 1;
                    const pct = Math.min(100, (currentT / dur) * 100);
                    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
                    if (timeRef.current) {
                        timeRef.current.textContent = `${formatTime(currentT)} / ${formatTime(durationProp)}`;
                    }
                }
                rafId = requestAnimationFrame(updateVisuals);
            };
            rafId = requestAnimationFrame(updateVisuals);
            return () => cancelAnimationFrame(rafId);
        }, [durationProp, nativeUi]);

        const updatePreview = (clientX) => {
            if (!trackRef.current) return 0;
            const rect = trackRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const dur = nativeUi ? effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp) : durationProp || 0;
            const previewTime = pct * (dur || 1);
            if (nativeUi) {
                lastPctRef.current = pct;
                redrawZion();
            } else if (fillRef.current) {
                fillRef.current.style.width = `${pct * 100}%`;
            }
            if (timeRef.current) {
                timeRef.current.textContent = `${formatTime(previewTime)} / ${formatTime(dur)}`;
            }
            return previewTime;
        };

        const handleMouseDown = (e) => {
            const calculateTime = (clientX) => {
                if (!trackRef.current) return 0;
                const rect = trackRef.current.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const dur = nativeUi ? effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp) : durationProp || 0;
                return pct * (dur || 0);
            };

            const initialTime = calculateTime(e.clientX);
            isDraggingRef.current = true;
            audioEngine.startDrag(initialTime);
            logNativeSeekUi('[NEXTGEN_UI] seek start (drag start)', initialTime.toFixed(3));
            updatePreview(e.clientX);

            const onMouseMove = (moveEvent) => {
                const t = calculateTime(moveEvent.clientX);
                audioEngine.updateDrag(t);
                updatePreview(moveEvent.clientX);
                logSeekMoveThrottled(t.toFixed(3));
            };

            const onMouseUp = async (upEvent) => {
                const finalTime = calculateTime(upEvent.clientX);
                logNativeSeekUi('[NEXTGEN_UI] seek end (final position)', finalTime.toFixed(3));
                isDraggingRef.current = false;
                await audioEngine.endDrag(finalTime);
                if (nativeUi) {
                    lastSnapshotRef.current = {
                        ...lastSnapshotRef.current,
                        positionSec: finalTime,
                    };
                    const durAfter = effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp);
                    lastPctRef.current =
                        durAfter > 0 ? Math.max(0, Math.min(1, finalTime / durAfter)) : 0;
                    redrawZion();
                }
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        const handleTouchStart = (e) => {
            if (e.touches.length > 0) {
                isDraggingRef.current = true;
                const rect = trackRef.current.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                const dur = nativeUi ? effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp) : durationProp || 0;
                const t0 = pct * (dur || 0);
                audioEngine.startDrag(t0);
                logNativeSeekUi('[NEXTGEN_UI] seek start (drag start)', t0.toFixed(3));
                updatePreview(e.touches[0].clientX);
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length > 0) {
                const rect = trackRef.current.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                const dur = nativeUi ? effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp) : durationProp || 0;
                const t = pct * (dur || 0);
                audioEngine.updateDrag(t);
                updatePreview(e.touches[0].clientX);
                logSeekMoveThrottled(t.toFixed(3));
            }
        };

        const handleTouchEnd = async (e) => {
            let finalX = 0;
            if (e.changedTouches.length > 0) finalX = e.changedTouches[0].clientX;
            const rect = trackRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (finalX - rect.left) / rect.width));
            const dur = nativeUi ? effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp) : durationProp || 0;
            const finalTime = pct * (dur || 0);
            logNativeSeekUi('[NEXTGEN_UI] seek end (final position)', finalTime.toFixed(3));
            isDraggingRef.current = false;
            await audioEngine.endDrag(finalTime);
            if (nativeUi) {
                lastSnapshotRef.current = {
                    ...lastSnapshotRef.current,
                    positionSec: finalTime,
                };
                const durAfter = effectiveTrackDur(lastSnapshotRef.current.durationSec, durationProp);
                lastPctRef.current =
                    durAfter > 0 ? Math.max(0, Math.min(1, finalTime / durAfter)) : 0;
                redrawZion();
            }
        };

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: nativeUi ? '100%' : undefined,
                    flex: nativeUi ? 1 : undefined,
                    minHeight: nativeUi ? 0 : undefined,
                    gap: nativeUi ? '6px' : '4px',
                    padding: nativeUi ? '6px 10px 8px' : '0 4px',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                }}
            >
                <span
                    ref={timeRef}
                    style={{
                        fontSize: '0.82rem',
                        fontWeight: '900',
                        color: '#fff',
                        opacity: 0.95,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '0.05em',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        flexShrink: 0,
                    }}
                >
                    0:00 / {formatTime(durationProp)}
                </span>

                {nativeUi ? (
                    <div
                        ref={trackRef}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{
                            width: '100%',
                            flex: 1,
                            minHeight: 56,
                            position: 'relative',
                            borderRadius: 10,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            touchAction: 'none',
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            aria-hidden
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                display: 'block',
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                ) : (
                    <div
                        ref={trackRef}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{
                            width: '100%',
                            height: '10px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        <div
                            ref={fillRef}
                            style={{
                                height: '100%',
                                width: '0%',
                                background: 'linear-gradient(90deg, #00d2d3, #0097a7)',
                                boxShadow: '0 0 10px rgba(0,210,211,0.5)',
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

export default ProgressBar;
