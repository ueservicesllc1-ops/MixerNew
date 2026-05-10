const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const target = /    useEffect\(\(\) => \{\s*if \(typeof window !== 'undefined' && window\.zionNative && window\.zionNative\.getLicense\) \{\s*window\.zionNative\.getLicense\(\)\.then\(lic => \{\s*if \(lic && lic\.mode === 'pro'\) setIsDemo\(false\);\s*\}\);\s*\}\s*\}, \[\]\);/;

const replacement = `    useEffect(() => {
        if (typeof window !== 'undefined' && window.zionNative && window.zionNative.getLicense) {
            window.zionNative.getLicense().then(lic => {
                if (lic && lic.mode === 'pro') setIsDemo(false);
            });
        }

        const loadLocalData = async () => {
            if (typeof window !== 'undefined' && window.zionNative) {
                try {
                    const localSongs = await window.zionNative.getSongs();
                    setLibrarySongs(localSongs.map(s => ({ ...s, tracks: s.tracks_json ? JSON.parse(s.tracks_json) : [] })));
                    
                    const localSetlists = await window.zionNative.getSetlists();
                    setSetlists(localSetlists.map(s => ({ ...s, songs: s.songs_json ? JSON.parse(s.songs_json) : [] })));
                } catch (e) {
                    console.error('Error cargando BD local', e);
                }
            }
        };
        
        loadLocalData();

        // Try to authenticate anonymously to read Global Catalog if online
        import('../firebase').then(({ auth, signInAnonymously }) => {
            if (auth && signInAnonymously) {
                signInAnonymously(auth).then(({ user }) => {
                    setCurrentUser(user);
                }).catch(e => console.warn('Offline mode: No anonymous auth', e));
            }
        }).catch(() => {});
        
        const initCore = async () => {
            const emptyTracks = [
                { id: '1', name: 'Master' },
                { id: '2', name: 'Canal 1' },
                { id: '3', name: 'Canal 2' },
                { id: '4', name: 'Canal 3' },
            ];
            setTracks(emptyTracks);
            audioEngine.onProgress = (t) => {
                if (!window.Capacitor?.isNativePlatform?.()) progressRef.current = t;
            };
            setLoading(false);
        };
        initCore();
        
        return () => {
            if (audioEngine) audioEngine.onProgress = null;
        };
    }, []);`;

if (c.match(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
    console.log('Injected loadLocalData effect');
} else {
    console.log('Target not found');
}
