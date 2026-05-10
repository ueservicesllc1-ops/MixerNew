const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db.cjs');
const encCache = require('./EncryptedCacheService.cjs');

/**
 * Escritorio Electron = app aparte del sitio en :3000.
 * - Si existe dist/index.html → file:// (tras `npm run build`), sin servidor.
 * - Si ELECTRON_DEV_URL está definida → esa URL (p. ej. Vite solo en :3520 vía `npm run dev:desktop`).
 */
function resolveLoadTarget() {
    const devUrl = process.env.ELECTRON_DEV_URL;
    if (devUrl) {
        return { mode: 'url', target: devUrl };
    }
    const distIndex = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distIndex)) {
        return { mode: 'file', target: distIndex };
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zion Stage Desktop</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a12;color:#e2e8f0;padding:2rem;max-width:560px;line-height:1.5">
<h1 style="color:#f8fafc;margin-top:0">Zion Stage Desktop</h1>
<p>Esta ventana no usa el puerto <strong>3000</strong> (esa es la web en el navegador).</p>
<p>Genera el front una vez y vuelve a abrir el escritorio:</p>
<pre style="background:#1e293b;padding:12px;border-radius:8px;overflow:auto">npm run build\nnpm run desktop</pre>
<p>O modo desarrollo con Vite en <strong>3520</strong> (no pisa el 3000):</p>
<pre style="background:#1e293b;padding:12px;border-radius:8px;overflow:auto">npm run dev:desktop</pre>
</body></html>`;
    return { mode: 'data', target: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) };
}

function tryRequireNative() {
    const candidates = [
        path.join(__dirname, '../ZionAudioCore/build/Release/zion_audio_bridge.node'),
        path.join(__dirname, '../ZionAudioCore/build/Debug/zion_audio_bridge.node'),
    ];
    for (const p of candidates) {
        try {
            return require(p);
        } catch (_) {
            /* siguiente ruta */
        }
    }
    return null;
}

const nativeMod = tryRequireNative();
if (!nativeMod) {
    console.error('[Zion] No se cargó zion_audio_bridge.node — compila ZionAudioCore (cmake-js / CMake) y vuelve a abrir.');
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Zion Stage Desktop (OFFLINE)',
        backgroundColor: '#0a0a12',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
        },
    });

    const { mode, target } = resolveLoadTarget();
    if (mode === 'file') {
        win.loadFile(target, { hash: '/desktop' });
    } else {
        win.loadURL(target);
    }
}

app.whenReady().then(() => {
    encCache.cleanTemp();

    let engine = null;
    if (nativeMod) {
        try {
            engine = new nativeMod.ZionAudioBridge();
            engine.initialize();
            const proto = Object.getPrototypeOf(engine);
            const names = proto ? Object.getOwnPropertyNames(proto) : [];
            if (!names.includes('setPitchSemitones') || !names.includes('setTempoRatio')) {
                console.error(
                    '[Zion] El .node no expone setPitchSemitones/setTempoRatio. Cierra Electron, ejecuta npm run rebuild:native y vuelve a abrir.'
                );
            }
        } catch (e) {
            console.error('[Zion] Error al inicializar ZionAudioBridge:', e);
            engine = null;
        }
    }

    ipcMain.handle('db:get-songs', () => db.getSongs());
    ipcMain.handle('db:save-song', (e, song) => db.saveSong(song));
    ipcMain.handle('db:delete-song', (e, id) => db.deleteSong(id));
    ipcMain.handle('db:get-setlists', () => db.getSetlists());
    ipcMain.handle('db:save-setlist', (e, sl) => db.saveSetlist(sl));
    ipcMain.handle('db:get-license', () => db.getLicense());
    ipcMain.handle('db:save-license', (e, serial, mode) => db.saveLicense(serial, mode));
    ipcMain.handle('db:save-user', (e, user) => db.saveUser(user));
    ipcMain.handle('db:get-user', () => db.getUser());
    ipcMain.handle('db:delete-user', () => db.deleteUser());

    ipcMain.handle('cache:save', async (e, filename, buffer) => {
        const nodeBuffer = Buffer.from(buffer);
        return await encCache.saveEncryptedFile(filename, nodeBuffer);
    });
    ipcMain.handle('cache:read', (e, filename) => encCache.readDecryptedBuffer(filename));
    ipcMain.handle('cache:exists', (e, filename) => encCache.fileExists(filename));

    ipcMain.on('audio:play', () => {
        if (engine) engine.play();
    });
    ipcMain.on('audio:pause', () => {
        if (engine) engine.pause();
    });
    ipcMain.on('audio:stop', () => {
        if (engine) engine.stop();
    });
    ipcMain.on('audio:seek', (_e, pos) => {
        if (engine) engine.seek(typeof pos === 'number' ? pos : 0);
    });
    ipcMain.handle('audio:set-pitch', (_e, semi) => {
        try {
            if (!engine) {
                console.warn('[Zion] set-pitch: sin motor nativo');
                return false;
            }
            if (typeof engine.setPitchSemitones !== 'function') {
                console.error('[Zion] set-pitch: recompila ZionAudioCore (npm run rebuild:native)');
                return false;
            }
            const s = typeof semi === 'number' ? semi : parseFloat(String(semi));
            engine.setPitchSemitones(Number.isFinite(s) ? s : 0);
            return true;
        } catch (e) {
            console.error('[Zion] set-pitch', e);
            return false;
        }
    });
    ipcMain.handle('audio:set-tempo', (_e, ratio) => {
        try {
            if (!engine) {
                console.warn('[Zion] set-tempo: sin motor nativo');
                return false;
            }
            if (typeof engine.setTempoRatio !== 'function') {
                console.error('[Zion] set-tempo: recompila ZionAudioCore (npm run rebuild:native)');
                return false;
            }
            const r = typeof ratio === 'number' ? ratio : parseFloat(String(ratio));
            engine.setTempoRatio(Number.isFinite(r) && r > 0 ? r : 1);
            return true;
        } catch (e) {
            console.error('[Zion] set-tempo', e);
            return false;
        }
    });

    ipcMain.handle('audio:load', async (_e, tracks) => {
        if (!engine || !Array.isArray(tracks)) return false;
        const decryptedTracks = [];
        for (const t of tracks) {
            const nameKey = t.filename || (t.id && t.name ? `${t.id}_${t.name}` : null);
            if (!nameKey) continue;
            const decPath = await encCache.getDecryptedTempPath(nameKey);
            if (decPath) {
                decryptedTracks.push({ ...t, path: decPath });
            }
        }
        if (decryptedTracks.length === 0) {
            console.warn('[Zion] audio:load — sin stems desencriptados (¿faltan archivos en .zionpack?)');
            return false;
        }
        try {
            return engine.loadStemsFromPaths(decryptedTracks);
        } catch (err) {
            console.error('[Zion] loadStemsFromPaths:', err);
            return false;
        }
    });

    ipcMain.handle('audio:get-snapshot', () => {
        if (!engine) return '{"positionSec":0,"durationSec":0}';
        try {
            return engine.getPlaybackSnapshot();
        } catch (_) {
            return '{"positionSec":0,"durationSec":0}';
        }
    });

    ipcMain.on('audio:set-volume', () => {});
    ipcMain.on('audio:set-mute', () => {});
    ipcMain.on('audio:set-solo', () => {});

    ipcMain.handle('audio:get-hwid', () => (engine ? engine.getHardwareId() : 'NO-ENGINE'));

    createWindow();
});
