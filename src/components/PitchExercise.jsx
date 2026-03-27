import React, { useState, useEffect, useRef } from 'react';
import { PitchDetector } from '../utils/PitchDetector';
import AcademyGuide from '../components/AcademyGuide';

const PitchExercise = ({ targetNote = "A", onComplete }) => {
    const [currentNote, setCurrentNote] = useState("-");
    const [matchProgress, setMatchProgress] = useState(0);
    const [error, setError] = useState(null);
    
    const audioCtxRef = useRef(null);
    const detectorRef = useRef(null);
    const requestRef = useRef(null);

    useEffect(() => {
        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                detectorRef.current = new PitchDetector(audioCtxRef.current);
                await detectorRef.current.start(stream);
                update();
            } catch (err) {
                console.warn(err);
                setError("No se pudo acceder al micrófono. Por favor permite el acceso.");
            }
        };

        const update = () => {
            if (detectorRef.current) {
                const result = detectorRef.current.getPitch();
                if (result) {
                    setCurrentNote(result.note);
                    if (result.note === targetNote) {
                        setMatchProgress(prev => Math.min(prev + 2, 100));
                    } else {
                        setMatchProgress(prev => Math.max(prev - 1, 0));
                    }
                } else {
                    setCurrentNote("-");
                }
            }
            requestRef.current = requestAnimationFrame(update);
        };

        initAudio();

        return () => {
            cancelAnimationFrame(requestRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, [targetNote]);

    useEffect(() => {
        if (matchProgress >= 100) {
            onComplete();
        }
    }, [matchProgress, onComplete]);

    return (
        <div className="exercise-card">
            <AcademyGuide message={`¡Canta o toca una nota ${targetNote}! Mantén la afinación para completar el círculo.`} />
            
            <div className="pitch-visualizer">
                <div className="target-display">
                    <span className="label">Objetivo</span>
                    <span className="big-note">{targetNote}</span>
                </div>
                
                <div className="match-circle">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" className="bg-ring" />
                        <circle cx="50" cy="50" r="45" className="progress-ring" 
                            style={{ strokeDasharray: 283, strokeDashoffset: 283 - (283 * matchProgress / 100) }} />
                    </svg>
                    <div className="current-note">{currentNote}</div>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <style jsx>{`
                .exercise-card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(15px);
                    padding: 2.5rem;
                    border-radius: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: center;
                    max-width: 500px;
                    margin: 0 auto;
                }
                .pitch-visualizer {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    margin-top: 2rem;
                }
                .big-note {
                    font-size: 4rem;
                    font-weight: 900;
                    color: #00f2fe;
                    display: block;
                    text-shadow: 0 0 20px rgba(0, 242, 254, 0.5);
                }
                .match-circle {
                    position: relative;
                    width: 150px;
                    height: 150px;
                }
                svg {
                    transform: rotate(-90deg);
                }
                circle {
                    fill: none;
                    stroke-width: 8;
                }
                .bg-ring { stroke: rgba(255, 255, 255, 0.1); }
                .progress-ring {
                    stroke: #00f2fe;
                    stroke-linecap: round;
                    transition: stroke-dashoffset 0.1s;
                }
                .current-note {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 2.5rem;
                    font-weight: bold;
                }
                .error-msg {
                    color: #ff4b2b;
                    margin-top: 1rem;
                    font-size: 0.8rem;
                }
            `}</style>
        </div>
    );
};

export default PitchExercise;
