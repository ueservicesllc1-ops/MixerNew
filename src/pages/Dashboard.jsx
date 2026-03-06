import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import {
    Upload, Music2, User, Tag, CheckCircle2,
    ChevronRight, ArrowLeft, Layers, Cloud,
    Loader2, Timer, KeyRound, ScrollText, X, Settings2
} from 'lucide-react';

const STORAGE_LIMIT_MB = 300;

export default function Dashboard() {
    const navigate = useNavigate();
    const fileInputRef = useRef();

    const [step, setStep] = useState('idle');
    const [useType, setUseType] = useState(null);
    const [fileList, setFileList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [songKey, setSongKey] = useState('');
    const [tempo, setTempo] = useState('');
    const [timeSignature, setTimeSignature] = useState('');
    const [lyrics, setLyrics] = useState('');

    const [editingLyricsSong, setEditingLyricsSong] = useState(null);
    const [tempLyrics, setTempLyrics] = useState('');

    const [editingSongInfo, setEditingSongInfo] = useState(null);

    const [userSongs, setUserSongs] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    const usedMB = userSongs.reduce((acc, s) =>
        acc + (s.tracks || []).reduce((a, t) => a + parseFloat(t.sizeMB || 0), 0), 0);
    const usedPercent = Math.min(100, (usedMB / STORAGE_LIMIT_MB) * 100);

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                const q = query(collection(db, 'songs'), where('userId', '==', user.uid));
                const unsub = onSnapshot(q, (snap) => {
                    const songs = [];
                    snap.forEach(doc => songs.push({ id: doc.id, ...doc.data() }));
                    songs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
                    setUserSongs(songs);
                });
                return () => unsub();
            } else {
                setUserSongs([]);
            }
        });
        return () => unsubAuth();
    }, []);

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const zip = new JSZip();
        try {
            const cleanName = file.name.replace(/\.zip$/i, '');
            const parts = cleanName.split('-').map(p => p.trim());
            if (parts.length >= 1) setSongName(parts[0]);
            if (parts.length >= 2) setArtist(parts[1]);

            // Try to extract Key, Tempo & TimeSignature from the remaining parts
            if (parts.length >= 3) {
                const combinedMetas = parts.slice(2).join(' ');

                // Regex for tempo e.g. "120 bpm" or "120bpm"
                const tempoMatch = combinedMetas.match(/(\d+)\s*bpm/i);
                if (tempoMatch) setTempo(tempoMatch[1]);

                // Regex for time signature e.g. "4/4" or "6/8"
                const tsMatch = combinedMetas.match(/(\d\/\d)/);
                if (tsMatch) setTimeSignature(tsMatch[1]);

                // Guess the Key by stripping the info we already recognized
                let keyStr = combinedMetas;
                if (tempoMatch) keyStr = keyStr.replace(tempoMatch[0], '');
                if (tsMatch) keyStr = keyStr.replace(tsMatch[0], '');

                setSongKey(keyStr.replace(/[^a-zA-Z#b]/g, '').trim());
            }

            const contents = await zip.loadAsync(file);
            const extractedFiles = [];
            for (const filename of Object.keys(contents.files)) {
                if (filename.endsWith('.wav') || filename.endsWith('.mp3')) {
                    const fileData = await contents.files[filename].async('blob');
                    extractedFiles.push({
                        originalName: filename,
                        displayName: filename.split('/').pop().replace(/\.(wav|mp3)$/, ''),
                        blob: fileData,
                        extension: filename.split('.').pop()
                    });
                }
            }
            setFileList(extractedFiles);
            setStep('choose-use');
        } catch (err) {
            alert('Error desencriptando el ZIP: ' + err.message);
        }
    };

    const handleNameChange = (index, newName) => {
        const updated = [...fileList];
        updated[index].displayName = newName;
        setFileList(updated);
    };

    const uploadToB2 = async () => {
        if (!songName.trim()) return alert('Por favor, ingresa un nombre para la canción.');
        if (!currentUser) return alert('Debes iniciar sesión para subir canciones.');
        setIsUploading(true);
        setStep('uploading');
        const uploadedTracksInfo = [];
        try {
            for (let i = 0; i < fileList.length; i++) {
                const track = fileList[i];
                const formData = new FormData();
                formData.append('audioFile', track.blob);
                const safeName = songName.replace(/[^a-zA-Z0-9]/g, '_');
                const safeTrackName = track.displayName.replace(/[^a-zA-Z0-9]/g, '_');
                const b2Filename = `audio_${currentUser.uid}_${Date.now()}_${safeName}_${safeTrackName}.${track.extension}`;
                formData.append('fileName', b2Filename);
                const currentProxy = localStorage.getItem('mixer_proxyUrl') || 'https://mixernew-production.up.railway.app';
                const uploadRes = await fetch(`${currentProxy}/upload`, { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error(`Falló subida del track ${track.displayName}`);
                const uploadData = await uploadRes.json();
                uploadedTracksInfo.push({
                    name: track.displayName,
                    originalName: track.originalName,
                    url: uploadData.url,
                    b2FileId: uploadData.fileId,
                    sizeMB: (track.blob.size / 1024 / 1024).toFixed(2)
                });
                setUploadProgress(Math.round(((i + 1) / fileList.length) * 100));
            }
            const songDoc = await addDoc(collection(db, 'songs'), {
                name: songName, artist, key: songKey, tempo, timeSignature, useType,
                userId: currentUser.uid, userEmail: currentUser.email,
                tracks: uploadedTracksInfo,
                createdAt: serverTimestamp(), isGlobal: false
            });

            if (lyrics && lyrics.trim()) {
                await addDoc(collection(db, 'lyrics'), {
                    songId: songDoc.id,
                    text: lyrics,
                    updatedAt: serverTimestamp()
                });
            }

            setStep('done');
            setTimeout(() => {
                setFileList([]); setSongName(''); setArtist(''); setSongKey(''); setTempo(''); setTimeSignature(''); setLyrics('');
                setUseType(null); setStep('idle'); setUploadProgress(0);
            }, 2500);
        } catch (error) {
            console.error('Error subiendo:', error);
            alert('Ocurrió un error subiendo los archivos. Revisa la consola.');
            setStep('details');
        } finally {
            setIsUploading(false);
        }
    };

    const resetWizard = () => {
        setStep('idle'); setFileList([]);
        setSongName(''); setArtist(''); setSongKey(''); setTempo(''); setTimeSignature(''); setLyrics('');
        setUseType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario';

    // ── Shared styles ──────────────────────────────────────────────────────
    const inputStyle = {
        width: '100%', padding: '12px 14px',
        background: '#15151a', color: 'white',
        border: '1px solid #2e2e36', borderRadius: '8px',
        boxSizing: 'border-box', fontSize: '0.95rem', outline: 'none'
    };
    const btnPrimary = (enabled) => ({
        flex: 2, padding: '14px',
        background: enabled ? '#00bcd4' : '#23232b',
        border: 'none', color: enabled ? 'white' : '#555',
        borderRadius: '8px', cursor: enabled ? 'pointer' : 'not-allowed',
        fontSize: '1rem', fontWeight: '600', transition: 'background 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
    });
    const btnSecondary = {
        flex: 1, padding: '14px',
        background: '#23232b', border: '1px solid #333',
        color: '#aaa', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem'
    };

    const StorageMeter = ({ compact = false }) => (
        <div style={{ background: '#1e1e26', padding: compact ? '16px 20px' : '22px 25px', borderRadius: '12px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem', color: '#888' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cloud size={14} /> Almacenamiento
                </span>
                <span style={{ color: usedPercent > 90 ? '#e74c3c' : '#bbb' }}>
                    {usedMB.toFixed(1)} MB / {STORAGE_LIMIT_MB} MB
                </span>
            </div>
            <div style={{ background: '#2a2a34', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${usedPercent}%`,
                    background: usedPercent > 90
                        ? 'linear-gradient(to right,#e74c3c,#c0392b)'
                        : 'linear-gradient(to right,#00bcd4,#00e5ff)',
                    borderRadius: '100px', transition: 'width 0.6s ease'
                }} />
            </div>
            {usedPercent > 85 && (
                <p style={{ fontSize: '0.78rem', color: '#e74c3c', marginTop: '8px', marginBottom: 0 }}>
                    Almacenamiento casi lleno. Considera eliminar pistas antiguas.
                </p>
            )}
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#13131a', color: 'white', fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif' }}>

            {/* NAV */}
            <div style={{ backgroundColor: '#0e0e14', borderBottom: '1px solid #21212a', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', backgroundColor: '#00bcd4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '11px', height: '11px', backgroundColor: 'white', borderRadius: '50%' }} />
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem', letterSpacing: '-0.3px' }}>MixCommunity</span>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <button onClick={() => navigate('/multitrack')} style={{ background: 'transparent', border: '1px solid #303038', color: '#aaa', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                        Ir al Mixer
                    </button>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#00bcd4,#9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem' }}>
                        {displayName[0]?.toUpperCase()}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div style={{ maxWidth: '820px', margin: '0 auto', padding: '44px 24px' }}>

                {/* ── IDLE ─────────────────────────────────────── */}
                {step === 'idle' && (<>
                    <div style={{ marginBottom: '36px' }}>
                        <h1 style={{ fontSize: '1.9rem', margin: '0 0 6px', fontWeight: '700' }}>
                            ¡Hola, {displayName.toUpperCase()}!
                        </h1>
                        <p style={{ color: '#666', margin: 0 }}>Gestiona tus canciones y sube nuevas pistas.</p>
                    </div>

                    {/* Drop zone */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{ border: '2px dashed #00bcd455', borderRadius: '14px', padding: '52px 40px', textAlign: 'center', cursor: 'pointer', background: 'rgba(0,188,212,0.04)', transition: 'background 0.2s, border-color 0.2s', marginBottom: '32px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,188,212,0.09)'; e.currentTarget.style.borderColor = '#00bcd4aa'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,188,212,0.04)'; e.currentTarget.style.borderColor = '#00bcd455'; }}
                    >
                        <div style={{ width: '62px', height: '62px', backgroundColor: '#00bcd420', border: '1px solid #00bcd440', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                            <Upload size={26} color="#00bcd4" />
                        </div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: '600' }}>Subir Canción (ZIP)</h3>
                        <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
                            Haz clic o arrastra un archivo .zip con pistas WAV/MP3
                        </p>
                        <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />
                    </div>

                    <StorageMeter />

                    {/* Songs list */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '0.8rem', color: '#555', margin: 0, textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: '600' }}>
                            Mis Canciones ({userSongs.length})
                        </h3>
                    </div>

                    {userSongs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: '#444', background: '#1a1a22', borderRadius: '12px', border: '1px solid #21212a' }}>
                            <Music2 size={36} color="#333" style={{ marginBottom: '14px' }} />
                            <p style={{ margin: 0 }}>Aún no has subido ninguna canción.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {userSongs.map(song => (
                                <div
                                    key={song.id}
                                    onClick={() => { localStorage.setItem('mixer_pendingSongId', song.id); navigate('/multitrack'); }}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a22', padding: '15px 20px', borderRadius: '10px', border: '1px solid #28282f', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#1f1f28'; e.currentTarget.style.borderColor = '#00bcd455'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#1a1a22'; e.currentTarget.style.borderColor = '#28282f'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'linear-gradient(135deg,#00bcd430,#9b59b630)', border: '1px solid #00bcd440', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Music2 size={18} color="#00bcd4" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.97rem', marginBottom: '3px' }}>{song.name}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#666', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                {song.artist && <span>{song.artist}</span>}
                                                {song.key && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><KeyRound size={10} /> {song.key}</span>}
                                                {song.tempo && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Timer size={10} /> {song.tempo} BPM</span>}
                                                {song.timeSignature && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#222', padding: '2px 6px', borderRadius: '4px', border: '1px solid #333' }}>{song.timeSignature}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSongInfo({
                                                    ...song,
                                                    // Make a deep(ish) copy of tracks so we can edit local state
                                                    tracks: song.tracks ? song.tracks.map(t => ({ ...t })) : []
                                                });
                                            }}
                                            style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid #ffc10733', color: '#ffb300', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            <Settings2 size={14} /> Editar
                                        </button>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setEditingLyricsSong({ ...song, mode: 'lyrics' });
                                                setTempLyrics('Cargando...');
                                                try {
                                                    const q = query(collection(db, 'lyrics'), where('songId', '==', song.id));
                                                    const snap = await getDocs(q);
                                                    if (!snap.empty) {
                                                        setTempLyrics(snap.docs[0].data().text);
                                                    } else {
                                                        setTempLyrics('');
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    setTempLyrics('');
                                                }
                                            }}
                                            style={{ background: 'rgba(0,188,212,0.1)', border: '1px solid #00bcd433', color: '#00bcd4', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            <ScrollText size={14} /> Letra
                                        </button>
                                        <div onClick={() => { localStorage.setItem('mixer_pendingSongId', song.id); navigate('/multitrack'); }} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: '10px' }}>
                                            <span style={{ fontSize: '0.78rem', color: '#444' }}>{song.tracks?.length || 0} pistas</span>
                                            <ChevronRight size={16} color="#444" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>)}

                {/* ── CHOOSE USE ───────────────────────────────── */}
                {step === 'choose-use' && (
                    <div>
                        <div style={{ marginBottom: '36px' }}>
                            <h1 style={{ fontSize: '1.9rem', margin: '0 0 6px', fontWeight: '700' }}>
                                ¡Hola, {displayName.toUpperCase()}!
                            </h1>
                            <h2 style={{ fontSize: '1.3rem', margin: 0, color: '#888', fontWeight: '400' }}>
                                ¿Cómo quieres usar esta canción?
                            </h2>
                        </div>

                        <div style={{ display: 'flex', gap: '18px', marginBottom: '36px', flexWrap: 'wrap' }}>
                            {[
                                { id: 'personal', Icon: User, label: 'Uso personal' },
                                { id: 'sell', Icon: Tag, label: 'Vender' }
                            ].map(({ id, Icon, label }) => (
                                <div
                                    key={id}
                                    onClick={() => setUseType(id)}
                                    style={{
                                        flex: '1 1 150px', maxWidth: '200px',
                                        background: useType === id ? 'rgba(0,188,212,0.12)' : '#1e1e26',
                                        border: `2px solid ${useType === id ? '#00bcd4' : '#2a2a34'}`,
                                        borderRadius: '12px', padding: '32px 20px',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s'
                                    }}
                                >
                                    <Icon size={30} color={useType === id ? '#00bcd4' : '#555'} style={{ marginBottom: '14px' }} />
                                    <div style={{ fontWeight: '600', color: useType === id ? '#00bcd4' : '#ccc' }}>{label}</div>
                                </div>
                            ))}
                        </div>

                        <StorageMeter compact />

                        <div style={{ display: 'flex', gap: '14px' }}>
                            <button onClick={resetWizard} style={btnSecondary}>Cancelar</button>
                            <button onClick={() => useType && setStep('details')} disabled={!useType} style={btnPrimary(!!useType)}>
                                Continuar <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── DETAILS ──────────────────────────────────── */}
                {step === 'details' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
                            <button onClick={() => setStep('choose-use')} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                                <ArrowLeft size={22} />
                            </button>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Detalles de la canción</h2>
                                <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>
                                    {fileList.length} pistas · {useType === 'personal' ? 'Uso personal' : 'Venta'}
                                </p>
                            </div>
                        </div>

                        <div style={{ background: '#1a1a22', padding: '28px', borderRadius: '14px', border: '1px solid #21212a', marginBottom: '22px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '26px' }}>
                                {[
                                    { label: 'Nombre de la Canción', value: songName, set: setSongName, placeholder: 'Ej: Mientras Viva', type: 'text' },
                                    { label: 'Artista / Banda', value: artist, set: setArtist, placeholder: 'Ej: G12 Music', type: 'text' },
                                    { label: 'Tonalidad (Key)', value: songKey, set: setSongKey, placeholder: 'Ej: D# o Bm', type: 'text' },
                                    { label: 'Tempo (BPM)', value: tempo, set: setTempo, placeholder: 'Ej: 120', type: 'number' },
                                    { label: 'Compás', value: timeSignature, set: setTimeSignature, type: 'select', options: ['4/4', '3/4', '6/8', '2/4', '12/8', '2/2', '5/8', '9/8'] }
                                ].map(field => (
                                    <div key={field.label}>
                                        <label style={{ display: 'block', marginBottom: '7px', color: '#666', fontSize: '0.8rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                            {field.label}
                                        </label>
                                        {field.type === 'select' ? (
                                            <select value={field.value || ''} onChange={e => field.set(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                                <option value="" disabled>Selecciona compás...</option>
                                                {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input type={field.type} placeholder={field.placeholder} value={field.value} onChange={e => field.set(e.target.value)} style={inputStyle} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginBottom: '26px' }}>
                                <label style={{ display: 'block', marginBottom: '7px', color: '#666', fontSize: '0.8rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                    Letra de la Canción (Opcional)
                                </label>
                                <textarea
                                    value={lyrics}
                                    onChange={e => setLyrics(e.target.value)}
                                    placeholder="Escribe o pega la letra aquí..."
                                    style={{ ...inputStyle, width: '100%', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#444', marginTop: '6px' }}>
                                    Esto se mostrará como teleprompter en el reproductor.
                                </p>
                            </div>

                            <div style={{ borderTop: '1px solid #21212a', paddingTop: '22px' }}>
                                <p style={{ margin: '0 0 14px', color: '#555', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                                    <Layers size={12} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    Pistas ({fileList.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {fileList.map((file, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#13131a', padding: '10px 14px', borderRadius: '8px', border: '1px solid #21212a' }}>
                                            <span style={{ color: '#444', fontWeight: '600', width: '20px', textAlign: 'center', fontSize: '0.82rem' }}>{i + 1}</span>
                                            <input type="text" value={file.displayName} onChange={e => handleNameChange(i, e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: '0.88rem' }} />
                                            <span style={{ fontSize: '0.75rem', color: '#444', whiteSpace: 'nowrap' }}>{(file.blob.size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '14px' }}>
                            <button onClick={resetWizard} style={btnSecondary}>Cancelar</button>
                            <button onClick={uploadToB2} disabled={!songName.trim()} style={btnPrimary(!!songName.trim())}>
                                <Upload size={16} /> Subir a la Nube
                            </button>
                        </div>
                    </div>
                )}

                {/* ── UPLOADING ────────────────────────────────── */}
                {step === 'uploading' && (
                    <div style={{ textAlign: 'center', padding: '90px 20px' }}>
                        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 30px' }}>
                            <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="45" cy="45" r="38" fill="none" stroke="#21212a" strokeWidth="8" />
                                <circle cx="45" cy="45" r="38" fill="none" stroke="#00bcd4" strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 38}`}
                                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - uploadProgress / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                                />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.1rem', color: '#00bcd4' }}>
                                {uploadProgress}%
                            </div>
                        </div>
                        <h2 style={{ margin: '0 0 10px', fontWeight: '600' }}>Subiendo a la nube...</h2>
                        <p style={{ color: '#555', margin: 0 }}>Por favor espera mientras cargamos tus pistas.</p>
                    </div>
                )}

                {/* ── DONE ─────────────────────────────────────── */}
                {step === 'done' && (
                    <div style={{ textAlign: 'center', padding: '90px 20px' }}>
                        <CheckCircle2 size={64} color="#2ecc71" style={{ marginBottom: '22px' }} />
                        <h2 style={{ margin: '0 0 10px', color: '#2ecc71', fontWeight: '700' }}>
                            Canción subida exitosamente
                        </h2>
                        <p style={{ color: '#555', margin: 0 }}>Redirigiendo...</p>
                    </div>
                )}
            </div>
            {/* ── EDIT LYRICS MODAL ───────────────────────── */}
            {editingLyricsSong && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: '#1a1a22', width: '100%', maxWidth: '600px', borderRadius: '16px', border: '1px solid #333', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 25px', borderBottom: '1px solid #28282f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    onClick={() => setEditingLyricsSong({ ...editingLyricsSong, mode: 'lyrics' })}
                                    style={{ background: 'none', border: 'none', color: editingLyricsSong.mode !== 'chords' ? '#00bcd4' : '#666', fontSize: '1.2rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                                >
                                    Letra
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingLyricsSong({ ...editingLyricsSong, mode: 'chords' });
                                        setTempLyrics('Cargando...');
                                        // Refetch chords
                                        const q = query(collection(db, 'chords'), where('songId', '==', editingLyricsSong.id));
                                        getDocs(q).then(snap => {
                                            if (!snap.empty) setTempLyrics(snap.docs[0].data().text);
                                            else setTempLyrics('');
                                        }).catch(() => setTempLyrics(''));
                                    }}
                                    style={{ background: 'none', border: 'none', color: editingLyricsSong.mode === 'chords' ? '#00bcd4' : '#666', fontSize: '1.2rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                                >
                                    Acordes
                                </button>
                            </div>
                            <button onClick={() => setEditingLyricsSong(null)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '25px' }}>
                            <textarea
                                value={tempLyrics}
                                onChange={e => setTempLyrics(e.target.value)}
                                placeholder={editingLyricsSong.mode === 'chords' ? "Pega aquí los acordes de la canción..." : "Pega aquí la letra de la canción..."}
                                style={{ ...inputStyle, width: '100%', minHeight: '350px', resize: 'vertical', fontSize: '0.95rem', lineHeight: '1.5', fontFamily: 'monospace' }}
                            />
                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                <button onClick={() => setEditingLyricsSong(null)} style={btnSecondary}>Cancelar</button>
                                <button
                                    style={btnPrimary(true)}
                                    onClick={async () => {
                                        try {
                                            const collectionName = editingLyricsSong.mode === 'chords' ? 'chords' : 'lyrics';
                                            const q = query(collection(db, collectionName), where('songId', '==', editingLyricsSong.id));
                                            const snap = await getDocs(q);

                                            if (!snap.empty) {
                                                await updateDoc(doc(db, collectionName, snap.docs[0].id), {
                                                    text: tempLyrics,
                                                    updatedAt: serverTimestamp()
                                                });
                                            } else {
                                                await addDoc(collection(db, collectionName), {
                                                    songId: editingLyricsSong.id,
                                                    text: tempLyrics,
                                                    updatedAt: serverTimestamp()
                                                });
                                            }

                                            // BACKUP: Also update the song document itself for immediate sync
                                            const backupObj = {};
                                            backupObj[collectionName] = tempLyrics;
                                            await updateDoc(doc(db, 'songs', editingLyricsSong.id), backupObj);

                                            setEditingLyricsSong(null);
                                        } catch (err) {
                                            console.error(err);
                                            alert(`Error al guardar ${editingLyricsSong.mode === 'chords' ? 'acordes' : 'letra'}`);
                                        }
                                    }}
                                >
                                    Guardar {editingLyricsSong.mode === 'chords' ? 'Acordes' : 'Letra'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT SONG METADATA MODAL ────────────────── */}
            {editingSongInfo && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: '#1a1a22', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '16px', border: '1px solid #333', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 25px', borderBottom: '1px solid #28282f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings2 size={18} color="#00bcd4" /> Editar Propiedades
                            </h3>
                            <button onClick={() => setEditingSongInfo(null)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '25px', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#888', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>Nombre</label>
                                    <input type="text" value={editingSongInfo.name || ''} onChange={e => setEditingSongInfo({ ...editingSongInfo, name: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#888', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>Artista</label>
                                    <input type="text" value={editingSongInfo.artist || ''} onChange={e => setEditingSongInfo({ ...editingSongInfo, artist: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#888', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>Key</label>
                                    <input type="text" value={editingSongInfo.key || ''} onChange={e => setEditingSongInfo({ ...editingSongInfo, key: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#888', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>BPM</label>
                                    <input type="number" value={editingSongInfo.tempo || ''} onChange={e => setEditingSongInfo({ ...editingSongInfo, tempo: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#888', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>Compás</label>
                                    <select value={editingSongInfo.timeSignature || ''} onChange={e => setEditingSongInfo({ ...editingSongInfo, timeSignature: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        <option value="" disabled>Selecciona compás...</option>
                                        {['4/4', '3/4', '6/8', '2/4', '12/8', '2/2', '5/8', '9/8'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid #28282f', paddingTop: '20px' }}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#ccc' }}>Letreros de Pistas</h4>
                                {editingSongInfo.tracks && editingSongInfo.tracks.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {editingSongInfo.tracks.map((track, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: '#555', fontSize: '0.85rem', width: '20px', textAlign: 'right' }}>{i + 1}</span>
                                                <input
                                                    type="text"
                                                    value={track.name || ''}
                                                    onChange={e => {
                                                        const newTracks = [...editingSongInfo.tracks];
                                                        newTracks[i].name = e.target.value;
                                                        setEditingSongInfo({ ...editingSongInfo, tracks: newTracks });
                                                    }}
                                                    style={{ ...inputStyle, padding: '8px 12px', fontSize: '0.9rem' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: '#555', fontSize: '0.9rem' }}>No hay pistas para editar.</p>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
                                <button onClick={() => setEditingSongInfo(null)} style={btnSecondary}>Cancelar</button>
                                <button
                                    style={btnPrimary(true)}
                                    onClick={async () => {
                                        try {
                                            await updateDoc(doc(db, 'songs', editingSongInfo.id), {
                                                name: editingSongInfo.name,
                                                artist: editingSongInfo.artist,
                                                key: editingSongInfo.key,
                                                tempo: editingSongInfo.tempo,
                                                timeSignature: editingSongInfo.timeSignature || '',
                                                tracks: editingSongInfo.tracks
                                            });
                                            setEditingSongInfo(null);
                                        } catch (err) {
                                            console.error(err);
                                            alert('Error al guardar propiedades');
                                        }
                                    }}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
