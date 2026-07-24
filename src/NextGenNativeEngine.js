import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * NextGen native multitrack bridge (Android). Zion uses this for playback via NativeEngine.
 */
import { NextGenMixerPluginWeb } from './NextGenMixerPluginWeb.js';

let bridge;
if (Capacitor.getPlatform() === 'ios') {
    bridge = new NextGenMixerPluginWeb();
} else {
    bridge = registerPlugin('NextGenMixerBridge', {
        web: () => import('./NextGenMixerPluginWeb.js').then((m) => new m.NextGenMixerPluginWeb()),
    });
}

export const NextGenMixerBridge = bridge;
