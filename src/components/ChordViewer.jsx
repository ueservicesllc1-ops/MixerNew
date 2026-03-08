import React, { useState, useEffect } from 'react';
import { Minus, Plus, Copy, Check, Type, RefreshCw } from 'lucide-react';
import { transposeText } from '../utils/transposer';

export default function ChordViewer({ initialText, title, artist }) {
    const [text, setText] = useState(initialText || '');
    const [transpose, setTranspose] = useState(0);
    const [fontSize, setFontSize] = useState(16);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setText(initialText);
    }, [initialText]);

    const handleTranspose = (semitones) => {
        setTranspose(prev => prev + semitones);
        setText(prev => transposeText(prev, semitones));
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Simple cleaner to remove common noise from scrapers or pastes
    const cleanText = () => {
        let cleaned = text
            .replace(/lacuerda\.net/gi, '')
            .replace(/Copyright .*/gi, '')
            .replace(/\n\s*\n/g, '\n\n') // remove excessive newlines
            .trim();
        setText(cleaned);
    };

    return (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            {/* Header / Controls */}
            <div style={{ padding: '20px 30px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{title || 'Visualizador'}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{artist || 'Artista'}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {/* Transpose Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', borderRadius: '12px', padding: '4px' }}>
                        <button onClick={() => handleTranspose(-1)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '8px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'white'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                            <Minus size={18} />
                        </button>
                        <div style={{ padding: '0 10px', minWidth: '80px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>Tono</span>
                            <span style={{ color: '#00d2d3', fontWeight: '900', fontSize: '1.1rem' }}>{transpose > 0 ? `+${transpose}` : transpose}</span>
                        </div>
                        <button onClick={() => handleTranspose(1)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '8px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'white'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                            <Plus size={18} />
                        </button>
                    </div>

                    {/* Font Size */}
                    <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', borderRadius: '12px', padding: '4px' }}>
                        <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '8px', cursor: 'pointer' }}>
                            <Type size={16} />-
                        </button>
                        <button onClick={() => setFontSize(prev => Math.min(32, prev + 2))} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '8px', cursor: 'pointer' }}>
                            <Type size={20} />+
                        </button>
                    </div>

                    <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />

                    <button onClick={cleanText} title="Limpiar formato" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
                        <RefreshCw size={18} />
                    </button>

                    <button onClick={handleCopy} style={{ background: copied ? '#10b981' : '#00d2d3', border: 'none', color: copied ? 'white' : 'black', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}>
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '40px', maxHeight: '70vh', overflowY: 'auto', backgroundColor: '#020617' }}>
                <pre style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.8',
                    fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
                    color: '#e2e8f0',
                    margin: 0
                }}>
                    {text.split('\n').map((line, i) => {
                        // Highlight lines that look like chords (simple heuristic)
                        const isChordLine = /^[A-G][#b]?(?:m|maj|min|aug|dim|sus|add|7|9|11|13| )*(?:\/?[A-G][#b]?)?$/.test(line.trim());
                        return (
                            <div key={i} style={{ color: isChordLine ? '#00d2d3' : '#e2e8f0', fontWeight: isChordLine ? '800' : '400' }}>
                                {line || ' '}
                            </div>
                        );
                    })}
                </pre>
            </div>
        </div>
    );
}
