import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldAlert, Users, Music2, Settings2, Trash2, CheckCircle2, ListMusic } from 'lucide-react';

export default function Admin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [songs, setSongs] = useState([]);
    const [masterArtists, setMasterArtists] = useState([]);
    const [newArtistName, setNewArtistName] = useState('');
    const [contacts, setContacts] = useState([]);
    const [libraryChords, setLibraryChords] = useState([]); // Nuevo: Cifrados importados
    const [activeTab, setActiveTab] = useState('pending');
    const [searchUser, setSearchUser] = useState('');
    const [searchArtist, setSearchArtist] = useState('');
    const [filterLetter, setFilterLetter] = useState('ALL'); // Nuevo: Filtro por letra
    const [editingSong, setEditingSong] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', artist: '' });

    const [selectedArtist, setSelectedArtist] = useState(null);
    const [artistSongs, setArtistSongs] = useState([]);
    const [isFetchingSongs, setIsFetchingSongs] = useState(false);
    const [viewingChord, setViewingChord] = useState(null); // Nuevo: previsualizar cifrado

    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const checkAdmin = auth.onAuthStateChanged((user) => {
            if (user && user.email === 'ueservicesllc1@gmail.com') {
                console.log("Logged as Admin. UID:", user.uid);
                setIsAdmin(true);
                fetchData();
            } else {
                if (user) console.log("Logged as non-admin:", user.email, "UID:", user.uid);
                setIsAdmin(false);
            }
            setLoading(false);
        });
        return () => checkAdmin();
    }, []);

    const fetchData = async () => {
        onSnapshot(collection(db, 'users'), (snap) => {
            const u = [];
            snap.forEach(doc => u.push({ id: doc.id, ...doc.data() }));
            setUsers(u);
        });

        onSnapshot(collection(db, 'songs'), (snap) => {
            const s = [];
            snap.forEach(doc => s.push({ id: doc.id, ...doc.data() }));
            setSongs(s.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        onSnapshot(collection(db, 'contacts'), (snap) => {
            const c = [];
            snap.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
            setContacts(c.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        onSnapshot(collection(db, 'master_artists'), (snap) => {
            const ma = [];
            snap.forEach(doc => ma.push({ id: doc.id, ...doc.data() }));
            setMasterArtists(ma.sort((a, b) => a.name.localeCompare(b.name)));
        });

        onSnapshot(collection(db, 'chords'), (snap) => {
            const c = [];
            snap.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
            setLibraryChords(c);
        });
    };

    const syncWithLaCuerda = async () => {
        if (!window.confirm("¿Quieres traer la lista oficial de más de 1,300 artistas cristianos de LaCuerda? Solo se agregarán los que no existan.")) return;
        setIsSyncing(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://b2-proxy-mixer.vercel.app';

            const resp = await fetch(`${devProxy}/import-lacuerda-artists`);
            const data = await resp.json();

            if (data.artists) {
                let count = 0;
                // Procesar uno por uno con un pequeño retraso para no saturar la conexión
                for (const art of data.artists) {
                    const existing = masterArtists.find(a => a.name.toLowerCase() === art.name.toLowerCase());

                    if (!existing) {
                        await addDoc(collection(db, 'master_artists'), {
                            name: art.name,
                            slug: art.slug,
                            createdAt: serverTimestamp(),
                            isExternal: true
                        });
                        count++;
                        // Pequeña pausa cada 5 escrituras para dejar respirar a Firestore
                        if (count % 5 === 0) await new Promise(r => setTimeout(r, 100));
                    } else if (!existing.slug || existing.slug !== art.slug) {
                        await updateDoc(doc(db, 'master_artists', existing.id), {
                            slug: art.slug
                        });
                        count++;
                        if (count % 5 === 0) await new Promise(r => setTimeout(r, 100));
                    }

                    if (count > 0 && count % 50 === 0) console.log(`💾 Procesados: ${count} artistas...`);
                }
                alert(`¡Éxito! Se han procesado ${count} cambios en tu biblioteca.`);
            }
        } catch (e) {
            console.error(e);
            alert("Error sincronizando: " + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const addMasterArtist = async () => {
        if (!newArtistName.trim()) return;
        try {
            await addDoc(collection(db, 'master_artists'), {
                name: newArtistName.trim(),
                createdAt: serverTimestamp()
            });
            setNewArtistName('');
        } catch (e) { alert("Error al agregar artista"); }
    };

    const deleteMasterArtist = async (id) => {
        if (!window.confirm("¿Eliminar este artista de la lista maestra?")) return;
        await deleteDoc(doc(db, 'master_artists', id));
    };

    const assignArtistToSong = async (songId, artistName) => {
        try {
            await updateDoc(doc(db, 'songs', songId), { artist: artistName });
        } catch (e) { alert("Error al asignar artista"); }
    };

    const fetchArtistSongs = async (artist) => {
        if (isFetchingSongs) return; // Evitar clics múltiples mientras carga
        if (!artist.slug) {
            alert("Este artista no tiene un slug de LaCuerda guardado.");
            return;
        }
        setSelectedArtist(artist);
        setIsFetchingSongs(true);
        setArtistSongs([]);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://b2-proxy-mixer.vercel.app';

            const resp = await fetch(`${devProxy}/list-artist-songs?slug=${artist.slug}`);
            const data = await resp.json();
            if (data.songs) {
                setArtistSongs(data.songs);
                // Dar un pequeño tiempo a React para renderizar y luego hacer scroll
                setTimeout(() => {
                    const resultsElement = document.getElementById('song-scrape-results');
                    if (resultsElement) resultsElement.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } catch (e) {
            console.error(e);
            alert("Error al cargar canciones del artista");
        } finally {
            setIsFetchingSongs(false);
        }
    };

    const importArtistSong = async (song, btnId) => {
        if (!window.confirm(`¿Importar cifrado y letra de "${song.name}" de ${selectedArtist.name}?`)) return;

        const btn = document.getElementById(btnId);
        const originalText = btn ? btn.innerText : 'IMPORTAR';
        if (btn) {
            btn.innerText = 'IMPORTANDO...';
            btn.disabled = true;
        }

        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://b2-proxy-mixer.vercel.app';

            const resp = await fetch(`${devProxy}/scrape-full-song?artistSlug=${selectedArtist.slug}&songSlug=${song.slug}`);
            if (!resp.ok) throw new Error(`Error en el servidor: ${resp.status}`);

            const data = await resp.json();

            if (data.content) {
                const docRef = await addDoc(collection(db, 'songs'), {
                    name: song.name,
                    artist: selectedArtist.name,
                    status: 'active',
                    isGlobal: true,
                    price: 9.99,
                    useType: 'sell',
                    userEmail: 'admin@zionstage.com',
                    createdAt: serverTimestamp()
                });

                await addDoc(collection(db, 'chords'), {
                    songId: docRef.id,
                    content: data.content,
                    createdAt: serverTimestamp()
                });

                alert(`✅ ¡IMPORTACIÓN EXITOSA!\n\n"${song.name}" de ${selectedArtist.name} ya está en tu biblioteca.`);
            } else {
                alert(`❌ No se pudo extraer el contenido de "${song.name}".`);
            }
        } catch (e) {
            console.error("Error importando canción:", e);
            alert(`❌ Error al importar: ${e.message}`);
        } finally {
            if (btn) {
                btn.innerText = '¡IMPORTADO!';
                btn.style.background = '#10b981';
                btn.style.color = 'white';
            }
        }
    };

    const approveSong = async (id) => {
        if (!window.confirm("¿Aprobar esta canción para la venta en Zion Stage?")) return;
        try {
            await updateDoc(doc(db, 'songs', id), {
                status: 'active',
                isGlobal: true,
                price: 9.99
            });
            alert('Canción aprobada y publicada.');
        } catch (error) { console.error(error); }
    };

    const updateCustomStorage = async (userId, val) => {
        try {
            const parsed = val ? parseFloat(val) : null;
            await updateDoc(doc(db, 'users', userId), { customStorageGB: parsed });
        } catch (error) { console.error(error); }
    };

    const deleteSong = async (id) => {
        if (!window.confirm("¿Eliminar drásticamente esta canción?")) return;
        try { await deleteDoc(doc(db, 'songs', id)); } catch (error) { console.error(error); }
    };

    if (loading) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}>Cargando Admin...</div>;
    if (!isAdmin) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}><ShieldAlert size={48} color="red" /><h2>Acceso Denegado</h2></div>;

    const pendingSongs = songs.filter(s => s.status === 'pending' && s.useType === 'sell');
    const filteredSongs = songs.filter(s =>
        s.userEmail?.toLowerCase().includes(searchUser.toLowerCase()) ||
        s.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        searchUser === ''
    );

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', padding: '40px', fontFamily: '"Outfit", sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' }}>
                <ShieldAlert size={36} color="#f1c40f" />
                <h1 style={{ margin: 0, fontWeight: '800' }}>Admin Dashboard | Zion Stage</h1>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '30px' }}>
                <button onClick={() => setActiveTab('pending')} style={{ background: activeTab === 'pending' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'pending' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Ventas ({pendingSongs.length})</button>
                <button onClick={() => setActiveTab('users')} style={{ background: activeTab === 'users' ? '#00d2d3' : 'rgba(255,255,255,0.05)', color: activeTab === 'users' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Usuarios ({users.length})</button>
                <button onClick={() => setActiveTab('artists')} style={{ background: activeTab === 'artists' ? '#f43f5e' : 'rgba(255,255,255,0.05)', color: activeTab === 'artists' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Artistas Maestros ({masterArtists.length})</button>
                <button onClick={() => setActiveTab('library')} style={{ background: activeTab === 'library' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'library' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Biblioteca CIF ({songs.filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com').length})</button>
                <button onClick={() => setActiveTab('songs')} style={{ background: activeTab === 'songs' ? '#9b59b6' : 'rgba(255,255,255,0.05)', color: activeTab === 'songs' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Curar Canciones ({songs.length})</button>
                <button onClick={() => setActiveTab('contacts')} style={{ background: activeTab === 'contacts' ? '#10b981' : 'rgba(255,255,255,0.05)', color: activeTab === 'contacts' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Mensajes ({contacts.length})</button>
            </div>

            {activeTab === 'artists' && (
                <div className="fade-in">
                    <div style={{ background: '#1e293b', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Gestionar Artistas Oficiales</h2>
                            <button
                                onClick={syncWithLaCuerda}
                                disabled={isSyncing}
                                style={{ background: '#00d2d3', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', opacity: isSyncing ? 0.5 : 1 }}
                            >
                                {isSyncing ? "Sincronizando..." : "🔄 Sincronizar con LaCuerda (1,300+ Cristianos)"}
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input value={newArtistName} onChange={e => setNewArtistName(e.target.value)} placeholder="Nombre del Artista Oficial..." style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: 'white' }} />
                            <button onClick={addMasterArtist} className="btn-teal" style={{ padding: '0 30px' }}>Agregar Artista</button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="text"
                            placeholder="🔍 Buscar por nombre entre tus 1,300+ artistas..."
                            value={searchArtist}
                            onChange={e => { setSearchArtist(e.target.value); if (e.target.value) setFilterLetter('ALL'); }}
                            style={{ width: '100%', padding: '15px 25px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1.1rem', marginBottom: '15px' }}
                        />

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px' }}>
                            {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '0-9'].map(char => (
                                <button
                                    key={char}
                                    onClick={() => { setFilterLetter(char); setSearchArtist(''); }}
                                    style={{
                                        width: '35px',
                                        height: '35px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: filterLetter === char ? '#f43f5e' : 'rgba(255,255,255,0.05)',
                                        color: filterLetter === char ? 'black' : 'white',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {char}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', maxHeight: '600px', overflowY: 'auto', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px' }}>
                        {masterArtists
                            .filter(ma => {
                                const matchesSearch = ma.name.toLowerCase().includes(searchArtist.toLowerCase());
                                if (!matchesSearch) return false;
                                if (filterLetter === 'ALL') return true;
                                if (filterLetter === '0-9') return /^[0-9]/.test(ma.name);
                                return ma.name.toUpperCase().startsWith(filterLetter);
                            })
                            .map(ma => (
                                <div key={ma.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '700' }}>{ma.name}</span>
                                        {ma.slug && <span style={{ fontSize: '0.65rem', color: '#64748b' }}>slug: {ma.slug}</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => fetchArtistSongs(ma)} style={{ background: '#00d2d3', border: 'none', color: '#000', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>LISTAR</button>
                                        <button onClick={() => deleteMasterArtist(ma.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                    </div>

                    {selectedArtist && (
                        <div id="song-scrape-results" style={{ marginTop: '40px', background: 'rgba(0,0,0,0.6)', padding: '30px', borderRadius: '30px', border: '3px solid #00d2d3', boxShadow: '0 0 50px rgba(0, 210, 211, 0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0 }}>Canciones de {selectedArtist.name}</h3>
                                <button onClick={() => setSelectedArtist(null)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>Cerrar</button>
                            </div>

                            {isFetchingSongs ? (
                                <p>Cargando lista desde LaCuerda...</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                                    {artistSongs.map((song, idx) => (
                                        <div key={`${song.slug}-${idx}`} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9rem' }}>{song.name}</span>
                                            <button
                                                id={`btn-import-${idx}`}
                                                onClick={() => importArtistSong(song, `btn-import-${idx}`)}
                                                style={{ background: '#f1c40f', border: 'none', color: '#000', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                            >
                                                IMPORTAR CIFRADO
                                            </button>
                                        </div>
                                    ))}
                                    {artistSongs.length === 0 && <p>No se encontraron canciones o el slug es incorrecto.</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'library' && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Biblioteca de Cifrados Importados</h2>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem' }}>
                            {songs.filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com').length} canciones totales
                        </span>
                    </div>

                    <div style={{ background: '#1e293b', borderRadius: '20px', padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                            {songs
                                .filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com')
                                .map(s => {
                                    const hasChords = libraryChords.some(c => c.songId === s.id);
                                    return (
                                        <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px 20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <div style={{ fontWeight: '800', fontSize: '1rem' }}>{s.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.artist}</div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: hasChords ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: hasChords ? '#10b981' : '#ef4444' }}>
                                                    {hasChords ? '✓ CON CIFRADO' : '✗ SIN CIFRADO'}
                                                </span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {hasChords && <button onClick={() => setViewingChord(libraryChords.find(c => c.songId === s.id))} style={{ background: '#00d2d3', border: 'none', color: 'black', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>VER CIFRADO</button>}
                                                    <button onClick={() => deleteSong(s.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>

                    {viewingChord && (
                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                            <div style={{ background: '#1e293b', width: '100%', maxWidth: '900px', height: '90vh', borderRadius: '30px', padding: '40px', overflowY: 'auto', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <button onClick={() => setViewingChord(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f43f5e', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>CERRAR</button>
                                <h2 style={{ marginBottom: '30px', color: '#00d2d3' }}>Previsualización del Cifrado</h2>
                                <pre style={{ background: '#0f172a', padding: '30px', borderRadius: '15px', color: '#10b981', fontFamily: 'monospace', fontSize: '1rem', whiteSpace: 'pre-wrap', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {viewingChord.content}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'songs' && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Organizar por Artista Oficial</h2>
                        <input type="text" placeholder="Buscar canción o usuario..." value={searchUser} onChange={e => setSearchUser(e.target.value)} style={{ padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 80px', padding: '15px 30px', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                            <span>Canción / Original</span>
                            <span>Asignar Artista Oficial</span>
                            <span>Usuario</span>
                            <span>Eliminar</span>
                        </div>
                        {filteredSongs.map(s => (
                            <div key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '15px 30px', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 80px', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800' }}>{s.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Original: {s.artist || '—'}</div>
                                </div>
                                <div style={{ paddingRight: '20px' }}>
                                    <select value={s.artist || ''} onChange={(e) => assignArtistToSong(s.id, e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f172a', color: 'white', border: '1px solid #334155' }}>
                                        <option value="">-- Seleccionar --</option>
                                        {masterArtists.map(ma => <option key={ma.id} value={ma.name}>{ma.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.userEmail}</div>
                                <button onClick={() => deleteSong(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', textAlign: 'right' }}><Trash2 size={20} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="fade-in">
                    <h2>Gestión de Usuarios</h2>
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                        {users.map(u => (
                            <div key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800' }}>{u.displayName || u.email}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Plan: {u.planId || 'free'}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Espacio GB:</span>
                                    <input type="number" value={u.customStorageGB || ''} onChange={(e) => updateCustomStorage(u.id, e.target.value)} style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: 'white', textAlign: 'center' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'pending' && (
                <div className="fade-in">
                    <h2>Solicitudes de Venta</h2>
                    {pendingSongs.map(song => (
                        <div key={song.id} style={{ background: 'rgba(241,196,15,0.05)', border: '1px solid rgba(241,196,15,0.2)', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div>
                                <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#f1c40f' }}>{song.name}</div>
                                <div style={{ fontSize: '0.9rem' }}>De: {song.userEmail}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => deleteSong(song.id)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Rechazar</button>
                                <button onClick={() => approveSong(song.id)} style={{ background: '#f1c40f', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Aprobar</button>
                            </div>
                        </div>
                    ))}
                    {pendingSongs.length === 0 && <p style={{ color: '#64748b' }}>No hay pendientes.</p>}
                </div>
            )}

            {activeTab === 'contacts' && (
                <div className="fade-in">
                    <h2>Mensajes</h2>
                    {contacts.map(c => (
                        <div key={c.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '15px' }}>
                            <div style={{ fontWeight: '800' }}>{c.nombre} ({c.email})</div>
                            <p style={{ color: '#94a3b8', marginTop: '10px' }}>{c.mensaje}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
