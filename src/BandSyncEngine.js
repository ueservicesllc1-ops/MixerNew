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

/**
 * ¿Puede esta instancia alojar el servidor Band Sync (QR para músicos)?
 * - Escritorio Electron: sí (HTTP + SSE en main).
 * - Android/iOS Capacitor: sí si existe plugin nativo `BandSyncBridge` (si no, `ensureServer` fallará).
 * - Navegador puro: no.
 */
export function isBandSyncHostSupported() {
    if (typeof window === 'undefined') return false;
    if (hasElectronBandSync()) return true;
    return IS_NATIVE;
}

let serverInfoCache = null;
let lastPushAt = 0;

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
        if (!IS_NATIVE) return emptyInfo();
        try {
            const info = await BandSyncBridge.startServer({ port });
            serverInfoCache = info;
            return info;
        } catch (e) {
            console.warn('[BandSync] startServer failed', e);
            return emptyInfo();
        }
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
        if (!IS_NATIVE) return emptyInfo();
        try {
            const info = await BandSyncBridge.stopServer();
            serverInfoCache = info;
            return info;
        } catch (e) {
            console.warn('[BandSync] stopServer failed', e);
            return emptyInfo();
        }
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
        if (!IS_NATIVE) return serverInfoCache || emptyInfo();
        try {
            const info = await BandSyncBridge.getServerInfo();
            serverInfoCache = info;
            return info;
        } catch (e) {
            console.warn('[BandSync] getServerInfo failed', e);
            return serverInfoCache || emptyInfo();
        }
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
        if (!IS_NATIVE) return;
        try {
            await BandSyncBridge.broadcastState({ state });
        } catch (e) {
            console.warn('[BandSync] broadcastState failed', e);
        }
    },
};
