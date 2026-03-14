import React, { useState } from 'react';
import { placementQuiz } from '../utils/academyLogic';
import AcademyGuide from './AcademyGuide';

const PlacementQuiz = ({ onFinish }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [totalScore, setTotalScore] = useState(0);

    const handleOption = (score) => {
        const nextScore = totalScore + score;
        if (currentStep < placementQuiz.length - 1) {
            setTotalScore(nextScore);
            setCurrentStep(currentStep + 1);
        } else {
            let level = 'initial';
            if (nextScore > 12) level = 'expert';
            else if (nextScore > 4) level = 'medium';
            onFinish(level);
        }
    };

    const currentQ = placementQuiz[currentStep];

    return (
        <div className="quiz-container">
            <div className="quiz-header">
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${((currentStep + 1) / placementQuiz.length) * 100}%` }}></div>
                </div>
                <span className="step-label">Pregunta {currentStep + 1} de {placementQuiz.length}</span>
            </div>
            
            <h2 className="question-text">{currentQ.question}</h2>
            
            <div className="options-stack">
                {currentQ.options.map((opt, i) => (
                    <button key={i} className="opt-btn" onClick={() => handleOption(opt.score)}>
                        {opt.text}
                    </button>
                ))}
            </div>

            <div className="guide-hint">
                <AcademyGuide message="No te preocupes, no es un examen, es para ayudarte." />
            </div>

            <style>{`
                .quiz-container {
                    width: 100%;
                    max-width: 500px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                }
                .quiz-header { margin-bottom: 2rem; }
                .progress-bar {
                    height: 10px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 5px;
                    margin-bottom: 0.5rem;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: #00f2fe;
                    transition: width 0.3s ease;
                }
                .step-label { font-size: 0.8rem; color: rgba(255,255,255,0.4); text-transform: uppercase; }

                .question-text {
                    font-size: 1.5rem;
                    line-height: 1.3;
                    margin-bottom: 2rem;
                    text-align: center;
                }
                .options-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }
                .opt-btn {
                    padding: 1.2rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 18px;
                    color: white;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                }
                .opt-btn:active {
                    background: rgba(0, 242, 254, 0.2);
                    border-color: #00f2fe;
                    transform: scale(0.97);
                }
                .guide-hint {
                    margin-top: 3rem;
                    transform: scale(0.9);
                }

                @media (min-width: 768px) {
                    .question-text { font-size: 2rem; }
                    .opt-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
                }
            `}</style>
        </div>
    );
};

export default PlacementQuiz;
