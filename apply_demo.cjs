const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const targetAddSong = /const handleAddToLibrary = async \(song\) => \{/;
const replacementAddSong = `const handleAddToLibrary = async (song) => {
        if (isDemo && librarySongs.length >= 3) {
            alert('Modo DEMO: Límite de 3 canciones alcanzado. Por favor, activa Zion Stage para descargar más canciones.');
            setShowLoginModal(true);
            return;
        }`;
c = c.replace(targetAddSong, replacementAddSong);

const targetAddSetlist = /const handleCreateSetlist = async \(\) => \{/;
const replacementAddSetlist = `const handleCreateSetlist = async () => {
        if (isDemo && setlists.length >= 1) {
            alert('Modo DEMO: Límite de 1 setlist alcanzado. Por favor, activa Zion Stage para crear más setlists.');
            setShowLoginModal(true);
            return;
        }`;
c = c.replace(targetAddSetlist, replacementAddSetlist);

fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Demo mode restrictions applied.');
