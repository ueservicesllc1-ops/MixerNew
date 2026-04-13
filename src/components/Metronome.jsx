import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Settings, Volume2, Activity, Sliders, Hash } from 'lucide-react';

export default function Metronome() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [tempo, setTempo] = useState(120);
    const [pan, setPan] = useState(0); 
    const [vol, setVol] = useState(1.0); 
    const [clickSound, setClickSound] = useState('woodblock'); 
    
    // Pro Features
    const [beatsPerBar, setBeatsPerBar] = useState(4); // 3, 4, 5, 6, etc
    const [subType, setSubType] = useState(1); // 1=none, 2=eighth, 3=triplet, 4=sixteenth
    const [volAccent, setVolAccent] = useState(1.0); // 0 to 1
    const [volQuarter, setVolQuarter] = useState(0.8); // 0 to 1
    const [volSub, setVolSub] = useState(0.5); // 0 to 1

    const audioCtxRef = useRef(null);
    const workerRef = useRef(null);
    
    // Refs for Worker Access
    const isPlayingRef = useRef(isPlaying);
    const tempoRef = useRef(tempo);
    const panRef = useRef(pan);
    const volRef = useRef(vol);
    const clickSoundRef = useRef(clickSound);
    const beatsPerBarRef = useRef(beatsPerBar);
    const subTypeRef = useRef(subType);
    const volAccentRef = useRef(volAccent);
    const volQuarterRef = useRef(volQuarter);
    const volSubRef = useRef(volSub);
    
    const nextNoteTimeRef = useRef(0);
    const currentBeatRef = useRef(0);

    // Sync State
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { tempoRef.current = tempo; }, [tempo]);
    useEffect(() => { panRef.current = pan; }, [pan]);
    useEffect(() => { volRef.current = vol; }, [vol]);
    useEffect(() => { clickSoundRef.current = clickSound; }, [clickSound]);
    useEffect(() => { beatsPerBarRef.current = beatsPerBar; }, [beatsPerBar]);
    useEffect(() => { subTypeRef.current = subType; }, [subType]);
    useEffect(() => { volAccentRef.current = volAccent; }, [volAccent]);
    useEffect(() => { volQuarterRef.current = volQuarter; }, [volQuarter]);
    useEffect(() => { volSubRef.current = volSub; }, [volSub]);

    useEffect(() => {
        const workerCode = `
            let timerID = null;
            self.onmessage = function(e) {
                if (e.data == "start") {
                    timerID = setInterval(function() { postMessage("tick"); }, 25.0);
                }
                else if (e.data == "stop") {
                    clearInterval(timerID);
                    timerID = null;
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (e) => {
            if (e.data === "tick") scheduler();
        };
        
        workerRef.current = worker;
        
        return () => {
            worker.terminate();
            if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
        };
    }, []);

    const scheduleNote = (beatNumber, subBeatNumber, time) => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        
        let nodeVol = 0;
        let isAccent = false;
        
        if (subBeatNumber > 0) {
            nodeVol = volSubRef.current;
        } else if (beatNumber === 0) {
            nodeVol = volAccentRef.current;
            isAccent = true;
        } else {
            nodeVol = volQuarterRef.current;
        }
        
        if (nodeVol <= 0.01) return; // Skip silent nodes completely
        
        const osc = ctx.createOscillator();
        const envelope = ctx.createGain();
        const masterVol = ctx.createGain();
        masterVol.gain.value = volRef.current * nodeVol;
        
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
        if (panner.pan) {
            panner.pan.value = panRef.current;
        } else {
            panner.setPosition(panRef.current, 0, 1 - Math.abs(panRef.current));
        }

        osc.connect(envelope);
        envelope.connect(masterVol);
        masterVol.connect(panner);
        panner.connect(ctx.destination);

        const type = clickSoundRef.current;
        let baseFreq = isAccent ? 880.0 : 440.0;
        if (subBeatNumber > 0) baseFreq = 330.0; 
        
        let oscType = 'sine';
        let releaseTime = 0.05;

        if (type === 'woodblock') {
            baseFreq = isAccent ? 1200.0 : (subBeatNumber > 0 ? 600.0 : 800.0);
            oscType = 'triangle';
            releaseTime = 0.03;
        } else if (type === 'digital') {
            baseFreq = isAccent ? 2000.0 : (subBeatNumber > 0 ? 800.0 : 1000.0);
            oscType = 'square';
            releaseTime = 0.01;
        }

        osc.type = oscType;
        osc.frequency.value = baseFreq;

        envelope.gain.value = 1;
        envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + releaseTime);

        osc.start(time);
        osc.stop(time + releaseTime * 1.5);
    };

    const scheduler = () => {
        if (!audioCtxRef.current || !isPlayingRef.current) return;
        
        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const numSubs = subTypeRef.current;
            const subInterval = (60.0 / tempoRef.current) / numSubs;
            
            // Schedule the main beat + subdivisions
            for (let i = 0; i < numSubs; i++) {
                scheduleNote(currentBeatRef.current, i, nextNoteTimeRef.current + (i * subInterval));
            }
            
            nextNoteTimeRef.current += (60.0 / tempoRef.current);
            currentBeatRef.current++;
            if (currentBeatRef.current >= beatsPerBarRef.current) {
                currentBeatRef.current = 0;
            }
        }
    };

    const toggleMetronome = () => {
        if (isPlaying) {
            setIsPlaying(false);
            workerRef.current.postMessage("stop");
        } else {
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            
            currentBeatRef.current = 0;
            nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;
            
            setIsPlaying(true);
            workerRef.current.postMessage("start");
        }
    };

    const tapTempoTimes = useRef([]);
    const handleTapTempo = () => {
        const now = Date.now();
        const times = tapTempoTimes.current;
        if (times.length > 0 && now - times[times.length - 1] > 2000) times.length = 0; 
        times.push(now);
        if (times.length > 4) times.shift();
        
        if (times.length >= 2) {
            let total = 0;
            for (let i = 1; i < times.length; i++) total += times[i] - times[i - 1];
            const avgBpm = 60000 / (total / (times.length - 1));
            setTempo(Math.min(Math.max(Math.round(avgBpm), 30), 300));
        }
    };

    return (
        <div style={{ flex: 1, background: '#0a0a0e', borderRadius: '12px', padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <h3 style={{ color: '#00d2d3', marginTop: 0, marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: '800' }}>
                <Activity size={24} /> Engine de Metrónomo Pro
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '40px', alignItems: 'start' }}>
                
                {/* COLUMNA 1: CONTROLES PRINCIPALES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Tempo */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '40px 30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '5rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '20px', display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
                            {tempo} <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: '600', marginBottom: '10px' }}>BPM</span>
                        </div>
                        
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <button onClick={() => setTempo(t => Math.max(t - 1, 30))} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 'bold', transition: '0.2s', flexShrink: 0 }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.15)'} onMouseLeave={e => e.target.style.background='rgba(255,255,255,0.08)'}>-</button>
                            <input 
                                type="range" min="30" max="300" value={tempo} 
                                onChange={e => setTempo(Number(e.target.value))}
                                style={{ flex: 1, accentColor: '#00d2d3', cursor: 'pointer' }}
                            />
                            <button onClick={() => setTempo(t => Math.min(t + 1, 300))} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 'bold', transition: '0.2s', flexShrink: 0 }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.15)'} onMouseLeave={e => e.target.style.background='rgba(255,255,255,0.08)'}>+</button>
                        </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button 
                            onClick={toggleMetronome}
                            style={{ 
                                flex: 1.5, background: isPlaying ? 'rgba(0, 210, 211, 0.05)' : '#00d2d3', 
                                color: isPlaying ? '#00d2d3' : '#020617', border: isPlaying ? '1px solid #00d2d3' : '1px solid #00d2d3', 
                                padding: '18px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                transition: 'all 0.2s', boxShadow: isPlaying ? 'none' : '0 4px 15px rgba(0,210,211,0.3)'
                            }}
                        >
                            {isPlaying ? <><Square fill="currentColor" size={20} /> DETENER</> : <><Play fill="currentColor" size={20} /> INICIAR</>}
                        </button>

                        <button 
                            onClick={handleTapTempo}
                            style={{ 
                                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                                color: '#fff', padding: '18px', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', transition: '0.2s'
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                        >
                            TAP TEMPO
                        </button>
                    </div>

                    {/* Master Volume & Panning */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <Volume2 size={20} color="#94a3b8" />
                                <span style={{ color: '#e2e8f0', fontWeight: '600', width: '60px' }}>Master</span>
                                <input type="range" min="0" max="1" step="0.01" value={vol} onChange={e => setVol(Number(e.target.value))} style={{ flex: 1, accentColor: '#00d2d3' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <Sliders size={20} color="#94a3b8" />
                                <span style={{ color: '#e2e8f0', fontWeight: '600', width: '60px' }}>Paneo</span>
                                <input type="range" min="-1" max="1" step="0.1" value={pan} onChange={e => setPan(Number(e.target.value))} style={{ flex: 1, accentColor: '#00d2d3' }} />
                                <button onClick={() => setPan(0)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 'bold', transition: '0.2s', flexShrink: 0 }} onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.background = 'rgba(255,255,255,0.1)' }} onMouseLeave={e => { e.target.style.color = '#94a3b8'; e.target.style.background = 'rgba(255,255,255,0.05)' }}>RESET</button>
                                <span style={{ color: '#00d2d3', fontWeight: '800', width: '45px', textAlign: 'right', fontSize: '0.8rem' }}>
                                    {pan < 0 ? `L${Math.round(Math.abs(pan)*100)}%` : pan > 0 ? `R${Math.round(pan*100)}%` : 'CTR'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>


                {/* COLUMNA 2: MIXER INTERNO Y FIRMA DE TIEMPO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Time Signature & Subdivisions */}
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Compás</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { label: '3/4', v: 3 },
                                    { label: '4/4', v: 4 },
                                    { label: '5/8', v: 5 },
                                    { label: '6/8', v: 6 }
                                ].map(sig => (
                                    <button 
                                        key={sig.v} onClick={() => setBeatsPerBar(sig.v)}
                                        style={{ background: beatsPerBar === sig.v ? 'rgba(0,210,211,0.1)' : 'rgba(255,255,255,0.03)', border: beatsPerBar === sig.v ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.05)', color: beatsPerBar === sig.v ? '#00d2d3' : '#cbd5e1', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        {sig.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Subdivisión</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { label: '♩ Negras', v: 1 },
                                    { label: '♫ Corcheas', v: 2 },
                                    { label: '♬ Tresillos', v: 3 },
                                    { label: '♬ Semicorcheas', v: 4 }
                                ].map(sub => (
                                    <button 
                                        key={sub.v} onClick={() => setSubType(sub.v)}
                                        style={{ textAlign: 'left', background: subType === sub.v ? 'rgba(0,210,211,0.1)' : 'rgba(255,255,255,0.03)', border: subType === sub.v ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.05)', color: subType === sub.v ? '#00d2d3' : '#cbd5e1', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                                    >
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Metronome Mixer */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}><Hash size={16} /> Mezclador de Click</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '150px', gap: '15px' }}>
                            {/* Acento */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: '100%' }}>
                                <input type="range" min="0" max="1" step="0.01" value={volAccent} onChange={e => setVolAccent(Number(e.target.value))} style={{ writingMode: 'vertical-lr', direction: 'rtl', flex: 1, accentColor: '#00d2d3', cursor: 'pointer' }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: volAccent > 0 ? '#00d2d3' : '#64748b' }}>ACENTO</span>
                            </div>
                            {/* Pulso Normal */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: '100%' }}>
                                <input type="range" min="0" max="1" step="0.01" value={volQuarter} onChange={e => setVolQuarter(Number(e.target.value))} style={{ writingMode: 'vertical-lr', direction: 'rtl', flex: 1, accentColor: '#cbd5e1', cursor: 'pointer' }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: volQuarter > 0 ? '#cbd5e1' : '#64748b' }}>PULSO</span>
                            </div>
                            {/* Subdivision */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: '100%' }}>
                                <input type="range" min="0" max="1" step="0.01" value={volSub} onChange={e => setVolSub(Number(e.target.value))} style={{ writingMode: 'vertical-lr', direction: 'rtl', flex: 1, accentColor: '#94a3b8', cursor: 'pointer' }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: volSub > 0 ? '#94a3b8' : '#64748b' }}>SUBDIV</span>
                            </div>
                        </div>
                    </div>

                    {/* Sound Selector */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
                        {['classic', 'woodblock', 'digital'].map(type => (
                            <button
                                key={type} onClick={() => setClickSound(type)}
                                style={{ flex: 1, background: clickSound === type ? 'rgba(0,210,211,0.1)' : 'rgba(255,255,255,0.03)', border: clickSound === type ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.05)', color: clickSound === type ? '#00d2d3' : '#94a3b8', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', transition: '0.2s' }}
                            >
                                {type === 'classic' ? 'Clásico' : type === 'woodblock' ? 'Madera' : 'Digital'}
                            </button>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
