package com.zionstagelive.nativeapp.ui.mixer

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.zionstagelive.nativeapp.audio.NativeAudioEngine
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.models.Stem
import com.zionstagelive.nativeapp.services.DownloadManager
import com.zionstagelive.nativeapp.services.FirebaseService
import com.zionstagelive.nativeapp.theme.*
import com.zionstagelive.nativeapp.ui.bandsync.BandSyncDialog
import com.zionstagelive.nativeapp.ui.library.LibrarySplitDrawer
import com.zionstagelive.nativeapp.ui.lyrics.ChordsView
import com.zionstagelive.nativeapp.ui.lyrics.LyricsDialog
import com.zionstagelive.nativeapp.ui.lyrics.LyricsView
import com.zionstagelive.nativeapp.ui.metronome.MetronomeView
import com.zionstagelive.nativeapp.ui.partituras.PartiturasView
import com.zionstagelive.nativeapp.ui.plan.NativePlanModal
import com.zionstagelive.nativeapp.ui.setlists.SetlistDrawer
import com.zionstagelive.nativeapp.ui.settings.SettingsDrawer
import com.zionstagelive.nativeapp.ui.sidebar.SidebarRight
import com.zionstagelive.nativeapp.ui.transport.TransportBar

@Composable
fun MixerScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val downloadManager = remember { DownloadManager.getInstance(context) }

    // Audio Engine State
    val isPlaying by NativeAudioEngine.isPlaying.collectAsState()
    val position by NativeAudioEngine.playbackPosition.collectAsState()
    val duration by NativeAudioEngine.duration.collectAsState()
    val pitchSemiTones by NativeAudioEngine.pitchSemiTones.collectAsState()
    val tempoRatio by NativeAudioEngine.tempoRatio.collectAsState()
    val trackLevels by NativeAudioEngine.trackLevels.collectAsState()
    val isSessionLoading by NativeAudioEngine.isSessionLoading.collectAsState()

    // Download state
    val downloadProgress by downloadManager.progress.collectAsState()
    val isDownloading by downloadManager.isDownloading.collectAsState()

    // Firebase Data
    val userSongs by FirebaseService.librarySongs.collectAsState()
    val globalSongs by FirebaseService.globalSongs.collectAsState()
    val setlists by FirebaseService.setlists.collectAsState()
    val activeSetlist by FirebaseService.activeSetlist.collectAsState()
    val userPlanId by FirebaseService.userPlanId.collectAsState()
    val currentUser by FirebaseService.currentUser.collectAsState()

    // Sync downloaded song metadata with global and user catalogs
    LaunchedEffect(userSongs, globalSongs) {
        if (userSongs.isNotEmpty() || globalSongs.isNotEmpty()) {
            downloadManager.registerKnownSongs(userSongs + globalSongs)
        }
    }

    // Local UI State
    var currentSong by remember { mutableStateOf<Song?>(null) }
    var activeStems by remember { mutableStateOf<List<Stem>>(emptyList()) }
    var activeTab by remember { mutableStateOf("Lista") }

    // Dialogs / Drawers
    var isLibraryOpen by remember { mutableStateOf(false) }
    var isSetlistsOpen by remember { mutableStateOf(false) }
    var isCreatingSetlistInitial by remember { mutableStateOf(false) }
    var isSettingsOpen by remember { mutableStateOf(false) }
    var isPadsOpen by remember { mutableStateOf(false) }
    var isLyricsOpen by remember { mutableStateOf(false) }
    var isPitchTempoOpen by remember { mutableStateOf(false) }
    var isBandSyncOpen by remember { mutableStateOf(false) }
    var isPlanModalOpen by remember { mutableStateOf(false) }
    val masterVolume by NativeAudioEngine.masterVolume.collectAsState()

    // Load song handler
    val onSelectSong: (Song) -> Unit = { song ->
        currentSong = song
        if (downloadManager.isSongDownloaded(song)) {
            val localStems = downloadManager.getLocalStems(song)
            activeStems = localStems
            NativeAudioEngine.loadSongSession(localStems) {
                localStems.forEach { stem ->
                    NativeAudioEngine.setTrackPan(stem.id, stem.pan)
                    NativeAudioEngine.setTrackVolume(stem.id, stem.volume)
                }
            }
        } else {
            downloadManager.downloadSong(
                song = song,
                onComplete = { readyStems ->
                    activeStems = readyStems
                    NativeAudioEngine.loadSongSession(readyStems) {
                        readyStems.forEach { stem ->
                            NativeAudioEngine.setTrackPan(stem.id, stem.pan)
                            NativeAudioEngine.setTrackVolume(stem.id, stem.volume)
                        }
                    }
                },
                onError = { err ->
                    Toast.makeText(context, err, Toast.LENGTH_LONG).show()
                }
            )
        }
    }

    // Auto-load first song of active setlist if none is loaded yet
    LaunchedEffect(activeSetlist) {
        if (currentSong == null && activeSetlist != null && activeSetlist!!.songs.isNotEmpty()) {
            val first = activeSetlist!!.songs.first()
            if (downloadManager.isSongDownloaded(first)) {
                onSelectSong(first)
            }
        }
    }

    val onNextSong = {
        val list = activeSetlist?.songs ?: emptyList()
        val curIdx = list.indexOfFirst { it.id == currentSong?.id }
        if (curIdx >= 0 && curIdx < list.size - 1) {
            onSelectSong(list[curIdx + 1])
        }
    }

    val onPrevSong = {
        val list = activeSetlist?.songs ?: emptyList()
        val curIdx = list.indexOfFirst { it.id == currentSong?.id }
        if (curIdx > 0) {
            onSelectSong(list[curIdx - 1])
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(bottom = 4.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // TOP THREE-TIER TRANSPORT & NAV BAR
            TransportBar(
                currentSong = currentSong,
                isPlaying = isPlaying,
                playbackPosition = position,
                duration = if (duration > 0) duration else (currentSong?.duration ?: 0.0),
                pitchSemiTones = pitchSemiTones,
                tempoRatio = tempoRatio,
                masterVolume = masterVolume,
                onMasterVolumeChange = { newVol -> NativeAudioEngine.setMasterVolume(newVol) },
                activeTab = activeTab,
                onTabSelected = { tab ->
                    activeTab = tab
                    if (tab == "Biblioteca") isLibraryOpen = true
                },
                onPlayToggle = {
                    if (isPlaying) NativeAudioEngine.pause() else NativeAudioEngine.play()
                },
                onStopClick = { NativeAudioEngine.stop() },
                onSeek = { sec -> NativeAudioEngine.seek(sec) },
                onNextSong = onNextSong,
                onPrevSong = onPrevSong,
                onTempoChange = { NativeAudioEngine.setTempo(it) },
                onPitchChange = { NativeAudioEngine.setPitch(it) },
                onOpenLibrary = { isLibraryOpen = true },
                onOpenSetlists = { isSetlistsOpen = true },
                onOpenPads = { /* Handled in SidebarRight */ },
                onOpenLyrics = { activeTab = "Lyrics" },
                onOpenPitchTempo = { isPitchTempoOpen = true },
                onOpenBandSync = { isBandSyncOpen = true },
                onOpenSettings = { isSettingsOpen = true },
                onSignOut = { FirebaseService.signOut() },
                userPlanId = userPlanId,
                onOpenPlanModal = { isPlanModalOpen = true }
            )

            // MAIN AREA: Center Mixer Grid + Docked Right Sidebar
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // LEFT / CENTER: Dynamic Main Stage Area (Mixer or Active Tab View)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                ) {
                    when (activeTab) {
                        "🎼 Partituras" -> {
                            PartiturasView(
                                song = currentSong,
                                onBackToMixer = { activeTab = "Lista" }
                            )
                        }
                        "Metrónomo" -> {
                            MetronomeView(
                                onBackToMixer = { activeTab = "Lista" }
                            )
                        }
                        "Lyrics" -> {
                            LyricsView(
                                song = currentSong,
                                onBackToMixer = { activeTab = "Lista" }
                            )
                        }
                        "Acordes" -> {
                            ChordsView(
                                song = currentSong,
                                onBackToMixer = { activeTab = "Lista" }
                            )
                        }
                        else -> {
                            LazyVerticalGrid(
                                columns = GridCells.Fixed(5),
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                contentPadding = PaddingValues(2.dp)
                            ) {
                                if (activeStems.isEmpty()) {
                                    // Default empty tracks matching Web App
                                    val defaultStems = listOf(
                                        "CLICK" to ColorClick,
                                        "GUIA" to ColorGuide,
                                        "BASS" to ColorBass,
                                        "BGVS" to ColorVocal,
                                        "DRUMS" to ColorDrums,
                                        "EG1" to ColorGuitar,
                                        "EG2" to ColorGuitar,
                                        "KEYS1" to ColorKeys
                                    )
                                    items(defaultStems) { (stemName, stemColor) ->
                                        PlaceholderChannelStrip(name = stemName, color = stemColor)
                                    }
                                } else {
                                    items(activeStems, key = { it.id }) { stem ->
                                        val stemLevel = if (!stem.isMuted) (trackLevels[stem.id] ?: 0f) else 0f
                                        ChannelStrip(
                                            stem = stem,
                                            level = stemLevel,
                                            onVolumeChange = { newVol ->
                                                stem.volume = newVol
                                                NativeAudioEngine.setTrackVolume(stem.id, newVol)
                                                activeStems = activeStems.toList()
                                            },
                                            onMuteToggle = {
                                                stem.isMuted = !stem.isMuted
                                                NativeAudioEngine.setTrackMute(stem.id, stem.isMuted)
                                                activeStems = activeStems.toList()
                                            },
                                            onSoloToggle = {
                                                stem.isSolo = !stem.isSolo
                                                NativeAudioEngine.setTrackSolo(stem.id, stem.isSolo)
                                                activeStems = activeStems.toList()
                                            },
                                            onRouteToggle = { routeL, routeR ->
                                                stem.routeL = routeL
                                                stem.routeR = routeR
                                                val pan = when {
                                                    routeL && !routeR -> -1.0f
                                                    !routeL && routeR -> 1.0f
                                                    else -> 0.0f
                                                }
                                                stem.pan = pan
                                                NativeAudioEngine.setTrackPan(stem.id, pan)
                                                activeStems = activeStems.toList()
                                            },
                                            onColorChange = {
                                                activeStems = activeStems.toList()
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // RIGHT: PERMANENTLY DOCKED SIDEBAR (SETLIST + AMBIENT PADS)
                SidebarRight(
                    activeSetlist = activeSetlist,
                    currentSong = currentSong,
                    downloadManager = downloadManager,
                    onSelectSong = onSelectSong,
                    onRemoveSong = { songId -> FirebaseService.removeSongFromActiveSetlist(songId) },
                    onOpenLibrary = { isLibraryOpen = true },
                    onOpenSetlists = {
                        isCreatingSetlistInitial = false
                        isSetlistsOpen = true
                    },
                    onOpenCreateSetlist = {
                        isCreatingSetlistInitial = true
                        isSetlistsOpen = true
                    }
                )
            }
        }

        // Non-blocking download progress pill (Leaves screen 100% usable during live stage)
        if (isSessionLoading || (isDownloading && downloadProgress != null)) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 14.dp, start = 14.dp),
                contentAlignment = Alignment.BottomStart
            ) {
                Surface(
                    color = BgDarker.copy(alpha = 0.95f),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ZionTeal.copy(alpha = 0.6f)),
                    shadowElevation = 8.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (isDownloading && downloadProgress != null) {
                            CircularProgressIndicator(
                                progress = { downloadProgress!!.fraction },
                                modifier = Modifier.size(16.dp),
                                color = ZionTeal,
                                strokeWidth = 2.5.dp
                            )
                            Text(
                                text = "Descargando stems: ${downloadProgress!!.trackName} (${downloadProgress!!.currentIndex}/${downloadProgress!!.totalTracks})",
                                color = TextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        } else {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = PrimeCoral,
                                strokeWidth = 2.5.dp
                            )
                            Text(
                                text = "Cargando sesión multitrack...",
                                color = TextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }

        // Split Library Drawer (+Canciones)
        LibrarySplitDrawer(
            isOpen = isLibraryOpen,
            userSongs = userSongs,
            globalSongs = globalSongs,
            downloadManager = downloadManager,
            onSelectSong = { song: Song ->
                isLibraryOpen = false
                FirebaseService.addSongToActiveSetlist(song)
                val isLocal = downloadManager.isSongDownloaded(song)
                if (isLocal) {
                    Toast.makeText(context, "Añadida al setlist: ${song.title} (En dispositivo)", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "Añadida al setlist: ${song.title}. Descargando...", Toast.LENGTH_SHORT).show()
                    downloadManager.downloadSong(
                        song = song,
                        onComplete = {
                            Toast.makeText(context, "Descarga lista: ${song.title}", Toast.LENGTH_SHORT).show()
                        },
                        onError = { err ->
                            android.util.Log.w("MixerScreen", "Background download error: $err")
                        }
                    )
                }
            },
            onClose = { isLibraryOpen = false }
        )

        // Setlist Manager Drawer
        SetlistDrawer(
            isOpen = isSetlistsOpen,
            setlists = setlists,
            currentSong = currentSong,
            initialOpenCreate = isCreatingSetlistInitial,
            onOpenLibrary = {
                isSetlistsOpen = false
                isLibraryOpen = true
            },
            onSelectSong = { song ->
                isSetlistsOpen = false
                onSelectSong(song)
            },
            onClose = { isSetlistsOpen = false }
        )

        // Settings Drawer
        SettingsDrawer(
            isOpen = isSettingsOpen,
            onClose = { isSettingsOpen = false },
            activeStems = activeStems,
            onUpdateStemsPan = { updatedStems ->
                activeStems = updatedStems
            }
        )

        // Lyrics Dialog
        LyricsDialog(
            isOpen = isLyricsOpen,
            song = currentSong,
            onClose = { isLyricsOpen = false }
        )

        // Pitch & Tempo Dialog
        if (isPitchTempoOpen) {
            PitchTempoDialog(
                currentPitch = pitchSemiTones,
                currentTempo = tempoRatio,
                onPitchChange = { NativeAudioEngine.setPitch(it) },
                onTempoChange = { NativeAudioEngine.setTempo(it) },
                onDismiss = { isPitchTempoOpen = false }
            )
        }

        // Band Sync QR Dialog
        if (isBandSyncOpen) {
            BandSyncDialog(onDismiss = { isBandSyncOpen = false })
        }

        // Native Subscription / Plan Modal (matches Capacitor Multitrack.jsx)
        if (isPlanModalOpen) {
            NativePlanModal(
                userPlanId = userPlanId,
                userEmail = currentUser?.email,
                onDismiss = { isPlanModalOpen = false }
            )
        }
    }
}

@Composable
fun PlaceholderChannelStrip(name: String, color: Color) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(265.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceDark)
            .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            .padding(horizontal = 6.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(width = 14.dp, height = 7.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(color)
                    .border(0.5.dp, Color(0x66FFFFFF), RoundedCornerShape(2.dp))
            )
            Text(
                text = name,
                color = TextPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 2.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.fillMaxHeight().padding(vertical = 10.dp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.End
            ) {
                Text(text = "+6", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "0", color = ZionTealLight, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold)
                Text(text = "-5", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-10", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-20", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-40", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-∞", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.width(4.dp))

            Box(
                modifier = Modifier
                    .width(10.dp)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF020617))
                    .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(4.dp))
                    .padding(1.dp)
            ) {
                VUMeterView(level = 0f, isMuted = false, modifier = Modifier.fillMaxSize())
            }

            Spacer(modifier = Modifier.width(4.dp))

            FaderSlider(
                value = 0.8f,
                onValueChange = {},
                accentColor = color,
                isMuted = false,
                modifier = Modifier.width(44.dp)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val isClickOrGuide = name == "CLICK" || name == "GUIA"
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(if (isClickOrGuide) BtnActiveBlue else Color(0xFF131D2E))
                    .border(1.dp, if (isClickOrGuide) BtnActiveBlue else Color(0x33FFFFFF), RoundedCornerShape(5.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "L", color = if (isClickOrGuide) Color.White else Color(0xFF64748B), fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(Color(0xFF131D2E))
                    .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(5.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "M", color = Color(0xFF64748B), fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(Color(0xFF131D2E))
                    .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(5.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "S", color = Color(0xFF64748B), fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(if (!isClickOrGuide) BtnActiveRed else Color(0xFF131D2E))
                    .border(1.dp, if (!isClickOrGuide) BtnActiveRed else Color(0x33FFFFFF), RoundedCornerShape(5.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "R", color = if (!isClickOrGuide) Color.White else Color(0xFF64748B), fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
fun PitchTempoDialog(
    currentPitch: Float,
    currentTempo: Float,
    onPitchChange: (Float) -> Unit,
    onTempoChange: (Float) -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceDark),
            modifier = Modifier.padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(text = "Ajustes de Tono y Tempo", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(text = "Tono: ${currentPitch.toInt()} semitonos", color = ZionTealLight, fontSize = 13.sp)
                    Slider(
                        value = currentPitch,
                        onValueChange = onPitchChange,
                        valueRange = -6f..6f,
                        steps = 11,
                        colors = SliderDefaults.colors(thumbColor = ZionTeal, activeTrackColor = ZionTeal)
                    )
                }

                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(text = "Tempo: ${(currentTempo * 100).toInt()}%", color = Color(0xFFFBBF24), fontSize = 13.sp)
                    Slider(
                        value = currentTempo,
                        onValueChange = onTempoChange,
                        valueRange = 0.7f..1.3f,
                        colors = SliderDefaults.colors(thumbColor = Color(0xFFFBBF24), activeTrackColor = Color(0xFFFBBF24))
                    )
                }

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = ZionTeal)
                ) {
                    Text(text = "Listo", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
