import React, { useState, useEffect, useRef } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripeJsPromise as stripePromise } from '../stripeClient.js';
import { getMixerApiBase } from '../mixerApiBase.js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SHOP_ENABLED, PAID_PLANS_ENABLED, FREE_LAUNCH_STORAGE_GB } from '../config/features';
import '../styles/brand.css';
import LanguageSwitch from '../components/LanguageSwitch';
import JSZip from 'jszip';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendEmailVerification } from 'firebase/auth';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { trackUserUsage } from '../utils/usageMetrics';
import {
    Upload, Music2, Music, User, Tag, Play, ShoppingCart,
    ChevronRight, ArrowLeft, Layers, Cloud,
    Loader2, Timer, KeyRound, ScrollText, X, Settings2, Trash2, ListMusic, Plus, Search,
    Home, Globe, CreditCard, HelpCircle, LogOut, TrendingUp,
    Star, CheckCircle2 as CheckIcon, FileText, Info, Mail
} from 'lucide-react';

function isFirestoreDocMissing(err) {
    return err?.code === 'not-found';
}

const StripeCheckoutForm = ({ planName, onPaymentSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);
        try {
            const result = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.href,
                },
                redirect: 'if_required'
            });

            if (result.error) {
                alert("Error en el pago: " + result.error.message);
                setIsProcessing(false);
            } else {
                onPaymentSuccess();
            }
        } catch (error) {
            console.error("Stripe confirmation error:", error);
            alert("Error al procesar el pago: " + (error.message || error));
            setIsProcessing(false);
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

const FREE_GB = PAID_PLANS_ENABLED ? 1 : FREE_LAUNCH_STORAGE_GB;
const STORAGE_PLANS = [
    { id: 'free', name: 'Gratis', type: 'Gratis', storageGB: FREE_GB, storageMB: FREE_GB * 1000, price: 0, annualPrice: 0, originalAnnualPrice: 0, isVIP: !PAID_PLANS_ENABLED },
    { id: 'std1', name: 'Básico', type: 'Estándar', storageGB: 10, storageMB: 10000, price: 4.99, annualPrice: 41.92, originalAnnualPrice: 59.88, isVIP: false },
    { id: 'std2', name: 'Estándar', type: 'Estándar', storageGB: 50, storageMB: 50000, price: 6.99, annualPrice: 58.72, originalAnnualPrice: 83.88, isVIP: false },
    { id: 'std3', name: 'Plus', type: 'Estándar', storageGB: 50, storageMB: 50000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: false },
    { id: 'vip1', name: 'Básico VIP', type: 'VIP', storageGB: 10, storageMB: 10000, price: 7.99, annualPrice: 67.12, originalAnnualPrice: 95.88, isVIP: true },
    { id: 'vip2', name: 'VIP', type: 'VIP', storageGB: 300, storageMB: 300000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: true },
    { id: 'vip3', name: 'Plus VIP', type: 'VIP', storageGB: 50, storageMB: 50000, price: 12.99, annualPrice: 109.12, originalAnnualPrice: 155.88, isVIP: true },
    { id: 'universal_pro', name: 'VIP', type: 'VIP', storageGB: 300, storageMB: 300000, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: true, isUniversal: true },
    { id: 'zion_desktop_pro_local', name: 'Zion Stage PRO (PC)', type: 'PRO PC', storageGB: 10, storageMB: 10000, price: 1.99, annualPrice: 19.90, originalAnnualPrice: 19.90, isVIP: false, isDesktop: true },
    { id: 'zion_desktop_pro_online', name: 'Zion Stage PRO Online', type: 'PRO Online', storageGB: 20, storageMB: 20000, price: 5.99, annualPrice: 59.90, originalAnnualPrice: 59.90, isVIP: true, isDesktop: true },
    { id: 'seller', name: 'Vendedor MixCommunity', type: 'Vendedor', storageGB: 20, storageMB: 20000, price: 1.99, annualPrice: 19.90, originalAnnualPrice: 19.90, isVIP: false, isSeller: true },
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
    const { t } = useTranslation();
    const fileInputRef = useRef();

    const [activeTab, setActiveTab] = useState('home');
    const [step, setStep] = useState('idle');
    const [userProfile, setUserProfile] = useState(null);
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
    const [accountPwdCurrent, setAccountPwdCurrent] = useState('');
    const [accountPwdNew, setAccountPwdNew] = useState('');
    const [accountPwdConfirm, setAccountPwdConfirm] = useState('');
    const [accountPwdMsg, setAccountPwdMsg] = useState('');
    const [accountPwdErr, setAccountPwdErr] = useState('');
    const [accountPwdSaving, setAccountPwdSaving] = useState(false);
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
    const [isProcessingStripe, setIsProcessingStripe] = useState(false);
    const [dashboardCouponInput, setDashboardCouponInput] = useState(() => {
        try { return localStorage.getItem('zion_intended_coupon') || ''; } catch { return ''; }
    });
    const [dashboardPromoApplied, setDashboardPromoApplied] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successPlanName, setSuccessPlanName] = useState('');
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showUploadHelp, setShowUploadHelp] = useState(false); // Nuevo: Modal de ayuda de subida

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
            const devProxy = getMixerApiBase();
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
    const [isPromoClaimedModalOpen, setIsPromoClaimedModalOpen] = useState(false);

    const usedMB = userSongs.reduce((acc, s) =>
        acc + (s.tracks || []).reduce((a, t) => a + parseFloat(t.sizeMB || 0), 0), 0);
    const storageLimitGB = Math.max(customStorageGB || 0, userPlan?.storageGB || 1);
    const storageLimit = storageLimitGB * 1024;
    const usedPercent = Math.min(100, (usedMB / storageLimit) * 100);

    useEffect(() => {
        let unsubSongs = () => { };
        let unsubSetlists = () => { };
        let unsubUser = () => { };
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                void trackUserUsage(user);
                // Fetch User Plan from Firestore safely
                unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserProfile(data);
                        const plan = STORAGE_PLANS.find(p => p.id === data.planId) || STORAGE_PLANS[0];
                        setUserPlan(plan);
                        setCustomStorageGB(data.customStorageGB || 0);

                        // Si el usuario llegó desde la Landing eligiendo un plan (solo cuando PAID_PLANS_ENABLED = true)
                        let intendedHandled = false;
                        if (PAID_PLANS_ENABLED) {
                            try {
                                const rawIntended = localStorage.getItem('zion_intended_plan');
                                if (rawIntended) {
                                    localStorage.removeItem('zion_intended_plan');
                                    const parsed = JSON.parse(rawIntended);
                                    const targetPlan = STORAGE_PLANS.find(p => p.id === parsed?.id);
                                    if (targetPlan && data.planId !== targetPlan.id) {
                                        intendedHandled = true;
                                        const wantAnnual = parsed?.cycle === 'annual';
                                        setIsAnnual(wantAnnual);
                                        setIsInitialPlanSelection(false);
                                        setIsPricingModalOpen(true);
                                        setTimeout(() => { handlePrepareStripePayment(targetPlan, undefined, wantAnnual, user); }, 350);
                                    }
                                }
                            } catch { /* ignore */ }
                        }

                        // Check local storage to ensure we don't spam the user with the modal on every login
                        const hasSeenModal = localStorage.getItem(`mixer_seen_pricing_${user.uid}`);

                        if (PAID_PLANS_ENABLED && !intendedHandled && (!data.planId || data.planId === 'free')) {
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
                            customStorageGB: FREE_GB,
                            ...(!PAID_PLANS_ENABLED ? { desktopProActive: true, desktopLicenseTier: 'pro_local' } : {}),
                            email: user.email || '',
                            displayName: user.displayName || '',
                            createdAt: serverTimestamp()
                        }, { merge: true })
                            .then(() => {
                                setUserPlan(STORAGE_PLANS[0]);
                                setCustomStorageGB(FREE_GB);
                                if (PAID_PLANS_ENABLED) {
                                    setTimeout(() => {
                                        setIsInitialPlanSelection(true);
                                        setIsPricingModalOpen(true);
                                    }, 800);
                                }
                            })
                            .catch(err => console.error("Error creating user profile:", err));
                    }
                }, (error) => {
                    console.error("Error fetching user plan:", error);
                    setUserPlan(STORAGE_PLANS[0]);
                });

                // Solo canciones subidas por este usuario (excluye globales en JS para no perder docs sin el campo)
                const q = query(collection(db, 'songs'), where('userId', '==', user.uid));
                unsubSongs = onSnapshot(q, (snap) => {
                    const songs = [];
                    snap.forEach(doc => {
                        const s = { id: doc.id, ...doc.data() };
                        if (!s.isGlobal) songs.push(s);
                    });
                    songs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
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

    // Promo free plan removed — no promotional free plans active

    const handleZipUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Soporte directo para múltiples pistas de audio (.mp3, .wav, .m4a, .ogg, .flac) SIN necesidad de comprimir en ZIP
        const audioFiles = files.filter(f => /\.(wav|mp3|m4a|ogg|flac)$/i.test(f.name));
        const zipFile = files.find(f => /\.zip$/i.test(f.name));

        if (!zipFile && audioFiles.length > 0) {
            setSongName(''); setArtist(''); setSongKey(''); setTempo('');
            setTimeSignature('4/4'); setLyrics(''); setChords(''); setFileList([]);
            setUseType('personal');

            // Si vienen de una carpeta, usar el nombre de la carpeta como nombre sugerido de la canción
            const firstRel = audioFiles[0].webkitRelativePath || '';
            if (firstRel.includes('/')) {
                const folderName = firstRel.split('/')[0];
                const parts = folderName.split('-').map(p => p.trim());
                if (parts[0]) setSongName(parts[0]);
                if (parts[1]) setArtist(parts[1]);
                if (parts[2]) { if (/\d/.test(parts[2])) setTempo(parts[2].replace(/[^\d.]/g, '')); else setSongKey(parts[2]); }
                if (parts[3]) { if (/\d/.test(parts[3])) setTempo(parts[3].replace(/[^\d.]/g, '')); else setSongKey(parts[3]); }
            }

            const prepared = audioFiles.map((f, idx) => {
                const rawName = f.name.replace(/\.(wav|mp3|m4a|ogg|flac)$/i, '');
                let finalDisplayName = rawName.replace(/[^a-zA-Z0-9_\s-]/g, '').trim();
                if (finalDisplayName.toLowerCase().includes('clicktrack')) finalDisplayName = 'Click';
                if (!finalDisplayName) finalDisplayName = `Track_${idx + 1}`;
                return {
                    originalName: f.name,
                    displayName: finalDisplayName,
                    blob: f,
                    extension: f.name.split('.').pop().toLowerCase()
                };
            });
            setFileList(prepared);
            setStep('details');
            return;
        }

        const file = zipFile || files[0];
        if (!file) return;
        setIsProcessingZip(true);
        setZipProgress(0);
        const zip = new JSZip();
        try {
            // Reset states from previous upload to avoid leakage
            setSongName(''); setArtist(''); setSongKey(''); setTempo('');
            setTimeSignature('4/4'); setLyrics(''); setChords(''); setFileList([]);
            setUseType('personal');

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

        // Validar límite real de almacenamiento del plan antes de subir a B2
        const newSongMB = fileList.reduce((acc, f) => acc + ((f.blob?.size || 0) / (1024 * 1024)), 0);
        const isAdminUser = userProfile?.role === 'admin' || userProfile?.isAdmin === true;
        if (!isAdminUser && (usedMB + newSongMB) > storageLimit) {
            const usedLabel = usedMB >= 1024 ? `${(usedMB / 1024).toFixed(2)} GB` : `${usedMB.toFixed(0)} MB`;
            const upgradeHint = PAID_PLANS_ENABLED
                ? 'Actualiza tu plan a Estándar (50 GB) o VIP (300 GB) para seguir subiendo.'
                : 'Elimina alguna canción antigua para liberar espacio en tu cuenta gratuita de 5 GB.';
            setUploadError(
                `Límite de almacenamiento alcanzado (${storageLimitGB} GB). ` +
                `Tienes ${usedLabel} usados y esta canción pesa ${newSongMB.toFixed(1)} MB. ` +
                upgradeHint
            );
            setShowErrorModal(true);
            return;
        }

        setIsUploading(true);
        setStep('uploading');
        const uploadedTracksInfo = [];
        const devProxy = getMixerApiBase();

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
                    previewUrl: data.previewUrl || data.url,
                    b2FileId: data.fileId || '',
                    sizeMB: (track.blob.size / 1024 / 1024).toFixed(2),
                    // v2 normalized FLAC — set by server when conversion succeeds
                    ...(data.normalizedUrl ? {
                        normalizedUrl: data.normalizedUrl,
                        normalizedB2Url: data.normalizedB2Url || '',
                        normalizedReady: true,
                        normalizedFormat: 'flac',
                        audioFormatVersion: 2,
                    } : {})
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
            const devProxy = getMixerApiBase();

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

    const handlePrepareStripePayment = async (plan, couponOverride, annualOverride, userOverride) => {
        const activeUser = userOverride || currentUser || auth.currentUser;
        if (!activeUser) {
            alert('Inicia sesión primero para continuar con el pago.');
            return;
        }
        const rawCoupon = (couponOverride !== undefined ? couponOverride : dashboardCouponInput).trim();
        const useAnnual = annualOverride !== undefined ? annualOverride : isAnnual;
        // ZION99 solo aplica a plan mensual; si cambia a anual sin aplicarlo manualmente, no bloquear el pago
        const couponToUse = (useAnnual && couponOverride === undefined && rawCoupon.toUpperCase() === 'ZION99') ? '' : rawCoupon;
        setPendingPaymentPlan(plan);
        setIsProcessingStripe(true);
        try {
            const devProxy = getMixerApiBase();

            const res = await fetch(`${devProxy}/api/stripe/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: activeUser.email,
                    name: activeUser.displayName || activeUser.email.split('@')[0],
                    userId: activeUser.uid,
                    planId: plan.id,
                    isAnnual: useAnnual,
                    couponCode: couponToUse,
                })
            });
            const data = await res.json();
            if (data.clientSecret) {
                setStripeClientSecret(data.clientSecret);
                setStripeSubscriptionId(data.subscriptionId);
                setDashboardPromoApplied(data.promoApplied === true);
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
        // ✅ SEGURIDAD: No escribimos el plan desde el cliente.
        // El webhook de Stripe (b2-proxy.mjs) actualizará Firestore automáticamente.
        // El onSnapshot en users/{uid} detectará el cambio y actualizará la UI.
        try {
            localStorage.setItem(`mixer_seen_pricing_${currentUser.uid}`, 'true');
            setSuccessPlanName(pendingPaymentPlan.name);
            setIsSuccessModalOpen(true);
            setIsInitialPlanSelection(false);
            setPendingPaymentPlan(null);
            setStripeClientSecret('');
            setIsPricingModalOpen(false);
        } catch (error) {
            console.error('Error cerrando modal de pago:', error);
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
        } catch (e) {
            if (isFirestoreDocMissing(e)) {
                alert('Este setlist ya no existe en la nube. Cerrá el editor y actualizá la lista.');
                setIsEditSetlistModalOpen(false);
                setEditingSetlistData(null);
                return;
            }
            console.error(e);
        }
    };

    const handleRemoveSongFromSetlist = async (index) => {
        if (!editingSetlistData) return;
        const updatedSongs = [...(editingSetlistData.songs || [])];
        updatedSongs.splice(index, 1);
        try {
            await updateDoc(doc(db, 'setlists', editingSetlistData.id), { songs: updatedSongs });
            setEditingSetlistData({ ...editingSetlistData, songs: updatedSongs });
        } catch (e) {
            if (isFirestoreDocMissing(e)) {
                alert('Este setlist ya no existe en la nube. Cerrá el editor y actualizá la lista.');
                setIsEditSetlistModalOpen(false);
                setEditingSetlistData(null);
                return;
            }
            console.error(e);
        }
    };

    const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

    const hasPasswordProvider = Boolean(
        currentUser?.providerData?.some((p) => p.providerId === 'password'),
    );

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setAccountPwdErr('');
        setAccountPwdMsg('');
        if (accountPwdNew !== accountPwdConfirm) {
            setAccountPwdErr(t('dashboard.passwordMismatch'));
            return;
        }
        if (accountPwdNew.length < 6) {
            setAccountPwdErr(t('dashboard.passwordTooShort'));
            return;
        }
        const user = auth.currentUser;
        if (!user?.email) {
            setAccountPwdErr(t('dashboard.passwordError'));
            return;
        }
        if (!hasPasswordProvider) {
            setAccountPwdErr(t('dashboard.passwordGoogleOnly'));
            return;
        }
        setAccountPwdSaving(true);
        try {
            const cred = EmailAuthProvider.credential(user.email, accountPwdCurrent);
            await reauthenticateWithCredential(user, cred);
            await updatePassword(user, accountPwdNew);
            setAccountPwdMsg(t('dashboard.passwordChanged'));
            setAccountPwdCurrent('');
            setAccountPwdNew('');
            setAccountPwdConfirm('');
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setAccountPwdErr(t('dashboard.passwordWrong'));
            } else {
                setAccountPwdErr(err?.message || t('dashboard.passwordError'));
            }
        } finally {
            setAccountPwdSaving(false);
        }
    };

    const [verifyChecking, setVerifyChecking] = useState(false);
    const [verifyResending, setVerifyResending] = useState(false);
    const [verifyFeedback, setVerifyFeedback] = useState('');
    const [emailVerifiedState, setEmailVerifiedState] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        setEmailVerifiedState(!!currentUser.emailVerified);
    }, [currentUser]);

    const EXEMPT_VERIFY_EMAILS = new Set(['ueservicesllc1@gmail.com', '123@gmail.com']);
    const needsEmailVerification = Boolean(
        currentUser &&
        hasPasswordProvider &&
        !emailVerifiedState &&
        !EXEMPT_VERIFY_EMAILS.has(String(currentUser.email || '').trim().toLowerCase())
    );

    const handleCheckEmailVerified = async () => {
        if (!auth.currentUser) return;
        setVerifyChecking(true);
        setVerifyFeedback('');
        try {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
                setEmailVerifiedState(true);
            } else {
                setVerifyFeedback('Todavía no aparece verificado. Abre el enlace que enviamos a tu correo y vuelve a presionar este botón.');
            }
        } catch (err) {
            setVerifyFeedback(err?.message || 'Error al comprobar la verificación.');
        } finally {
            setVerifyChecking(false);
        }
    };

    const handleResendVerification = async () => {
        if (!auth.currentUser) return;
        setVerifyResending(true);
        setVerifyFeedback('');
        try {
            const idToken = await auth.currentUser.getIdToken();
            const resp = await fetch(`${getMixerApiBase()}/api/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.fallbackToFirebase) {
                await sendEmailVerification(auth.currentUser);
            }
            setVerifyFeedback(`Listo. Enviamos un nuevo enlace de confirmación a ${auth.currentUser.email}. Revisa tu bandeja de entrada o Spam.`);
        } catch (err) {
            setVerifyFeedback(err?.message || 'Espera un minuto antes de reenviar el correo.');
        } finally {
            setVerifyResending(false);
        }
    };

    if (needsEmailVerification) {
        return (
            <div style={{ minHeight: '100vh', background: '#f4f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '"Inter", sans-serif' }}>
                <div style={{ width: '100%', maxWidth: '460px', background: '#ffffff', border: '1px solid #e3e8ec', borderRadius: '14px', padding: '36px 32px', textAlign: 'center', boxShadow: '0 12px 32px rgba(22,32,38,0.08)' }}>
                    <img src="/logo2.png" alt="Zion Stage" style={{ height: '30px', marginBottom: '22px' }} />
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e7f8f9', color: '#17bcc7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                        <Mail size={28} />
                    </div>
                    <h2 style={{ margin: '0 0 10px', fontSize: '1.45rem', fontWeight: '800', color: '#1d2328' }}>
                        Confirma tu correo electrónico
                    </h2>
                    <p style={{ margin: '0 0 20px', color: '#5a6670', fontSize: '0.94rem', lineHeight: 1.6 }}>
                        Enviamos un enlace de verificación único a <strong style={{ color: '#1d2328' }}>{currentUser.email}</strong>. Haz clic en ese enlace para activar tu cuenta y entrar al Dashboard.
                    </p>
                    {verifyFeedback && (
                        <div style={{ background: '#f4f6f8', border: '1px solid #d4dce2', color: '#1d2328', padding: '11px 14px', borderRadius: '8px', fontSize: '0.86rem', marginBottom: '18px', lineHeight: 1.5 }}>
                            {verifyFeedback}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={handleCheckEmailVerified}
                            disabled={verifyChecking}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#17bcc7', color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                        >
                            {verifyChecking ? 'Comprobando...' : 'Ya confirmé mi correo'}
                        </button>
                        <button
                            type="button"
                            onClick={handleResendVerification}
                            disabled={verifyResending}
                            style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #d4dce2', background: '#ffffff', color: '#1d2328', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            {verifyResending ? 'Enviando...' : 'Reenviar enlace de confirmación'}
                        </button>
                        <button
                            type="button"
                            onClick={() => auth.signOut()}
                            style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#5a6670', fontWeight: '600', fontSize: '0.86rem', cursor: 'pointer', marginTop: '4px' }}
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="z-dash">
            {/* SIDEBAR */}
            <aside className="z-dash-sidebar">
                <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', marginBottom: '26px', cursor: 'pointer', paddingLeft: '8px' }}>
                    <img src="/logo2.png" alt="Zion Stage" style={{ height: '30px' }} />
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {[
                        { id: 'home', label: t('dashboard.home'), icon: <Home size={20} /> },
                        { id: 'songs', label: t('dashboard.mySongs'), icon: <Music2 size={20} /> },
                        { id: 'setlists', label: t('dashboard.setlists'), icon: <ListMusic size={20} /> },
                        { id: 'global', label: t('dashboard.community'), icon: <Globe size={20} /> },
                        { id: 'account', label: t('dashboard.account'), icon: <KeyRound size={20} /> },
                        ...(SHOP_ENABLED ? [{ id: 'vendedores', label: userProfile?.isSeller ? t('dashboard.sellerPanel') : t('dashboard.becomeSeller'), icon: <TrendingUp size={20} /> }] : []),
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
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px',
                                background: activeTab === item.id ? '#e7f8f9' : 'transparent',
                                border: 'none', color: activeTab === item.id ? '#0f8c95' : '#4b5563',
                                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === item.id ? '700' : '600', transition: 'all 0.15s'
                            }}
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                    <button hidden={!SHOP_ENABLED} onClick={() => navigate('/store')} style={{ display: SHOP_ENABLED ? 'flex' : 'none', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'transparent', border: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', marginTop: '10px' }}>
                        <ShoppingCart size={20} /> {t('dashboard.marketplace')}
                    </button>
                    <button onClick={() => navigate('/multitrack')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: '#17bcc7', border: 'none', color: 'white', marginTop: '18px', cursor: 'pointer', fontWeight: '700' }}>
                        <Play size={18} fill="currentColor" /> {t('dashboard.goMixer')}
                    </button>
                </nav>

                <div style={{ borderTop: '1px solid #e3e8ec', paddingTop: '18px' }}>
                    <div onClick={() => { if (PAID_PLANS_ENABLED) { setIsInitialPlanSelection(false); setIsPricingModalOpen(true); } }} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '8px', cursor: PAID_PLANS_ENABLED ? 'pointer' : 'default', borderRadius: '8px', transition: 'all 0.2s' }} className="user-profile-btn">
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: userPlan?.isVIP ? '#ed654c' : '#162026', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>{displayName[0]?.toUpperCase()}</div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1d2328', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{displayName}</div>
                            <div style={{ fontSize: '0.75rem', color: userPlan?.isVIP ? '#ed654c' : '#5a6670', fontWeight: '800' }}>{userPlan?.type} · {storageLimitGB} GB</div>
                            {/* Fecha de vencimiento del plan */}
                            {(() => {
                                const expiresAt = userProfile?.planExpiresAt;
                                if (!expiresAt || userPlan?.id === 'free') return null;
                                const expDate = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
                                const daysLeft = Math.ceil((expDate - Date.now()) / (1000 * 60 * 60 * 24));
                                const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
                                const isExpired = daysLeft <= 0;
                                return (
                                    <div style={{
                                        fontSize: '0.65rem',
                                        marginTop: '2px',
                                        fontWeight: '700',
                                        color: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#64748b'
                                    }}>
                                        {isExpired
                                            ? '⚠️ Plan vencido'
                                            : isExpiringSoon
                                                ? `⏰ Vence en ${daysLeft}d`
                                                : `Vence ${expDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                        }
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                    {PAID_PLANS_ENABLED && (
                    <button onClick={() => { setIsInitialPlanSelection(false); setIsPricingModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px', width: '100%', background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '7px', color: '#1d2328', cursor: 'pointer', fontSize: '0.84rem', fontWeight: '700', marginBottom: '8px' }}>
                        {t('dashboard.upgradePlan')}
                    </button>
                    )}
                    <button onClick={() => auth.signOut()} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px', width: '100%', background: 'transparent', border: 'none', color: '#5a6670', cursor: 'pointer', fontSize: '0.84rem', fontWeight: '600' }}>
                        <LogOut size={16} /> {t('dashboard.signOut')}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="z-dash-main">
                {/* ── HEADER OVERVIEW ── */}
                <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 8px' }}>
                            {activeTab === 'home' ? t('dashboard.hello', { name: displayName }) :
                                activeTab === 'songs' ? t('dashboard.tabSongs') :
                                    activeTab === 'setlists' ? t('dashboard.tabSetlists') :
                                        activeTab === 'account' ? t('dashboard.tabAccount') :
                                            t('dashboard.tabCommunity')}
                        </h1>
                        <p style={{ color: '#64748b', margin: 0 }}>
                            {activeTab === 'home' ? t('dashboard.homeSub') :
                                activeTab === 'account' ? t('dashboard.accountSub') : ''}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <LanguageSwitch />
                    {!isNativeApp() && (activeTab === 'songs' || activeTab === 'home') && step === 'idle' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={() => setShowUploadHelp(true)} 
                                style={{ background: 'rgba(0,210,211,0.1)', border: '1px solid #00d2d3', color: '#00d2d3', padding: '10px 15px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <HelpCircle size={18} /> {t('dashboard.howUpload')}
                            </button>
                            <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={isProcessingZip}>
                                {isProcessingZip ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                {isProcessingZip ? t('dashboard.processingZip', { pct: zipProgress }) : t('dashboard.uploadSong')}
                            </button>
                        </div>
                    )}
                    {(activeTab === 'setlists') && (
                        <button onClick={() => setIsSetlistModalOpen(true)} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={20} /> {t('dashboard.newSetlist')}
                        </button>
                    )}
                    {!isNativeApp() && <input ref={fileInputRef} type="file" accept=".zip,.mp3,.wav,.m4a,.ogg,.flac" multiple onChange={handleZipUpload} style={{ display: 'none' }} />}
                    </div>
                </header>

                {/* ── WIZARD STEPS ── */}
                {step !== 'idle' ? (
                    <section className="card-premium" style={{ maxWidth: '800px' }}>
                        {step === 'choose-use' && (
                            <div>
                                <h3 style={{ marginBottom: '24px' }}>{t('dashboard.wizardHowTitle')}</h3>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                                    {[{ id: 'personal', label: t('dashboard.usePersonal'), icon: <User size={24} /> }, ...(SHOP_ENABLED ? [{ id: 'sell', label: t('dashboard.useSell'), icon: <Tag size={24} /> }] : [])].map(type => (
                                        <div key={type.id} onClick={() => setUseType(type.id)} style={{ flex: 1, padding: '30px', border: `2px solid ${useType === type.id ? '#00d2d3' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', textAlign: 'center', cursor: 'pointer', backgroundColor: useType === type.id ? 'rgba(0,210,211,0.05)' : 'transparent' }}>
                                            <div style={{ color: useType === type.id ? '#00d2d3' : '#64748b', marginBottom: '12px' }}>{type.icon}</div>
                                            <div style={{ fontWeight: '700' }}>{type.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button onClick={resetWizard} className="btn-ghost">{t('dashboard.cancel')}</button>
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
                                        onClick={() => setShowUploadHelp(true)} 
                                        style={{ background: 'rgba(0,210,211,0.1)', border: '1px solid #00d2d3', color: '#00d2d3', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,210,211,0.2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,210,211,0.1)'}
                                    >
                                        Guía de Formato
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
                                    <button
                                        disabled={useType === 'sell' && !hasRights}
                                        onClick={() => {
                                            if (!SHOP_ENABLED) {
                                                setUseType('personal');
                                                setStep('uploading-flow');
                                            } else {
                                                setStep('choose-use');
                                            }
                                        }}
                                        className="btn-teal"
                                        style={{ flex: 1, opacity: (useType === 'sell' && !hasRights) ? 0.5 : 1 }}
                                    >
                                        Siguiente
                                    </button>
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
                            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                                <CheckIcon size={64} color="#10b981" style={{ margin: '0 auto 20px' }} />
                                <h2 style={{ marginBottom: '10px' }}>Subida Completa</h2>
                                {useType === 'sell' ? (
                                    <p style={{ color: '#f1c40f' }}>Tu canción está siendo verificada. Estará lista para la venta cuando sea aprobada por un administrador.</p>
                                ) : (
                                    <p style={{ color: '#94a3b8', marginBottom: '26px' }}>Tu canción ya está lista en tu biblioteca personal y sincronizada en todos tus dispositivos.</p>
                                )}
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button onClick={() => navigate('/multitrack')} className="btn-teal" style={{ padding: '12px 26px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <Play size={18} fill="currentColor" /> Abrir en el Mixer
                                    </button>
                                    <button onClick={resetWizard} className="btn-ghost" style={{ padding: '12px 22px' }}>
                                        Volver a mi biblioteca
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                ) : (
                    <>
                        {/* ── STORAGE SUMMARY (Home Only) ── */}
                        {activeTab === 'home' && (
                            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                                <div className="card-premium">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ color: '#5a6670', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '0.9rem' }}><Cloud size={18} color="#17bcc7" /> Almacenamiento</div>
                                        <div style={{ fontWeight: '800', color: '#1d2328' }}>{usedPercent.toFixed(1)}%</div>
                                    </div>
                                    <div style={{ height: '8px', background: '#e8eef2', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                                        <div style={{ width: `${usedPercent}%`, height: '100%', background: usedMB >= storageLimit ? '#ed654c' : '#17bcc7', borderRadius: '4px' }}></div>
                                    </div>
                                    <div style={{ color: usedMB >= storageLimit ? '#b4341c' : '#5a6670', fontSize: '0.84rem', fontWeight: usedMB >= storageLimit ? '700' : '400' }}>
                                        {usedMB >= 1024 ? `${(usedMB / 1024).toFixed(2)} GB` : `${usedMB.toFixed(0)} MB`} de {storageLimitGB} GB usado
                                        {usedMB >= storageLimit ? ' (límite alcanzado)' : ''}
                                    </div>
                                </div>
                                <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                    <div style={{ width: '48px', height: '48px', background: '#e7f8f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17bcc7' }}><Music2 size={22} /></div>
                                    <div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1d2328', lineHeight: 1.1 }}>{userSongs.length}</div>
                                        <div style={{ color: '#5a6670', fontSize: '0.88rem', marginTop: '2px' }}>Canciones subidas</div>
                                    </div>
                                </div>
                                <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                    <div style={{ width: '48px', height: '48px', background: '#fef1ee', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ed654c' }}><ListMusic size={22} /></div>
                                    <div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1d2328', lineHeight: 1.1 }}>{userSetlists.length}</div>
                                        <div style={{ color: '#5a6670', fontSize: '0.88rem', marginTop: '2px' }}>Setlists creados</div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* ── SONG LIST & UPLOAD ── */}
                        {(activeTab === 'home' || activeTab === 'songs') && (
                            <section>
                                {!isNativeApp() && activeTab === 'songs' && (
                                    <div
                                        onClick={() => fileInputRef.current.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                handleZipUpload({ target: { files: e.dataTransfer.files } });
                                            }
                                        }}
                                        className="z-dropzone"
                                    >
                                        <div style={{ color: '#17bcc7', marginBottom: '12px' }}>
                                            {isProcessingZip ? <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto' }} /> : <Upload size={40} style={{ margin: '0 auto' }} />}
                                        </div>
                                        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 6px', color: '#1d2328' }}>
                                            {isProcessingZip ? `Procesando archivo ZIP (${zipProgress}%)` : 'Sube tu multitrack en segundos'}
                                        </h2>
                                        <p style={{ color: '#5a6670', fontSize: '0.92rem', margin: '0 auto 16px', maxWidth: '520px', lineHeight: 1.5 }}>
                                            {isProcessingZip
                                                ? 'Extrayendo tus pistas de audio...'
                                                : 'Arrastra varias pistas (.MP3, .WAV, .M4A) o un archivo .ZIP aquí. Si el nombre sigue "Canción - Artista - Tono - BPM", los datos se llenan solos.'}
                                        </p>
                                        {!isProcessingZip && (
                                            <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }} className="btn-teal" style={{ padding: '10px 22px', fontSize: '0.9rem', fontWeight: '700' }}>
                                                Seleccionar pistas o .ZIP
                                            </button>
                                        )}
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
                                                style={{ width: '100%', textAlign: 'left', padding: '12px 45px 12px 20px', fontSize: '0.95rem', borderRadius: '12px', background: 'white', color: 'black', border: '1px solid #cbd5e1' }}
                                                placeholder="Buscar por nombre o artista..."
                                                value={songSearchQuery}
                                                onChange={e => setSongSearchQuery(e.target.value)}
                                            />
                                            <Search size={20} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                        </div>
                                    )}
                                </div>

                                <div className="z-dash-table">
                                    {/* LIST HEADER */}
                                    <div className="z-dash-table-head">
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
                                    ).map((song) => (
                                        <div
                                            key={song.id}
                                            onClick={() => { localStorage.setItem('mixer_pendingSongId', song.id); navigate('/multitrack'); }}
                                            className="z-dash-table-row"
                                        >
                                            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#e7f8f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17bcc7' }}>
                                                <Music2 size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.96rem', color: '#1d2328' }}>{song.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#5a6670' }}>{song.tracks?.length || 0} pistas</div>
                                            </div>
                                            <div style={{ color: '#5a6670', fontSize: '0.92rem' }}>{song.artist || '—'}</div>
                                            <div>
                                                {song.key && <span style={{ color: '#0f8c95', fontWeight: '700', background: '#e7f8f9', padding: '3px 9px', borderRadius: '5px', fontSize: '0.82rem' }}>{song.key}</span>}
                                            </div>
                                            <div style={{ color: '#5a6670', fontSize: '0.9rem' }}>{song.tempo ? `${song.tempo} BPM` : '—'}</div>
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
                                        <div style={{ textAlign: 'center', padding: '72px 24px', color: '#5a6670' }}>
                                            <div style={{ marginBottom: '14px', color: '#cbd5e1' }}><Music2 size={44} style={{ margin: '0 auto' }} /></div>
                                            <h4 style={{ margin: '0 0 6px', color: '#1d2328', fontSize: '1.1rem', fontWeight: '700' }}>No hay canciones en tu biblioteca</h4>
                                            <p style={{ margin: '0 0 20px', fontSize: '0.92rem' }}>Sube tus pistas (.MP3, .WAV) o un archivo .ZIP para comenzar.</p>
                                            {!isNativeApp() && (
                                                <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ padding: '10px 22px', fontWeight: '700', fontSize: '0.9rem' }}>
                                                    Subir mi primera canción
                                                </button>
                                            )}
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
                                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fef1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ed654c' }}>
                                                    <ListMusic size={22} />
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

                        {activeTab === 'account' && (
                            <section style={{ maxWidth: '540px' }}>
                                <div className="card-premium">
                                    <div style={{ marginBottom: '22px' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#5a6670', fontWeight: '700', letterSpacing: '0.06em', marginBottom: '6px', textTransform: 'uppercase' }}>{t('dashboard.accountEmail')}</div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1d2328' }}>{currentUser?.email || '—'}</div>
                                    </div>
                                    {!hasPasswordProvider ? (
                                        <p style={{ margin: 0, color: '#5a6670', lineHeight: 1.55, fontSize: '0.95rem' }}>{t('dashboard.passwordGoogleOnly')}</p>
                                    ) : (
                                        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: '800', color: '#1d2328' }}>{t('dashboard.changePasswordTitle')}</h3>
                                            <input type="password" autoComplete="current-password" placeholder={t('dashboard.currentPassword')} value={accountPwdCurrent} onChange={(e) => setAccountPwdCurrent(e.target.value)} required style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #d4dce2', background: '#ffffff', color: '#1d2328', fontSize: '0.95rem' }} />
                                            <input type="password" autoComplete="new-password" placeholder={t('dashboard.newPassword')} value={accountPwdNew} onChange={(e) => setAccountPwdNew(e.target.value)} required style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #d4dce2', background: '#ffffff', color: '#1d2328', fontSize: '0.95rem' }} />
                                            <input type="password" autoComplete="new-password" placeholder={t('dashboard.confirmNewPassword')} value={accountPwdConfirm} onChange={(e) => setAccountPwdConfirm(e.target.value)} required style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #d4dce2', background: '#ffffff', color: '#1d2328', fontSize: '0.95rem' }} />
                                            {accountPwdErr && <div style={{ color: '#b4341c', fontSize: '0.88rem', padding: '10px', borderRadius: '8px', background: '#fef1ee', border: '1px solid #f7c7bc' }}>{accountPwdErr}</div>}
                                            {accountPwdMsg && <div style={{ color: '#0f766e', fontSize: '0.88rem', padding: '10px', borderRadius: '8px', background: '#e7f8f9', border: '1px solid #b9dfe2' }}>{accountPwdMsg}</div>}
                                            <button type="submit" className="btn-teal" disabled={accountPwdSaving} style={{ marginTop: '6px', padding: '12px 18px', fontWeight: '700' }}>
                                                {accountPwdSaving ? t('dashboard.changingPassword') : t('dashboard.savePassword')}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* ── FALLBACK FOR GLOBAL ── */}
                        {activeTab === 'global' && (
                            <section>
                                {userPlan?.isVIP ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#1d2328' }}>Base de Datos VIP</h3>
                                                <span style={{ fontSize: '0.9rem', color: '#5a6670', marginTop: '4px' }}>
                                                    {userSongs.filter(s =>
                                                        Array.isArray(s.tracks) &&
                                                        s.tracks.length > 0 &&
                                                        !(s.forSale === true && Number(s.price || 0) > 0)
                                                    ).length} canciones disponibles
                                                </span>
                                            </div>
                                            <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
                                                <input
                                                    type="text"
                                                    style={{ width: '100%', textAlign: 'left', padding: '11px 42px 11px 16px', fontSize: '0.94rem', borderRadius: '8px', background: '#ffffff', color: '#1d2328', border: '1px solid #d4dce2' }}
                                                    placeholder="Buscar en la base de datos VIP..."
                                                    value={songSearchQuery}
                                                    onChange={e => setSongSearchQuery(e.target.value)}
                                                />
                                                <Search size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#5a6670' }} />
                                            </div>
                                        </div>
                                        <div className="z-dash-table">
                                            <div className="z-dash-table-head">
                                                <span></span>
                                                <span>Canción</span>
                                                <span>Artista</span>
                                                <span>Key</span>
                                                <span>Tempo</span>
                                                <span style={{ textAlign: 'right' }}>Acciones</span>
                                            </div>
                                            {userSongs.filter(s =>
                                                Array.isArray(s.tracks) &&
                                                s.tracks.length > 0 &&
                                                !(s.forSale === true && Number(s.price || 0) > 0) &&
                                                (s.name.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                                (s.artist || '').toLowerCase().includes(songSearchQuery.toLowerCase()))
                                            ).map((song) => (
                                                <div key={song.id} onClick={() => { localStorage.setItem('mixer_pendingSongId', song.id); navigate('/multitrack'); }} className="z-dash-table-row">
                                                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fef1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ed654c' }}><Music2 size={18} /></div>
                                                    <div><div style={{ fontWeight: '700', color: '#1d2328' }}>{song.name}</div><div style={{ fontSize: '0.8rem', color: '#5a6670' }}>{song.userId === currentUser?.uid ? 'Tu biblioteca' : 'Base de datos VIP'}</div></div>
                                                    <div style={{ color: '#5a6670' }}>{song.artist || '—'}</div>
                                                    <div>{song.key && <span style={{ color: '#0f8c95', fontWeight: '700', background: '#e7f8f9', padding: '3px 9px', borderRadius: '5px', fontSize: '0.82rem' }}>{song.key}</span>}</div>
                                                    <div style={{ color: '#5a6670' }}>{song.tempo ? `${song.tempo} BPM` : '—'}</div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                                        <button onClick={(e) => { e.stopPropagation(); openLyricsHandler(song.id); }} style={{ background: 'transparent', border: 'none', color: '#5a6670', cursor: 'pointer' }} title="Letras"><ScrollText size={18} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); openChordsHandler(song.id); }} style={{ background: 'transparent', border: 'none', color: '#5a6670', cursor: 'pointer' }} title="Cifrados"><Music size={18} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="card-premium" style={{ textAlign: 'center', padding: '72px 32px' }}>
                                        <div style={{ width: '72px', height: '72px', background: '#fef1ee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ed654c', margin: '0 auto 20px' }}><KeyRound size={34} /></div>
                                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '12px', color: '#1d2328' }}>
                                            {PAID_PLANS_ENABLED ? 'Acceso Exclusivo VIP' : 'Catálogo VIP — Próximamente'}
                                        </h2>
                                        <p style={{ color: '#5a6670', fontSize: '1rem', maxWidth: '520px', margin: '0 auto 28px', lineHeight: '1.6' }}>
                                            {PAID_PLANS_ENABLED
                                                ? 'El plan VIP incluye 300 GB en la nube y acceso a todos los multitracks de nuestra base de datos VIP.'
                                                : `Por ahora disfrutas de tu cuenta gratuita con ${FREE_LAUNCH_STORAGE_GB} GB en la nube para subir y mezclar tus propios multitracks en todos tus dispositivos. Muy pronto abriremos el acceso al catálogo VIP.`}
                                        </p>
                                        {PAID_PLANS_ENABLED && (
                                            <button onClick={() => setIsPricingModalOpen(true)} className="btn-teal" style={{ padding: '13px 30px', fontSize: '0.96rem', fontWeight: '800' }}>Ver Plan VIP</button>
                                        )}
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
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setIsSetlistModalOpen(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.65)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '440px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#1d2328', fontWeight: '800' }}>Crear Nuevo Setlist</h3>
                                <button onClick={() => setIsSetlistModalOpen(false)} style={{ background: '#f4f6f8', border: '1px solid #e3e8ec', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={18} /></button>
                            </div>

                            <div style={{ marginBottom: '22px' }}>
                                <label style={{ fontSize: '0.78rem', color: '#5a6670', display: 'block', marginBottom: '8px', fontWeight: '700' }}>NOMBRE DEL SETLIST</label>
                                <input
                                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', fontSize: '0.96rem', backgroundColor: '#ffffff', color: '#1d2328', border: '1px solid #d4dce2', borderRadius: '8px' }}
                                    placeholder="Ej. Servicio Domingo 15"
                                    value={newSetlistName}
                                    onChange={e => setNewSetlistName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
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
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setIsEditSetlistModalOpen(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '920px', height: '82vh', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', paddingBottom: '16px', borderBottom: '1px solid #e3e8ec' }}>
                                <div>
                                    <h2 style={{ margin: '0 0 4px', color: '#1d2328', fontSize: '1.45rem', fontWeight: '800' }}>{editingSetlistData.name}</h2>
                                    <p style={{ margin: 0, color: '#5a6670', fontSize: '0.9rem' }}>Editando canciones del setlist</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <button onClick={() => setIsEditSetlistModalOpen(false)} className="btn-teal" style={{ padding: '8px 18px', fontSize: '0.88rem', fontWeight: '700' }}>Listo</button>
                                    <button onClick={() => setIsEditSetlistModalOpen(false)} aria-label="Cerrar" style={{ background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '8px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={20} /></button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
                                {/* CURRENT SONGS */}
                                <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                                    <h4 style={{ margin: '0 0 12px', color: '#0f8c95', fontSize: '0.95rem', fontWeight: '800' }}>Canciones en el Setlist ({(editingSetlistData.songs || []).length})</h4>
                                    <div style={{ flex: 1, overflowY: 'auto', background: '#f4f6f8', padding: '12px', borderRadius: '10px', border: '1px solid #e3e8ec' }}>
                                        {(editingSetlistData.songs || []).map((s, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '11px 12px', background: '#ffffff', border: '1px solid #e3e8ec', borderRadius: '8px', marginBottom: '8px' }}>
                                                <div style={{ width: '28px', height: '28px', background: '#e7f8f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f8c95', fontSize: '0.8rem', fontWeight: '800', flexShrink: 0 }}>{idx + 1}</div>
                                                <div style={{ marginLeft: '12px', flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: '700', color: '#1d2328', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#5a6670', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.artist || '—'}</div>
                                                </div>
                                                <button onClick={() => handleRemoveSongFromSetlist(idx)} title="Quitar del setlist" style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '6px' }}><Trash2 size={17} /></button>
                                            </div>
                                        ))}
                                        {(editingSetlistData.songs || []).length === 0 && <p style={{ textAlign: 'center', color: '#5a6670', marginTop: '40px', fontSize: '0.9rem' }}>No hay canciones aún.</p>}
                                    </div>
                                </div>

                                {/* ADD SONGS LIBRARY */}
                                <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                                    <h4 style={{ margin: '0 0 12px', color: '#1d2328', fontSize: '0.95rem', fontWeight: '800' }}>Agregar desde Biblioteca</h4>
                                    <div style={{ marginBottom: '12px', position: 'relative' }}>
                                        <input
                                            type="text"
                                            style={{ width: '100%', textAlign: 'left', padding: '10px 38px 10px 14px', fontSize: '0.9rem', background: '#ffffff', color: '#1d2328', border: '1px solid #d4dce2', borderRadius: '8px' }}
                                            placeholder="Buscar en mis canciones..."
                                            value={songSearchQuery}
                                            onChange={e => setSongSearchQuery(e.target.value)}
                                        />
                                        <Search size={17} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: '#5a6670' }} />
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e3e8ec', borderRadius: '10px', background: '#ffffff' }}>
                                        {userSongs.filter(s =>
                                            s.name.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                            (s.artist || '').toLowerCase().includes(songSearchQuery.toLowerCase())
                                        ).map(song => {
                                            const isInSetlist = (editingSetlistData.songs || []).some(s => s.id === song.id);
                                            return (
                                                <div key={song.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #eef2f5', opacity: isInSetlist ? 0.55 : 1 }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1d2328', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</div>
                                                        <div style={{ fontSize: '0.76rem', color: '#5a6670' }}>{song.artist || '—'}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddSongToSetlist(song)}
                                                        disabled={isInSetlist}
                                                        style={{ background: isInSetlist ? '#e7f8f9' : '#17bcc7', color: isInSetlist ? '#0f8c95' : '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isInSetlist ? 'default' : 'pointer', flexShrink: 0 }}
                                                    >
                                                        {isInSetlist ? <CheckIcon size={15} /> : <Plus size={16} />}
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
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !isInitialPlanSelection) setIsPricingModalOpen(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.7)', backdropFilter: 'blur(4px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '880px', maxHeight: '94vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '26px' }}>
                                <div>
                                    <h2 style={{ margin: '0 0 4px', fontSize: '1.65rem', color: '#1d2328', fontWeight: '800' }}>Planes globales Zion Stage</h2>
                                    <p style={{ margin: 0, color: '#5a6670', fontSize: '0.96rem' }}>Una sola cuenta para Web, iOS, Android y Windows</p>
                                </div>
                                {!isInitialPlanSelection && (
                                    <button onClick={() => setIsPricingModalOpen(false)} aria-label="Cerrar" style={{ background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '8px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={20} /></button>
                                )}
                            </div>

                            {pendingPaymentPlan ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Estás adquiriendo: <span style={{ color: pendingPaymentPlan.isVIP ? '#f1c40f' : '#00d2d3' }}>Plan {pendingPaymentPlan.name} ({isAnnual ? 'Anual' : 'Mensual'})</span></h3>
                                    
                                    {/* Casilla de cupón y estado de descuento en Dashboard */}
                                    <div style={{
                                        maxWidth: '400px',
                                        margin: '0 auto 20px',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        border: (dashboardPromoApplied || dashboardCouponInput.trim().toUpperCase() === 'ZION99') ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.15)',
                                        textAlign: 'left',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700 }}>Código de Cupón de Descuento:</span>
                                            {(dashboardPromoApplied || dashboardCouponInput.trim().toUpperCase() === 'ZION99') && (
                                                <span style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 800, background: 'rgba(34,197,94,0.2)', padding: '3px 10px', borderRadius: '50px' }}>
                                                    {dashboardPromoApplied ? '✓ Oferta $0.99 Activa' : 'ZION99 Ingresado'}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={dashboardCouponInput}
                                                onChange={(e) => setDashboardCouponInput(e.target.value.toUpperCase())}
                                                placeholder="Ingresa tu cupón (ej: ZION99)"
                                                style={{
                                                    flex: 1,
                                                    background: '#0f172a',
                                                    border: '1px solid #eab308',
                                                    borderRadius: '8px',
                                                    padding: '9px 12px',
                                                    color: '#fbbf24',
                                                    fontWeight: 800,
                                                    fontSize: '0.9rem',
                                                    letterSpacing: '0.05em',
                                                    textTransform: 'uppercase',
                                                }}
                                            />
                                            <button
                                                type="button"
                                                disabled={isProcessingStripe}
                                                onClick={() => handlePrepareStripePayment(pendingPaymentPlan, dashboardCouponInput)}
                                                style={{
                                                    background: 'linear-gradient(135deg, #eab308, #f59e0b)',
                                                    color: '#000',
                                                    border: 'none',
                                                    padding: '9px 14px',
                                                    borderRadius: '8px',
                                                    fontWeight: 800,
                                                    fontSize: '0.82rem',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {isProcessingStripe ? '...' : 'Aplicar'}
                                            </button>
                                        </div>
                                        {dashboardPromoApplied ? (
                                            <div style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 800, marginTop: '8px' }}>
                                                🎁 <s>${isAnnual ? pendingPaymentPlan.annualPrice : pendingPaymentPlan.price} USD</s> → <strong>$0.99 USD hoy (primer mes)</strong>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
                                                Ingresa <strong style={{ color: '#fbbf24' }}>ZION99</strong> y presiona Aplicar para activar tu 1er mes a $0.99 USD.
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                                        {stripeClientSecret && stripePromise ? (
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
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
                                        <div style={{ background: '#f4f6f8', padding: '4px', borderRadius: '30px', display: 'flex', gap: '4px', border: '1px solid #e3e8ec' }}>
                                            <button onClick={() => setIsAnnual(false)} style={{ padding: '8px 22px', borderRadius: '25px', border: 'none', background: !isAnnual ? '#162026' : 'transparent', color: !isAnnual ? '#ffffff' : '#5a6670', fontWeight: '700', cursor: 'pointer' }}>Mensual</button>
                                            <button onClick={() => setIsAnnual(true)} style={{ padding: '8px 22px', borderRadius: '25px', border: 'none', background: isAnnual ? '#162026' : 'transparent', color: isAnnual ? '#ffffff' : '#5a6670', fontWeight: '700', cursor: 'pointer' }}>Anual (-30%)</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                        {/* PLAN ESTÁNDAR (50 GB) */}
                                        {STORAGE_PLANS.filter(p => p.id === 'std2').map(p => (
                                            <div key={p.id} style={{ padding: '26px', background: '#f8fafb', borderRadius: '12px', border: `2px solid ${userPlan?.id === p.id ? '#17bcc7' : '#e3e8ec'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '18px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0f8c95', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Global · Web, iOS, Android y Windows</div>
                                                    <div style={{ fontWeight: '800', fontSize: '1.35rem', color: '#1d2328' }}>Plan Estándar</div>
                                                    <div style={{ fontSize: '0.88rem', color: '#5a6670', marginTop: '6px' }}>Sube y mezcla tus propios multitracks en todos tus dispositivos.</div>
                                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        {isAnnual && <span style={{ fontSize: '0.92rem', color: '#94a3b8', textDecoration: 'line-through' }}>${p.originalAnnualPrice}</span>}
                                                        <span style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1d2328' }}>${isAnnual ? p.annualPrice : p.price}</span>
                                                        <span style={{ fontSize: '0.88rem', color: '#5a6670' }}>/{isAnnual ? 'año' : 'mes'}</span>
                                                    </div>
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#1d2328' }}>
                                                        <li>✓ 50 GB de almacenamiento en la nube</li>
                                                        <li>✓ Sube y usa tus propios multitracks</li>
                                                        <li>✓ Acceso en Web, iOS, Android y Windows</li>
                                                        <li style={{ color: '#94a3b8' }}>— Sin acceso a la base de datos VIP</li>
                                                    </ul>
                                                </div>
                                                {userPlan?.id === p.id && !isInitialPlanSelection ? (
                                                    <div style={{ textAlign: 'center', color: '#0f8c95', fontSize: '0.84rem', fontWeight: '800', padding: '11px', border: '1px solid #17bcc7', borderRadius: '8px', background: '#e7f8f9' }}>PLAN ACTUAL</div>
                                                ) : (
                                                    <button onClick={() => handlePrepareStripePayment(p)} style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: '800', background: '#162026', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Elegir Estándar</button>
                                                )}
                                            </div>
                                        ))}

                                        {/* PLAN VIP (300 GB + BASE DE DATOS VIP) */}
                                        {STORAGE_PLANS.filter(p => p.id === 'vip2').map(p => (
                                            <div key={p.id} style={{ padding: '26px', background: '#ffffff', borderRadius: '12px', border: '2px solid #17bcc7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '18px', boxShadow: '0 8px 24px rgba(23,188,199,0.12)' }}>
                                                <div>
                                                    <div style={{ display: 'inline-block', background: '#ed654c', color: 'white', fontSize: '0.68rem', fontWeight: '800', padding: '3px 9px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Más popular · Base de datos VIP</div>
                                                    <div style={{ fontWeight: '800', fontSize: '1.35rem', color: '#1d2328' }}>Plan VIP</div>
                                                    <div style={{ fontSize: '0.88rem', color: '#5a6670', marginTop: '6px' }}>300 GB para tus pistas más acceso a todos los multitracks de la base de datos VIP.</div>
                                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        {isAnnual && <span style={{ fontSize: '0.92rem', color: '#94a3b8', textDecoration: 'line-through' }}>${p.originalAnnualPrice}</span>}
                                                        <span style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1d2328' }}>${isAnnual ? p.annualPrice : p.price}</span>
                                                        <span style={{ fontSize: '0.88rem', color: '#5a6670' }}>/{isAnnual ? 'año' : 'mes'}</span>
                                                    </div>
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#1d2328' }}>
                                                        <li>✓ 300 GB de almacenamiento en la nube</li>
                                                        <li>✓ Uso de todos los multitracks de la base de datos VIP</li>
                                                        <li>✓ Sube y mezcla tus propios multitracks</li>
                                                        <li>✓ Acceso en Web, iOS, Android y Windows</li>
                                                    </ul>
                                                </div>
                                                {userPlan?.id === p.id && !isInitialPlanSelection ? (
                                                    <div style={{ textAlign: 'center', color: '#0f8c95', fontSize: '0.84rem', fontWeight: '800', padding: '11px', border: '1px solid #17bcc7', borderRadius: '8px', background: '#e7f8f9' }}>PLAN ACTUAL</div>
                                                ) : (
                                                    <button onClick={() => handlePrepareStripePayment(p)} className="btn-teal" style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: '800' }}>Elegir VIP</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {isInitialPlanSelection && (
                                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                            <button
                                                onClick={() => {
                                                    updateDoc(doc(db, 'users', currentUser.uid), { planId: 'free' });
                                                    localStorage.setItem(`mixer_seen_pricing_${currentUser.uid}`, 'true');
                                                    setIsInitialPlanSelection(false);
                                                    setIsPricingModalOpen(false);
                                                }}
                                                className="btn-ghost"
                                                style={{ fontSize: '0.85rem', padding: '8px 18px' }}
                                            >
                                                Continuar gratis por ahora (1 GB)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* MODAL PARA EDITAR LETRAS (UPLOAD) */}
            {
                isLyricsModalOpen && (
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setIsLyricsModalOpen(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '680px', position: 'relative' }}>
                            <button onClick={() => setIsLyricsModalOpen(false)} aria-label="Cerrar" style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={18} /></button>
                            <h2 style={{ marginBottom: '6px', color: '#1d2328' }}>Agregar Letra</h2>
                            <p style={{ color: '#5a6670', marginBottom: '18px', fontSize: '0.9rem' }}>Pega o escribe la letra de la canción aquí.</p>
                            <textarea
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                placeholder="Escribe la letra aquí..."
                                style={{ width: '100%', height: '340px', backgroundColor: '#f8fafb', border: '1px solid #d4dce2', borderRadius: '10px', color: '#1d2328', padding: '16px', fontSize: '0.96rem', fontFamily: 'monospace', resize: 'none', marginBottom: '18px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setIsPartituraModalOpen(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '660px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                            <button onClick={() => setIsPartituraModalOpen(false)} aria-label="Cerrar" style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={18} /></button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
                                <div style={{ width: '44px', height: '44px', background: '#e7f8f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17bcc7' }}>
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1d2328' }}>Partituras</h2>
                                    <p style={{ margin: 0, color: '#5a6670', fontSize: '0.85rem' }}>Sube archivos PDF por instrumento</p>
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
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setIsChordsModalOpen(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '680px', position: 'relative' }}>
                            <button onClick={() => setIsChordsModalOpen(false)} aria-label="Cerrar" style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={18} /></button>
                            <h2 style={{ marginBottom: '6px', color: '#1d2328' }}>Agregar Cifrado</h2>
                            <p style={{ color: '#5a6670', marginBottom: '18px', fontSize: '0.9rem' }}>Pega el cifrado o usa la importación inteligente.</p>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                <input
                                    value={importUrl}
                                    onChange={e => setImportUrl(e.target.value)}
                                    placeholder="URL de LaCuerda.net u otros..."
                                    style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #d4dce2', borderRadius: '8px', color: '#1d2328', padding: '11px 14px' }}
                                />
                                <button
                                    onClick={handleSmartImport}
                                    disabled={isScraping || !importUrl}
                                    className="btn-teal"
                                    style={{ padding: '0 18px', fontWeight: '700', opacity: (isScraping || !importUrl) ? 0.5 : 1 }}
                                >
                                    {isScraping ? 'Importando...' : 'Importar URL'}
                                </button>
                            </div>

                            <textarea
                                value={chords}
                                onChange={(e) => setChords(e.target.value)}
                                placeholder="Escribe o pega los acordes aquí..."
                                style={{ width: '100%', height: '300px', backgroundColor: '#f8fafb', border: '1px solid #d4dce2', borderRadius: '10px', color: '#1d2328', padding: '16px', fontSize: '0.96rem', fontFamily: 'monospace', resize: 'none', marginBottom: '18px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button onClick={() => { setIsChordsModalOpen(false); setEditingSongId(null); }} className="btn-ghost">Cancelar</button>
                                <button onClick={saveChordsHandler} className="btn-teal">Guardar Cifrado</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SUCCESS MODAL */}
            {
                isSuccessModalOpen && (
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) { setIsSuccessModalOpen(false); window.location.reload(); } }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '430px', textAlign: 'center', padding: '36px 28px' }}>
                            <div style={{ width: '68px', height: '68px', background: '#e7f8f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#17bcc7' }}>
                                <CheckIcon size={36} />
                            </div>
                            <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginBottom: '10px', color: '#1d2328' }}>¡Plan activado!</h2>
                            <p style={{ fontSize: '0.96rem', color: '#5a6670', lineHeight: '1.6', marginBottom: '24px' }}>
                                Tu cuenta ahora tiene activo el <strong style={{ color: '#0f8c95' }}>Plan {successPlanName}</strong> en todos tus dispositivos.
                            </p>
                            <button onClick={() => { setIsSuccessModalOpen(false); window.location.reload(); }} className="btn-teal" style={{ width: '100%', padding: '13px', fontSize: '0.96rem', fontWeight: '700' }}>
                                Continuar al Dashboard
                            </button>
                        </div>
                    </div>
                )
            }

            {/* ERROR MODAL (FOR UPLOADS) */}
            {
                showErrorModal && (
                    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setShowErrorModal(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div className="card-premium" style={{ width: '100%', maxWidth: '430px', textAlign: 'center', padding: '34px 28px' }}>
                            <div style={{ width: '64px', height: '64px', background: '#fef1ee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: '#ed654c' }}>
                                <HelpCircle size={32} />
                            </div>
                            <h2 style={{ fontSize: '1.45rem', fontWeight: '800', marginBottom: '10px', color: '#1d2328' }}>No se pudo subir</h2>
                            <p style={{ fontSize: '0.94rem', color: '#5a6670', lineHeight: '1.55', marginBottom: '22px' }}>
                                {uploadError}
                            </p>
                            <button onClick={() => setShowErrorModal(false)} style={{ width: '100%', padding: '12px', fontSize: '0.94rem', fontWeight: '700', background: '#ed654c', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                Entendido
                            </button>
                        </div>
                    </div>
                )
            }
            {/* MODAL DE AYUDA DE SUBIDA */}
            {showUploadHelp && (
                <div onMouseDown={(e) => { if (e.target === e.currentTarget) setShowUploadHelp(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,23,27,0.68)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card-premium" style={{ width: '100%', maxWidth: '640px', position: 'relative' }}>
                        <button onClick={() => setShowUploadHelp(false)} aria-label="Cerrar" style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f6f8', border: '1px solid #d4dce2', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d2328', cursor: 'pointer' }}><X size={18} /></button>
                        
                        <div style={{ marginBottom: '22px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 6px', color: '#1d2328' }}>¿Cómo subir un Multitrack?</h2>
                            <p style={{ color: '#5a6670', margin: 0, fontSize: '0.94rem' }}>Sigue estos pasos para subir tus secuencias en segundos.</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ background: '#f4f6f8', padding: '16px', borderRadius: '10px', border: '1px solid #e3e8ec' }}>
                                <h4 style={{ margin: '0 0 6px', color: '#0f8c95', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}><CheckIcon size={17} /> Pistas directas o archivo .ZIP</h4>
                                <p style={{ margin: 0, color: '#5a6670', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                    Puedes seleccionar varias pistas individuales (<strong>MP3, WAV, M4A</strong>) directamente o subir un archivo <strong>.ZIP</strong> con todas las pistas.
                                </p>
                            </div>

                            <div style={{ background: '#f4f6f8', padding: '16px', borderRadius: '10px', border: '1px solid #e3e8ec' }}>
                                <h4 style={{ margin: '0 0 6px', color: '#1d2328', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}><TrendingUp size={17} color="#17bcc7" /> Auto-completado por nombre</h4>
                                <p style={{ margin: '0 0 10px', color: '#5a6670', fontSize: '0.9rem' }}>Si subes un .ZIP con este nombre, los datos se llenan automáticamente:</p>
                                <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.86rem', color: '#0f8c95', border: '1px solid #d4dce2' }}>
                                    Hosanna - Marco Barrientos - E - 130BPM.zip
                                </div>
                            </div>

                            <div style={{ background: '#f4f6f8', padding: '16px', borderRadius: '10px', border: '1px solid #e3e8ec' }}>
                                <h4 style={{ margin: '0 0 6px', color: '#1d2328', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}><Info size={17} color="#17bcc7" /> Consejos rápidos</h4>
                                <ul style={{ margin: 0, paddingLeft: '18px', color: '#5a6670', fontSize: '0.88rem', lineHeight: '1.6' }}>
                                    <li>Nombra cada pista con el instrumento (ej: Piano.wav, Bajo.mp3, Click.mp3).</li>
                                    <li>Las pistas llamadas <strong>Click</strong> o <strong>Guía</strong> se rutean automáticamente para monitoreo.</li>
                                </ul>
                            </div>
                        </div>

                        <button onClick={() => setShowUploadHelp(false)} className="btn-teal" style={{ width: '100%', marginTop: '20px', padding: '12px', fontSize: '0.95rem', fontWeight: '700' }}>
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE BIENVENIDA / REGALO DE GOOGLE PLAY */}
            {/* Promo modal removed — no free plans */}
        </div >
    );
}

export default Dashboard;
