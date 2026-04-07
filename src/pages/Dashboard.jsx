import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import {
    Upload, Music2, Music, User, Tag, Play, ShoppingCart,
    ChevronRight, ArrowLeft, Layers, Cloud,
    Loader2, Timer, KeyRound, ScrollText, X, Settings2, Trash2, ListMusic, Plus, Search,
    Home, Globe, CreditCard, HelpCircle, LogOut, TrendingUp,
    Star, CheckCircle2 as CheckIcon, FileText
} from 'lucide-react';

const stripePromise = loadStripe('pk_live_51S37NBId1DsVBhR7DBfuwJHCjLo2KzUWPxEKew3JdyI5ypBwgt420B9pXM6qQuHRscOLyNeLjxumZHwVfWdZsMQp003Gc0ne2Y');

const StripeCheckoutForm = ({ planName, onPaymentSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);
        const result = await stripe.confirmPayment({
            elements,
            redirect: 'if_required'
        });

        if (result.error) {
            alert("Error en el pago: " + result.error.message);
            setIsProcessing(false);
        } else {
            onPaymentSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ margin: '0 auto', maxWidth: '400px', textAlign: 'left', background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
            <h4 style={{ color: '#0f172a', marginBottom: '15px', fontWeight: '800', textAlign: 'center', fontSize: '1rem' }}>Pagar Plan {planName}</h4>
            <PaymentElement options={{ layout: 'accordion' }} />
            <button disabled={!stripe || isProcessing} className="btn-teal" style={{ width: '100%', padding: '12px', marginTop: '15px', fontSize: '1rem', fontWeight: 'bold' }}>
                {isProcessing ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : 'Confirmar y Pagar'}
            </button>
        </form>
    );
};

const STORAGE_PLANS = [
    { id: 'free', name: 'Gratis', type: 'Gratis', storageGB: 1, storageMB: 1000, price: 0, annualPrice: 0, originalAnnualPrice: 0, isVIP: false },
    { id: 'std1', name: 'Básico', type: 'Estándar', storageGB: 2, storageMB: 2000, price: 4.99, annualPrice: 41.92, originalAnnualPrice: 59.88, isVIP: false },
    { id: 'std2', name: 'Estándar', type: 'Estándar', storageGB: 5, storageMB: 5000, price: 6.99, annualPrice: 58.72, originalAnnualPrice: 83.88, isVIP: false },
    { id: 'std3', name: 'Plus', type: 'Estándar', storageGB: 10, storageMB: 10000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: false },
    { id: 'vip1', name: 'Básico VIP', type: 'VIP', storageGB: 2, storageMB: 2000, price: 7.99, annualPrice: 67.12, originalAnnualPrice: 95.88, isVIP: true },
    { id: 'vip2', name: 'Estándar VIP', type: 'VIP', storageGB: 5, storageMB: 5000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: true },
    { id: 'vip3', name: 'Plus VIP', type: 'VIP', storageGB: 10, storageMB: 10000, price: 12.99, annualPrice: 109.12, originalAnnualPrice: 155.88, isVIP: true },
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

// Detecta si corre dentro de Capacitor (Android/iOS) o en el navegador web
const isNativeApp = () => {
    return typeof window !== 'undefined' &&
        window.Capacitor?.isNativePlatform?.() === true
}

function Dashboard() {
    const navigate = useNavigate();
    const fileInputRef = useRef();

    const [activeTab, setActiveTab] = useState('home');
    const [step, setStep] = useState('idle');
    const [, setUserProfile] = useState(null);
    const [useType, setUseType] = useState(null);
    const [hasRights, setHasRights] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [, setIsUploading] = useState(false);
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
    const [isProcessingZip, setIsProcessingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);

    const [currentUser, setCurrentUser] = useState(null);
    const [userSongs, setUserSongs] = useState([]);
    const [userSetlists, setUserSetlists] = useState([]);


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

    // Stripe States for Upgrades
    const [stripeClientSecret, setStripeClientSecret] = useState('');
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState('');
    const [, setIsProcessingStripe] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successPlanName, setSuccessPlanName] = useState('');
    const [uploadError, setUploadError] = useState(null);
    const [showErrorModal, setShowErrorModal] = useState(false);

    // Partituras states
    const [isPartituraMOdalOpen, setIsPartituraModalOpen] = useState(false);
    const [partituraSongId, setPartituraSongId] = useState(null);
    const [partituraInstrument, setPartituraInstrument] = useState('');
    const [partituraFile, setPartituraFile] = useState(null);
    const [partituraUploading, setPartituraUploading] = useState(false);
    const [existingPartituras, setExistingPartituras] = useState([]);
    const partituraFileRef = useRef();

    const INSTRUMENTS = [
        'Guitarra', 'Piano', 'Bajo', 'Batería', 'Violín', 'Acordeón',
        'Trompeta', 'Saxofón', 'Flauta', 'Teclado', 'Ukulele', 'Mandolina',
        'Cello', 'Contrabajo', 'Clarinete', 'Oboe', 'Coro', 'Voz'
    ];

    const openPartituraModal = async (songId) => {
        setPartituraSongId(songId);
        setPartituraInstrument('');
        setPartituraFile(null);
        // Load existing partituras for this song
        try {
            const q = query(collection(db, 'partituras'), where('songId', '==', songId));
            const snap = await getDocs(q);
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a, b) => (a.instrument || '').localeCompare(b.instrument || ''));
            setExistingPartituras(list);
        } catch (e) { console.error(e); }
        setIsPartituraModalOpen(true);
    };

    const handlePartituraUpload = async () => {
        if (!partituraFile || !partituraInstrument || !partituraSongId || !currentUser) return;
        setPartituraUploading(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';
            const formData = new FormData();
            formData.append('audioFile', partituraFile);
            formData.append('fileName', `partitura_${currentUser.uid}_${Date.now()}_${partituraInstrument.replace(/\s+/g,'_')}.pdf`);
            const res = await fetch(`${devProxy}/api/upload`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Error subiendo PDF');
            const data = await res.json();
            const pdfUrl = data.url || '';

            // Check if already exists for this instrument
            const q = query(collection(db, 'partituras'), where('songId', '==', partituraSongId), where('instrument', '==', partituraInstrument));
            const snap = await getDocs(q);
            if (!snap.empty) {
                await updateDoc(doc(db, 'partituras', snap.docs[0].id), { pdfUrl, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(db, 'partituras'), {
                    songId: partituraSongId,
                    userId: currentUser.uid,
                    instrument: partituraInstrument,
                    pdfUrl,
                    createdAt: serverTimestamp()
                });
            }
            // Refresh list
            const snap2 = await getDocs(query(collection(db, 'partituras'), where('songId', '==', partituraSongId)));
            const list = [];
            snap2.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a, b) => (a.instrument || '').localeCompare(b.instrument || ''));
            setExistingPartituras(list);
            setPartituraFile(null);
            setPartituraInstrument('');
            alert(`✅ Partitura de ${partituraInstrument} guardada correctamente.`);
        } catch (e) {
            console.error(e);
            alert('Error al subir la partitura: ' + e.message);
        } finally {
            setPartituraUploading(false);
        }
    };

    const handleDeletePartitura = async (partId) => {
        if (!window.confirm('¿Eliminar esta partitura?')) return;
        try {
            await deleteDoc(doc(db, 'partituras', partId));
            setExistingPartituras(prev => prev.filter(p => p.id !== partId));
        } catch (e) { console.error(e); }
    };

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
                        setUserProfile(data);
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
                            customStorageGB: 1,
                            email: user.email || '',
                            displayName: user.displayName || '',
                            createdAt: serverTimestamp()
                        }, { merge: true })
                            .then(() => {
                                setUserPlan(STORAGE_PLANS[0]);
                                setCustomStorageGB(1);
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
                        if (userPlan?.isVIP || s.userId === user.uid || s.isGlobal) {
                            songs.push(s);
                        }
                    });
                    songs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setUserSongs(songs);
                    setUserSongs(songs);
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
        setIsProcessingZip(true);
        setZipProgress(0);
        const zip = new JSZip();
        try {
            // Reset states from previous upload to avoid leakage
            setSongName(''); setArtist(''); setSongKey(''); setTempo('');
            setTimeSignature('4/4'); setLyrics(''); setChords(''); setFileList([]);

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
            const filesToExtract = Object.keys(contents.files).filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));

            for (let i = 0; i < filesToExtract.length; i++) {
                const filename = filesToExtract[i];
                const fileData = await contents.files[filename].async('blob');
                let rawName = filename.split('/').pop().replace(/\.(wav|mp3)$/i, '');

                // REGLA: Renombrar ClickTrack a Click
                let finalDisplayName = rawName.replace(/[^a-zA-Z0-9_-]/g, '');
                if (finalDisplayName.toLowerCase().includes('clicktrack')) {
                    finalDisplayName = 'Click';
                }

                if (!finalDisplayName) finalDisplayName = `Track_${extractedFiles.length + 1}`;

                extractedFiles.push({
                    originalName: filename,
                    displayName: finalDisplayName,
                    blob: fileData,
                    extension: filename.split('.').pop()
                });
                setZipProgress(Math.round(((i + 1) / filesToExtract.length) * 100));
            }
            setFileList(extractedFiles);
            setStep('details');
        } catch (err) { alert('Error: ' + err.message); }
        finally { setIsProcessingZip(false); }
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

        const uploadFile = (blob, fileName, displayName, originalName, onProgress, generatePreview = false) => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();
                formData.append('audioFile', blob);
                formData.append('fileName', fileName);
                if (generatePreview) formData.append('generatePreview', 'true');

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        onProgress(e.loaded, e.total);
                    }
                });

                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch { reject(new Error("Error parsing server response")); }
                        } else {
                            let errorText = xhr.responseText || 'Fallo en subida';
                            try {
                                const parsed = JSON.parse(errorText);
                                if (parsed.error) errorText = parsed.error;
                            } catch { /* ignore */ }
                            reject(new Error(`Error ${xhr.status}: ${errorText}`));
                        }
                    }
                };

                xhr.onerror = () => reject(new Error("Error de red o conexión perdida"));
                xhr.open('POST', `${devProxy}/api/upload`, true);
                xhr.send(formData);
            });
        };

        try {
            const totalSize = fileList.reduce((acc, f) => acc + f.blob.size, 0);

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

                const safeName = songName.trim().replace(/,/g, '').replace(/\s+/g, '_');
                const safeTrackName = (track.displayName || 'track').trim().replace(/,/g, '').replace(/\s+/g, '_');
                const b2Filename = `audio_${currentUser.uid}_${Date.now()}_${safeName}_${safeTrackName}.mp3`;

                const data = await uploadFile(
                    track.blob,
                    b2Filename,
                    track.displayName,
                    track.originalName,
                    (loaded) => {
                        trackProgress[i] = loaded;
                        updateOverallProgress();
                    },
                    true // IMPORTANTE: Solicitar a FFmpeg que corte la muestra de 20s
                );

                uploadedTracksInfo.push({
                    name: track.displayName || 'Pista',
                    originalName: track.originalName || 'file',
                    url: data.url || '',
                    previewUrl: data.previewUrl || data.url, // Guardamos el link al clip de 20s
                    b2FileId: data.fileId || '',
                    sizeMB: (track.blob.size / 1024 / 1024).toFixed(2)
                });
            }

            // Generar preview Mix
            setCurrentUploadTrack('Generando Mix de Previsualización...');
            setUploadProgress(96);
            const mixBlob = await generateMixBlob(fileList);
            if (mixBlob) {
                const safeSongName = songName.trim().replace(/,/g, '').replace(/\s+/g, '_');
                const b2Filename = `audio_${currentUser.uid}_${Date.now()}_${safeSongName}__PreviewMix.mp3`;
                const data = await uploadFile(mixBlob, b2Filename, '__PreviewMix', 'preview.mp3', () => { }, true);
                uploadedTracksInfo.push({
                    name: '__PreviewMix',
                    url: data?.url || '',
                    previewUrl: data?.previewUrl || data?.url || '',
                    b2FileId: data?.fileId || '',
                    isWaveformSource: true,
                    sizeMB: (mixBlob.size / 1024 / 1024).toFixed(2)
                });
            }
            setCurrentUploadTrack('Finalizando...');
            setUploadProgress(98);

            const songDoc = await addDoc(collection(db, 'songs'), {
                name: (songName || 'Sin título').trim(),
                artist: (artist || 'Desconocido').trim(),
                key: (songKey || '').trim(),
                tempo: (tempo || '').trim(),
                timeSignature: (timeSignature || '4/4').trim(),
                useType: useType || 'personal',
                status: useType === 'sell' ? 'pending' : 'active',
                userId: currentUser?.uid || 'unknown',
                userEmail: currentUser?.email || '',
                tracks: uploadedTracksInfo.map(t => ({
                    ...t,
                    url: t.url || '',
                    b2FileId: t.b2FileId || ''
                })),
                createdAt: serverTimestamp(),
                isGlobal: false
            });

            if (lyrics && lyrics.trim()) await addDoc(collection(db, 'lyrics'), { songId: songDoc.id, text: lyrics, updatedAt: serverTimestamp() });
            if (chords && chords.trim()) await addDoc(collection(db, 'chords'), { songId: songDoc.id, text: chords, updatedAt: serverTimestamp() });

            setStep('done');
            setTimeout(() => { resetWizard(); setActiveTab('home'); }, 2000);
        } catch (e) {
            console.error("Error completo de subida:", e);
            
            let userMsg = e.message || "Revisa tu conexión";
            if (userMsg.includes("0x2C") || userMsg.includes("Bad character")) {
                userMsg = "El nombre de la canción o de una pista tiene un carácter no permitido (como una coma). Por favor, intenta subirla de nuevo asegurándote de no usar comas ni símbolos especiales en los nombres.";
            } else if (userMsg.includes("500")) {
                userMsg = "Error en el servidor. Puede ser que el archivo de audio esté dañado o no sea compatible. Asegúrate de subir archivos .mp3 o .wav válidos.";
            } else if (userMsg.includes("404")) {
                userMsg = "No se encontró el servidor. Por favor, verifica que el proxy esté corriendo correctamente.";
            }

            setUploadError(userMsg);
            setShowErrorModal(true);
            setStep('details');
        } finally {
            setIsUploading(false);
        }
    };

    const resetWizard = () => {
        setStep('idle'); setFileList([]); setSongName(''); setArtist(''); setSongKey(''); setTempo(''); setTimeSignature('4/4'); setLyrics(''); setChords(''); setUseType(null); setHasRights(false);
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

            const res = await fetch(`${devProxy}/api/scrape-chords?url=${encodeURIComponent(importUrl)}`);
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

    const handlePrepareStripePayment = async (plan) => {
        setPendingPaymentPlan(plan);
        setIsProcessingStripe(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            const res = await fetch(`${devProxy}/api/stripe/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email,
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    userId: currentUser.uid,
                    planId: plan.id,
                    isAnnual: isAnnual
                })
            });
            const data = await res.json();
            if (data.clientSecret) {
                setStripeClientSecret(data.clientSecret);
                setStripeSubscriptionId(data.subscriptionId);
            } else {
                throw new Error(data.error || "Error al iniciar pago");
            }
        } catch (error) {
            alert(error.message);
            setPendingPaymentPlan(null);
        } finally {
            setIsProcessingStripe(false);
        }
    };

    const handleConfirmStripeUpgrade = async () => {
        if (!currentUser || !pendingPaymentPlan) return;
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                planId: pendingPaymentPlan.id,
                stripeSubscriptionId: stripeSubscriptionId,
                updatedAt: serverTimestamp()
            });

            localStorage.setItem(`mixer_seen_pricing_${currentUser.uid}`, 'true');
            setSuccessPlanName(pendingPaymentPlan.name);
            setIsSuccessModalOpen(true);

            setIsInitialPlanSelection(false);
            setPendingPaymentPlan(null);
            setStripeClientSecret('');
            setIsPricingModalOpen(false);
        } catch (error) {
            console.error("Error updating plan:", error);
            alert("Error al actualizar plan en base de datos.");
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


    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', fontFamily: '"Inter", sans-serif' }}>
            {/* SIDEBAR */}
            <aside style={{ width: '280px', backgroundColor: '#020617', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', padding: '30px 20px', position: 'fixed', bottom: 0, top: 0 }}>
                <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', cursor: 'pointer', paddingLeft: '10px' }}>
                    <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '32px' }} />
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {[
                        { id: 'home', label: 'Inicio', icon: <Home size={20} /> },
                        { id: 'songs', label: 'Mis Canciones', icon: <Music2 size={20} /> },
                        { id: 'setlists', label: 'Setlists', icon: <ListMusic size={20} /> },
                        { id: 'global', label: 'Comunidad', icon: <Globe size={20} /> },
                        { id: 'vendedores', label: 'Ventas (Hotmart)', icon: <TrendingUp size={20} /> },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === 'vendedores') {
                                    navigate('/vendedores');
                                } else {
                                    setActiveTab(item.id);
                                    setStep('idle');
                                }
                            }}
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
                    {!isNativeApp() && (activeTab === 'songs' || activeTab === 'home') && step === 'idle' && (
                        <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={isProcessingZip}>
                            {isProcessingZip ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            {isProcessingZip ? `Procesando ZIP (${zipProgress}%)...` : 'Subir Canción'}
                        </button>
                    )}
                    {(activeTab === 'setlists') && (
                        <button onClick={() => setIsSetlistModalOpen(true)} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={20} /> Nuevo Setlist
                        </button>
                    )}
                    {!isNativeApp() && <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />}
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
                                    <button
                                        disabled={!useType}
                                        onClick={() => {
                                            if (useType === 'sell') {
                                                navigate('/vendedores');
                                            } else {
                                                setStep('uploading-flow');
                                            }
                                        }}
                                        className="btn-teal"
                                        style={{ flex: 1 }}
                                    >
                                        Siguiente
                                    </button>
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
                                                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #cbd5e1', background: 'white', color: 'black' }}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h3 style={{ margin: 0 }}>Detalles de la Canción</h3>
                                    <button 
                                        onClick={() => alert("Formato recomendado para autocompletar:\nNOMBRE - ARTISTA - NOTA - TEMPO\nEj: Celebra victorioso - Juan Carlos Alvarado - Am - 98BPM")} 
                                        style={{ background: 'rgba(0,210,211,0.1)', border: '1px solid #00d2d3', color: '#00d2d3', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,210,211,0.2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,210,211,0.1)'}
                                    >
                                        Guía
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
                                    <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>NOMBRE</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box', background: 'white', color: 'black', border: '1px solid #cbd5e1' }} value={songName} onChange={e => setSongName(e.target.value)} /></div>
                                    <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>ARTISTA</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box', background: 'white', color: 'black', border: '1px solid #cbd5e1' }} value={artist} onChange={e => setArtist(e.target.value)} /></div>
                                    <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>KEY</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box', background: 'white', color: 'black', border: '1px solid #cbd5e1' }} value={songKey} onChange={e => setSongKey(e.target.value)} /></div>
                                    <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}><label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>TEMPO (BPM)</label><input className="btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box', background: 'white', color: 'black', border: '1px solid #cbd5e1' }} value={tempo} onChange={e => setTempo(e.target.value)} /></div>
                                    <div style={{ flex: '1 1 calc(50% - 20px)', minWidth: '200px' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>COMPÁS</label>
                                        <select
                                            className="btn-ghost"
                                            style={{ width: '100%', textAlign: 'left', padding: '12px', boxSizing: 'border-box', appearance: 'none', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}
                                            value={timeSignature}
                                            onChange={e => setTimeSignature(e.target.value)}
                                        >
                                            <option value="4/4">4/4</option>
                                            <option value="3/4">3/4</option>
                                            <option value="6/8">6/8</option>
                                            <option value="2/4">2/4</option>
                                            <option value="4/2">4/2</option>
                                            <option value="5/4">5/4</option>
                                            <option value="12/8">12/8</option>
                                        </select>
                                    </div>
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
                                <CheckIcon size={64} color="#10b981" style={{ margin: '0 auto 20px' }} />
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
                                {!isNativeApp() && activeTab === 'songs' && (
                                    <>
                                    {/* FORMAT NOTE BANNER */}
                                    <div style={{
                                        marginBottom: '24px',
                                        padding: '16px 22px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, rgba(0,210,211,0.06), rgba(155,89,182,0.06))',
                                        border: '1px solid rgba(0,210,211,0.25)',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '14px'
                                    }}>
                                        <div style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: '2px' }}>📋</div>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#00d2d3', marginBottom: '6px', letterSpacing: '0.02em' }}>
                                                FORMATO REQUERIDO PARA SUBIR CANCIONES
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>
                                                Sube un archivo <strong>.ZIP</strong> que contenga las pistas individuales (en <strong>MP3</strong> o <strong>WAV</strong>).<br/>
                                                El nombre del ZIP debe seguir este formato para auto-completar los datos:
                                            </div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#00d2d3', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '4px', display: 'inline-block' }}>
                                                NOMBRE - ARTISTA - NOTA - TEMPO
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Ejemplo:</span>
                                                <code style={{
                                                    background: 'rgba(0,0,0,0.3)',
                                                    border: '1px solid rgba(0,210,211,0.2)',
                                                    borderRadius: '6px',
                                                    padding: '3px 10px',
                                                    fontSize: '0.85rem',
                                                    color: '#fff',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    Celebra victorioso - Juan Carlos Alvarado - Am - 98BPM.zip
                                                </code>
                                            </div>
                                        </div>
                                    </div>
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
                                        <div style={{ color: '#00d2d3', marginBottom: '20px' }}>
                                            {isProcessingZip ? <Loader2 size={56} className="animate-spin" /> : <Upload size={56} />}
                                        </div>
                                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 10px' }}>
                                            {isProcessingZip ? `Procesando archivos ZIP (${zipProgress}%)` : 'Sube tu nueva canción'}
                                        </h2>
                                        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                                            {isProcessingZip ? 'Por favor espera mientras extraemos tus pistas...' : (
                                                <>
                                                    Arrastra tu archivo <strong>.ZIP</strong> (con pistas <strong>MP3</strong> o <strong>WAV</strong>) aquí.<br/>
                                                    <span style={{ fontSize: '0.85rem', color: '#00d2d3', fontWeight: 'bold', display: 'block', marginTop: '10px' }}>
                                                        Formato recomendado: NOMBRE - ARTISTA - NOTA - TEMPO<br/>
                                                        Ej: Celebra victorioso - Juan Carlos Alvarado - Am - 98BPM
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                        {!isProcessingZip && <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ marginTop: '20px' }}>Seleccionar Archivo</button>}
                                    </div>
                                    </>
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
                                                style={{ width: '100%', textAlign: 'left', padding: '12px 45px 12px 20px', fontSize: '0.95rem', borderRadius: '12px', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}
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
                                                <button onClick={(e) => { e.stopPropagation(); openPartituraModal(song.id); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Partituras">
                                                    <FileText size={18} />
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
                                                    style={{ width: '100%', textAlign: 'left', padding: '12px 45px 12px 20px', fontSize: '0.95rem', borderRadius: '12px', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}
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
                                            ).map((song) => (
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
            {
                isSetlistModalOpen && (
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
                )
            }
            {/* EDIT SETLIST MODAL */}
            {
                isEditSetlistModalOpen && editingSetlistData && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '900px', height: '80vh', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                <div>
                                    <h2 style={{ margin: '0 0 5px' }}>{editingSetlistData.name}</h2>
                                    <p style={{ margin: 0, color: '#64748b' }}>Editando canciones del setlist</p>
                                </div>
                                <button onClick={() => setIsEditSetlistModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}><X size={30} /></button>
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
                                                        {isInSetlist ? <CheckIcon size={16} color="#00d2d3" /> : <Plus size={18} />}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* PRICING & PLANS MODAL */}
            {
                isPricingModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '1000px', maxHeight: '95vh', overflowY: 'auto', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                <div>
                                    <h2 style={{ margin: '0 0 5px', fontSize: '2rem' }}>Mejora tu Experiencia</h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '1.1rem' }}>Elige el plan que mejor se adapte a tu ministerio</p>
                                </div>
                                {!isInitialPlanSelection && (
                                    <button onClick={() => setIsPricingModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}><X size={32} /></button>
                                )}
                            </div>

                            {pendingPaymentPlan ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Estás adquiriendo: <span style={{ color: pendingPaymentPlan.isVIP ? '#f1c40f' : '#00d2d3' }}>Plan {pendingPaymentPlan.name} ({isAnnual ? 'Anual' : 'Mensual'})</span></h3>
                                    <p style={{ fontSize: '1.2rem', marginBottom: '30px', fontWeight: '800' }}>Total a pagar: ${isAnnual ? pendingPaymentPlan.annualPrice : pendingPaymentPlan.price} USD /{isAnnual ? 'año' : 'mes'}</p>

                                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                                        {stripeClientSecret ? (
                                            <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                                                <StripeCheckoutForm
                                                    clientSecret={stripeClientSecret}
                                                    planName={pendingPaymentPlan.name}
                                                    onPaymentSuccess={handleConfirmStripeUpgrade}
                                                />
                                            </Elements>
                                        ) : (
                                            <div style={{ padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#00d2d3' }} /></div>
                                        )}
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
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.id === 'free' ? '1 GB de almacenamiento' : `${p.storageGB} GB Storage`}</div>
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
                                                                    <button onClick={() => { handlePrepareStripePayment(p); }} className="btn-teal" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Elegir</button>
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
                                                            {userPlan?.id === p.id && !isInitialPlanSelection ? <span style={{ color: '#f1c40f', fontSize: '0.7rem', fontWeight: 'bold' }}>PLAN ACTUAL</span> : <button onClick={() => { handlePrepareStripePayment(p); }} style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#f1c40f', border: 'none', color: '#000', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Elegir VIP</button>}
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
                )
            }

            {/* MODAL PARA EDITAR LETRAS (UPLOAD) */}
            {
                isLyricsModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '700px', borderRadius: '24px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <button onClick={() => setIsLyricsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}><X size={24} /></button>
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
                )
            }

            {/* MODAL PARTITURAS */}
            {
                isPartituraMOdalOpen && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '680px', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                            <button onClick={() => setIsPartituraModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}><X size={24} /></button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '26px' }}>
                                <div style={{ width: '46px', height: '46px', background: 'linear-gradient(135deg,#00d2d3,#9b59b6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={22} color="white" />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Partituras</h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Sube archivos PDF por instrumento</p>
                                </div>
                            </div>

                            {/* EXISTING PARTITURAS */}
                            {existingPartituras.length > 0 && (
                                <div style={{ marginBottom: '28px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Partituras Guardadas</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {existingPartituras.map(p => (
                                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,210,211,0.05)', border: '1px solid rgba(0,210,211,0.15)', borderRadius: '10px', padding: '12px 16px' }}>
                                                <FileText size={16} color="#00d2d3" />
                                                <span style={{ fontWeight: '700', flex: 1 }}>{p.instrument}</span>
                                                <a href={p.pdfUrl} target="_blank" rel="noreferrer" style={{ color: '#00d2d3', fontSize: '0.8rem', fontWeight: '600', textDecoration: 'none' }}>Ver PDF</a>
                                                <button onClick={() => handleDeletePartitura(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* INSTRUMENT SELECTOR */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Instrumento</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {INSTRUMENTS.map(inst => (
                                        <button
                                            key={inst}
                                            onClick={() => setPartituraInstrument(inst)}
                                            style={{
                                                padding: '7px 14px',
                                                borderRadius: '20px',
                                                border: partituraInstrument === inst ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.1)',
                                                background: partituraInstrument === inst ? 'rgba(0,210,211,0.15)' : 'rgba(255,255,255,0.03)',
                                                color: partituraInstrument === inst ? '#00d2d3' : '#94a3b8',
                                                fontWeight: partituraInstrument === inst ? '800' : '600',
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {inst}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* PDF FILE UPLOAD */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Archivo PDF</label>
                                <div
                                    onClick={() => partituraFileRef.current?.click()}
                                    style={{
                                        border: '2px dashed ' + (partituraFile ? 'rgba(0,210,211,0.5)' : 'rgba(255,255,255,0.1)'),
                                        borderRadius: '14px',
                                        padding: '28px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        background: partituraFile ? 'rgba(0,210,211,0.04)' : 'rgba(255,255,255,0.01)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <FileText size={36} color={partituraFile ? '#00d2d3' : '#475569'} style={{ margin: '0 auto 10px' }} />
                                    {partituraFile ? (
                                        <div>
                                            <div style={{ fontWeight: '700', color: '#00d2d3' }}>{partituraFile.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{(partituraFile.size / 1024).toFixed(0)} KB</div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#64748b' }}>Haz clic para seleccionar un PDF</div>
                                            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>Solo archivos .pdf</div>
                                        </div>
                                    )}
                                </div>
                                <input ref={partituraFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setPartituraFile(e.target.files[0] || null)} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setIsPartituraModalOpen(false)} className="btn-ghost" style={{ flex: 1 }}>Cerrar</button>
                                <button
                                    onClick={handlePartituraUpload}
                                    disabled={!partituraFile || !partituraInstrument || partituraUploading}
                                    className="btn-teal"
                                    style={{ flex: 1, opacity: (!partituraFile || !partituraInstrument || partituraUploading) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {partituraUploading ? <><Loader2 size={18} className="animate-spin" /> Subiendo...</> : <><Upload size={18} /> Guardar Partitura</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL PARA EDITAR CIFRADOS (UPLOAD) */}
            {
                isChordsModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '700px', borderRadius: '24px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <button onClick={() => setIsChordsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}><X size={24} /></button>
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
                )
            }

            {/* SUCCESS MODAL PREMIUM */}
            {
                isSuccessModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(15px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '450px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', padding: '40px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', left: '-20px', color: 'rgba(0,210,211,0.05)' }}><CheckIcon size={200} /></div>

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #00d2d3, #01a3a4)', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px', boxShadow: '0 20px 40px rgba(0,210,211,0.3)', transform: 'rotate(-5deg)' }}>
                                    <CheckIcon size={50} color="white" />
                                </div>

                                <h2 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '15px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>¡Increíble!</h2>
                                <p style={{ fontSize: '1.2rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '30px' }}>
                                    Tu cuenta ha sido actualizada exitosamente al <span style={{ color: '#00d2d3', fontWeight: '800' }}>Plan {successPlanName}</span>.
                                    Disfruta de todo el potencial de MixCommunity.
                                </p>

                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '35px', display: 'flex', alignItems: 'center', gap: '15px', textAlign: 'left' }}>
                                    <div style={{ color: '#f1c40f' }}><Star size={24} /></div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Ya puedes empezar a usar tus nuevas herramientas y almacenamiento ampliado.</div>
                                </div>

                                <button
                                    onClick={() => { setIsSuccessModalOpen(false); window.location.reload(); }}
                                    className="btn-teal"
                                    style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: '800', boxShadow: '0 10px 20px rgba(0,210,211,0.2)' }}
                                >
                                    ¡Vamos a Empezar!
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ERROR MODAL PREMIUM (FOR UPLOADS) */}
            {
                showErrorModal && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(15px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '450px', backgroundColor: '#1e293b', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center', padding: '40px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: 'rgba(239, 68, 68, 0.05)' }}><X size={180} /></div>

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px', boxShadow: '0 15px 30px rgba(239, 68, 68, 0.3)' }}>
                                    <HelpCircle size={40} color="white" />
                                </div>

                                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '15px', color: 'white' }}>¡Ups! Algo falló</h2>
                                <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '30px', padding: '0 10px' }}>
                                    {uploadError}
                                </p>

                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                                    <div style={{ color: '#ef4444' }}><Settings2 size={20} /></div>
                                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Sugerencia: Revisa los nombres de tus archivos y que no excedan el límite de tu plan.</div>
                                </div>

                                <button
                                    onClick={() => setShowErrorModal(false)}
                                    className="btn-teal"
                                    style={{ width: '100%', padding: '15px', fontSize: '1.1rem', fontWeight: '800', background: '#ef4444', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.2)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                                >
                                    Entendido, voy a corregirlo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default Dashboard;
