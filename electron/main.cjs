const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db.cjs');
const encCache = require('./EncryptedCacheService.cjs');

/** Título de diálogos nativos (alert/confirm del renderer) y nombre visible de la app. */
app.setName('Zion Stage');

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

/** Icono ventana / barra de tareas: mismo asset que la web (`public/logo2.png` tras build → `dist/logo2.png`). */
function resolveZionWindowIcon() {
    const candidates = [
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, '../public/logo2.png'),
        path.join(__dirname, '../dist/logo2.png'),
        path.join(__dirname, '../public/logo2blanco.png'),
        path.join(__dirname, '../dist/logo2blanco.png'),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return p;
        } catch (_) { /* ignore */ }
    }
    return undefined;
}

function resolveSplashLogoPath() {
    const candidates = [
        path.join(__dirname, '../public/logo2blanco.png'),
        path.join(__dirname, '../dist/logo2blanco.png'),
        path.join(__dirname, '../public/logo2blanco.webp'),
        path.join(__dirname, '../dist/logo2blanco.webp'),
        path.join(__dirname, '../public/logo2blanco.jpg'),
        path.join(__dirname, '../public/logo2blanco.jpeg'),
        path.join(__dirname, '../dist/logo2blanco.jpg'),
        path.join(__dirname, '../dist/logo2blanco.jpeg'),
        path.join(__dirname, '../public/logo2blanco'),
        path.join(__dirname, '../dist/logo2blanco'),
        path.join(__dirname, '../dist/logo2.png'),
        path.join(__dirname, '../public/logo2.png'),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return p;
        } catch (_) { /* ignore */ }
    }
    return undefined;
}

function buildSplashHtml() {
    const logoPath = resolveSplashLogoPath();
    let logoDataUrl = '';
    try {
        if (logoPath && fs.existsSync(logoPath)) {
            const buf = fs.readFileSync(logoPath);
            const lower = logoPath.toLowerCase();
            let mime = 'image/png';
            if (lower.endsWith('.svg')) mime = 'image/svg+xml';
            else if (lower.endsWith('.webp')) mime = 'image/webp';
            else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
            logoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
        }
    } catch (_) {
        logoDataUrl = '';
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Zion Stage</title>
  <style>
    @keyframes logoIntro {
      0% {
        opacity: 0;
        transform: translateY(8px) scale(0.94);
        filter: drop-shadow(0 0 0 rgba(0, 210, 211, 0));
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 14px rgba(0, 210, 211, 0.28));
      }
    }
    @keyframes logoPulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.028);
      }
    }
    @keyframes brandFade {
      0% { opacity: 0; letter-spacing: 0.2em; }
      100% { opacity: 0.72; letter-spacing: 0.12em; }
    }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 14px;
    }
    .logo {
      width: min(42vw, 280px);
      max-width: 280px;
      object-fit: contain;
      filter: drop-shadow(0 0 14px rgba(0, 210, 211, 0.25));
      animation:
        logoIntro 420ms ease-out both,
        logoPulse 1800ms ease-in-out 500ms infinite;
      transform-origin: center;
    }
    .brand {
      color: #e5e7eb;
      letter-spacing: 0.12em;
      font-weight: 700;
      font-size: 12px;
      opacity: 0.72;
      animation: brandFade 520ms ease-out both;
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Zion Stage" />` : ''}
  </div>
</body>
</html>`;
}

function createWindow() {
    const icon = resolveZionWindowIcon();
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Zion Stage Desktop',
        backgroundColor: '#0a0a12',
        ...(icon ? { icon } : {}),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
        },
    });

    // Splash de arranque: pantalla negra con logo Zion por 3 segundos.
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildSplashHtml()));
    setTimeout(() => {
        if (win.isDestroyed()) return;
        const { mode, target } = resolveLoadTarget();
        if (mode === 'file') {
            win.loadFile(target, { hash: '/desktop' });
        } else {
            win.loadURL(target);
        }
    }, 3000);
}

app.whenReady().then(() => {
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.zionstage.desktop');
    }
    const dockIcon = resolveZionWindowIcon();
    if (dockIcon && app.dock) {
        try {
            app.dock.setIcon(dockIcon);
        } catch (_) { /* no dock (Windows/Linux) */ }
    }

    encCache.cleanTemp();

    let engine = null;
    if (nativeMod) {
        try {
            engine = new nativeMod.ZionAudioBridge();
            engine.initialize();
            const proto = Object.getPrototypeOf(engine);
            const names = proto ? Object.getOwnPropertyNames(proto) : [];
            if (!names.includes('setPitchSemitones') || !names.includes('setTempoRatio')
                || !names.includes('setTrackVolume') || !names.includes('setTrackMute')
                || !names.includes('setTrackSolo')) {
                console.error(
                    '[Zion] El .node está desactualizado (faltan setTrackVolume/mute/solo o pitch/tempo). Cierra Zion Stage, ejecuta npm run rebuild:native y vuelve a abrir.'
                );
            }
        } catch (e) {
            console.error('[Zion] Error al inicializar ZionAudioBridge:', e);
            engine = null;
        }
    }

    ipcMain.handle('db:get-songs', () => db.getSongs());
    ipcMain.handle('db:get-song', (e, id) => db.getSong(id));
    ipcMain.handle('db:save-song', (e, song) => db.saveSong(song));
    ipcMain.handle('db:delete-song', (e, id) => db.deleteSong(id));
    ipcMain.handle('db:get-setlists', () => db.getSetlists());
    ipcMain.handle('db:save-setlist', (e, sl) => db.saveSetlist(sl));
    ipcMain.handle('db:get-license', () => db.getLicense());
    ipcMain.handle('db:save-license', (e, serial, mode) => db.saveLicense(serial, mode));
    ipcMain.handle('db:save-user', (e, user) => db.saveUser(user));
    ipcMain.handle('db:get-user', () => db.getUser());
    ipcMain.handle('db:delete-user', () => db.deleteUser());

    /** Coma-separados; si está vacío, cualquier host https permitido (solo .exe). */
    function parseAllowedDesktopUpdateHosts() {
        const raw = process.env.ZION_DESKTOP_UPDATE_HOSTS || '';
        if (!String(raw).trim()) return null;
        return String(raw).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    }

    ipcMain.handle('desktop:download-and-launch-update', async (_e, urlStr) => {
        const urlNorm = (typeof urlStr === 'string' ? urlStr : '').trim();
        let u;
        try {
            u = new URL(urlNorm);
        } catch {
            return { ok: false, error: 'URL no válida' };
        }
        if (u.protocol !== 'https:') {
            return { ok: false, error: 'Solo se permiten enlaces https' };
        }
        const pathname = u.pathname.toLowerCase();
        if (!pathname.endsWith('.exe')) {
            return { ok: false, error: 'El instalador debe ser un archivo .exe' };
        }
        const allowed = parseAllowedDesktopUpdateHosts();
        if (allowed?.length && !allowed.includes(u.hostname.toLowerCase())) {
            return { ok: false, error: 'Dominio del instalador no permitido' };
        }
        const dest = path.join(app.getPath('temp'), `zion_stage_update_${Date.now()}.exe`);
        try {
            const res = await fetch(urlNorm, { redirect: 'follow' });
            if (!res.ok) {
                return { ok: false, error: `Descarga fallida (${res.status})` };
            }
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 50_000) {
                return { ok: false, error: 'Archivo demasiado pequeño o corrupto' };
            }
            await fs.promises.writeFile(dest, buf, { mode: 0o644 });
            const errMsg = await shell.openPath(dest);
            if (errMsg) {
                return { ok: false, error: errMsg };
            }
            return { ok: true, path: dest };
        } catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });

    ipcMain.handle('cache:save', async (e, filename, buffer) => {
        const nodeBuffer = Buffer.from(buffer);
        return await encCache.saveEncryptedFile(filename, nodeBuffer);
    });
    ipcMain.handle('cache:read', (e, filename) => encCache.readDecryptedBuffer(filename));
    ipcMain.handle('cache:exists', (e, filename) => encCache.fileExists(filename));

    function sanitizePcStemName(raw) {
        let s = String(raw || 'Stem').replace(/\.[^.]+$/i, '');
        s = s.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '').trim().replace(/\s+/g, '_');
        if (!s) s = 'Stem';
        return s.slice(0, 48);
    }

    function parseSongTracksFromRow(row) {
        if (!row?.tracks_json) return [];
        try {
            const p = JSON.parse(row.tracks_json);
            if (Array.isArray(p)) return p;
            return Array.isArray(p.tracks) ? p.tracks : [];
        } catch {
            return [];
        }
    }

    /** Stems en caché cifrada o import PC por ruta local (sin copiar a .zionpack). */
    ipcMain.handle('desktop:resolve-stem', (_e, songId, stemName, isNormalized) => {
        try {
            const row = db.getSong(songId);
            const tracks = parseSongTracksFromRow(row);
            const tr = tracks.find((t) => t && t.name === stemName);
            if (!tr) return { ok: false };

            const src = String(tr.sourceAbsolutePath || '').trim();
            if (!isNormalized && src && fs.existsSync(src)) {
                const low = src.toLowerCase();
                if (low.endsWith('.mp3') || low.endsWith('.wav') || low.endsWith('.flac')) {
                    return { ok: true, ref: src };
                }
            }

            const base = `${songId}_${stemName}`;
            if (isNormalized) {
                const fl = `${base}.flac`;
                if (encCache.fileExists(fl)) return { ok: true, ref: fl };
            } else {
                for (const ext of ['.mp3', '.wav', '.flac']) {
                    const k = base + ext;
                    if (encCache.fileExists(k)) return { ok: true, ref: k };
                }
            }
            return { ok: false };
        } catch (e) {
            console.error('[Zion] desktop:resolve-stem', e);
            return { ok: false };
        }
    });

    /** Un stem en bruto para decodificar la onda en el renderer (sin __PreviewMix). */
    ipcMain.handle('desktop:read-waveform-stem-buffer', async (_e, songId) => {
        try {
            const row = db.getSong(songId);
            const tracks = parseSongTracksFromRow(row).filter((t) => t && t.name && t.name !== '__PreviewMix');
            const scoreStem = (tr) => {
                const nm = (tr.name || '').toLowerCase();
                if (nm.includes('click') || nm.includes('guide') || nm.includes('guia') || nm.includes('cue')) return -1;
                if (nm.includes('drum') || nm.includes('bass') || nm.includes('kick')) return 50;
                return 10;
            };
            let best = null;
            let bestS = -999;
            for (const tr of tracks) {
                const s = scoreStem(tr);
                if (s > bestS) {
                    bestS = s;
                    best = tr;
                }
            }
            if (!best) return null;

            const src = String(best.sourceAbsolutePath || '').trim();
            if (src && fs.existsSync(src)) {
                return fs.readFileSync(src);
            }

            const keyCandidates = [best.cacheKey, best.localPath, `${songId}_${best.name}.mp3`, `${songId}_${best.name}.wav`].filter(Boolean);
            for (const k of keyCandidates) {
                const bn = path.basename(String(k).trim());
                if (!bn) continue;
                const decPath = await encCache.getDecryptedTempPath(bn);
                if (decPath && fs.existsSync(decPath)) {
                    return fs.readFileSync(decPath);
                }
            }
            return null;
        } catch (e) {
            console.error('[Zion] desktop:read-waveform-stem-buffer', e);
            return null;
        }
    });

    ipcMain.handle('desktop:pick-pc-audio-folder', async () => {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!win) return { canceled: true };
        const r = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Carpeta con stems (.mp3, .wav)',
        });
        if (r.canceled || !r.filePaths?.[0]) return { canceled: true };
        const dir = r.filePaths[0];
        let names;
        try {
            names = fs.readdirSync(dir);
        } catch (e) {
            console.error('[Zion] pick-pc-audio-folder readdir', e);
            return { canceled: true, error: String(e.message || e) };
        }
        const files = [];
        const seen = new Set();
        for (const n of names) {
            const low = n.toLowerCase();
            if (!low.endsWith('.mp3') && !low.endsWith('.wav')) continue;
            const stemRaw = path.basename(n, path.extname(n));
            let stem = sanitizePcStemName(stemRaw);
            let key = stem.toLowerCase();
            let k = 2;
            while (seen.has(key)) {
                stem = `${stem}_${k}`;
                key = stem.toLowerCase();
                k += 1;
            }
            seen.add(key);
            files.push({
                stemName: stem,
                absolutePath: path.join(dir, n),
            });
        }
        const suggestedSongTitle = path.basename(dir) || '';
        return { canceled: false, folderPath: dir, files, pickMode: 'folder', suggestedSongTitle };
    });

    /** Selección múltiple de .mp3 / .wav (no hace falta que estén en la misma carpeta). */
    ipcMain.handle('desktop:pick-pc-audio-files', async () => {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!win) return { canceled: true };
        const r = await dialog.showOpenDialog(win, {
            title: 'Selecciona los stems (.mp3, .wav)',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Audio stems', extensions: ['mp3', 'wav'] }],
        });
        if (r.canceled || !r.filePaths?.length) return { canceled: true };
        const files = [];
        const seen = new Set();
        for (const abs of r.filePaths) {
            const low = String(abs).toLowerCase();
            if (!low.endsWith('.mp3') && !low.endsWith('.wav')) continue;
            const n = path.basename(abs);
            const stemRaw = path.basename(n, path.extname(n));
            let stem = sanitizePcStemName(stemRaw);
            let key = stem.toLowerCase();
            let k = 2;
            while (seen.has(key)) {
                stem = `${stem}_${k}`;
                key = stem.toLowerCase();
                k += 1;
            }
            seen.add(key);
            files.push({
                stemName: stem,
                absolutePath: abs,
            });
        }
        if (!files.length) {
            return { canceled: true, error: 'No se seleccionaron archivos .mp3 o .wav válidos.' };
        }
        const dirs = new Set(files.map((f) => path.dirname(f.absolutePath)));
        let folderPath;
        let suggestedSongTitle = '';
        if (dirs.size === 1) {
            folderPath = [...dirs][0];
            suggestedSongTitle = path.basename(folderPath) || '';
        } else {
            folderPath = `${files.length} archivo(s) en ${dirs.size} carpetas distintas`;
        }
        return { canceled: false, folderPath, files, pickMode: 'files', suggestedSongTitle };
    });

    ipcMain.handle('desktop:import-pc-song', async (_e, payload) => {
        try {
            const { songId, name, artist, tempo, key, stems } = payload || {};
            if (!songId || !Array.isArray(stems) || stems.length === 0) {
                return { ok: false, error: 'Datos incompletos' };
            }
            const manifestTracks = [];
            for (const s of stems) {
                if (!s?.absolutePath || !fs.existsSync(s.absolutePath)) {
                    return { ok: false, error: `Archivo no encontrado: ${s?.absolutePath || ''}` };
                }
                const stemName = sanitizePcStemName(s.stemName);
                const absNorm = path.resolve(s.absolutePath);
                manifestTracks.push({
                    name: stemName,
                    id: `${songId}_${stemName}`,
                    url: 'local-file',
                    sourceAbsolutePath: absNorm,
                    isDownloaded: true,
                    isPcImportStem: true,
                });
            }
            db.saveSong({
                id: songId,
                name: String(name || 'Sin título').slice(0, 200),
                artist: String(artist || '').slice(0, 200),
                tempo: parseInt(String(tempo || 120), 10) || 120,
                key: String(key || 'C').slice(0, 24),
                tracks: manifestTracks,
                downloaded: true,
                previewMixLocalPath: null,
            });
            return { ok: true, songId, manifestTracks };
        } catch (e) {
            console.error('[Zion] desktop:import-pc-song', e);
            return { ok: false, error: String(e.message || e) };
        }
    });

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

    function basenameKey(p) {
        if (!p || typeof p !== 'string') return '';
        const s = String(p).trim();
        const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        return i >= 0 ? s.slice(i + 1) : s;
    }

    function inferSongIdFromTrack(t) {
        const id = String(t?.id || '');
        const name = String(t?.name || '');
        if (!id || !name) return '';
        const suffix = `_${name}`;
        if (id.endsWith(suffix)) return id.slice(0, -suffix.length);
        const u = id.indexOf('_');
        return u > 0 ? id.slice(0, u) : '';
    }

    async function resolveEncryptedCacheKey(track) {
        const rawPath = String(track?.path || track?.filename || '').trim();
        if (rawPath && path.isAbsolute(rawPath)) {
            const low = rawPath.toLowerCase();
            if ((low.endsWith('.mp3') || low.endsWith('.wav') || low.endsWith('.flac')) && fs.existsSync(rawPath)) {
                return { key: basenameKey(rawPath), decPath: rawPath };
            }
        }
        const keys = [];
        const direct = basenameKey(track?.filename || track?.path || '');
        if (direct) {
            keys.push(direct);
            if (!direct.includes('.')) {
                keys.push(`${direct}.mp3`, `${direct}.wav`, `${direct}.flac`);
            }
        }
        const songId = inferSongIdFromTrack(track);
        if (songId && track?.name) {
            const base = `${songId}_${track.name}`;
            keys.push(`${base}.mp3`, `${base}.wav`, `${base}.flac`);
        } else if (track?.id) {
            keys.push(`${track.id}.mp3`, `${track.id}.wav`, `${track.id}.flac`);
        }
        // dedupe preserving order
        const seen = new Set();
        for (const key of keys) {
            const k = basenameKey(key);
            if (!k || seen.has(k)) continue;
            seen.add(k);
            const decPath = await encCache.getDecryptedTempPath(k);
            if (decPath) return { key: k, decPath };
        }
        return null;
    }

    ipcMain.handle('audio:load', async (_e, tracks) => {
        if (!engine || !Array.isArray(tracks)) return false;
        const decryptedTracks = [];
        for (const t of tracks) {
            const resolved = await resolveEncryptedCacheKey(t);
            if (!resolved) continue;
            decryptedTracks.push({ ...t, filename: resolved.key, path: resolved.decPath });
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

    ipcMain.on('audio:set-volume', (_e, id, vol) => {
        try {
            if (!engine || typeof engine.setTrackVolume !== 'function') return;
            const tid = id != null ? String(id) : '';
            const v = typeof vol === 'number' ? vol : parseFloat(String(vol));
            engine.setTrackVolume(tid, Number.isFinite(v) ? v : 1);
        } catch (e) {
            console.error('[Zion] audio:set-volume', e);
        }
    });
    ipcMain.on('audio:set-mute', (_e, id, muted) => {
        try {
            if (!engine || typeof engine.setTrackMute !== 'function') return;
            const tid = id != null ? String(id) : '';
            const m = muted === true || muted === 1 || muted === '1' || muted === 'true';
            engine.setTrackMute(tid, m);
        } catch (e) {
            console.error('[Zion] audio:set-mute', e);
        }
    });
    ipcMain.on('audio:set-solo', (_e, id, solo) => {
        try {
            if (!engine || typeof engine.setTrackSolo !== 'function') return;
            const tid = id != null ? String(id) : '';
            const s = solo === true || solo === 1 || solo === '1' || solo === 'true';
            engine.setTrackSolo(tid, s);
        } catch (e) {
            console.error('[Zion] audio:set-solo', e);
        }
    });

    ipcMain.handle('audio:get-hwid', () => (engine ? engine.getHardwareId() : 'NO-ENGINE'));

    createWindow();
});
