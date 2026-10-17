package com.zionstagelive.nativeapp.ui.pads

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.audio.PadEngine
import com.zionstagelive.nativeapp.theme.*

@Composable
fun PadsDrawer(
    isOpen: Boolean,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val padEngine = remember { PadEngine.getInstance(context) }

    val activeKey by padEngine.activeKey.collectAsState()
    val isPlaying by padEngine.isPlaying.collectAsState()
    val volume by padEngine.volume.collectAsState()
    val isSolo by padEngine.isSolo.collectAsState()

    AnimatedVisibility(
        visible = isOpen,
        enter = slideInHorizontally(initialOffsetX = { it }) + fadeIn(),
        exit = slideOutHorizontally(targetOffsetX = { it }) + fadeOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0x80000000))
                .clickable { onClose() },
            contentAlignment = Alignment.CenterEnd
        ) {
            Surface(
                modifier = Modifier
                    .width(420.dp)
                    .fillMaxHeight()
                    .clickable(enabled = false) {}, // absorb clicks
                color = BgDarker,
                shadowElevation = 16.dp
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
                        Column {
                            Text(
                                text = "Ambient Pads",
                                color = TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (isPlaying && activeKey != null) "Tono Activo: $activeKey" else "Pads Apagados",
                                color = if (isPlaying) ZionTealLight else TextSecondary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Master Power Button
                            IconButton(
                                onClick = {
                                    if (isPlaying) padEngine.stop()
                                    else padEngine.playKey(activeKey ?: "C")
                                },
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(if (isPlaying) ZionTeal else SurfaceDark)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PowerSettingsNew,
                                    contentDescription = "Power",
                                    tint = if (isPlaying) Color.Black else TextSecondary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }

                            // Close Button
                            IconButton(
                                onClick = onClose,
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(SurfaceDark)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Close",
                                    tint = TextSecondary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // 12 Key Grid (3 rows x 4 cols)
                    val keys = PadEngine.AVAILABLE_KEYS
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        for (row in 0 until 3) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                for (col in 0 until 4) {
                                    val index = row * 4 + col
                                    val keyName = keys[index]
                                    val isSelected = isPlaying && (activeKey == keyName)

                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(
                                                if (isSelected) ZionTeal
                                                else SurfaceDark
                                            )
                                            .border(
                                                width = if (isSelected) 2.dp else 1.dp,
                                                color = if (isSelected) ZionTealLight else BorderSubtle,
                                                shape = RoundedCornerShape(10.dp)
                                            )
                                            .clickable { padEngine.toggleKey(keyName) },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = keyName,
                                            color = if (isSelected) Color.Black else TextPrimary,
                                            fontSize = 18.sp,
                                            fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Bottom Controls: Volume & Solo
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Volumen Pad",
                                    color = TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${(volume * 100).toInt()}%",
                                    color = ZionTealLight,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Slider(
                                    value = volume,
                                    onValueChange = { padEngine.setVolume(it) },
                                    modifier = Modifier.weight(1f),
                                    colors = SliderDefaults.colors(
                                        thumbColor = ZionTeal,
                                        activeTrackColor = ZionTeal,
                                        inactiveTrackColor = Color(0x33FFFFFF)
                                    )
                                )

                                // Solo Button
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (isSolo) Color(0xFFEAB308) else Color(0x33EAB308))
                                        .clickable { padEngine.toggleSolo() },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "S",
                                        color = if (isSolo) Color.Black else Color(0xFFEAB308),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Black
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
