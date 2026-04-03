import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { academyAudio } from '../utils/academyAudio';
import { Star, Lightbulb, ArrowRight, RefreshCcw, BookOpen, Music, Play, Ear, Layers, Keyboard, Check, X, Target, Heart } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   NOTE NAME MAPS
───────────────────────────────────────────────────────────────────────────── */
const NOTE_NAMES_ES = {
    'C3':'Do3','D3':'Re3','E3':'Mi3','F3':'Fa3','G3':'Sol3','A3':'La3','B3':'Si3',
    'C4':'Do','D4':'Re','E4':'Mi','F4':'Fa','G4':'Sol','A4':'La','B4':'Si',
    'C5':'Do5','D5':'Re5','E5':'Mi5',
    'C#4':'Do#','D#4':'Re#','F#4':'Fa#','G#4':'Sol#','A#4':'La#',
    'C#5':'Do#5','D#5':'Re#5',
};

const TypewriterText = ({ text, speed = 40 }) => {
    const [displayedText, setDisplayedText] = useState('');
    useEffect(() => {
        setDisplayedText('');
        let i = 0;
        const timer = setInterval(() => {
            setDisplayedText(text.slice(0, i + 1));
            i++;
            if (i >= text.length) clearInterval(timer);
        }, speed);
        return () => clearInterval(timer);
    }, [text, speed]);
    return <span>{displayedText}</span>;
};

const MASCOT_URL = '/mascot_sheet.png';

const Mascot = ({ pose = 'happy', size = 100, speech = null, speechStyle = {} }) => {
    const POSES = {
        'happy':      '/mascota/alegre.png',
        'celebrate':  '/mascota/feliz.png',
        'think':      '/mascota/intelectual.png',
        'confused':   '/mascota/confundido.png',
        'surprised':  '/mascota/panico.png',
        'sad':        '/mascota/triste.png',
        'sleepy':     '/mascota/dormido.png',
        'angry':      '/mascota/enojado.png',
        'teaching':   '/mascota/intelectual.png',
        'cheer':      '/mascota/feliz.png',
    };
    const src = POSES[pose] || POSES.happy;
    
    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: speech ? 50 : 0 }}>
            {speech && (
                <div style={{
                    position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%) translateY(-10px)',
                    background: '#fff', padding: '10px 16px', borderRadius: '18px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.12)', border: '2px solid #f1f5f9',
                    fontSize: 14, fontWeight: 800, color: '#1e293b', 
                    whiteSpace: 'normal', textAlign: 'center', maxWidth: 250, width: 'max-content',
                    minWidth: 80,
                    zIndex: 10, ...speechStyle
                }}>
                    <TypewriterText text={speech} />
                    {/* Tail of speech bubble */}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '10px solid #fff'
                    }} />
                </div>
            )}
            <img 
                src={src} 
                alt="Mascot"
                style={{
                    width: size, height: 'auto',
                    transform: 'translateZ(0)',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
            />
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────────
   TOP PROGRESS BAR (shared)
───────────────────────────────────────────────────────────────────────────── */
const TopBar = ({ progress, hearts, onExit }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
        zIndex: 10,
    }}>
        <button onClick={onExit} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#f1f5f9', border: 'none',
            color: '#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .2s',
        }}><X size={18}/></button>

        <div style={{ flex: 1, height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                borderRadius: 5, transition: 'width .4s ease',
            }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 12, color: '#6366f1', minWidth: 34 }}>
            {Math.round(progress)}%
        </span>

        <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ display: 'flex', opacity: i < hearts ? 1 : 0.2, color: '#ef4444' }}>
                    <Heart size={16} fill="currentColor" strokeWidth={0} />
                </span>
            ))}
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   ANSWER FEEDBACK PANEL (bottom sheet, shared)
───────────────────────────────────────────────────────────────────────────── */
const FeedbackPanel = ({ status, explanation, onContinue, onClose }) => {
    if (!explanation) return null;
    const ok = status === 'correct';
    return (
        <>
            {/* Dark overlay */}
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                zIndex: 2090, animation: 'fadeOverlay .25s ease',
            }} />

            {/* Panel */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                zIndex: 2100,
                background: ok
                    ? 'linear-gradient(160deg,#065f46 0%,#059669 50%,#10b981 100%)'
                    : 'linear-gradient(160deg,#7f1d1d 0%,#dc2626 50%,#ef4444 100%)',
                borderRadius: '28px 28px 0 0',
                padding: '0 0 max(16px, env(safe-area-inset-bottom))',
                color: '#fff',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
                animation: 'slideUp .3s cubic-bezier(.22,1,.36,1)',
                maxWidth: 480, margin: '0 auto',
            }}>
                {/* Top strip with icon + title + X */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '20px 22px 0',
                    gap: 14,
                }}>
                    {/* Big status icon */}
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        {ok ? <Star size={28} fill="currentColor" color="#fcd34d" /> : <Lightbulb size={28} />}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 }}>
                            {ok ? 'Respuesta correcta' : 'Respuesta incorrecta'}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>
                            {ok ? '¡Perfecto!' : 'Casi lo tienes'}
                        </div>
                    </div>

                    <div style={{ transform: 'translateY(-10px)' }}>
                        <Mascot 
                            pose={ok ? 'celebrate' : 'think'} 
                            size={70} 
                            speech={ok ? '¡Guau! 🎵' : 'Mmm... 🤔'}
                            speechStyle={{ fontSize: 11, padding: '4px 10px' }}
                        />
                    </div>

                    {/* X close button */}
                    <button
                        onClick={onClose}
                        title="Cerrar"
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            border: '2px solid rgba(255,255,255,0.35)',
                            color: '#fff', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    ><X size={16} strokeWidth={3}/></button>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '16px 0' }} />

                {/* Explanation */}
                <div style={{ padding: '0 22px 20px' }}>
                    <p style={{
                        fontSize: 14, lineHeight: 1.7,
                        margin: '0 0 22px',
                        opacity: 0.93,
                    }}>{explanation}</p>

                    {/* Continue button */}
                    <button
                        onClick={onContinue}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.95)',
                            color: ok ? '#065f46' : '#7f1d1d',
                            border: 'none',
                            borderRadius: 16,
                            fontWeight: 800,
                            fontSize: 16,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 10,
                            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                            transition: 'transform .15s',
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {ok ? <ArrowRight size={20} strokeWidth={2.5}/> : <RefreshCcw size={18} strokeWidth={2.5}/>}
                        {ok ? 'Continuar →' : 'Reintentar'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
                @keyframes fadeOverlay { from{opacity:0} to{opacity:1} }
            `}</style>
        </>
    );
};

/* ─────────────────────────────────────────────────────────────────────────────
   OPTIONS LIST (shared for choice exercises)
───────────────────────────────────────────────────────────────────────────── */
const OptionsList = ({ options, selected, status, correctIdx, onSelect, disabled }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400, margin: '0 auto' }}>
        {options.map((opt, i) => {
            const isSel      = selected === i;
            const isCorrect  = i === correctIdx && status !== 'idle';
            const bg =  isSel && status === 'correct' ? '#f0fdf4'
                      : isSel && status === 'wrong'   ? '#fef2f2'
                      : isCorrect                     ? '#f0fdf4'
                      : isSel                         ? '#eef2ff'
                      : '#fff';
            const border =  isSel && status === 'correct' ? '2px solid #22c55e'
                          : isSel && status === 'wrong'   ? '2px solid #ef4444'
                          : isCorrect                     ? '2px solid #22c55e'
                          : isSel                         ? '2px solid #6366f1'
                          : '2px solid #e2e8f0';
            const letterBg = isSel && status === 'correct' ? '#22c55e'
                           : isSel && status === 'wrong'   ? '#ef4444'
                           : isSel || isCorrect            ? '#6366f1'
                           : '#f1f5f9';
            const letterColor = (isSel || isCorrect) ? '#fff' : '#64748b';
            return (
                <button key={i} onClick={() => onSelect(i)} disabled={disabled}
                    style={{
                        background: bg, border, borderRadius: 15, padding: '13px 16px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        cursor: disabled ? 'default' : 'pointer',
                        textAlign: 'left', transition: 'all .18s',
                        boxShadow: '0 2px 6px rgba(0,0,0,.05)',
                    }}
                >
                    <span style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: letterBg, color: letterColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, flexShrink: 0,
                    }}>
                        {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ fontSize: 'min(15px, 4vw)', fontWeight: 600, color: '#334155', flex: 1, lineHeight: 1.3 }}>{opt}</span>
                    {isSel && status === 'correct' && <span style={{ fontSize: 16 }}>✓</span>}
                    {isSel && status === 'wrong'   && <span style={{ fontSize: 16 }}>✗</span>}
                    {!isSel && isCorrect           && <span style={{ fontSize: 16 }}>✓</span>}
                </button>
            );
        })}
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   CHECK BUTTON (shared footer)
───────────────────────────────────────────────────────────────────────────── */
const CheckBtn = ({ onCheck, ready }) => (
    <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2000,
        padding: '16px 20px max(24px, env(safe-area-inset-bottom))', 
        background: '#fff', borderTop: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'center'
    }}>
        <button onClick={onCheck} disabled={!ready}
            style={{
                width: '100%', maxWidth: 400,
                padding: '16px', borderRadius: 16, border: 'none',
                background: ready ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#e2e8f0',
                color: ready ? '#fff' : '#94a3b8',
                fontWeight: 800, fontSize: 17, cursor: ready ? 'pointer' : 'default',
                transition: 'all .25s cubic-bezier(0.4, 0, 0.2, 1)', 
                boxShadow: ready ? '0 10px 25px rgba(99,102,241,.4)' : 'none',
                transform: ready ? 'translateY(0)' : 'translateY(0)',
                active: { transform: 'scale(0.98)' }
            }}
            onMouseDown={e => ready && (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => ready && (e.currentTarget.style.transform = 'scale(1)')}
        >
            Verificar →
        </button>
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   1. THEORY EXERCISE  (type: 'choice')
   — Asks a music theory question, pick from options
───────────────────────────────────────────────────────────────────────────── */
const TheoryExercise = ({ exercise, selected, status, onSelect }) => (
    <div style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', 
        padding: '24px 20px 140px', overflowY: 'auto',
        justifyContent: 'center', minHeight: 0
    }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '0 auto' }}>
            {/* Category badge */}
            <div style={{
                background: '#ede9fe', color: '#7c3aed',
                fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
                padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 4px rgba(124, 58, 237, 0.1)'
            }}><BookOpen size={14}/> Teoría Musical</div>

            <h2 style={{
                fontSize: 'min(22px, 6vw)', fontWeight: 800, color: '#1e293b',
                marginBottom: 32, maxWidth: 380, textAlign: 'center', lineHeight: 1.4,
            }}>{exercise.q}</h2>

            <OptionsList
                options={exercise.options}
                selected={selected}
                status={status}
                correctIdx={exercise.correct}
                onSelect={onSelect}
                disabled={status !== 'idle'}
            />
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   AUDIO PLAY BUTTON + animated waveform
───────────────────────────────────────────────────────────────────────────── */
const PlayButton = ({ onClick, playing, label = 'Escuchar' }) => (
    <button onClick={onClick} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', cursor: 'pointer',
    }}>
        <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: playing
                ? 'linear-gradient(135deg,#8b5cf6,#a78bfa)'
                : 'linear-gradient(135deg,#6366f1,#818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playing
                ? '0 0 0 12px rgba(99,102,241,.15), 0 8px 20px rgba(99,102,241,.4)'
                : '0 8px 20px rgba(99,102,241,.35)',
            transition: 'all .2s',
            color: '#fff',
        }}>
            {playing ? <Music size={32} /> : <Play size={32} fill="currentColor" />}
        </div>
        {/* Mini waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 26 }}>
            {[14, 24, 18, 32, 20, 28, 16, 22].map((h, i) => (
                <div key={i} style={{
                    width: 3, borderRadius: 2,
                    background: playing ? '#6366f1' : '#cbd5e1',
                    height: playing ? h : 6,
                    animation: playing ? `barWave ${.4 + i * .06}s ease-in-out infinite alternate` : 'none',
                    transition: 'height .3s, background .2s',
                }} />
            ))}
        </div>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {playing ? 'Reproduciendo...' : label}
        </span>
        <style>{`@keyframes barWave{from{opacity:.4}to{opacity:1}}`}</style>
    </button>
);

/* ─────────────────────────────────────────────────────────────────────────────
   2. EAR TRAINING EXERCISE  (type: 'ear-choice' | 'note-id')
   — Plays a note via audio, user identifies it
───────────────────────────────────────────────────────────────────────────── */
const EarExercise = ({ exercise, selected, status, onSelect, onPlayAudio, playing }) => (
    <div style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', 
        padding: '24px 20px 140px', overflowY: 'auto',
        justifyContent: 'center', minHeight: 0
    }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '0 auto' }}>
            {/* Badge */}
            <div style={{
                background: '#fdf4ff', color: '#a21caf',
                fontSize: 11, fontWeight: 800, letterSpacing: 1,
                padding: '4px 14px', borderRadius: 100, marginBottom: 16,
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6
            }}><Ear size={14}/> Entrenamiento Auditivo</div>

            <h2 style={{
                fontSize: 'min(20px, 5.5vw)', fontWeight: 800, color: '#1e293b',
                marginBottom: 24, maxWidth: 340, textAlign: 'center', lineHeight: 1.4,
            }}>{exercise.q}</h2>

            {/* Big audio play area */}
            <div style={{
                background: 'linear-gradient(135deg,#fdf4ff,#fae8ff)',
                border: '2px solid #f5d0fe',
                borderRadius: 28, padding: '30px 40px', marginBottom: 32,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                boxShadow: '0 8px 20px rgba(162, 28, 175, 0.08)',
                width: '100%', maxWidth: 300
            }}>
                <PlayButton onClick={onPlayAudio} playing={playing} label="Toca para escuchar" />
                <p style={{ fontSize: 11, color: '#a21caf', marginTop: 14, fontWeight: 600, opacity: 0.8 }}>
                    Escucha bien antes de responder
                </p>
            </div>

            <OptionsList
                options={exercise.options}
                selected={selected}
                status={status}
                correctIdx={exercise.correct}
                onSelect={onSelect}
                disabled={status !== 'idle'}
            />
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   3. INTERVAL / CHORD EXERCISE  (type: 'interval-id')
   — Shows note names and plays them, user identifies the interval/chord type
───────────────────────────────────────────────────────────────────────────── */
const IntervalExercise = ({ exercise, selected, status, onSelect, onPlay, playing }) => {
    const notes = exercise.notes || [];
    const isChord = notes.length >= 3;
    return (
        <div style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', 
            padding: '24px 20px 140px', overflowY: 'auto',
            justifyContent: 'center', minHeight: 0
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '0 auto' }}>
                {/* Badge */}
                <div style={{
                    background: '#fff7ed', color: '#c2410c',
                    fontSize: 11, fontWeight: 800, letterSpacing: 1,
                    padding: '4px 14px', borderRadius: 100, marginBottom: 16,
                    textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6
                }}>{isChord ? <Layers size={14}/> : <Music size={14}/>} {isChord ? 'Reconocer Acorde' : 'Reconocer Intervalo'}</div>

                <h2 style={{
                    fontSize: 'min(18px, 5vw)', fontWeight: 800, color: '#1e293b',
                    marginBottom: 20, maxWidth: 340, textAlign: 'center', lineHeight: 1.4,
                }}>{exercise.q}</h2>

                {/* Note bubbles */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
                    {notes.map((n, i) => (
                        <div key={i} style={{
                            background: '#fff', border: '2px solid #fed7aa',
                            borderRadius: 16, padding: '12px 20px',
                            textAlign: 'center', boxShadow: '0 4px 12px rgba(194, 65, 12, 0.08)',
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#c2410c' }}>{NOTE_NAMES_ES[n] || n}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>{n}</div>
                        </div>
                    ))}
                </div>

                {/* Play button */}
                <div style={{
                    background: 'linear-gradient(135deg,#fff7ed,#fef3c7)',
                    border: '2px solid #fed7aa', borderRadius: 28,
                    padding: '24px 36px', marginBottom: 30,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    boxShadow: '0 8px 16px rgba(194, 65, 12, 0.05)',
                    width: '100%', maxWidth: 300
                }}>
                    <PlayButton
                        onClick={onPlay}
                        playing={playing}
                        label={isChord ? 'Escuchar acorde' : 'Escuchar intervalo'}
                    />
                </div>

                <OptionsList
                    options={exercise.options}
                    selected={selected}
                    status={status}
                    correctIdx={exercise.correct}
                    onSelect={onSelect}
                    disabled={status !== 'idle'}
                />
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────────
   4. PIANO KEYBOARD EXERCISE  (type: 'piano')
   — Interactive piano, user taps the correct key
───────────────────────────────────────────────────────────────────────────── */
const WHITE_KEYS = ['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5'];
const BLACK_KEYS = ['C#4','D#4',null,'F#4','G#4','A#4',null,'C#5','D#5'];

const PianoExercise = ({ exercise, status, onKeyPress, pressedKey, flashKey }) => {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 18px 40px', overflowY: 'auto' }}>
            {/* Badge */}
            <div style={{
                background: '#f0fdf4', color: '#166534',
                fontSize: 11, fontWeight: 800, letterSpacing: 1,
                padding: '4px 14px', borderRadius: 100, marginBottom: 20,
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6
            }}><Keyboard size={14}/> Teclado Interactivo</div>

            <h2 style={{
                fontSize: 20, fontWeight: 700, color: '#1e293b',
                marginBottom: 12, maxWidth: 340, textAlign: 'center', lineHeight: 1.45,
            }}>{exercise.q}</h2>

            {exercise.hint && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#fefce8', border: '1px solid #fde68a',
                    borderRadius: 12, padding: '8px 16px', marginBottom: 24,
                    fontSize: 13, color: '#713f12', maxWidth: 380, textAlign: 'center',
                }}>
                    <Lightbulb size={16} /> {exercise.hint}
                </div>
            )}

            {/* Status message */}
            {status === 'correct' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 14, padding: '12px 20px', marginBottom: 20, color: '#166534', fontWeight: 700, fontSize: 14 }}>
                    <Check size={18} strokeWidth={3}/> ¡Correcto! Esa es {NOTE_NAMES_ES[exercise.targetNote] || exercise.targetNote}
                </div>
            )}
            {status === 'wrong' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 14, padding: '12px 20px', marginBottom: 20, color: '#b91c1c', fontWeight: 700, fontSize: 14 }}>
                    <X size={18} strokeWidth={3}/> Eso fue {NOTE_NAMES_ES[pressedKey] || pressedKey}. Busca {NOTE_NAMES_ES[exercise.targetNote] || exercise.targetNote}
                </div>
            )}

            {/* Target note display */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'linear-gradient(135deg,#eff6ff,#eef2ff)',
                border: '2px solid #c7d2fe', borderRadius: 20,
                padding: '16px 28px', marginBottom: 32,
            }}>
                <span style={{ color: '#6366f1' }}><Target size={40}/></span>
                <div>
                    <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Encuentra esta nota</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#4338ca', lineHeight: 1 }}>
                        {NOTE_NAMES_ES[exercise.targetNote] || exercise.targetNote}
                    </div>
                </div>
            </div>

            {/* Piano */}
            <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 10 }}>
                <div style={{ position: 'relative', display: 'inline-flex', userSelect: 'none', padding: '0 10px' }}>
                    {/* White keys */}
                    {WHITE_KEYS.map((note) => {
                        const isFlash   = flashKey === note;
                        const isPressed = pressedKey === note;
                        const isTarget  = note === exercise.targetNote;
                        let bg = '#fff';
                        if (isFlash)   bg = '#bbf7d0';
                        else if (isPressed) bg = '#c7d2fe';
                        return (
                            <div key={note} onClick={() => onKeyPress(note)} style={{
                                width: 46, height: 136,
                                background: bg,
                                border: `2px solid ${isFlash ? '#22c55e' : isTarget && status === 'idle' ? '#6366f1' : '#cbd5e1'}`,
                                borderRadius: '0 0 10px 10px',
                                cursor: 'pointer',
                                position: 'relative', zIndex: 1, marginRight: 3,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'flex-end',
                                paddingBottom: 8,
                                boxShadow: isPressed ? 'none' : '0 5px 10px rgba(0,0,0,.12)',
                                transform: isPressed ? 'translateY(3px)' : 'none',
                                transition: 'all .1s',
                            }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: isFlash ? '#166534' : '#64748b' }}>
                                    {NOTE_NAMES_ES[note] || note}
                                </span>
                            </div>
                        );
                    })}

                    {/* Black keys */}
                    {BLACK_KEYS.map((note, i) => {
                        if (!note) return null;
                        const isFlash   = flashKey === note;
                        const isPressed = pressedKey === note;
                        const left = (i + 1) * 49 - 17;
                        return (
                            <div key={note} onClick={() => onKeyPress(note)} style={{
                                position: 'absolute', left, top: 0,
                                width: 32, height: 90,
                                background: isFlash ? '#bbf7d0' : isPressed ? '#a5b4fc' : '#1e1b4b',
                                borderRadius: '0 0 8px 8px',
                                zIndex: 2, cursor: 'pointer',
                                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                                paddingBottom: 6,
                                boxShadow: isPressed ? 'none' : '0 5px 8px rgba(0,0,0,.45)',
                                transform: isPressed ? 'translateY(3px)' : 'none',
                                transition: 'all .1s',
                            }}>
                                <span style={{ fontSize: 9, color: isFlash ? '#166534' : '#94a3b8', fontWeight: 700 }}>
                                    {NOTE_NAMES_ES[note]?.replace(/[0-9]/g,'') || note}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
                Toca las teclas para escuchar el sonido
            </p>
        </div>
    );
};

const QUIZ_INIT = { selected: null, status: 'idle', explanation: null, pressedKey: null, flashKey: null, playing: false };
const quizReducer = (state, action) => {
    switch (action.type) {
        case 'RESET': return { ...QUIZ_INIT };
        case 'SET': return { ...state, ...action.payload };
        default: return state;
    }
};

const ExercisePlayer = ({ exercise, onCorrect, onWrong, onExit, progress, hearts }) => {
    const [quiz, dispatch] = useReducer(quizReducer, QUIZ_INIT);
    const { selected, status, explanation, pressedKey, flashKey, playing } = quiz;
    const setSelected    = (v) => dispatch({ type: 'SET', payload: { selected: v } });
    const setStatus      = (v) => dispatch({ type: 'SET', payload: { status: v } });
    const setExplanation = (v) => dispatch({ type: 'SET', payload: { explanation: v } });
    const setPressedKey  = (v) => dispatch({ type: 'SET', payload: { pressedKey: v } });
    const setFlashKey    = (v) => dispatch({ type: 'SET', payload: { flashKey: v } });
    const setPlaying     = (v) => dispatch({ type: 'SET', payload: { playing: v } });
    const autoRef = useRef(false);

    /* Reset every time exercise changes — single dispatch avoids cascading renders */
    useEffect(() => {
        dispatch({ type: 'RESET' });
        autoRef.current = false;
    }, [exercise]);

    /* ── Audio helpers — declared before the useEffect that calls them ── */
    const playNote = useCallback(async () => {
        if (playing) return;
        const note = exercise?.audio1 || exercise?.audio;
        if (!note || note.includes('-')) return; // skip placeholder IDs like 'scale-C'
        setPlaying(true);
        await academyAudio.playNote(note, '2n');
        setTimeout(() => setPlaying(false), 1400);
    }, [exercise, playing]);

    const playInterval = useCallback(async () => {
        if (playing) return;
        const notes = exercise?.notes || [];
        if (!notes.length) return;
        setPlaying(true);
        const isChord = notes.length >= 3;
        if (isChord) {
            await academyAudio.playChord(notes, '2n');
            setTimeout(() => setPlaying(false), 1400);
        } else {
            await academyAudio.playInterval(notes[0], notes[1]);
            setTimeout(() => setPlaying(false), 1800);
        }
    }, [exercise, playing]);

    /* Auto-play audio on ear / interval exercises */
    useEffect(() => {
        if (autoRef.current) return;
        const t = exercise?.type;
        if (t === 'ear-choice' || t === 'note-id') {
            const tid = setTimeout(() => { playNote(); autoRef.current = true; }, 700);
            return () => clearTimeout(tid);
        }
        if (t === 'interval-id') {
            const tid = setTimeout(() => { playInterval(); autoRef.current = true; }, 700);
            return () => clearTimeout(tid);
        }
    }, [exercise, playNote, playInterval]);

    /* ── Choice logic ── */
    const handleSelect = (i) => {
        if (status !== 'idle') return;
        setSelected(i);
    };

    const handleCheck = async () => {
        if (selected === null || status !== 'idle') return;
        const ok = selected === exercise.correct;
        setStatus(ok ? 'correct' : 'wrong');
        setExplanation(exercise.explanation || (ok ? '¡Muy bien! Sigue así.' : 'La respuesta era otra. ¡Sigue practicando!'));
        if (ok) await academyAudio.playCorrect();
        else    await academyAudio.playWrong();
        // NO auto-advance — user closes the panel with Continue or X
    };

    /* Called by FeedbackPanel "Continuar" or X (close) buttons */
    const handleFeedbackContinue = () => {
        const ok = status === 'correct';
        setStatus('idle');
        setSelected(null);
        setExplanation(null);
        if (ok) onCorrect();
        else    onWrong();
    };

    const handleFeedbackClose = () => {
        const ok = status === 'correct';
        setStatus('idle');
        setSelected(null);
        setExplanation(null);
        if (ok) onCorrect();
        else    onWrong();
    };

    /* ── Piano key handler ── */
    const handlePianoKey = async (note) => {
        if (status !== 'idle') return;
        setPressedKey(note);
        await academyAudio.playNote(note, '4n');

        if (note === exercise.targetNote) {
            setFlashKey(note);
            setStatus('correct');
            setExplanation(exercise.explanation || `¡Correcto! Esa es la nota ${NOTE_NAMES_ES[note] || note}.`);
            await academyAudio.playCorrect();
            // User must press Continue
        } else {
            setStatus('wrong');
            setExplanation(`Eso fue ${NOTE_NAMES_ES[note] || note}. Busca ${NOTE_NAMES_ES[exercise.targetNote] || exercise.targetNote}. ${exercise.hint || ''}`);
            await academyAudio.playWrong();
            // User must press Continue
        }
    };

    /* Piano feedback dismiss */
    const handlePianoFeedbackContinue = () => {
        const ok = status === 'correct';
        setStatus('idle');
        setPressedKey(null);
        setFlashKey(null);
        setExplanation(null);
        if (ok) onCorrect();
        else    onWrong();
    };

    /* ── Determine which exercise UI to show ── */
    const exType = exercise?.type || 'choice';

    return (
        <div style={{ 
            height: '100dvh', 
            display: 'flex', 
            flexDirection: 'column', 
            background: '#fff',
            position: 'relative',
            overflow: 'hidden'
        }}>
           <div style={{ zIndex: 100, background: '#fff' }}>
                <TopBar progress={progress} hearts={hearts} onExit={onExit} />
           </div>

           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#f8fafc' }}>

            {/* --- THEORY --- */}
            {exType === 'choice' && (
                <TheoryExercise
                    exercise={exercise}
                    selected={selected}
                    status={status}
                    onSelect={handleSelect}
                />
            )}

            {/* --- EAR TRAINING (single note) --- */}
            {(exType === 'ear-choice' || exType === 'note-id') && (
                <EarExercise
                    exercise={exercise}
                    selected={selected}
                    status={status}
                    onSelect={handleSelect}
                    onPlayAudio={playNote}
                    playing={playing}
                />
            )}

            {/* --- INTERVAL / CHORD --- */}
            {exType === 'interval-id' && (
                <IntervalExercise
                    exercise={exercise}
                    selected={selected}
                    status={status}
                    onSelect={handleSelect}
                    onPlay={playInterval}
                    playing={playing}
                />
            )}

            {/* --- PIANO KEYBOARD --- */}
            {exType === 'piano' && (
                <PianoExercise
                    exercise={exercise}
                    status={status}
                    onKeyPress={handlePianoKey}
                    pressedKey={pressedKey}
                    flashKey={flashKey}
                />
            )}

            {/* Feedback panel — choice-based exercises */}
            {exType !== 'piano' && explanation && (
                <FeedbackPanel
                    status={status}
                    explanation={explanation}
                    onContinue={handleFeedbackContinue}
                    onClose={handleFeedbackClose}
                />
            )}

            {/* Feedback panel — piano exercise */}
            {exType === 'piano' && explanation && (
                <FeedbackPanel
                    status={status}
                    explanation={explanation}
                    onContinue={handlePianoFeedbackContinue}
                    onClose={handlePianoFeedbackContinue}
                />
            )}

            {/* Check button — only when no feedback showing */}
            {exType !== 'piano' && status === 'idle' && (
                <CheckBtn onCheck={handleCheck} ready={selected !== null} />
            )}
           </div>
        </div>
    );
};

export default ExercisePlayer;
