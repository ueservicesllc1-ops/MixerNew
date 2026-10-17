package com.zionstagelive.nativeapp.audio

import android.util.Log
import com.zionstagelive.nativeapp.models.Stem
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

object NativeAudioEngine {
    private const val TAG = "NativeAudioEngine"

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _playbackPosition = MutableStateFlow(0.0)
    val playbackPosition: StateFlow<Double> = _playbackPosition.asStateFlow()

    private val _duration = MutableStateFlow(0.0)
    val duration: StateFlow<Double> = _duration.asStateFlow()

    private val _masterVolume = MutableStateFlow(1.0f)
    val masterVolume: StateFlow<Float> = _masterVolume.asStateFlow()

    private val _pitchSemiTones = MutableStateFlow(0.0f)
    val pitchSemiTones: StateFlow<Float> = _pitchSemiTones.asStateFlow()

    private val _tempoRatio = MutableStateFlow(1.0f)
    val tempoRatio: StateFlow<Float> = _tempoRatio.asStateFlow()

    private val engineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var pollJob: Job? = null
    private var isLibLoaded = false

    init {
        try {
            System.loadLibrary("c++_shared")
        } catch (_: UnsatisfiedLinkError) {}
        try {
            System.loadLibrary("multitrack-native-engine")
            isLibLoaded = true
            Log.i(TAG, "multitrack-native-engine loaded successfully")
        } catch (e: UnsatisfiedLinkError) {
            Log.e(TAG, "Failed to load multitrack-native-engine", e)
            isLibLoaded = false
        }
    }

    fun init() {
        if (!isLibLoaded) return
        nativeInit()
        startPolling()
    }

    fun release() {
        stopPolling()
        if (isLibLoaded) {
            nativeRelease()
        }
    }

    private var loadSessionJob: Job? = null
    private val _isSessionLoading = MutableStateFlow(false)
    val isSessionLoading: StateFlow<Boolean> = _isSessionLoading.asStateFlow()

    fun loadSongSession(stems: List<Stem>, onComplete: (() -> Unit)? = null) {
        if (!isLibLoaded || stems.isEmpty()) {
            onComplete?.invoke()
            return
        }
        val validStems = stems.filter { !it.localPath.isNullOrEmpty() }
        if (validStems.isEmpty()) {
            onComplete?.invoke()
            return
        }

        loadSessionJob?.cancel()
        loadSessionJob = engineScope.launch(Dispatchers.IO) {
            _isSessionLoading.value = true
            try {
                val ids = validStems.map { it.id }.toTypedArray()
                val paths = validStems.map { it.localPath!! }.toTypedArray()
                nativeLoadSongSession(ids, paths)
                withContext(Dispatchers.Main) {
                    onComplete?.invoke()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in loadSongSession", e)
            } finally {
                _isSessionLoading.value = false
            }
        }
    }

    fun play() {
        if (!isLibLoaded) return
        nativePlay()
        _isPlaying.value = true
    }

    fun pause() {
        if (!isLibLoaded) return
        nativePause()
        _isPlaying.value = false
    }

    fun stop() {
        if (!isLibLoaded) return
        nativeStop()
        _isPlaying.value = false
        _playbackPosition.value = 0.0
    }

    fun seek(seconds: Double) {
        if (!isLibLoaded) return
        nativeSeek(seconds)
        _playbackPosition.value = seconds
    }

    fun setTrackVolume(id: String, volume: Float) {
        if (!isLibLoaded) return
        nativeSetTrackVolume(id, volume.coerceIn(0f, 1f))
    }

    fun setTrackMute(id: String, muted: Boolean) {
        if (!isLibLoaded) return
        nativeSetTrackMute(id, muted)
    }

    fun setTrackSolo(id: String, solo: Boolean) {
        if (!isLibLoaded) return
        nativeSetTrackSolo(id, solo)
    }

    fun setTrackPan(id: String, pan: Float) {
        if (!isLibLoaded) return
        nativeSetTrackPan(id, pan.coerceIn(-1f, 1f))
    }

    fun setPitch(semitones: Float) {
        if (!isLibLoaded) return
        _pitchSemiTones.value = semitones
        nativeSetPitchSemiTones(semitones)
    }

    fun setTempo(ratio: Float) {
        if (!isLibLoaded) return
        _tempoRatio.value = ratio
        nativeSetTempoRatio(ratio)
    }

    private val _trackLevels = MutableStateFlow<Map<String, Float>>(emptyMap())
    val trackLevels: StateFlow<Map<String, Float>> = _trackLevels.asStateFlow()

    private val _masterPeak = MutableStateFlow(0f)
    val masterPeak: StateFlow<Float> = _masterPeak.asStateFlow()

    fun setMasterVolume(vol: Float) {
        if (!isLibLoaded) return
        val clamped = vol.coerceIn(0f, 1f)
        _masterVolume.value = clamped
        nativeSetMasterVolume(clamped)
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = engineScope.launch {
            while (isActive) {
                if (isLibLoaded) {
                    try {
                        val snapshot = nativeGetSnapshotJson()
                        if (!snapshot.isNullOrEmpty()) {
                            val json = JSONObject(snapshot)
                            val pos = if (json.has("positionSec")) json.getDouble("positionSec") else json.optDouble("positionSeconds", -1.0)
                            val dur = if (json.has("durationSec")) json.getDouble("durationSec") else json.optDouble("durationSeconds", 0.0)
                            if (pos >= 0.0) _playbackPosition.value = pos
                            if (dur > 0.0) _duration.value = dur

                            val tr = json.optString("transport", "")
                            if (tr.isNotEmpty()) {
                                _isPlaying.value = (tr == "playing")
                            }

                            val levelsObj = json.optJSONObject("trackLevels")
                            if (levelsObj != null) {
                                val map = mutableMapOf<String, Float>()
                                val keys = levelsObj.keys()
                                var maxLevel = 0f
                                while (keys.hasNext()) {
                                    val k = keys.next()
                                    val lv = levelsObj.optDouble(k, 0.0).toFloat()
                                    map[k] = lv
                                    if (lv > maxLevel) maxLevel = lv
                                }
                                _trackLevels.value = map
                                _masterPeak.value = (maxLevel * _masterVolume.value).coerceIn(0f, 1f)
                            }
                        }
                    } catch (_: Exception) {}
                }
                delay(33) // ~30 fps UI update is ultra-smooth and light on CPU
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    // JNI Native methods matching NativeAudioEngineBridge.cpp
    private external fun nativeInit()
    private external fun nativeRelease()
    private external fun nativeLoadSongSession(ids: Array<String>, paths: Array<String>)
    private external fun nativePlay()
    private external fun nativePause()
    private external fun nativeStop()
    private external fun nativeSeek(seconds: Double)
    private external fun nativeSetTrackVolume(id: String, volume: Float)
    private external fun nativeSetTrackMute(id: String, muted: Boolean)
    private external fun nativeSetTrackSolo(id: String, solo: Boolean)
    private external fun nativeSetTrackPan(id: String, pan: Float)
    private external fun nativeSetPitchSemiTones(semitones: Float)
    private external fun nativeSetTempoRatio(ratio: Float)
    private external fun nativeSetMasterVolume(volume: Float)
    private external fun nativeTempoLabSetActive(on: Boolean)
    private external fun nativeTempoLabSetRatio(ratio: Float)
    private external fun nativeGetSnapshotJson(): String?
}
