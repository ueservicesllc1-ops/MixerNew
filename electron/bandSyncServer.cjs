/**
 * Band Sync — servidor HTTP ligero en el proceso principal de Electron.
 * Los músicos abren http://<LAN>:<puerto>/band en el móvil (misma Wi‑Fi);
 * el mixer empuja estado vía SSE (sin dependencia ws).
 */
const http = require('http');
const os = require('os');

let httpServer = null;
let listenPort = 0;
/** @type {{ res: import('http').ServerResponse }[]} */
let sseClients = [];
/** @type {Record<string, unknown>} */
let latestState = {};

function getLanIPv4() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            const fam = net.family;
            const is4 = fam === 'IPv4' || fam === 4;
            if (is4 && !net.internal) return net.address;
        }
    }
    return '127.0.0.1';
}

function buildInfo() {
    const ip = getLanIPv4();
    const running = !!httpServer && listenPort > 0;
    const url = running ? `http://${ip}:${listenPort}/band` : '';
    return {
        running,
        port: listenPort,
        ip,
        url,
        wsUrl: url,
        clients: sseClients.length,
    };
}

function sseWrite(res, event, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\ndata: ${payload}\n\n`);
}

function fanFollowerHtml() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Zion Stage — Band Sync</title>
  <style>
    :root { --bg:#0b1220; --card:#111827; --muted:#94a3b8; --accent:#22d3ee; --text:#f1f5f9; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:var(--bg); color:var(--text); min-height:100vh; padding:12px; }
    h1 { font-size:1rem; font-weight:800; margin:0 0 4px; color:var(--accent); letter-spacing:.04em; }
    .sub { font-size:.72rem; color:var(--muted); margin-bottom:14px; }
    .card { background:var(--card); border-radius:12px; padding:12px 14px; margin-bottom:10px; border:1px solid #1e293b; }
    .row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    .pill { font-size:.68rem; font-weight:700; padding:4px 8px; border-radius:999px; background:#1e293b; color:#cbd5e1; }
    .pill.on { background:#14532d; color:#86efac; }
    .song { font-size:1.15rem; font-weight:800; line-height:1.25; }
    .setlist { font-size:.8rem; color:var(--muted); margin-top:6px; }
    ul.set { list-style:none; padding:0; margin:8px 0 0; max-height:28vh; overflow:auto; }
    ul.set li { padding:8px 10px; border-radius:8px; margin-bottom:4px; font-size:.82rem; border:1px solid transparent; }
    ul.set li.active { border-color:var(--accent); background:rgba(34,211,238,.08); }
    .scroll { white-space:pre-wrap; word-break:break-word; font-size:.95rem; line-height:1.45; max-height:42vh; overflow:auto; }
    .marker { font-size:.75rem; font-weight:800; color:#fbbf24; margin-bottom:6px; }
    a.pdf { color:var(--accent); font-size:.85rem; word-break:break-all; }
    .empty { color:var(--muted); font-size:.85rem; }
  </style>
</head>
<body>
  <h1>ZION STAGE — BAND SYNC</h1>
  <div class="sub">Vista seguidora · misma red Wi‑Fi que el mixer</div>
  <div class="card row">
    <span class="pill" id="playPill">…</span>
    <span class="pill" id="timePill">0:00</span>
    <span class="pill" id="viewPill">—</span>
  </div>
  <div class="card">
    <div class="song" id="songName">Esperando…</div>
    <div class="setlist" id="setlistName"></div>
    <ul class="set" id="setlistUl"></ul>
  </div>
  <div class="card">
    <div class="marker" id="markerLbl">—</div>
    <div class="scroll" id="mainText"></div>
  </div>
  <div class="card" id="chordsBlock" style="display:none">
    <div class="pill" style="margin-bottom:8px">Acordes</div>
    <div class="scroll" id="chordsText"></div>
  </div>
  <div class="card" id="pdfBlock" style="display:none">
    <div class="pill" style="margin-bottom:8px">Partitura</div>
    <a class="pdf" id="pdfLink" href="#" target="_blank" rel="noopener">Abrir PDF</a>
  </div>
  <script>
    function esc(s) { return String(s == null ? '' : s); }
    function fmtTime(t) {
      var x = Number(t);
      if (!isFinite(x) || x < 0) x = 0;
      var m = Math.floor(x / 60);
      var sec = Math.floor(x % 60);
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }
    function render(s) {
      if (!s || typeof s !== 'object') s = {};
      document.getElementById('songName').textContent = esc(s.songName || '—');
      var sn = esc(s.setlistName || '');
      document.getElementById('setlistName').textContent = sn ? ('Setlist: ' + sn) : '';
      var ul = document.getElementById('setlistUl');
      ul.innerHTML = '';
      var songs = Array.isArray(s.setlistSongs) ? s.setlistSongs : [];
      var idx = Number(s.activeSongIndex);
      for (var i = 0; i < songs.length; i++) {
        var li = document.createElement('li');
        li.textContent = esc(songs[i].name || songs[i].id || '—');
        if (i === idx) li.className = 'active';
        ul.appendChild(li);
      }
      if (!songs.length) {
        var li0 = document.createElement('li');
        li0.className = 'empty';
        li0.textContent = 'Sin setlist en vivo';
        ul.appendChild(li0);
      }
      var play = document.getElementById('playPill');
      play.textContent = s.isPlaying ? '▶ REPRODUCIENDO' : '■ PAUSA';
      play.className = 'pill' + (s.isPlaying ? ' on' : '');
      document.getElementById('timePill').textContent = fmtTime(s.time);
      document.getElementById('viewPill').textContent = esc(s.viewMode || '—').toUpperCase();
      document.getElementById('markerLbl').textContent = 'SECCIÓN: ' + esc(s.activeMarkerLabel || '—');
      var vm = String(s.viewMode || '').toLowerCase();
      var lyricsMain = vm === 'chords' ? esc(s.chordsText || s.lyricsSection || '') : esc(s.lyricsSection || s.lyricsText || '');
      document.getElementById('mainText').textContent = lyricsMain || '(sin texto en esta vista)';
      var cb = document.getElementById('chordsBlock');
      var ct = document.getElementById('chordsText');
      if (vm === 'chords') {
        cb.style.display = 'none';
      } else {
        var ch = esc(s.chordsText || '');
        if (ch) {
          cb.style.display = 'block';
          ct.textContent = ch;
        } else {
          cb.style.display = 'none';
        }
      }
      var pb = document.getElementById('pdfBlock');
      var pl = document.getElementById('pdfLink');
      var sp = s.selectedPartitura;
      if (sp && sp.pdfUrl) {
        pb.style.display = 'block';
        pl.href = esc(sp.pdfUrl);
        pl.textContent = esc(sp.title || sp.instrument || 'PDF');
      } else {
        pb.style.display = 'none';
        pl.removeAttribute('href');
      }
    }
    fetch('/band/api/state').then(function(r) { return r.json(); }).then(render).catch(function() {});
    try {
      var es = new EventSource('/band/stream');
      es.addEventListener('state', function(e) {
        try { render(JSON.parse(e.data)); } catch (err) {}
      });
      es.onerror = function() { /* reconexión automática del navegador */ };
    } catch (e) {}
  </script>
</body>
</html>`;
}

function handleRequest(req, res) {
    const host = req.headers.host || 'localhost';
    let pathname = '/';
    try {
        pathname = new URL(req.url || '/', `http://${host}`).pathname;
    } catch {
        pathname = (req.url || '/').split('?')[0] || '/';
    }

    if (pathname === '/band' || pathname === '/band/') {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        res.end(fanFollowerHtml());
        return;
    }

    if (pathname === '/band/api/state') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(latestState));
        return;
    }

    if (pathname === '/band/stream') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });
        if (typeof res.flushHeaders === 'function') res.flushHeaders();
        sseWrite(res, 'state', latestState);
        const client = { res };
        sseClients.push(client);
        req.on('close', () => {
            sseClients = sseClients.filter((c) => c !== client);
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
}

function broadcastState(state) {
    latestState = state && typeof state === 'object' ? state : {};
    const snapshot = { ...latestState };
    for (const { res } of sseClients) {
        try {
            sseWrite(res, 'state', snapshot);
        } catch (_) {
            /* ignore broken pipe */
        }
    }
}

function start(preferredPort = 8080) {
    return new Promise((resolve) => {
        if (httpServer && listenPort) {
            resolve(buildInfo());
            return;
        }

        const base = Math.max(1024, Math.min(65535, Number(preferredPort) || 8080));
        let p = base;

        const attempt = () => {
            const srv = http.createServer(handleRequest);
            srv.once('error', (err) => {
                if (err && err.code === 'EADDRINUSE' && p < base + 80) {
                    p += 1;
                    attempt();
                    return;
                }
                console.error('[BandSync] listen failed', err);
                resolve({ running: false, port: 0, ip: getLanIPv4(), url: '', wsUrl: '', clients: 0 });
            });
            srv.listen(p, '0.0.0.0', () => {
                httpServer = srv;
                listenPort = p;
                console.log('[BandSync] listening', buildInfo().url);
                resolve(buildInfo());
            });
        };

        attempt();
    });
}

function stop() {
    for (const { res } of sseClients) {
        try {
            res.end();
        } catch (_) { /* ignore */ }
    }
    sseClients = [];
    if (httpServer) {
        try {
            httpServer.close();
        } catch (_) { /* ignore */ }
        httpServer = null;
    }
    listenPort = 0;
    return buildInfo();
}

function getInfo() {
    return buildInfo();
}

module.exports = {
    start,
    stop,
    getInfo,
    broadcastState,
};
