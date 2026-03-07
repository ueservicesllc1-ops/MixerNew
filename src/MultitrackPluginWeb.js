import { WebPlugin } from '@capacitor/core';

export class MultitrackPluginWeb extends WebPlugin {
    async echo(options) {
        console.log('Mock Native echo:', options.value);
        return { value: options.value };
    }

    async checkStatus() {
        return { loaded: true, info: 'Web Mock Engine Active' };
    }

    async loadTracks(options) {
        console.log('Mock Native loadTracks:', options);
        return;
    }

    async clearTracks() {
        console.log('Mock Native clearTracks');
        return;
    }

    async play() {
        console.log('Mock Native play');
        return;
    }

    async stop() {
        console.log('Mock Native stop');
        return;
    }

    async pause() {
        console.log('Mock Native pause');
        return;
    }

    async seek(options) {
        console.log('Mock Native seek:', options.seconds);
        return;
    }

    async setVolume(options) {
        console.log('Mock Native setVolume:', options.volume);
        return;
    }

    async setTrackVolume(options) {
        console.log('Mock Native setTrackVolume:', options.id, options.volume);
        return;
    }

    async setTrackMute(options) {
        console.log('Mock Native setTrackMute:', options.id, options.muted);
        return;
    }

    async getPosition() {
        return { position: 0 };
    }

    async getTrackCount() {
        return { count: 0 };
    }
}
