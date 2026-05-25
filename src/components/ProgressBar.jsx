/**
 * ProgressBar.jsx — Zion transport scrubber.
 * Web: audioEngine + light RAF for fill (legacy Web Audio).
 * Native (NextGen): NextGenMixerBridge.getSnapshot() only @ ~135ms — no heavy RAF logic.
 *
 * Android Zion waveform source priority (native only):
 * 1) localStorage peaks_${songId} (if present and valid)
 * 2) Decode __PreviewMix from disk (after session is idle: not during prepare/load or scrub)
 * 3) Synthetic Zion — temporary placeholder only until (1) or (2), or when no preview exists
 *
 * TODO(production): persist waveform peaks to a durable native file (e.g. songId___Waveform.json
 * under Directory.Data) instead of localStorage — WebView storage can be evicted; file cache
 * survives and matches stem filenames like songId___PreviewMix.mp3.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { audioEngine } from '../AudioEngine';
import { NativeEngine } from '../NativeEngine';
import {
    NEXTGEN_UI_POLL_MS,
    fetchNextGenPlaybackSnapshot,
} from '../nextGenPlaybackUi';
import { songMapService, secondsToBarBeat, generateBeatGrid } from '../utils/SongMapService.js';

// localStorage key for bar display preference
const BAR_MODE_KEY = 'zion_bar_display_mode';

function getInitialBarMode() {
    try { return localStorage.getItem(BAR_MODE_KEY) === 'bars'; } catch { return false; }
}
function saveBarMode(isBars) {
    try { localStorage.setItem(BAR_MODE_KEY, isBars ? 'bars' : 'time'); } catch {}
}


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

const PREVIEW_MIX_TRACK = '__PreviewMix';
/** Misma resolución / clave que WaveformCanvas (`peaks_${songId}`). @see TODO Waveform.json */
const PEAK_DISPLAY_WIDTH = 800;

function readCachedPeaksFromStorage(songId) {
    if (!songId) return null;
    try {
        const saved = localStorage.getItem(`peaks_${songId}`);
        if (!saved) return null;
        const arr = JSON.parse(saved);
        if (!Array.isArray(arr) || arr.length < 16) return null;
        return new Float32Array(arr);
    } catch {
        return null;
    }
}

function basenameKey(p) {
    if (!p || typeof p !== 'string') return '';
    const s = String(p).trim();
    const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return i >= 0 ? s.slice(i + 1) : s;
}

function toArrayBufferMaybe(raw) {
    if (!raw) return null;
    if (raw instanceof ArrayBuffer) return raw.slice(0);
    if (raw?.buffer instanceof ArrayBuffer && typeof raw.byteLength === 'number') {
        const offset = raw.byteOffset || 0;
        return raw.buffer.slice(offset, offset + raw.byteLength);
    }
    return null;
}

async function decodeWaveformArrayBuffer(arrayBuffer) {
    if (!arrayBuffer) return null;

    // 1) Reuse engine context if available (web paths).
    if (audioEngine?.ctx && typeof audioEngine.ctx.decodeAudioData === 'function') {
        return await audioEngine.ctx.decodeAudioData(arrayBuffer.slice(0));
    }

    // 2) Desktop native path: create a dedicated decode context.
    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (AC) {
        const ctx = new AC();
        try {
            return await ctx.decodeAudioData(arrayBuffer.slice(0));
        } finally {
            if (typeof ctx.close === 'function') {
                try { await ctx.close(); } catch { /* ignore */ }
            }
        }
    }

    throw new Error('No decodeAudioData context available');
}

/** Picos normalizados desde AudioBuffer (canal 0) — misma lógica que WaveformCanvas. */
function buildPeaksFromAudioBuffer(buffer) {
    const data = buffer.getChannelData(0);
    const realP = new Float32Array(PEAK_DISPLAY_WIDTH);
    const step = Math.max(1, Math.floor(data.length / PEAK_DISPLAY_WIDTH));
    for (let i = 0; i < PEAK_DISPLAY_WIDTH; i++) {
        let max = 0;
        for (let j = 0; j < step; j += Math.max(1, Math.floor(step / 10))) {
            const idx = i * step + j;
            if (idx >= data.length) break;
            const v = Math.abs(data[idx]);
            if (v > max) max = v;
        }
        realP[i] = max;
    }
    let m = 0;
    for (let i = 0; i < realP.length; i++) if (realP[i] > m) m = realP[i];
    if (m > 0) for (let i = 0; i < realP.length; i++) realP[i] /= m;
    return realP;
}

/** Mix 32-bit state (deterministic). */
function mix32(x) {
    let t = x >>> 0;
    t = Math.imul(t ^ (t >>> 16), 2246822519);
    t = Math.imul(t ^ (t >>> 13), 3266489917);
    return (t ^ (t >>> 16)) >>> 0;
}

/** Light neighbor smoothing — continuous silhouette, not stepped bars. */
function smoothPeaks1D(src) {
    const n = src.length;
    if (n < 3) return src;
    const out = new Float32Array(n);
    out[0] = src[0] * 0.65 + src[1] * 0.35;
    for (let i = 1; i < n - 1; i++) {
        out[i] = src[i - 1] * 0.22 + src[i] * 0.56 + src[i + 1] * 0.22;
    }
    out[n - 1] = src[n - 2] * 0.35 + src[n - 1] * 0.65;
    return out;
}

/**
 * Deterministic fake overview — no audio decode.
 * Long-scale “energy” + organic variation; no floor on amplitude so low-energy reads nearly flat.
 * Output is a mirrored silhouette fill, not bar heights.
 */
function makeZionFakePeaks(seedKey, count) {
    const s = String(seedKey || 'default');
    let seed = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) seed = Math.imul(seed ^ s.charCodeAt(i), 16777619);

    const numCtrl = 72;
    const ctrl = new Float32Array(numCtrl + 1);
    for (let c = 0; c <= numCtrl; c++) {
        const pos = c / numCtrl;
        seed = mix32(seed ^ (c * 374761393));
        const r1 = (seed >>> 0) / 0xffffffff;
        seed = mix32(seed + c * 1597334677);
        const r2 = (seed >>> 0) / 0xffffffff;
        const longEnv = 0.5 + 0.5 * Math.sin(pos * Math.PI * 2.8 + r1 * 2.4);
        const medEnv = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(pos * Math.PI * 11 + r2 * 5));
        const whisper = Math.pow(longEnv, 1.35);
        let v = whisper * medEnv * (0.12 + 0.88 * r1);
        v *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(pos * Math.PI * 19 + r2 * 3.7));
        v += 0.04 * r2 * Math.sin(pos * Math.PI * 27 + r1);
        ctrl[c] = Math.max(0, Math.min(1, v));
    }

    const tmp = new Float32Array(count);
    const denom = Math.max(1, count - 1);
    for (let i = 0; i < count; i++) {
        const u = i / denom;
        const t = u * numCtrl;
        const j = Math.min(numCtrl - 1, Math.floor(t));
        const f = t - j;
        const sstep = f * f * (3 - 2 * f);
        const a = ctrl[j];
        const b = ctrl[j + 1];
        let v = a + (b - a) * sstep;
        seed = mix32(seed ^ (i * 2654435761));
        const micro = ((seed >>> 0) % 1024) / 16384;
        v = Math.max(0, Math.min(1, v * (0.97 + micro) + micro * 0.03));
        tmp[i] = v;
    }

    let smoothed = smoothPeaks1D(tmp);
    smoothed = smoothPeaks1D(smoothed);
    return smoothed;
}

/** Closed path: top edge + bottom edge (mirrored) — waveform body, not rectangles. */
function traceZionWaveSilhouette(ctx, peaks, w, h) {
    const n = peaks.length;
    const cy = h * 0.5;
    const scale = h * 0.46;
    ctx.beginPath();
    if (n < 2) {
        ctx.rect(0, cy - 0.35, w, 0.7);
        return;
    }
    const xAt = (i) => (i / (n - 1)) * w;
    ctx.moveTo(xAt(0), cy - peaks[0] * scale);
    for (let i = 1; i < n; i++) {
        ctx.lineTo(xAt(i), cy - peaks[i] * scale);
    }
    for (let i = n - 1; i >= 0; i--) {
        ctx.lineTo(xAt(i), cy + peaks[i] * scale);
    }
    ctx.closePath();
}

export const ProgressBar = React.memo(
    ({
        duration: durationProp,
        onSnapshot,
        nativeUi,
        disabled,
        songId,
        hasPreviewMix = false,
        previewMixLocalPath = '',
        localWaveformFallbacks = [],
    }) => {
        const fillRef = useRef(null);
        const timeRef = useRef(null);
        const barRef = useRef(null);
        const toggleRef = useRef(null);
        const trackRef = useRef(null);
        const canvasRef = useRef(null);
        const fakePeaksRef = useRef(null);
        /** True once this song shows real peaks (cache or decoded); synthetic never replaces it. */
        const realWaveformActiveRef = useRef(false);
        const disabledRef = useRef(disabled);
        disabledRef.current = disabled;
        const isDraggingRef = useRef(false);
        const lastSnapshotRef = useRef({ positionSec: 0, durationSec: 0 });
        const lastDurationLogRef = useRef(null);
        const lastPosLogAtRef = useRef(0);
        const lastPctRef = useRef(0);
        const seekMoveLogLastAtRef = useRef(0);
        const SEEK_MOVE_LOG_MIN_MS = 120;
        const isBarsModeRef = useRef(getInitialBarMode());
        const beatGridRef = useRef(null); // cached { bars: number[] } for current song


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

        const drawPlayheadOnly = (ctx, w, h, pct) => {
            const playheadX = Math.max(0, Math.min(w, pct * w));
            const px = Math.round(playheadX);
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#facc15';
            ctx.fillRect(px - 2, 0, 4, h);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fffef0';
            ctx.fillRect(px - 1, 0, 2, h);
        };

        const redrawZion = useCallback(() => {
            if (!nativeUi) return;
            const canvas = canvasRef.current;
            const wrap = trackRef.current;
            if (!canvas || !wrap) return;
            const rect = wrap.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            if (w < 4 || h < 4) return;
            const peaks = fakePeaksRef.current;
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
            if (!peaks || !peaks.length) {
                drawPlayheadOnly(ctx, w, h, pct);
                return;
            }
            const playheadX = Math.max(0, Math.min(w, pct * w));
            traceZionWaveSilhouette(ctx, peaks, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, playheadX, h);
            ctx.clip();
            traceZionWaveSilhouette(ctx, peaks, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            ctx.fill();
            ctx.restore();

            // Draw bar grid lines if songMap is available (Req 9)
            const grid = beatGridRef.current;
            const snap = lastSnapshotRef.current;
            const totalDur = effectiveTrackDur(snap.durationSec, durationProp);
            if (grid && grid.bars && grid.bars.length > 0 && totalDur > 0) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1;
                for (const barSec of grid.bars) {
                    const bx = Math.round((barSec / totalDur) * w);
                    if (bx < 1 || bx > w - 1) continue;
                    ctx.beginPath();
                    ctx.moveTo(bx, 0);
                    ctx.lineTo(bx, h);
                    ctx.stroke();
                }
                ctx.restore();
            }

            const px = Math.round(playheadX);
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#facc15';
            ctx.fillRect(px - 2, 0, 4, h);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fffef0';
            ctx.fillRect(px - 1, 0, 2, h);
        }, [nativeUi, durationProp]);


        // ── Native Android: Zion waveform (cache → deferred PreviewMix decode → synthetic placeholder) ──
        useEffect(() => {
            const isDesktop = typeof window !== 'undefined' && !!window.zionNative;
            const isNativeCap = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

            if (!nativeUi) return undefined;
            if (!isNativeCap && !isDesktop) return undefined;
            if (!songId) return undefined;

            let cancelled = false;
            let retryTimer = null;
            realWaveformActiveRef.current = false;

            const applySyntheticPlaceholder = (reason) => {
                if (realWaveformActiveRef.current) return;
                // Desktop must never render a synthetic waveform. Keep canvas neutral
                // until real local peaks are available (cache / preview / local stem fallback).
                if (isDesktop) {
                    fakePeaksRef.current = null;
                    console.log('[WAVEFORM] waiting for real local waveform', songId, reason);
                    requestAnimationFrame(() => redrawZion());
                    return;
                }
                fakePeaksRef.current = makeZionFakePeaks(songId, 720);
                console.log('[WAVEFORM] using synthetic fallback waveform', songId, reason);
                requestAnimationFrame(() => redrawZion());
            };

            const applyCachedPeaks = (peaks) => {
                fakePeaksRef.current = peaks;
                realWaveformActiveRef.current = true;
                console.log('[WAVEFORM] loaded cached peaks', songId);
                requestAnimationFrame(() => redrawZion());
            };

            const cached = readCachedPeaksFromStorage(songId);
            console.log('[WAVEFORM] songId', songId);
            console.log('[WAVEFORM] previewMixLocalPath', previewMixLocalPath || '(none)');
            console.log('[WAVEFORM] peaks cache exists', !!cached);
            if (cached) {
                applyCachedPeaks(cached);
                return () => {
                    cancelled = true;
                    if (retryTimer) clearTimeout(retryTimer);
                };
            }

            applySyntheticPlaceholder('placeholder until idle PreviewMix decode');

            const waitUntilIdleForDecode = async () => {
                while (!cancelled) {
                    if (disabledRef.current) {
                        await new Promise((r) => setTimeout(r, 200));
                        continue;
                    }
                    if (isDraggingRef.current) {
                        await new Promise((r) => setTimeout(r, 120));
                        continue;
                    }
                    break;
                }
            };

            let attempt = 0;
            const maxAttempts = 6;

            const runDecode = async () => {
                if (cancelled || realWaveformActiveRef.current) return;

                await waitUntilIdleForDecode();
                if (cancelled || realWaveformActiveRef.current) return;

                const again = readCachedPeaksFromStorage(songId);
                if (again) {
                    applyCachedPeaks(again);
                    return;
                }

                console.log('[WAVEFORM] decoding local source', songId);

                try {
                    await audioEngine.init();
                    let ab = null;
                    let usedSource = '';

                    if (isDesktop && window.zionNative?.readEncryptedTrack) {
                        const previewCandidates = [
                            previewMixLocalPath,
                            `${songId}_${PREVIEW_MIX_TRACK}.mp3`,
                            `${songId}_${PREVIEW_MIX_TRACK}.flac`,
                            `${songId}___PreviewMix.mp3`,
                            `${songId}___PreviewMix.flac`,
                        ]
                            .map((x) => basenameKey(x))
                            .filter(Boolean);

                        for (const key of [...new Set(previewCandidates)]) {
                            const maybe = toArrayBufferMaybe(await window.zionNative.readEncryptedTrack(key));
                            if (maybe) {
                                ab = maybe;
                                usedSource = key;
                                break;
                            }
                        }

                        if (!ab) {
                            const fallbackKeys = (Array.isArray(localWaveformFallbacks) ? localWaveformFallbacks : [])
                                .map((x) => basenameKey(x))
                                .filter(Boolean);
                            if (fallbackKeys.length > 0) {
                                console.log('[WAVEFORM] preview missing, using first local stem fallback');
                            }
                            for (const key of [...new Set(fallbackKeys)]) {
                                const maybe = toArrayBufferMaybe(await window.zionNative.readEncryptedTrack(key));
                                if (maybe) {
                                    ab = maybe;
                                    usedSource = key;
                                    break;
                                }
                            }
                        }
                    } else {
                        const raw = await NativeEngine.readTrackBlob(songId, PREVIEW_MIX_TRACK);
                        if (raw) {
                            ab = raw instanceof ArrayBuffer ? raw.slice(0) : await raw.arrayBuffer();
                            usedSource = `${songId}_${PREVIEW_MIX_TRACK}`;
                        }
                    }

                    if (!ab) {
                        if (isDesktop) {
                            console.warn('[WAVEFORM ERROR] no local preview, no peaks, no fallback stem');
                            return;
                        }
                        attempt += 1;
                        if (!cancelled && attempt < maxAttempts) {
                            retryTimer = setTimeout(() => {
                                if (!cancelled) void runDecode();
                            }, 10000);
                        }
                        return;
                    }
                    if (cancelled) return;

                    await waitUntilIdleForDecode();
                    if (cancelled || realWaveformActiveRef.current) return;

                    const buf = await decodeWaveformArrayBuffer(ab);
                    const peaks = buildPeaksFromAudioBuffer(buf);
                    try {
                        localStorage.setItem(`peaks_${songId}`, JSON.stringify(Array.from(peaks)));
                    } catch {
                        /* storage full */
                    }
                    console.log('[WAVEFORM] saved peaks cache', songId, usedSource || '(unknown source)');
                    if (cancelled) return;
                    fakePeaksRef.current = peaks;
                    realWaveformActiveRef.current = true;
                    requestAnimationFrame(() => redrawZion());
                } catch (e) {
                    console.warn('[WAVEFORM] PreviewMix decode failed', songId, e);
                    if (String(e?.message || '').includes('No decodeAudioData context available')) {
                        console.warn('[WAVEFORM ERROR] no local decoder context available');
                    }
                    attempt += 1;
                    if (!cancelled && attempt < maxAttempts) {
                        retryTimer = setTimeout(() => {
                            if (!cancelled) void runDecode();
                        }, 10000);
                    }
                }
            };

            void runDecode();

            return () => {
                cancelled = true;
                if (retryTimer) clearTimeout(retryTimer);
            };
        }, [nativeUi, songId, hasPreviewMix, previewMixLocalPath, localWaveformFallbacks, redrawZion]);

        useEffect(() => {
            if (nativeUi) return undefined;
            fakePeaksRef.current = makeZionFakePeaks(songId || 'default', 720);
            realWaveformActiveRef.current = false;
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

        // ── Preload beat grid when songId changes ──
        useEffect(() => {
            beatGridRef.current = null;
            if (!songId) return;
            songMapService.loadForSong(songId).then((sm) => {
                if (!sm) return;
                const snap = lastSnapshotRef.current;
                const dur = effectiveTrackDur(snap.durationSec, durationProp);
                beatGridRef.current = generateBeatGrid(sm, dur || 300);
            }).catch(() => {});
        }, [songId, durationProp]);

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

                    // Update beat grid if we now have duration but didn't before
                    if (!beatGridRef.current && songId && s.durationSec > 1) {
                        const sm = songMapService.get(songId);
                        if (sm) beatGridRef.current = generateBeatGrid(sm, s.durationSec);
                    }

                    if (timeRef.current) {
                        timeRef.current.textContent = `${formatTime(pos)} / ${formatTime(dur)}`;
                    }

                    // Bar/beat display (Req 5)
                    if (barRef.current) {
                        const sm = songId ? songMapService.get(songId) : null;
                        if (isBarsModeRef.current && sm) {
                            const bb = secondsToBarBeat(pos, sm);
                            barRef.current.textContent = `Compás ${bb.bar} · Beat ${bb.beat}`;
                            console.log(`[BAR DISPLAY] current bar=${bb.bar} beat=${bb.beat}`);
                        } else if (isBarsModeRef.current && !sm) {
                            barRef.current.textContent = 'Compás no disponible';
                        } else {
                            barRef.current.textContent = '';
                        }
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
        }, [nativeUi, disabled, onSnapshot, durationProp, redrawZion, songId]);


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
                if (
                    typeof window !== 'undefined' &&
                    window.zionNative?.seek &&
                    window.__zionDesktopPlayback !== 'wasm'
                ) {
                    await window.zionNative.seek(finalTime);
                } else {
                    await audioEngine.endDrag(finalTime);
                }
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
            if (
                typeof window !== 'undefined' &&
                window.zionNative?.seek &&
                window.__zionDesktopPlayback !== 'wasm'
            ) {
                await window.zionNative.seek(finalTime);
            } else {
                await audioEngine.endDrag(finalTime);
            }
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
                    padding: nativeUi ? '4px 2px 6px' : '0 4px',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: nativeUi ? 5 : 4,
                        flexShrink: 0,
                    }}
                >
                    {/* Time / Bar toggle row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

                        {/* Bar/beat display */}
                        <span
                            ref={barRef}
                            style={{
                                fontSize: '0.78rem',
                                fontWeight: '700',
                                color: '#7dd3fc',
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '0.04em',
                                opacity: isBarsModeRef.current ? 1 : 0,
                                transition: 'opacity 0.2s',
                                flexShrink: 0,
                            }}
                        />

                        {/* Toggle button (Req 1) */}
                        <button
                            ref={toggleRef}
                            onClick={() => {
                                const next = !isBarsModeRef.current;
                                isBarsModeRef.current = next;
                                saveBarMode(next);
                                // Update button label
                                if (toggleRef.current) {
                                    toggleRef.current.textContent = next ? '🎵 Compás' : '🕐 Tiempo';
                                }
                                // Show/hide barRef
                                if (barRef.current) {
                                    barRef.current.style.opacity = next ? '1' : '0';
                                    if (!next) barRef.current.textContent = '';
                                }
                                console.log(next ? '[BAR DISPLAY] mode bars' : '[BAR DISPLAY] mode time');
                            }}
                            style={{
                                marginLeft: 'auto',
                                padding: '2px 10px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                borderRadius: 6,
                                border: '1px solid rgba(125,211,252,0.4)',
                                background: 'rgba(125,211,252,0.12)',
                                color: '#7dd3fc',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'background 0.15s',
                                letterSpacing: '0.04em',
                            }}
                        >
                            {isBarsModeRef.current ? '🎵 Compás' : '🕐 Tiempo'}
                        </button>
                    </div>
                </div>


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
