import { WebPlugin } from '@capacitor/core';

/** Web stub — NextGen engine is Android-native; no audio path on web in Phase 1. */
export class NextGenMixerPluginWeb extends WebPlugin {
    async loadSongSession() {
        return;
    }

    async play() {
        return;
    }

    async pause() {
        return;
    }

    async stop() {
        return;
    }

    async seek() {
        return;
    }

    async setTrackVolume() {
        return;
    }

    async setTrackMute() {
        return;
    }

    async setTrackSolo() {
        return;
    }

    async setPitchSemiTones() {
        return;
    }

    async setTempoRatio() {
        return;
    }

    async setMasterVolume() {
        return;
    }

    async getSnapshot() {
        return { json: '{}' };
    }
}
