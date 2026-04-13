package com.mixer.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Legacy bridge — retained for Capacitor plugin registration only.
 * All audio is now routed through NextGenMixerPlugin (NextGenMixerBridge).
 * No native calls are made from here; MixerNativeEngine.cpp has been removed.
 */
@CapacitorPlugin(name = "MixerBridge")
public class MultitrackPlugin extends Plugin {

    @PluginMethod
    public void echo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", "NextGen engine active — legacy bridge is a no-op.");
        call.resolve(ret);
    }

    @PluginMethod public void loadTracks(PluginCall call)    { call.resolve(); }
    @PluginMethod public void play(PluginCall call)          { call.resolve(); }
    @PluginMethod public void pause(PluginCall call)         { call.resolve(); }
    @PluginMethod public void stop(PluginCall call)          { call.resolve(); }
    @PluginMethod public void seek(PluginCall call)          { call.resolve(); }
    @PluginMethod public void setVolume(PluginCall call)     { call.resolve(); }
    @PluginMethod public void setTrackVolume(PluginCall call){ call.resolve(); }
    @PluginMethod public void setTrackMute(PluginCall call)  { call.resolve(); }
    @PluginMethod public void setTrackSolo(PluginCall call)  { call.resolve(); }
    @PluginMethod public void clearTracks(PluginCall call)   { call.resolve(); }
    @PluginMethod public void setSpeed(PluginCall call)      { call.resolve(); }
    @PluginMethod public void preloadTracks(PluginCall call) { call.resolve(); }
    @PluginMethod public void swapToPending(PluginCall call) { JSObject r = new JSObject(); r.put("swapped", false); call.resolve(r); }
    @PluginMethod public void clearPending(PluginCall call)  { call.resolve(); }
    @PluginMethod public void setPitch(PluginCall call)      { call.resolve(); }
    @PluginMethod public void checkStatus(PluginCall call)   { JSObject r = new JSObject(); r.put("loaded", false); r.put("info", "NextGen engine active"); call.resolve(r); }

    @PluginMethod
    public void getPosition(PluginCall call)  { JSObject r = new JSObject(); r.put("position", 0.0); call.resolve(r); }

    @PluginMethod
    public void getTrackCount(PluginCall call){ JSObject r = new JSObject(); r.put("count", 0); call.resolve(r); }

    @PluginMethod
    public void getDuration(PluginCall call)  { JSObject r = new JSObject(); r.put("duration", 0.0); call.resolve(r); }

    @PluginMethod
    public void getTrackLevels(PluginCall call){ JSObject r = new JSObject(); r.put("levels", ""); call.resolve(r); }
}
