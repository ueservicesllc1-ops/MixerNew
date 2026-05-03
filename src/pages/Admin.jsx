import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ShieldAlert, Users, Music2, Settings2, Trash2, CheckCircle2, ListMusic, User, ChevronDown, ChevronRight, FileText, Save, Search, BarChart3, Download } from 'lucide-react';

export default function Admin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [songs, setSongs] = useState([]);
    const [masterArtists, setMasterArtists] = useState([]);
    const [newArtistName, setNewArtistName] = useState('');
    const [contacts, setContacts] = useState([]);
    const [accountDeletionRequests, setAccountDeletionRequests] = useState([]);
    const [libraryChords, setLibraryChords] = useState([]); 
    const [libraryLyrics, setLibraryLyrics] = useState([]); 
    const [sellerApps, setSellerApps] = useState([]); // Nuevo: Solicitudes de vendedores
    const [activeTab, setActiveTab] = useState('pending');
    const [isBulkImporting, setIsBulkImporting] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [searchUser, setSearchUser] = useState('');
    const [searchArtist, setSearchArtist] = useState('');
    const [filterLetter, setFilterLetter] = useState('ALL'); // Nuevo: Filtro por letra
    const [expandedArtist, setExpandedArtist] = useState(null); // Nuevo: Acordeón de biblioteca

    const [coupons, setCoupons] = useState([]); // Nuevo: Gestión de cupones
    const [newCouponCode, setNewCouponCode] = useState('');
    const [newCouponDiscount, setNewCouponDiscount] = useState('');

    const [appHistory, setAppHistory] = useState([]); // Nuevo: Historial de APKs
    const [isUploadingApk, setIsUploadingApk] = useState(false);
    const [apkFile, setApkFile] = useState(null);
    const [apkVersionName, setApkVersionName] = useState('');
    const [isActivatingPending, setIsActivatingPending] = useState(false); // botón rojo ACTIVAR
    const [pendingRelease, setPendingRelease] = useState(null);

    const [userSortField, setUserSortField] = useState('createdAt'); // 'createdAt' or 'songsCount'
    const [userSortOrder, setUserSortOrder] = useState('desc'); // 'asc' or 'desc'
    const [usageReport, setUsageReport] = useState(null);
    const [isBuildingUsageReport, setIsBuildingUsageReport] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);

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

    // ── Letras Editor ─────────────────────────────────────────────────────
    const [lyricsSearch, setLyricsSearch] = useState('');
    const [editingLyric, setEditingLyric] = useState(null); // { id, songId, text }
    const [editingLyricText, setEditingLyricText] = useState('');
    const [savingLyric, setSavingLyric] = useState(false);

    // ── Vincular MT con Letra/Cifrado ───────────────────────────────────────
    const [linkingSong, setLinkingSong] = useState(null);
    const [linkChordId, setLinkChordId] = useState('');
    const [linkLyricId, setLinkLyricId] = useState('');
    const [isSavingLink, setIsSavingLink] = useState(false);
    const [lcSearchResults, setLcSearchResults] = useState([]);   // LaCuerda search hits
    const [lcSearching, setLcSearching] = useState(false);        // loading state
    const [lcImporting, setLcImporting] = useState(null);         // slug being imported


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

    // Try to read local release-pending.json (written by upload script) so the "ACTIVAR" button
    // shows the actual pending version instead of a hardcoded string.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // prefer dev proxy when running locally (proxy serves same file)
                const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? ''
                    : '';
                const r = await fetch(`${base}/release-pending.json`, { cache: 'no-store' });
                if (!r.ok) return;
                const j = await r.json();
                if (cancelled) return;
                if (j && j.versionName) setPendingRelease(j);
            } catch (e) {
                // ignore - file may not exist
            }
        })();
        return () => { cancelled = true; };
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

        onSnapshot(collection(db, 'account_deletion_requests'), (snap) => {
            const r = [];
            snap.forEach(doc => r.push({ id: doc.id, ...doc.data() }));
            setAccountDeletionRequests(r.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
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

        onSnapshot(collection(db, 'lyrics'), (snap) => {
            const l = [];
            snap.forEach(doc => l.push({ id: doc.id, ...doc.data() }));
            setLibraryLyrics(l);
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

    const escapeCsvCell = (val) => {
        if (val == null || val === '') return '';
        const s = String(val);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };

    /**
     * Corrige TLD mal escritos muy frecuentes (.con, .vom) en dominios conocidos.
     * Solo para export a Play Console; no modifica Firestore.
     */
    const normalizeEmailTypoForPlayExport = (email) => {
        const t = email.trim();
        if (!t) return t;
        return t
            .replace(/@gmail\.(con|vom|cim|comm|cpm|coom|vom)$/i, '@gmail.com')
            .replace(/@googlemail\.(con|vom)$/i, '@googlemail.com')
            .replace(/@yahoo\.(con|vom|cim)$/i, '@yahoo.com')
            .replace(/@ymail\.(con|vom)$/i, '@ymail.com')
            .replace(/@hotmail\.(con|vom|cim)$/i, '@hotmail.com')
            .replace(/@outlook\.(con|vom|cim)$/i, '@outlook.com')
            .replace(/@live\.(con|vom)$/i, '@live.com')
            .replace(/@icloud\.(con|vom|cim)$/i, '@icloud.com')
            .replace(/@msn\.(con|vom)$/i, '@msn.com');
    };

    /** Google Play (listas de testers, etc.): solo un correo por línea, sin cabecera ni columnas extra. */
    const downloadUsersEmailsCsvForPlayStore = () => {
        const seen = new Set();
        const lines = [];
        const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        for (const u of users) {
            const raw = (u.email || '').trim();
            if (!raw) continue;
            const fixed = normalizeEmailTypoForPlayExport(raw);
            if (!emailOk(fixed)) continue;
            const key = fixed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            lines.push(fixed);
        }
        if (lines.length === 0) {
            alert('No hay correos válidos para exportar.');
            return;
        }
        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zion-correos-play-console-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    /** CSV con columnas para Excel / uso interno (no subir a Play Console). */
    const downloadUsersEmailsCsvDetailed = () => {
        const header = ['email', 'nombre', 'uid', 'planId'];
        const lines = [
            header.join(','),
            ...users.map((u) =>
                [u.email, u.displayName || '', u.id, u.planId || 'free'].map(escapeCsvCell).join(','),
            ),
        ];
        const csv = `\ufeff${lines.join('\r\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zion-usuarios-detalle-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
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

    const cleanLyrics = (text) => {
        let txt = text.replace(/\[.*?\]/g, '');
        const lines = txt.split('\n');
        const out = [];
        
        for (const l of lines) {
            const trimmed = l.trim();
            if (!trimmed) {
                out.push('');
                continue;
            }
            if (trimmed.toLowerCase().startsWith('intro')) continue;
            
            const tokens = trimmed.split(/[\s-]+/);
            let chordCount = 0;
            let wordCount = 0;
            for (const t of tokens) {
                if (!t) continue;
                wordCount++;
                if (/^[A-G][#b]?(m|maj|min|dim|aug|sus|seus|add|\d+)?(\/[A-G][#b]?)?$/i.test(t.replace(/[()]/g, ''))) {
                    chordCount++;
                }
            }
            
            if (chordCount > 0 && chordCount >= wordCount * 0.6) {
                continue;
            }
            
            out.push(l);
        }
        
        return out.join('\n').replace(/\n\s*\n\s*\n/g, '\n\n').trim(); // clean excessive newlines
    };

    const generateMissingLyrics = async () => {
        if (!window.confirm(`Se regenerarán TODAS las letras aplicando el nuevo filtro inteligente (eliminará acordes de las vistas de letras). ¿Continuar?`)) return;

        setIsSyncing(true);
        try {
            let count = 0;
            let currentBatch = writeBatch(db);
            let operations = 0;

            for (const chordDoc of libraryChords) {
                const chordText = chordDoc.content || chordDoc.text || '';
                if (!chordText) continue;

                const lyricsText = cleanLyrics(chordText);
                if (lyricsText) {
                    const existingLyric = libraryLyrics.find(l => l.songId === chordDoc.songId);
                    if (existingLyric) {
                        currentBatch.update(doc(db, 'lyrics', existingLyric.id), {
                            text: lyricsText,
                            updatedAt: serverTimestamp()
                        });
                    } else {
                        const newRef = doc(collection(db, 'lyrics'));
                        currentBatch.set(newRef, {
                            songId: chordDoc.songId,
                            text: lyricsText,
                            createdAt: serverTimestamp()
                        });
                    }
                    operations++;
                    count++;

                    if (operations >= 400) {
                        await currentBatch.commit();
                        currentBatch = writeBatch(db);
                        operations = 0;
                        await new Promise(r => setTimeout(r, 500)); // Respirar para no saturar la red
                    }
                }
            }
            
            if (operations > 0) {
                await currentBatch.commit();
            }

            alert(`✅ ¡Proceso completado! Se regeneraron letras limpias para ${count} canciones.`);
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    // ── Fuzzy matching helpers ────────────────────────────────────────────────
    // Strip accents, punctuation, collapse whitespace → lowercase
    const normStr = (s) => (s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Score: ratio of shared words between two strings (0–1)
    const matchScore = (a, b) => {
        const wa = new Set(normStr(a).split(' ').filter(Boolean));
        const wb = new Set(normStr(b).split(' ').filter(Boolean));
        if (!wa.size || !wb.size) return 0;
        let shared = 0;
        wa.forEach(w => { if (wb.has(w)) shared++; });
        return shared / Math.max(wa.size, wb.size);
    };

    // For a given MT song, find the best-matching chord and lyric docs
    const autoDetectLinks = (song) => {
        const THRESHOLD = 0.45;
        const name = song.name || '';
        const artist = song.artist || '';

        let bestChord = null, bestChordScore = 0;
        for (const c of libraryChords) {
            const cSong = songs.find(s => s.id === c.songId);
            if (!cSong) continue;
            const score = matchScore(name, cSong.name) + matchScore(artist, cSong.artist) * 0.4;
            if (score > bestChordScore) { bestChordScore = score; bestChord = c; }
        }

        let bestLyric = null, bestLyricScore = 0;
        for (const l of libraryLyrics) {
            const lSong = songs.find(s => s.id === l.songId);
            if (!lSong) continue;
            const score = matchScore(name, lSong.name) + matchScore(artist, lSong.artist) * 0.4;
            if (score > bestLyricScore) { bestLyricScore = score; bestLyric = l; }
        }

        return {
            chord: bestChordScore >= THRESHOLD ? bestChord : null,
            lyric: bestLyricScore >= THRESHOLD ? bestLyric : null,
        };
    };

    // Persist the selected chord/lyric → songId links to Firestore
    const saveLink = async () => {
        if (!linkingSong) return;
        setIsSavingLink(true);
        try {
            const batch = writeBatch(db);
            if (linkChordId) {
                batch.update(doc(db, 'chords', linkChordId), {
                    songId: linkingSong.id,
                    updatedAt: serverTimestamp()
                });
            }
            if (linkLyricId) {
                batch.update(doc(db, 'lyrics', linkLyricId), {
                    songId: linkingSong.id,
                    updatedAt: serverTimestamp()
                });
            }
            await batch.commit();
            alert(`✅ Vinculado correctamente:\n- Cifrado: ${linkChordId ? 'Sí' : 'No'}\n- Letra: ${linkLyricId ? 'Sí' : 'No'}`);
            setLinkingSong(null);
            setLinkChordId('');
            setLinkLyricId('');
        } catch (e) {
            console.error(e);
            alert('Error al vincular: ' + e.message);
        } finally {
            setIsSavingLink(false);
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

    const importArtistSong = async (song, btnId = null, silent = false, artist = null) => {
        const targetArtist = artist || selectedArtist;
        if (!targetArtist) {
            console.error("No target artist provided for importArtistSong");
            return false;
        }

        if (!silent && !window.confirm(`¿Importar cifrado y letra de "${song.name}" de ${targetArtist.name}?`)) return;

        let btn = null;
        if (btnId) {
            btn = document.getElementById(btnId);
            if (btn) {
                btn.innerText = 'IMPORTANDO...';
                btn.disabled = true;
            }
        }

        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            const resp = await fetch(`${devProxy}/api/scrape-full-song?artistSlug=${targetArtist.slug}&songSlug=${song.slug}`);
            if (!resp.ok) throw new Error(`Error en el servidor: ${resp.status}`);

            const data = await resp.json();

            if (data.content) {
                const docRef = await addDoc(collection(db, 'songs'), {
                    name: song.name,
                    artist: targetArtist.name,
                    status: 'active',
                    isGlobal: true,
                    price: 0,
                    useType: 'chord',
                    userEmail: 'admin@zionstage.com',
                    createdAt: serverTimestamp()
                });

                await addDoc(collection(db, 'chords'), {
                    songId: docRef.id,
                    content: data.content,
                    createdAt: serverTimestamp()
                });

                // Extraer letra de forma inteligente (quitar acordes sueltos)
                const lyricsText = cleanLyrics(data.content);
                if (lyricsText) {
                    await addDoc(collection(db, 'lyrics'), {
                        songId: docRef.id,
                        text: lyricsText,
                        createdAt: serverTimestamp()
                    });
                }

                if (!silent) alert(`✅ ¡IMPORTACIÓN EXITOSA!\n\n"${song.name}" de ${targetArtist.name} ya está en tu biblioteca.`);
                return true;
            } else {
                if (!silent) alert(`❌ No se pudo extraer el contenido de "${song.name}".`);
                return false;
            }
        } catch (e) {
            console.error("Error importando canción:", e);
            if (!silent) alert(`❌ Error al importar: ${e.message}`);
            return false;
        } finally {
            if (btn) {
                btn.innerText = '¡IMPORTADO!';
                btn.style.background = '#10b981';
                btn.style.color = 'white';
            }
        }
    };

    const importAllFromArtist = async (artist = null) => {
        const targetArtist = artist || selectedArtist;
        if (!targetArtist || !targetArtist.slug) {
            alert("Selecciona un artista con slug primero.");
            return;
        }

        // 1. Si no tenemos la lista de canciones para este artista, primero las traemos
        let songsToImport = artistSongs;
        if (!artistSongs.length || (selectedArtist && selectedArtist.id !== targetArtist.id)) {
            setIsBulkImporting(true);
            try {
                const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';
                const resp = await fetch(`${devProxy}/api/list-artist-songs?slug=${targetArtist.slug}`);
                const data = await resp.json();
                if (data.songs) {
                    songsToImport = data.songs;
                    setArtistSongs(data.songs);
                }
            } catch (e) {
                console.error(e);
                alert("Error obteniendo lista de canciones.");
                setIsBulkImporting(false);
                return;
            }
        }

        if (!songsToImport.length) {
            alert("No se encontraron canciones para importar.");
            setIsBulkImporting(false);
            return;
        }

        if (!window.confirm(`¿Importar AUTOMÁTICAMENTE las ${songsToImport.length} canciones de ${targetArtist.name}?`)) {
            setIsBulkImporting(false);
            return;
        }

        setSelectedArtist(targetArtist);
        setIsBulkImporting(true);
        setBulkProgress({ current: 0, total: songsToImport.length });

        let count = 0;
        let errors = 0;

        for (const s of songsToImport) {
            const success = await importArtistSong(s, null, true, targetArtist);
            if (success) count++;
            else errors++;
            setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
            // Pequeña espera para no saturar
            await new Promise(r => setTimeout(r, 200));
        }

        setIsBulkImporting(false);
        alert(`🎉 Proceso terminado!\nImportadas: ${count}\nErrores: ${errors}`);
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

    const activatePendingRelease = async () => {
        setIsActivatingPending(true);
        try {
            // Prefer the release-pending.json written by the upload script, fallback to the previous hardcoded values.
            const payload = pendingRelease ? {
                versionName: pendingRelease.versionName,
                versionCode: pendingRelease.versionCode || 0,
                downloadUrl: pendingRelease.downloadUrl,
                releaseNotes: pendingRelease.releaseNotes || `Versión ${pendingRelease.versionName}`
            } : {
                versionName: "1.8.13",
                versionCode: 60,
                downloadUrl: "https://f005.backblazeb2.com/file/mixercur/apps/zion-stage-v1.8.13-1775865410632.apk",
                releaseNotes: "Versión 1.8.13 - Fix desfase: stop all tracks → seek → flush SoundTouch → restart"
            };

            await addDoc(collection(db, 'app_versions'), {
                versionName: payload.versionName,
                versionCode: payload.versionCode,
                downloadUrl: payload.downloadUrl,
                createdAt: serverTimestamp(),
                releaseNotes: payload.releaseNotes
            });
            alert(`¡LISTO! Versión ${payload.versionName} publicada. Los usuarios recibirán notificación de actualización.`);
            window.location.reload();
        } catch (e) { alert("Error: " + e.message); }
        finally { setIsActivatingPending(false); }
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

    const toMillisSafe = (value) => {
        if (!value) return 0;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        return 0;
    };

    const buildUsageReport = () => {
        setIsBuildingUsageReport(true);
        try {
            const now = Date.now();
            const onlineWindowMs = 5 * 60 * 1000;
            const activeWindowMs = 30 * 24 * 60 * 60 * 1000;
            const onlineCutoff = now - onlineWindowMs;
            const cutoff = now - activeWindowMs;

            const totalUsers = users.length;
            const trackedUsers = users.filter(u => toMillisSafe(u?.usageMetrics?.lastSeenAt) > 0).length;
            const appInstalled = users.filter(u => toMillisSafe(u?.usageMetrics?.platforms?.native?.firstSeenAt) > 0).length;
            const appActive30d = users.filter(u => toMillisSafe(u?.usageMetrics?.platforms?.native?.lastSeenAt) >= cutoff).length;
            const webActive30d = users.filter(u => {
                const webLastSeen = toMillisSafe(u?.usageMetrics?.platforms?.web?.lastSeenAt);
                const pwaLastSeen = toMillisSafe(u?.usageMetrics?.platforms?.pwa?.lastSeenAt);
                return Math.max(webLastSeen, pwaLastSeen) >= cutoff;
            }).length;
            const onlineNow = users.filter(u => toMillisSafe(u?.usageMetrics?.lastSeenAt) >= onlineCutoff).length;

            const onlineList = users
                .filter(u => toMillisSafe(u?.usageMetrics?.lastSeenAt) >= onlineCutoff)
                .map(u => ({
                    id: u.id,
                    email: u.email || '',
                    name: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Usuario',
                    platform: u?.usageMetrics?.lastPlatform || 'unknown',
                    lastSeenAt: toMillisSafe(u?.usageMetrics?.lastSeenAt),
                }))
                .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

            setOnlineUsers(onlineList);
            setUsageReport({
                generatedAt: new Date(),
                totalUsers,
                trackedUsers,
                onlineNow,
                appInstalled,
                appActive30d,
                webActive30d
            });
        } finally {
            setIsBuildingUsageReport(false);
        }
    };

    if (loading) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}>Cargando Admin...</div>;
    if (!isAdmin) return <div style={{ color: 'white', padding: '50px', textAlign: 'center' }}><ShieldAlert size={48} color="red" /><h2>Acceso Denegado</h2></div>;

    const forSaleSongs = songs.filter(s => s.forSale === true && s.isGlobal !== true);
    const filteredSongs = songs.filter(s => {
        const matchesSearch = s.userEmail?.toLowerCase().includes(searchUser.toLowerCase()) ||
                             s.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
                             searchUser === '';
        return matchesSearch && s.isGlobal !== true;
    });

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', padding: '40px', fontFamily: '"Outfit", sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <ShieldAlert size={36} color="#f1c40f" />
                    <h1 style={{ margin: 0, fontWeight: '800' }}>Admin Dashboard | Zion Stage</h1>
                </div>
                <button
                    type="button"
                    disabled={isActivatingPending}
                    title="Usá después de npm run upload:apk (misma PC, Admin con npm run dev) si Firestore falló en la consola."
                onClick={activatePendingRelease}
                    style={{
                        background: '#f43f5e',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: isActivatingPending ? 'wait' : 'pointer',
                        fontSize: '1rem',
                        boxShadow: '0 0 15px rgba(244,63,94,0.5)',
                        whiteSpace: 'nowrap',
                        opacity: isActivatingPending ? 0.7 : 1
                    }}
                >
                    {isActivatingPending ? '…' : (pendingRelease?.versionName ? `🚀 ACTIVAR VERSIÓN ${pendingRelease.versionName}` : '🚀 ACTIVAR VERSIÓN 1.8.13')}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '30px' }}>
                <button onClick={() => setActiveTab('pending')} style={{ background: activeTab === 'pending' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'pending' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Marketplace ({forSaleSongs.length})</button>
                <button onClick={() => setActiveTab('sellers')} style={{ background: activeTab === 'sellers' ? '#10b981' : 'rgba(255,255,255,0.05)', color: activeTab === 'sellers' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Vendedores ({users.filter(u => u.isSeller).length})</button>
                <button onClick={() => setActiveTab('users')} style={{ background: activeTab === 'users' ? '#00d2d3' : 'rgba(255,255,255,0.05)', color: activeTab === 'users' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Usuarios ({users.length})</button>
                <button onClick={() => setActiveTab('reports')} style={{ background: activeTab === 'reports' ? '#22c55e' : 'rgba(255,255,255,0.05)', color: activeTab === 'reports' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Reportes</button>
                <button onClick={() => setActiveTab('coupons')} style={{ background: activeTab === 'coupons' ? '#f59e0b' : 'rgba(255,255,255,0.05)', color: activeTab === 'coupons' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Cupones ({coupons.length})</button>
                <button onClick={() => setActiveTab('artists')} style={{ background: activeTab === 'artists' ? '#f43f5e' : 'rgba(255,255,255,0.05)', color: activeTab === 'artists' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Artistas Maestros ({masterArtists.length})</button>
                <button onClick={() => setActiveTab('library')} style={{ background: activeTab === 'library' ? '#f1c40f' : 'rgba(255,255,255,0.05)', color: activeTab === 'library' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Biblioteca CIF ({songs.filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com').length})</button>
                <button onClick={() => setActiveTab('songs')} style={{ background: activeTab === 'songs' ? '#9b59b6' : 'rgba(255,255,255,0.05)', color: activeTab === 'songs' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Curar Canciones ({filteredSongs.length})</button>
                <button onClick={() => setActiveTab('apps')} style={{ background: activeTab === 'apps' ? '#00d2d3' : 'rgba(255,255,255,0.05)', color: activeTab === 'apps' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>App APK ({appHistory.length})</button>
                <button onClick={() => setActiveTab('banners')} style={{ background: activeTab === 'banners' ? '#6366f1' : 'rgba(255,255,255,0.05)', color: activeTab === 'banners' ? '#fff' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Banners Index ({banners.length})</button>
                <button onClick={() => setActiveTab('letras')} style={{ background: activeTab === 'letras' ? '#a78bfa' : 'rgba(255,255,255,0.05)', color: activeTab === 'letras' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>✏️ Letras ({libraryLyrics.length})</button>
                <button onClick={() => setActiveTab('contacts')} style={{ background: activeTab === 'contacts' ? '#10b981' : 'rgba(255,255,255,0.05)', color: activeTab === 'contacts' ? '#000' : '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>Mensajes ({contacts.length + accountDeletionRequests.length})</button>
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
                                        <button onClick={() => importAllFromArtist(ma)} style={{ background: '#f43f5e', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>IMPORTAR TODO</button>
                                        <button onClick={() => deleteMasterArtist(ma.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                    </div>

                    {selectedArtist && (
                        <div id="song-scrape-results" style={{ marginTop: '40px', background: 'rgba(0,0,0,0.6)', padding: '30px', borderRadius: '30px', border: '3px solid #00d2d3', boxShadow: '0 0 50px rgba(0, 210, 211, 0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0 }}>Canciones de {selectedArtist.name}</h3>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button
                                        onClick={() => importAllFromArtist()}
                                        disabled={isBulkImporting}
                                        style={{ background: '#f1c40f', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}
                                    >
                                        {isBulkImporting ? `IMPORTANDO... (${bulkProgress.current}/${bulkProgress.total})` : `🔥 IMPORTAR TODAS (${artistSongs.length})`}
                                    </button>
                                    <button onClick={() => setSelectedArtist(null)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>Cerrar</button>
                                </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <div>
                            <h2 style={{ margin: 0 }}>Biblioteca de Cifrados ({songs.filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com').length})</h2>
                            <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>Gestiona los acordes y letras importados de LaCuerda.</p>
                        </div>
                        <button
                            onClick={generateMissingLyrics}
                            disabled={isSyncing}
                            style={{ background: 'rgba(241,196,15,0.1)', border: '1px solid #f1c40f', color: '#f1c40f', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {isSyncing ? "PROCESANDO..." : "✨ GENERAR LETRAS FALTANTES"}
                        </button>
                    </div>

                    <div style={{ background: '#1e293b', borderRadius: '20px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {Object.entries(
                            songs
                                .filter(s => s.isGlobal && s.userEmail === 'admin@zionstage.com')
                                .reduce((acc, s) => {
                                    const artistName = s.artist || 'Desconocido';
                                    if (!acc[artistName]) acc[artistName] = [];
                                    acc[artistName].push(s);
                                    return acc;
                                }, {})
                        )
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([artistName, artistSongsList]) => {
                            const isExpanded = expandedArtist === artistName;
                            return (
                                <div key={artistName} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {/* Header del Artista (Clickable) */}
                                    <div 
                                        onClick={() => setExpandedArtist(isExpanded ? null : artistName)}
                                        style={{ 
                                            padding: '20px 25px', 
                                            background: isExpanded ? 'rgba(0,210,211,0.1)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <h3 style={{ margin: 0, color: isExpanded ? '#00d2d3' : 'white', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                                            <User size={20} />
                                            {artistName} 
                                            <span style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 'normal' }}>({artistSongsList.length} canciones)</span>
                                        </h3>
                                        {isExpanded ? <ChevronDown size={20} color="#00d2d3" /> : <ChevronRight size={20} color="#64748b" />}
                                    </div>
                                    
                                    {/* Lista de Canciones (Colapsable) */}
                                    {isExpanded && (
                                        <div style={{ padding: '20px 25px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                                                {artistSongsList
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(s => {
                                                        const hasChords = libraryChords.some(c => c.songId === s.id);
                                                        return (
                                                            <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px 20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{s.name}</div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: hasChords ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: hasChords ? '#10b981' : '#ef4444' }}>
                                                                        {hasChords ? '✓ CON CIFRADO' : '✗ SIN CIFRADO'}
                                                                    </span>
                                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                                        {libraryChords.some(c => c.songId === s.id) && (
                                                                            <button 
                                                                                onClick={() => setViewingChord({ content: libraryChords.find(c => c.songId === s.id).content, title: 'Cifrado' })} 
                                                                                style={{ background: '#00d2d3', border: 'none', color: 'black', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                                                                            >
                                                                                CIF
                                                                            </button>
                                                                        )}
                                                                        {libraryLyrics.some(l => l.songId === s.id) && (
                                                                            <button 
                                                                                onClick={() => setViewingChord({ content: libraryLyrics.find(l => l.songId === s.id).text, title: 'Letra (Teleprompter)' })} 
                                                                                style={{ background: '#f1c40f', border: 'none', color: 'black', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                                                                            >
                                                                                LY
                                                                            </button>
                                                                        )}
                                                                        <button 
                                                                            onClick={() => deleteSong(s.id)} 
                                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

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
                                    <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {s.name}
                                        {(() => {
                                            const hasLyric = libraryLyrics.find(l => l.songId === s.id);
                                            return (
                                                <span
                                                    onClick={() => { if (hasLyric) setViewingChord({ title: `${s.name} — Letra`, content: hasLyric.text || '(vacío)' }); }}
                                                    style={{
                                                        fontSize: '0.6rem', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px',
                                                        cursor: hasLyric ? 'pointer' : 'default',
                                                        background: hasLyric ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                                                        color: hasLyric ? '#10b981' : '#475569',
                                                        border: `1px solid ${hasLyric ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                                        transition: 'transform 0.15s',
                                                    }}
                                                    onMouseEnter={e => { if (hasLyric) e.target.style.transform = 'scale(1.15)'; }}
                                                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                                    title={hasLyric ? 'Ver letra' : 'Sin letra vinculada'}
                                                >L</span>
                                            );
                                        })()}
                                        {(() => {
                                            const hasChord = libraryChords.find(c => c.songId === s.id);
                                            return (
                                                <span
                                                    onClick={() => { if (hasChord) setViewingChord({ title: `${s.name} — Cifrado`, content: hasChord.content || hasChord.text || '(vacío)' }); }}
                                                    style={{
                                                        fontSize: '0.6rem', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px',
                                                        cursor: hasChord ? 'pointer' : 'default',
                                                        background: hasChord ? 'rgba(0,210,211,0.15)' : 'rgba(255,255,255,0.06)',
                                                        color: hasChord ? '#00d2d3' : '#475569',
                                                        border: `1px solid ${hasChord ? 'rgba(0,210,211,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                                        transition: 'transform 0.15s',
                                                    }}
                                                    onMouseEnter={e => { if (hasChord) e.target.style.transform = 'scale(1.15)'; }}
                                                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                                    title={hasChord ? 'Ver cifrado' : 'Sin cifrado vinculado'}
                                                >C</span>
                                            );
                                        })()}
                                    </div>
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
                                    <button
                                        onClick={() => {
                                            const detected = autoDetectLinks(s);
                                            setLinkingSong(s);
                                            setLinkChordId(detected.chord?.id || '');
                                            setLinkLyricId(detected.lyric?.id || '');
                                        }}
                                        title="Vincular con Letra y Cifrado"
                                        style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                                    >
                                        🔗 VINCULAR
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

                    {/* — Linking Modal — */}
                    {linkingSong && (() => {
                        const chordSong = songs.find(s => s.id === libraryChords.find(c => c.id === linkChordId)?.songId);
                        const lyricSong = songs.find(s => s.id === libraryLyrics.find(l => l.id === linkLyricId)?.songId);
                        const alreadyLinkedChord = libraryChords.find(c => c.songId === linkingSong.id);
                        const alreadyLinkedLyric = libraryLyrics.find(l => l.songId === linkingSong.id);
                        const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                            ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

                        const searchLaCuerda = async () => {
                            setLcSearchResults([]);
                            setLcSearching(true);
                            try {
                                const url = `${devProxy}/api/search-lacuerda?artist=${encodeURIComponent(linkingSong.artist || '')}&song=${encodeURIComponent(linkingSong.name || '')}`;
                                const resp = await fetch(url);
                                const data = await resp.json();
                                setLcSearchResults(data.results || []);
                            } catch (e) {
                                alert('Error buscando en LaCuerda: ' + e.message);
                            } finally {
                                setLcSearching(false);
                            }
                        };

                        const importFromLaCuerda = async (result) => {
                            setLcImporting(result.songSlug);
                            try {
                                const resp = await fetch(`${devProxy}/api/scrape-full-song?artistSlug=${result.artistSlug}&songSlug=${result.songSlug}`);
                                if (!resp.ok) throw new Error(`Error ${resp.status}`);
                                const data = await resp.json();
                                if (!data.content) throw new Error('No se extrajo contenido');

                                // Save chords doc
                                const chordRef = await addDoc(collection(db, 'chords'), {
                                    songId: linkingSong.id,
                                    content: data.content,
                                    source: result.url,
                                    createdAt: serverTimestamp()
                                });
                                // Save lyrics doc (auto-cleaned)
                                const { extractLyricsOnly } = await import('../utils/lyricsExtractor');
                                const lyricsText = extractLyricsOnly(data.content);
                                const lyricRef = await addDoc(collection(db, 'lyrics'), {
                                    songId: linkingSong.id,
                                    text: lyricsText,
                                    createdAt: serverTimestamp()
                                });

                                alert(`✅ ¡Importado y vinculado!\nCifrado y letra de "${linkingSong.name}" ya están en la biblioteca.`);
                                setLinkingSong(null);
                                setLcSearchResults([]);
                                setLinkChordId('');
                                setLinkLyricId('');
                            } catch (e) {
                                console.error(e);
                                alert('Error importando: ' + e.message);
                            } finally {
                                setLcImporting(null);
                            }
                        };

                        return (
                            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px', overflowY: 'auto' }}>
                                <div style={{ background: '#1e293b', width: '100%', maxWidth: '720px', borderRadius: '28px', padding: '36px', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', margin: 'auto' }}>

                                    {/* Header */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '900', letterSpacing: '1px' }}>VINCULAR MT</span>
                                        </div>
                                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900' }}>{linkingSong.name}</h2>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>{linkingSong.artist || 'Artista desconocido'}</p>
                                    </div>

                                    {/* Current links badge */}
                                    {(alreadyLinkedChord || alreadyLinkedLyric) && (
                                        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.85rem', color: '#10b981' }}>
                                            ✅ Links actuales — Cifrado: {alreadyLinkedChord ? 'Sí' : 'No'} · Letra: {alreadyLinkedLyric ? 'Sí' : 'No'}
                                        </div>
                                    )}

                                    {/* ── LaCuerda Search Section ── */}
                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                            <div>
                                                <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#f1c40f' }}>🌐 Buscar en LaCuerda.net</span>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                                    {!alreadyLinkedChord && !alreadyLinkedLyric ? '⚠ Sin cifrado/letra en base de datos. Búscalo e impórtalo directamente.' : 'Puedes re-importar si algo falló.'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={searchLaCuerda}
                                                disabled={lcSearching}
                                                style={{ background: '#f1c40f', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: '900', fontSize: '0.85rem', opacity: lcSearching ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                            >
                                                {lcSearching ? '🔍 Buscando...' : '🔍 Buscar'}
                                            </button>
                                        </div>

                                        {/* Results list */}
                                        {lcSearchResults.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                                                {lcSearchResults.map((r, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px', gap: '10px' }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.88rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.displayName}</div>
                                                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{r.artistSlug} / {r.songSlug}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => importFromLaCuerda(r)}
                                                            disabled={!!lcImporting}
                                                            style={{ background: lcImporting === r.songSlug ? '#10b981' : '#a78bfa', color: 'white', border: 'none', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.78rem', flexShrink: 0, opacity: lcImporting && lcImporting !== r.songSlug ? 0.4 : 1 }}
                                                        >
                                                            {lcImporting === r.songSlug ? '⏳ Importando...' : '⬇ Importar'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {lcSearchResults.length === 0 && !lcSearching && (
                                            <div style={{ fontSize: '0.8rem', color: '#475569', textAlign: 'center', padding: '8px 0' }}>
                                                Presiona "Buscar" para encontrar esta canción en LaCuerda.net
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Manual link selectors ── */}
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '14px' }}>
                                            O vincula manualmente con docs existentes
                                        </div>

                                        <div style={{ marginBottom: '14px' }}>
                                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#00d2d3', marginBottom: '6px', textTransform: 'uppercase' }}>Cifrado</label>
                                            {linkChordId && chordSong && (
                                                <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginBottom: '4px' }}>🧠 Auto-match: "{chordSong.name}" — {chordSong.artist}</div>
                                            )}
                                            <select value={linkChordId} onChange={e => setLinkChordId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}>
                                                <option value="">-- Sin vincular --</option>
                                                {libraryChords.map(c => {
                                                    const cSong = songs.find(s => s.id === c.songId);
                                                    return <option key={c.id} value={c.id}>{cSong ? `${cSong.name} — ${cSong.artist || '—'}` : c.id}</option>;
                                                })}
                                            </select>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#a78bfa', marginBottom: '6px', textTransform: 'uppercase' }}>Letra</label>
                                            {linkLyricId && lyricSong && (
                                                <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginBottom: '4px' }}>🧠 Auto-match: "{lyricSong.name}" — {lyricSong.artist}</div>
                                            )}
                                            <select value={linkLyricId} onChange={e => setLinkLyricId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}>
                                                <option value="">-- Sin vincular --</option>
                                                {libraryLyrics.map(l => {
                                                    const lSong = songs.find(s => s.id === l.songId);
                                                    return <option key={l.id} value={l.id}>{lSong ? `${lSong.name} — ${lSong.artist || '—'}` : l.id}</option>;
                                                })}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={() => { setLinkingSong(null); setLinkChordId(''); setLinkLyricId(''); setLcSearchResults([]); }}
                                            style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: '800' }}
                                        >Cancelar</button>
                                        <button
                                            onClick={saveLink}
                                            disabled={isSavingLink || (!linkChordId && !linkLyricId)}
                                            style={{ flex: 2, padding: '14px', borderRadius: '12px', background: linkChordId || linkLyricId ? '#a78bfa' : 'rgba(167,139,250,0.2)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '900', fontSize: '1rem', opacity: isSavingLink ? 0.6 : 1 }}
                                        >
                                            <Save size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                            {isSavingLink ? 'Guardando...' : 'Guardar Vínculos'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
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
                            <button
                                type="button"
                                onClick={downloadUsersEmailsCsvForPlayStore}
                                disabled={users.length === 0}
                                title="Un correo por línea, sin cabecera — formato que acepta Google Play Console (testers)"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    background: users.length === 0 ? '#475569' : '#0ea5e9',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: users.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: '800',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <Download size={18} />
                                CSV Play (testers)
                            </button>
                            <button
                                type="button"
                                onClick={downloadUsersEmailsCsvDetailed}
                                disabled={users.length === 0}
                                title="email, nombre, uid, planId — para Excel; no usar en Play Console"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: users.length === 0 ? '#334155' : 'rgba(255,255,255,0.12)',
                                    color: '#e2e8f0',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    cursor: users.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: '700',
                                    fontSize: '0.8rem',
                                }}
                            >
                                CSV Excel
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

            {activeTab === 'reports' && (
                <div className="fade-in">
                    <div style={{ background: '#1e293b', borderRadius: '20px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <BarChart3 size={24} color="#22c55e" />
                                    Reporte de Uso
                                </h2>
                                <p style={{ color: '#94a3b8', margin: '6px 0 0 0' }}>Instalaciones app y usuarios activos de app/web (ventana: 30 días).</p>
                            </div>
                            <button
                                onClick={buildUsageReport}
                                disabled={isBuildingUsageReport}
                                style={{ background: '#22c55e', color: '#04130a', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '800' }}
                            >
                                {isBuildingUsageReport ? 'Generando...' : 'Generar reporte'}
                            </button>
                        </div>

                        {usageReport ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Usuarios totales</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{usageReport.totalUsers}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Usuarios con tracking</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{usageReport.trackedUsers}</div>
                                </div>
                                <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ color: '#6ee7b7', fontSize: '0.8rem' }}>Usando ahora (5 min)</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{usageReport.onlineNow}</div>
                                </div>
                                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ color: '#86efac', fontSize: '0.8rem' }}>App instalada (nativa)</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{usageReport.appInstalled}</div>
                                </div>
                                <div style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ color: '#7dd3fc', fontSize: '0.8rem' }}>Activos app (30d)</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{usageReport.appActive30d}</div>
                                </div>
                                <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ color: '#c4b5fd', fontSize: '0.8rem' }}>Activos web app (30d)</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{usageReport.webActive30d}</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: '#64748b', fontSize: '0.95rem' }}>Pulsa <strong>Generar reporte</strong> para ver las métricas.</div>
                        )}

                        {usageReport && (
                            <div style={{ marginTop: '22px' }}>
                                <h3 style={{ margin: '0 0 10px 0' }}>Usuarios activos ahora</h3>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                                    {onlineUsers.length === 0 ? (
                                        <div style={{ padding: '12px 14px', color: '#64748b' }}>No hay usuarios activos en los ultimos 5 minutos.</div>
                                    ) : (
                                        onlineUsers.map((u) => (
                                            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700' }}>{u.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{u.email || 'sin email'}</div>
                                                </div>
                                                <div style={{ alignSelf: 'center', color: '#22d3ee', fontWeight: '700', textTransform: 'uppercase' }}>{u.platform}</div>
                                                <div style={{ alignSelf: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{new Date(u.lastSeenAt).toLocaleTimeString()}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {usageReport?.generatedAt && (
                            <div style={{ marginTop: '15px', fontSize: '0.8rem', color: '#64748b' }}>
                                Generado: {usageReport.generatedAt.toLocaleString()}
                            </div>
                        )}
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
                    <h2>Mensajes de contacto</h2>
                    {contacts.length === 0 && <p style={{ color: '#64748b' }}>No hay mensajes.</p>}
                    {contacts.map(c => (
                        <div key={c.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '15px' }}>
                            <div style={{ fontWeight: '800' }}>{c.nombre} ({c.email})</div>
                            <p style={{ color: '#94a3b8', marginTop: '10px' }}>{c.mensaje}</p>
                        </div>
                    ))}

                    <h2 style={{ marginTop: '40px', color: '#f87171' }}>Solicitudes de eliminación de cuenta</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>Tramitar en Firebase Auth / Firestore según tu proceso interno. UID si el usuario estaba logueado.</p>
                    {accountDeletionRequests.length === 0 && <p style={{ color: '#64748b' }}>No hay solicitudes.</p>}
                    {accountDeletionRequests.map(r => (
                        <div key={r.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(248,113,113,0.25)' }}>
                            <div style={{ fontWeight: '800' }}>{r.email}{r.nombre ? ` — ${r.nombre}` : ''}</div>
                            {r.authUid && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>UID: {r.authUid}</div>}
                            {r.detalles && <p style={{ color: '#94a3b8', marginTop: '10px', whiteSpace: 'pre-wrap' }}>{r.detalles}</p>}
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>Estado: {r.estado || 'pending'}{r.leido ? ' · leído' : ''}</div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'letras' && (
                <div className="fade-in">
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={24} color="#a78bfa" /> Editor de Letras
                            </h2>
                            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                {libraryLyrics.length} letras en la base de datos · Edita y guarda manualmente para limpiar acordes residuales.
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', minWidth: '280px' }}>
                            <Search size={16} color="#64748b" />
                            <input
                                value={lyricsSearch}
                                onChange={e => setLyricsSearch(e.target.value)}
                                placeholder="Buscar canción o artista..."
                                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.95rem', flex: 1, outline: 'none', fontFamily: '"Outfit", sans-serif' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: editingLyric ? '1fr 1.5fr' : '1fr', gap: '24px', alignItems: 'start' }}>

                        {/* Song list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
                            {libraryLyrics
                                .filter(l => {
                                    const song = songs.find(s => s.id === l.songId);
                                    const q = lyricsSearch.toLowerCase();
                                    if (!q) return true;
                                    return (
                                        song?.name?.toLowerCase().includes(q) ||
                                        song?.artist?.toLowerCase().includes(q)
                                    );
                                })
                                .map(lyric => {
                                    const song = songs.find(s => s.id === lyric.songId);
                                    const isSelected = editingLyric?.id === lyric.id;
                                    const hasChords = /(^|\n)[ \t]*[A-G][#b]?(m|maj|min|aug|dim|sus|add)?\d*(\/[A-G][#b]?)?[ \t]*($|\n)/m.test(lyric.text || '');
                                    return (
                                        <div
                                            key={lyric.id}
                                            onClick={() => {
                                                if (editingLyric?.id === lyric.id) return;
                                                setEditingLyric(lyric);
                                                setEditingLyricText(lyric.text || '');
                                            }}
                                            style={{
                                                background: isSelected ? 'rgba(167,139,250,0.15)' : '#1e293b',
                                                border: `1px solid ${isSelected ? '#a78bfa' : 'rgba(255,255,255,0.05)'}`,
                                                borderRadius: '12px',
                                                padding: '14px 18px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: '12px'
                                            }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: '800', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {song?.name || lyric.songId}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                                    {song?.artist || '—'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                {hasChords && (
                                                    <span title="Contiene acordes residuales" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                                                        ⚠ CIFRADO
                                                    </span>
                                                )}
                                                <ChevronRight size={16} color={isSelected ? '#a78bfa' : '#334155'} />
                                            </div>
                                        </div>
                                    );
                                })
                            }
                            {libraryLyrics.length === 0 && (
                                <p style={{ color: '#64748b', textAlign: 'center', padding: '40px 0' }}>No hay letras en la base de datos.</p>
                            )}
                        </div>

                        {/* Editor panel */}
                        {editingLyric && (() => {
                            const song = songs.find(s => s.id === editingLyric.songId);
                            return (
                                <div style={{ background: '#1e293b', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '20px', overflow: 'hidden', position: 'sticky', top: '20px' }}>
                                    {/* Editor header */}
                                    <div style={{ padding: '16px 24px', background: 'rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: '0.7rem', fontWeight: '900', padding: '3px 10px', borderRadius: '6px', letterSpacing: '1px' }}>LETRA</span>
                                                <span style={{ fontWeight: '900', fontSize: '1rem' }}>{song?.name || '—'}</span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{song?.artist || '—'}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => { setEditingLyric(null); setEditingLyricText(''); }}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setSavingLyric(true);
                                                    try {
                                                        await updateDoc(doc(db, 'lyrics', editingLyric.id), {
                                                            text: editingLyricText,
                                                            updatedAt: serverTimestamp()
                                                        });
                                                        // Update local state so badge refreshes
                                                        setLibraryLyrics(prev => prev.map(l =>
                                                            l.id === editingLyric.id ? { ...l, text: editingLyricText } : l
                                                        ));
                                                        setEditingLyric(prev => ({ ...prev, text: editingLyricText }));
                                                        alert('✅ Letra guardada correctamente.');
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert('Error al guardar: ' + e.message);
                                                    } finally {
                                                        setSavingLyric(false);
                                                    }
                                                }}
                                                disabled={savingLyric}
                                                style={{ background: '#a78bfa', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: savingLyric ? 0.6 : 1 }}
                                            >
                                                <Save size={16} />
                                                {savingLyric ? 'Guardando...' : 'Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Textarea */}
                                    <div style={{ padding: '20px 24px' }}>
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '10px', marginTop: 0 }}>
                                            Edita el texto directamente. Elimina líneas de acordes, tablaturas o encabezados sobrantes.
                                        </p>
                                        <textarea
                                            value={editingLyricText}
                                            onChange={e => setEditingLyricText(e.target.value)}
                                            rows={28}
                                            style={{
                                                width: '100%',
                                                background: '#020617',
                                                color: '#e2e8f0',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '12px',
                                                padding: '16px',
                                                fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
                                                fontSize: '0.9rem',
                                                lineHeight: '1.7',
                                                resize: 'vertical',
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#475569' }}>
                                            <span>{editingLyricText.split('\n').length} líneas</span>
                                            <span>{editingLyricText.length} caracteres</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
            {/* ── APK PUBLISHER ── */}
            {activeTab === 'apk150' && (
                <div style={{ padding: '20px' }}>
                    <h2 style={{ color: '#00d2d3' }}>Publicar Nueva Versión 1.5.0</h2>
                    <p style={{ color: '#94a3b8' }}>La versión del APK ha sido compilada con éxito y subida a los servidores. Haz clic aquí abajo para ponerla a disposición de los usuarios y que la app la reconozca como la última descargable instalada.</p>
                    <button 
                        className="btn-teal" 
                        onClick={async () => {
                            try {
                                await addDoc(collection(db, 'app_versions'), {
                                    versionName: "1.5.0",
                                    downloadUrl: "https://f005.backblazeb2.com/file/mixercur/apps/zion-stage-release-1775782309421.apk",
                                    createdAt: serverTimestamp()
                                });
                                alert("¡APK 1.5.0 publicado con éxito! Ya pueden descargarlo.");
                            } catch(e) {
                                alert("Error: " + e.message);
                            }
                        }}
                    >
                        PUBLICAR APK 1.5.0 AHORA
                    </button>
                </div>
            )}

            {/* ── Global Preview Modal (L / C badges) ── */}
            {viewingChord && (
                <div onClick={() => setViewingChord(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', width: '100%', maxWidth: '900px', height: '90vh', borderRadius: '30px', padding: '40px', overflowY: 'auto', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => setViewingChord(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f43f5e', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>CERRAR</button>
                        <h2 style={{ marginBottom: '30px', color: '#00d2d3' }}>Previsualización: {viewingChord.title}</h2>
                        <pre style={{ background: '#0f172a', padding: '30px', borderRadius: '15px', color: '#10b981', fontFamily: 'monospace', fontSize: '1rem', whiteSpace: 'pre-wrap', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {viewingChord.content}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
