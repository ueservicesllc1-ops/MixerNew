const fs = require('fs');
let c = fs.readFileSync('src/pages/DesktopMultitrack.jsx', 'utf8');

// The original strings might be too long to regex reliably across lines, so let's use indexOf.
const startFn1 = "const nativeAllCriticalStemsOnDisk = async (song, formatPlan) => {";
const startFn2 = "const tryBuildNativeTrackMapFromDisk = async (song, formatPlan) => {";

function replaceFunction(code, startStr, replacementStr) {
    const startIdx = code.indexOf(startStr);
    if (startIdx === -1) return code;
    
    let openBraces = 0;
    let endIdx = -1;
    for (let i = startIdx + startStr.length; i < code.length; i++) {
        if (code[i] === '{') openBraces++;
        if (code[i] === '}') {
            if (openBraces === 0) {
                endIdx = i + 1;
                break;
            }
            openBraces--;
        }
    }
    
    if (endIdx !== -1) {
        return code.substring(0, startIdx) + replacementStr + code.substring(endIdx);
    }
    return code;
}

const replace1 = `const nativeAllCriticalStemsOnDisk = async (song, formatPlan) => {
        if (typeof window === 'undefined' || !window.zionNative) return false;
        const tracks = song.tracks || [];
        for (const tr of tracks) {
            const exists = await window.zionNative.isTrackDownloaded(song.id + '_' + tr.name);
            if (!exists) return false;
        }
        return true;
    };`;

const replace2 = `const tryBuildNativeTrackMapFromDisk = async (song, formatPlan) => {
        if (typeof window === 'undefined' || !window.zionNative) return new Map();
        const diskMap = new Map();
        const tracks = song.tracks || [];
        for (const tr of tracks) {
            const filename = song.id + '_' + tr.name;
            const exists = await window.zionNative.isTrackDownloaded(filename);
            if (exists) {
                diskMap.set(tr.name, { path: filename, filename });
            }
        }
        return diskMap;
    };`;

c = replaceFunction(c, startFn1, replace1);
c = replaceFunction(c, startFn2, replace2);

fs.writeFileSync('src/pages/DesktopMultitrack.jsx', c);
console.log('Fixed native loading functions');
