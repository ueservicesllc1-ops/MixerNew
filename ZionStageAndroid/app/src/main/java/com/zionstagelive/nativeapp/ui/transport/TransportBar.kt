package com.zionstagelive.nativeapp.ui.transport

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.theme.*

@Composable
fun TransportBar(
    currentSong: Song?,
    isPlaying: Boolean,
    playbackPosition: Double,
    duration: Double,
    pitchSemiTones: Float,
    tempoRatio: Float,
    masterVolume: Float = 1.0f,
    onMasterVolumeChange: (Float) -> Unit = {},
    activeTab: String = "Lista",
    onTabSelected: (String) -> Unit = {},
    onPlayToggle: () -> Unit,
    onStopClick: () -> Unit,
    onSeek: (Double) -> Unit,
    onNextSong: () -> Unit = {},
    onPrevSong: () -> Unit = {},
    onTempoChange: (Float) -> Unit = {},
    onPitchChange: (Float) -> Unit = {},
    onOpenLibrary: () -> Unit,
    onOpenSetlists: () -> Unit,
    onOpenPads: () -> Unit,
    onOpenLyrics: () -> Unit,
    onOpenPitchTempo: () -> Unit,
    onOpenPartituras: () -> Unit = {},
    onOpenMetronome: () -> Unit = {},
    onOpenBandSync: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onSignOut: () -> Unit = {},
    userPlanId: String = "free",
    onOpenPlanModal: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = Color(0xFF0F172A),
        shadowElevation = 6.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // ROW 1: HEADER & TRANSPORT CONTROLS (Height 44dp)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left: [FREE] badge + [MASTER FADER SLIDER] (Wider, interactive horizontal fader)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // User Plan Pill Badge (matches Capacitor App Multitrack.jsx)
                    val vipIds = remember { setOf("vip1", "vip2", "vip3", "zion_desktop_pro_online", "universal_pro") }
                    val isVip = vipIds.contains(userPlanId)
                    val planLabels = remember {
                        mapOf(
                            "vip1" to "VIP", "vip2" to "VIP", "vip3" to "VIP ⭐",
                            "zion_desktop_pro_online" to "PRO ⭐",
                            "free" to "FREE", "std1" to "BÁSICO", "std2" to "ESTÁNDAR",
                            "std3" to "PLUS", "zion_desktop_pro_local" to "PRO PC",
                            "seller" to "VENDEDOR",
                            "universal_pro" to "UP ⭐"
                        )
                    }
                    val planLabel = planLabels[userPlanId] ?: (if (userPlanId.isNotBlank()) userPlanId.uppercase() else "FREE")

                    Box(
                        modifier = Modifier
                            .height(34.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                if (isVip) Brush.linearGradient(
                                    listOf(Color(0x2EF1C40F), Color(0x24E67E22))
                                ) else Brush.linearGradient(listOf(Color(0xFF0F172A), Color(0xFF0F172A)))
                            )
                            .border(
                                1.dp,
                                if (isVip) Color(0x99F1C40F) else Color(0x7364748B),
                                RoundedCornerShape(999.dp)
                            )
                            .clickable { onOpenPlanModal() }
                            .padding(horizontal = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = planLabel,
                            color = if (isVip) Color(0xFFF1C40F) else Color(0xFF94A3B8),
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp
                        )
                    }

                    // MASTER VOLUME HORIZONTAL FADER SLIDER (Width 190dp, Height 44dp, drag/tap interactive)
                    var masterWidthPx by remember { mutableFloatStateOf(0f) }
                    val currentOnMasterChange by rememberUpdatedState(onMasterVolumeChange)

                    Box(
                        modifier = Modifier
                            .width(190.dp)
                            .height(44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x44FFFFFF), RoundedCornerShape(8.dp))
                            .onSizeChanged { masterWidthPx = it.width.toFloat() }
                            .pointerInput(Unit) {
                                awaitEachGesture {
                                    val down = awaitFirstDown(requireUnconsumed = false)
                                    fun update(x: Float) {
                                        if (masterWidthPx > 0f) {
                                            val frac = (x / masterWidthPx).coerceIn(0f, 1f)
                                            currentOnMasterChange(frac)
                                        }
                                    }
                                    update(down.position.x)
                                    down.consume()

                                    while (true) {
                                        val event = awaitPointerEvent()
                                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                        if (!change.pressed) break
                                        update(change.position.x)
                                        change.consume()
                                    }
                                }
                            },
                        contentAlignment = Alignment.CenterStart
                    ) {
                        // Dynamic Gradient Fill matching Web App
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(masterVolume.coerceIn(0f, 1f))
                                .background(
                                    Brush.horizontalGradient(
                                        listOf(Color(0xFF0284C7), Color(0xFF00B4D8), Color(0xFF00F2FE))
                                    )
                                )
                        )

                        // Centered Title Text with subtle shadow
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "MASTER",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 2.sp
                            )
                        }
                    }
                }

                // Center-Left: Transport Buttons: [ |< ] [ > ] [ [] ] [ >| ] (Prominent DAW buttons)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Prev / Return to zero
                    Box(
                        modifier = Modifier
                            .size(width = 52.dp, height = 44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .clickable { onSeek(0.0) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.SkipPrevious,
                            contentDescription = "Prev",
                            tint = Color.White,
                            modifier = Modifier.size(26.dp)
                        )
                    }

                    // Play / Pause (Larger, prominent button)
                    Box(
                        modifier = Modifier
                            .size(width = 62.dp, height = 44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isPlaying) Color(0xFF0F2B36) else Color(0xFF1E293B))
                            .border(
                                1.5.dp,
                                if (isPlaying) ZionTeal else Color(0x44FFFFFF),
                                RoundedCornerShape(8.dp)
                            )
                            .clickable { onPlayToggle() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = "Play",
                            tint = if (isPlaying) ZionTealLight else Color(0xFF10B981),
                            modifier = Modifier.size(30.dp)
                        )
                    }

                    // Stop
                    Box(
                        modifier = Modifier
                            .size(width = 52.dp, height = 44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .clickable { onStopClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = "Stop",
                            tint = Color(0xFFEF4444),
                            modifier = Modifier.size(26.dp)
                        )
                    }

                    // Next Song
                    Box(
                        modifier = Modifier
                            .size(width = 52.dp, height = 44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .clickable { onNextSong() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.SkipNext,
                            contentDescription = "Next",
                            tint = Color.White,
                            modifier = Modifier.size(26.dp)
                        )
                    }
                }

                // Center-Right: Tempo Pill & Pitch Pill
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val baseBpm = currentSong?.tempo ?: 120.0
                    val currentBpm = baseBpm * tempoRatio

                    // [ - 120.0 BPM (def) + ]
                    Row(
                        modifier = Modifier
                            .height(44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable { onTempoChange((tempoRatio - 0.02f).coerceAtLeast(0.5f)) },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "−", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }

                        Text(
                            text = String.format("%.1f BPM", currentBpm),
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.clickable { onOpenPitchTempo() }
                        )

                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable { onTempoChange((tempoRatio + 0.02f).coerceAtMost(1.5f)) },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "+", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Key Shift Pill: [ - Key + ]
                    val songKey = currentSong?.key ?: "--"
                    val pitchInt = pitchSemiTones.toInt()
                    val pitchLabel = if (pitchInt == 0) songKey else "$songKey (${if (pitchInt > 0) "+$pitchInt" else "$pitchInt"})"

                    Row(
                        modifier = Modifier
                            .height(44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable { onPitchChange(pitchSemiTones - 1f) },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "−", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }

                        Text(
                            text = pitchLabel,
                            color = ZionTealLight,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.clickable { onOpenPitchTempo() }
                        )

                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable { onPitchChange(pitchSemiTones + 1f) },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "+", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Right: [ES | EN], [123], Logout icon, QR Code icon, Settings icon
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Dual-pill ES | EN
                    Row(
                        modifier = Modifier
                            .height(44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .padding(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(5.dp))
                                .background(ZionTeal)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "ES", color = Color(0xFF020617), fontSize = 11.sp, fontWeight = FontWeight.Black)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(5.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "EN", color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // 123 badge
                    Box(
                        modifier = Modifier
                            .height(44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "123",
                            color = TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Logout icon
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = "Salir",
                        tint = TextSecondary,
                        modifier = Modifier
                            .size(24.dp)
                            .clickable { onSignOut() }
                    )

                    // Band Sync QR Code button (matches Capacitor packaged app)
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(6.dp))
                            .clickable { onOpenBandSync() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCode,
                            contentDescription = "Band Sync QR",
                            tint = ZionTealLight,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Settings icon
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                            .clickable { onOpenSettings() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Configuración",
                            tint = ZionTealLight,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // ROW 2: TIMELINE & PROGRESS BAR WITH REAL WAVEFORM (Taller height: 62dp, Scrubber: 56dp)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(62.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Time badge: 0:00 / 3:57
                Box(
                    modifier = Modifier
                        .height(56.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF1E293B))
                        .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${formatSeconds(playbackPosition)} / ${formatSeconds(duration)}",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Waveform Audio Scrubber (56dp tall DAW waveform)
                WaveformScrubber(
                    songId = currentSong?.id,
                    playbackPosition = playbackPosition,
                    duration = duration,
                    onSeek = onSeek,
                    modifier = Modifier
                        .weight(1f)
                        .height(56.dp)
                )

                // Tiempo button
                Box(
                    modifier = Modifier
                        .height(56.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF1E293B))
                        .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Timer,
                            contentDescription = "Tiempo",
                            tint = ZionTealLight,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(text = "Tiempo", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // ROW 3: MODE TABS BAR: [Lista] [Biblioteca] [Pads] [🎼 Partituras] [Lyrics] [Acordes] [Metrónomo]
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(38.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val tabs = listOf(
                    "Lista" to Icons.Default.ViewColumn,
                    "Biblioteca" to Icons.Default.LibraryMusic,
                    "Pads" to Icons.Default.GridOn,
                    "🎼 Partituras" to Icons.Default.MenuBook,
                    "Lyrics" to Icons.Default.Description,
                    "Acordes" to Icons.Default.MusicNote,
                    "Metrónomo" to Icons.Default.Speed
                )

                tabs.forEach { (tabName, _) ->
                    val isSelected = activeTab == tabName
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(
                                if (isSelected) Color(0xFF1E293B)
                                else Color(0xFF131D2E)
                            )
                            .border(
                                width = if (isSelected) 1.5.dp else 1.dp,
                                color = if (isSelected) ZionTeal else Color(0x22FFFFFF),
                                shape = RoundedCornerShape(8.dp)
                            )
                            .clickable {
                                when (tabName) {
                                    "Biblioteca" -> onOpenLibrary()
                                    "Pads" -> onOpenPads()
                                    else -> {
                                        // Toggle active tab or revert to Lista (Mixer)
                                        val next = if (isSelected) "Lista" else tabName
                                        onTabSelected(next)
                                    }
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = tabName,
                            color = if (isSelected) ZionTealLight else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

private fun formatSeconds(sec: Double): String {
    if (sec <= 0 || sec.isNaN()) return "0:00"
    val m = (sec / 60).toInt()
    val s = (sec % 60).toInt()
    return String.format("%d:%02d", m, s)
}
