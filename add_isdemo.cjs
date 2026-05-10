const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

const targetState = /const \[currentUser, setCurrentUser\] = useState\(null\);/;
const replaceState = `const [currentUser, setCurrentUser] = useState(null);
    const [isDemo, setIsDemo] = useState(true);
    
    useEffect(() => {
        if (typeof window !== 'undefined' && window.zionNative && window.zionNative.getLicense) {
            window.zionNative.getLicense().then(lic => {
                if (lic && lic.mode === 'pro') setIsDemo(false);
            });
        }
    }, []);`;

c = c.replace(targetState, replaceState);
fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Added isDemo state');
