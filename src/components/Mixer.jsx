import React, { useState, useEffect, useRef, useCallback } from 'react';
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
                <ChannelStrip key={track.id} id={track.id} name={track.name} />
            ))}
        </div>
    );
};

// ─── LED VU Meter ────────────────────────────────────────────────
const LED_COUNT = 14;

function VUMeter({ trackId, muted }) {
    const [level, setLevel] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        const poll = () => {
            const raw = audioEngine.getTrackLevel(trackId);
            // Apply a little boost so small signals still light up LEDs
            setLevel(Math.min(1, raw * 6));
            rafRef.current = requestAnimationFrame(poll);
        };
        rafRef.current = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(rafRef.current);
    }, [trackId]);

    const activeLeds = muted ? 0 : Math.round(level * LED_COUNT);

    const getLedColor = (i) => {
        if (i >= LED_COUNT - 2) return '#ff5252'; // Top 2 = RED (clip zone)
        if (i >= LED_COUNT - 5) return '#f39c12'; // Middle 3 = AMBER
        return '#2ecc71';                           // Rest = GREEN
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column-reverse', // LEDs grow from bottom
            gap: '2px',
            height: '100%',
            padding: '4px 2px',
        }}>
            {Array.from({ length: LED_COUNT }, (_, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        borderRadius: '2px',
                        background: i < activeLeds
                            ? getLedColor(i)
                            : 'rgba(255,255,255,0.08)',
                        boxShadow: i < activeLeds
                            ? `0 0 4px ${getLedColor(i)}88`
                            : 'none',
                        transition: 'background 0.04s, box-shadow 0.04s',
                    }}
                />
            ))}
        </div>
    );
}

// ─── Channel Strip ────────────────────────────────────────────────
const ChannelStrip = ({ id, name }) => {
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [solo, setSolo] = useState(false);
    const [faderH, setFaderH] = useState(150);
    const stackRef = useRef(null);

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
        if (n.includes('click')) return '#ff5252';
        if (n.includes('guide') || n.includes('guia') || n.includes('cue')) return '#ff5252';
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
        const db = 20 * Math.log10(Math.max(val, 0.001));
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
        <div className="channel-strip">
            <div className="channel-name">{name}</div>

            <div className="fader-stack" ref={stackRef}>
                {/* VU METER LEDs — left of the fader */}
                <div style={{
                    width: '18px',
                    height: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <VUMeter trackId={id} muted={muted} />
                </div>

                <div className="meter-bg">
                    <div className="meter-fill" style={{ height: `${volume * 100}%` }}></div>
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
