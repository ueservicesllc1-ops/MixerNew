import React from 'react';
import { Volume2, VolumeX, Headphones, Music, Mic2, Disc, Layers } from 'lucide-react';

export const HorizontalMixer = ({ tracks, onVolumeChange, onMuteToggle, onSoloToggle, onPanChange }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            {tracks.map((track) => (
                <HorizontalTrack
                    key={track.id}
                    track={track}
                    onVolumeChange={onVolumeChange}
                    onMuteToggle={onMuteToggle}
                    onSoloToggle={onSoloToggle}
                    onPanChange={onPanChange}
                />
            ))}
        </div>
    );
};

const HorizontalTrack = ({ track, onVolumeChange, onMuteToggle, onSoloToggle, onPanChange }) => {
    const getTrackIcon = (name) => {
        const n = name.toLowerCase();
        if (n.includes('vox') || n.includes('voz') || n.includes('vocal')) return <Mic2 size={16} />;
        if (n.includes('drum') || n.includes('bat')) return <Disc size={16} />;
        if (n.includes('guit') || n.includes('git')) return <Music size={16} />;
        if (n.includes('bass') || n.includes('bajo')) return <Layers size={16} />;
        return <Headphones size={16} />;
    };

    const getTrackColor = (name) => {
        const n = name.toLowerCase();
        if (n.includes('drum')) return '#94a3b8'; // Grey/Silver
        if (n.includes('bass')) return '#7c3aed'; // Purple
        if (n.includes('guit')) return '#dc2626'; // Red
        if (n.includes('vox')) return '#0284c7'; // Blue
        if (n.includes('piano') || n.includes('key')) return '#059669'; // Green
        return '#00d2d3'; // Cyan default
    };

    const color = getTrackColor(track.name);
    const isMuted = track.muted;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '150px 70px 1fr 85px',
            alignItems: 'center',
            padding: '6px 15px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid rgba(255,255,255,0.02)',
            transition: 'background 0.2s'
        }}>
            {/* Name & Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: isMuted ? '#334155' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' }}>
                    {getTrackIcon(track.name)}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isMuted ? '#64748b' : 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</span>
            </div>

            {/* Panning (L-C-R) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '50px', fontSize: '0.55rem', color: '#64748b', fontWeight: '800' }}>
                    <span>L</span>
                    <span>R</span>
                </div>
                <input
                    type="range"
                    min="-1" max="1" step="0.1"
                    value={track.pan || 0}
                    onChange={(e) => onPanChange(track.id, parseFloat(e.target.value))}
                    style={{ width: '50px', height: '3px', accentColor: '#94a3b8' }}
                />
            </div>

            {/* Volume Slider with Color Ramp */}
            <div style={{ position: 'relative', padding: '0 25px', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '25px', right: '25px', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${track.volume * 100}%`,
                        height: '100%',
                        background: isMuted ? '#475569' : `linear-gradient(to right, transparent, ${color})`,
                        transition: 'width 0.1s'
                    }} />
                </div>
                <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={track.volume}
                    onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        width: '100%',
                        height: '20px',
                        opacity: 0,
                        cursor: 'pointer'
                    }}
                />
                <div style={{ position: 'absolute', right: '0px', fontSize: '0.65rem', fontWeight: '900', color: '#64748b', width: '20px' }}>
                    {Math.round(track.volume * 100)}
                </div>
            </div>

            {/* Mute / Solo Buttons */}
            <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => onMuteToggle(track.id)}
                    style={{
                        width: '30px', height: '30px', borderRadius: '6px',
                        background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.03)',
                        color: isMuted ? 'white' : '#64748b',
                        cursor: 'pointer', fontSize: '11px', fontWeight: '900',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}
                >M</button>
                <button
                    onClick={() => onSoloToggle(track.id)}
                    style={{
                        width: '30px', height: '30px', borderRadius: '6px',
                        background: track.solo ? '#f59e0b' : 'rgba(255,255,255,0.03)',
                        color: track.solo ? 'white' : '#64748b',
                        cursor: 'pointer', fontSize: '11px', fontWeight: '900',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}
                >S</button>
            </div>
        </div>
    );
};
