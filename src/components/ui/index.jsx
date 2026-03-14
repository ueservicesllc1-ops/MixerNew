import React from 'react';

export const AppShell = ({ children }) => {
    return (
        <div className="academy-page">
            {children}
        </div>
    );
};

export const Card = ({ children, className = '', ...props }) => {
    return (
        <div className={`ui-card ${className}`} {...props}>
            {children}
        </div>
    );
};

export const PrimaryButton = ({ children, className = '', ...props }) => {
    return (
        <button className={`ui-button ui-button-primary ${className}`} {...props}>
            {children}
        </button>
    );
};

export const SecondaryButton = ({ children, className = '', ...props }) => {
    return (
        <button className={`ui-button ui-button-secondary ${className}`} {...props}>
            {children}
        </button>
    );
};

export const GhostButton = ({ children, className = '', ...props }) => {
    return (
        <button className={`ui-button ui-button-ghost ${className}`} {...props}>
            {children}
        </button>
    );
};

export const ProgressBar = ({ progress, className = '', ...props }) => {
    return (
        <div className={`ui-progressBar ${className}`} {...props}>
            <div className="ui-progressBar-fill" style={{ width: `${progress}%` }}></div>
        </div>
    );
};

export const StatPill = ({ icon, label, value, ...props }) => {
    return (
        <div className="ui-statPill" {...props}>
            {icon && <span className="stat-icon">{icon}</span>}
            {label && <span className="stat-label label-s">{label}</span>}
            <span className="stat-value">{value}</span>
        </div>
    );
};

export const LessonTile = ({ title, subtitle, isLocked, isCompleted, onClick }) => (
    <div className={`ui-card is-lesson ${isLocked ? 'is-locked' : ''} ${isCompleted ? 'is-completed' : ''}`} onClick={!isLocked ? onClick : undefined}>
        <div className="lesson-content">
            <h4 className="heading-m">{title}</h4>
            <p className="body-m" style={{color: 'var(--text-secondary)'}}>{subtitle}</p>
        </div>
        <div className="lesson-status">
            {isCompleted ? <span style={{color: 'var(--status-success)'}}>✓</span> : isLocked ? '🔒' : '→'}
        </div>
    </div>
);

export const LevelNode = ({ id, title, isUnlocked, isLocked, isCurrent, isCompleted, onClick, style }) => (
    <div className="node-wrapper" style={style}>
        <div 
            className={`level-node ${isCurrent ? 'is-current' : ''} ${isUnlocked ? 'is-unlocked' : ''} ${isLocked ? 'is-locked' : ''} ${isCompleted ? 'is-completed' : ''}`}
            onClick={!isLocked ? onClick : undefined}
        >
            <div className="node-inner heading-m">
                {isCompleted ? '✓' : id}
            </div>
            {isCurrent && <div className="node-label-premium body-m">{title}</div>}
        </div>
    </div>
);

export const AchievementBadge = ({ icon, title, isUnlocked }) => (
    <div className={`ui-achievement ${!isUnlocked ? 'is-locked' : ''}`}>
        <div className="ach-icon heading-l">{icon}</div>
        <div className="ach-title label-s">{title}</div>
    </div>
);
