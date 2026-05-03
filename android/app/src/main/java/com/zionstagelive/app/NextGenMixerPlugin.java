package com.zionstagelive.app;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Parallel native-first multitrack API (Phase 1 skeleton). Does not replace {@link MultitrackPlugin}.
 * JS registers this as {@code NextGenMixerBridge}.
 */
@CapacitorPlugin(name = "NextGenMixerBridge")
public class NextGenMixerPlugin extends Plugin {

    private static final String TAG = "NextGenMixerBridge";
    private static boolean nativeLibLoaded = false;

    public native void nativeInit();
    public native void nativeRelease();
    public native void nativeLoadSongSession(String[] ids, String[] paths);
    public native void nativePlay();
    public native void nativePause();
    public native void nativeStop();
    public native void nativeSeek(double seconds);
    public native void nativeSetTrackVolume(String id, float volume);
    public native void nativeSetTrackMute(String id, boolean muted);
    public native void nativeSetTrackSolo(String id, boolean solo);
    public native void nativeSetPitchSemiTones(float semitones);
    public native void nativeSetTempoRatio(float ratio);
    public native void nativeSetMasterVolume(float volume);
    public native void nativeTempoLabSetActive(boolean on);
    public native void nativeTempoLabSetRatio(float ratio);
    public native String nativeGetSnapshotJson();

    @Override
    public void load() {
        super.load();
        try {
            System.loadLibrary("multitrack-native-engine");
            nativeLibLoaded = true;
            nativeInit();
            Log.d(TAG, "NextGen native engine initialized");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "NextGen: failed to load multitrack-native-engine", e);
            nativeLibLoaded = false;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (nativeLibLoaded) {
            nativeRelease();
        }
        super.handleOnDestroy();
    }

    /**
     * Load one session: either {@code paths} (ids auto-assigned stem_0..) or {@code tracks: [{id, path}]}.
     */
    @PluginMethod
    public void loadSongSession(PluginCall call) {
        if (!nativeLibLoaded) {
            call.reject("NextGen native library not loaded");
            return;
        }
        JSArray tracks = call.getArray("tracks");
        JSArray pathsOnly = call.getArray("paths");
        try {
            if (tracks != null && tracks.length() > 0) {
                int n = tracks.length();
                String[] ids = new String[n];
                String[] paths = new String[n];
                for (int i = 0; i < n; i++) {
                    JSONObject t = tracks.getJSONObject(i);
                    ids[i] = t.getString("id");
                    paths[i] = t.getString("path");
                }
                nativeLoadSongSession(ids, paths);
            } else if (pathsOnly != null && pathsOnly.length() > 0) {
                int n = pathsOnly.length();
                String[] ids = new String[n];
                String[] paths = new String[n];
                for (int i = 0; i < n; i++) {
                    ids[i] = "stem_" + i;
                    paths[i] = pathsOnly.getString(i);
                }
                nativeLoadSongSession(ids, paths);
            } else {
                call.reject("Provide paths[] or tracks[{id,path}]");
                return;
            }
            call.resolve();
        } catch (JSONException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (nativeLibLoaded) nativePlay();
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (nativeLibLoaded) nativePause();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (nativeLibLoaded) nativeStop();
        call.resolve();
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double seconds = call.getDouble("seconds");
        if (seconds == null) seconds = 0.0;
        if (nativeLibLoaded) nativeSeek(seconds);
        call.resolve();
    }

    @PluginMethod
    public void setTrackVolume(PluginCall call) {
        String id = call.getString("id");
        Float volume = call.getFloat("volume");
        if (id != null && volume != null && nativeLibLoaded) {
            nativeSetTrackVolume(id, volume);
        }
        call.resolve();
    }

    @PluginMethod
    public void setTrackMute(PluginCall call) {
        String id = call.getString("id");
        Boolean muted = call.getBoolean("muted");
        if (id != null && muted != null && nativeLibLoaded) {
            nativeSetTrackMute(id, muted);
        }
        call.resolve();
    }

    @PluginMethod
    public void setTrackSolo(PluginCall call) {
        String id = call.getString("id");
        Boolean solo = call.getBoolean("solo");
        if (id != null && solo != null && nativeLibLoaded) {
            nativeSetTrackSolo(id, solo);
        }
        call.resolve();
    }

    @PluginMethod
    public void setPitchSemiTones(PluginCall call) {
        float s = 0f;
        Double d = call.getDouble("semitones");
        if (d != null) {
            s = d.floatValue();
        } else {
            Float f = call.getFloat("semitones");
            if (f != null) s = f;
        }
        if (nativeLibLoaded) {
            nativeSetPitchSemiTones(s);
        }
        call.resolve();
    }

    @PluginMethod
    public void setTempoRatio(PluginCall call) {
        float r = 1f;
        Double d = call.getDouble("ratio");
        if (d != null) {
            r = d.floatValue();
        } else {
            Float f = call.getFloat("ratio");
            if (f != null) r = f;
        }
        if (nativeLibLoaded) {
            nativeSetTempoRatio(r);
        }
        call.resolve();
    }

    @PluginMethod
    public void tempoLabSetActive(PluginCall call) {
        Boolean on = call.getBoolean("active");
        if (on != null && nativeLibLoaded) {
            nativeTempoLabSetActive(on);
        }
        call.resolve();
    }

    @PluginMethod
    public void tempoLabSetRatio(PluginCall call) {
        float r = 1f;
        Double d = call.getDouble("ratio");
        if (d != null) {
            r = d.floatValue();
        } else {
            Float f = call.getFloat("ratio");
            if (f != null) r = f;
        }
        if (nativeLibLoaded) {
            nativeTempoLabSetRatio(r);
        }
        call.resolve();
    }

    @PluginMethod
    public void setMasterVolume(PluginCall call) {
        float v = 1f;
        Double d = call.getDouble("volume");
        if (d != null) {
            v = d.floatValue();
        } else {
            Float f = call.getFloat("volume");
            if (f != null) v = f;
        }
        if (nativeLibLoaded) {
            nativeSetMasterVolume(v);
        }
        call.resolve();
    }

    /**
     * Lightweight state snapshot (JSON string from native). Parse on JS side as needed.
     */
    @PluginMethod
    public void getSnapshot(PluginCall call) {
        String json = nativeLibLoaded ? nativeGetSnapshotJson() : "{}";
        JSObject ret = new JSObject();
        ret.put("json", json != null ? json : "{}");
        call.resolve(ret);
    }
}
