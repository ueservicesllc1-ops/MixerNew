package com.zionstagelive.nativeapp.ui.lyrics

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun ChordsView(
    song: Song?,
    onBackToMixer: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isAutoScroll by remember { mutableStateOf(false) }
    var autoScrollSpeed by remember { mutableFloatStateOf(1.0f) }
    var fontSize by remember { mutableIntStateOf(20) }

    val scrollState = rememberScrollState()

    LaunchedEffect(isAutoScroll, autoScrollSpeed) {
        if (isAutoScroll) {
            while (isActive) {
                delay(35L)
                val step = (autoScrollSpeed * 2).toInt().coerceAtLeast(1)
                scrollState.scrollBy(step.toFloat())
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0A0A0E))
            .padding(14.dp)
    ) {
        // Shared Tab Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Button(
                    onClick = onBackToMixer,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Volver",
                        tint = ZionTeal,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "MIXER",
                        color = ZionTeal,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = "Cifrado",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold
                )

                if (song != null) {
                    Text(
                        text = "• ${song.title} (${song.key ?: "Tono MT"})",
                        color = TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Controls Bar
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { isAutoScroll = !isAutoScroll },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isAutoScroll) ZionTeal else Color(0xFF1E293B)
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = if (isAutoScroll) "AUTO-SCROLL ON" else "AUTO-SCROLL OFF",
                        color = if (isAutoScroll) Color(0xFF020617) else Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (isAutoScroll) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("VEL:", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Button(
                            onClick = { autoScrollSpeed = (autoScrollSpeed - 0.2f).coerceAtLeast(0.2f) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(4.dp),
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                        ) { Text("-", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                        Text(
                            text = String.format("%.1fx", autoScrollSpeed),
                            color = ZionTeal,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Button(
                            onClick = { autoScrollSpeed = (autoScrollSpeed + 0.2f).coerceAtMost(3.0f) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(4.dp),
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                        ) { Text("+", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    }
                }

                // Font Size controls
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("TEXTO:", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Button(
                        onClick = { fontSize = (fontSize - 2).coerceAtLeast(14) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                        shape = RoundedCornerShape(4.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                    ) { Text("-", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    Text(
                        text = "$fontSize",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Button(
                        onClick = { fontSize = (fontSize + 2).coerceAtMost(60) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                        shape = RoundedCornerShape(4.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                    ) { Text("+", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
            }
        }

        // Chords Content
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF0F172A))
                .verticalScroll(scrollState)
                .padding(30.dp)
        ) {
            val chords = song?.chords
            if (!chords.isNullOrBlank()) {
                Text(
                    text = chords,
                    color = Color.White,
                    fontSize = fontSize.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = (fontSize * 1.5).sp,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("📜", fontSize = 48.sp)
                        Text("No hay acordes disponibles", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text("Agrega acordes en formato [C]Texto", color = Color(0xFF64748B), fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
