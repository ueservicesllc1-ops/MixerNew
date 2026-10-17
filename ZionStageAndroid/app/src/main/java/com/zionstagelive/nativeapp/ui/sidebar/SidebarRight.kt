package com.zionstagelive.nativeapp.ui.sidebar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.Alignment
import android.widget.Toast
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.audio.PadEngine
import com.zionstagelive.nativeapp.models.Setlist
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.services.DownloadManager
import com.zionstagelive.nativeapp.services.FirebaseService
import com.zionstagelive.nativeapp.theme.*

@Composable
fun SidebarRight(
    activeSetlist: Setlist?,
    currentSong: Song?,
    downloadManager: DownloadManager,
    onSelectSong: (Song) -> Unit,
    onRemoveSong: (String) -> Unit,
    onOpenLibrary: () -> Unit,
    onOpenSetlists: () -> Unit,
    onOpenCreateSetlist: () -> Unit = onOpenSetlists,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val padEngine = remember { PadEngine.getInstance(context) }

    val padActiveKey by padEngine.activeKey.collectAsState()
    val isPadPlaying by padEngine.isPlaying.collectAsState()
    val padVolume by padEngine.volume.collectAsState()
    val isPadSolo by padEngine.isSolo.collectAsState()
    var isPadMuted by remember { mutableStateOf(false) }
    var padOctave by remember { mutableIntStateOf(0) }
    var isPadsCollapsed by remember { mutableStateOf(false) }

    val downloadedSongIds by downloadManager.downloadedSongIds.collectAsState()
    val songProgressMap by downloadManager.songProgressMap.collectAsState()

    Column(
        modifier = modifier
            .width(385.dp)
            .fillMaxHeight(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // TOP: ACTIVE SETLIST PANEL
        Card(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = SurfaceDark),
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(8.dp)
            ) {
                // Header: [QueueMusic Icon] Setlist Name | [Mix] [+Canciones] [+Setlist]
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 2.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f, fill = false),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.QueueMusic,
                            contentDescription = "Setlist",
                            tint = ZionTeal,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = activeSetlist?.name ?: "1",
                            color = TextPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Mix button
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .border(1.dp, ZionTeal.copy(alpha = 0.6f), RoundedCornerShape(6.dp))
                                .clickable { /* Mix settings */ }
                                .padding(horizontal = 7.dp, vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "🎚 Mix",
                                color = ZionTeal,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                softWrap = false
                            )
                        }

                        // +Canciones (Purple Pill)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(ZionPurple.copy(alpha = 0.25f))
                                .border(1.dp, ZionPurple, RoundedCornerShape(6.dp))
                                .clickable { onOpenLibrary() }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "+Canciones",
                                color = ZionPurpleLight,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                softWrap = false
                            )
                        }

                        // +Setlist (Cyan Pill)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(ZionTeal.copy(alpha = 0.25f))
                                .border(1.dp, ZionTeal, RoundedCornerShape(6.dp))
                                .clickable { onOpenCreateSetlist() }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "+Setlist",
                                color = ZionTealLight,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Scrollable List of Songs in Setlist
                val songList = activeSetlist?.songs ?: emptyList()

                if (songList.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "No hay canciones en este setlist.",
                                color = TextSecondary,
                                fontSize = 12.sp
                            )
                            Button(
                                onClick = onOpenLibrary,
                                colors = ButtonDefaults.buttonColors(containerColor = ZionPurple),
                                shape = RoundedCornerShape(6.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text("+ Añadir Canciones", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(2.5.dp)
                    ) {
                        itemsIndexed(songList, key = { index, song -> "${song.id}_$index" }) { idx, song ->
                            val isActive = song.id == currentSong?.id
                            val isDownloaded = downloadedSongIds.contains(song.id) || downloadManager.isSongDownloaded(song)
                            val progressFraction = songProgressMap[song.id]
                            val isDownloadingThis = progressFraction != null && !isDownloaded

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(
                                        when {
                                            isActive -> PrimeCoral
                                            isDownloaded -> Color(0xFF131D2E)
                                            isDownloadingThis -> Color(0xFF181C26)
                                            else -> Color(0xFF161922) // Grey dimmed
                                        }
                                    )
                                    .border(
                                        width = if (isActive) 1.5.dp else 1.dp,
                                        color = when {
                                            isActive -> PrimeCoral
                                            isDownloadingThis -> ZionTeal.copy(alpha = 0.5f)
                                            isDownloaded -> Color(0x22FFFFFF)
                                            else -> Color(0x14FFFFFF)
                                        },
                                        shape = RoundedCornerShape(6.dp)
                                    )
                                    .clickable {
                                        if (isActive) return@clickable
                                        if (isDownloaded) {
                                            onSelectSong(song)
                                        } else if (!isDownloadingThis) {
                                            Toast.makeText(context, "Iniciando descarga: ${song.title}...", Toast.LENGTH_SHORT).show()
                                            downloadManager.downloadSong(song)
                                        } else {
                                            val pct = ((progressFraction ?: 0f) * 100).toInt()
                                            Toast.makeText(context, "Descargando ${song.title} ($pct%)...", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                // Progress fill that diminishes the grey as loading progresses
                                if (isDownloadingThis && progressFraction != null) {
                                    Box(
                                        modifier = Modifier
                                            .matchParentSize()
                                            .fillMaxWidth(progressFraction.coerceIn(0.04f, 1f))
                                            .background(
                                                Brush.horizontalGradient(
                                                    listOf(
                                                        Color(0xFF0284C7).copy(alpha = 0.35f),
                                                        Color(0xFF00D2D3).copy(alpha = 0.55f)
                                                    )
                                                )
                                            )
                                    )
                                }

                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalArrangement = Arrangement.spacedBy(0.dp)
                                ) {
                                    // Row 1: Grip + Index + Title + Status + Trash
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            modifier = Modifier.weight(1f),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            var dragAccumulator by remember(idx, songList.size) { mutableFloatStateOf(0f) }
                                            Box(
                                                modifier = Modifier
                                                    .size(26.dp)
                                                    .pointerInput(idx, songList.size) {
                                                        detectDragGestures(
                                                            onDragStart = { dragAccumulator = 0f },
                                                            onDrag = { change, dragAmount ->
                                                                change.consume()
                                                                dragAccumulator += dragAmount.y
                                                                val threshold = 36.dp.toPx()
                                                                if (dragAccumulator > threshold && idx < songList.size - 1) {
                                                                    FirebaseService.reorderSongs(idx, idx + 1)
                                                                    dragAccumulator = 0f
                                                                } else if (dragAccumulator < -threshold && idx > 0) {
                                                                    FirebaseService.reorderSongs(idx, idx - 1)
                                                                    dragAccumulator = 0f
                                                                }
                                                            },
                                                            onDragEnd = { dragAccumulator = 0f },
                                                            onDragCancel = { dragAccumulator = 0f }
                                                        )
                                                    },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.DragIndicator,
                                                    contentDescription = "Reordenar cancion",
                                                    tint = if (isActive) Color.White.copy(alpha = 0.85f) else if (isDownloaded) ZionTealLight else Color(0xFF64748B),
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .size(17.dp)
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(
                                                        if (isActive) Color.White.copy(alpha = 0.25f)
                                                        else if (isDownloaded) Color(0x22FFFFFF)
                                                        else Color(0x11FFFFFF)
                                                    ),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = "${idx + 1}",
                                                    color = if (isActive) Color.White else if (isDownloaded) TextSecondary else Color(0xFF718096),
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            Text(
                                                text = song.title,
                                                color = when {
                                                    isActive -> Color.White
                                                    isDownloaded -> TextPrimary
                                                    isDownloadingThis -> ZionTealLight
                                                    else -> Color(0xFF718096) // Greyed out title
                                                },
                                                fontSize = 13.sp, // +2 points larger
                                                fontWeight = FontWeight.ExtraBold,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            // Status Badge: READY / CARGANDO % / OFF
                                            if (isDownloaded) {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(3.dp))
                                                        .background(Color(0x262ECC71))
                                                        .padding(horizontal = 5.dp, vertical = 1.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                                                    ) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(4.dp)
                                                                .clip(RoundedCornerShape(2.dp))
                                                                .background(Color(0xFF2ECC71))
                                                        )
                                                        Text(
                                                            text = "READY",
                                                            color = Color(0xFF2ECC71),
                                                            fontSize = 8.5.sp,
                                                            fontWeight = FontWeight.Black
                                                        )
                                                    }
                                                }
                                            } else if (isDownloadingThis) {
                                                val pct = ((progressFraction ?: 0f) * 100).toInt()
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(3.dp))
                                                        .background(Color(0x3300D2D3))
                                                        .border(0.5.dp, ZionTealLight, RoundedCornerShape(3.dp))
                                                        .padding(horizontal = 4.dp, vertical = 1.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                                                    ) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(4.dp)
                                                                .clip(RoundedCornerShape(2.dp))
                                                                .background(ZionTealLight)
                                                        )
                                                        Text(
                                                            text = "$pct%",
                                                            color = ZionTealLight,
                                                            fontSize = 8.5.sp,
                                                            fontWeight = FontWeight.Black
                                                        )
                                                    }
                                                }
                                            } else {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(3.dp))
                                                        .background(Color(0x1AEF4444))
                                                        .padding(horizontal = 4.dp, vertical = 1.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                                                    ) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(4.dp)
                                                                .clip(RoundedCornerShape(2.dp))
                                                                .background(Color(0xFF94A3B8))
                                                        )
                                                        Text(
                                                            text = "OFF",
                                                            color = Color(0xFF94A3B8),
                                                            fontSize = 8.5.sp,
                                                            fontWeight = FontWeight.Bold
                                                        )
                                                    }
                                                }
                                            }

                                            // Delete icon (Larger 18dp inside 26dp touch target)
                                            Box(
                                                modifier = Modifier
                                                    .size(26.dp)
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .clickable { onRemoveSong(song.id) },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.DeleteOutline,
                                                    contentDescription = "Remove",
                                                    tint = if (isActive) Color.White.copy(alpha = 0.9f) else Color(0xFFEF4444),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        }
                                    }

                                    // Row 2: Subtitle: Artist • Key • BPM (Smaller font size 8.5sp for compact row)
                                    val subList = mutableListOf<String>()
                                    if (song.artist.isNotEmpty()) subList.add(song.artist)
                                    if (!song.key.isNullOrEmpty()) subList.add(song.key)
                                    song.tempo?.let { subList.add("${it.toInt()} BPM") }

                                    Text(
                                        text = subList.joinToString(" • "),
                                        color = when {
                                            isActive -> Color.White.copy(alpha = 0.85f)
                                            isDownloaded -> TextSecondary
                                            else -> Color(0xFF4A5568)
                                        },
                                        fontSize = 8.5.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(start = 22.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // BOTTOM: DOCKED AMBIENT PADS PANEL
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            colors = CardDefaults.cardColors(containerColor = SurfaceDark),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Pad Header: [Power Button] Pads | Slider | 80% | [▼ Mini]
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // Green Power Button
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(
                                    if (isPadPlaying) Color(0xFF10B981)
                                    else Color(0x1FFFFFFF)
                                )
                                .border(
                                    width = 1.dp,
                                    color = if (isPadPlaying) Color(0xFF34D399) else Color(0x22FFFFFF),
                                    shape = RoundedCornerShape(6.dp)
                                )
                                .clickable {
                                    if (isPadPlaying) padEngine.stop()
                                    else padEngine.playKey(padActiveKey ?: "C")
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.PowerSettingsNew,
                                contentDescription = "Pads Power",
                                tint = if (isPadPlaying) Color.White else TextSecondary,
                                modifier = Modifier.size(15.dp)
                            )
                        }

                        Text(
                            text = if (isPadPlaying && padActiveKey != null) "Pads ($padActiveKey)" else "Pads",
                            color = if (isPadPlaying) Color(0xFF10B981) else TextPrimary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    // Pad Volume Slider
                    Row(
                        modifier = Modifier.width(135.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Slider(
                            value = padVolume,
                            onValueChange = { padEngine.setVolume(it) },
                            modifier = Modifier
                                .weight(1f)
                                .height(16.dp),
                            colors = SliderDefaults.colors(
                                thumbColor = ZionTeal,
                                activeTrackColor = ZionTeal,
                                inactiveTrackColor = Color(0x22FFFFFF)
                            )
                        )
                        Text(
                            text = "${(padVolume * 100).toInt()}%",
                            color = ZionTealLight,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.width(32.dp)
                        )
                    }

                    // Mini toggle
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0x1AFFFFFF))
                            .clickable { isPadsCollapsed = !isPadsCollapsed }
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isPadsCollapsed) "▲ Pads" else "▼ Mini",
                            color = TextSecondary,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (!isPadsCollapsed) {
                    // Controls Row: Octave: [ - ] 0 [ + ] | [ M ] [ S ]
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 1.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Text(text = "Octava:", color = TextSecondary, fontSize = 10.sp)

                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(Color(0x22FFFFFF))
                                    .clickable { padOctave = (padOctave - 1).coerceAtLeast(-1) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "-", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            Text(
                                text = if (padOctave > 0) "+$padOctave" else "$padOctave",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.width(16.dp)
                            )

                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(Color(0x22FFFFFF))
                                    .clickable { padOctave = (padOctave + 1).coerceAtMost(1) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "+", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        // Mute and Solo for Pads
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(if (isPadMuted) Color(0xFFFF5252) else Color(0x22FFFFFF))
                                    .clickable {
                                        isPadMuted = !isPadMuted
                                        padEngine.setVolume(if (isPadMuted) 0f else padVolume)
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "M",
                                    color = if (isPadMuted) Color.White else TextSecondary,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(if (isPadSolo) Color(0xFFEAB308) else Color(0x22FFFFFF))
                                    .clickable { padEngine.toggleSolo() },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "S",
                                    color = if (isPadSolo) Color.Black else TextSecondary,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    }

                    // Pad Keys Grid: 6 columns x 2 rows (pill buttons matching media_1792162236001.png)
                    val row1Keys = listOf("C", "Db", "D", "Eb", "E", "F")
                    val row2Keys = listOf("Gb", "G", "Ab", "A", "Bb", "B")

                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        // Row 1
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            row1Keys.forEach { key ->
                                val isSelected = isPadPlaying && padActiveKey == key
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(32.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (isSelected) Color(0xFF2E241E) else Color(0xFF1E293B))
                                        .border(
                                            width = if (isSelected) 2.dp else 1.dp,
                                            color = if (isSelected) Color(0xFFF97316) else Color(0xFF475569),
                                            shape = RoundedCornerShape(6.dp)
                                        )
                                        .clickable { padEngine.toggleKey(key) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = key,
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold
                                    )
                                }
                            }
                        }

                        // Row 2
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            row2Keys.forEach { key ->
                                val isSelected = isPadPlaying && padActiveKey == key
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(32.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (isSelected) Color(0xFF2E241E) else Color(0xFF1E293B))
                                        .border(
                                            width = if (isSelected) 2.dp else 1.dp,
                                            color = if (isSelected) Color(0xFFF97316) else Color(0xFF475569),
                                            shape = RoundedCornerShape(6.dp)
                                        )
                                        .clickable { padEngine.toggleKey(key) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = key,
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
