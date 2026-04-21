import { registerPlugin } from '@capacitor/core';

const IS_NATIVE = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

const BandSyncBridge = registerPlugin('BandSyncBridge', {
    web: () => import('./BandSyncPluginWeb.js').then((m) => new m.BandSyncPluginWeb()),
});

let serverInfoCache = null;
let lastPushAt = 0;

export const BandSyncEngine = {
    async ensureServer(port = 8080) {
        if (!IS_NATIVE) return { running: false };
        try {
            const info = await BandSyncBridge.startServer({ port });
            serverInfoCache = info;
            return info;
        } catch (e) {
            console.warn('[BandSync] startServer failed', e);
            return { running: false };
        }
    },

    async stopServer() {
        if (!IS_NATIVE) return { running: false };
        try {
            const info = await BandSyncBridge.stopServer();
            serverInfoCache = info;
            return info;
        } catch (e) {
            console.warn('[BandSync] stopServer failed', e);
            return { running: false };
        }
    },

    async getInfo() {
        if (!IS_NATIVE) return { running: false };
        try {
            const info = await BandSyncBridge.getServerInfo();
            serverInfoCache = info;
            return info;
        } catch (e) {
            console.warn('[BandSync] getServerInfo failed', e);
            return serverInfoCache || { running: false };
        }
    },

    async pushState(state, minIntervalMs = 150) {
        if (!IS_NATIVE) return;
        const now = Date.now();
        if (now - lastPushAt < minIntervalMs) return;
        lastPushAt = now;
        try {
            await BandSyncBridge.broadcastState({ state });
        } catch (e) {
            console.warn('[BandSync] broadcastState failed', e);
        }
    },
};
