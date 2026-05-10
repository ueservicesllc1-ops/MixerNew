const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const startStr = "        // Track User Auth and load their library";
const startIdx = c.indexOf(startStr);

if (startIdx !== -1) {
    // Find the enclosing useEffect
    const effectStartStr = "    useEffect(() => {\n        // Track User Auth and load their library";
    const effectStartIdx = c.lastIndexOf("    useEffect(() => {", startIdx);
    
    if (effectStartIdx !== -1) {
        let openBraces = 0;
        let endIdx = -1;
        for (let i = effectStartIdx + 10; i < c.length; i++) {
            if (c[i] === '{') openBraces++;
            if (c[i] === '}') {
                openBraces--;
                if (openBraces === 0) {
                    // Check if it's the end of useEffect: `}, []);`
                    const nextChars = c.substring(i, i + 15);
                    if (nextChars.includes('}, []')) {
                        endIdx = i + nextChars.indexOf(';') + 1;
                        break;
                    }
                }
            }
        }
        
        if (endIdx !== -1) {
            const replacement = `    useEffect(() => {
        // Hybrid Offline-First Setup
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

            c = c.substring(0, effectStartIdx) + replacement + c.substring(endIdx);
            fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
            console.log('Successfully replaced auth effect for hybrid mode');
        } else {
            console.log('Could not find end of useEffect');
        }
    } else {
        console.log('Could not find start of useEffect');
    }
} else {
    console.log('Could not find Track User Auth string');
}
