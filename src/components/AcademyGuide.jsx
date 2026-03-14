import React from 'react';

const AcademyGuide = ({ message }) => {
  if (!message) return null;
  return (
    <div className="guide-pro-toast">
      <div className="guide-icon-mini">💡</div>
      <div className="guide-text body-m">{message}</div>
      <style>{`
        .guide-pro-toast {
          background: var(--surface-elevated);
          border: 1px solid var(--border-subtle);
          padding: var(--space-12) var(--space-24);
          border-radius: var(--radius-pill);
          display: flex;
          align-items: center;
          gap: var(--space-12);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: slideUpGuide 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          max-width: 90%;
        }
        .guide-icon-mini { font-size: 18px; }
        .guide-text { color: var(--text-primary); font-weight: 500; }
        
        @keyframes slideUpGuide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AcademyGuide;
