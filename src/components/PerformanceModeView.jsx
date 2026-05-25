import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Music, Disc } from 'lucide-react';
import {
    songMapService,
    generateBeatGrid,
    secondsToBarBeat,
    secPerBar,
    secPerBeat,
    createDefaultSongMap
} from '../utils/SongMapService.js';

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PerformanceModeView({
    activeSong,
    isPlaying,
    onTogglePlay,
    onSkipForward,
    onSkipBack,
    progressRef,
    activeMarkers,
    activeSetlist,
    tempoOffset,
    pitchOffset,
    currentKey,
    onClose
}) {
    const timeTextRef = useRef(null);
    const barBeatTextRef = useRef(null);
    const currentSectionTextRef = useRef(null);
    const nextSectionTextRef = useRef(null);
    const progressBarFillRef = useRef(null);
    const visualCountInRef = useRef(null);
    const sectionsContainerRef = useRef(null);

    // Fetch the active song map and grid
    const songId = activeSong?.id;
    const songMap = songId 
        ? (songMapService.get(songId) || createDefaultSongMap(activeSong.tempo || 120, '4/4', activeSong.duration || 300))
        : createDefaultSongMap(120, '4/4', 300);

    const { sections } = generateBeatGrid(songMap, activeSong?.duration || 300);

    useEffect(() => {
        let active = true;
        if (!songId) return;

        let lastSectionIndex = -1;

        const updateFrame = () => {
            if (!active) return;
            const t = Number.isFinite(progressRef.current) ? progressRef.current : 0.0;
            const duration = activeSong?.duration || 1.0;

            // 1. Progress and Time
            if (timeTextRef.current) {
                timeTextRef.current.textContent = `${formatTime(t)} / ${formatTime(duration)}`;
            }
            if (progressBarFillRef.current) {
                const percent = Math.min(100, Math.max(0, (t / duration) * 100));
                progressBarFillRef.current.style.width = `${percent}%`;
            }

            // 2. Bar and Beat
            const bb = secondsToBarBeat(t, songMap);
            if (barBeatTextRef.current) {
                barBeatTextRef.current.textContent = `COMPÁS: ${bb.bar}  •  PULSO: ${bb.beat}`;
            }

            // 3. Section calculations
            let curSec = null;
            let nextSec = null;
            let curSecIdx = -1;

            if (sections.length > 0) {
                curSec = sections[0];
                curSecIdx = 0;
                for (let i = 0; i < sections.length; i++) {
                    if (sections[i].startSec <= t) {
                        curSec = sections[i];
                        curSecIdx = i;
                        nextSec = sections[i + 1] || null;
                    }
                }
            }

            // Update Current Section
            if (currentSectionTextRef.current) {
                currentSectionTextRef.current.textContent = curSec ? curSec.name.toUpperCase() : 'INTRO';
            }

            // Highlight Active Section in Sidebar List
            if (curSecIdx !== lastSectionIndex) {
                lastSectionIndex = curSecIdx;
                if (sectionsContainerRef.current) {
                    const children = sectionsContainerRef.current.children;
                    for (let i = 0; i < children.length; i++) {
                        const item = children[i];
                        if (i === curSecIdx) {
                            item.style.background = 'rgba(0, 229, 255, 0.15)';
                            item.style.borderColor = '#00e5ff';
                            item.style.color = '#00e5ff';
                            item.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.2)';
                            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } else {
                            item.style.background = 'rgba(255, 255, 255, 0.02)';
                            item.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                            item.style.color = '#94a3b8';
                            item.style.boxShadow = 'none';
                        }
                    }
                }
            }

            // 4. Next Section Countdown & Giant Count-in
            if (nextSec) {
                const bpm = songMap.bpm || 120;
                const timeSig = songMap.timeSignature || '4/4';
                const sPerB = secPerBar(bpm, timeSig);
                const timeRemaining = nextSec.startSec - t;

                if (timeRemaining > 0 && timeRemaining <= sPerB) {
                    // Less than 1 bar remaining: count beats
                    const beatsRemaining = Math.ceil(timeRemaining / secPerBeat(bpm));
                    if (nextSectionTextRef.current) {
                        nextSectionTextRef.current.textContent = `PREPARAR: ${nextSec.name.toUpperCase()} EN ${beatsRemaining}`;
                        nextSectionTextRef.current.style.color = '#ff3d00';
                        nextSectionTextRef.current.style.animation = 'pulse 0.5s infinite';
                    }

                    // Flashing Giant Number
                    if (visualCountInRef.current) {
                        visualCountInRef.current.textContent = String(beatsRemaining);
                        visualCountInRef.current.style.opacity = '1';
                        visualCountInRef.current.style.transform = 'scale(1.25)';
                        visualCountInRef.current.style.color = beatsRemaining === 1 ? '#00e5ff' : '#ff3d00';
                        visualCountInRef.current.style.textShadow = beatsRemaining === 1 
                            ? '0 0 40px rgba(0, 229, 255, 0.6)' 
                            : '0 0 40px rgba(255, 61, 0, 0.6)';
                    }
                } else if (timeRemaining > 0) {
                    const barsRemaining = nextSec.bar - bb.bar;
                    if (nextSectionTextRef.current) {
                        nextSectionTextRef.current.textContent = `SIGUIENTE: ${nextSec.name.toUpperCase()} (en ${barsRemaining} comp${barsRemaining === 1 ? 'ás' : 'ases'})`;
                        nextSectionTextRef.current.style.color = '#e2e8f0';
                        nextSectionTextRef.current.style.animation = 'none';
                    }
                    if (visualCountInRef.current) {
                        visualCountInRef.current.style.opacity = '0';
                        visualCountInRef.current.style.transform = 'scale(0.9)';
                    }
                }
            } else {
                if (nextSectionTextRef.current) {
                    nextSectionTextRef.current.textContent = 'FIN';
                    nextSectionTextRef.current.style.color = '#64748b';
                    nextSectionTextRef.current.style.animation = 'none';
                }
                if (visualCountInRef.current) {
                    visualCountInRef.current.style.opacity = '0';
                }
            }

            requestAnimationFrame(updateFrame);
        };

        requestAnimationFrame(updateFrame);
        return () => {
            active = false;
        };
    }, [songId, sections, activeSong]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: '#040712',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
            zIndex: 99999,
            overflow: 'hidden'
        }}>
            {/* Header / Info bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 40px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(7, 11, 26, 0.4)',
                backdropFilter: 'blur(12px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #00e5ff 0%, #0088ff 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(0, 229, 255, 0.25)'
                    }}>
                        <Music size={24} color="#000" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                            {activeSong?.name || 'Cargando...'}
                        </h1>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                            {activeSong?.artist || 'Zion Stage'}
                        </span>
                    </div>
                </div>

                {/* Tempo & Key widgets */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '8px 16px',
                        borderRadius: 10,
                        fontSize: '0.9rem',
                        fontWeight: 700
                    }}>
                        BPM: <span style={{ color: '#00e5ff' }}>{Math.round((activeSong?.tempo || 120) * (1 + (tempoOffset || 0) / 100))}</span>
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '8px 16px',
                        borderRadius: 10,
                        fontSize: '0.9rem',
                        fontWeight: 700
                    }}>
                        TONO: <span style={{ color: '#00e5ff' }}>{currentKey || 'C'}</span>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255, 255, 255, 0.03)',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Interactive Screen */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {/* Left Side: Performance HUD (Clean, giant typography) */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 40,
                    position: 'relative',
                    borderRight: '1px solid rgba(255,255,255,0.03)'
                }}>
                    {/* Visual Count-In Indicator */}
                    <div 
                        ref={visualCountInRef}
                        style={{
                            position: 'absolute',
                            fontSize: '14rem',
                            fontWeight: 900,
                            opacity: 0,
                            transition: 'all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            pointerEvents: 'none',
                            zIndex: 10
                        }}
                    />

                    {/* Giant Section Label */}
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#00e5ff', letterSpacing: '0.2em' }}>SECCIÓN ACTUAL</span>
                        <h2 
                            ref={currentSectionTextRef}
                            style={{
                                margin: '10px 0 0 0',
                                fontSize: '6.5rem',
                                fontWeight: 900,
                                color: '#ffffff',
                                letterSpacing: '-0.03em',
                                textShadow: '0 10px 30px rgba(0,0,0,0.5)'
                            }}
                        >
                            INTRO
                        </h2>
                    </div>

                    {/* Next Section Countdown Badge */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '16px 36px',
                        borderRadius: 99,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        backdropFilter: 'blur(8px)',
                        textAlign: 'center'
                    }}>
                        <div 
                            ref={nextSectionTextRef}
                            style={{
                                fontSize: '1.6rem',
                                fontWeight: 800,
                                color: '#e2e8f0',
                                letterSpacing: '-0.01em'
                            }}
                        >
                            CARGANDO COMPASES...
                        </div>
                    </div>

                    {/* Musical Grid Details */}
                    <div 
                        ref={barBeatTextRef}
                        style={{
                            marginTop: 40,
                            fontSize: '1.8rem',
                            fontWeight: 800,
                            color: '#00e5ff',
                            letterSpacing: '0.05em'
                        }}
                    >
                        COMPÁS: 1  •  PULSO: 1
                    </div>
                </div>

                {/* Right Side: Navigation & Sections Flow */}
                <div style={{
                    width: 380,
                    background: 'rgba(5, 8, 20, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '24px 30px'
                }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.15em', margin: '0 0 20px 0' }}>
                        MAPA DE LA CANCIÓN
                    </h3>
                    
                    <div 
                        ref={sectionsContainerRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            paddingRight: 6
                        }}
                    >
                        {sections.length > 0 ? sections.map((sec, idx) => (
                            <div 
                                key={`${sec.name}-${idx}`}
                                style={{
                                    padding: '16px 20px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    background: 'rgba(255,255,255,0.01)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.25s ease'
                                }}
                            >
                                <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{sec.name}</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.6 }}>Compás {sec.bar}</span>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: '0.9rem', fontWeight: 700 }}>
                                Sin secciones definidas
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Controls Panel */}
            <div style={{
                background: 'rgba(5, 8, 20, 0.6)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                backdropFilter: 'blur(16px)',
                padding: '20px 40px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
            }}>
                {/* Clean Progress Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{
                        flex: 1,
                        height: 8,
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 4,
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div 
                            ref={progressBarFillRef}
                            style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, #00e5ff 0%, #0088ff 100%)',
                                width: '0%',
                                borderRadius: 4,
                                boxShadow: '0 0 10px rgba(0, 229, 255, 0.4)',
                                transition: 'width 0.1s linear'
                            }}
                        />
                    </div>
                    <span 
                        ref={timeTextRef}
                        style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#94a3b8',
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 100,
                            textAlign: 'right'
                        }}
                    >
                        0:00 / 0:00
                    </span>
                </div>

                {/* Big Stage Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                    <button 
                        onClick={onSkipBack}
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.05)',
                            background: 'rgba(255,255,255,0.02)',
                            color: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <SkipBack size={24} fill="#fff" />
                    </button>

                    <button 
                        onClick={onTogglePlay}
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            border: 'none',
                            background: '#f8fafc',
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 10px 30px rgba(255, 255, 255, 0.2)',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'scale(1.06)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        {isPlaying ? <Pause size={32} fill="#000" /> : <Play size={32} fill="#000" style={{ marginLeft: 4 }} />}
                    </button>

                    <button 
                        onClick={onSkipForward}
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.05)',
                            background: 'rgba(255,255,255,0.02)',
                            color: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <SkipForward size={24} fill="#fff" />
                    </button>
                </div>
            </div>

            {/* Embedded styles for flashing transitions */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.85; transform: scale(1.02); }
                }
            `}} />
        </div>
    );
}
