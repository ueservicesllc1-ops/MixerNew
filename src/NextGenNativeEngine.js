import { registerPlugin } from '@capacitor/core';

/**
 * NextGen native multitrack bridge (Android). Zion uses this for playback via NativeEngine.
 */
export const NextGenMixerBridge = registerPlugin('NextGenMixerBridge', {
    web: () => import('./NextGenMixerPluginWeb.js').then((m) => new m.NextGenMixerPluginWeb()),
});
