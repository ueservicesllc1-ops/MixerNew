const fs = require('fs');
let c = fs.readFileSync('electron/main.cjs', 'utf8');

c = c.replace(/const db = require\('\.\/db\.cjs'\);/, `const db = require('./db.cjs');\nconst encCache = require('./EncryptedCacheService.cjs');`);

c = c.replace(/app\.whenReady\(\)\.then\(\(\) => \{/, `app.whenReady().then(() => {\n    encCache.cleanTemp();`);

const targetLoad = /ipcMain\.on\('audio:load', \(e, tracks\) => zionNative && zionNative\.loadSongSession\(\{ tracks \}\)\);/;
const replacementLoad = `ipcMain.handle('audio:load', async (e, tracks) => {
        if (!zionNative) return;
        const decryptedTracks = [];
        for (const t of tracks) {
            const decPath = await encCache.getDecryptedTempPath(t.filename || (t.id + '_' + t.name));
            if (decPath) {
                decryptedTracks.push({ ...t, path: decPath });
            }
        }
        zionNative.loadSongSession({ tracks: decryptedTracks });
    });`;
c = c.replace(targetLoad, replacementLoad);

const targetSaveCache = /ipcMain\.handle\('db:save-license', \(e, serial, mode\) => db\.saveLicense\(serial, mode\)\);/;
const replacementSaveCache = `ipcMain.handle('db:save-license', (e, serial, mode) => db.saveLicense(serial, mode));
    
    // --- CACHE ENCRIPTADO ---
    ipcMain.handle('cache:save', async (e, filename, buffer) => {
        return await encCache.saveEncryptedFile(filename, buffer);
    });
    ipcMain.handle('cache:exists', (e, filename) => encCache.fileExists(filename));`;
c = c.replace(targetSaveCache, replacementSaveCache);

fs.writeFileSync('electron/main.cjs', c);
console.log('main.cjs updated');
