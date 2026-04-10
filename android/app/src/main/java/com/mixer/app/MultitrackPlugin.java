package com.mixer.app;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "MixerBridge")
public class MultitrackPlugin extends Plugin {

    private static final String TAG = "MixerBridge";
    private static boolean nativeLibLoaded = false;

    // Declaraciones JNI (C++)
    public native void    nativeInit();
    public native void    nativeLoadTrack(String trackId, String path);
    public native void    nativeClearTracks();
    public native void    nativePlay();
    public native void    nativePause();
    public native void    nativeStop();
    public native void    nativeSeek(double seconds);
    public native void    nativeSetVolume(float volume);
    public native void    nativeSetTrackVolume(String id, float volume);
    public native void    nativeSetTrackMute(String id, boolean muted);
    public native void    nativeSetTrackSolo(String id, boolean solo);
    public native double  nativeGetPosition();
    public native int     nativeGetTrackCount();
    public native void    nativeSetSpeed(float speed);
    // Pre-load (siguiente canción en background)
    public native void    nativePreloadTrack(String songId, String trackId, String path);
    public native boolean nativeSwapToPending(String songId);
    public native void    nativeClearPending();

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "Cargando motor de audio C++...");
        try {
            System.loadLibrary("multitrack-native-engine");
            nativeLibLoaded = true;
            nativeInit();
            Log.d(TAG, "Motor de audio C++ cargado E INICIALIZADO");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "ERROR: No se pudo cargar la libreria C++: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error en inicializacion: " + e.getMessage());
        }
    }

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");
        JSObject ret = new JSObject();
        ret.put("value", "Motor OK. Recibido: " + value);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("loaded", nativeLibLoaded);
        ret.put("info", nativeLibLoaded ? "Motor de Audio Profesional Listo" : "Error: Libreria C++ no cargada");
        call.resolve(ret);
    }

    @PluginMethod
    public void loadTracks(PluginCall call) {
        JSArray tracks = call.getArray("tracks");
        if (tracks == null) { call.reject("No hay pistas"); return; }
        try {
            if (nativeLibLoaded) {
                for (int i = 0; i < tracks.length(); i++) {
                    JSONObject t = tracks.getJSONObject(i);
                    nativeLoadTrack(t.getString("id"), t.getString("path"));
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (nativeLibLoaded) {
            try { nativePlay(); call.resolve(); }
            catch (Exception e) { call.reject(e.getMessage()); }
        } else {
            call.reject("Motor no cargado");
        }
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
        if (seconds != null && nativeLibLoaded) nativeSeek(seconds);
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Float vol = call.getFloat("volume");
        if (vol != null && nativeLibLoaded) nativeSetVolume(vol);
        call.resolve();
    }

    @PluginMethod
    public void setTrackVolume(PluginCall call) {
        String id = call.getString("id");
        Float vol = call.getFloat("volume");
        if (id != null && vol != null && nativeLibLoaded) nativeSetTrackVolume(id, vol);
        call.resolve();
    }

    @PluginMethod
    public void setTrackMute(PluginCall call) {
        String id = call.getString("id");
        Boolean mute = call.getBoolean("muted");
        if (id != null && mute != null && nativeLibLoaded) nativeSetTrackMute(id, mute);
        call.resolve();
    }

    @PluginMethod
    public void setTrackSolo(PluginCall call) {
        String id = call.getString("id");
        Boolean solo = call.getBoolean("solo");
        if (id != null && solo != null && nativeLibLoaded) nativeSetTrackSolo(id, solo);
        call.resolve();
    }

    @PluginMethod
    public void getPosition(PluginCall call) {
        double pos = nativeLibLoaded ? nativeGetPosition() : 0.0;
        JSObject ret = new JSObject();
        ret.put("position", pos);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTrackCount(PluginCall call) {
        int count = nativeLibLoaded ? nativeGetTrackCount() : 0;
        JSObject ret = new JSObject();
        ret.put("count", count);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearTracks(PluginCall call) {
        if (nativeLibLoaded) nativeClearTracks();
        call.resolve();
    }

    @PluginMethod
    public void setSpeed(PluginCall call) {
        Float speed = call.getFloat("speed");
        if (speed != null && nativeLibLoaded) nativeSetSpeed(speed);
        call.resolve();
    }

    /** Pre-carga las pistas de la siguiente canción en background sin interrumpir la reproducción actual. */
    @PluginMethod
    public void preloadTracks(PluginCall call) {
        JSArray tracks = call.getArray("tracks");
        String songId  = call.getString("songId", "");
        if (tracks == null || songId == null || songId.isEmpty()) { call.reject("Faltan tracks o songId"); return; }
        // Ejecutar en thread separado para no bloquear el bridge (la decodificación es lenta)
        final String fSongId = songId;
        new Thread(() -> {
            try {
                if (nativeLibLoaded) {
                    for (int i = 0; i < tracks.length(); i++) {
                        JSONObject t = tracks.getJSONObject(i);
                        nativePreloadTrack(fSongId, t.getString("id"), t.getString("path"));
                    }
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }, "preload-thread").start();
    }

    /** Swap atómico O(1): la canción pre-cargada pasa a ser la activa instantáneamente. */
    @PluginMethod
    public void swapToPending(PluginCall call) {
        String songId = call.getString("songId", "");
        boolean swapped = nativeLibLoaded && songId != null && !songId.isEmpty() && nativeSwapToPending(songId);
        JSObject ret = new JSObject();
        ret.put("swapped", swapped);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPending(PluginCall call) {
        if (nativeLibLoaded) nativeClearPending();
        call.resolve();
    }
}
