import { WebPlugin } from '@capacitor/core';

export class BandSyncPluginWeb extends WebPlugin {
    async startServer() {
        return { running: false, port: 0, ip: '0.0.0.0', url: '', wsUrl: '', clients: 0 };
    }

    async stopServer() {
        return { running: false, port: 0, ip: '0.0.0.0', url: '', wsUrl: '', clients: 0 };
    }

    async getServerInfo() {
        return { running: false, port: 0, ip: '0.0.0.0', url: '', wsUrl: '', clients: 0 };
    }

    async broadcastState() {
        return { ok: true, clients: 0 };
    }
}
