package com.zionstagelive.nativeapp.services

import android.content.Context
import android.util.Log
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.models.Stem
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentLinkedQueue

import com.zionstagelive.nativeapp.models.Track
import org.json.JSONObject

data class DownloadProgress(
    val songId: String,
    val trackName: String,
    val currentIndex: Int,
    val totalTracks: Int,
    val fraction: Float,
    val label: String
)

private data class DownloadTask(
    val song: Song,
    val onComplete: ((List<Stem>) -> Unit)?,
    val onError: ((String) -> Unit)?
)

class DownloadManager(private val context: Context) {
    companion object {
        private const val TAG = "DownloadManager"
        @Volatile private var instance: DownloadManager? = null

        fun getInstance(context: Context): DownloadManager =
            instance ?: synchronized(this) {
                instance ?: DownloadManager(context.applicationContext).also { instance = it }
            }
    }

    private val _progress = MutableStateFlow<DownloadProgress?>(null)
    val progress: StateFlow<DownloadProgress?> = _progress.asStateFlow()

    private val _isDownloading = MutableStateFlow(false)
    val isDownloading: StateFlow<Boolean> = _isDownloading.asStateFlow()

    private val _downloadedSongIds = MutableStateFlow<Set<String>>(emptySet())
    val downloadedSongIds: StateFlow<Set<String>> = _downloadedSongIds.asStateFlow()

    private val _cachedSongs = MutableStateFlow<Map<String, Song>>(emptyMap())
    val cachedSongs: StateFlow<Map<String, Song>> = _cachedSongs.asStateFlow()

    private val _songProgressMap = MutableStateFlow<Map<String, Float>>(emptyMap())
    val songProgressMap: StateFlow<Map<String, Float>> = _songProgressMap.asStateFlow()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val queue = ConcurrentLinkedQueue<DownloadTask>()
    private var isWorkerRunning = false

    init {
        // Initial scan of downloaded songs on disk
        scope.launch {
            val songsRoot = File(context.filesDir, "songs")
            if (songsRoot.exists() && songsRoot.isDirectory) {
                val downloaded = mutableSetOf<String>()
                val loadedMap = mutableMapOf<String, Song>()
                songsRoot.listFiles()?.forEach { dir ->
                    if (dir.isDirectory) {
                        val mp3s = dir.listFiles { _, name -> name.endsWith(".mp3") }
                        if (mp3s != null && mp3s.isNotEmpty()) {
                            downloaded.add(dir.name)
                            val metaFile = File(dir, "meta.json")
                            if (metaFile.exists()) {
                                try {
                                    val json = JSONObject(metaFile.readText())
                                    val map = mutableMapOf<String, Any?>()
                                    val keys = json.keys()
                                    while (keys.hasNext()) {
                                        val k = keys.next()
                                        map[k] = json.get(k)
                                    }
                                    Song.fromMap(map, dir.name)?.let {
                                        loadedMap[dir.name] = it.copy(isDownloadedLocally = true)
                                    }
                                } catch (_: Exception) {}
                            } else {
                                val tracks = mp3s.map { file ->
                                    Track(name = file.nameWithoutExtension, url = file.absolutePath)
                                }
                                loadedMap[dir.name] = Song(
                                    id = dir.name,
                                    name = "Canción (${dir.name.take(6)})",
                                    artist = "En Dispositivo",
                                    tracks = tracks,
                                    isDownloadedLocally = true
                                )
                            }
                        }
                    }
                }
                _downloadedSongIds.value = downloaded
                _cachedSongs.value = loadedMap
            }
        }
    }

    fun registerKnownSongs(songs: List<Song>) {
        if (songs.isEmpty()) return
        scope.launch {
            val currentIds = _downloadedSongIds.value
            val currentCached = _cachedSongs.value.toMutableMap()
            var changed = false
            for (s in songs) {
                if (currentIds.contains(s.id)) {
                    val existing = currentCached[s.id]
                    if (existing == null || existing.name.startsWith("Canción (")) {
                        currentCached[s.id] = s.copy(isDownloadedLocally = true)
                        val dir = getSongDir(s.id)
                        if (dir.exists()) {
                            val metaFile = File(dir, "meta.json")
                            try {
                                metaFile.writeText(JSONObject(s.toMap()).toString())
                            } catch (_: Exception) {}
                        }
                        changed = true
                    }
                }
            }
            if (changed) {
                _cachedSongs.value = currentCached
            }
        }
    }

    fun isSongDownloaded(song: Song): Boolean {
        if (_downloadedSongIds.value.contains(song.id)) return true
        val dir = getSongDir(song.id)
        if (!dir.exists() || !dir.isDirectory) return false
        val stems = song.stems
        if (stems.isEmpty()) return false
        val allValid = stems.all { stem ->
            val file = File(dir, sanitizeFilename("${stem.name}.mp3"))
            file.exists() && file.length() > 1024
        }
        if (allValid) {
            _downloadedSongIds.value = _downloadedSongIds.value + song.id
        }
        return allValid
    }

    fun getLocalStems(song: Song): List<Stem> {
        val dir = getSongDir(song.id)
        return song.stems.map { stem ->
            val file = File(dir, sanitizeFilename("${stem.name}.mp3"))
            stem.copy(localPath = if (file.exists()) file.absolutePath else null)
        }
    }

    fun downloadSong(
        song: Song,
        onComplete: (List<Stem>) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        if (isSongDownloaded(song)) {
            val local = getLocalStems(song)
            onComplete(local)
            return
        }

        queue.add(DownloadTask(song, onComplete, onError))
        // Set initial 0% progress so UI immediately reflects that loading has begun
        _songProgressMap.value = _songProgressMap.value + (song.id to 0.05f)

        synchronized(this) {
            if (!isWorkerRunning) {
                isWorkerRunning = true
                startQueueWorker()
            }
        }
    }

    private fun startQueueWorker() {
        scope.launch {
            while (true) {
                val task = queue.poll()
                if (task == null) {
                    synchronized(this@DownloadManager) {
                        isWorkerRunning = false
                    }
                    _isDownloading.value = false
                    _progress.value = null
                    break
                }

                _isDownloading.value = true
                processSingleSong(task)
            }
        }
    }

    private suspend fun processSingleSong(task: DownloadTask) {
        val song = task.song
        val dir = getSongDir(song.id)
        if (!dir.exists()) dir.mkdirs()

        val stems = song.stems
        val total = stems.size
        if (total == 0) {
            _downloadedSongIds.value = _downloadedSongIds.value + song.id
            _songProgressMap.value = _songProgressMap.value - song.id
            withContext(Dispatchers.Main) { task.onComplete?.invoke(emptyList()) }
            return
        }

        val completedCount = java.util.concurrent.atomic.AtomicInteger(0)
        val semaphore = Semaphore(4)

        val readyStems = coroutineScope {
            stems.map { stem ->
                async(Dispatchers.IO) {
                    semaphore.withPermit {
                        val destFile = File(dir, sanitizeFilename("${stem.name}.mp3"))
                        if (destFile.exists() && destFile.length() > 1024) {
                            val done = completedCount.incrementAndGet()
                            val frac = (done.toFloat() / total).coerceIn(0.05f, 0.98f)
                            _songProgressMap.value = _songProgressMap.value + (song.id to frac)
                            _progress.value = DownloadProgress(
                                songId = song.id,
                                trackName = stem.name,
                                currentIndex = done,
                                totalTracks = total,
                                fraction = frac,
                                label = "Cargando ${stem.name} ($done/$total)..."
                            )
                            return@withPermit stem.copy(localPath = destFile.absolutePath)
                        }

                        try {
                            downloadFile(stem.audioUrl, destFile)
                            val done = completedCount.incrementAndGet()
                            val frac = (done.toFloat() / total).coerceIn(0.05f, 0.98f)
                            _songProgressMap.value = _songProgressMap.value + (song.id to frac)
                            _progress.value = DownloadProgress(
                                songId = song.id,
                                trackName = stem.name,
                                currentIndex = done,
                                totalTracks = total,
                                fraction = frac,
                                label = "Descargando ${stem.name} ($done/$total)..."
                            )
                            stem.copy(localPath = destFile.absolutePath)
                        } catch (e: Exception) {
                            Log.e(TAG, "Error downloading stem ${stem.name}", e)
                            null
                        }
                    }
                }
            }.awaitAll().filterNotNull()
        }

        if (readyStems.isEmpty() && total > 0) {
            _songProgressMap.value = _songProgressMap.value - song.id
            withContext(Dispatchers.Main) {
                task.onError?.invoke("Error al descargar pistas de ${song.title}")
            }
            return
        }

        // Save meta.json for instant offline access
        try {
            val metaFile = File(dir, "meta.json")
            metaFile.writeText(JSONObject(song.toMap()).toString())
        } catch (_: Exception) {}

        // Completed 100%
        _songProgressMap.value = _songProgressMap.value + (song.id to 1.0f)
        _downloadedSongIds.value = _downloadedSongIds.value + song.id
        _cachedSongs.value = _cachedSongs.value + (song.id to song.copy(isDownloadedLocally = true))
        _songProgressMap.value = _songProgressMap.value - song.id

        withContext(Dispatchers.Main) {
            task.onComplete?.invoke(readyStems)
        }
    }

    private fun downloadFile(urlStr: String, destFile: File) {
        val url = URL(urlStr)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000
            readTimeout = 30000
            instanceFollowRedirects = true
        }

        val tempFile = File(destFile.parentFile, "${destFile.name}.tmp")
        try {
            conn.inputStream.use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(32768)
                    var bytesRead: Int
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                    }
                    output.flush()
                }
            }
            if (tempFile.exists() && tempFile.length() > 512) {
                if (destFile.exists()) destFile.delete()
                tempFile.renameTo(destFile)
            }
        } finally {
            if (tempFile.exists()) tempFile.delete()
        }
    }

    private fun getSongDir(songId: String): File {
        return File(context.filesDir, "songs/$songId")
    }

    private fun sanitizeFilename(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
    }
}
