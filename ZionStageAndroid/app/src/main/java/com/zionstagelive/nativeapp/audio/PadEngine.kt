package com.zionstagelive.nativeapp.audio

import android.content.Context
import android.content.res.AssetFileDescriptor
import android.media.MediaPlayer
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class PadEngine private constructor(private val context: Context) {
    companion object {
        private const val TAG = "PadEngine"
        @Volatile private var instance: PadEngine? = null

        fun getInstance(context: Context): PadEngine =
            instance ?: synchronized(this) {
                instance ?: PadEngine(context.applicationContext).also { instance = it }
            }

        val AVAILABLE_KEYS = listOf(
            "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"
        )
    }

    private val _activeKey = MutableStateFlow<String?>(null)
    val activeKey: StateFlow<String?> = _activeKey.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _volume = MutableStateFlow(0.8f)
    val volume: StateFlow<Float> = _volume.asStateFlow()

    private val _isSolo = MutableStateFlow(false)
    val isSolo: StateFlow<Boolean> = _isSolo.asStateFlow()

    private var activePlayer: MediaPlayer? = null
    private var fadeJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    fun toggleKey(key: String) {
        if (_activeKey.value == key && _isPlaying.value) {
            stop()
        } else {
            playKey(key)
        }
    }

    fun playKey(key: String) {
        val normalizedKey = normalizeKey(key) ?: return
        if (_activeKey.value == normalizedKey && _isPlaying.value) return

        fadeJob?.cancel()
        fadeJob = scope.launch {
            val oldPlayer = activePlayer
            val newPlayer = createPlayer(normalizedKey)

            if (newPlayer == null) {
                Log.e(TAG, "Failed to create player for pad key $normalizedKey")
                return@launch
            }

            _activeKey.value = normalizedKey
            _isPlaying.value = true
            activePlayer = newPlayer

            // Crossfade over 1500ms
            val steps = 30
            val stepDelay = 50L
            val targetVol = _volume.value

            newPlayer.setVolume(0f, 0f)
            newPlayer.start()

            for (i in 1..steps) {
                val progress = i.toFloat() / steps
                val newVol = progress * targetVol
                val oldVol = (1f - progress) * targetVol

                newPlayer.setVolume(newVol, newVol)
                oldPlayer?.setVolume(oldVol, oldVol)
                delay(stepDelay)
            }

            oldPlayer?.stop()
            oldPlayer?.release()
        }
    }

    fun stop() {
        fadeJob?.cancel()
        fadeJob = scope.launch {
            val player = activePlayer ?: return@launch
            val steps = 20
            val stepDelay = 40L
            val initialVol = _volume.value

            for (i in 1..steps) {
                val progress = 1f - (i.toFloat() / steps)
                val vol = progress * initialVol
                player.setVolume(vol, vol)
                delay(stepDelay)
            }

            player.stop()
            player.release()
            activePlayer = null
            _activeKey.value = null
            _isPlaying.value = false
        }
    }

    fun setVolume(vol: Float) {
        val clamped = vol.coerceIn(0f, 1f)
        _volume.value = clamped
        activePlayer?.setVolume(clamped, clamped)
    }

    fun toggleSolo() {
        _isSolo.value = !_isSolo.value
    }

    private fun createPlayer(key: String): MediaPlayer? {
        return try {
            val afd: AssetFileDescriptor = context.assets.openFd("pads/$key.mp3")
            MediaPlayer().apply {
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                isLooping = true
                prepare()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening pad asset for $key", e)
            null
        }
    }

    private fun normalizeKey(raw: String): String? {
        val clean = raw.trim()
        val mapped = when (clean.uppercase()) {
            "C#", "DB" -> "Db"
            "D#", "EB" -> "Eb"
            "F#", "GB" -> "Gb"
            "G#", "AB" -> "Ab"
            "A#", "BB" -> "Bb"
            else -> clean.replaceFirstChar { it.uppercase() }
        }
        return if (AVAILABLE_KEYS.contains(mapped)) mapped else null
    }
}
