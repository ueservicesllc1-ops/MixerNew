import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { audioEngine } from '../AudioEngine';
import { isMixerClickStem, isMixerGuideStem } from '../mixerStemRoles.js';

const LOCKED_STRIP_RED = '#b91c1c';

/**
 * 1.º: primer stem tipo click; 2.º: primer tipo guía; luego el resto de clicks, resto de guías, demás (orden original).
 */
function sortMixerTracksStable(tracks) {
    const list = [...(tracks || [])];
    const origIndex = new Map(list.map((t, i) => [t.id, i]));
    const cmp = (a, b) => {
        const c = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        if (c !== 0) return c;
        return (origIndex.get(a.id) ?? 0) - (origIndex.get(b.id) ?? 0);
    };
    const clicks = list.filter((t) => isMixerClickStem(t.name)).sort(cmp);
    const guides = list.filter((t) => isMixerGuideStem(t.name)).sort(cmp);
    const firstClick = clicks[0];
    const firstGuide = guides[0];
    const out = [];
    const used = new Set();
    if (firstClick) {
        out.push(firstClick);
        used.add(firstClick.id);
    }
    if (firstGuide) {
        out.push(firstGuide);
        used.add(firstGuide.id);
    }
    for (const t of clicks) {
        if (!used.has(t.id)) {
            out.push(t);
            used.add(t.id);
        }
    }
    for (const t of guides) {
        if (!used.has(t.id)) {
            out.push(t);
            used.add(t.id);
        }
    }
    const rest = list.filter((t) => !used.has(t.id)).sort((a, b) => (origIndex.get(a.id) ?? 0) - (origIndex.get(b.id) ?? 0));
    out.push(...rest);
    return out;
}

export const Mixer = ({ tracks, mixSettings = {}, onStateChange }) => {
    const sortedTracks = useMemo(() => sortMixerTracksStable(tracks || []), [tracks]);

    return (
        <div className="mixer-grid">
            {sortedTracks.map((track) => (
                <ChannelStrip
                    key={track.id}
                    id={track.id}
                    name={track.name}
                    isPlaceholder={track.isPlaceholder}
                    initialSettings={mixSettings[track.id] || {}}
                    onStateChange={onStateChange}
                />
            ))}
        </div>
    );
};

// ─── LED VU Meter ────────────────────────────────────────────────
const LED_COUNT = 32;

function VUMeter({ trackId, muted }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const levelRef = useRef(0);

    useEffect(() => {
        const poll = () => {
            const raw = audioEngine.getTrackLevel(trackId);
            const isZionWasm = !!(audioEngine.isWASMReady && audioEngine.wasm);
            const boost = Capacitor.isNativePlatform() ? 3.2 : isZionWasm ? 2.85 : 6.5;
            levelRef.current = Math.min(1, raw * boost);

            draw();
            rafRef.current = requestAnimationFrame(poll);
        };

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const parent = canvas.parentElement;
            if (!parent) return;

            const dpr = window.devicePixelRatio || 1;
            const rect = parent.getBoundingClientRect();

            if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
                canvas.width = Math.floor(rect.width * dpr);
                canvas.height = Math.floor(rect.height * dpr);
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
            }

            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const isDark = document.body.classList.contains('dark-mode');

            ctx.clearRect(0, 0, w, h);

            const activeLeds = muted ? 0 : Math.round(levelRef.current * LED_COUNT);
            const ledHeight = (h / LED_COUNT) - (1 * dpr);

            for (let i = 0; i < LED_COUNT; i++) {
                const isLit = i < activeLeds;
                let color;

                if (isLit) {
                    if (isDark) {
                        if (i >= LED_COUNT - 4) color = '#f59e0b';
                        else if (i >= LED_COUNT - 10) color = '#fbbf24';
                        else color = '#eab308';
                    } else {
                        if (i >= LED_COUNT - 4) color = '#ff1f1f';
                        else if (i >= LED_COUNT - 10) color = '#ffb142';
                        else color = '#00e676';
                    }
                } else {
                    color = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                }

                ctx.fillStyle = color;
                const y = h - ((i + 1) * (h / LED_COUNT));
                ctx.fillRect(0, y, w, ledHeight);
            }
        };

        rafRef.current = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(rafRef.current);
    }, [trackId, muted]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
}

// ─── Channel Strip ────────────────────────────────────────────────
const ChannelStrip = ({ id, name, isPlaceholder, initialSettings, onStateChange }) => {
    const [volume, setVolume] = useState(initialSettings.volume ?? 0.8);
    const [muted, setMuted] = useState(initialSettings.muted ?? false);
    const [solo, setSolo] = useState(initialSettings.solo ?? false);
    const [faderH, setFaderH] = useState(150);
    const stackRef = useRef(null);

    useEffect(() => {
        if (!stackRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setFaderH(entry.contentRect.height);
            }
        });
        ro.observe(stackRef.current);
        return () => ro.disconnect();
    }, []);

    // Sync state changes back up to parent
    useEffect(() => {
        if (onStateChange) {
            onStateChange(id, { volume, muted, solo });
        }
    }, [id, volume, muted, solo, onStateChange]);

    // Apply initial settings to audio engine when it stops being a placeholder
    useEffect(() => {
        if (!isPlaceholder) {
            const gain = Math.pow(10, dbFromVolume(volume) / 20);
            audioEngine.setTrackVolume(id, gain);
            audioEngine.setTrackMute(id, muted);
            audioEngine.setTrackSolo(id, solo);
        }
    }, [id, isPlaceholder]); // Re-run if it becomes a real track

    const dbFromVolume = (val) => {
        const points = [
            { v: 0.0, db: -100 },
            { v: 0.1, db: -40 },
            { v: 0.3, db: -20 },
            { v: 0.5, db: -10 },
            { v: 0.65, db: -5 },
            { v: 0.8, db: 0 },
            { v: 1.0, db: +6 },
        ];
        if (val <= 0) return -100;
        if (val >= 1.0) return 6;
        for (let i = 0; i < points.length - 1; i++) {
            if (val >= points[i].v && val <= points[i + 1].v) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const t = (val - p1.v) / (p2.v - p1.v);
                return p1.db + t * (p2.db - p1.db);
            }
        }
        return 0;
    };

    const getTrackColor = (stemName) => {
        const n = (stemName || '').toLowerCase();
        if (n.includes('bat') || n.includes('drum') || n.includes('perc')) return '#00bcd4';
        if (n.includes('guit') || n.includes('git')) return '#ffb142';
        if (n.includes('vox') || n.includes('voz')) return '#34ace0';
        if (n.includes('bass') || n.includes('bajo')) return '#706fd3';
        return '#00d2d3';
    };

    const handleVolume = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        const db = dbFromVolume(val);
        const gain = Math.pow(10, db / 20);
        audioEngine.setTrackVolume(id, gain);
    };

    const toggleMute = () => {
        const next = !muted;
        setMuted(next);
        audioEngine.setTrackMute(id, next);
    };

    const toggleSolo = () => {
        const next = !solo;
        setSolo(next);
        audioEngine.setTrackSolo(id, next);
    };

    const [customColor, setCustomColor] = useState(null);
    const isClickGuideStem = isMixerClickStem(name) || isMixerGuideStem(name);
    /** Click / guía: rojo en pastilla, medidor y fader (como Bass tiene su morado). */
    const trackColor = customColor || (isClickGuideStem ? LOCKED_STRIP_RED : getTrackColor(name));

    return (
        <div className={`channel-strip ${isPlaceholder ? 'is-loading' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px', minHeight: '20px' }}>
                <div style={{ position: 'relative', width: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                    <div
                        style={{
                            width: '16px',
                            height: '8px',
                            borderRadius: '2px',
                            backgroundColor: trackColor,
                            border: '1px solid rgba(255,255,255,0.25)',
                        }}
                    />
                    {!isClickGuideStem && (
                        <input
                            type="color"
                            value={trackColor}
                            onChange={(e) => setCustomColor(e.target.value)}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                            title="Cambiar color del track"
                        />
                    )}
                </div>

                <div
                    className="channel-name"
                    style={{
                        fontSize: '0.9rem',
                        fontWeight: '800',
                        textAlign: 'center',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {name}
                </div>

                <div style={{ width: '20px' }} />
            </div>

            <div className="fader-stack" ref={stackRef}>
                <div className="db-scale">
                    <span className="db-tick" style={{ bottom: '100%' }}>+6</span>
                    <span className="db-tick" style={{ bottom: '80%', color: '#00d2d3' }}>0</span>
                    <span className="db-tick" style={{ bottom: '65%' }}>-5</span>
                    <span className="db-tick" style={{ bottom: '50%' }}>-10</span>
                    <span className="db-tick" style={{ bottom: '30%' }}>-20</span>
                    <span className="db-tick" style={{ bottom: '10%' }}>-40</span>
                    <span className="db-tick" style={{ bottom: '0%' }}>-∞</span>
                </div>

                <div
                    style={{
                        width: '10px',
                        height: '100%',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#94a3b8',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                    }}
                >
                    <VUMeter trackId={id} muted={muted} />
                </div>

                <div className="meter-bg">
                    <div
                        className="meter-fill"
                        style={{
                            height: `${volume * 100}%`,
                            background: trackColor,
                            opacity: 0.8,
                        }}
                    />
                </div>

                <div className="fader-container">
                    <div
                        className="fader-color-fill"
                        style={{ height: `${volume * 100}%`, background: muted ? '#b2bec3' : trackColor }}
                    />
                    <input
                        type="range"
                        className="fader"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolume}
                        style={{
                            width: `${faderH}px`,
                            accentColor: trackColor,
                        }}
                    />
                </div>
            </div>

            <div className="btn-group">
                <button
                    type="button"
                    className={`channel-btn m ${muted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title="Mute"
                >
                    M
                </button>
                <button
                    type="button"
                    className={`channel-btn s ${solo ? 'active' : ''}`}
                    onClick={toggleSolo}
                    title="Solo"
                >
                    S
                </button>
            </div>
        </div>
    );
};
