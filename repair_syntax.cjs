const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const dragStart = c.indexOf('const handleDragEnd = async (event) => {');
const dlAdd = c.indexOf('const handleDownloadAndAdd = async (song) => {');

const block = c.substring(dragStart, dlAdd);

const replacement = `const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !activeSetlist) return;

        const oldIndex = activeSetlist.songs.findIndex(s => s.id === active.id);
        const newIndex = activeSetlist.songs.findIndex(s => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newSongs = arrayMove(activeSetlist.songs, oldIndex, newIndex);

            // Optimistic update
            const updatedSetlist = { ...activeSetlist, songs: newSongs };
            setActiveSetlist(updatedSetlist);

            // Persist to local SQLite
            if (window.zionNative) {
                try {
                    await window.zionNative.saveSetlist(updatedSetlist);
                    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));
                } catch (error) {
                    console.error('Error guardando orden de setlist:', error);
                }
            }
        }
    };

    const handleDeleteSetlist = async (id, name, e) => {
        e.stopPropagation(); // Avoid triggering selection
        if (window.confirm(\`¿Seguro que deseas ELIMINAR permanentemente el setlist "\${name}"? Esta acción no se puede deshacer.\`)) {
            try {
                if (window.zionNative) {
                    await window.zionNative.saveSetlist({ id, _delete: true });
                    setSetlists(prev => prev.filter(s => s.id !== id));
                    if (activeSetlist && activeSetlist.id === id) {
                        setActiveSetlist(null);
                    }
                }
            } catch (error) {
                console.error("Error borrando setlist:", error);
            }
        }
    };

    const handleRemoveSongFromSetlist = async (songIdToRemove, e) => {
        if (e) e.stopPropagation();
        if (!activeSetlist) return;

        if (window.confirm("¿Seguro que deseas remover esta canción del setlist activo?")) {
            try {
                const songToRemove = activeSetlist.songs.find(s => s.id === songIdToRemove);
                if (songToRemove && window.zionNative) {
                    const updatedSetlist = { 
                        ...activeSetlist, 
                        songs: activeSetlist.songs.filter(s => s.id !== songIdToRemove) 
                    };
                    
                    await window.zionNative.saveSetlist(updatedSetlist);
                    setActiveSetlist(updatedSetlist);
                    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));

                    if (activeSongId === songIdToRemove) {
                        await audioEngine.stop();
                        audioEngine.clear();
                        setIsPlaying(false);
                        progressRef.current = 0;
                        setActiveSongId(null);
                        setTracks([]);
                    }
                }
            } catch (error) {
                console.error("Error removiendo canción del setlist:", error);
            }
        }
    };

    `;

if (dragStart !== -1 && dlAdd !== -1) {
    c = c.replace(block, replacement);
    fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
    console.log('Fixed syntax error in DesktopMultitrack.jsx');
} else {
    console.log('Could not find block boundaries');
}
