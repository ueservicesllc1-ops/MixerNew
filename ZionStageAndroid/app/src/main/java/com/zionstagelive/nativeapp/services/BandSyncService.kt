package com.zionstagelive.nativeapp.services

import android.content.Context
import android.net.wifi.WifiManager
import android.text.format.Formatter
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoWSD
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.IOException
import java.net.NetworkInterface
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap

object BandSyncService {
    private const val TAG = "BandSyncService"
    private const val PORT = 8080

    private var server: BandSyncServer? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _connectedClients = MutableStateFlow(0)
    val connectedClients: StateFlow<Int> = _connectedClients.asStateFlow()

    fun getLocalIpAddress(context: Context): String {
        try {
            val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val ipInt = wm?.connectionInfo?.ipAddress ?: 0
            if (ipInt != 0) {
                return Formatter.formatIpAddress(ipInt)
            }
        } catch (_: Exception) {}

        try {
            for (ni in Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (addr in Collections.list(ni.inetAddresses)) {
                    if (!addr.isLoopbackAddress && addr is java.net.Inet4Address) {
                        return addr.hostAddress ?: "127.0.0.1"
                    }
                }
            }
        } catch (_: Exception) {}

        return "127.0.0.1"
    }

    fun getSyncUrl(context: Context): String {
        val ip = getLocalIpAddress(context)
        return "http://$ip:$PORT/"
    }

    fun startServer(context: Context) {
        if (server != null) return
        try {
            server = BandSyncServer(PORT).apply { start() }
            _isConnected.value = true
            Log.i(TAG, "BandSyncServer started on port $PORT")
        } catch (e: IOException) {
            Log.e(TAG, "Failed to start BandSyncServer", e)
            server = null
            _isConnected.value = false
        }
    }

    fun stopServer() {
        server?.stop()
        server = null
        _isConnected.value = false
        _connectedClients.value = 0
    }

    fun broadcastState(jsonPayload: String) {
        server?.broadcast(jsonPayload)
    }

    private class BandSyncServer(port: Int) : NanoWSD(port) {
        private val sockets = ConcurrentHashMap.newKeySet<BandSyncSocket>()

        override fun openWebSocket(handshake: IHTTPSession): WebSocket {
            return BandSyncSocket(handshake)
        }

        override fun serveHttp(session: IHTTPSession): Response {
            val html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>Zion Stage - Band Sync</title>
                    <style>
                        body { background: #020617; color: #fff; font-family: -apple-system, sans-serif; text-align: center; padding: 24px; }
                        h1 { color: #00d2d3; margin-bottom: 8px; }
                        .card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin: 20px auto; max-width: 440px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
                        .status { font-weight: bold; color: #10b981; font-size: 1.1rem; }
                        .info { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-top: 12px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Zion Stage Band Sync</h1>
                        <p class="status">● Conectado a la estación de monitores</p>
                        <p class="info">Sincronización en vivo activa. Tu dispositivo está conectado en la misma red local.</p>
                    </div>
                </body>
                </html>
            """.trimIndent()
            return newFixedLengthResponse(Response.Status.OK, "text/html", html)
        }

        fun broadcast(msg: String) {
            for (s in sockets) {
                try {
                    s.send(msg)
                } catch (_: Exception) {}
            }
        }

        private inner class BandSyncSocket(handshakeRequest: IHTTPSession) : WebSocket(handshakeRequest) {
            override fun onOpen() {
                sockets.add(this)
                _connectedClients.value = sockets.size
            }

            override fun onClose(code: WebSocketFrame.CloseCode?, reason: String?, initiatedByRemote: Boolean) {
                sockets.remove(this)
                _connectedClients.value = sockets.size
            }

            override fun onMessage(message: WebSocketFrame?) {}
            override fun onPong(pong: WebSocketFrame?) {}
            override fun onException(exception: IOException?) {
                sockets.remove(this)
                _connectedClients.value = sockets.size
            }
        }
    }
}
