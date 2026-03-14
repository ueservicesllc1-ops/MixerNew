import React, { useState } from 'react';
import AcademyGuide from './AcademyGuide';

const TheoryQuiz = ({ module, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [showExplanation, setShowExplanation] = useState(false);
    const [selectedOpt, setSelectedOpt] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);

    const exercise = module.exercises[currentStep];

    const handleOption = (index) => {
        if (showExplanation) return;
        setSelectedOpt(index);
        const correct = index === exercise.correct;
        setIsCorrect(correct);
        setShowExplanation(true);
    };

    const nextStep = () => {
        setShowExplanation(false);
        setSelectedOpt(null);
        setIsCorrect(null);
        if (currentStep < module.exercises.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="theory-quiz-container">
            <div className="quiz-header">
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${((currentStep + 1) / module.exercises.length) * 100}%` }}></div>
                </div>
            </div>

            <main className="quiz-body">
                <h2 className="question-text">{exercise.question}</h2>
                <div className="options-list">
                    {exercise.options.map((opt, i) => (
                        <button 
                            key={i} 
                            className={`opt-btn 
                                ${selectedOpt === i ? (isCorrect ? 'correct' : 'incorrect') : ''}
                                ${showExplanation && i === exercise.correct ? 'correct' : ''}
                            `}
                            onClick={() => handleOption(i)}
                            disabled={showExplanation}
                        >
                            <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                            <span className="opt-text">{opt}</span>
                        </button>
                    ))}
                </div>
            </main>

            {showExplanation && (
                <div className={`explanation-panel ${isCorrect ? 'correct-style' : 'wrong-style'}`}>
                    <div className="panel-inner">
                        <div className="panel-header">
                            <span className="status-icon">{isCorrect ? '✨' : '⚠️'}</span>
                            <h3>{isCorrect ? '¡Excelente!' : 'Seguimos aprendiendo'}</h3>
                        </div>
                        <p className="explanation-text">{exercise.explanation}</p>
                        <button className="next-btn" onClick={nextStep}>
                            {currentStep < module.exercises.length - 1 ? 'Siguiente' : 'Continuar'}
                        </button>
                    </div>
                </div>
            )}

            {!showExplanation && (
                <div className="guide-mini">
                    <AcademyGuide message="Escoge la opción correcta." />
                </div>
            )}

            <style>{`
                .theory-quiz-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .quiz-header { margin-bottom: 2rem; }
                .progress-bar {
                    height: 12px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 6px;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: #00f2fe;
                    transition: width 0.3s ease;
                }

                .question-text {
                    font-size: 1.4rem;
                    font-weight: 700;
                    margin-bottom: 2rem;
                    text-align: center;
                    line-height: 1.3;
                }
                .options-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding-bottom: 150px; /* Space for explanation panel */
                }
                .opt-btn {
                    padding: 1rem;
                    background: rgba(255,255,255,0.05);
                    border: 2px solid rgba(255,255,255,0.08);
                    border-radius: 18px;
                    color: white;
                    text-align: left;
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .opt-letter {
                    width: 32px; height: 32px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 0.8rem; flex-shrink: 0;
                }
                .opt-btn.correct { background: rgba(0, 242, 254, 0.2); border-color: #00f2fe; }
                .opt-btn.incorrect { background: rgba(255, 75, 43, 0.2); border-color: #ff4b2b; }

                /* Explanation Panel - Bottom Sheet for Mobile */
                .explanation-panel {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    background: #111;
                    padding: 1.5rem;
                    border-top-left-radius: 25px;
                    border-top-right-radius: 25px;
                    z-index: 1002;
                    animation: slideUp 0.3s ease-out;
                    box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
                }
                .correct-style { border-top: 5px solid #00f2fe; }
                .wrong-style { border-top: 5px solid #ff4b2b; }

                .panel-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem; }
                .panel-header h3 { margin: 0; font-size: 1.2rem; }
                .status-icon { font-size: 1.5rem; }
                .explanation-text { font-size: 0.9rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.4; }
                
                .next-btn {
                    width: 100%;
                    padding: 1.2rem;
                    background: #00f2fe;
                    color: #000;
                    border: none;
                    border-radius: 15px;
                    font-weight: 800;
                    font-size: 1rem;
                    text-transform: uppercase;
                    cursor: pointer;
                }
                .next-btn:active { transform: scale(0.98); opacity: 0.9; }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .guide-mini {
                    margin-top: 2rem;
                    transform: scale(0.85);
                }

                @media (min-width: 768px) {
                    .question-text { font-size: 2rem; }
                    .opt-btn { padding: 1.5rem; font-size: 1.2rem; }
                    .explanation-panel {
                        position: relative;
                        margin-top: 3rem;
                        border-radius: 25px;
                        animation: fadeIn 0.3s;
                    }
                    .options-list { padding-bottom: 0; }
                }
            `}</style>
        </div>
    );
};

export default TheoryQuiz;
