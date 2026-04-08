import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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
    const [sellerApps, setSellerApps] = useState([]); // Nuevo: Solicitudes de vendedores
    const [activeTab, setActiveTab] = useState('pending');
    const [searchUser, setSearchUser] = useState('');
    const [searchArtist, setSearchArtist] = useState('');
    const [filterLetter, setFilterLetter] = useState('ALL'); // Nuevo: Filtro por letra

    const [coupons, setCoupons] = useState([]); // Nuevo: Gestión de cupones
    const [newCouponCode, setNewCouponCode] = useState('');
    const [newCouponDiscount, setNewCouponDiscount] = useState('');

    const [appHistory, setAppHistory] = useState([]); // Nuevo: Historial de APKs
    const [isUploadingApk, setIsUploadingApk] = useState(false);
    const [apkFile, setApkFile] = useState(null);
    const [apkVersionName, setApkVersionName] = useState('');

    const [userSortField, setUserSortField] = useState('createdAt'); // 'createdAt' or 'songsCount'
    const [userSortOrder, setUserSortOrder] = useState('desc'); // 'asc' or 'desc'

    const [selectedArtist, setSelectedArtist] = useState(null);
    const [artistSongs, setArtistSongs] = useState([]);
    const [isFetchingSongs, setIsFetchingSongs] = useState(false);
    const [viewingChord, setViewingChord] = useState(null); // Nuevo: previsualizar cifrado

    const [isSyncing, setIsSyncing] = useState(false);
    const [editingTracks, setEditingTracks] = useState(null); // Canción que estamos editando sus tracks

    const [banners, setBanners] = useState([]); // Nuevo: Banners del index
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerTitle, setBannerTitle] = useState('');
    const [bannerSubtitle, setBannerSubtitle] = useState('');

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

        onSnapshot(collection(db, 'seller_applications'), (snap) => {
            const sa = [];
            snap.forEach(doc => sa.push({ id: doc.id, ...doc.data() }));
            setSellerApps(sa.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        onSnapshot(collection(db, 'coupons'), (snap) => {
            const cp = [];
            snap.forEach(doc => cp.push({ id: doc.id, ...doc.data() }));
            setCoupons(cp.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        onSnapshot(collection(db, 'app_versions'), (snap) => {
            const av = [];
            snap.forEach(doc => av.push({ id: doc.id, ...doc.data() }));
            setAppHistory(av.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        onSnapshot(collection(db, 'banners'), (snap) => {
            const b = [];
            snap.forEach(doc => b.push({ id: doc.id, ...doc.data() }));
            setBanners(b.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });
    };

    const approveSeller = async (userId) => {
        if (!window.confirm("¿Aprobar este vendedor oficialmente?")) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                sellerStatus: 'active'
            });
            await updateDoc(doc(db, 'seller_applications', userId), {
                status: 'approved'
            });
            alert("Vendedor aprobado correctamente.");
        } catch (e) { console.error(e); }
    };

    const deleteSeller = async (userId) => {
        if (!window.confirm("¿ELIMINAR este vendedor? Se le quitará el acceso al panel de ventas y se borrará su solicitud.")) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                isSeller: false,
                sellerStatus: null,
                isVipSeller: false
            });
            await deleteDoc(doc(db, 'seller_applications', userId));
            alert("Vendedor eliminado.");
        } catch (e) { console.error(e); }
    };

    const toggleManualSeller = async (user) => {
        const newState = !user.isSeller;
        const msg = newState ? `¿Convertir a ${user.email} en VENDEDOR manualmente (sin pago)?` : `¿Quitar privilegios de vendedor a ${user.email}?`;
        if (!window.confirm(msg)) return;

        try {
            await updateDoc(doc(db, 'users', user.id), {
                isSeller: newState,
                sellerStatus: newState ? 'active' : null,
                isVipSeller: newState ? true : false,
                updatedAt: serverTimestamp()
            });
            alert(newState ? "Privilegios otorgados." : "Privilegios removidos.");
        } catch (e) {
            console.error(e);
            alert("Error al actualizar privilegios.");
        }
    };

    const syncWithLaCuerda = async () => {
        if (!window.confirm("¿Quieres traer la lista oficial de más de 1,300 artistas cristianos de LaCuerda? Solo se agregarán los que no existan.")) return;
        setIsSyncing(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            const resp = await fetch(`${devProxy}/api/import-artists`);
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

    const fixSellerNames = async () => {
        if (!window.confirm("¿Actualizar nombres de vendedores en todas las pistas? Esto buscará el nombre real en el perfil de cada usuario.")) return;
        setIsSyncing(true);
        try {
            let updatedCount = 0;
            for (const s of songs) {
                if (s.userId) {
                    const u = users.find(user => user.id === s.userId);
                    if (u) {
                        const realName = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.displayName || u.email?.split('@')[0] || 'Vendedor Zion');
                        if (s.sellerName !== realName) {
                            await updateDoc(doc(db, 'songs', s.id), { sellerName: realName });
                            updatedCount++;
                        }
                    }
                }
            }
            alert(`✅ ¡Éxito! Se actualizaron ${updatedCount} canciones con nombres reales.`);
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
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
        } catch { alert("Error al agregar artista"); }
    };

    const addCoupon = async () => {
        if (!newCouponCode.trim() || !newCouponDiscount) return;
        try {
            await addDoc(collection(db, 'coupons'), {
                code: newCouponCode.trim().toUpperCase(),
                discount: parseInt(newCouponDiscount),
                active: true,
                createdAt: serverTimestamp()
            });
            setNewCouponCode('');
            setNewCouponDiscount('');
            alert("Cupón creado correctamente");
        } catch { alert("Error al crear cupón"); }
    };

    const deleteCoupon = async (id) => {
        if (!window.confirm("¿Eliminar este cupón definitivamente?")) return;
        try {
            await deleteDoc(doc(db, 'coupons', id));
        } catch (e) { console.error(e); }
    };

    const deleteMasterArtist = async (id) => {
        if (!window.confirm("¿Eliminar este artista de la lista maestra?")) return;
        await deleteDoc(doc(db, 'master_artists', id));
    };

    const assignArtistToSong = async (songId, artistName) => {
        try {
            await updateDoc(doc(db, 'songs', songId), { artist: artistName });
        } catch { alert("Error al asignar artista"); }
    };

    const saveTrackNames = async () => {
        if (!editingTracks) return;
        try {
            await updateDoc(doc(db, 'songs', editingTracks.id), {
                tracks: editingTracks.tracks
            });
            alert("Nombres de tracks actualizados correctamente");
            setEditingTracks(null);
        } catch (e) {
            console.error(e);
            alert("Error al guardar cambios");
        }
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
                : 'https://mixernew-production.up.railway.app';

            const resp = await fetch(`${devProxy}/api/list-artist-songs?slug=${artist.slug}`);
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
        if (btn) {
            btn.innerText = 'IMPORTANDO...';
            btn.disabled = true;
        }

        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            const resp = await fetch(`${devProxy}/api/scrape-full-song?artistSlug=${selectedArtist.slug}&songSlug=${song.slug}`);
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

    const toggleSongVisibility = async (id, currentStatus) => {
        const newStatus = currentStatus === 'hidden' ? 'active' : 'hidden';
        try {
            await updateDoc(doc(db, 'songs', id), {
                status: newStatus
            });
        } catch (error) { console.error(error); }
    };

    const updateCustomStorage = async (userId, val) => {
        try {
            const parsed = val ? parseFloat(val) : null;
            await updateDoc(doc(db, 'users', userId), { customStorageGB: parsed });
        } catch (error) { console.error(error); }
    };

    const uploadApk = async () => {
        if (!apkFile || !apkVersionName.trim()) {
            alert("Por favor selecciona un archivo APK y ponle un nombre de versión.");
            return;
        }

        setIsUploadingApk(true);
        try {
            const formData = new FormData();
            formData.append('audioFile', apkFile); // Using 'audioFile' because the proxy expects it
            formData.append('fileName', `apps/zion-stage-${Date.now()}.apk`);
            formData.append('generatePreview', 'false');

            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            const resp = await fetch(`${devProxy}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await resp.json();
            if (data.success) {
                await addDoc(collection(db, 'app_versions'), {
                    versionName: apkVersionName.trim(),
                    downloadUrl: data.url,
                    fileId: data.fileId,
                    createdAt: serverTimestamp()
                });
                alert("APK subida con éxito.");
                setApkFile(null);
                setApkVersionName('');
            } else {
                throw new Error(data.error || 'Error al subir');
            }
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setIsUploadingApk(false);
        }
    };

    const deleteApkVersion = async (v) => {
        if (!window.confirm("¿Eliminar esta versión de la app permanentemente?")) return;
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            await fetch(`${devProxy}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: v.fileId, fileName: v.downloadUrl.split('/').slice(-2).join('/') })
            });

            await deleteDoc(doc(db, 'app_versions', v.id));
            alert("Versión eliminada.");
        } catch (e) { console.error(e); }
    };

    const toggleManualForSale = async (song) => {
        const newState = !song.forSale;
        const msg = newState ? `¿Publicar "${song.name}" en el Marketplace?` : `¿Quitar "${song.name}" del Marketplace?`;
        if (!window.confirm(msg)) return;
        try {
            await updateDoc(doc(db, 'songs', song.id), {
                forSale: newState,
                status: newState ? 'active' : (song.status || 'active')
            });
            alert(newState ? "Publicado." : "Retirado.");
        } catch (e) { console.error(e); }
    };

    const deleteSong = async (id) => {
        if (!window.confirm("¿ELIMINAR esta canción permanentemente de la base de datos y de B2?")) return;
        try {
            // Find song to get track info for B2 cleanup
            const song = songs.find(s => s.id === id);
            if (song && song.tracks) {
                const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

                for (const track of song.tracks) {
                    if (track.b2FileId) {
                        await fetch(`${devProxy}/api/delete-file`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileId: track.b2FileId, fileName: track.url.split('/').slice(-2).join('/') })
                        }).catch(e => console.error("Error deleting track from B2:", e));
                    }
                }
                if (song.coverFileId) {
                    await fetch(`${devProxy}/api/delete-file`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: song.coverFileId, fileName: song.coverUrl.split('/').slice(-2).join('/') })
                    }).catch(e => console.error("Error deleting cover from B2:", e));
                }
            }
            await deleteDoc(doc(db, 'songs', id));
            alert("Canción eliminada.");
        } catch (e) { console.error(e); }
    };

    const uploadBanner = async () => {
        if (!bannerFile) {
            alert("Por favor selecciona una imagen para el banner.");
            return;
        }

        setIsUploadingBanner(true);
        try {
            const formData = new FormData();
            formData.append('audioFile', bannerFile);
            formData.append('fileName', `banners/banner-${Date.now()}.png`);
            formData.append('generatePreview', 'false');

            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            const resp = await fetch(`${devProxy}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await resp.json();
            if (data.success) {
                await addDoc(collection(db, 'banners'), {
                    title: bannerTitle.trim() || 'Nuevo Banner',
                    subtitle: bannerSubtitle.trim() || '',
                    image: data.url,
                    fileId: data.fileId,
                    createdAt: serverTimestamp()
                });
                alert("Banner subido con éxito.");
                setBannerFile(null);
                setBannerTitle('');
                setBannerSubtitle('');
            } else {
                throw new Error(data.error || 'Error al subir');
            }
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setIsUploadingBanner(false);
        }
    };

    const deleteBanner = async (v) => {
        if (!window.confirm("¿Eliminar este banner permanentemente?")) return;
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            await fetch(`${devProxy}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: v.fileId, fileName: v.image.split('/').slice(-2).join('/') })
            });

            await deleteDoc(doc(db, 'banners', v.id));
            alert("Banner eliminado.");
        } catch (e) { console.error(e); }
    };

    if (loading) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}>Cargando Admin...</div>;
    if (!isAdmin) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}><ShieldAlert size={48} color="red" /><h2>Acceso Denegado</h2></div>;

    const forSaleSongs = songs.filter(s => s.forSale === true);
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
                <button onClick={() => setActiveTab('pending')} style={{ background: activeTab === 'pending' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'pending' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Marketplace ({forSaleSongs.length})</button>
                <button onClick={() => setActiveTab('sellers')} style={{ background: activeTab === 'sellers' ? '#10b981' : 'rgba(255,255,255,0.05)', color: activeTab === 'sellers' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Vendedores ({users.filter(u => u.isSeller).length})</button>
                <button onClick={() => setActiveTab('users')} style={{ background: activeTab === 'users' ? '#00d2d3' : 'rgba(255,255,255,0.05)', color: activeTab === 'users' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Usuarios ({users.length})</button>
                <button onClick={() => setActiveTab('coupons')} style={{ background: activeTab === 'coupons' ? '#f59e0b' : 'rgba(255,255,255,0.05)', color: activeTab === 'coupons' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Cupones ({coupons.length})</button>
                <button onClick={() => setActiveTab('artists')} style={{ background: activeTab === 'artists' ? '#f43f5e' : 'rgba(255,255,255,0.05)', color: activeTab === 'artists' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Artistas Maestros ({masterArtists.length})</button>
                <button onClick={() => setActiveTab('library')} style={{ background: activeTab === 'library' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'library' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Biblioteca CIF ({songs.filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com').length})</button>
                <button onClick={() => setActiveTab('songs')} style={{ background: activeTab === 'songs' ? '#9b59b6' : 'rgba(255,255,255,0.05)', color: activeTab === 'songs' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Curar Canciones ({songs.length})</button>
                <button onClick={() => setActiveTab('apps')} style={{ background: activeTab === 'apps' ? '#00d2d3' : 'rgba(255,255,255,0.05)', color: activeTab === 'apps' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>App APK ({appHistory.length})</button>
                <button onClick={() => setActiveTab('banners')} style={{ background: activeTab === 'banners' ? '#6366f1' : 'rgba(255,255,255,0.05)', color: activeTab === 'banners' ? '#fff' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Banners Index ({banners.length})</button>
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
                            <input value={newArtistName} onChange={e => setNewArtistName(e.target.value)} placeholder="Nombre del Artista Oficial..." style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', background: 'white', border: '1px solid #cbd5e1', color: 'black' }} />
                            <button onClick={addMasterArtist} className="btn-teal" style={{ padding: '0 30px' }}>Agregar Artista</button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="text"
                            placeholder="🔍 Buscar por nombre entre tus 1,300+ artistas..."
                            value={searchArtist}
                            onChange={e => { setSearchArtist(e.target.value); if (e.target.value) setFilterLetter('ALL'); }}
                            style={{ width: '100%', padding: '15px 25px', borderRadius: '15px', background: 'white', border: '1px solid #cbd5e1', color: 'black', fontSize: '1.1rem', marginBottom: '15px' }}
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
                                    <select value={s.artist || ''} onChange={(e) => assignArtistToSong(s.id, e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}>
                                        <option value="">-- Seleccionar --</option>
                                        {masterArtists.map(ma => <option key={ma.id} value={ma.name}>{ma.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.userEmail}</div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        padding: '4px 8px',
                                        borderRadius: '10px',
                                        background: s.forSale ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: s.forSale ? '#10b981' : '#ef4444',
                                        fontWeight: '800',
                                        marginRight: '10px'
                                    }}>
                                        {s.forSale ? 'ON MARKET' : 'PRIVATE'}
                                    </div>
                                    <button
                                        onClick={() => toggleManualForSale(s)}
                                        style={{ 
                                            background: s.forSale ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                            color: s.forSale ? '#ef4444' : '#10b981', 
                                            border: `1px solid ${s.forSale ? '#ef4444' : '#10b981'}`,
                                            padding: '8px 12px', 
                                            borderRadius: '8px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: '800', 
                                            cursor: 'pointer' 
                                        }}
                                    >
                                        {s.forSale ? 'OCULTAR' : 'PUBLICAR'}
                                    </button>
                                    <button
                                        onClick={() => setEditingTracks({
                                            ...s,
                                            tracks: s.tracks ? s.tracks.map(t => ({
                                                ...t,
                                                displayName: t.displayName || t.name || t.originalName || ''
                                            })) : []
                                        })}
                                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                                    >
                                        EDITAR TRACKS
                                    </button>
                                    <button onClick={() => deleteSong(s.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={20} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {editingTracks && (
                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                            <div style={{ background: '#1e293b', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <h3 style={{ margin: '0 0 20px', color: '#00d2d3' }}>Editar nombres de tracks: {editingTracks.name}</h3>
                                <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '10px' }}>
                                    {editingTracks.tracks?.map((track, idx) => (
                                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,210,211,0.1)', color: '#00d2d3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>{idx + 1}</div>
                                            <input
                                                type="text"
                                                value={track.displayName}
                                                onChange={(e) => {
                                                    const newTracks = [...editingTracks.tracks];
                                                    newTracks[idx].displayName = e.target.value;
                                                    setEditingTracks({ ...editingTracks, tracks: newTracks });
                                                }}
                                                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'white', border: '1px solid #cbd5e1', color: 'black' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setEditingTracks(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>CANCELAR</button>
                                    <button onClick={saveTrackNames} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#10b981', color: 'black', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>GUARDAR CAMBIOS</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'banners' && (
                <div className="fade-in">
                    <div style={{ background: '#1e293b', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '40px' }}>
                        <h2 style={{ margin: '0 0 20px 0' }}>Gestionar Banners del Index</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Título del Banner</label>
                                <input 
                                    type="text" 
                                    value={bannerTitle} 
                                    onChange={e => setBannerTitle(e.target.value)} 
                                    placeholder="Ej: Multitracks con Excelencia" 
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'white', color: 'black', border: 'none' }} 
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Subtítulo / Descripción</label>
                                <input 
                                    type="text" 
                                    value={bannerSubtitle} 
                                    onChange={e => setBannerSubtitle(e.target.value)} 
                                    placeholder="Ej: La herramienta definitiva para músicos..." 
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'white', color: 'black', border: 'none' }} 
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Imagen del Banner (Recomendado 21:9)</label>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={e => setBannerFile(e.target.files[0])} 
                                    style={{ width: '100%', color: '#94a3b8' }} 
                                />
                            </div>
                            <button 
                                onClick={uploadBanner} 
                                disabled={isUploadingBanner}
                                style={{ background: '#6366f1', color: 'white', border: 'none', padding: '15px 40px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px' }}
                            >
                                {isUploadingBanner ? "Subiendo..." : "SUBIR BANNER"}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                        {banners.map(b => (
                            <div key={b.id} style={{ background: '#1e293b', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ height: '180px', position: 'relative' }}>
                                    <img src={b.image} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button 
                                        onClick={() => deleteBanner(b)} 
                                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div style={{ padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#00d2d3' }}>{b.title}</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{b.subtitle}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {banners.length === 0 && <p style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No hay banners configurados.</p>}
                </div>
            )}

            {activeTab === 'sellers' && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Gestión de Vendedores</h2>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem' }}>
                            {users.filter(u => u.isSeller).length} vendedores totales
                        </span>
                    </div>

                    {/* Section 1: Formal Applications */}
                    <h3 style={{ fontSize: '1.2rem', color: '#00d2d3', marginBottom: '15px' }}>Solicitudes con Documentación</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '40px' }}>
                        {sellerApps.map(app => (
                            <div key={app.id} style={{ background: '#1e293b', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr 150px', gap: '20px', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800', fontSize: '1.2rem', color: '#00d2d3' }}>{app.firstName} {app.lastName}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>ID: {app.cedula} | Tel: {app.phone}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{app.email}</div>
                                    <div style={{ marginTop: '10px' }}>
                                        <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '100px', background: app.status === 'approved' ? '#10b98120' : '#f1c40f20', color: app.status === 'approved' ? '#10b981' : '#f1c40f', fontWeight: '800' }}>
                                            {app.status === 'approved' ? 'VERIFICADO' : 'PENDIENTE'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {app.idPhotoUrl ? (
                                        <a href={app.idPhotoUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                            <div style={{ height: '80px', width: '120px', background: `url(${app.idPhotoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.1)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>VER ID</div>
                                            </div>
                                        </a>
                                    ) : <div style={{ color: '#64748b' }}>Sin foto ID</div>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {app.status !== 'approved' && (
                                        <button onClick={() => approveSeller(app.userId)} style={{ background: '#10b981', color: 'black', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>APROBAR</button>
                                    )}
                                    <button
                                        onClick={() => { setActiveTab('pending'); setSearchUser(app.email); }}
                                        style={{ background: '#00d2d3', color: 'black', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}
                                    >
                                        VER CANCIONES
                                    </button>
                                    <button onClick={() => deleteSeller(app.userId)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>BORRAR VENDEDOR</button>
                                </div>
                            </div>
                        ))}
                        {sellerApps.length === 0 && <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay solicitudes formales.</p>}
                    </div>

                    {/* Section 2: Legacy Sellers or Direct Activations */}
                    <h3 style={{ fontSize: '1.2rem', color: '#f1c40f', marginBottom: '15px' }}>Vendedores Activos (Directos/Antiguos)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '15px' }}>
                        {users.filter(u => u.isSeller && !sellerApps.some(app => app.userId === u.id)).map(u => (
                            <div key={u.id} style={{ background: 'rgba(255,196,15,0.05)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(241,196,15,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '800' }}>{u.displayName || u.email}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{u.email}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#f1c40f', marginTop: '5px' }}>ACTIVO SIN FORMULARIO</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => { setActiveTab('pending'); setSearchUser(u.email); }}
                                        style={{ background: '#00d2d3', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                    >
                                        VER CANCIONES
                                    </button>
                                    <button onClick={() => deleteSeller(u.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={20} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'coupons' && (
                <div className="fade-in">
                    <div style={{ background: '#1e293b', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '40px' }}>
                        <h2 style={{ marginBottom: '20px' }}>Gestión de Cupones</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input value={newCouponCode} onChange={e => setNewCouponCode(e.target.value)} placeholder="Código (ej: MARZO20)..." style={{ flex: 2, padding: '12px 20px', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: 'white' }} />
                            <input type="number" value={newCouponDiscount} onChange={e => setNewCouponDiscount(e.target.value)} placeholder="% Descuento..." style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: 'white' }} />
                            <button onClick={addCoupon} className="btn-teal" style={{ padding: '0 30px' }}>Crear Cupón</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {coupons.map(cp => (
                            <div key={cp.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div>
                                    <div style={{ fontWeight: '900', fontSize: '1.2rem', color: '#f59e0b' }}>{cp.code}</div>
                                    <div style={{ color: '#10b981', fontWeight: '800' }}>{cp.discount}% Descuento</div>
                                </div>
                                <button onClick={() => deleteCoupon(cp.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={24} /></button>
                            </div>
                        ))}
                        {coupons.length === 0 && <p style={{ color: '#64748b' }}>No hay cupones activos.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                        <h2>Gestión de Usuarios ({users.length})</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select 
                                value={userSortField} 
                                onChange={(e) => setUserSortField(e.target.value)}
                                style={{ padding: '10px', borderRadius: '10px', background: 'white', border: '1px solid #cbd5e1', color: 'black' }}
                            >
                                <option value="createdAt">Ordenar por Fecha Registro</option>
                                <option value="songsCount">Ordenar por MTs Subidos</option>
                            </select>
                            <button 
                                onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')}
                                style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                            >
                                {userSortOrder === 'asc' ? '⬆️ ASC' : '⬇️ DESC'}
                            </button>
                            <input
                                type="text"
                                placeholder="Buscar por email o nombre..."
                                value={searchUser}
                                onChange={e => setSearchUser(e.target.value)}
                                style={{ padding: '10px 15px', borderRadius: '10px', background: 'white', border: '1px solid #cbd5e1', color: 'black', width: '250px' }}
                            />
                        </div>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                        {users
                            .map(u => ({ ...u, songsCount: songs.filter(s => s.userId === u.id).length }))
                            .filter(u =>
                                u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
                                u.displayName?.toLowerCase().includes(searchUser.toLowerCase())
                            )
                            .sort((a, b) => {
                                let valA, valB;
                                if (userSortField === 'createdAt') {
                                    valA = a.createdAt?.toMillis() || 0;
                                    valB = b.createdAt?.toMillis() || 0;
                                } else {
                                    valA = a.songsCount;
                                    valB = b.songsCount;
                                }
                                return userSortOrder === 'asc' ? valA - valB : valB - valA;
                            })
                            .map(u => (
                            <div key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontWeight: '800' }}>{u.displayName || u.email}</div>
                                        {u.isSeller && <span style={{ background: '#10b981', color: 'black', fontSize: '0.6rem', fontWeight: '900', padding: '2px 6px', borderRadius: '4px' }}>SELLER</span>}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                        Plan: <span style={{ color: '#00d2d3', fontWeight: '700' }}>{u.planId || 'free'}</span> | 
                                        MTs: <span style={{ color: '#f1c40f', fontWeight: '800' }}>{u.songsCount}</span> |
                                        Registro: <span style={{ color: '#94a3b8' }}>{u.createdAt ? u.createdAt.toDate().toLocaleDateString() : '—'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>{u.email}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>ESPACIO GB:</span>
                                        <input type="number" value={u.customStorageGB || ''} onChange={(e) => updateCustomStorage(u.id, e.target.value)} style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: 'black', textAlign: 'center', fontSize: '0.8rem' }} />
                                    </div>
                                    <button 
                                        onClick={() => toggleManualSeller(u)} 
                                        style={{ 
                                            background: u.isSeller ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                            color: u.isSeller ? '#ef4444' : '#10b981', 
                                            border: `1px solid ${u.isSeller ? '#ef4444' : '#10b981'}`,
                                            padding: '8px 12px', 
                                            borderRadius: '8px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: '800', 
                                            cursor: 'pointer',
                                            minWidth: '130px'
                                        }}
                                    >
                                        {u.isSeller ? 'QUITAR VENDEDOR' : 'HACER VENDEDOR'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'apps' && (
                <div className="fade-in">
                    <div style={{ background: '#1e293b', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '40px' }}>
                        <h2 style={{ marginBottom: '20px' }}>Subir Nueva Versión (APK)</h2>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Nombre de Versión (ej: 1.0.5)</label>
                                <input value={apkVersionName} onChange={e => setApkVersionName(e.target.value)} placeholder="v1.0.1..." style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: 'white' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Seleccionar Archivo .apk</label>
                                <input type="file" accept=".apk" onChange={e => setApkFile(e.target.files[0])} style={{ width: '100%', padding: '9px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
                            </div>
                            <button onClick={uploadApk} disabled={isUploadingApk} className="btn-teal" style={{ padding: '14px 40px', opacity: isUploadingApk ? 0.5 : 1 }}>
                                {isUploadingApk ? "SUBIENDO..." : "SUBIR A B2"}
                            </button>
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>— O pega directamente el enlace del APK —</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    id="apk-url-input"
                                    placeholder="https://f005.backblazeb2.com/file/mixercur/apps/..."
                                    style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: 'white' }}
                                />
                                <button
                                    onClick={async () => {
                                        const url = document.getElementById('apk-url-input').value.trim();
                                        const ver = apkVersionName.trim() || '1.0';
                                        if (!url) return alert('Pega el enlace primero');
                                        try {
                                            await addDoc(collection(db, 'app_versions'), {
                                                versionName: ver,
                                                downloadUrl: url,
                                                createdAt: serverTimestamp()
                                            });
                                            alert('Versión registrada correctamente.');
                                            document.getElementById('apk-url-input').value = '';
                                            setApkVersionName('');
                                        } catch (e) { alert('Error: ' + e.message); }
                                    }}
                                    style={{ background: '#6366f1', color: 'white', border: 'none', padding: '14px 30px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                                >
                                    GUARDAR ENLACE
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#1e293b', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ marginBottom: '24px' }}>Historial de Versiones</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {appHistory.map((v, i) => (
                                <div key={v.id} style={{ background: i === 0 ? 'rgba(0,210,211,0.05)' : 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: i === 0 ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: '900', fontSize: '1.25rem', color: i === 0 ? '#00d2d3' : 'white' }}>
                                            Versión {v.versionName} {i === 0 && <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '10px', background: '#00d2d3', color: 'black', marginLeft: '10px', verticalAlign: 'middle' }}>ACTUAL</span>}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Subido el {v.createdAt?.toDate().toLocaleString()}</div>
                                        <a href={v.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#00d2d3', textDecoration: 'none', display: 'block', marginTop: '8px' }}>{v.downloadUrl}</a>
                                    </div>
                                    <button onClick={() => deleteApkVersion(v)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={24} /></button>
                                </div>
                            ))}
                            {appHistory.length === 0 && <p style={{ color: '#64748b' }}>No hay versiones subidas aún.</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'pending' && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <div>
                            <h2 style={{ margin: 0 }}>Gestión del Marketplace</h2>
                            <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>Controla qué canciones son visibles para el público.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={fixSellerNames}
                                disabled={isSyncing}
                                style={{ background: 'rgba(0,210,211,0.1)', border: '1px solid #00d2d3', color: '#00d2d3', padding: '8px 15px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {isSyncing ? "PROCESANDO..." : "🔧 REPARAR NOMBRES DE VENDEDOR"}
                            </button>
                            <input type="text" placeholder="Buscar canción o vendedor..." value={searchUser} onChange={e => setSearchUser(e.target.value)} style={{ padding: '12px 20px', width: '300px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
                        </div>
                    </div>

                    <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 2fr 1.5fr 1.5fr 150px', gap: '15px', padding: '15px 25px', background: 'rgba(255,255,255,0.03)', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                            <span>Portada</span>
                            <span>Canción / Artista</span>
                            <span>Vendedor</span>
                            <span>Email</span>
                            <span style={{ textAlign: 'right' }}>Acciones</span>
                        </div>
                        {forSaleSongs.filter(s =>
                            s.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
                            s.sellerName?.toLowerCase().includes(searchUser.toLowerCase()) ||
                            s.userEmail?.toLowerCase().includes(searchUser.toLowerCase())
                        ).map(song => (
                            <div key={song.id} style={{ display: 'grid', gridTemplateColumns: '80px 2fr 1.5fr 1.5fr 150px', gap: '15px', padding: '12px 25px', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', opacity: song.status === 'hidden' ? 0.6 : 1, background: song.status === 'hidden' ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: '#0f172a' }}>
                                    {song.coverUrl ? <img src={song.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music2 size={20} style={{ margin: '15px', opacity: 0.2 }} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: '800', color: song.status === 'hidden' ? '#94a3b8' : 'white' }}>{song.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{song.artist}</div>
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#00d2d3' }}>{song.sellerName || '—'}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{song.userEmail}</div>
                                <div style={{ textAlign: 'right' }}>
                                    <button
                                        onClick={() => toggleSongVisibility(song.id, song.status)}
                                        style={{ background: song.status === 'hidden' ? '#10b981' : '#f1c40f', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}
                                    >
                                        {song.status === 'hidden' ? 'MOSTRAR' : 'OCULTAR'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {forSaleSongs.length === 0 && <p style={{ color: '#64748b' }}>No hay canciones a la venta todavía.</p>}
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
