import React, { useState, useEffect, useRef } from 'react';
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
    const [level, setLevel] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        const poll = () => {
            const raw = audioEngine.getTrackLevel(trackId);
            setLevel(Math.min(1, raw * 6.5)); // Boosted for visibility
            rafRef.current = requestAnimationFrame(poll);
        };
        rafRef.current = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(rafRef.current);
    }, [trackId]);

    const activeLeds = muted ? 0 : Math.round(level * LED_COUNT);

    const getLedColor = (i) => {
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
            if (i >= LED_COUNT - 4) return '#ff3b3b'; // Vivid Crimson
            if (i >= LED_COUNT - 10) return '#ff9f0a'; // Bright Gold
            return '#00e5ff'; // Neon Cyan
        }
        if (i >= LED_COUNT - 4) return '#ff1f1f'; // Top 4 = RED
        if (i >= LED_COUNT - 10) return '#ffb142'; // Next 6 = AMBER
        return '#00e676';                           // Rest = GREEN
    };

    const isDark = document.body.classList.contains('dark-mode');

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '1.5px',
            height: '100%',
            padding: '4px 3px',
            background: isDark ? '#020617' : '#94a3b8',
            transition: 'background 0.3s ease'
        }}>
            {Array.from({ length: LED_COUNT }, (_, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        borderRadius: '1px',
                        background: i < activeLeds
                            ? getLedColor(i)
                            : (isDark ? '#1e293b' : '#cbd5e0'),
                        boxShadow: i < activeLeds
                            ? `0 0 8px ${getLedColor(i)}cc`
                            : 'none',
                        transition: 'background 0.03s, box-shadow 0.03s',
                        border: isDark ? 'none' : '1px solid rgba(0,0,0,0.05)',
                    }}
                />
            ))}
        </div>
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

    const trackColor = getTrackColor(name);

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

    return (
        <div className={`channel-strip ${isSpecial ? 'special-track' : ''} ${isPlaceholder ? 'is-loading' : ''}`}>
            <div className="channel-name">{name}</div>

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
                            background: isSpecial ? '#f97316' : 'rgba(19, 181, 182, 0.6)'
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
