import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ShoppingCart, Search, Music2, Globe, ArrowLeft, Headphones } from 'lucide-react';

export default function Store() {
    const navigate = useNavigate();
    const [storeSongs, setStoreSongs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });

        // Only fetch songs that are 'active' (approved) and meant for 'sell'
        const q = query(
            collection(db, 'songs'),
            where('useType', '==', 'sell'),
            where('status', '==', 'active')
        );

        const unsubSongs = onSnapshot(q, (snap) => {
            const songs = [];
            snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
            setStoreSongs(songs);
        });

        return () => { unsubAuth(); unsubSongs(); };
    }, []);

    const filteredStore = storeSongs.filter(s =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <nav style={{ padding: '20px 40px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={() => navigate(currentUser ? '/dashboard' : '/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                        <ArrowLeft size={20} /> Volver
                    </button>
                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#00d2d3' }}>Marketplace</div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Buscar secuencias..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 15px 10px 40px', borderRadius: '30px', width: '300px' }}
                        />
                        <Search size={18} style={{ position: 'absolute', top: '10px', left: '15px', color: '#64748b' }} />
                    </div>
                    <button style={{ background: '#00d2d3', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 210, 211, 0.4)' }}>
                        <ShoppingCart size={18} />
                    </button>
                </div>
            </nav>

            <header style={{ padding: '60px 40px', textAlign: 'center', background: 'radial-gradient(circle at center, rgba(0,210,211,0.1), transparent)' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '20px' }}>Pistas Premium Multitrack</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>Descubre y compra secuencias directamente de los creadores originales, listas para nuestro potente motor de audio.</p>
            </header>

            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
                    {filteredStore.map((song) => (
                        <div key={song.id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style={{ height: '160px', background: 'linear-gradient(135deg, #13b5b6, #9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <Music2 size={64} color="rgba(255,255,255,0.3)" />
                                <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>{song.tempo ? `${song.tempo} BPM` : 'BPM variable'}</div>
                                <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>{song.key || 'Key variable'}</div>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: '800' }}>{song.name}</h3>
                                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>{song.artist}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', marginBottom: '20px' }}>
                                    <Headphones size={16} /> {song.tracks?.length || 0} pistas separadas
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#00d2d3' }}>${song.price || '9.99'}</div>
                                    <button style={{ background: 'transparent', border: '1px solid currentColor', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: '800', transition: 'background 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#000'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#fff'; }}>Ver pista</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
