package com.zionstagelive.nativeapp.ui.lyrics

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FormatSize
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.theme.*

@Composable
fun LyricsDialog(
    isOpen: Boolean,
    song: Song?,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: Letras, 1: Acordes
    var fontSize by remember { mutableStateOf(20) }

    AnimatedVisibility(
        visible = isOpen,
        enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0xB3000000))
                .clickable { onClose() },
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .fillMaxHeight(0.85f)
                    .clickable(enabled = false) {}, // absorb clicks
                color = BgDarker,
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                shadowElevation = 24.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                ) {
                    // Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = song?.title ?: "Sin canción cargada",
                                color = TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = song?.artist ?: "",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Font Size Controls
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SurfaceDark)
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(Icons.Default.FormatSize, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                                IconButton(
                                    onClick = { if (fontSize > 14) fontSize -= 2 },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Text("–", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                                Text("$fontSize", color = ZionTealLight, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                IconButton(
                                    onClick = { if (fontSize < 44) fontSize += 2 },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Text("+", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                            }

                            // Close Button
                            IconButton(
                                onClick = onClose,
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(SurfaceDark)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextSecondary, modifier = Modifier.size(20.dp))
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Tab Selector: Letras / Cifrado (Acordes)
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = SurfaceDark,
                        contentColor = ZionTeal,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .fillMaxWidth()
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text("Letra (Teleprompter)", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text("Cifrado & Acordes", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Content Area (Scrollable teleprompter view)
                    val contentText = if (selectedTab == 0) {
                        song?.lyrics ?: "No hay letra registrada para esta canción."
                    } else {
                        song?.chords ?: "No hay acordes registrados para esta canción."
                    }

                    val scrollState = rememberScrollState()
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF0F172A))
                            .padding(20.dp)
                    ) {
                        Text(
                            text = contentText,
                            color = Color(0xFFF1F5F9),
                            fontSize = fontSize.sp,
                            lineHeight = (fontSize * 1.5).sp,
                            fontFamily = if (selectedTab == 1) FontFamily.Monospace else FontFamily.Default,
                            fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier
                                .fillMaxWidth()
                                .verticalScroll(scrollState)
                        )
                    }
                }
            }
        }
    }
}
