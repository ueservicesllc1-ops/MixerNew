import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ShieldAlert, Users, Music2, Settings2, Trash2, CheckCircle2 } from 'lucide-react';

export default function Admin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [songs, setSongs] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchUser, setSearchUser] = useState('');

    useEffect(() => {
        const checkAdmin = auth.onAuthStateChanged((user) => {
            if (user && user.email === 'ueservicesllc1@gmail.com') {
                setIsAdmin(true);
                fetchData();
            } else {
                setIsAdmin(false);
            }
            setLoading(false);
        });
        return () => checkAdmin();
    }, []);

    const fetchData = async () => {
        // Fetch Users
        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const u = [];
            snap.forEach(doc => u.push({ id: doc.id, ...doc.data() }));
            setUsers(u);
        });

        // Fetch Songs
        const unsubSongs = onSnapshot(collection(db, 'songs'), (snap) => {
            const s = [];
            snap.forEach(doc => s.push({ id: doc.id, ...doc.data() }));
            setSongs(s.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        // Fetch Contacts
        const unsubContacts = onSnapshot(collection(db, 'contacts'), (snap) => {
            const c = [];
            snap.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
            setContacts(c.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });
    };

    const approveSong = async (id) => {
        if (!window.confirm("¿Aprobar esta canción para la venta en Zion Stage?")) return;
        try {
            await updateDoc(doc(db, 'songs', id), {
                status: 'active',
                isGlobal: true,      // It goes to the global store
                price: 9.99          // Default base price (can be edited later)
            });
            alert('Canción aprobada y publicada en la tienda globoal.');
        } catch (error) {
            console.error(error);
            alert("Error");
        }
    };

    const updateCustomStorage = async (userId, val) => {
        try {
            const parsed = val ? parseFloat(val) : null;
            await updateDoc(doc(db, 'users', userId), {
                customStorageGB: parsed
            });
        } catch (error) {
            console.error(error);
            alert("Error al actualizar espacio asignado");
        }
    };

    const deleteSong = async (id) => {
        if (!window.confirm("¿Eliminar drásticamente esta canción?")) return;
        try {
            await deleteDoc(doc(db, 'songs', id));
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}>Cargando Admin...</div>;
    if (!isAdmin) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}><ShieldAlert size={48} color="red" /><h2>Acceso Denegado</h2><p>Solo ueservicesllc1@gmail.com puede ver esto.</p></div>;

    const pendingSongs = songs.filter(s => s.status === 'pending' && s.useType === 'sell');
    const filteredSongs = songs.filter(s => s.userEmail?.toLowerCase().includes(searchUser.toLowerCase()) || searchUser === '');

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', padding: '40px', fontFamily: '"Outfit", sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' }}>
                <ShieldAlert size={36} color="#f1c40f" />
                <h1 style={{ margin: 0, fontWeight: '800' }}>Admin Dashboard | Zion Stage</h1>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <button onClick={() => setActiveTab('pending')} style={{ background: activeTab === 'pending' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'pending' ? '#000' : '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>
                    <CheckCircle2 size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Revisión de Ventas ({pendingSongs.length})
                </button>
                <button onClick={() => setActiveTab('users')} style={{ background: activeTab === 'users' ? '#00d2d3' : 'rgba(255,255,255,0.05)', color: activeTab === 'users' ? '#000' : '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>
                    <Users size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Usuarios ({users.length})
                </button>
                <button onClick={() => setActiveTab('songs')} style={{ background: activeTab === 'songs' ? '#9b59b6' : 'rgba(255,255,255,0.05)', color: activeTab === 'songs' ? '#000' : '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>
                    <Music2 size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Canciones Globales ({songs.length})
                </button>
                <button onClick={() => setActiveTab('contacts')} style={{ background: activeTab === 'contacts' ? '#10b981' : 'rgba(255,255,255,0.05)', color: activeTab === 'contacts' ? '#000' : '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>
                    💬 Mensajes ({contacts.length})
                </button>
            </div>

            {activeTab === 'pending' && (
                <div>
                    <h2>Canciones en espera de aprobación para venta</h2>
                    {pendingSongs.length === 0 ? <p style={{ color: '#64748b' }}>No hay solicitudes pendientes.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {pendingSongs.map(song => (
                                <div key={song.id} style={{ background: 'rgba(241,196,15,0.05)', border: '1px solid rgba(241,196,15,0.2)', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: '800', fontSize: '1.2rem', color: '#f1c40f' }}>{song.name} <span style={{ color: '#fff', fontWeight: '400', fontSize: '1rem' }}>by {song.artist}</span></div>
                                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '5px' }}>Subido por: <strong>{song.userEmail}</strong></div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Pistas: {song.tracks?.length || 0}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => deleteSong(song.id)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Rechazar</button>
                                        <button onClick={() => approveSong(song.id)} style={{ background: '#f1c40f', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Aprobar y Publicar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'users' && (
                <div>
                    <h2>Usuarios ({users.length})</h2>
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                        {users.map(u => (
                            <div key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800' }}>
                                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.displayName || u.email || 'Email Oculto')}
                                        <span style={{ fontWeight: '400', color: '#94a3b8', fontSize: '0.9rem', marginLeft: '10px' }}>({u.email || 'Sin correo asociado en DB'})</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Plan actual: <span style={{ color: '#00d2d3', fontWeight: '800' }}>{u.planId || 'free'}</span></div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Límite GB:</span>
                                    <input
                                        type="number"
                                        placeholder="Plan base"
                                        value={u.customStorageGB || ''}
                                        onChange={(e) => updateCustomStorage(u.id, e.target.value)}
                                        style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: 'white', textAlign: 'center' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'songs' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Todas las Canciones ({filteredSongs.length})</h2>
                        <input
                            type="text"
                            placeholder="Filtrar por User Email..."
                            value={searchUser}
                            onChange={e => setSearchUser(e.target.value)}
                            style={{ padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        />
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                        {filteredSongs.map(s => (
                            <div key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800' }}>{s.name} - {s.artist}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{s.userEmail} | Uso: {s.useType} | Status: {s.status} | Global: {s.isGlobal ? 'Yes' : 'No'}</div>
                                </div>
                                <button onClick={() => deleteSong(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={20} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activeTab === 'contacts' && (
                <div>
                    <h2>Mensajes de Contacto ({contacts.length})</h2>
                    {contacts.length === 0 ? <p style={{ color: '#64748b' }}>No hay mensajes aún.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {contacts.map(c => (
                                <div key={c.id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>{c.nombre} <span style={{ color: '#64748b', fontWeight: '400', fontSize: '0.9rem' }}>({c.email})</span></div>
                                            {c.asunto && <div style={{ fontSize: '0.8rem', color: '#00d2d3', marginTop: '4px', textTransform: 'capitalize' }}>Asunto: {c.asunto}</div>}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.createdAt?.toDate?.().toLocaleDateString?.() || ''}</div>
                                    </div>
                                    <p style={{ color: '#94a3b8', margin: 0, lineHeight: '1.7', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>{c.mensaje}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
