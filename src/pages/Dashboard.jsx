import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import {
    Upload, Music2, Music, User, Tag, CheckCircle2, Play, ShoppingCart,
    ChevronRight, ArrowLeft, Layers, Cloud,
    Loader2, Timer, KeyRound, ScrollText, X, Settings2, Trash2, ListMusic, Plus, Search,
    Home, Globe, CreditCard, HelpCircle, LogOut
} from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const STORAGE_PLANS = [
    { id: 'free', name: 'Gratis', type: 'Gratis', storageGB: 0.3, storageMB: 300, price: 0, annualPrice: 0, originalAnnualPrice: 0, isVIP: false, paypalPlanId: null, paypalAnnualPlanId: null },
    { id: 'std1', name: 'Básico', type: 'Estándar', storageGB: 2, storageMB: 2000, price: 4.99, annualPrice: 41.92, originalAnnualPrice: 59.88, isVIP: false, paypalPlanId: 'P-5V883824L48630642NGWF2TI', paypalAnnualPlanId: 'P-1V555579FE024291HNGWGARY' },
    { id: 'std2', name: 'Estándar', type: 'Estándar', storageGB: 5, storageMB: 5000, price: 6.99, annualPrice: 58.72, originalAnnualPrice: 83.88, isVIP: false, paypalPlanId: 'P-0LN81126VT8376340NGWF2TI', paypalAnnualPlanId: 'P-7P753711U8740183VNGWGARY' },
    { id: 'std3', name: 'Plus', type: 'Estándar', storageGB: 10, storageMB: 10000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: false, paypalPlanId: 'P-1JF86890TD7917355NGWF2TI', paypalAnnualPlanId: 'P-72H39137542477505NGWGARY' },
    { id: 'vip1', name: 'Básico VIP', type: 'VIP', storageGB: 2, storageMB: 2000, price: 7.99, annualPrice: 67.12, originalAnnualPrice: 95.88, isVIP: true, paypalPlanId: 'P-6DN90892YD0960819NGWF2TI', paypalAnnualPlanId: 'P-4A716576TL7686632NGWGARY' },
    { id: 'vip2', name: 'Estándar VIP', type: 'VIP', storageGB: 5, storageMB: 5000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: true, paypalPlanId: 'P-7TA23786BR697132BNGWF2TI', paypalAnnualPlanId: 'P-4L582472BL815500PNGWGARY' },
    { id: 'vip3', name: 'Plus VIP', type: 'VIP', storageGB: 10, storageMB: 10000, price: 12.99, annualPrice: 109.12, originalAnnualPrice: 155.88, isVIP: true, paypalPlanId: 'P-2MJ57547S3825450TNGWF2TI', paypalAnnualPlanId: 'P-7DW310052Y263572BNGWGARY' },
];

// ── Audio Multi-Track Mixing System for Waveforms ───────────────
async function generateMixBlob(tracks) {
    if (!tracks || tracks.length === 0) return null;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const validTracks = tracks.filter(t => {
            const name = (t.displayName || '').toLowerCase();
            return !name.includes('click') && !name.includes('guide') && !name.includes('cue') && !name.includes('guia');
        });
        const buffers = await Promise.all((validTracks.length > 0 ? validTracks : tracks).map(async t => {
            const arrayBuf = await t.blob.arrayBuffer();
            return audioCtx.decodeAudioData(arrayBuf);
        }));
        const maxDuration = Math.max(...buffers.map(b => b.duration));
        const offlineCtx = new OfflineAudioContext(1, 22050 * maxDuration, 22050);
        buffers.forEach(buf => {
            const source = offlineCtx.createBufferSource();
            source.buffer = buf;
            source.connect(offlineCtx.destination);
            source.start();
        });
        const rendered = await offlineCtx.startRendering();
        return audioBufferToWav(rendered);
    } catch (e) {
        console.error("[MIX] Falló generación de mezcla de onda:", e);
        return null;
    }
}

function audioBufferToWav(buffer) {
    const length = buffer.length * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const sampleRate = buffer.sampleRate;
    const writeString = (v, off, str) => {
        for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length - 44, true);
    const data = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
        let sample = Math.max(-1, Math.min(1, data[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
}

export default function Dashboard() {
    const navigate = useNavigate();
    const fileInputRef = useRef();

    const [activeTab, setActiveTab] = useState('home');
    const [step, setStep] = useState('idle');
    const [useType, setUseType] = useState(null);
    const [hasRights, setHasRights] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentUploadTrack, setCurrentUploadTrack] = useState(''); // Nuevo: Tracking de pista actual

    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [songKey, setSongKey] = useState('');
    const [tempo, setTempo] = useState('');
    const [timeSignature, setTimeSignature] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [chords, setChords] = useState('');
    const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);
    const [isChordsModalOpen, setIsChordsModalOpen] = useState(false);
    const [editingSongId, setEditingSongId] = useState(null);
    const [importUrl, setImportUrl] = useState('');
    const [isScraping, setIsScraping] = useState(false);

    const [editingLyricsSong, setEditingLyricsSong] = useState(null);
    const [tempLyrics, setTempLyrics] = useState('');
    const [editingSongInfo, setEditingSongInfo] = useState(null);
    const [editingSetlist, setEditingSetlist] = useState(null);

    const [userSongs, setUserSongs] = useState([]);
    const [userSetlists, setUserSetlists] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [globalSongs, setGlobalSongs] = useState([]);
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

    // New User Plan state
    const [userPlan, setUserPlan] = useState(STORAGE_PLANS[0]);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [isInitialPlanSelection, setIsInitialPlanSelection] = useState(false);
    const [pendingPaymentPlan, setPendingPaymentPlan] = useState(null);
    const [isAnnual, setIsAnnual] = useState(false);

    // New Setlist UI states
    const [isSetlistModalOpen, setIsSetlistModalOpen] = useState(false);
    const [newSetlistName, setNewSetlistName] = useState('');
    const [isEditSetlistModalOpen, setIsEditSetlistModalOpen] = useState(false);
    const [editingSetlistData, setEditingSetlistData] = useState(null);
    const [songSearchQuery, setSongSearchQuery] = useState('');

    const [customStorageGB, setCustomStorageGB] = useState(0);

    const usedMB = userSongs.reduce((acc, s) =>
        acc + (s.tracks || []).reduce((a, t) => a + parseFloat(t.sizeMB || 0), 0), 0);
    const storageLimit = customStorageGB > 0 ? (customStorageGB * 1024) : (userPlan?.storageMB || 1000);
    const usedPercent = Math.min(100, (usedMB / storageLimit) * 100);

    useEffect(() => {
        let unsubSongs = () => { };
        let unsubSetlists = () => { };
        let unsubUser = () => { };
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                // Fetch User Plan from Firestore safely
                unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        const plan = STORAGE_PLANS.find(p => p.id === data.planId) || STORAGE_PLANS[0];
                        setUserPlan(plan);
                        setCustomStorageGB(data.customStorageGB || 0);

                        // Check local storage to ensure we don't spam the user with the modal on every login
                        const hasSeenModal = localStorage.getItem(`mixer_seen_pricing_${user.uid}`);

                        if (!data.planId || data.planId === 'free') {
                            if (!hasSeenModal) {
                                setTimeout(() => {
                                    setIsInitialPlanSelection(true);
                                    setIsPricingModalOpen(true);
                                }, 500);
                            }
                        }
                    } else {
                        // User exists in auth but not in users collection yet
                        setDoc(doc(db, 'users', user.uid), {
                            planId: 'free',
                            email: user.email || '',
                            displayName: user.displayName || '',
                            createdAt: serverTimestamp()
                        }, { merge: true })
                            .then(() => {
                                setUserPlan(STORAGE_PLANS[0]);
                                setCustomStorageGB(0);
                                setTimeout(() => {
                                    setIsInitialPlanSelection(true);
                                    setIsPricingModalOpen(true);
                                }, 800);
                            })
                            .catch(err => console.error("Error creating user profile:", err));
                    }
                }, (error) => {
                    console.error("Error fetching user plan:", error);
                    // Fallback to free plan on permission error or other errors
                    setUserPlan(STORAGE_PLANS[0]);
                });

                // Fetch Songs based on Plan Access
                const q = query(collection(db, 'songs'));
                unsubSongs = onSnapshot(q, (snap) => {
                    const songs = [];
                    snap.forEach(doc => {
                        const s = { id: doc.id, ...doc.data() };
                        if (userPlan?.isVIP || s.userId === user.uid) {
                            songs.push(s);
                        }
                    });
                    songs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setUserSongs(songs);
                    setGlobalSongs(songs);
                }, (error) => {
                    console.error("Error fetching songs:", error);
                });

                const q2 = query(collection(db, 'setlists'), where('userId', '==', user.uid));
                unsubSetlists = onSnapshot(q2, (snap) => {
                    const slists = [];
                    snap.forEach(doc => slists.push({ id: doc.id, ...doc.data() }));
                    slists.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setUserSetlists(slists);
                }, (error) => {
                    console.error("Error fetching setlists:", error);
                });
            } else {
                setUserSongs([]);
                setUserSetlists([]);
                navigate('/');
            }
        });
        return () => { unsubAuth(); unsubSongs(); unsubSetlists(); unsubUser(); };
    }, [navigate, userPlan?.isVIP]); // Re-run if VIP status changes

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const zip = new JSZip();
        try {
            // Reset states from previous upload to avoid leakage
            setSongName(''); setArtist(''); setSongKey(''); setTempo('');
            setTimeSignature(''); setLyrics(''); setChords(''); setFileList([]);

            const cleanName = file.name.replace(/\.zip$/i, '');
            const parts = cleanName.split('-').map(p => p.trim());

            if (parts.length >= 1) setSongName(parts[0]);
            if (parts.length >= 2) setArtist(parts[1]);

            // Try to extract tempo (usually contains numbers) and key from remaining parts
            if (parts.length >= 3) {
                if (/\d/.test(parts[2])) setTempo(parts[2].replace(/[^\d.]/g, ''));
                else setSongKey(parts[2]);
            }

            if (parts.length >= 4) {
                if (/\d/.test(parts[3])) setTempo(parts[3].replace(/[^\d.]/g, ''));
                else setSongKey(parts[3]);
            }
            const contents = await zip.loadAsync(file);
            const extractedFiles = [];
            for (const filename of Object.keys(contents.files)) {
                if (filename.endsWith('.wav') || filename.endsWith('.mp3')) {
                    const fileData = await contents.files[filename].async('blob');
                    let rawName = filename.split('/').pop().replace(/\.(wav|mp3)$/i, '');
                    let safeDisplayName = rawName.replace(/[^a-zA-Z0-9_-]/g, '');
                    if (!safeDisplayName) safeDisplayName = `Track_${extractedFiles.length + 1}`;
                    extractedFiles.push({ originalName: filename, displayName: safeDisplayName, blob: fileData, extension: filename.split('.').pop() });
                }
            }
            setFileList(extractedFiles);
            setStep('details');
        } catch (err) { alert('Error: ' + err.message); }
    };

    const uploadToB2 = async () => {
        if (!songName.trim()) return alert('Nombre requerido');
        if (!currentUser) return;
        setIsUploading(true);
        setStep('uploading');
        const uploadedTracksInfo = [];
        const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : 'https://mixernew-production.up.railway.app';

        const uploadFile = (blob, fileName, displayName, originalName, onProgress) => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();
                formData.append('audioFile', blob);
                formData.append('fileName', fileName);

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(e.loaded, e.total);
                    }
                });

                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch (e) { reject(new Error("Error parsing server response")); }
                        } else {
                            reject(new Error(`Error ${xhr.status}: ${xhr.responseText || 'Fallo en subida'}`));
                        }
                    }
                };

                xhr.onerror = () => reject(new Error("Error de red o conexión perdida"));
                xhr.open('POST', `${devProxy}/upload`, true);
                xhr.send(formData);
            });
        };

        try {
            const totalSize = fileList.reduce((acc, f) => acc + f.blob.size, 0);
            let totalLoaded = 0;
            const trackProgress = {};

            const updateOverallProgress = () => {
                const currentLoaded = Object.values(trackProgress).reduce((a, b) => a + b, 0);
                const percent = Math.round((currentLoaded / totalSize) * 100);
                setUploadProgress(Math.min(95, percent)); // 95% is max until everything finishes
            };

            // Subir secuencialmente para conexiones inestables (Ecuador)
            for (let i = 0; i < fileList.length; i++) {
                const track = fileList[i];
                setCurrentUploadTrack(track.displayName || 'Pista');

                const safeName = songName.replace(/\s+/g, '_');
                const safeTrackName = (track.displayName || 'track').replace(/\s+/g, '_');
                const b2Filename = `audio_${currentUser.uid}_${Date.now()}_${safeName}_${safeTrackName}.mp3`;

                const data = await uploadFile(
                    track.blob,
                    b2Filename,
                    track.displayName,
                    track.originalName,
                    (loaded, total) => {
                        trackProgress[i] = loaded;
                        updateOverallProgress();
                    }
                );

                uploadedTracksInfo.push({
                    name: track.displayName || 'Pista',
                    originalName: track.originalName || 'file',
                    url: data.url || '',
                    b2FileId: data.fileId || '',
                    sizeMB: (track.blob.size / 1024 / 1024).toFixed(2)
                });
            }

            // Generar preview Mix
            setCurrentUploadTrack('Generando Mix de Previsualización...');
            setUploadProgress(96);
            const mixBlob = await generateMixBlob(fileList);
            if (mixBlob) {
                const b2Filename = `audio_${currentUser.uid}_${Date.now()}_${songName.replace(/\s+/g, '_')}__PreviewMix.mp3`;
                const data = await uploadFile(mixBlob, b2Filename, '__PreviewMix', 'preview.mp3', () => { });
                uploadedTracksInfo.push({
                    name: '__PreviewMix',
                    url: data.url,
                    b2FileId: data.fileId,
                    isWaveformSource: true,
                    sizeMB: (mixBlob.size / 1024 / 1024).toFixed(2)
                });
            }
            setCurrentUploadTrack('Finalizando...');
            setUploadProgress(98);

            const songDoc = await addDoc(collection(db, 'songs'), {
                name: songName || 'Sin título',
                artist: artist || 'Desconocido',
                key: songKey || '',
                tempo: tempo || '',
                timeSignature: timeSignature || '',
                useType: useType || 'personal',
                status: useType === 'sell' ? 'pending' : 'active',
                userId: currentUser.uid,
                userEmail: currentUser.email || '',
                tracks: uploadedTracksInfo,
                createdAt: serverTimestamp(),
                isGlobal: false
            });

            if (lyrics && lyrics.trim()) await addDoc(collection(db, 'lyrics'), { songId: songDoc.id, text: lyrics, updatedAt: serverTimestamp() });
            if (chords && chords.trim()) await addDoc(collection(db, 'chords'), { songId: songDoc.id, text: chords, updatedAt: serverTimestamp() });

            setStep('done');
            setTimeout(() => { resetWizard(); setActiveTab('home'); }, 2000);
        } catch (e) {
            console.error("Error completo de subida:", e);
            alert("Ocurrió un error en la subida: " + (e.message || "Revisa tu conexión"));
            setStep('details');
        } finally {
            setIsUploading(false);
        }
    };

    const resetWizard = () => {
        setStep('idle'); setFileList([]); setSongName(''); setArtist(''); setSongKey(''); setTempo(''); setTimeSignature(''); setLyrics(''); setChords(''); setUseType(null); setHasRights(false);
    };

    const handleCreateSetlist = async (e) => {
        e.preventDefault();
        if (!newSetlistName.trim() || !currentUser) return;
        try {
            await addDoc(collection(db, 'setlists'), {
                name: newSetlistName.trim(),
                userId: currentUser.uid,
                songs: [],
                createdAt: serverTimestamp()
            });
            setIsSetlistModalOpen(false);
            setNewSetlistName('');
        } catch (e) { console.error(e); }
    };

    const openLyricsHandler = async (songId) => {
        setEditingSongId(songId);
        setLyrics('');
        try {
            const q = query(collection(db, 'lyrics'), where('songId', '==', songId));
            const snap = await getDocs(q);
            if (!snap.empty) setLyrics(snap.docs[0].data().text);
            setIsLyricsModalOpen(true);
        } catch (e) { console.error(e); }
    };

    const openChordsHandler = async (songId) => {
        setEditingSongId(songId);
        setChords('');
        try {
            const q = query(collection(db, 'chords'), where('songId', '==', songId));
            const snap = await getDocs(q);
            if (!snap.empty) setChords(snap.docs[0].data().text);
            setIsChordsModalOpen(true);
        } catch (e) { console.error(e); }
    };

    const saveLyricsHandler = async () => {
        if (!editingSongId) return setIsLyricsModalOpen(false);
        try {
            const q = query(collection(db, 'lyrics'), where('songId', '==', editingSongId));
            const snap = await getDocs(q);
            if (!snap.empty) {
                await updateDoc(doc(db, 'lyrics', snap.docs[0].id), { text: lyrics, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(db, 'lyrics'), { songId: editingSongId, text: lyrics, updatedAt: serverTimestamp() });
            }
            setIsLyricsModalOpen(false);
            setEditingSongId(null);
        } catch (e) { console.error(e); alert("Error saving lyrics"); }
    };

    const saveChordsHandler = async () => {
        if (!editingSongId) return setIsChordsModalOpen(false);
        try {
            const q = query(collection(db, 'chords'), where('songId', '==', editingSongId));
            const snap = await getDocs(q);
            if (!snap.empty) {
                await updateDoc(doc(db, 'chords', snap.docs[0].id), { text: chords, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(db, 'chords'), { songId: editingSongId, text: chords, updatedAt: serverTimestamp() });
            }
            setIsChordsModalOpen(false);
            setEditingSongId(null);
        } catch (e) { console.error(e); alert("Error saving chords"); }
    };

    const handleSmartImport = async () => {
        if (!importUrl) return;
        console.log("🚀 Iniciando importación inteligente para:", importUrl);
        setIsScraping(true);
        setChords(''); // Limpiar contenido anterior para dar feedback visual
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : 'https://mixernew-production.up.railway.app';

            const res = await fetch(`${devProxy}/scrape-chords?url=${encodeURIComponent(importUrl)}`);
            if (!res.ok) throw new Error("Error al obtener el contenido");
            const data = await res.json();
            if (data.content) {
                setChords(data.content);
                setImportUrl('');
            }
        } catch (e) {
            alert("No se pudo importar automáticamente. Prueba copiar y pegar manualmente.");
            console.error(e);
        } finally {
            setIsScraping(false);
        }
    };

    const handleDeleteSetlist = async (id) => {
        if (!window.confirm("¿Eliminar este setlist?")) return;
        try {
            await deleteDoc(doc(db, 'setlists', id));
        } catch (e) { console.error(e); }
    };

    const handleDeleteSong = async (id) => {
        if (!window.confirm("¿Eliminar esta canción permanentemente?")) return;
        try {
            await deleteDoc(doc(db, 'songs', id));
        } catch (e) { console.error(e); }
    };

    const handleOpenEditSetlist = (setlist) => {
        setEditingSetlistData(setlist);
        setIsEditSetlistModalOpen(true);
    };

    const handleAddSongToSetlist = async (song) => {
        if (!editingSetlistData) return;
        if ((editingSetlistData.songs || []).some(s => s.id === song.id)) return;
        const updatedSongs = [...(editingSetlistData.songs || []), { id: song.id, name: song.name, artist: song.artist }];
        try {
            await updateDoc(doc(db, 'setlists', editingSetlistData.id), { songs: updatedSongs });
            setEditingSetlistData({ ...editingSetlistData, songs: updatedSongs });
        } catch (e) { console.error(e); }
    };

    const handleRemoveSongFromSetlist = async (index) => {
        if (!editingSetlistData) return;
        const updatedSongs = [...(editingSetlistData.songs || [])];
        updatedSongs.splice(index, 1);
        try {
            await updateDoc(doc(db, 'setlists', editingSetlistData.id), { songs: updatedSongs });
            setEditingSetlistData({ ...editingSetlistData, songs: updatedSongs });
        } catch (e) { console.error(e); }
    };

    const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

    const initialOptions = {
        "client-id": "AbXQ6fanTIWx-dAoMagwbOTZ_M51YI4A-Dwzf2AY2CyIG7qNhV8QIiXuyBX-fina0FUxgTs8euJuAGc3",
        currency: "USD",
        intent: "subscription",
        vault: true,
    };

    return (
        <PayPalScriptProvider options={initialOptions}>
            <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', fontFamily: '"Inter", sans-serif' }}>
                {/* SIDEBAR */}
                <aside style={{ width: '280px', backgroundColor: '#020617', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', padding: '30px 20px', position: 'fixed', bottom: 0, top: 0 }}>
                    <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', cursor: 'pointer', paddingLeft: '10px' }}>
                        <img src="/zion-logo-white.png" alt="Zion Stage" style={{ height: '32px' }} />
                    </div>

                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        {[
                            { id: 'home', label: 'Inicio', icon: <Home size={20} /> },
                            { id: 'songs', label: 'Mis Canciones', icon: <Music2 size={20} /> },
                            { id: 'setlists', label: 'Setlists', icon: <ListMusic size={20} /> },
                            { id: 'global', label: 'Comunidad', icon: <Globe size={20} /> },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setStep('idle'); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px',
                                    background: activeTab === item.id ? 'rgba(0,210,211,0.1)' : 'transparent',
                                    border: 'none', color: activeTab === item.id ? '#00d2d3' : '#94a3b8',
                                    textAlign: 'left', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s'
                                }}
                            >
                                {item.icon} {item.label}
                            </button>
                        ))}
                        <button onClick={() => navigate('/store')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'transparent', border: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', marginTop: '10px' }}>
                            <ShoppingCart size={20} /> Marketplace
                        </button>
                        <button onClick={() => navigate('/multitrack')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: '#00d2d3', border: 'none', color: 'white', marginTop: '20px', cursor: 'pointer', fontWeight: '700' }}>
                            <Play size={20} fill="currentColor" /> Ir al Mixer
                        </button>
                    </nav>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                        <div onClick={() => { setIsInitialPlanSelection(false); setIsPricingModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', padding: '10px', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s' }} className="user-profile-btn">
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: userPlan?.isVIP ? 'linear-gradient(135deg,#f1c40f,#e67e22)' : 'linear-gradient(135deg,#00d2d3,#9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{displayName[0]?.toUpperCase()}</div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{displayName}</div>
                                <div style={{ fontSize: '0.75rem', color: userPlan?.isVIP ? '#f1c40f' : '#64748b', fontWeight: '800' }}>{userPlan?.type} {userPlan?.storageGB}GB</div>
                            </div>
                        </div>
                        <button onClick={() => { setIsInitialPlanSelection(false); setIsPricingModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#00d2d3', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '10px' }}>
                            Actualizar Plan
                        </button>
                        <button onClick={() => auth.signOut()} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', width: '100%', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <LogOut size={16} /> Cerrar sesión
                        </button>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main style={{ marginLeft: '280px', flex: 1, padding: '40px 60px', maxWidth: '1200px' }}>
                    {/* ── HEADER OVERVIEW ── */}
                    <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 8px' }}>
                                {activeTab === 'home' ? `¡Hola, ${displayName}!` :
                                    activeTab === 'songs' ? 'Mis Canciones' :
                                        activeTab === 'setlists' ? 'Setlists' : 'Explorar Comunidad'}
                            </h1>
                            <p style={{ color: '#64748b', margin: 0 }}>
                                {activeTab === 'home' ? 'Este es el resumen de tu biblioteca y actividad.' : ''}
                            </p>
                        </div>
                        {(activeTab === 'songs' || activeTab === 'home') && step === 'idle' && (
                            <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={20} /> Subir Canción
                            </button>
                        )}
                        {(activeTab === 'setlists') && (
                            <button onClick={() => setIsSetlistModalOpen(true)} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={20} /> Nuevo Setlist
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />
                    </header>

                    {/* ── WIZARD STEPS ── */}
                    {step !== 'idle' ? (
                        <section className="card-premium" style={{ maxWidth: '800px' }}>
                            {step === 'choose-use' && (
                                <div>
                                    <h3 style={{ marginBottom: '24px' }}>¿Cómo usarás esta canción?</h3>
                                    <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                                        {[{ id: 'personal', label: 'Uso personal', icon: <User size={24} /> }, { id: 'sell', label: 'Vender', icon: <Tag size={24} /> }].map(type => (
                                            <div key={type.id} onClick={() => setUseType(type.id)} style={{ flex: 1, padding: '30px', border: `2px solid ${useType === type.id ? '#00d2d3' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', textAlign: 'center', cursor: 'pointer', backgroundColor: useType === type.id ? 'rgba(0,210,211,0.05)' : 'transparent' }}>
                                                <div style={{ color: useType === type.id ? '#00d2d3' : '#64748b', marginBottom: '12px' }}>{type.icon}</div>
                                                <div style={{ fontWeight: '700' }}>{type.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <button onClick={resetWizard} className="btn-ghost">Cancelar</button>
                                        <button disabled={!useType} onClick={() => setStep('uploading-flow')} className="btn-teal" style={{ flex: 1 }}>Siguiente</button>
                                    </div>
                                </div>
                            )}
                            {step === 'uploading-flow' && (
                                <div>
                                    <h3 style={{ marginBottom: '24px' }}>Revisar Pistas</h3>
                                    <p style={{ color: '#64748b', marginBottom: '20px' }}>Puedes renombrar las pistas antes de subirlas para que se vean mejor en el mixer.</p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                                        {fileList.map((track, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ width: '40px', height: '40px', background: 'rgba(0,210,211,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3' }}>
                                                    <Music size={18} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Nombre de la Pista</div>
                                                    <input
                                                        className="btn-ghost"
                                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.1)' }}
                                                        value={track.displayName}
                                                        onChange={e => {
                                                            const newList = [...fileList];
                                                            newList[idx].displayName = e.target.value;
                                                            setFileList(newList);
                                                        }}
                                                    />
                                                </div>
                                                <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                                    .{track.extension}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <button onClick={() => setStep('details')} className="btn-ghost">Atrás</button>
                                        <button onClick={uploadToB2} className="btn-teal" style={{ flex: 1 }}><Upload size={18} /> Subir ahora</button>
                                    </div>
                                </div>
                            )}
                            {step === 'details' && (
                                <div>
                                    <h3 style={{ marginBottom: '24px' }}>Detalles de la Canción</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
                                        <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>NOMBRE</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box' }} value={songName} onChange={e => setSongName(e.target.value)} /></div>
                                        <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>ARTISTA</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box' }} value={artist} onChange={e => setArtist(e.target.value)} /></div>
                                        <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>KEY</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box' }} value={songKey} onChange={e => setSongKey(e.target.value)} /></div>
                                        <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>TEMPO (BPM)</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box' }} value={tempo} onChange={e => setTempo(e.target.value)} /></div>
                                        <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>COMPÁS</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box' }} value={timeSignature} onChange={e => setTimeSignature(e.target.value)} placeholder="Ej: 4/4" /></div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '24px' }}>
                                        <button onClick={() => setIsLyricsModalOpen(true)} className="btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: lyrics ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.1)', color: lyrics ? '#00d2d3' : 'white' }}>
                                            <ScrollText size={18} /> {lyrics ? 'Letra Agregada' : 'Subir Letra'}
                                        </button>
                                        <button onClick={() => setIsChordsModalOpen(true)} className="btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: chords ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.1)', color: chords ? '#00d2d3' : 'white' }}>
                                            <Music size={18} /> {chords ? 'Cifrado Agregado' : 'Subir Cifrado'}
                                        </button>
                                    </div>

                                    {useType === 'sell' && (
                                        <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(241, 196, 15, 0.1)', border: '1px solid rgba(241, 196, 15, 0.3)', borderRadius: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#f1c40f', fontSize: '0.95rem' }}>
                                                <input type="checkbox" checked={hasRights} onChange={e => setHasRights(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                                <strong>Confirmo que tengo los derechos para vender estas secuencias multitrack.</strong>
                                            </label>
                                            <p style={{ margin: '8px 0 0 28px', fontSize: '0.8rem', color: '#94a3b8' }}>Tu canción pasará a revisión por el administrador y estará disponible para la venta una vez aprobada.</p>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <button onClick={() => setStep('idle')} className="btn-ghost">Cancelar</button>
                                        <button disabled={useType === 'sell' && !hasRights} onClick={() => setStep('choose-use')} className="btn-teal" style={{ flex: 1, opacity: (useType === 'sell' && !hasRights) ? 0.5 : 1 }}>Siguiente</button>
                                    </div>
                                </div>
                            )}
                            {step === 'uploading' && (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Loader2 size={48} className="animate-spin" color="#00d2d3" style={{ margin: '0 auto 20px' }} />
                                    <h2 style={{ color: '#00d2d3', marginBottom: '10px' }}>Subiendo: {uploadProgress}%</h2>
                                    <p style={{ fontWeight: '800', color: 'white', fontSize: '1.2rem', marginBottom: '20px' }}>
                                        {currentUploadTrack}
                                    </p>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>IMPORTANTE: Si tu conexión es lenta, esto puede tardar varios minutos.</p>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>El servidor está procesando cada pista individualmente para Zion Mixer.</p>
                                </div>
                            )}
                            {step === 'done' && (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 20px' }} />
                                    <h2>Subida Completa</h2>
                                    {useType === 'sell' ? (
                                        <p style={{ color: '#f1c40f' }}>Tu canción está siendo verificada. Estará lista para la venta cuando sea aprobada por un administrador.</p>
                                    ) : (
                                        <p style={{ color: '#64748b' }}>Tu canción ya está disponible en tu biblioteca personal.</p>
                                    )}
                                </div>
                            )}
                        </section>
                    ) : (
                        <>
                            {/* ── STORAGE SUMMARY (Home Only) ── */}
                            {activeTab === 'home' && (
                                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                                    <div className="card-premium">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                            <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}><Cloud size={18} /> Almacenamiento</div>
                                            <div style={{ fontWeight: '700' }}>{usedPercent.toFixed(1)}%</div>
                                        </div>
                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                                            <div style={{ width: `${usedPercent}%`, height: '100%', background: '#00d2d3', borderRadius: '4px' }}></div>
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                            {usedMB.toFixed(0)} MB de {customStorageGB > 0 ? (customStorageGB + ' GB') : (storageLimit + ' MB')} usado
                                        </div>
                                    </div>
                                    <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '50px', height: '50px', background: 'rgba(0,210,211,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3' }}><Music2 size={24} /></div>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{userSongs.length}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Canciones subidas</div>
                                        </div>
                                    </div>
                                    <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '50px', height: '50px', background: 'rgba(155,89,182,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9b59b6' }}><ListMusic size={24} /></div>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{userSetlists.length}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Setlists creados</div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ── SONG LIST & UPLOAD ── */}
                            {(activeTab === 'home' || activeTab === 'songs') && (
                                <section>
                                    {activeTab === 'songs' && (
                                        <div
                                            onClick={() => fileInputRef.current.click()}
                                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                    handleZipUpload({ target: { files: e.dataTransfer.files } });
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '60px',
                                                border: '2px dashed rgba(0,210,211,0.3)',
                                                borderRadius: '24px',
                                                textAlign: 'center',
                                                background: 'rgba(0,210,211,0.02)',
                                                cursor: 'pointer',
                                                marginBottom: '50px',
                                                transition: 'all 0.3s'
                                            }}
                                            className="upload-dropzone"
                                        >
                                            <div style={{ color: '#00d2d3', marginBottom: '20px' }}><Upload size={56} /></div>
                                            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 10px' }}>Sube tu nueva canción</h2>
                                            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Arrastra tu archivo .ZIP aquí o <span style={{ color: '#00d2d3', fontWeight: '700' }}>haz clic para buscar</span></p>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>
                                            {activeTab === 'home' ? 'Agregadas Recientemente' : 'Biblioteca de Canciones'}
                                        </h3>

                                        {activeTab === 'songs' && (
                                            <div style={{ position: 'relative', width: '350px' }}>
                                                <input
                                                    type="text"
                                                    className="btn-ghost"
                                                    style={{ width: '100%', textAlign: 'left', padding: '12px 45px 12px 20px', fontSize: '0.95rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}
                                                    placeholder="Buscar por nombre o artista..."
                                                    value={songSearchQuery}
                                                    onChange={e => setSongSearchQuery(e.target.value)}
                                                />
                                                <Search size={20} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: '#020617', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {/* LIST HEADER */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1.5fr 1fr 1fr 180px', padding: '15px 30px', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            <span></span>
                                            <span>Canción</span>
                                            <span>Artista</span>
                                            <span>Key</span>
                                            <span>Tempo</span>
                                            <span style={{ textAlign: 'right' }}>Acciones</span>
                                        </div>

                                        {/* LIST BODY */}
                                        {userSongs.filter(s =>
                                            s.name.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                            (s.artist || '').toLowerCase().includes(songSearchQuery.toLowerCase())
                                        ).map((song, idx) => (
                                            <div
                                                key={song.id}
                                                onClick={() => { localStorage.setItem('mixer_pendingSongId', song.id); navigate('/multitrack'); }}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '60px 2fr 1.5fr 1fr 1fr 180px',
                                                    padding: '20px 30px',
                                                    borderBottom: idx === userSongs.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                className="song-list-item"
                                            >
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(0,210,211,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3' }}>
                                                    <Music2 size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>{song.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{song.tracks?.length || 0} pistas cargadas</div>
                                                </div>
                                                <div style={{ color: '#94a3b8' }}>{song.artist || '—'}</div>
                                                <div>
                                                    {song.key && <span style={{ color: '#00d2d3', fontWeight: '700', background: 'rgba(0,210,211,0.05)', padding: '4px 8px', borderRadius: '4px' }}>{song.key}</span>}
                                                </div>
                                                <div style={{ color: '#64748b' }}>{song.tempo ? `${song.tempo} BPM` : '—'}</div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); openLyricsHandler(song.id); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Agregar/Editar Letra">
                                                        <ScrollText size={18} />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); openChordsHandler(song.id); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Agregar/Editar Cifrado">
                                                        <Music size={18} />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><Settings2 size={18} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSong(song.id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        ))}

                                        {userSongs.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '100px 20px', color: '#64748b' }}>
                                                <div style={{ marginBottom: '15px' }}><Music2 size={48} opacity={0.2} /></div>
                                                <h4 style={{ margin: '0 0 5px', color: 'white' }}>No hay canciones en tu biblioteca</h4>
                                                <p>Sube tu primer archivo .ZIP para comenzar.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* ── SETLIST LIST ── */}
                            {activeTab === 'setlists' && (
                                <section>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                                        {userSetlists.map(sl => (
                                            <div key={sl.id} className="card-premium" style={{ position: 'relative' }}>
                                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'rgba(155,89,182,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9b59b6' }}>
                                                        <ListMusic size={24} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{sl.name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{(sl.songs || []).length} canciones</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button onClick={() => handleOpenEditSetlist(sl)} className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}>Editar</button>
                                                    <button onClick={() => handleDeleteSetlist(sl.id)} className="btn-ghost" style={{ padding: '8px', color: '#ef4444' }}><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {userSetlists.length === 0 && (
                                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#64748b' }}>
                                                <div style={{ marginBottom: '10px' }}><ListMusic size={40} /></div>
                                                No tienes setlists creados.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* ── FALLBACK FOR GLOBAL ── */}
                            {activeTab === 'global' && (
                                <section>
                                    {userPlan?.isVIP ? (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>Explorar Comunidad (Acceso VIP)</h3>
                                                <div style={{ position: 'relative', width: '350px' }}>
                                                    <input
                                                        type="text"
                                                        className="btn-ghost"
                                                        style={{ width: '100%', textAlign: 'left', padding: '12px 45px 12px 20px', fontSize: '0.95rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}
                                                        placeholder="Buscar en toda la base de datos..."
                                                        value={songSearchQuery}
                                                        onChange={e => setSongSearchQuery(e.target.value)}
                                                    />
                                                    <Search size={20} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                                </div>
                                            </div>
                                            <div style={{ background: '#020617', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1.5fr 1fr 1fr 180px', padding: '15px 30px', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                    <span></span>
                                                    <span>Canción</span>
                                                    <span>Artista</span>
                                                    <span>Key</span>
                                                    <span>Tempo</span>
                                                    <span style={{ textAlign: 'right' }}>Acciones</span>
                                                </div>
                                                {userSongs.filter(s =>
                                                    s.name.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                                    (s.artist || '').toLowerCase().includes(songSearchQuery.toLowerCase())
                                                ).map((song, idx) => (
                                                    <div key={song.id} onClick={() => { localStorage.setItem('mixer_pendingSongId', song.id); navigate('/multitrack'); }} style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1.5fr 1fr 1fr 180px', padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center', cursor: 'pointer' }} className="song-list-item">
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(241,196,15,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1c40f' }}><Music2 size={20} /></div>
                                                        <div><div style={{ fontWeight: '700' }}>{song.name}</div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>Subido por {song.userId === currentUser?.uid ? 'TI' : 'Comunidad'}</div></div>
                                                        <div style={{ color: '#94a3b8' }}>{song.artist || '—'}</div>
                                                        <div>{song.key && <span style={{ color: '#f1c40f', fontWeight: '700', background: 'rgba(241,196,15,0.05)', padding: '4px 8px', borderRadius: '4px' }}>{song.key}</span>}</div>
                                                        <div style={{ color: '#64748b' }}>{song.tempo ? `${song.tempo} BPM` : '—'}</div>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                                                            <button onClick={(e) => { e.stopPropagation(); openLyricsHandler(song.id); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }} title="Letras"><ScrollText size={18} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); openChordsHandler(song.id); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }} title="Cifrados"><Music size={18} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><Settings2 size={18} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '120px 50px', background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ width: '100px', height: '100px', background: 'rgba(241,196,15,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1c40f', margin: '0 auto 30px' }}><KeyRound size={50} /></div>
                                            <h2 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '20px' }}>Acceso Exclusivo VIP</h2>
                                            <p style={{ color: '#64748b', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.6' }}>
                                                Los miembros Premium VIP pueden acceder y utilizar todas las canciones de nuestra base de datos global.
                                            </p>
                                            <button onClick={() => setIsPricingModalOpen(true)} className="btn-teal" style={{ padding: '16px 40px', fontSize: '1.1rem', background: '#f1c40f', color: '#000', fontWeight: '800' }}>Descubrir Planes VIP</button>
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                </main>

                {/* PRETTY SETLIST MODAL */}
                {isSetlistModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '450px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Crear Nuevo Setlist</h3>
                                <button onClick={() => setIsSetlistModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={24} /></button>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: '600' }}>NOMBRE DEL SETLIST</label>
                                <input
                                    className="btn-ghost"
                                    style={{ width: '100%', textAlign: 'left', padding: '14px', fontSize: '1rem', backgroundColor: 'rgba(0,0,0,0.2)' }}
                                    placeholder="Ej. Servicio Domingo 15"
                                    value={newSetlistName}
                                    onChange={e => setNewSetlistName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setIsSetlistModalOpen(false)} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                <button onClick={handleCreateSetlist} className="btn-teal" style={{ flex: 1 }} disabled={!newSetlistName.trim()}>Guardar Setlist</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* EDIT SETLIST MODAL */}
                {isEditSetlistModalOpen && editingSetlistData && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '900px', height: '80vh', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                <div>
                                    <h2 style={{ margin: '0 0 5px' }}>{editingSetlistData.name}</h2>
                                    <p style={{ margin: 0, color: '#64748b' }}>Editando canciones del setlist</p>
                                </div>
                                <button onClick={() => setIsEditSetlistModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={30} /></button>
                            </div>

                            <div style={{ display: 'flex', gap: '30px', flex: 1, overflow: 'hidden' }}>
                                {/* CURRENT SONGS */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ marginBottom: '15px', color: '#00d2d3' }}>Canciones en el Setlist ({(editingSetlistData.songs || []).length})</h4>
                                    <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {(editingSetlistData.songs || []).map((s, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: '#1e293b', borderRadius: '8px', marginBottom: '10px' }}>
                                                <div style={{ width: '30px', height: '30px', background: 'rgba(0,210,211,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3', fontSize: '0.8rem', fontWeight: '800' }}>{idx + 1}</div>
                                                <div style={{ marginLeft: '12px', flex: 1 }}>
                                                    <div style={{ fontWeight: '700' }}>{s.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.artist}</div>
                                                </div>
                                                <button onClick={() => handleRemoveSongFromSetlist(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                            </div>
                                        ))}
                                        {(editingSetlistData.songs || []).length === 0 && <p style={{ textAlign: 'center', color: '#475569', marginTop: '40px' }}>No hay canciones aún.</p>}
                                    </div>
                                </div>

                                {/* ADD SONGS LIBRARY */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ marginBottom: '15px' }}>Agregar desde Biblioteca</h4>
                                    <div style={{ marginBottom: '15px', position: 'relative' }}>
                                        <input
                                            type="text"
                                            className="btn-ghost"
                                            style={{ width: '100%', textAlign: 'left', padding: '10px 40px 10px 15px', fontSize: '0.9rem' }}
                                            placeholder="Buscar en mis canciones..."
                                            value={songSearchQuery}
                                            onChange={e => setSongSearchQuery(e.target.value)}
                                        />
                                        <Search size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {userSongs.filter(s =>
                                            s.name.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                            (s.artist || '').toLowerCase().includes(songSearchQuery.toLowerCase())
                                        ).map(song => {
                                            const isInSetlist = (editingSetlistData.songs || []).some(s => s.id === song.id);
                                            return (
                                                <div key={song.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: isInSetlist ? 0.5 : 1 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{song.name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{song.artist}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddSongToSetlist(song)}
                                                        disabled={isInSetlist}
                                                        style={{ background: isInSetlist ? 'transparent' : '#00d2d3', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isInSetlist ? 'default' : 'pointer' }}
                                                    >
                                                        {isInSetlist ? <CheckCircle2 size={16} color="#00d2d3" /> : <Plus size={18} />}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* PRICING & PLANS MODAL */}
                {isPricingModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '1000px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                <div>
                                    <h2 style={{ margin: '0 0 5px', fontSize: '2rem' }}>Mejora tu Experiencia</h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '1.1rem' }}>Elige el plan que mejor se adapte a tu ministerio</p>
                                </div>
                                {!isInitialPlanSelection && (
                                    <button onClick={() => setIsPricingModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={32} /></button>
                                )}
                            </div>

                            {pendingPaymentPlan ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Estás adquiriendo: <span style={{ color: pendingPaymentPlan.isVIP ? '#f1c40f' : '#00d2d3' }}>Plan {pendingPaymentPlan.name} ({isAnnual ? 'Anual' : 'Mensual'})</span></h3>
                                    <p style={{ fontSize: '1.2rem', marginBottom: '30px', fontWeight: '800' }}>Total a pagar: ${isAnnual ? pendingPaymentPlan.annualPrice : pendingPaymentPlan.price} USD /{isAnnual ? 'año' : 'mes'}</p>

                                    <div style={{ maxWidth: '400px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '12px' }}>
                                        <PayPalButtons
                                            key={`paypal-btn-${isAnnual ? 'annual' : 'monthly'}-${pendingPaymentPlan.id}`}
                                            style={{ layout: "vertical", shape: "pill" }}
                                            createSubscription={(data, actions) => {
                                                return actions.subscription.create({
                                                    plan_id: isAnnual ? pendingPaymentPlan.paypalAnnualPlanId : pendingPaymentPlan.paypalPlanId
                                                });
                                            }}
                                            onApprove={(data, actions) => {
                                                console.log("Suscripción exitosa:", data);
                                                updateDoc(doc(db, 'users', currentUser.uid), {
                                                    planId: pendingPaymentPlan.id,
                                                    paypalSubscriptionId: data.subscriptionID
                                                });
                                                localStorage.setItem(`mixer_seen_pricing_${currentUser.uid}`, 'true');
                                                setIsInitialPlanSelection(false);
                                                setPendingPaymentPlan(null);
                                                setIsPricingModalOpen(false);
                                                alert(`¡Suscripción mensual activada exitosamente! Bienvenido al Plan ${pendingPaymentPlan.name}.`);
                                            }}
                                            onError={(err) => {
                                                console.error("Error PayPal:", err);
                                                alert("Ocurrió un error al procesar el pago. Por favor intenta de nuevo.");
                                            }}
                                        />
                                    </div>

                                    <button onClick={() => setPendingPaymentPlan(null)} className="btn-ghost" style={{ marginTop: '25px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <ArrowLeft size={18} /> Volver a los planes
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '30px', display: 'flex', gap: '5px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <button onClick={() => setIsAnnual(false)} style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: !isAnnual ? '#00d2d3' : 'transparent', color: !isAnnual ? '#000' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>Mensual</button>
                                            <button onClick={() => setIsAnnual(true)} style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: isAnnual ? '#00d2d3' : 'transparent', color: isAnnual ? '#000' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>Anual (-30%)</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                                        {/* BASIC & STANDARD PLANS */}
                                        <div>
                                            <h3 style={{ marginBottom: '20px', color: '#00d2d3', display: 'flex', alignItems: 'center', gap: '10px' }}><Globe size={20} /> Planes Estándar</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                {STORAGE_PLANS.filter(p => !p.isVIP).map(p => (
                                                    <div key={p.id} style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: `1px solid ${userPlan?.id === p.id ? '#00d2d3' : 'rgba(255,255,255,0.05)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{p.id === 'free' ? 'Plan Gratis' : `Plan ${p.name}`}</div>
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.id === 'free' ? '300 MB de almacenamiento' : `${p.storageGB} GB Storage`}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                                                {isAnnual && p.id !== 'free' && (
                                                                    <span style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'line-through', marginBottom: '-2px' }}>
                                                                        ${p.originalAnnualPrice}
                                                                    </span>
                                                                )}
                                                                <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                                                                    ${p.id === 'free' ? 0 : (isAnnual ? p.annualPrice : p.price)}
                                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/{p.id === 'free' ? 'mes' : isAnnual ? 'año' : 'mes'}</span>
                                                                </div>
                                                            </div>
                                                            {userPlan?.id === p.id && !isInitialPlanSelection ?
                                                                <span style={{ color: '#00d2d3', fontSize: '0.7rem', fontWeight: 'bold' }}>PLAN ACTUAL</span> :
                                                                p.id === 'free' ?
                                                                    <button onClick={() => { updateDoc(doc(db, 'users', currentUser.uid), { planId: p.id }); localStorage.setItem(`mixer_seen_pricing_${currentUser.uid}`, 'true'); setIsInitialPlanSelection(false); setIsPricingModalOpen(false); }} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Elegir Gratis</button> :
                                                                    <button onClick={() => { setPendingPaymentPlan(p); }} className="btn-teal" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Elegir</button>
                                                            }
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* VIP PLANS */}
                                        <div>
                                            <h3 style={{ marginBottom: '20px', color: '#f1c40f', display: 'flex', alignItems: 'center', gap: '10px' }}><CreditCard size={20} /> Planes Premium VIP</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                {STORAGE_PLANS.filter(p => p.isVIP).map(p => (
                                                    <div key={p.id} style={{ padding: '20px', background: 'rgba(241,196,15,0.03)', borderRadius: '12px', border: `1px solid ${userPlan?.id === p.id ? '#f1c40f' : 'rgba(255,255,255,0.05)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#f1c40f' }}>Plan {p.name}</div>
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.storageGB} GB + Acceso Total</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                                                {isAnnual && p.id !== 'free' && (
                                                                    <span style={{ fontSize: '0.8rem', color: 'rgba(241,196,15,0.5)', textDecoration: 'line-through', marginBottom: '-2px' }}>
                                                                        ${p.originalAnnualPrice}
                                                                    </span>
                                                                )}
                                                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f1c40f' }}>
                                                                    ${isAnnual ? p.annualPrice : p.price}
                                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/{isAnnual ? 'año' : 'mes'}</span>
                                                                </div>
                                                            </div>
                                                            {userPlan?.id === p.id && !isInitialPlanSelection ? <span style={{ color: '#f1c40f', fontSize: '0.7rem', fontWeight: 'bold' }}>PLAN ACTUAL</span> : <button onClick={() => { setPendingPaymentPlan(p); }} style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#f1c40f', border: 'none', color: '#000', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Elegir VIP</button>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MODAL PARA EDITAR LETRAS (UPLOAD) */}
                {isLyricsModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '700px', borderRadius: '24px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <button onClick={() => setIsLyricsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={24} /></button>
                            <h2 style={{ marginBottom: '10px' }}>Agregar Letra</h2>
                            <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '0.9rem' }}>Pega o escribe la letra de la canción aquí.</p>
                            <textarea
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                placeholder="Escribe la letra aquí..."
                                style={{ width: '100%', height: '350px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', padding: '20px', fontSize: '1rem', fontFamily: 'monospace', resize: 'none', marginBottom: '20px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                                <button onClick={() => { setIsLyricsModalOpen(false); setEditingSongId(null); }} className="btn-ghost">Cancelar</button>
                                <button onClick={saveLyricsHandler} className="btn-teal">Guardar Letra</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL PARA EDITAR CIFRADOS (UPLOAD) */}
                {isChordsModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '700px', borderRadius: '24px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <button onClick={() => setIsChordsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={24} /></button>
                            <h2 style={{ marginBottom: '10px' }}>Agregar Cifrado</h2>
                            <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '0.9rem' }}>Pega el cifrado o usa la importación inteligente.</p>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <input
                                    value={importUrl}
                                    onChange={e => setImportUrl(e.target.value)}
                                    placeholder="URL de LaCuerda.net u otros..."
                                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', padding: '12px' }}
                                />
                                <button
                                    onClick={handleSmartImport}
                                    disabled={isScraping || !importUrl}
                                    style={{ background: '#00d2d3', color: 'black', border: 'none', padding: '0 20px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', opacity: (isScraping || !importUrl) ? 0.5 : 1 }}
                                >
                                    {isScraping ? 'Importando...' : 'Importar URL'}
                                </button>
                            </div>

                            <textarea
                                value={chords}
                                onChange={(e) => setChords(e.target.value)}
                                placeholder="Escribe o pega los acordes aquí..."
                                style={{ width: '100%', height: '300px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', padding: '20px', fontSize: '1rem', fontFamily: 'monospace', resize: 'none', marginBottom: '20px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                                <button onClick={() => { setIsChordsModalOpen(false); setEditingSongId(null); }} className="btn-ghost">Cancelar</button>
                                <button onClick={saveChordsHandler} className="btn-teal">Guardar Cifrado</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PayPalScriptProvider>
    );
}

