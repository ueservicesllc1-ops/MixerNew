#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NextGenMixerPlugin, "NextGenMixerBridge",
    CAP_PLUGIN_METHOD(loadTracks, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(play, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(pause, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearTracks, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(seek, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTrackVolume, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTrackMute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTrackSolo, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTrackPan, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setPitchSemiTones, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTempoRatio, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setMasterVolume, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getSnapshot, CAPPluginReturnPromise);
)
