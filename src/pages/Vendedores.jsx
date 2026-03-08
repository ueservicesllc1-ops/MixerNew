import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from '../firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    addDoc, getDocs, serverTimestamp, setDoc
} from 'firebase/firestore';
import {
    LayoutDashboard, Package, DollarSign, TrendingUp, Users,
    Upload, Search, Filter, MoreVertical, ExternalLink,
    ChevronRight, ArrowLeft, CheckCircle2, AlertCircle, ShoppingBag,
    Wallet, BarChart3, PieChart, Music, Plus, X, ListMusic, Globe, Play,
    Loader2, Music2, Tag, Timer, KeyRound, ScrollText, User, Camera, ShieldCheck, Mail, Phone, CreditCard
} from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

// Common utility to detect native app
const isNativeApp = () => {
    return typeof window !== 'undefined' &&
        window.Capacitor?.isNativePlatform?.() === true
}

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

export default function Vendedores() {
    const navigate = useNavigate();
    const fileInputRef = useRef();
    const idPhotoInputRef = useRef();

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

    // Upload Wizard States
    const [step, setStep] = useState('idle'); // idle, details, uploading, done
    const [fileList, setFileList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [songKey, setSongKey] = useState('');
    const [tempo, setTempo] = useState('');
    const [timeSignature, setTimeSignature] = useState('');
    const [price, setPrice] = useState('9.99');

    // Stats & Products
    const [stats, setStats] = useState({
        totalSales: 0,
        revenue: 0,
        pendingBalance: 0,
        availableBalance: 0,
        salesCount: 0
    });
    const [myProducts, setMyProducts] = useState([]);

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserData(data);
                        setIsSeller(data.isSeller || false);
                        if (data.email && !regForm.email) {
                            setRegForm(prev => ({ ...prev, email: data.email }));
                        }
                    }
                    setLoading(false);
                });

                const q = query(
                    collection(db, 'songs'),
                    where('userId', '==', user.uid),
                    where('forSale', '==', true)
                );

                const unsubProducts = onSnapshot(q, (snap) => {
                    const products = [];
                    snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
                    setMyProducts(products.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
                });

                return () => {
                    unsubUser();
                    unsubProducts();
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

            const res = await fetch(`${devProxy}/upload`, { method: 'POST', body: formData });
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

    const handleCompleteRegistration = async (paypalData) => {
        if (!currentUser) return;
        setRegStep('verifying');
        try {
            await setDoc(doc(db, 'seller_applications', currentUser.uid), {
                ...regForm,
                userId: currentUser.uid,
                paypalSubscriptionId: paypalData.subscriptionID,
                status: 'pending_review',
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'users', currentUser.uid), {
                isSeller: true,
                sellerStatus: 'pending_review',
                sellerSince: serverTimestamp(),
                isVipSeller: true
            });

            setIsSeller(true);
        } catch (error) {
            console.error("Error finalizing seller registration:", error);
            alert("Hubo un error al procesar tu registro.");
        } finally {
            setRegStep('finished');
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
            for (const filename of Object.keys(contents.files)) {
                if (filename.endsWith('.wav') || filename.endsWith('.mp3')) {
                    const fileData = await contents.files[filename].async('blob');
                    let rawName = filename.split('/').pop().replace(/\.(wav|mp3)$/i, '');
                    extractedFiles.push({
                        originalName: filename,
                        displayName: rawName.replace(/[^a-zA-Z0-9_-]/g, ''),
                        blob: fileData,
                        extension: filename.split('.').pop()
                    });
                }
            }
            if (extractedFiles.length === 0) throw new Error("No se encontraron archivos de audio en el ZIP.");
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
        try {
            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            for (let i = 0; i < fileList.length; i++) {
                const track = fileList[i];
                const formData = new FormData();
                formData.append('audioFile', track.blob);
                const b2Filename = `sell_${currentUser.uid}_${Date.now()}_${songName.replace(/\s+/g, '_')}_${track.displayName.replace(/\s+/g, '_')}.mp3`;
                formData.append('fileName', b2Filename);

                const uploadRes = await fetch(`${devProxy}/upload`, { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error(`Fallo al subir pista ${track.displayName}`);

                const uploadData = await uploadRes.json();
                uploadedTracksInfo.push({
                    name: track.displayName,
                    url: uploadData.url,
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
                const res = await fetch(`${devProxy}/upload`, { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    uploadedTracksInfo.push({ name: '__PreviewMix', url: data.url, b2FileId: data.fileId, isWaveformSource: true, sizeMB: (mixBlob.size / 1024 / 1024).toFixed(2) });
                }
            }

            await addDoc(collection(db, 'songs'), {
                name: songName,
                artist: artist || userData?.displayName || 'Vendedor',
                key: songKey,
                tempo,
                timeSignature,
                price: parseFloat(price) || 0,
                forSale: true,
                status: 'pending_review',
                userId: currentUser.uid,
                userEmail: currentUser.email,
                tracks: uploadedTracksInfo,
                createdAt: serverTimestamp(),
                isGlobal: true
            });

            setStep('done');
            setTimeout(() => { resetWizard(); setActiveTab('products'); }, 2000);
        } catch (e) {
            console.error("Upload Error:", e);
            alert("Error: " + e.message);
            setStep('details');
        } finally {
            setIsUploading(false);
        }
    };

    const resetWizard = () => {
        setStep('idle'); setFileList([]); setSongName(''); setArtist('');
        setSongKey(''); setTempo(''); setTimeSignature(''); setPrice('9.99');
    };

    const initialOptions = {
        "client-id": "AZe-8u1_PHR_J1-XPHRjL4U10placeholder",
        "intent": "subscription",
        "vault": true
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
            <PayPalScriptProvider options={initialOptions}>
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
                                        <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={regForm.firstName} onChange={e => setRegForm({ ...regForm, firstName: e.target.value })} />
                                    </div>
                                    <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>APELLIDO</label>
                                        <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={regForm.lastName} onChange={e => setRegForm({ ...regForm, lastName: e.target.value })} />
                                    </div>
                                    <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>TELÉFONO</label>
                                        <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                                    </div>
                                    <div><label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>NÚMERO DE CÉDULA / ID</label>
                                        <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={regForm.cedula} onChange={e => setRegForm({ ...regForm, cedula: e.target.value })} />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>EMAIL DE CONTACTO</label>
                                        <input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '40px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '12px' }}>FOTO DE TU IDENTIFICACIÓN (Cédula/DNI)</label>
                                    <div onClick={() => idPhotoInputRef.current.click()} style={{ border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '30px', textAlign: 'center', cursor: 'pointer', background: regForm.idPhotoUrl ? '#f0fdf4' : '#f8fafc' }}>
                                        {isUploadingPhoto ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : (
                                            regForm.idPhotoUrl ? <div style={{ color: '#10b981' }}><CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} /> Foto cargada correctamente</div> :
                                                <div><Camera size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} /> Haz clic para subir foto del documento</div>
                                        )}
                                    </div>
                                    <input ref={idPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIdPhotoUpload} />
                                </div>

                                <button
                                    disabled={!regForm.firstName || !regForm.idPhotoUrl}
                                    onClick={() => setRegStep('payment')}
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
                                    <PayPalButtons
                                        style={{ layout: "vertical", shape: "pill" }}
                                        createSubscription={(data, actions) => {
                                            return actions.subscription.create({
                                                plan_id: 'P-SELLER_PROMO_PLAN'
                                            });
                                        }}
                                        onApprove={(data, actions) => handleCompleteRegistration(data)}
                                        onError={(err) => alert("Error en el pago: " + err.message)}
                                    />
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
                                <div style={{ color: '#10b981', marginBottom: '24px' }}><CheckCircle2 size={72} style={{ margin: '0 auto' }} /></div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '12px' }}>¡Registro Completo!</h3>
                                <p style={{ color: '#64748b', marginBottom: '32px' }}>Tu cuenta de vendedor ha sido activada y tus documentos están en revisión.</p>
                                <button onClick={() => window.location.reload()} className="btn-teal" style={{ padding: '14px 40px' }}>Ir a mi Dashboard de Ventas</button>
                            </div>
                        )}
                    </div>
                </div>
            </PayPalScriptProvider>
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
                            </div>
                            <button onClick={() => fileInputRef.current.click()} className="btn-teal" style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Upload size={20} /> SUBIR PARA VENDER
                            </button>
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

                        {step === 'details' && (
                            <div className="card-premium" style={{ background: 'white', padding: '40px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>NOMBRE DE LA CANCIÓN</label><input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={songName} onChange={e => setSongName(e.target.value)} /></div>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>ARTISTA</label><input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={artist} onChange={e => setArtist(e.target.value)} /></div>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>KEY (Tono)</label><input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={songKey} onChange={e => setSongKey(e.target.value)} /></div>
                                    <div><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>TEMPO (BPM)</label><input className="btn-ghost" style={{ width: '100%', background: '#f8fafc', textAlign: 'left' }} value={tempo} onChange={e => setTempo(e.target.value)} /></div>
                                    <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#00bcd4', display: 'block', marginBottom: '8px' }}>PRECIO DE VENTA (USD)</label><input type="number" step="0.01" className="btn-ghost" style={{ width: '100%', background: '#f8fafc', fontWeight: '900', fontSize: '1.2rem', color: '#00bcd4', textAlign: 'left' }} value={price} onChange={e => setPrice(e.target.value)} /></div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button onClick={resetWizard} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                    <button onClick={uploadToB2} className="btn-teal" style={{ flex: 2 }}>PUBLICAR PARA VENTA</button>
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
                                <div style={{ color: '#10b981', marginBottom: '24px' }}><CheckCircle2 size={72} style={{ margin: '0 auto' }} /></div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '12px' }}>¡Producto en Revisión!</h3>
                                <p style={{ color: '#64748b' }}>Tu pista ha sido cargada con éxito. Será visible globalmente una vez aprobada.</p>
                                <button onClick={resetWizard} className="btn-teal" style={{ marginTop: '24px', padding: '12px 32px' }}>Volver al Panel</button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
