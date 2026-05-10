const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const targetDelete = /const handleDeleteSetlist = async \(id, name, e\) => \{[\s\S]*?deleteDoc\(doc\(db, 'setlists', id\)\);[\s\S]*?\};/;
const replacementDelete = `const handleDeleteSetlist = async (id, name, e) => {
        e.stopPropagation();
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
                console.error('Error borrando setlist:', error);
            }
        }
    };`;
c = c.replace(targetDelete, replacementDelete);

const targetAddSongToSl = /await updateDoc\(doc\(db, 'setlists', activeSetlist\.id\), \{[\s\S]*?songs: arrayUnion\(song\)[\s\S]*?\}\);/;
const replaceAddSongToSl = `if (window.zionNative) {
                    const updated = { ...activeSetlist, songs: [...(activeSetlist.songs || []), song] };
                    await window.zionNative.saveSetlist(updated);
                    setActiveSetlist(updated);
                    setSetlists(prev => prev.map(s => s.id === updated.id ? updated : s));
                }`;
c = c.replace(targetAddSongToSl, replaceAddSongToSl);

const targetRemoveSongSl = /await updateDoc\(doc\(db, 'setlists', activeSetlist\.id\), \{[\s\S]*?songs: arrayRemove\(songToRemove\)[\s\S]*?\}\);/;
const replaceRemoveSongSl = `if (window.zionNative) {
            const updated = { ...activeSetlist, songs: (activeSetlist.songs || []).filter(s => s.id !== songToRemove.id) };
            await window.zionNative.saveSetlist(updated);
            setActiveSetlist(updated);
            setSetlists(prev => prev.map(s => s.id === updated.id ? updated : s));
        }`;
c = c.replace(targetRemoveSongSl, replaceRemoveSongSl);

fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Fixed setlist mutations for SQLite');
