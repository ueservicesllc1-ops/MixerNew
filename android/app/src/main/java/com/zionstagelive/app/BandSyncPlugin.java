package com.zionstagelive.app;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.text.format.Formatter;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoWSD;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoWSD.WebSocket;
import fi.iki.elonen.NanoWSD.WebSocketFrame;
import fi.iki.elonen.NanoWSD.WebSocketFrame.CloseCode;

import java.io.IOException;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(name = "BandSyncBridge")
public class BandSyncPlugin extends Plugin {
    private static final String TAG = "BandSyncBridge";
    private static final int DEFAULT_PORT = 8080;

    private BandSyncServer server;
    private int currentPort = DEFAULT_PORT;
    private final AtomicReference<String> latestState = new AtomicReference<>("{}");

    @PluginMethod
    public synchronized void startServer(PluginCall call) {
        Integer requestedPort = call.getInt("port");
        int port = requestedPort != null && requestedPort > 0 ? requestedPort : DEFAULT_PORT;

        if (server != null) {
            JSObject ret = buildInfoObject(true);
            call.resolve(ret);
            return;
        }

        server = new BandSyncServer(port);
        try {
            server.start();
            currentPort = port;
            JSObject ret = buildInfoObject(true);
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "Cannot start Band Sync server", e);
            server = null;
            call.reject("No se pudo iniciar Band Sync server: " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void stopServer(PluginCall call) {
        if (server != null) {
            server.stop();
            server = null;
        }
        JSObject ret = buildInfoObject(false);
        call.resolve(ret);
    }

    @PluginMethod
    public synchronized void getServerInfo(PluginCall call) {
        JSObject ret = buildInfoObject(server != null);
        call.resolve(ret);
    }

    @PluginMethod
    public synchronized void broadcastState(PluginCall call) {
        JSObject state = call.getObject("state");
        String payload = "{}";

        if (state != null) {
            try {
                payload = state.toString();
            } catch (Exception e) {
                Log.w(TAG, "broadcastState payload serialization failed", e);
            }
        }

        latestState.set(payload);

        if (server != null) {
            server.broadcast(payload);
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("clients", server != null ? server.clientCount() : 0);
        call.resolve(ret);
    }

    private JSObject buildInfoObject(boolean running) {
        String ip = getLocalIpAddress();
        JSObject ret = new JSObject();
        ret.put("running", running);
        ret.put("port", currentPort);
        ret.put("ip", ip);
        ret.put("url", "http://" + ip + ":" + currentPort + "/");
        ret.put("wsUrl", "ws://" + ip + ":" + currentPort + "/ws");
        ret.put("clients", server != null ? server.clientCount() : 0);
        return ret;
    }

    private String getLocalIpAddress() {
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && wm.getConnectionInfo() != null) {
                int ip = wm.getConnectionInfo().getIpAddress();
                if (ip != 0) {
                    return Formatter.formatIpAddress(ip);
                }
            }
        } catch (Exception ignored) {
        }

        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (java.net.InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (!addr.isLoopbackAddress() && addr instanceof java.net.Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }

        return "127.0.0.1";
    }

    private class BandSyncServer extends NanoWSD {
        private final Set<BandSyncSocket> sockets = ConcurrentHashMap.newKeySet();

        BandSyncServer(int port) {
            super(port);
        }

        @Override
        protected Response serveHttp(NanoHTTPD.IHTTPSession session) {
            String uri = session.getUri() == null ? "/" : session.getUri();

            if ("/state".equals(uri)) {
                Response res = NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "application/json", latestState.get());
                res.addHeader("Access-Control-Allow-Origin", "*");
                return res;
            }

            if ("/health".equals(uri)) {
                return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "text/plain", "ok");
            }

            Response res = NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", viewerHtml());
            res.addHeader("Cache-Control", "no-store");
            return res;
        }

        @Override
        protected WebSocket openWebSocket(NanoHTTPD.IHTTPSession handshake) {
            return new BandSyncSocket(handshake);
        }

        void broadcast(String payload) {
            for (BandSyncSocket socket : sockets) {
                try {
                    socket.send(payload);
                } catch (IOException ignored) {
                }
            }
        }

        int clientCount() {
            return sockets.size();
        }

        private class BandSyncSocket extends WebSocket {
            BandSyncSocket(NanoHTTPD.IHTTPSession handshakeRequest) {
                super(handshakeRequest);
            }

            @Override
            protected void onOpen() {
                sockets.add(this);
                try {
                    send(latestState.get());
                } catch (IOException ignored) {
                }
            }

            @Override
            protected void onClose(CloseCode code, String reason, boolean initiatedByRemote) {
                sockets.remove(this);
            }

            @Override
            protected void onMessage(WebSocketFrame message) {
                // Read-only channel for musicians in MVP.
            }

            @Override
            protected void onPong(WebSocketFrame pong) {
            }

            @Override
            protected void onException(IOException exception) {
                sockets.remove(this);
            }
        }
    }

    private String viewerHtml() {
        return "<!doctype html><html><head><meta charset='utf-8'/>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'/>"
            + "<title>Zion Band Sync</title>"
            + "<style>:root{--bg:#050b18;--bg2:#0f172a;--line:#223247;--text:#e2e8f0;--muted:#94a3b8}*{box-sizing:border-box}body{margin:0;background:radial-gradient(120% 120% at 50% 0%,#0a1a31 0%,var(--bg) 55%);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif}header{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;background:rgba(8,15,30,.9);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}.wrap{padding:12px;display:grid;gap:10px}.meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#mk{display:inline-flex;align-items:center;justify-content:center;background:#0891b2;border:1px solid #22d3ee;color:#ecfeff;padding:6px 10px;border-radius:999px;font-weight:800;font-size:.78rem}#meta{font-size:.78rem;color:var(--muted)}#song{font-size:clamp(1.2rem,4.2vw,2rem);font-weight:900;line-height:1.15;margin:2px 0 0}.tabs{display:flex;gap:6px;overflow:auto}.tabs button{appearance:none;background:var(--bg2);border:1px solid #2a3b51;color:#dbeafe;border-radius:9px;padding:7px 10px;font-weight:700;font-size:.8rem;white-space:nowrap}.tabs button.active{background:#0e2538;border-color:#2dd4bf}.controls{display:flex;gap:6px;flex-wrap:wrap}.controls button{appearance:none;background:#0b1220;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:6px 10px;font-weight:700;font-size:.76rem}.controls .pill{padding:6px 9px;color:#94a3b8;border:1px solid #334155;border-radius:8px;font-size:.72rem}.grid{display:grid;gap:10px}.panel,.card{background:linear-gradient(180deg,#0d1728 0%,#0a1322 100%);border:1px solid #203047;border-radius:12px}.panel{padding:12px;min-height:34vh;overflow:auto}#panel{font-size:clamp(1rem,2.55vw,1.35rem);line-height:1.45;white-space:pre-wrap;word-break:break-word}.card{padding:10px}.cardTitle{font-size:.8rem;color:var(--muted);font-weight:700;margin-bottom:6px}#setlist{list-style:none;padding:0;margin:0;display:grid;gap:4px;max-height:30vh;overflow:auto}#setlist li{padding:6px 8px;border-radius:8px;background:#0b1728;border:1px solid #1f3148;font-size:.86rem}#setlist li.active{background:#0f2b3f;border-color:#22d3ee;color:#ecfeff;font-weight:700}.muted{color:var(--muted);font-size:.8rem}@media (orientation:landscape){.grid{grid-template-columns:1.2fr .8fr}.panel{min-height:56vh}#panel{font-size:clamp(.95rem,1.9vw,1.18rem)}#setlist{max-height:52vh}}</style>"
            + "</head><body><header><div><b>ZION BAND SYNC</b></div><div id='conn'>Conectando...</div></header><main>"
            + "<div class='wrap'><div class='meta'><div id='mk'>INTRO</div><div id='meta'>--:--</div></div><div id='song'>Esperando canción...</div>"
            + "<div class='tabs'><button class='active' data-tab='lyrics'>Letras</button><button data-tab='chords'>Cifrados</button><button data-tab='partitura'>Partitura</button><button data-tab='setlist'>Setlist</button></div>"
            + "<div class='controls'><button id='autoBtn'>Auto ON</button><button id='fontMinus'>A-</button><button id='fontPlus'>A+</button><button id='speedMinus'>Vel-</button><button id='speedPlus'>Vel+</button><span class='pill' id='speedLbl'>1.0x</span><span class='pill' id='fontLbl'>100%</span></div>"
            + "<div class='grid'><div class='panel'><div id='panel'>Esperando sincronización...</div></div><div class='card'><div class='cardTitle' id='setlistName'>Setlist</div><ul id='setlist'></ul></div></div></div>"
            + "</main>"
            + "<script>const song=document.getElementById('song'),mk=document.getElementById('mk'),panel=document.getElementById('panel'),panelWrap=panel.parentElement,conn=document.getElementById('conn'),meta=document.getElementById('meta'),setlistEl=document.getElementById('setlist'),setlistName=document.getElementById('setlistName'),tabBtns=[...document.querySelectorAll('.tabs button')],autoBtn=document.getElementById('autoBtn'),fontMinus=document.getElementById('fontMinus'),fontPlus=document.getElementById('fontPlus'),speedMinus=document.getElementById('speedMinus'),speedPlus=document.getElementById('speedPlus'),speedLbl=document.getElementById('speedLbl'),fontLbl=document.getElementById('fontLbl');"
            + "let currentTab='lyrics',state={},auto=true,speed=1,fontScale=1;function fmt(s){if(!Number.isFinite(s))return'00:00';const m=Math.floor(s/60),ss=Math.floor(s%60);return String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0')}"
            + "function renderSetlist(){const arr=Array.isArray(state.setlistSongs)?state.setlistSongs:[];setlistEl.innerHTML='';setlistName.textContent=(state.setlistName||'Setlist')+' ('+arr.length+')';arr.forEach((s)=>{const li=document.createElement('li');if(s&&s.id===state.activeSongId)li.classList.add('active');li.textContent=(s&&s.name)||'Sin nombre';setlistEl.appendChild(li)});if(!arr.length){const li=document.createElement('li');li.className='muted';li.textContent='No hay canciones cargadas';setlistEl.appendChild(li)}}"
            + "function renderPanel(){if(currentTab==='setlist'){panel.textContent='Setlist activo: '+(state.setlistName||'Sin nombre');return;}if(currentTab==='partitura'){const p=state.selectedPartitura,list=Array.isArray(state.partituras)?state.partituras:[];if(p){panel.textContent='Partitura activa: '+(p.title||p.instrument||'Partitura')}else if(list.length){panel.textContent='Partituras disponibles:\\n'+list.map(x=>'- '+(x.title||x.instrument||'Partitura')).join('\\n')}else{panel.textContent='No hay partituras disponibles'}return;}if(currentTab==='chords'){panel.textContent=state.chordsText||'Sin cifrado disponible';return;}panel.textContent=state.lyricsText||state.lyricsSection||'Sin letra disponible'}"
            + "function apply(d){if(!d||typeof d!=='object')return;state=d;song.textContent=d.songName||'Sin canción';mk.textContent=(d.activeMarkerLabel||'---').toUpperCase();meta.textContent=fmt(d.time||0)+' / '+(d.isPlaying?'PLAY':'STOP');renderSetlist();renderPanel()}"
            + "tabBtns.forEach((b)=>{b.onclick=()=>{currentTab=b.getAttribute('data-tab')||'lyrics';tabBtns.forEach(x=>x.classList.toggle('active',x===b));renderPanel()}});"
            + "function applyFont(){panel.style.fontSize='calc(clamp(1rem,2.55vw,1.35rem) * '+fontScale+')';fontLbl.textContent=Math.round(fontScale*100)+'%'}"
            + "function applySpeed(){speedLbl.textContent=speed.toFixed(1)+'x'}"
            + "fontMinus.onclick=()=>{fontScale=Math.max(.7,fontScale-.1);applyFont()};fontPlus.onclick=()=>{fontScale=Math.min(2.2,fontScale+.1);applyFont()};speedMinus.onclick=()=>{speed=Math.max(.4,+(speed-.1).toFixed(1));applySpeed()};speedPlus.onclick=()=>{speed=Math.min(3,+(speed+.1).toFixed(1));applySpeed()};autoBtn.onclick=()=>{auto=!auto;autoBtn.textContent=auto?'Auto ON':'Auto OFF'};"
            + "setInterval(()=>{if(!auto)return;if(currentTab!=='lyrics'&&currentTab!=='chords')return;const max=panelWrap.scrollHeight-panelWrap.clientHeight;if(max<=0)return;const step=Math.max(.2,speed*1.2);panelWrap.scrollTop=Math.min(max,panelWrap.scrollTop+step)},80);"
            + "function connect(){const ws=new WebSocket('ws://'+location.host+'/ws');ws.onopen=()=>conn.textContent='Sync activo';ws.onclose=()=>{conn.textContent='Reconectando...';setTimeout(connect,1500)};ws.onerror=()=>{conn.textContent='Error'};ws.onmessage=(e)=>{try{apply(JSON.parse(e.data))}catch(_){}}}"
            + "applyFont();applySpeed();connect();fetch('/state').then(r=>r.json()).then(apply).catch(()=>{});</script></body></html>";
    }
}
