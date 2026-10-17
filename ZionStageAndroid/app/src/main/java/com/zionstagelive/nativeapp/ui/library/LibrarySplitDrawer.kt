package com.zionstagelive.nativeapp.ui.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.services.DownloadManager
import com.zionstagelive.nativeapp.theme.*

enum class LibraryTab {
    DOWNLOADED,
    USER_SONGS,
    GLOBAL_VIP
}

@Composable
fun LibrarySplitDrawer(
    isOpen: Boolean,
    userSongs: List<Song>,
    globalSongs: List<Song>,
    downloadManager: DownloadManager,
    onSelectSong: (Song) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (!isOpen) return

    val downloadedSongIds by downloadManager.downloadedSongIds.collectAsState()
    val cachedSongs by downloadManager.cachedSongs.collectAsState()

    // Default tab is DOWNLOADED (En Dispositivo) as requested!
    var selectedTab by remember { mutableStateOf(LibraryTab.DOWNLOADED) }
    var searchQuery by remember { mutableStateOf("") }

    // Merge and deduplicate all known songs across cached, global and user sources
    val allKnownSongs = remember(userSongs, globalSongs, cachedSongs, downloadedSongIds) {
        val map = linkedMapOf<String, Song>()
        // 1. Locally cached songs from storage
        cachedSongs.values.forEach { map[it.id] = it }
        // 2. Global VIP catalog
        globalSongs.forEach { s ->
            val isDown = downloadedSongIds.contains(s.id) || cachedSongs.containsKey(s.id) || downloadManager.isSongDownloaded(s)
            val existing = map[s.id]
            map[s.id] = s.copy(
                isDownloadedLocally = isDown,
                tracks = if (s.tracks.isNotEmpty()) s.tracks else existing?.tracks ?: emptyList()
            )
        }
        // 3. User songs
        userSongs.forEach { s ->
            val isDown = downloadedSongIds.contains(s.id) || cachedSongs.containsKey(s.id) || downloadManager.isSongDownloaded(s)
            val existing = map[s.id]
            map[s.id] = s.copy(
                isDownloadedLocally = isDown,
                tracks = if (s.tracks.isNotEmpty()) s.tracks else existing?.tracks ?: emptyList()
            )
        }
        map.values.toList()
    }

    val downloadedList = remember(allKnownSongs, downloadedSongIds, cachedSongs) {
        allKnownSongs.filter { song ->
            downloadedSongIds.contains(song.id) || cachedSongs.containsKey(song.id) || downloadManager.isSongDownloaded(song)
        }
    }

    val currentList = remember(selectedTab, downloadedList, userSongs, globalSongs, searchQuery) {
        val base = when (selectedTab) {
            LibraryTab.DOWNLOADED -> downloadedList
            LibraryTab.USER_SONGS -> userSongs
            LibraryTab.GLOBAL_VIP -> globalSongs
        }
        if (searchQuery.isBlank()) {
            base
        } else {
            val q = searchQuery.trim().lowercase()
            base.filter {
                it.title.lowercase().contains(q) || it.artist.lowercase().contains(q)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xCC000000))
            .clickable { onClose() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(0.92f)
                .align(Alignment.CenterEnd)
                .clip(RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp))
                .background(BgDark)
                .border(1.dp, BorderSubtle, RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp))
                .clickable(enabled = false) {}
        ) {
            // LEFT PANEL: Search & Filters (Fixed width 360dp)
            Column(
                modifier = Modifier
                    .width(360.dp)
                    .fillMaxHeight()
                    .background(SurfaceDark)
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.LibraryMusic, contentDescription = null, tint = ZionTeal)
                        Text(
                            text = "BIBLIOTECA",
                            color = TextPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )
                    }

                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextSecondary)
                    }
                }

                // 3 Tabs: Descargadas / Mis Canciones / Global VIP
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(BgDarker)
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Tab 1: Descargadas (Default)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (selectedTab == LibraryTab.DOWNLOADED) Color(0xFF10B981) else Color.Transparent)
                            .clickable { selectedTab = LibraryTab.DOWNLOADED }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.DownloadDone,
                                contentDescription = null,
                                tint = if (selectedTab == LibraryTab.DOWNLOADED) Color.Black else Color(0xFF10B981),
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = "Descargadas (${downloadedList.size})",
                                color = if (selectedTab == LibraryTab.DOWNLOADED) Color.Black else TextSecondary,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                        }
                    }

                    // Tab 2: Mis Canciones
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (selectedTab == LibraryTab.USER_SONGS) ZionTeal else Color.Transparent)
                            .clickable { selectedTab = LibraryTab.USER_SONGS }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Mías (${userSongs.size})",
                            color = if (selectedTab == LibraryTab.USER_SONGS) Color.Black else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                    }

                    // Tab 3: Global VIP
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (selectedTab == LibraryTab.GLOBAL_VIP) ZionPurple else Color.Transparent)
                            .clickable { selectedTab = LibraryTab.GLOBAL_VIP }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Global VIP (${globalSongs.size})",
                            color = if (selectedTab == LibraryTab.GLOBAL_VIP) Color.White else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                    }
                }

                // Search Input Field
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text(
                            text = when (selectedTab) {
                                LibraryTab.DOWNLOADED -> "Buscar en descargadas..."
                                LibraryTab.USER_SONGS -> "Buscar en tus canciones..."
                                LibraryTab.GLOBAL_VIP -> "Buscar en catálogo global..."
                            },
                            color = TextMuted,
                            fontSize = 12.5.sp
                        )
                    },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Buscar", tint = ZionTeal) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Clear, contentDescription = "Limpiar", tint = TextSecondary)
                            }
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = when (selectedTab) {
                            LibraryTab.DOWNLOADED -> Color(0xFF10B981)
                            LibraryTab.GLOBAL_VIP -> ZionPurple
                            else -> ZionTeal
                        },
                        unfocusedBorderColor = BorderSubtle,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedContainerColor = BgDarker,
                        unfocusedContainerColor = BgDarker
                    ),
                    shape = RoundedCornerShape(8.dp),
                    singleLine = true
                )

                // Quick explanation badge
                Surface(
                    color = BgDarker,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = ZionTeal, modifier = Modifier.size(14.dp))
                            Text(
                                text = if (selectedTab == LibraryTab.DOWNLOADED) "Listo para tocar" else "Acceso en la nube",
                                color = TextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = if (selectedTab == LibraryTab.DOWNLOADED)
                                "Las canciones descargadas se cargan de inmediato al setlist sin esperas de red ni consumo de datos."
                            else
                                "Al seleccionar una canción de la nube se añadirá a tu setlist y se descargará en segundo plano.",
                            color = TextSecondary,
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Stats footer
                Text(
                    text = "${currentList.size} canciones encontradas",
                    color = TextMuted,
                    fontSize = 12.sp
                )
            }

            // RIGHT PANEL: Results list (LazyColumn native 120fps)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(BgDark)
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = when (selectedTab) {
                                LibraryTab.DOWNLOADED -> "Canciones en tu Dispositivo"
                                LibraryTab.USER_SONGS -> "Tus Canciones Subidas"
                                LibraryTab.GLOBAL_VIP -> "Catálogo Global VIP"
                            },
                            color = TextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = when (selectedTab) {
                                LibraryTab.DOWNLOADED -> "Listas para tocar en vivo sin conexión a internet"
                                LibraryTab.USER_SONGS -> "Canciones multitrack subidas desde tu cuenta"
                                LibraryTab.GLOBAL_VIP -> "Explora y descarga multitracks de la comunidad"
                            },
                            color = TextSecondary,
                            fontSize = 11.5.sp
                        )
                    }

                    if (selectedTab == LibraryTab.DOWNLOADED) {
                        Surface(
                            color = Color(0xFF10B981).copy(alpha = 0.15f),
                            shape = RoundedCornerShape(20.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.5f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Icon(Icons.Default.OfflinePin, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                                Text(
                                    text = "${downloadedList.size} OFFLINE LISTAS",
                                    color = Color(0xFF34D399),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (currentList.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = if (selectedTab == LibraryTab.DOWNLOADED) Icons.Default.CloudDownload else Icons.Default.SearchOff,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(44.dp)
                            )
                            Text(
                                text = if (selectedTab == LibraryTab.DOWNLOADED)
                                    "No tienes canciones descargadas en este dispositivo"
                                else
                                    "No se encontraron canciones con ese nombre",
                                color = TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            if (selectedTab == LibraryTab.DOWNLOADED) {
                                Text(
                                    text = "Elige canciones en 'Global VIP' o 'Mías' para descargarlas a tu tablet.",
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(currentList, key = { it.id }) { song ->
                            val isDownloaded = downloadedSongIds.contains(song.id) ||
                                    cachedSongs.containsKey(song.id) ||
                                    downloadManager.isSongDownloaded(song)

                            SongCardItem(
                                song = song,
                                isDownloaded = isDownloaded,
                                onClick = {
                                    onSelectSong(song)
                                    onClose()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SongCardItem(
    song: Song,
    isDownloaded: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(SurfaceDark)
            .border(
                width = if (isDownloaded) 1.dp else 1.dp,
                color = if (isDownloaded) Color(0xFF10B981).copy(alpha = 0.35f) else BorderSubtle,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = song.title,
                color = TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(2.dp))

            Text(
                text = song.artist.ifEmpty { "Artista Desconocido" },
                color = TextSecondary,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Metadata Pills (BPM, Key, Stems Count, and Downloaded status)
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            song.tempo?.let { bpm ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(BgDarker)
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                ) {
                    Text(text = "${bpm.toInt()} BPM", color = Color(0xFFFBBF24), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            song.key?.let { key ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(BgDarker)
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                ) {
                    Text(text = key, color = ZionTealLight, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            if (song.stems.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(ZionPurple.copy(alpha = 0.2f))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                ) {
                    Text(text = "${song.stems.size} stems", color = ZionPurpleLight, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Local status pill
            if (isDownloaded) {
                Surface(
                    color = Color(0xFF10B981).copy(alpha = 0.16f),
                    shape = RoundedCornerShape(4.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.6f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(11.dp))
                        Text(text = "EN DISPOSITIVO", color = Color(0xFF34D399), fontSize = 9.sp, fontWeight = FontWeight.Black)
                    }
                }
            } else {
                Surface(
                    color = Color(0x18FFFFFF),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Icon(Icons.Default.Cloud, contentDescription = null, tint = TextMuted, modifier = Modifier.size(11.dp))
                        Text(text = "EN LA NUBE", color = TextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }

            // Action Button (+ Al Setlist)
            Button(
                onClick = onClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isDownloaded) Color(0xFF10B981) else ZionTeal
                ),
                shape = RoundedCornerShape(6.dp),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                modifier = Modifier.height(30.dp)
            ) {
                Icon(
                    imageVector = if (isDownloaded) Icons.Default.Add else Icons.Default.Download,
                    contentDescription = null,
                    tint = if (isDownloaded) Color.White else Color.Black,
                    modifier = Modifier.size(13.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (isDownloaded) "+ Setlist" else "+ Descargar",
                    color = if (isDownloaded) Color.White else Color.Black,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
