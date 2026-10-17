package com.zionstagelive.nativeapp.ui.partituras

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.theme.*

@Composable
fun PartiturasDialog(
    song: Song?,
    onDismiss: () -> Unit
) {
    val instruments = listOf(
        "Cifrado General" to "📜",
        "Piano" to "🎹",
        "Guitarra" to "🎸",
        "Bajo" to "🎸",
        "Batería" to "🥁",
        "Voz / Lead" to "🎤",
        "Sintetizador" to "🎛️"
    )

    var selectedInstrument by remember { mutableStateOf("Cifrado General") }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.88f)
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(16.dp)),
            color = BgDarker,
            shadowElevation = 24.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(ZionTeal.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🎼", fontSize = 20.sp)
                        }
                        Column {
                            Text(
                                text = "Partituras y Cifrados",
                                color = TextPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = song?.title?.let { "$it • ${song.artist.ifEmpty { "En vivo" }}" } ?: "No hay canción seleccionada",
                                color = ZionTealLight,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(SurfaceDark)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextSecondary, modifier = Modifier.size(20.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Content Split: Left = Instruments, Right = Sheet View
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Left: Instruments Column
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .width(220.dp)
                            .fillMaxHeight()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(12.dp)
                        ) {
                            Text(
                                text = "INSTRUMENTO",
                                color = TextMuted,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.sp,
                                modifier = Modifier.padding(bottom = 8.dp, start = 4.dp)
                            )

                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                items(instruments.size) { i ->
                                    val (name, icon) = instruments[i]
                                    val isSelected = selectedInstrument == name

                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (isSelected) ZionTeal.copy(alpha = 0.2f) else Color.Transparent)
                                            .border(
                                                width = if (isSelected) 1.dp else 0.dp,
                                                color = if (isSelected) ZionTeal else Color.Transparent,
                                                shape = RoundedCornerShape(8.dp)
                                            )
                                            .clickable { selectedInstrument = name }
                                            .padding(horizontal = 10.dp, vertical = 10.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(icon, fontSize = 16.sp)
                                            Text(
                                                text = name,
                                                color = if (isSelected) ZionTealLight else TextPrimary,
                                                fontSize = 12.sp,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Right: Sheet Music & Chord Progression Area
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Surface(
                                        color = ZionTeal.copy(alpha = 0.15f),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "Tono: ${song?.key ?: "C"}",
                                            color = ZionTealLight,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                    Surface(
                                        color = Color(0x22FBBF24),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "${song?.tempo?.toInt() ?: 120} BPM",
                                            color = Color(0xFFFBBF24),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                    Surface(
                                        color = Color(0x22A855F7),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "Compás: 4/4",
                                            color = Color(0xFFC084FC),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                }

                                Text(
                                    text = "Instrumento: $selectedInstrument",
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            HorizontalDivider(color = BorderSubtle)

                            // Live Chord Chart / Structure
                            LazyColumn(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                val sections = listOf(
                                    "INTRO" to listOf("1", "5", "6m", "4"),
                                    "VERSO 1" to listOf("1", "1", "5", "5", "6m", "6m", "4", "4"),
                                    "PRE-CORO" to listOf("2m", "4", "1", "5"),
                                    "CORO" to listOf("1", "5", "6m", "4", "1", "5", "4", "4"),
                                    "PUENTE" to listOf("6m", "4", "1", "5", "6m", "4", "5", "5"),
                                    "FINAL" to listOf("1", "5", "4", "1")
                                )

                                items(sections.size) { idx ->
                                    val (name, chords) = sections[idx]
                                    Card(
                                        colors = CardDefaults.cardColors(containerColor = BgDarker),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(14.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(
                                                text = name,
                                                color = ZionTealLight,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Black,
                                                letterSpacing = 1.sp
                                            )
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                chords.forEach { ch ->
                                                    Box(
                                                        modifier = Modifier
                                                            .weight(1f)
                                                            .height(42.dp)
                                                            .clip(RoundedCornerShape(6.dp))
                                                            .background(SurfaceDark)
                                                            .border(1.dp, BorderSubtle, RoundedCornerShape(6.dp)),
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Text(
                                                            text = ch,
                                                            color = Color.White,
                                                            fontSize = 14.sp,
                                                            fontWeight = FontWeight.ExtraBold
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Footer Note
                            Text(
                                text = "💡 Las partituras PDF personalizadas subidas desde el Dashboard se sincronizan automáticamente con cada instrumento.",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
