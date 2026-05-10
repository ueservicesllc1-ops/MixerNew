const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const replacementDownload = `
    const handleDownloadAndAdd = async (song) => {
        if (!song || !song.id) return;
        setDownloadProgress({ songId: song.id, text: 'Iniciando descarga B2...' });

        try {
            const tracks = song.tracks || [];
            
            for (let i = 0; i < tracks.length; i++) {
                const tr = tracks[i];
                if (!tr.url || tr.url === 'undefined') continue;
                
                const filename = song.id + '_' + tr.name;
                
                setDownloadProgress({ songId: song.id, text: \`Bajando pista \${i + 1}/\${tracks.length}: \${tr.name}\` });

                const isDownloaded = window.zionNative ? await window.zionNative.isTrackDownloaded(filename) : false;
                if (!isDownloaded) {
                    const r = await fetch(tr.url);
                    if (!r.ok) continue;
                    
                    const blob = await r.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    
                    if (window.zionNative) {
                        await window.zionNative.saveEncryptedTrack(filename, arrayBuffer);
                    }
                }
            }

            setDownloadProgress({ songId: song.id, text: 'Guardando en BD Local...' });

            if (window.zionNative) {
                const songToSave = {
                    id: song.id,
                    name: song.name,
                    bpm: song.bpm || 120,
                    tonality: song.tonality || 'C',
                    duration: song.duration || 180,
                    tracks_json: JSON.stringify(tracks)
                };
                await window.zionNative.saveSong(songToSave);
                setLibrarySongs(prev => [...prev.filter(s => s.id !== song.id), songToSave]);
            }

            setDownloadProgress({ songId: null, text: '' });
            alert('¡Canción añadida a la biblioteca local (Cifrada)!');

        } catch (e) {
            console.error(e);
            setDownloadProgress({ songId: null, text: '' });
            alert('Error en la descarga');
        }
    };
`;

// we need to replace the old handleDownloadAndAdd completely.
const startStr = "const handleDownloadAndAdd = async (song) => {";
const startIdx = c.indexOf(startStr);

if (startIdx !== -1) {
    let openBraces = 0;
    let endIdx = -1;
    for (let i = startIdx + startStr.length; i < c.length; i++) {
        if (c[i] === '{') openBraces++;
        if (c[i] === '}') {
            if (openBraces === 0) {
                endIdx = i + 1;
                break;
            }
            openBraces--;
        }
    }
    
    if (endIdx !== -1) {
        c = c.substring(0, startIdx) + replacementDownload + c.substring(endIdx);
        fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
        console.log("Successfully replaced handleDownloadAndAdd");
    } else {
        console.log("Could not find end of handleDownloadAndAdd");
    }
} else {
    console.log("Could not find handleDownloadAndAdd start");
}

// We should also replace preloadSetlistSongs so it uses window.zionNative instead of LocalFileManager
const preloadTarget = /const preloadSetlistSongs = async \(songs\) => \{/;
const preloadReplace = `const preloadSetlistSongs = async (songs) => {
        if (typeof window !== 'undefined' && window.zionNative) {
            // Decryption happens on the fly in main.cjs when audio:load is called
            // We just need to ensure the files exist on disk before allowing playback
            // No need to load all ArrayBuffers to memory like in Web mode!
            
            for (const song of songs) {
                if (preloadCache.current.has(song.id)) continue;
                
                const tracksData = song.tracks || [];
                const trackBuffers = new Map();
                for (const tr of tracksData) {
                    const filename = song.id + '_' + tr.name;
                    const exists = await window.zionNative.isTrackDownloaded(filename);
                    if (exists) {
                        trackBuffers.set(tr.name, { audioBuf: null, filename }); // signal ready
                    } else {
                        trackBuffers.set(tr.name, { error: true });
                    }
                }
                
                preloadCache.current.set(song.id, trackBuffers);
                setPreloadStatus(prev => ({ ...prev, [song.id]: 'ready' }));
            }
            return;
        }
`;

c = c.replace(preloadTarget, preloadReplace);
fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Replaced preloadSetlistSongs');
