import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ShoppingCart, Search, Music2, ArrowLeft, X, CheckCircle2 } from 'lucide-react';
import Footer from '../components/Footer';

const SongCard = ({ song, onBuy, navigate }) => {
    return (
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer', height: '100%' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ height: '180px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {song.coverUrl ? (
                    <img src={song.coverUrl} alt={song.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #13b5b6, #9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Music2 size={48} color="rgba(255,255,255,0.3)" />
                    </div>
                )}
                <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800', backdropFilter: 'blur(4px)' }}>{song.tempo ? `${song.tempo} BPM` : 'BPM variable'}</div>
            </div>
            <div style={{ padding: '15px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</h3>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Artista: {song.artist}</div>
                <div
                    onClick={(e) => { e.stopPropagation(); navigate(`/seller/${song.userId}`); }}
                    style={{ color: '#00d2d3', fontSize: '0.8rem', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }}
                >
                    Vendido por: {song.sellerName || 'Vendedor Zion'} • <span style={{ textDecoration: 'underline' }}>Ver tienda</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>${song.price || '9.99'}</div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onBuy(); }}
                        style={{ background: '#00d2d3', border: 'none', color: '#000', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function Store() {
    const navigate = useNavigate();
    const [storeSongs, setStoreSongs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false); // Nuevo: Estado para dropdown de usuario

    // Nueva lógica de carrito
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [toast, setToast] = useState(null); // { message, type }

    useEffect(() => {
        const savedCart = localStorage.getItem('zion_cart');
        if (savedCart) {
            try { setCart(JSON.parse(savedCart)); } catch (e) { setCart([]); }
        }
    }, []);

    const addToCart = (song) => {
        setCart(prev => {
            if (prev.some(item => item.id === song.id)) return prev;
            const newCart = [...prev, { id: song.id, name: song.name, artist: song.artist, price: song.price || 9.99, coverUrl: song.coverUrl }];
            localStorage.setItem('zion_cart', JSON.stringify(newCart));
            return newCart;
        });

        // Mostrar notificación visual en lugar de alert
        setToast({ message: `"${song.name}" añadida al carrito`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
    };

    const removeFromCart = (id) => {
        setCart(prev => {
            const newCart = prev.filter(item => item.id !== id);
            localStorage.setItem('zion_cart', JSON.stringify(newCart));
            return newCart;
        });
    };

    const cartTotal = cart.reduce((acc, item) => acc + (parseFloat(item.price) || 9.99), 0).toFixed(2);


    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });

        const q = collection(db, 'songs');
        const unsubSongs = onSnapshot(q, (snap) => {
            const songs = [];
            snap.forEach(doc => {
                const data = doc.data();
                const loggedUser = auth.currentUser;
                const isOwner = loggedUser && data.userId === loggedUser.uid;
                const isAdmin = loggedUser?.email === 'ueservicesllc1@gmail.com';
                
                // REGLA: Mostrar en Store si es Global, si es para Venta, o si soy el dueño/admin
                if (data.isGlobal || data.forSale || isOwner || isAdmin) {
                    songs.push({ 
                        id: doc.id, 
                        ...data, 
                        isPending: data.status === 'pending_review' || data.status === 'pending'
                    });
                }
            });
            // Ordenar por fecha: nuevos arriba
            const sorted = songs.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
            setStoreSongs(sorted);
        });

        return () => { unsubAuth(); unsubSongs(); };
    }, []);

    const handleCheckoutCart = () => {
        if (!currentUser) {
            setToast({ message: "Debes iniciar sesión para comprar", type: 'error' });
            setTimeout(() => setToast(null), 3000);
            navigate('/dashboard');
            return;
        }
        if (cart.length === 0) return;
        navigate('/checkout');
    };

    const filteredStore = storeSongs.filter(s =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>

            {/* NOTIFICACIÓN TIPO TOAST */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    background: '#1e293b', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#00d2d3'}`, color: 'white',
                    padding: '12px 24px', borderRadius: '50px', zIndex: 5000,
                    boxShadow: '0 10px 30px rgba(0,0,10,0.5)', display: 'flex', alignItems: 'center', gap: '12px',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: toast.type === 'error' ? '#ef4444' : '#00d2d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {toast.type === 'error' ? <X size={14} color="white" /> : <CheckCircle2 size={16} color="black" />}
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 50px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>

            <nav style={{
                padding: '15px 40px',
                background: '#0f172a',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <img src="/zion-logo-white.png" alt="Zion Stage" style={{ height: '36px' }} />
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', borderRadius: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.85rem' }}
                    >
                        <ArrowLeft size={16} /> Volver al Inicio
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ position: 'relative' }} className="hide-mobile">
                        <input
                            type="text"
                            placeholder="Buscar en el marketplace..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 15px 10px 40px', borderRadius: '30px', width: '250px', fontSize: '0.9rem' }}
                        />
                        <Search size={16} style={{ position: 'absolute', top: '11px', left: '15px', color: '#64748b' }} />
                    </div>

                    <button
                        onClick={() => navigate('/checkout')}
                        style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', cursor: 'pointer' }}
                    >
                        <ShoppingCart size={18} />
                        {cart.length > 0 && (
                            <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#00d2d3', color: '#000', fontSize: '0.7rem', fontWeight: '900', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a' }}>
                                {cart.length}
                            </span>
                        )}
                    </button>

                    {currentUser && (
                        <div style={{ position: 'relative' }}>
                            <div
                                onClick={() => setShowDropdown(!showDropdown)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '5px 5px 5px 12px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#e2e8f0' }} className="hide-mobile">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#00d2d3,#9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.8rem' }}>
                                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                                </div>
                            </div>

                            {showDropdown && (
                                <div style={{ position: 'absolute', top: '45px', right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 2000 }}>
                                    <div
                                        onClick={() => navigate('/dashboard')}
                                        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.9rem', fontWeight: '600', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                                    >
                                        <Globe size={16} color="#94a3b8" /> Dashboard
                                    </div>
                                    <div
                                        onClick={() => auth.signOut()}
                                        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', fontWeight: '600' }}
                                    >
                                        <LogOut size={16} /> Cerrar Sesión
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            <header style={{ padding: '60px 40px', textAlign: 'center', background: 'radial-gradient(circle at center, rgba(0,210,211,0.1), transparent)' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '20px' }}>Pistas Premium Multitrack</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>Descubre y compra secuencias directamente de los creadores originales, listas para nuestro potente motor de audio.</p>
            </header>

            <style>{`
                .store-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 25px;
                    padding: 20px 40px;
                }
                @media (max-width: 1400px) {
                    .store-grid { grid-template-columns: repeat(4, 1fr); }
                }
                @media (max-width: 1100px) {
                    .store-grid { grid-template-columns: repeat(3, 1fr); }
                }
                @media (max-width: 800px) {
                    .store-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 500px) {
                    .store-grid { grid-template-columns: repeat(1, 1fr); }
                }
            `}</style>

            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {searchQuery ? (
                    <div style={{ padding: '40px' }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '30px' }}>Resultados de búsqueda</h2>
                        <div className="store-grid" style={{ padding: '0' }}>
                            {filteredStore.map(song => (
                                <SongCard key={song.id} song={song} onBuy={() => addToCart(song)} navigate={navigate} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ paddingBottom: '80px' }}>
                        <div style={{ marginTop: '40px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', marginBottom: '10px' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: '900' }}>Catálogo de Canciones</h2>
                                {storeSongs.length > 0 && (
                                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{storeSongs.length} temas disponibles</span>
                                )}
                            </div>
                            
                            <div className="store-grid">
                                {storeSongs.length > 0 ? (
                                    storeSongs.map(song => (
                                        <div key={song.id}>
                                            <SongCard song={song} onBuy={() => addToCart(song)} navigate={navigate} />
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: '1/-1', padding: '100px 0', textAlign: 'center', color: '#64748b' }}>
                                        <Music2 size={48} style={{ margin: '0 auto 15px', opacity: 0.2 }} />
                                        <p>No hay canciones disponibles en este momento.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
}



