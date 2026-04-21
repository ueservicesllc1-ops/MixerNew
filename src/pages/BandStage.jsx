import React, { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff, Music } from 'lucide-react';

export default function BandStage() {
    const [syncState, setSyncState] = useState({
        songName: 'Esperando conexión...',
        time: 0,
        isPlaying: false,
        activeMarkerLabel: 'INTRO',
        lyricsSection: 'Alineate con el líder...'
    });
    
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        const connect = () => {
            // Attempt to connect mapping directly to the tablet's local websocket
            const wsUrl = `ws://${window.location.hostname}:${window.location.port}/ws`;
            
            try {
                const ws = new WebSocket(wsUrl);
                
                ws.onopen = () => setConnected(true);
                
                ws.onclose = () => {
                    setConnected(false);
                    // Reconnect automatically if church router flinches
                    setTimeout(connect, 2000);
                };
                
                ws.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        setSyncState(prev => ({ ...prev, ...data }));
                    } catch (err) {
                        console.error('Invalid WS payload', err);
                    }
                };
                
                ws.onerror = (err) => console.log('WS Error', err);
                wsRef.current = ws;
            } catch (error) {
                console.log('No websocket available immediately, waiting...');
            }
        };

        connect();
        
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // Simple time formatter
    const formatTime = (seconds) => {
        if (!seconds) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{
            background: '#040b16',
            minHeight: '100vh',
            width: '100vw',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden'
        }}>
            {/* Top Bar - Minimal */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '15px 25px', background: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Music size={24} color="#00bcd4" />
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', letterSpacing: '1px' }}>
                        ZION <span style={{ color: '#00bcd4' }}>BAND</span>
                    </h2>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {formatTime(syncState.time)}
                    </span>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        padding: '6px 12px', borderRadius: '20px',
                        color: connected ? '#10b981' : '#ef4444',
                        fontWeight: 'bold', fontSize: '0.85rem'
                    }}>
                        {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
                        {connected ? 'Zion Sync ACTIVO' : 'Desconectado'}
                    </div>
                </div>
            </div>

            {/* Giant Center Stage Teleprompter */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center',
                padding: '40px', textAlign: 'center'
            }}>
                <div style={{
                    background: syncState.isPlaying ? 'rgba(0,188,212,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${syncState.isPlaying ? 'rgba(0,188,212,0.5)' : 'transparent'}`,
                    padding: '8px 20px', borderRadius: '30px', 
                    fontSize: '1.5rem', fontWeight: '900', color: '#00bcd4',
                    marginBottom: '20px', letterSpacing: '4px', textTransform: 'uppercase',
                    transition: 'all 0.3s ease'
                }}>
                    {syncState.activeMarkerLabel || 'Cargando'}
                </div>
                
                <h1 style={{ 
                    fontSize: '4rem', fontWeight: '900', margin: '0 0 40px 0',
                    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    background: 'linear-gradient(to right, #fff, #94a3b8)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                }}>
                    {syncState.songName}
                </h1>
                
                {/* Lyrics / Chords area */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '40px', borderRadius: '24px', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    width: '100%', maxWidth: '800px',
                    minHeight: '300px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                }}>
                    <p style={{
                        fontSize: '3rem', fontWeight: 'bold', 
                        lineHeight: '1.4', margin: 0, color: '#e2e8f0',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {syncState.lyricsSection}
                    </p>
                </div>
            </div>
        </div>
    );
}
