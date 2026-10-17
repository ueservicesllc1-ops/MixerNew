package com.zionstagelive.nativeapp.ui.metronome

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import com.zionstagelive.nativeapp.theme.*
import kotlinx.coroutines.*
import kotlin.math.sin

@Composable
fun MetronomeDialog(
    initialBpm: Double = 120.0,
    onDismiss: () -> Unit
) {
    var bpm by remember { mutableDoubleStateOf(if (initialBpm > 0) initialBpm else 120.0) }
    var isPlaying by remember { mutableStateOf(false) }
    var beatsPerBar by remember { mutableIntStateOf(4) }
    var currentBeat by remember { mutableIntStateOf(0) }
    var lastTapTime by remember { mutableLongStateOf(0L) }
    val tapIntervals = remember { mutableStateListOf<Long>() }

    // Audio Engine for Click
    val coroutineScope = rememberCoroutineScope()
    var clickJob by remember { mutableStateOf<Job?>(null) }

    fun playClickSound(isAccent: Boolean) {
        coroutineScope.launch(Dispatchers.Default) {
            try {
                val sampleRate = 44100
                val durationMs = 25
                val numSamples = (sampleRate * (durationMs / 1000.0)).toInt()
                val freq = if (isAccent) 1200.0 else 800.0
                val buffer = ShortArray(numSamples)

                for (i in 0 until numSamples) {
                    val angle = 2.0 * Math.PI * i / (sampleRate / freq)
                    val decay = 1.0 - (i.toDouble() / numSamples)
                    buffer[i] = (sin(angle) * decay * Short.MAX_VALUE * 0.8).toInt().toShort()
                }

                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(buffer.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                track.write(buffer, 0, buffer.size)
                track.play()
                delay(durationMs.toLong() + 10)
                track.release()
            } catch (e: Exception) {
                // Ignore audio write errors
            }
        }
    }

    // Metronome loop
    LaunchedEffect(isPlaying, bpm, beatsPerBar) {
        if (!isPlaying) {
            currentBeat = 0
            return@LaunchedEffect
        }

        while (isActive && isPlaying) {
            val intervalMs = (60000.0 / bpm).toLong()
            playClickSound(isAccent = currentBeat == 0)
            delay(intervalMs)
            currentBeat = (currentBeat + 1) % beatsPerBar
        }
    }

    Dialog(
        onDismissRequest = {
            isPlaying = false
            onDismiss()
        },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .width(440.dp)
                .wrapContentHeight()
                .clip(RoundedCornerShape(20.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(20.dp)),
            color = BgDarker,
            shadowElevation = 24.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(18.dp)
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
                                .background(Color(0xFFF59E0B).copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Speed, contentDescription = null, tint = Color(0xFFFBBF24), modifier = Modifier.size(20.dp))
                        }
                        Column {
                            Text(
                                text = "Metrónomo Digital",
                                color = TextPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Precisión milimétrica para escenario",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }

                    IconButton(
                        onClick = {
                            isPlaying = false
                            onDismiss()
                        },
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(SurfaceDark)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextSecondary, modifier = Modifier.size(18.dp))
                    }
                }

                HorizontalDivider(color = BorderSubtle)

                // Visual Beat Indicators (Compás)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    for (i in 0 until beatsPerBar) {
                        val isCurrent = isPlaying && currentBeat == i
                        val isAccent = i == 0
                        val color by animateColorAsState(
                            targetValue = if (isCurrent) {
                                if (isAccent) Color(0xFFEF4444) else ZionTeal
                            } else {
                                Color(0xFF1E293B)
                            },
                            label = "beatColor"
                        )

                        Box(
                            modifier = Modifier
                                .size(if (isCurrent) 22.dp else 18.dp)
                                .clip(CircleShape)
                                .background(color)
                                .border(
                                    1.dp,
                                    if (isCurrent) Color.White else BorderSubtle,
                                    CircleShape
                                )
                        )
                    }
                }

                // Big BPM Readout
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "%.0f".format(bpm),
                        color = ZionTealLight,
                        fontSize = 58.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-2).sp
                    )
                    Text(
                        text = "BPM",
                        color = TextMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                }

                // Plus / Minus Controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = { bpm = (bpm - 5).coerceAtLeast(30.0) },
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("-5", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { bpm = (bpm - 1).coerceAtLeast(30.0) },
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("-1", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { bpm = (bpm + 1).coerceAtMost(300.0) },
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("+1", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { bpm = (bpm + 5).coerceAtMost(300.0) },
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("+5", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                }

                // BPM Slider
                Slider(
                    value = bpm.toFloat(),
                    onValueChange = { bpm = it.toDouble() },
                    valueRange = 40f..240f,
                    colors = SliderDefaults.colors(
                        thumbColor = ZionTeal,
                        activeTrackColor = ZionTeal,
                        inactiveTrackColor = Color(0xFF1E293B)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                // Time Signature (Compás) Selector: [2/4] [3/4] [4/4] [6/8]
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(2 to "2/4", 3 to "3/4", 4 to "4/4", 6 to "6/8").forEach { (beats, label) ->
                        val isSelected = beatsPerBar == beats
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) ZionTeal.copy(alpha = 0.2f) else SurfaceDark)
                                .border(1.dp, if (isSelected) ZionTeal else BorderSubtle, RoundedCornerShape(8.dp))
                                .clickable { beatsPerBar = beats }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) ZionTealLight else TextSecondary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Action Buttons: [ TAP TEMPO ] and [ PLAY / STOP ]
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Tap Tempo Button
                    OutlinedButton(
                        onClick = {
                            val now = System.currentTimeMillis()
                            if (lastTapTime > 0) {
                                val diff = now - lastTapTime
                                if (diff in 200..2000) {
                                    tapIntervals.add(diff)
                                    if (tapIntervals.size > 4) tapIntervals.removeAt(0)
                                    val avg = tapIntervals.average()
                                    bpm = (60000.0 / avg).coerceIn(40.0, 240.0)
                                } else {
                                    tapIntervals.clear()
                                }
                            }
                            lastTapTime = now
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, ZionTeal.copy(alpha = 0.5f))
                    ) {
                        Icon(Icons.Default.TouchApp, contentDescription = null, tint = ZionTeal, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("TAP", color = ZionTealLight, fontWeight = FontWeight.ExtraBold)
                    }

                    // Play/Stop Big Button
                    Button(
                        onClick = { isPlaying = !isPlaying },
                        modifier = Modifier
                            .weight(1.2f)
                            .height(48.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPlaying) Color(0xFFEF4444) else ZionTeal
                        )
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Square else Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = if (isPlaying) Color.White else Color.Black,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isPlaying) "DETENER" else "INICIAR",
                            color = if (isPlaying) Color.White else Color.Black,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }
        }
    }
}
