import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    ArrowLeft,
    Music2,
    FileText,
    Mic2,
    ChevronRight,
    X
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import Footer from '../components/Footer';
import ChordViewer from '../components/ChordViewer';

export default function Library() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    const [artists, setArtists] = useState([]);
    const [selectedArtist, setSelectedArtist] = useState(null);
    const [viewingChords, setViewingChords] = useState(null); // stores { text, title, artist }
    const [isLoadingChords, setIsLoadingChords] = useState(false);

    useEffect(() => {
        // Fetch all verified songs for the public library
        const q = query(
            collection(db, 'songs'),
            where('status', '==', 'active')
        );

        const unsub = onSnapshot(q, (snap) => {
            const arr = [];
            snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));

            // Sort and filter unique artists for the artist view
            const artistMap = {};
            arr.forEach(s => {
                const artistName = s.artist || 'Desconocido';
                if (!artistMap[artistName]) {
                    artistMap[artistName] = { name: artistName, count: 0, songs: [] };
                }
                artistMap[artistName].count++;
                artistMap[artistName].songs.push(s);
            });

            setArtists(Object.values(artistMap).sort((a, b) => a.name.localeCompare(b.name)));
        });

        return () => unsub();
    }, []);

    const fetchAndShowChords = async (song) => {
        setIsLoadingChords(true);
        try {
            const q = query(collection(db, 'chords'), where('songId', '==', song.id));
            const snap = await getDocs(q);
            if (!snap.empty) {
                setViewingChords({
                    text: snap.docs[0].data().text,
                    title: song.name,
                    artist: song.artist
                });
            } else {
                alert("Esta canción aún no tiene cifrado disponible en nuestra base de datos.");
            }
        } catch (e) {
            console.error(e);
            alert("Error al cargar el cifrado.");
        } finally {
            setIsLoadingChords(false);
        }
    };

    const filteredArtists = artists.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            {/* Modal for Chords */}
            {viewingChords && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                    <div style={{ width: '100%', maxWidth: '900px', position: 'relative' }}>
                        <button
                            onClick={() => setViewingChords(null)}
                            style={{ 
                                position: 'absolute', 
                                top: '-20px', 
                                right: '-20px', 
                                background: '#ef4444', 
                                border: '3px solid #0f172a', 
                                color: 'white', 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '50%', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                zIndex: 100,
                                boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <X size={24} />
                        </button>
                        <ChordViewer
                            initialText={viewingChords.text}
                            title={viewingChords.title}
                            artist={viewingChords.artist}
                        />
                    </div>
                </div>
            )}

            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2d3', fontSize: '0.95rem', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    <Music2 size={18} /> Base de Letras y Cifrados
                </div>
                {isLoadingChords && <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#00d2d3' }}>Cargando cifrado...</div>}
            </nav>

            {/* Sub-Header with Stats and Search */}
            <div style={{ background: 'linear-gradient(to bottom, #020617, #0f172a)', padding: '60px 40px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '30px' }}>
                        <div>
                            <h1 style={{ fontSize: '2.8rem', fontWeight: '900', marginBottom: '16px' }}>
                                {selectedArtist ? `Canciones de ${selectedArtist.name}` : `Explora por Artistas`}
                            </h1>
                            <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px' }}>
                                Encuentra letras y acordes verificados por el equipo de Zion Stage. Todo organizado para tu domingo.
                            </p>
                        </div>
                        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '450px' }}>
                            <Search size={20} color="#64748b" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar artistas o canciones..."
                                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1rem', flex: 1, outline: 'none', fontFamily: '"Outfit", sans-serif' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 40px' }}>

                {selectedArtist ? (
                    <div>
                        <button
                            onClick={() => setSelectedArtist(null)}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', marginBottom: '30px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <ArrowLeft size={16} /> Volver a Artistas
                        </button>

                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '8px' }}>{selectedArtist.name}</h2>
                        <p style={{ color: '#64748b', marginBottom: '40px' }}>{selectedArtist.count} canciones encontradas</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                            {selectedArtist.songs.map((song, i) => (
                                <div key={i} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', background: 'rgba(0,210,211,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={20} color="#00d2d3" />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{song.name}</h4>
                                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{song.artist}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => fetchAndShowChords(song)}
                                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Ver Cifrado
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                        {filteredArtists.map((artist, idx) => (
                            <div
                                key={idx}
                                onClick={() => setSelectedArtist(artist)}
                                style={{
                                    background: '#1e293b',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '24px',
                                    padding: '30px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                                    e.currentTarget.style.borderColor = 'rgba(0,210,211,0.3)';
                                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #00d2d3, #9b59b6)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Mic2 size={24} color="white" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0 }}>{artist.name}</h3>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '700' }}>{artist.count} Canciones</span>
                                    </div>
                                </div>
                                <ChevronRight size={20} color="#334155" />
                            </div>
                        ))}
                    </div>
                )}

                {filteredArtists.length === 0 && !selectedArtist && (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <div style={{ color: '#334155', marginBottom: '20px' }}>
                            <Search size={64} style={{ opacity: 0.5 }} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', color: '#64748b' }}>No encontramos artistas que coincidan</h2>
                        <p style={{ color: '#475569' }}>Prueba con otros términos de búsqueda.</p>
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
}
