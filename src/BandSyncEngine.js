import { registerPlugin } from '@capacitor/core';

const IS_NATIVE = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

const emptyInfo = () => ({
    running: false,
    port: 0,
    ip: '0.0.0.0',
    url: '',
    wsUrl: '',
    clients: 0,
});

/** Zion Stage escritorio (Electron): IPC → servidor HTTP en el proceso principal. */
function hasElectronBandSync() {
    return typeof window !== 'undefined' && typeof window.zionNative?.bandSyncStart === 'function';
}

const BandSyncBridge = registerPlugin('BandSyncBridge', {
    web: () => import('./BandSyncPluginWeb.js').then((m) => new m.BandSyncPluginWeb()),
});

export function isBandSyncHostSupported() {
    if (typeof window === 'undefined') return false;
    return true;
}

let serverInfoCache = null;
let lastPushAt = 0;

function getProxyUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3001';
    const saved = localStorage.getItem('mixer_proxyUrl');
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.') || 
                    window.location.hostname.startsWith('10.') || 
                    window.location.hostname.startsWith('172.');
    
    if (isLocal) {
        if (!saved || saved.includes('railway.app')) {
            return `http://${window.location.hostname}:3001`;
        }
    }
    return saved || `http://${window.location.hostname}:3001`;
}

export const BandSyncEngine = {
    async ensureServer(port = 8080) {
        if (hasElectronBandSync()) {
            try {
                const info = await window.zionNative.bandSyncStart(port);
                serverInfoCache = info;
                return info && typeof info === 'object' ? info : emptyInfo();
            } catch (e) {
                console.warn('[BandSync] electron start failed', e);
                return emptyInfo();
            }
        }
        if (IS_NATIVE) {
            try {
                const info = await BandSyncBridge.startServer({ port });
                serverInfoCache = info;
                return info;
            } catch (e) {
                console.warn('[BandSync] startServer failed', e);
                return emptyInfo();
            }
        }
        // Web fallback:
        try {
            const proxyUrl = getProxyUrl();
            const res = await fetch(`${proxyUrl}/api/band-sync/info`);
            if (res.ok) {
                const info = await res.json();
                serverInfoCache = info;
                return info;
            }
        } catch (e) {
            console.warn('[BandSync] web ensureServer failed', e);
        }
        return emptyInfo();
    },

    async stopServer() {
        if (hasElectronBandSync()) {
            try {
                const info = await window.zionNative.bandSyncStop();
                serverInfoCache = info;
                return info && typeof info === 'object' ? info : emptyInfo();
            } catch (e) {
                console.warn('[BandSync] electron stop failed', e);
                return emptyInfo();
            }
        }
        if (IS_NATIVE) {
            try {
                const info = await BandSyncBridge.stopServer();
                serverInfoCache = info;
                return info;
            } catch (e) {
                console.warn('[BandSync] stopServer failed', e);
                return emptyInfo();
            }
        }
        // Web fallback:
        serverInfoCache = null;
        return emptyInfo();
    },

    async getInfo() {
        if (hasElectronBandSync()) {
            try {
                const info = await window.zionNative.bandSyncGetInfo();
                serverInfoCache = info;
                return info && typeof info === 'object' ? info : serverInfoCache || emptyInfo();
            } catch (e) {
                console.warn('[BandSync] electron getInfo failed', e);
                return serverInfoCache || emptyInfo();
            }
        }
        if (IS_NATIVE) {
            try {
                const info = await BandSyncBridge.getServerInfo();
                serverInfoCache = info;
                return info;
            } catch (e) {
                console.warn('[BandSync] getServerInfo failed', e);
                return serverInfoCache || emptyInfo();
            }
        }
        // Web fallback:
        try {
            const proxyUrl = getProxyUrl();
            const res = await fetch(`${proxyUrl}/api/band-sync/info`);
            if (res.ok) {
                const info = await res.json();
                serverInfoCache = info;
                return info;
            }
        } catch (e) {
            console.warn('[BandSync] web getInfo failed', e);
        }
        return serverInfoCache || emptyInfo();
    },

    async pushState(state, minIntervalMs = 150) {
        const now = Date.now();
        if (now - lastPushAt < minIntervalMs) return;
        lastPushAt = now;

        if (hasElectronBandSync()) {
            try {
                await window.zionNative.bandSyncBroadcastState(state);
            } catch (e) {
                console.warn('[BandSync] electron broadcast failed', e);
            }
            return;
        }
        if (IS_NATIVE) {
            try {
                await BandSyncBridge.broadcastState({ state });
            } catch (e) {
                console.warn('[BandSync] broadcastState failed', e);
            }
            return;
        }
        // Web fallback:
        try {
            const proxyUrl = getProxyUrl();
            await fetch(`${proxyUrl}/api/band-sync/broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(state),
            });
        } catch (e) {
            console.warn('[BandSync] web pushState failed', e);
        }
    },
};
