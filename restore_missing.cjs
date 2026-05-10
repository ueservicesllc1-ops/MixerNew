const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const anchor = 'const handleDragEnd = async (event) => {';

const missingBlock = `
    const handleCreateSetlist = async () => {
        if (!newSetlistName.trim()) return;
        
        if (isDemo && setlists.length >= 1) {
            alert('Modo Demo Activo: Solo puedes crear un setlist.');
            const btn = document.querySelector('.btn-activate-modal');
            if (btn) btn.click();
            return;
        }

        try {
            if (window.zionNative) {
                const newSl = {
                    id: 'sl_' + Date.now(),
                    name: newSetlistName,
                    songs: []
                };
                await window.zionNative.saveSetlist(newSl);
                setSetlists(prev => [...prev, newSl]);
            }
            setNewSetlistName('');
            setIsCreatingSetlist(false);
        } catch (error) {
            console.error('Error creando setlist:', error);
        }
    };

    const handleSelectSetlist = (list) => {
        setActiveSetlist(list);
        setIsSetlistMenuOpen(false);
        localStorage.setItem('mixer_lastSetlistId', list.id);
        const subset = (list.songs || []).slice(0, 2);
        preloadSetlistSongs(subset);
    };

    useEffect(() => {
        if (activeSetlist && activeSetlist.songs) {
            const currentIndex = activeSetlist.songs.findIndex(s => s.id === activeSongId);
            const startIdx = Math.max(0, currentIndex === -1 ? 0 : currentIndex);
            const subset = activeSetlist.songs.slice(startIdx, startIdx + 3);
            preloadSetlistSongs(subset);
        }
    }, [activeSetlist?.songs, activeSongId]);

    const preloadSetlistSongs = async (songs) => {
        // En Desktop Nativo, el preload está desactivado en React 
        // para no colapsar la RAM. JUCE lo maneja bajo demanda.
    };

    `;

if (c.indexOf(anchor) !== -1) {
    c = c.replace(anchor, missingBlock + anchor);
    fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
    console.log('Restored missing setlist functions!');
} else {
    console.log('Could not find anchor.');
}
