const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const targetLoadLocal = /const localSongs = await window\.zionNative\.getSongs\(\);\s*setLibrarySongs\(localSongs\);\s*const localSetlists = await window\.zionNative\.getSetlists\(\);\s*setSetlists\(localSetlists\);/;

const replaceLoadLocal = `const localSongs = await window.zionNative.getSongs();
                    setLibrarySongs(localSongs.map(s => ({ ...s, tracks: s.tracks_json ? JSON.parse(s.tracks_json) : [] })));
                    
                    const localSetlists = await window.zionNative.getSetlists();
                    setSetlists(localSetlists.map(s => ({ ...s, songs: s.songs_json ? JSON.parse(s.songs_json) : [] })));`;

if (c.match(targetLoadLocal)) {
    c = c.replace(targetLoadLocal, replaceLoadLocal);
    fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
    console.log('Fixed parsing of tracks_json');
} else {
    console.log('Could not find target');
}
