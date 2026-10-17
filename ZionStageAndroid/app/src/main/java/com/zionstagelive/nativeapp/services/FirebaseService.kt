package com.zionstagelive.nativeapp.services

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.zionstagelive.nativeapp.models.Partitura
import com.zionstagelive.nativeapp.models.Setlist
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.models.SongMarker
import com.zionstagelive.nativeapp.models.Track
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object FirebaseService {
    private const val TAG = "FirebaseService"

    private val auth by lazy { FirebaseAuth.getInstance() }
    private val firestore by lazy { FirebaseFirestore.getInstance() }

    private val _currentUser = MutableStateFlow<FirebaseUser?>(null)
    val currentUser: StateFlow<FirebaseUser?> = _currentUser.asStateFlow()

    private val _librarySongs = MutableStateFlow<List<Song>>(emptyList())
    val librarySongs: StateFlow<List<Song>> = _librarySongs.asStateFlow()

    private val _globalSongs = MutableStateFlow<List<Song>>(emptyList())
    val globalSongs: StateFlow<List<Song>> = _globalSongs.asStateFlow()

    private val _setlists = MutableStateFlow<List<Setlist>>(emptyList())
    val setlists: StateFlow<List<Setlist>> = _setlists.asStateFlow()

    private val _activeSetlist = MutableStateFlow<Setlist?>(null)
    val activeSetlist: StateFlow<Setlist?> = _activeSetlist.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _userPlanId = MutableStateFlow("free")
    val userPlanId: StateFlow<String> = _userPlanId.asStateFlow()

    private val _activePartituras = MutableStateFlow<List<Partitura>>(emptyList())
    val activePartituras: StateFlow<List<Partitura>> = _activePartituras.asStateFlow()

    private var songsListener: ListenerRegistration? = null
    private var globalListener: ListenerRegistration? = null
    private var setlistsListener: ListenerRegistration? = null
    private var userDocListener: ListenerRegistration? = null
    private var partiturasListener: ListenerRegistration? = null

    init {
        startGlobalListener()
        auth.addAuthStateListener { firebaseAuth ->
            val user = firebaseAuth.currentUser
            _currentUser.value = user
            if (user != null) {
                startUserListeners(user.uid)
            } else {
                stopUserListeners()
                _librarySongs.value = emptyList()
                _setlists.value = emptyList()
                _activeSetlist.value = null
            }
        }
    }

    fun setActiveSetlist(setlist: Setlist?) {
        _activeSetlist.value = setlist
    }

    fun createSetlist(name: String, onCreated: ((Setlist) -> Unit)? = null) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        val currentUserId = auth.currentUser?.uid ?: "guest"
        val newDocRef = firestore.collection("setlists").document()
        val newSetlist = Setlist(
            id = newDocRef.id,
            name = trimmed,
            userId = currentUserId,
            songs = emptyList()
        )
        _setlists.value = _setlists.value + newSetlist
        _activeSetlist.value = newSetlist

        val data = hashMapOf(
            "name" to trimmed,
            "userId" to currentUserId,
            "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
            "songs" to emptyList<Map<String, Any>>()
        )
        newDocRef.set(data)
            .addOnSuccessListener {
                Log.i(TAG, "Created setlist ${newDocRef.id}: $trimmed")
                onCreated?.invoke(newSetlist)
            }
            .addOnFailureListener {
                Log.e(TAG, "Failed creating setlist in Firestore", it)
                onCreated?.invoke(newSetlist)
            }
    }

    fun deleteSetlist(setlistId: String) {
        _setlists.value = _setlists.value.filter { it.id != setlistId }
        if (_activeSetlist.value?.id == setlistId) {
            _activeSetlist.value = _setlists.value.firstOrNull()
        }
        firestore.collection("setlists").document(setlistId).delete()
            .addOnFailureListener { Log.e(TAG, "Failed to delete setlist", it) }
    }

    fun addSongToActiveSetlist(song: Song) {
        var current = _activeSetlist.value
        if (current == null) {
            val defaultSet = Setlist(
                id = "default_setlist",
                name = "Setlist Principal",
                userId = auth.currentUser?.uid ?: "guest",
                songs = emptyList()
            )
            _activeSetlist.value = defaultSet
            if (_setlists.value.none { it.id == defaultSet.id }) {
                _setlists.value = _setlists.value + defaultSet
            }
            current = defaultSet
        }

        // Requirement 3: Always append at the end (bottom of the list)
        val updatedSongs = current.songs + song
        val updatedSetlist = current.copy(songs = updatedSongs)
        _activeSetlist.value = updatedSetlist
        _setlists.value = _setlists.value.map { if (it.id == updatedSetlist.id) updatedSetlist else it }

        if (current.id != "default_setlist") {
            firestore.collection("setlists").document(current.id)
                .update("songs", updatedSongs.map { it.toMap() })
                .addOnFailureListener { Log.e(TAG, "Failed to update setlist songs", it) }
        }
    }

    fun removeSongFromActiveSetlist(songId: String) {
        val current = _activeSetlist.value ?: return
        val updatedSongs = current.songs.filter { it.id != songId }
        val updatedSetlist = current.copy(songs = updatedSongs)
        _activeSetlist.value = updatedSetlist
        _setlists.value = _setlists.value.map { if (it.id == updatedSetlist.id) updatedSetlist else it }

        if (current.id != "default_setlist") {
            firestore.collection("setlists").document(current.id)
                .update("songs", updatedSongs.map { it.toMap() })
                .addOnFailureListener { Log.e(TAG, "Failed to remove song from setlist", it) }
        }
    }

    fun reorderSongs(fromIndex: Int, toIndex: Int) {
        val current = _activeSetlist.value ?: return
        if (fromIndex !in current.songs.indices || toIndex !in current.songs.indices || fromIndex == toIndex) return
        val mutable = current.songs.toMutableList()
        val item = mutable.removeAt(fromIndex)
        mutable.add(toIndex, item)
        val updatedSetlist = current.copy(songs = mutable)
        _activeSetlist.value = updatedSetlist
        _setlists.value = _setlists.value.map { if (it.id == updatedSetlist.id) updatedSetlist else it }

        if (current.id != "default_setlist") {
            firestore.collection("setlists").document(current.id)
                .update("songs", mutable.map { it.toMap() })
                .addOnFailureListener { Log.e(TAG, "Failed to reorder songs in setlist", it) }
        }
    }

    fun startGlobalListener() {
        globalListener?.remove()
        globalListener = firestore.collection("songs")
            .limit(800)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error fetching global songs", error)
                    return@addSnapshotListener
                }
                val globals = snapshot?.documents?.mapNotNull { parseSong(it) }
                    ?.filter { it.tracks.isNotEmpty() } ?: emptyList()
                Log.i(TAG, "Global songs successfully loaded: ${globals.size}")
                _globalSongs.value = globals

                if (_activeSetlist.value == null && globals.isNotEmpty()) {
                    val defaultSongs = globals.take(6)
                    val defaultSet = Setlist(
                        id = "default_setlist",
                        name = "Setlist Principal",
                        userId = "guest",
                        songs = defaultSongs
                    )
                    _activeSetlist.value = defaultSet
                    if (_setlists.value.isEmpty()) {
                        _setlists.value = listOf(defaultSet)
                    }
                }
            }
    }

    private fun startUserListeners(userId: String) {
        _isLoading.value = true

        // 1. User's personal songs
        songsListener?.remove()
        songsListener = firestore.collection("songs")
            .whereEqualTo("userId", userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error fetching user songs", error)
                    return@addSnapshotListener
                }
                val songs = snapshot?.documents?.mapNotNull { parseSong(it) } ?: emptyList()
                _librarySongs.value = songs
                _isLoading.value = false
            }

        // 2. Setlists
        setlistsListener?.remove()
        setlistsListener = firestore.collection("setlists")
            .whereEqualTo("userId", userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error fetching setlists", error)
                    return@addSnapshotListener
                }
                val sets = snapshot?.documents?.mapNotNull { doc ->
                    val name = doc.getString("name") ?: "Setlist"
                    val rawSongs = (doc.get("songs") as? List<*>)?.filterIsInstance<Map<String, Any?>>() ?: emptyList()
                    val parsedSongs = rawSongs.mapIndexedNotNull { idx, sMap ->
                        Song.fromMap(sMap, fallbackId = "${doc.id}_song_$idx")
                    }
                    Setlist(id = doc.id, name = name, userId = userId, songs = parsedSongs)
                } ?: emptyList()
                _setlists.value = sets

                // Sync active setlist
                val currentActiveId = _activeSetlist.value?.id
                if (currentActiveId != null) {
                    val updated = sets.find { it.id == currentActiveId }
                    _activeSetlist.value = updated ?: sets.firstOrNull()
                } else if (sets.isNotEmpty()) {
                    _activeSetlist.value = sets.first()
                }
            }

        // 3. User document (for userPlanId)
        userDocListener?.remove()
        userDocListener = firestore.collection("users").document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error fetching user doc for $userId", error)
                    _userPlanId.value = "free"
                    return@addSnapshotListener
                }
                val plan = snapshot?.getString("planId")
                    ?: snapshot?.getString("plan")
                    ?: snapshot?.getString("tier")
                    ?: "free"
                Log.i(TAG, "Loaded plan for user $userId: $plan")
                _userPlanId.value = plan
            }
    }

    fun loadPartiturasForSong(songId: String?) {
        partiturasListener?.remove()
        if (songId.isNullOrEmpty()) {
            _activePartituras.value = emptyList()
            return
        }
        partiturasListener = firestore.collection("partituras")
            .whereEqualTo("songId", songId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error fetching partituras", error)
                    _activePartituras.value = emptyList()
                    return@addSnapshotListener
                }
                val list = snapshot?.documents?.mapNotNull { doc ->
                    Partitura(
                        id = doc.id,
                        instrument = doc.getString("instrument") ?: "Instrumento",
                        pdfUrl = doc.getString("pdfUrl") ?: "",
                        songId = doc.getString("songId") ?: songId
                    )
                }?.sortedBy { it.instrument } ?: emptyList()
                _activePartituras.value = list
            }
    }

    private fun stopUserListeners() {
        songsListener?.remove()
        setlistsListener?.remove()
        userDocListener?.remove()
        partiturasListener?.remove()
        songsListener = null
        setlistsListener = null
        userDocListener = null
        partiturasListener = null
        _userPlanId.value = "free"
        _activePartituras.value = emptyList()
    }

    private fun extractDouble(doc: DocumentSnapshot, vararg fields: String): Double? {
        for (field in fields) {
            val raw = doc.get(field) ?: continue
            val num = when (raw) {
                is Number -> raw.toDouble()
                is String -> raw.toDoubleOrNull()
                else -> null
            }
            if (num != null) return num
        }
        return null
    }

    @Suppress("UNCHECKED_CAST")
    private fun extractTracks(doc: DocumentSnapshot): List<Track> {
        val raw = doc.get("tracks") ?: doc.get("stems") ?: doc.get("audioFiles") ?: return emptyList()
        val maps = when (raw) {
            is List<*> -> raw.filterIsInstance<Map<String, Any>>()
            is Map<*, *> -> raw.values.filterIsInstance<Map<String, Any>>()
            else -> emptyList()
        }
        return maps.map { map ->
            Track(
                name = (map["name"] as? String) ?: (map["title"] as? String) ?: "",
                url = (map["url"] as? String) ?: (map["audioUrl"] as? String) ?: "",
                normalizedUrl = map["normalizedUrl"] as? String,
                normalizedReady = (map["normalizedReady"] as? Boolean) ?: false
            )
        }.filter { it.url.isNotEmpty() }
    }

    private fun parseSong(doc: DocumentSnapshot): Song? {
        return try {
            val name = doc.getString("name") ?: doc.getString("title") ?: return null
            val artist = doc.getString("artist") ?: ""
            val tempo = extractDouble(doc, "tempo", "bpm")
            val key = doc.getString("key")
            val timeSignature = doc.getString("timeSignature") ?: "4/4"
            val duration = extractDouble(doc, "duration")
            val coverUrl = doc.getString("coverUrl")
            val lyrics = doc.getString("lyrics")
            val chords = doc.getString("chords")
            val userId = doc.getString("userId")
            val isGlobal = doc.getBoolean("isGlobal") ?: false

            val tracks = extractTracks(doc)

            Song(
                id = doc.id,
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
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing song ${doc.id}", e)
            null
        }
    }

    fun signIn(email: String, pass: String, onResult: (Boolean, String?) -> Unit) {
        val trimmed = email.trim()
        if (trimmed.isEmpty() || pass.isEmpty()) {
            onResult(false, "Por favor ingresa tu correo y contraseña.")
            return
        }
        auth.signInWithEmailAndPassword(trimmed, pass)
            .addOnSuccessListener { result ->
                Log.i(TAG, "Inicio de sesión exitoso: ${result.user?.email}")
                _currentUser.value = result.user
                onResult(true, null)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error al iniciar sesión: ${e.message}")
                val msg = when {
                    e.message?.contains("user-not-found", ignoreCase = true) == true -> "No existe ninguna cuenta con este correo."
                    e.message?.contains("wrong-password", ignoreCase = true) == true -> "Contraseña incorrecta."
                    e.message?.contains("invalid-credential", ignoreCase = true) == true -> "Credenciales inválidas. Revisa correo y contraseña."
                    e.message?.contains("network", ignoreCase = true) == true -> "Error de conexión. Revisa tu internet."
                    else -> e.localizedMessage ?: "Error al iniciar sesión."
                }
                onResult(false, msg)
            }
    }

    fun signOut() {
        auth.signOut()
        stopUserListeners()
        _currentUser.value = null
        _userPlanId.value = "free"
        _librarySongs.value = emptyList()
        _setlists.value = emptyList()
        _activeSetlist.value = null
    }
}
