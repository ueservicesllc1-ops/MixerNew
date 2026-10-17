package com.zionstagelive.nativeapp.models

data class Track(
    val name: String = "",
    val url: String = "",
    val normalizedUrl: String? = null,
    val normalizedReady: Boolean = false
)

data class Stem(
    val id: String,
    val name: String,
    val role: String,
    val audioUrl: String,
    var localPath: String? = null,
    var volume: Float = 1.0f,
    var pan: Float = 0.0f,
    var isMuted: Boolean = false,
    var isSolo: Boolean = false,
    var routeL: Boolean = false,
    var routeR: Boolean = true,
    var customColor: Long? = null
) {
    val displayName: String
        get() {
            var n = name
                .replace(Regex("^(medley\\d+[-_]|\\d+[-_])", RegexOption.IGNORE_CASE), "")
                .replace(Regex("(480001|48000|44100)$"), "")
                .trim()
            if (n.isEmpty()) n = name
            return n
        }

    companion object {
        fun fromTrack(track: Track, songId: String): Stem {
            val nameLow = track.name.lowercase()
            val isClick = nameLow.contains("click") || nameLow.contains("clik") || nameLow.contains("metronom")
            val isGuide = !isClick && (nameLow.contains("guide") || nameLow.contains("guia") || nameLow.contains("cue"))
            val role = when {
                isClick -> "click"
                isGuide -> "guide"
                nameLow.contains("drum") || nameLow.contains("bat") || nameLow.contains("perc") -> "drums"
                nameLow.contains("bass") || nameLow.contains("bajo") -> "bass"
                nameLow.contains("guitar") || nameLow.contains("guit") -> "guitar"
                nameLow.contains("key") || nameLow.contains("piano") || nameLow.contains("synth") || nameLow.contains("teclado") -> "keys"
                nameLow.contains("vocal") || nameLow.contains("lead") || nameLow.contains("voz") || nameLow.contains("voc") || nameLow.contains("coro") -> "vocal"
                else -> "instrument"
            }

            // In live church multitracks:
            // Click and Guide are routed to Left (In-Ear Monitors)
            // Instruments/Vocals are routed to Right (Main PA FOH)
            val rL = isClick || isGuide
            val rR = !isClick && !isGuide
            val initialPan = when {
                rL && !rR -> -1.0f
                !rL && rR -> 1.0f
                else -> 0.0f
            }

            return Stem(
                id = "${songId}_${track.name}",
                name = track.name,
                role = role,
                audioUrl = track.url,
                routeL = rL,
                routeR = rR,
                pan = initialPan
            )
        }
    }
}

data class SongMarker(
    val id: String = "",
    val time: Double = 0.0,
    val label: String = ""
)

data class Song(
    val id: String = "",
    val name: String = "",
    val artist: String = "",
    val tempo: Double? = null,
    val key: String? = null,
    val timeSignature: String? = "4/4",
    val duration: Double? = null,
    val coverUrl: String? = null,
    val tracks: List<Track> = emptyList(),
    val lyrics: String? = null,
    val chords: String? = null,
    val markers: List<SongMarker> = emptyList(),
    val userId: String? = null,
    val isGlobal: Boolean = false,
    val isDownloadedLocally: Boolean = false
) {
    val title: String get() = name

    val stems: List<Stem>
        get() {
            val list = tracks
                .filter { it.name != "__PreviewMix" }
                .map { Stem.fromTrack(it, id) }
            val clicks = list.filter { it.role == "click" }
            val guides = list.filter { it.role == "guide" }
            val rest = list.filter { it.role != "click" && it.role != "guide" }
            return clicks + guides + rest
        }

    fun toMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "name" to name,
            "title" to name,
            "artist" to artist,
            "tempo" to tempo,
            "bpm" to tempo,
            "key" to key,
            "timeSignature" to timeSignature,
            "duration" to duration,
            "coverUrl" to coverUrl,
            "tracks" to tracks.map { mapOf("name" to it.name, "url" to it.url, "normalizedUrl" to it.normalizedUrl, "normalizedReady" to it.normalizedReady) },
            "lyrics" to lyrics,
            "chords" to chords,
            "userId" to userId,
            "isGlobal" to isGlobal
        )
    }

    companion object {
        fun fromMap(map: Map<String, Any?>, fallbackId: String = ""): Song? {
            val name = (map["name"] as? String) ?: (map["title"] as? String) ?: return null
            val id = (map["id"] as? String) ?: fallbackId
            val artist = (map["artist"] as? String) ?: ""
            val tempo = when (val t = map["tempo"] ?: map["bpm"]) {
                is Number -> t.toDouble()
                is String -> t.toDoubleOrNull()
                else -> null
            }
            val key = map["key"] as? String
            val timeSignature = (map["timeSignature"] as? String) ?: "4/4"
            val duration = when (val d = map["duration"]) {
                is Number -> d.toDouble()
                is String -> d.toDoubleOrNull()
                else -> null
            }
            val coverUrl = map["coverUrl"] as? String
            val lyrics = map["lyrics"] as? String
            val chords = map["chords"] as? String
            val userId = map["userId"] as? String
            val isGlobal = (map["isGlobal"] as? Boolean) ?: false

            val rawTracks = map["tracks"] ?: map["stems"] ?: map["audioFiles"]
            val trackMaps = when (rawTracks) {
                is List<*> -> rawTracks.filterIsInstance<Map<String, Any>>()
                is Map<*, *> -> rawTracks.values.filterIsInstance<Map<String, Any>>()
                else -> emptyList()
            }
            val tracks = trackMaps.map { tMap ->
                Track(
                    name = (tMap["name"] as? String) ?: (tMap["title"] as? String) ?: "",
                    url = (tMap["url"] as? String) ?: (tMap["audioUrl"] as? String) ?: "",
                    normalizedUrl = tMap["normalizedUrl"] as? String,
                    normalizedReady = (tMap["normalizedReady"] as? Boolean) ?: false
                )
            }.filter { it.url.isNotEmpty() }

            return Song(
                id = id,
                name = name,
                artist = artist,
                tempo = tempo,
                key = key,
                timeSignature = timeSignature,
                duration = duration,
                coverUrl = coverUrl,
                tracks = tracks,
                lyrics = lyrics,
                chords = chords,
                userId = userId,
                isGlobal = isGlobal
            )
        }
    }
}

data class Setlist(
    val id: String = "",
    val name: String = "",
    val userId: String = "",
    val songs: List<Song> = emptyList()
)

data class UserProfile(
    val uid: String = "",
    val email: String = "",
    val displayName: String = "",
    val isVip: Boolean = false,
    val subscriptionStatus: String = "active"
)
