import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from '../firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    addDoc, serverTimestamp, setDoc, getDocs, deleteDoc
} from 'firebase/firestore';
import {
    LayoutDashboard, Package, TrendingUp,
    Upload, Loader2, Music, Timer, Camera, ShieldCheck, CreditCard,
    AlertCircle, ArrowLeft, Wallet, Star, ShoppingBag, CheckCircle2 as CheckIcon,
    FileText, Trash2
} from 'lucide-react';

// Usando clave LIVE de Stripe 
const stripePromise = loadStripe('pk_live_51S37NBId1DsVBhR7DBfuwJHCjLo2KzUWPxEKew3JdyI5ypBwgt420B9pXM6qQuHRscOLyNeLjxumZHwVfWdZsMQp003Gc0ne2Y');

const StripeCheckoutForm = ({ onPaymentSuccess }) => {
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
            <h4 style={{ color: '#0f172a', marginBottom: '10px', fontWeight: '800', textAlign: 'center', fontSize: '1rem' }}>Suscripción Vendedor</h4>
            <PaymentElement options={{ layout: 'accordion' }} />
            <button disabled={!stripe || isProcessing} className="btn-teal" style={{ width: '100%', padding: '12px', marginTop: '15px', fontSize: '1rem' }}>
                {isProcessing ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : 'Pagar $1.99 Ahora'}
            </button>
        </form>
    );
};


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

function Vendedores() {
    const navigate = useNavigate();
    const fileInputRef = useRef();
    const idPhotoInputRef = useRef();
    const coverInputRef = useRef();

    // Auth & Profile
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSeller, setIsSeller] = useState(false);

    // UI Navigation
    const [activeTab, setActiveTab] = useState('overview');

    // Registration Flow States
    const [regStep, setRegStep] = useState('intro'); // intro, form, payment, verifying, finished
    const [regForm, setRegForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        cedula: '',
        idPhotoUrl: '',
        idPhotoFileId: ''
    });
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);


    // Stripe States
    const [stripeClientSecret, setStripeClientSecret] = useState('');
    const [subscriptionId, setSubscriptionId] = useState('');
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

    // Upload Wizard States
    const [step, setStep] = useState('idle'); // idle, details, uploading, done
    const [fileList, setFileList] = useState([]);
    const [, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [songKey, setSongKey] = useState('');
    const [tempo, setTempo] = useState('');
    const [timeSignature, setTimeSignature] = useState('4/4');
    const [price, setPrice] = useState('9.99');
    const [coverUrl, setCoverUrl] = useState('');
    const [coverFileId, setCoverFileId] = useState('');
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [stats] = useState({
        totalSales: 0,
        revenue: 0,
        pendingBalance: 0,
        availableBalance: 0,
        salesCount: 0
    });

    // Stats & Products
    const [myProducts, setMyProducts] = useState([]);

    // ── PARTITURAS VENTA STATES ─────────────────────────────────────
    const [myPartiturasVenta, setMyPartiturasVenta] = useState([]);
    const [pvTitle, setPvTitle] = useState('');
    const [pvInstrument, setPvInstrument] = useState('');
    const [pvLevel, setPvLevel] = useState('Básica');
    const [pvPrice, setPvPrice] = useState('2.99');
    const [pvFile, setPvFile] = useState(null);
    const [pvUploading, setPvUploading] = useState(false);
    const [pvRatingMap, setPvRatingMap] = useState({}); // partituraId -> {avg, count, userRating}
    const pvFileRef = useRef();

    const PV_INSTRUMENTS = [
        'Guitarra','Piano','Bajo','Batería','Violín','Acordeón',
        'Trompeta','Saxofón','Flauta','Teclado','Ukulele','Mandolina',
        'Cello','Contrabajo','Clarinete','Oboe','Coro','Voz'
    ];
    const PV_LEVELS = ['Básica','Media','Pro'];
    const PV_LEVEL_COLORS = { 'Básica': '#10b981', 'Media': '#f59e0b', 'Pro': '#ef4444' };

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserData(data);
                        setIsSeller(data.isSeller || false);
                        setRegForm(prev => prev.email ? prev : { ...prev, email: data.email || '' });
                    }
                    setLoading(false);
                });

                const q = query(
                    collection(db, 'songs'),
                    where('userId', '==', user.uid),
                    where('isGlobal', '==', true)
                );

                const unsubProducts = onSnapshot(q, (snap) => {
                    const products = [];
                    snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
                    setMyProducts(products.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
                });

                // Load my partituras for sale
                const qPv = query(collection(db, 'partituras_venta'), where('userId', '==', user.uid));
                const unsubPv = onSnapshot(qPv, async (snap) => {
                    const list = [];
                    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
                    list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setMyPartiturasVenta(list);
                    // Load ratings for each
                    const rmap = {};
                    await Promise.all(list.map(async (pv) => {
                        const rSnap = await getDocs(collection(db, 'partituras_venta', pv.id, 'ratings'));
                        let total = 0, count = 0, userRating = 0;
                        rSnap.forEach(r => {
                            total += r.data().stars || 0;
                            count++;
                            if (r.id === user.uid) userRating = r.data().stars;
                        });
                        rmap[pv.id] = { avg: count > 0 ? (total / count).toFixed(1) : null, count, userRating };
                    }));
                    setPvRatingMap(rmap);
                });

                return () => {
                    unsubUser();
                    unsubProducts();
                    unsubPv();
                };
            } else {
                setLoading(false);
            }
        });
        return () => unsubAuth();
    }, []);

    const handleIdPhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;
        setIsUploadingPhoto(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            const formData = new FormData();
            formData.append('audioFile', file);
            formData.append('fileName', `id_verify_${currentUser.uid}_${Date.now()}.${file.name.split('.').pop()}`);

            const res = await fetch(`${devProxy}/api/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) {
                setRegForm(prev => ({ ...prev, idPhotoUrl: data.url, idPhotoFileId: data.fileId }));
            }
        } catch (err) {
            alert("Error al subir foto: " + err.message);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;
        setIsUploadingCover(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            const formData = new FormData();
            formData.append('audioFile', file);
            formData.append('fileName', `cover_${currentUser.uid}_${Date.now()}.${file.name.split('.').pop()}`);

            const res = await fetch(`${devProxy}/api/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) {
                setCoverUrl(data.url);
                setCoverFileId(data.fileId);
            }
        } catch (err) {
            alert("Error al subir portada: " + err.message);
        } finally {
            setIsUploadingCover(false);
        }
    };

    const handleCompleteRegistration = async (stripeSubscriptionId) => {
        if (!currentUser) return;
        setRegStep('verifying');
        try {
            console.log("[REG] Finalizando registro para:", currentUser.uid);
            console.log("[REG] Formulario:", regForm);

            const applicationData = {
                ...regForm,
                userId: currentUser.uid,
                stripeSubscriptionId: stripeSubscriptionId,
                status: 'pending_review',
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, 'seller_applications', currentUser.uid), applicationData);
            console.log("[REG] Aplicación guardada en seller_applications");

            const userUpdate = {
                isSeller: true,
                sellerStatus: 'pending_review',
                sellerSince: serverTimestamp(),
                isVipSeller: true
            };

            await updateDoc(doc(db, 'users', currentUser.uid), userUpdate);
            console.log("[REG] Perfil de usuario actualizado");
            setStep('idle');
            setRegStep('finished');
            setIsSuccessModalOpen(true);
        } catch (error) {
            console.error("🚨 Error finalizing seller registration:", error);
            console.error("🚨 Error Code:", error.code);
            console.error("🚨 Error Msg:", error.message);
            alert("Hubo un error al procesar tu registro: " + (error.message || "Permisos insuficientes"));
        } finally {
            // setRegStep('finished'); // This line is removed as it's now handled in the try block
        }
    };

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const zip = new JSZip();
        try {
            const cleanName = file.name.replace(/\.zip$/i, '');
            const parts = cleanName.split('-').map(p => p.trim());
            if (parts.length >= 1) setSongName(parts[0]);
            if (parts.length >= 2) setArtist(parts[1]);
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

                extractedFiles.push({
                    originalName: filename,
                    displayName: finalDisplayName,
                    blob: fileData,
                    extension: filename.split('.').pop()
                });

            }
            if (extractedFiles.length === 0) throw new Error("No se encontraron archivos de audio en el ZIP.");
            setFileList(extractedFiles);
            setStep('review-tracks'); // Nuevo paso intermedio
        } catch (err) { alert('Error: ' + err.message); }
    };

    const uploadToB2 = async () => {
        if (!songName.trim()) return alert('Nombre requerido');
        if (!coverUrl) return alert('La portada es obligatoria para publicar una canción.');
        if (!currentUser) return;
        
        setIsUploading(true);
        setStep('uploading');
        const uploadedTracksInfo = [];
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            for (let i = 0; i < fileList.length; i++) {
                const track = fileList[i];
                const formData = new FormData();
                formData.append('audioFile', track.blob);
                const b2Filename = `sell_${currentUser.uid}_${Date.now()}_${songName.replace(/\s+/g, '_')}_${track.displayName.replace(/\s+/g, '_')}.mp3`;
                formData.append('fileName', b2Filename);
                formData.append('generatePreview', 'true');

                const uploadRes = await fetch(`${devProxy}/api/upload`, { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error(`Fallo al subir pista ${track.displayName}`);

                const uploadData = await uploadRes.json();
                uploadedTracksInfo.push({
                    name: track.displayName,
                    url: uploadData.url,
                    previewUrl: uploadData.previewUrl || uploadData.url,
                    b2FileId: uploadData.fileId,
                    sizeMB: (track.blob.size / 1024 / 1024).toFixed(2)
                });
                setUploadProgress(Math.round(((i + 1) / (fileList.length + 1)) * 100));
            }

            const mixBlob = await generateMixBlob(fileList);
            if (mixBlob) {
                const formData = new FormData();
                formData.append('audioFile', mixBlob);
                const b2Filename = `sell_${currentUser.uid}_${Date.now()}_${songName.replace(/\s+/g, '_')}__PreviewMix.mp3`;
                formData.append('fileName', b2Filename);
                formData.append('generatePreview', 'true');
                const res = await fetch(`${devProxy}/api/upload`, { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    uploadedTracksInfo.push({
                        name: '__PreviewMix',
                        url: data.url,
                        previewUrl: data.previewUrl,
                        b2FileId: data.fileId,
                        isWaveformSource: true,
                        sizeMB: (mixBlob.size / 1024 / 1024).toFixed(2)
                    });
                }
            }

            await addDoc(collection(db, 'songs'), {
                name: songName,
                artist: artist || userData?.displayName || 'Vendedor',
                sellerName: (userData?.firstName || userData?.lastName) 
                    ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() 
                    : (userData?.displayName || artist || currentUser?.displayName || 'Vendedor Zion'),
                key: songKey,
                tempo,
                timeSignature,
                price: (myProducts.length > 0 && (myProducts.length + 1) % 11 === 0) ? 0 : (parseFloat(price) || 0),
                forSale: true, // Siempre para venta o colección pública
                status: 'active',
                userId: currentUser.uid,
                userEmail: currentUser.email,
                tracks: uploadedTracksInfo,
                coverUrl: coverUrl,
                coverFileId: coverFileId,
                createdAt: serverTimestamp(),
                isGlobal: true,
                isFreeCommunity: ((myProducts.length + 1) % 11 === 0)
            });

            setStep('done');
            setTimeout(() => { resetWizard(); setActiveTab('products'); }, 2000);
        } catch (e) {
            console.error("Upload Error:", e);
            alert("Error: " + e.message);
            setStep('details');
        }
    };

    const handleGoToPayment = async () => {
        setRegStep('payment');
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            const res = await fetch(`${devProxy}/api/stripe/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: regForm.email,
                    name: `${regForm.firstName} ${regForm.lastName}`,
                    userId: currentUser?.uid
                })
            });
            const data = await res.json();
            if (data.clientSecret) {
                setStripeClientSecret(data.clientSecret);
                setSubscriptionId(data.subscriptionId);
            } else {
                throw new Error(data.error || "Error al crear suscripción");
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const resetWizard = () => {
        setStep('idle'); setFileList([]); setSongName(''); setArtist('');
        setSongKey(''); setTempo(''); setTimeSignature('4/4'); setPrice('9.99');
        setCoverUrl(''); setCoverFileId('');
    };

    const handlePvUpload = async () => {
        if (!pvFile || !pvInstrument || !pvTitle || !currentUser) return;
        setPvUploading(true);
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';
            const formData = new FormData();
            formData.append('audioFile', pvFile);
            formData.append('fileName', `partitura_venta_${currentUser.uid}_${Date.now()}_${pvInstrument.replace(/\s+/g,'_')}.pdf`);
            const res = await fetch(`${devProxy}/api/upload`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Error subiendo PDF');
            const data = await res.json();
            await addDoc(collection(db, 'partituras_venta'), {
                userId: currentUser.uid,
                sellerName: userData?.displayName || 'Vendedor',
                title: pvTitle,
                instrument: pvInstrument,
                level: pvLevel,
                price: parseFloat(pvPrice) || 0,
                pdfUrl: data.url || '',
                status: 'active',
                createdAt: serverTimestamp()
            });
            setPvTitle(''); setPvInstrument(''); setPvLevel('Básica'); setPvPrice('2.99'); setPvFile(null);
            alert('✅ ¡Partitura publicada para venta!');
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setPvUploading(false);
        }
    };

    const handlePvRate = async (pvId, stars) => {
        if (!currentUser) return alert('Debes iniciar sesión para calificar.');
        try {
            await setDoc(doc(db, 'partituras_venta', pvId, 'ratings', currentUser.uid), {
                stars, userId: currentUser.uid, ratedAt: serverTimestamp()
            });
            // Update local state
            const rSnap = await getDocs(collection(db, 'partituras_venta', pvId, 'ratings'));
            let total = 0, count = 0;
            rSnap.forEach(r => { total += r.data().stars || 0; count++; });
            setPvRatingMap(prev => ({
                ...prev,
                [pvId]: { avg: count > 0 ? (total / count).toFixed(1) : null, count, userRating: stars }
            }));
        } catch (e) { console.error(e); }
    };

    const handlePvDelete = async (pvId) => {
        if (!window.confirm('¿Eliminar esta partitura de venta?')) return;
        try { await deleteDoc(doc(db, 'partituras_venta', pvId)); }
        catch (e) { alert('Error: ' + e.message); }
    };

    const StarRating = ({ pvId, readOnly }) => {
        const info = pvRatingMap[pvId] || {};
        const userRating = info.userRating || 0;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {[1,2,3,4,5].map(s => (
                    <span
                        key={s}
                        onClick={() => !readOnly && handlePvRate(pvId, s)}
                        style={{
                            cursor: readOnly ? 'default' : 'pointer',
                            color: s <= (readOnly ? parseFloat(info.avg || 0) : userRating) ? '#f59e0b' : '#cbd5e1',
                            fontSize: '1.1rem',
                            transition: 'color 0.15s'
                        }}
                    >★</span>
                ))}
                {info.avg && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '4px' }}>{info.avg} ({info.count})</span>}
            </div>
        );
    };


    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}><div className="loader"></div></div>;

    if (!currentUser) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px' }}>
                <div style={{ background: 'rgba(0,188,212,0.1)', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#00bcd4' }}><ShoppingBag size={40} /></div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 16px' }}>Área de Vendedores</h2>
                <p style={{ color: '#64748b', marginBottom: '32px' }}>Para empezar a vender tus pistas, primero debes iniciar sesión.</p>
                <button onClick={() => navigate('/dashboard')} className="btn-teal" style={{ width: '100%', padding: '14px' }}>Entrar al Dashboard</button>
            </div>
        </div>
    );

    if (!isSeller) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 20px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {regStep === 'intro' && (
                        <div style={{ textAlign: 'center' }}>
                            <span style={{ background: 'rgba(0,188,212,0.1)', color: '#00bcd4', padding: '6px 16px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Vende tu Música</span>
                            <h1 style={{ fontSize: '3rem', fontWeight: '900', margin: '20px 0', color: '#1e293b' }}>Monetiza tu Talento</h1>
                            <p style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px' }}>Únete a la mayor comunidad de multitracks y empieza a generar ingresos por cada venta.</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                                <div className="card-premium" style={{ background: 'white', padding: '30px', textAlign: 'left' }}>
                                    <ShieldCheck style={{ color: '#10b981', marginBottom: '15px' }} />
                                    <h4 style={{ fontWeight: '800' }}>Perfil Verificado</h4>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Seguridad total para ti y tus compradores.</p>
                                </div>
                                <div className="card-premium" style={{ background: 'white', padding: '30px', textAlign: 'left' }}>
                                    <CreditCard style={{ color: '#00bcd4', marginBottom: '15px' }} />
                                    <h4 style={{ fontWeight: '800' }}>Promoción Limitada</h4>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Sólo $1.99 los primeros 3 meses.</p>
                                </div>
                            </div>

                            <button onClick={() => setRegStep('form')} className="btn-teal" style={{ padding: '16px 48px', fontSize: '1.1rem' }}>Comenzar Registro de Vendedor</button>
                        </div>
                    )}

                    {regStep === 'form' && (
                        <div className="card-premium" style={{ background: 'white', padding: '40px' }}>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '30px' }}>Datos del Vendedor</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>NOMBRE</label>
                                    <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', color: '#1e293b', textAlign: 'left' }} value={regForm.firstName} onChange={e => setRegForm({ ...regForm, firstName: e.target.value })} />
                                </div>
                                <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>APELLIDO</label>
                                    <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', color: '#1e293b', textAlign: 'left' }} value={regForm.lastName} onChange={e => setRegForm({ ...regForm, lastName: e.target.value })} />
                                </div>
                                <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>TELÉFONO</label>
                                    <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', color: '#1e293b', textAlign: 'left' }} value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                                </div>
                                <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>NÚMERO DE CÉDULA / ID</label>
                                    <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', color: '#1e293b', textAlign: 'left' }} value={regForm.cedula} onChange={e => setRegForm({ ...regForm, cedula: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>EMAIL DE CONTACTO</label>
                                    <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', color: '#1e293b', textAlign: 'left' }} value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '40px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '12px' }}>FOTO DE TU IDENTIFICACIÓN (Cédula/DNI)</label>
                                <div onClick={() => idPhotoInputRef.current.click()} style={{ border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '30px', textAlign: 'center', cursor: 'pointer', background: regForm.idPhotoUrl ? '#f0fdf4' : '#f8fafc' }}>
                                    {isUploadingPhoto ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : (
                                        regForm.idPhotoUrl ? <div style={{ color: '#10b981' }}><CheckIcon size={32} style={{ margin: '0 auto 8px' }} /> Foto cargada correctamente</div> :
                                            <div><Camera size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} /> Haz clic para subir foto del documento</div>
                                    )}
                                </div>
                                <input ref={idPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIdPhotoUpload} />
                            </div>

                            <button
                                disabled={!regForm.firstName || !regForm.idPhotoUrl}
                                onClick={handleGoToPayment}
                                className="btn-teal" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: (!regForm.firstName || !regForm.idPhotoUrl) ? 0.5 : 1 }}
                            >
                                Siguiente: Suscripción y Pago
                            </button>
                        </div>
                    )}

                    {regStep === 'payment' && (
                        <div className="card-premium" style={{ background: 'white', padding: '40px', textAlign: 'center' }}>
                            <div style={{ color: '#00bcd4', marginBottom: '20px' }}><CreditCard size={48} style={{ margin: '0 auto' }} /></div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '10px' }}>Suscripción de Vendedor</h2>
                            <p style={{ color: '#64748b', marginBottom: '30px' }}>Activa tu cuenta con la promoción especial.</p>

                            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '24px', marginBottom: '40px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: '700' }}>
                                    <span>Promo 3 Meses</span>
                                    <span style={{ color: '#10b981' }}>$1.99 / mes</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#64748b' }}>
                                    <span>Luego de 3 meses</span>
                                    <span>$9.99 / mes</span>
                                </div>
                            </div>

                            <div style={{ margin: '0 auto 30px', maxWidth: '400px' }}>
                                {stripeClientSecret ? (
                                    <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                                        <StripeCheckoutForm
                                            clientSecret={stripeClientSecret}
                                            onPaymentSuccess={() => handleCompleteRegistration(subscriptionId)}
                                        />
                                    </Elements>
                                ) : (
                                    <div style={{ padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#00bcd4' }} /></div>
                                )}
                            </div>

                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '16px', borderRadius: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#92400e' }}>
                                <strong>Disclaimer Importante:</strong> Una vez verificados los documentos y datos, si estos no son reales o son fraudulentos, se podrá dar de baja la cuenta de vendedor sin derecho a devolución de la suscripción pagada.
                            </div>
                        </div>
                    )}

                    {regStep === 'verifying' && (
                        <div className="card-premium" style={{ background: 'white', padding: '60px', textAlign: 'center' }}>
                            <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto 24px', color: '#00bcd4' }} />
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Finalizando registro...</h3>
                        </div>
                    )}

                    {regStep === 'finished' && (
                        <div className="card-premium" style={{ background: 'white', padding: '60px', textAlign: 'center' }}>
                            <div style={{ color: '#10b981', marginBottom: '24px' }}><CheckIcon size={72} style={{ margin: '0 auto' }} /></div>
                            <h3 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '12px' }}>¡Registro Completo!</h3>
                            <p style={{ color: '#64748b', marginBottom: '32px' }}>Tu cuenta de vendedor ha sido activada y tus documentos están en revisión.</p>
                            <button onClick={() => window.location.reload()} className="btn-teal" style={{ padding: '14px 40px' }}>Ir a mi Dashboard de Ventas</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex' }}>
            <aside style={{ width: '280px', background: '#020617', color: 'white', padding: '30px 20px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
                <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', cursor: 'pointer' }}>
                    <div style={{ background: '#00bcd4', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={18} /></div>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>SELLERS</span>
                </div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {[
                        { id: 'overview', label: 'Resumen', icon: <LayoutDashboard size={20} /> },
                        { id: 'products', label: 'Mis Canciones', icon: <Package size={20} /> },
                        { id: 'partituras', label: 'Partituras', icon: <FileText size={20} /> },
                        { id: 'sales', label: 'Reporte de Ventas', icon: <TrendingUp size={20} /> },
                        { id: 'wallet', label: 'Billetera', icon: <Wallet size={20} /> },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStep('idle'); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: 'none', background: activeTab === tab.id ? 'rgba(0,188,212,0.1)' : 'transparent', color: activeTab === tab.id ? '#00bcd4' : '#94a3b8', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', transition: '0.2s' }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </nav>
                <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => navigate('/dashboard')} className="btn-ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <ArrowLeft size={16} /> Volver al User Hub
                    </button>
                    <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px' }}>
                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#00bcd4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900' }}>{userData?.displayName?.[0]?.toUpperCase()}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>{userData?.displayName || 'Vendedor'}</div>
                    </div>
                </div>
            </aside>

            <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                {userData?.sellerStatus === 'pending_review' && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '20px', borderRadius: '24px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px', color: '#92400e' }}>
                        <AlertCircle />
                        <div>
                            <div style={{ fontWeight: '800' }}>Cuenta en Revisión</div>
                            <div style={{ fontSize: '0.9rem' }}>Estamos verificando tus documentos. Puedes subir canciones, pero no serán visibles en el Marketplace hasta que seas aprobado.</div>
                        </div>
                    </div>
                )}

                {step === 'idle' ? (
                    <>
                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                            <div>
                                <h2 style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b' }}>Bienvenido, {userData?.displayName}</h2>
                                <p style={{ color: '#64748b' }}>Aquí tienes el reporte de tus pistas para la venta.</p>
                                <div style={{ 
                                    background: 'rgba(0,188,212,0.05)', 
                                    borderLeft: '4px solid #00bcd4', 
                                    padding: '12px 20px', 
                                    borderRadius: '12px', 
                                    marginTop: '15px',
                                    fontSize: '0.85rem'
                                }}>
                                    <span style={{ fontWeight: '800', color: '#00bcd4', display: 'block', marginBottom: '4px' }}>IMPORTANTE: FORMATO DEL ARCHIVO ZIP</span>
                                    <div style={{ color: '#334155' }}>Los archivos deben seguir este formato: <strong>NOMBRE - ARTISTA - NOTA - TEMPO</strong></div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>Ej: Celebra victorioso - Juan Carlos Alvarado - Am - 98BPM</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Upload size={20} /> {(myProducts.length % 11 === 0) ? 'REGALAR CANCIÓN' : 'SUBIR PARA VENDER'}
                                </button>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: (myProducts.length % 11 === 0) ? '#00bcd4' : '#64748b',
                                    background: (myProducts.length % 11 === 0) ? 'rgba(0,188,212,0.1)' : 'transparent',
                                    padding: '4px 10px',
                                    borderRadius: '50px'
                                }}>
                                    {(myProducts.length % 11 === 0) ? (
                                        <>🎁 Queremos bendecir a nuestra comunidad, por eso tu próxima subida es gratis</>
                                    ) : (
                                        <>📈 Próxima bendición gratuita en {11 - (myProducts.length % 11)} subidas</>
                                    )}
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />
                        </header>

                        {activeTab === 'overview' && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
                                    {[
                                        { label: 'Ventas Totales', value: `$${stats.totalSales}`, icon: <TrendingUp />, color: '#10b981' },
                                        { label: 'Canciones en Venta', value: myProducts.length, icon: <Package />, color: '#00bcd4' },
                                        { label: 'Saldo Pendiente', value: `$0.00`, icon: <Timer />, color: '#f59e0b' },
                                        { label: 'Balance Retirable', value: `$${stats.availableBalance}`, icon: <Wallet />, color: '#8b5cf6' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                            <div style={{ color: s.color, background: `${s.color}10`, width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>{s.icon}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '700', marginBottom: '4px' }}>{s.label}</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1e293b' }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '24px' }}>Tus Últimas Subidas</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {myProducts.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No has subido canciones todavía.</p> :
                                            myProducts.slice(0, 5).map(p => (
                                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <div style={{ background: '#00bcd420', color: '#00bcd4', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={20} /></div>
                                                        <div>
                                                            <div style={{ fontWeight: '800', color: '#1e293b' }}>{p.name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.artist} • {p.key}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: '900', color: '#00bcd4' }}>${p.price}</div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'partituras' && (
                            <div>
                                {/* Upload Form */}
                                <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                                        <div style={{ width: '46px', height: '46px', background: 'linear-gradient(135deg,#00bcd4,#9b59b6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={22} color="white" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontWeight: '900', color: '#1e293b' }}>Publicar Partitura para Venta</h3>
                                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Sube tu PDF y configura precio y nivel</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Título de la Partitura</label>
                                            <input className="btn-ghost" style={{ width: '100%', background: 'white', color: '#1e293b', border: '1px solid #cbd5e1', textAlign: 'left' }} value={pvTitle} onChange={e => setPvTitle(e.target.value)} placeholder="Ej: Mientras Viva - Cifrado Pro" />
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Instrumento</label>
                                            <select className="btn-ghost" style={{ width: '100%', background: 'white', color: '#1e293b', border: '1px solid #cbd5e1', padding: '12px' }} value={pvInstrument} onChange={e => setPvInstrument(e.target.value)}>
                                                <option value="">-- Selecciona --</option>
                                                {PV_INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Nivel</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {PV_LEVELS.map(lv => (
                                                    <button key={lv} onClick={() => setPvLevel(lv)} style={{
                                                        flex: 1, padding: '10px 6px', borderRadius: '10px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', border: pvLevel === lv ? `2px solid ${PV_LEVEL_COLORS[lv]}` : '2px solid #e2e8f0',
                                                        background: pvLevel === lv ? `${PV_LEVEL_COLORS[lv]}15` : 'white',
                                                        color: pvLevel === lv ? PV_LEVEL_COLORS[lv] : '#94a3b8', transition: 'all 0.15s'
                                                    }}>{lv}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#00bcd4', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Precio de Venta (USD)</label>
                                            <input type="number" step="0.01" min="0" className="btn-ghost" style={{ width: '100%', background: 'white', color: '#1e293b', border: '2px solid #00bcd430', textAlign: 'left', fontSize: '1.2rem', fontWeight: '900' }} value={pvPrice} onChange={e => setPvPrice(e.target.value)} />
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Archivo PDF</label>
                                            <div onClick={() => pvFileRef.current?.click()} style={{
                                                border: '2px dashed ' + (pvFile ? '#00bcd4' : '#e2e8f0'), borderRadius: '14px', padding: '24px', textAlign: 'center', cursor: 'pointer',
                                                background: pvFile ? 'rgba(0,188,212,0.03)' : '#f8fafc', transition: 'all 0.2s'
                                            }}>
                                                <FileText size={32} color={pvFile ? '#00bcd4' : '#94a3b8'} style={{ margin: '0 auto 8px' }} />
                                                {pvFile ? <div><div style={{ fontWeight: '700', color: '#00bcd4' }}>{pvFile.name}</div><div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{(pvFile.size/1024).toFixed(0)} KB</div></div>
                                                    : <div style={{ color: '#94a3b8', fontWeight: '600' }}>Haz clic para seleccionar un .pdf</div>}
                                            </div>
                                            <input ref={pvFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setPvFile(e.target.files[0] || null)} />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handlePvUpload}
                                        disabled={!pvFile || !pvInstrument || !pvTitle || pvUploading}
                                        className="btn-teal"
                                        style={{ width: '100%', padding: '14px', opacity: (!pvFile || !pvInstrument || !pvTitle || pvUploading) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', fontWeight: '800' }}
                                    >
                                        {pvUploading ? <><Loader2 size={18} className="animate-spin" /> Publicando...</> : <><Upload size={18} /> Publicar Partitura</>}
                                    </button>
                                </div>

                                {/* My Partituras List */}
                                <div style={{ background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                    <h3 style={{ fontWeight: '900', color: '#1e293b', marginBottom: '20px' }}>Mis Partituras en Venta ({myPartiturasVenta.length})</h3>
                                    {myPartiturasVenta.length === 0 ? (
                                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Aún no has publicado ninguna partitura.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            {myPartiturasVenta.map(pv => (
                                                    <div key={pv.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                                        <div style={{ width: '42px', height: '42px', background: `${PV_LEVEL_COLORS[pv.level] || '#00bcd4'}15`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PV_LEVEL_COLORS[pv.level] || '#00bcd4', flexShrink: 0 }}>
                                                            <FileText size={20} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pv.title}</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: PV_LEVEL_COLORS[pv.level], background: `${PV_LEVEL_COLORS[pv.level]}15`, padding: '2px 8px', borderRadius: '100px' }}>{pv.level}</span>
                                                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{pv.instrument}</span>
                                                                <StarRating pvId={pv.id} readOnly={true} />
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                            <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#00bcd4' }}>${parseFloat(pv.price || 0).toFixed(2)}</div>
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                                                <a href={pv.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#64748b', background: '#e2e8f0', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: '700' }}>Ver PDF</a>
                                                                <button onClick={() => handlePvDelete(pv.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'products' && (
                            <div style={{ background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            <th style={{ padding: '16px' }}>CANCIÓN</th>
                                            <th style={{ padding: '16px' }}>PRECIO</th>
                                            <th style={{ padding: '16px' }}>ESTADO</th>
                                            <th style={{ padding: '16px' }}>REPORTE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myProducts.map(p => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '16px', fontWeight: '800' }}>{p.name}</td>
                                                <td style={{ padding: '16px', fontWeight: '900' }}>${p.price}</td>
                                                <td style={{ padding: '16px' }}><span style={{ color: '#10b981', background: '#10b98115', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '800' }}>{p.status === 'pending_review' ? 'En Revisión' : 'Activa'}</span></td>
                                                <td style={{ padding: '16px' }}><button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '8px' }}>Ver detalles</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    /* Upload Wizard for Sellers */
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
                            <button onClick={resetWizard} className="btn-ghost" style={{ padding: '10px' }}><ArrowLeft size={20} /></button>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: '900' }}>Configurar Venta de Pista</h2>
                        </div>

                        {/* Banner de Condición de Vendedor */}
                        <div style={{
                            background: (myProducts.length % 11 === 0) ? 'rgba(0,188,212,0.1)' : 'rgba(25,118,210,0.05)',
                            border: `1px solid ${(myProducts.length % 11 === 0) ? '#00bcd4' : 'rgba(0,0,0,0.1)'}`,
                            padding: '20px',
                            borderRadius: '16px',
                            marginBottom: '30px',
                            display: 'flex',
                            gap: '15px',
                            alignItems: 'center'
                        }}>
                            <div style={{ fontSize: '2rem' }}>{(myProducts.length % 11 === 0) ? '🎁' : '📈'}</div>
                            <div>
                                <div style={{ fontWeight: '800', color: (myProducts.length % 11 === 0) ? '#00bcd4' : '#1e293b' }}>
                                    {(myProducts.length % 11 === 0) ? '🎁 ¡Es momento de bendecir!' : 'Próxima canción para la venta'}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.4' }}>
                                    {(myProducts.length % 11 === 0)
                                        ? (
                                            <>
                                                Sabemos de tu gran corazón y talento. Queremos bendecir a nuestra comunidad, por esa razón esta canción será un regalo especial para todos.
                                                <div style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.8 }}>Las siguientes canciones ya podrán ser publicadas para la venta.</div>
                                            </>
                                        )
                                        : `Has subido ${myProducts.length % 11} canciones para venta. Te faltan ${11 - (myProducts.length % 11)} para tu próxima contribución a la comunidad.`}
                                </div>
                            </div>
                        </div>
                        {step === 'review-tracks' && (
                            <div className="card-premium" style={{ background: 'white', padding: '40px' }}>
                                <h3 style={{ marginBottom: '24px', fontWeight: '900' }}>Revisar Nombres de Tracks</h3>
                                <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '0.9rem' }}>Asegúrate de que los tracks tengan nombres claros (Drum, Bass, Piano, etc.) para que se vean bien en el Mixer.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                                    {fileList.map((track, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ width: '40px', height: '40px', background: '#00bcd415', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00bcd4' }}>
                                                <Music size={20} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '800' }}>Nombre de la Pista</div>
                                                <input
                                                    className="btn-ghost"
                                                    style={{ width: '100%', textAlign: 'left', padding: '10px', boxSizing: 'border-box', border: '1px solid #cbd5e1', background: 'white', color: 'black' }}
                                                    value={track.displayName}
                                                    onChange={e => {
                                                        const newList = [...fileList];
                                                        newList[idx].displayName = e.target.value;
                                                        setFileList(newList);
                                                    }}
                                                />
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>
                                                .{track.extension}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button onClick={resetWizard} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                    <button onClick={() => setStep('details')} className="btn-teal" style={{ flex: 2 }}>Confirmar y Siguiente</button>
                                </div>
                            </div>
                        )}

                        {step === 'details' && (
                            <div className="card-premium" style={{ background: 'white', padding: '40px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>NOMBRE DE LA CANCIÓN</label><input className="btn-ghost" style={{ width: '100%', background: 'white', color: 'black', textAlign: 'left', border: '1px solid #cbd5e1' }} value={songName} onChange={e => setSongName(e.target.value)} /></div>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>ARTISTA</label><input className="btn-ghost" style={{ width: '100%', background: 'white', color: 'black', textAlign: 'left', border: '1px solid #cbd5e1' }} value={artist} onChange={e => setArtist(e.target.value)} /></div>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>KEY (Tono)</label><input className="btn-ghost" style={{ width: '100%', background: 'white', color: 'black', textAlign: 'left', border: '1px solid #cbd5e1' }} value={songKey} onChange={e => setSongKey(e.target.value)} /></div>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>TEMPO (BPM)</label><input className="btn-ghost" style={{ width: '100%', background: 'white', color: 'black', textAlign: 'left', border: '1px solid #cbd5e1' }} value={tempo} onChange={e => setTempo(e.target.value)} /></div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>COMPÁS (Time Signature)</label>
                                        <select
                                            className="btn-ghost"
                                            style={{ width: '100%', background: 'white', color: 'black', textAlign: 'left', padding: '12px', border: '1px solid #cbd5e1' }}
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
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: (myProducts.length % 11 === 0) ? '#94a3b8' : '#00bcd4', display: 'block', marginBottom: '8px' }}>
                                            PRECIO DE VENTA (USD) {(myProducts.length % 11 === 0) && '- BLOQUEADO GRATIS'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            disabled={(myProducts.length > 0 && (myProducts.length + 1) % 11 === 0)}
                                            className="btn-ghost"
                                            style={{
                                                width: '100%',
                                                background: (myProducts.length > 0 && (myProducts.length + 1) % 11 === 0) ? '#f1f5f9' : 'white',
                                                fontWeight: '900',
                                                fontSize: '1.2rem',
                                                color: (myProducts.length > 0 && (myProducts.length + 1) % 11 === 0) ? '#94a3b8' : 'black',
                                                textAlign: 'left',
                                                border: '1px solid #cbd5e1'
                                            }}
                                            value={(myProducts.length > 0 && (myProducts.length + 1) % 11 === 0) ? '0.00' : price}
                                            onChange={e => setPrice(e.target.value)}
                                        />
                                    </div>

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '12px' }}>PORTADA DE LA CANCIÓN (400x400 Recomendado)</label>
                                        <div onClick={() => coverInputRef.current.click()} style={{ border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: coverUrl ? '#f0fdf4' : '#f8fafc', overflow: 'hidden' }}>
                                            {isUploadingCover ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : (
                                                coverUrl ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <img src={coverUrl} alt="Cover" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px' }} />
                                                        <span style={{ color: '#10b981', fontSize: '0.8rem' }}>✓ Portada lista</span>
                                                    </div>
                                                ) : (
                                                    <div><Camera size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} /> Haz clic para subir imagen de portada</div>
                                                )
                                            )}
                                        </div>
                                        <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button onClick={resetWizard} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                    <button
                                        onClick={uploadToB2}
                                        disabled={isUploadingCover || !coverUrl}
                                        className="btn-teal"
                                        style={{ flex: 2, opacity: (isUploadingCover || !coverUrl) ? 0.5 : 1 }}
                                    >
                                        {isUploadingCover ? 'Subiendo portada...' : 'PUBLICAR PARA VENTA'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'uploading' && (
                            <div className="card-premium" style={{ background: 'white', padding: '60px', textAlign: 'center' }}>
                                <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto 40px' }}>
                                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#00bcd4" strokeWidth="6" strokeDasharray="283" strokeDashoffset={283 - (283 * uploadProgress) / 100} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                                    </svg>
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem', fontWeight: '900', color: '#1e293b' }}>{uploadProgress}%</div>
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px' }}>Subiendo Multitracks...</h3>
                                <p style={{ color: '#64748b' }}>Preparando archivos para el marketplace. No cierres esta pestaña.</p>
                            </div>
                        )}

                        {step === 'done' && (
                            <div className="card-premium" style={{ background: 'white', padding: '60px', textAlign: 'center' }}>
                                <div style={{ color: '#10b981', marginBottom: '24px' }}><CheckIcon size={72} style={{ margin: '0 auto' }} /></div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '12px' }}>¡Producto en Revisión!</h3>
                                <p style={{ color: '#64748b' }}>Tu pista ha sido cargada con éxito. Será visible globalmente una vez aprobada.</p>
                                <button onClick={resetWizard} className="btn-teal" style={{ marginTop: '24px', padding: '12px 32px' }}>Volver al Panel</button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* SUCCESS MODAL PREMIUM (VENDEDORES) */}
            {isSuccessModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(15px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card-premium" style={{ width: '100%', maxWidth: '450px', backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center', padding: '40px', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ position: 'absolute', top: '-20px', left: '-20px', color: 'rgba(0,188,212,0.05)' }}><CheckIcon size={200} /></div>

                        <div style={{ position: 'relative', zIndex: 1, color: '#1e293b' }}>
                            <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #00bcd4, #00acc1)', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px', boxShadow: '0 20px 40px rgba(0,188,212,0.3)', transform: 'rotate(-5deg)' }}>
                                <CheckIcon size={50} color="white" />
                            </div>

                            <h2 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '15px' }}>¡Bienvenido!</h2>
                            <p style={{ fontSize: '1.2rem', color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
                                Tu suscripción de <span style={{ color: '#00bcd4', fontWeight: '800' }}>Vendedor</span> ha sido activada correctamente.
                                Empieza a monetizar tu talento hoy mismo.
                            </p>

                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '35px', display: 'flex', alignItems: 'center', gap: '15px', textAlign: 'left' }}>
                                <div style={{ color: '#f1c40f' }}><Star size={24} /></div>
                                <div style={{ fontSize: '0.9rem', color: '#445164' }}>Tus documentos están en revisión, pero ya puedes ir preparando tu primera canción para la venta.</div>
                            </div>

                            <button
                                onClick={() => { setIsSuccessModalOpen(false); window.location.reload(); }}
                                className="btn-teal"
                                style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: '800', boxShadow: '0 10px 20px rgba(0,188,212,0.2)' }}
                            >
                                ¡Ir al Panel de Ventas!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Vendedores;
