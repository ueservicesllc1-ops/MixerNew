import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Music2, ArrowLeft, Globe, User } from 'lucide-react';
import Footer from '../components/Footer';

export default function SellerProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [seller, setSeller] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSellerData = async () => {
            try {
                // Fetch seller info from 'users' collection
                const userDoc = await getDoc(doc(db, 'users', id));
                if (userDoc.exists()) {
                    setSeller(userDoc.data());
                } else {
                    setSeller({ displayName: 'Vendedor Desconocido' });
                }

                // Fetch seller's songs (todo lo que sea global o para venta)
                const q = query(
                    collection(db, 'songs'),
                    where('userId', '==', id)
                );
                
                const querySnapshot = await getDocs(q);
                const songsData = [];
                const loggedUser = auth.currentUser;

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const isOwner = loggedUser && loggedUser.uid === id;
                    // Mostrar si es global, para venta, o soy el dueño
                    if (data.isGlobal || data.forSale || isOwner) {
                        songsData.push({ id: docSnap.id, ...data });
                    }
                });
                
                // Ordenar: nuevos primero
                setSongs(songsData.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            } catch (error) {
                console.error("Error fetching seller profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSellerData();
    }, [id]);

    if (loading) {
        return (
            <div style={{ background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #00d2d3', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
            </div>
        );
    }

    return (
        <div style={{ background: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <nav style={{ padding: '20px 40px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => navigate('/store')} className="btn-ghost" style={{ padding: '10px' }}><ArrowLeft size={20} /></button>
                <span style={{ fontWeight: '800', fontSize: '1.2rem' }}>Página del Vendedor</span>
            </nav>

            <header style={{ padding: '60px 40px', textAlign: 'center', background: 'radial-gradient(circle at center, rgba(0,210,211,0.1), transparent)' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '4px solid #00d2d3' }}>
                    <User size={64} color="#00d2d3" />
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '10px' }}>{seller?.displayName || seller?.name || 'Vendedor'}</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Socio de Zion Stage • {songs.length} pistas disponibles</p>
            </header>

            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '30px', borderLeft: '4px solid #00d2d3', paddingLeft: '15px' }}>Todas sus Pistas</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                    {songs.map((song) => (
                        <div key={song.id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style={{ height: '180px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {song.coverUrl ? (
                                    <img src={song.coverUrl} alt={song.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #13b5b6, #9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Music2 size={48} color="rgba(255,255,255,0.3)" />
                                    </div>
                                )}
                                <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}>{song.tempo ? `${song.tempo} BPM` : 'BPM variable'}</div>
                            </div>
                            <div style={{ padding: '15px' }}>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</h3>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#00d2d3' }}>${song.price || '9.99'}</div>
                                    <button
                                        onClick={() => navigate(`/store`)}
                                        style={{ background: '#00d2d3', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer' }}
                                    >
                                        Ver en Tienda
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {songs.length === 0 && (
                        <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                            <p>Este vendedor aún no tiene pistas aprobadas para la venta.</p>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
}
