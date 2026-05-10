const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

// Replace the entire auth block using a robust regex
const regex = /const unsubAuth = auth\.onAuthStateChanged\(\(user\) => \{[\s\S]*?\/\/ --- INICIO SETLISTS ---[\s\S]*?return \(\) => \{[\s\S]*?unsubSongs\(\); unsubGlobal\(\); unsubSetlists\(\);[\s\S]*?\};[\s\S]*?\}\);/g;

const replacement = `// Hybrid Offline-First Setup
        const loadLocalData = async () => {
            if (typeof window !== 'undefined' && window.zionNative) {
                try {
                    const localSongs = await window.zionNative.getSongs();
                    setLibrarySongs(localSongs);
                    
                    const localSetlists = await window.zionNative.getSetlists();
                    setSetlists(localSetlists);
                } catch (e) {
                    console.error('Error cargando BD local', e);
                }
            }
        };
        
        loadLocalData();

        // Try to authenticate anonymously to read Global Catalog if online
        import('firebase/auth').then(({ signInAnonymously }) => {
            signInAnonymously(auth).then(({ user }) => {
                setCurrentUser(user);
            }).catch(e => console.warn('Offline mode: No anonymous auth', e));
        });

        const unsubAuth = () => {};`;

// I need a smaller regex that matches exactly the auth.onAuthStateChanged
const regexSmall = /const unsubAuth = auth\.onAuthStateChanged\(\(user\) => \{[\s\S]*?setSetlists\(\[\]\);\s*setActiveSetlist\(null\);\s*\}\s*\}\);/m;

if (c.match(regexSmall)) {
    c = c.replace(regexSmall, replacement);
    fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
    console.log('Successfully replaced auth block');
} else {
    console.log('Could not find auth block with regexSmall');
}
