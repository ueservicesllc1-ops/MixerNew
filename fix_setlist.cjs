const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const targetFirebaseSetlist = /await addDoc\(collection\(db, 'setlists'\), \{[^\}]+\}\);/s;
c = c.replace(targetFirebaseSetlist, `
            const newSl = { id: 'sl_' + Date.now(), name: newSetlistName, songs: [], songs_json: '[]' };
            if (typeof window !== 'undefined' && window.zionNative) {
                await window.zionNative.saveSetlist(newSl);
                setSetlists([...setlists, newSl]);
            }
`);

fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Fixed handleCreateSetlist');
