import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { audioEngine } from '../AudioEngine';
import { Volume2, VolumeX } from 'lucide-react';

export const Mixer = ({ tracks }) => {
    // Sort: Click first, Guides second, rest normal
    const sortedTracks = [...tracks].sort((a, b) => {
        const getPriority = (n) => {
            n = (n || '').toLowerCase();
            if (n.includes('click')) return -5;
            if (n.includes('guide') || n.includes('guia') || n.includes('cue')) return -4;
            return 0;
        };
        return getPriority(a.name) - getPriority(b.name);
    });

    return (
        <div className="mixer-grid">
            {sortedTracks.map(track => (
                <ChannelStrip key={track.id} id={track.id} name={track.name} isPlaceholder={track.isPlaceholder} />
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
            // Web: analizador da picos bajos → boost alto. Nativo: niveles ya vienen escalados (~0–0.2).
            const boost = Capacitor.isNativePlatform() ? 3.2 : 6.5;
            levelRef.current = Math.min(1, raw * boost);
            
            draw();
            rafRef.current = requestAnimationFrame(poll);
        };

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const parent = canvas.parentElement;
            if (!parent) return;

            // Correct DPI scaling for APK
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
            const ledHeight = (h / LED_COUNT) - (1 * dpr); // 1px gap scaled

            for (let i = 0; i < LED_COUNT; i++) {
                const isLit = i < activeLeds;
                let color;

                if (isLit) {
                    if (isDark) {
                        // Amarillos (modo oscuro)
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
                // Draw from bottom up
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
const ChannelStrip = ({ id, name, isPlaceholder }) => {
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [solo, setSolo] = useState(false);
    const [faderH, setFaderH] = useState(150);
    const stackRef = useRef(null);

    const n = (name || '').toLowerCase();
    const isSpecial = n.includes('click') || n.includes('guide') || n.includes('guia') || n.includes('cue');

    // Dynamically sync fader width to the actual rendered height of the stack
    useEffect(() => {
        if (!stackRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setFaderH(entry.contentRect.height);
            }
        });
        ro.observe(stackRef.current);
        return () => ro.disconnect();
    }, []);

    const getTrackColor = (name) => {
        const n = (name || '').toLowerCase();
        if (n.includes('click') || n.includes('guide') || n.includes('guia') || n.includes('cue')) return '#f97316'; // Reddish Orange for accessibility
        if (n.includes('bat') || n.includes('drum') || n.includes('perc')) return '#00bcd4';
        if (n.includes('guit') || n.includes('git')) return '#ffb142';
        if (n.includes('vox') || n.includes('voz')) return '#34ace0';
        if (n.includes('bass') || n.includes('bajo')) return '#706fd3';
        return '#00d2d3';
    };



    const handleVolume = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);

        // PHYSICAL POINTS MAPPING (Slider Pos -> dB)
        const points = [
            { v: 0.0, db: -100 },
            { v: 0.1, db: -40 },
            { v: 0.3, db: -20 },
            { v: 0.5, db: -10 },
            { v: 0.65, db: -5 },
            { v: 0.8, db: 0 },
            { v: 1.0, db: +6 }
        ];

        let db;
        if (val <= 0) db = -100;
        else if (val >= 1.0) db = 6;
        else {
            for (let i = 0; i < points.length - 1; i++) {
                if (val >= points[i].v && val <= points[i + 1].v) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const t = (val - p1.v) / (p2.v - p1.v);
                    db = p1.db + t * (p2.db - p1.db);
                    break;
                }
            }
        }

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
    const trackColor = customColor || getTrackColor(name);

    const [editableName, setEditableName] = useState(name);

    return (
        <div className={`channel-strip ${isSpecial ? 'special-track' : ''} ${isPlaceholder ? 'is-loading' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px', minHeight: '20px' }}>
                {/* Left Column: Color Picker */}
                <div style={{ position: 'relative', width: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ width: '16px', height: '8px', borderRadius: '2px', backgroundColor: trackColor, border: '1px solid rgba(255,255,255,0.2)' }} />
                    <input 
                        type="color" 
                        value={trackColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        title="Cambiar color del track"
                    />
                </div>
                
                {/* Center Column: Name */}
                <div 
                    className="channel-name" 
                    style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: '800', 
                        textAlign: 'center',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {name}
                </div>

                {/* Right Column: Placeholder for balance */}
                <div style={{ width: '20px' }} />
            </div>

            <div className="fader-stack" ref={stackRef}>
                {/* DB SCALE — Absolutely positioned to match points */}
                <div className="db-scale">
                    <span className="db-tick" style={{ bottom: '100%' }}>+6</span>
                    <span className="db-tick" style={{ bottom: '80%', color: '#00d2d3' }}>0</span>
                    <span className="db-tick" style={{ bottom: '65%' }}>-5</span>
                    <span className="db-tick" style={{ bottom: '50%' }}>-10</span>
                    <span className="db-tick" style={{ bottom: '30%' }}>-20</span>
                    <span className="db-tick" style={{ bottom: '10%' }}>-40</span>
                    <span className="db-tick" style={{ bottom: '0%' }}>-∞</span>
                </div>

                {/* VU METER LEDs — left of the fader */}
                <div style={{
                    width: '10px',
                    height: '100%',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#94a3b8',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                }}>
                    <VUMeter trackId={id} muted={muted} />
                </div>

                <div className="meter-bg">
                    <div
                        className="meter-fill"
                        style={{
                            height: `${volume * 100}%`,
                            background: trackColor,
                            opacity: 0.8
                        }}
                    ></div>
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
                        style={{ width: `${faderH}px` }}
                    />
                </div>
            </div>

            <div className="btn-group">
                <button
                    className={`channel-btn m ${muted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title="Mute"
                >
                    M
                </button>
                <button
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
