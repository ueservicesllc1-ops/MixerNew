import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Music, FileText, Search, PlayCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export default function Recursos() {
    const navigate = useNavigate();
    const [songs, setSongs] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'songs'), (snap) => {
            const arr = [];
            snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
            // Only show active Marketplace songs for the resources preview
            setSongs(arr.filter(s => s.status === 'active'));
        });
        return () => unsub();
    }, []);

    const filtered = songs.filter(s => s.title?.toLowerCase().includes(search.toLowerCase()) || s.artist?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <BookOpen size={16} /> Recursos: Letras y Cifrados
                </div>
            </nav>

            <div style={{ background: '#020617', padding: '60px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '16px' }}>Biblioteca de Recursos</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '40px' }}>Explora el catálogo de canciones disponibles en Zion Stage y accede a sus letras y acordes creados por la comunidad.</p>

                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '600px', margin: '0 auto' }}>
                        <Search size={22} color="#64748b" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por canción o artista..."
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1rem', flex: 1, outline: 'none', fontFamily: '"Outfit", sans-serif' }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 40px 100px' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No se encontraron canciones.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {filtered.map(s => (
                            <div key={s.id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ width: '60px', height: '60px', background: s.coverUrl ? `url(${s.coverUrl}) center/cover` : 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                        {!s.coverUrl && <Music size={24} color="#64748b" style={{ margin: '18px' }} />}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: '800' }}>{s.title}</h3>
                                        <p style={{ margin: '0', color: '#94a3b8', fontSize: '0.9rem' }}>{s.artist}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => alert("Para ver letras y cifrados exactos de tu tonalidad debes adquirir la pista o suscribirte.")} style={{ background: 'rgba(0,210,211,0.1)', color: '#00d2d3', border: '1px solid rgba(0,210,211,0.2)', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>
                                        <FileText size={16} /> Ver Acordes
                                    </button>
                                    <button onClick={() => navigate('/store')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>
                                        <PlayCircle size={16} /> Obtener Pista
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
