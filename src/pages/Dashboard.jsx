import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Dashboard() {
    const navigate = useNavigate();
    const [fileList, setFileList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // Metadata states
    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [songKey, setSongKey] = useState('');
    const [tempo, setTempo] = useState('');

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const zip = new JSZip();
        try {
            // Auto-parse filename for metadata
            const cleanName = file.name.replace(/\.zip$/i, '');
            const parts = cleanName.split('-').map(p => p.trim());

            if (parts.length >= 1) setSongName(parts[0]);
            if (parts.length >= 2) setArtist(parts[1]);
            if (parts.length >= 3) {
                const keyTempoStr = parts.slice(2).join('-');
                const tempoMatch = keyTempoStr.match(/(\d+)\s*bpm/i);
                if (tempoMatch) {
                    setTempo(tempoMatch[1]);
                    setSongKey(keyTempoStr.replace(tempoMatch[0], '').trim());
                } else {
                    setSongKey(keyTempoStr);
                }
            }

            const contents = await zip.loadAsync(file);
            const extractedFiles = [];

            // Read all audio files from the ZIP
            for (const filename of Object.keys(contents.files)) {
                if (filename.endsWith('.wav') || filename.endsWith('.mp3')) {
                    const fileData = await contents.files[filename].async("blob");
                    extractedFiles.push({
                        originalName: filename,
                        displayName: filename.split('/').pop().replace(/\.(wav|mp3)$/, ''), // Base name without extension
                        blob: fileData,
                        extension: filename.split('.').pop()
                    });
                }
            }

            setFileList(extractedFiles);
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
        if (!songName.trim()) {
            return alert('Por favor, ingresa un nombre para la canción general.');
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            return alert('Debes iniciar sesión para subir librerías.');
        }

        setIsUploading(true);
        const uploadedTracksInfo = [];

        try {
            for (let i = 0; i < fileList.length; i++) {
                const track = fileList[i];
                console.log(`Subiendo ${track.displayName}...`);

                // Create FormData
                const formData = new FormData();
                formData.append('audioFile', track.blob);

                // Generamos un nombre único sin espacios para B2
                const safeName = songName.replace(/[^a-zA-Z0-9]/g, '_');
                const safeTrackName = track.displayName.replace(/[^a-zA-Z0-9]/g, '_');
                const b2Filename = `audio_${currentUser.uid}_${Date.now()}_${safeName}_${safeTrackName}.${track.extension}`;

                formData.append('fileName', b2Filename);

                // Send to backend proxy
                const uploadRes = await fetch('http://localhost:3001/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!uploadRes.ok) {
                    throw new Error(`Falló subida del track ${track.displayName}`);
                }

                const uploadData = await uploadRes.json();

                uploadedTracksInfo.push({
                    name: track.displayName,
                    originalName: track.originalName,
                    url: uploadData.url,           // The direct B2 URL we'll use for proxying playback
                    b2FileId: uploadData.fileId,
                    sizeMB: (track.blob.size / 1024 / 1024).toFixed(2)
                });
            }

            // Save relationship to Firestore Database
            console.log("Guardando metadatos del álbum en Firestore...");
            await addDoc(collection(db, 'songs'), {
                name: songName,
                artist: artist,
                key: songKey,
                tempo: tempo,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                tracks: uploadedTracksInfo,
                createdAt: serverTimestamp(),
                isGlobal: false // By default, only visible to this user
            });

            alert('¡Pistas subidas exitosamente a B2 y registradas en Firestore!');
            navigate('/multitrack');
        } catch (error) {
            console.error('Error subiendo:', error);
            alert('Ocurrió un error subiendo los archivos a Backblaze. Revisa la consola para más detalles.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Panel de Control (Dashboard)</h2>
                <button
                    onClick={() => navigate('/multitrack')}
                    style={{ background: '#34495e', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
                >
                    Ir al Productor (Mixer)
                </button>
            </div>

            <p>Sube un archivo `.zip` que contenga los tracks STEMS (.wav o .mp3). Una vez extraídos en la web, podrás renombrar qué instrumento es cuál y subirlos directamente a Backblaze.</p>

            <div style={{ background: '#1e1e24', padding: '30px', margin: '20px 0', borderRadius: '10px', border: '2px dashed #444', textAlign: 'center' }}>
                <input
                    type="file"
                    accept=".zip"
                    onChange={handleZipUpload}
                    style={{ display: 'block', margin: '0 auto', padding: '10px', background: '#333', color: 'white', border: '1px solid #555', cursor: 'pointer' }}
                />
            </div>

            {fileList.length > 0 && (
                <div style={{ background: '#2a2a35', padding: '25px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>Archivos Extraídos ({fileList.length})</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Nombre General de la Canción:</label>
                            <input
                                type="text"
                                placeholder="Ej: Mientras Viva"
                                value={songName}
                                onChange={(e) => setSongName(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Artista / Banda:</label>
                            <input
                                type="text"
                                placeholder="Ej: G12"
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Tonalidad (Key):</label>
                            <input
                                type="text"
                                placeholder="Ej: D minor o Bm"
                                value={songKey}
                                onChange={(e) => setSongKey(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Tempo (BPM):</label>
                            <input
                                type="number"
                                placeholder="Ej: 120"
                                value={tempo}
                                onChange={(e) => setTempo(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#111', borderBottom: '2px solid #333' }}>
                                <th style={{ padding: '10px', textAlign: 'left', width: '40%' }}>Archivo Original</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Nombre del Canal (Track)</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Tamaño</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fileList.map((file, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                                    <td style={{ padding: '10px', fontSize: '14px', color: '#999', wordBreak: 'break-all' }}>
                                        {file.originalName}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <input
                                            type="text"
                                            value={file.displayName}
                                            onChange={(e) => handleNameChange(i, e.target.value)}
                                            style={{ width: '90%', padding: '8px', background: '#222', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', color: '#777', fontSize: '13px' }}>
                                        {(file.blob.size / 1024 / 1024).toFixed(2)} MB
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button
                        onClick={uploadToB2}
                        disabled={isUploading}
                        className="play-btn"
                        style={{ marginTop: '20px', width: '100%', padding: '15px', background: isUploading ? '#7f8c8d' : '#2ecc71', opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                    >
                        {isUploading ? 'Subiendo tracks a la Nube (B2)...' : 'Subir Álbum a Backblaze B2'}
                    </button>
                </div>
            )}
        </div>
    );
}
