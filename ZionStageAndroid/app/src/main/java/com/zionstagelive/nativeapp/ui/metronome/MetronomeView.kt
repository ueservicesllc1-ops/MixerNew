package com.zionstagelive.nativeapp.ui.metronome

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.zionstagelive.nativeapp.theme.*
import kotlinx.coroutines.*
import kotlin.math.sin

@Composable
fun MetronomeView(
    onBackToMixer: () -> Unit,
    modifier: Modifier = Modifier
) {
    var tempo by remember { mutableIntStateOf(120) }
    var isPlaying by remember { mutableStateOf(false) }
    var pan by remember { mutableFloatStateOf(0f) }
    var masterVol by remember { mutableFloatStateOf(1.0f) }
    var clickSound by remember { mutableStateOf("woodblock") } // classic, woodblock, digital

    var beatsPerBar by remember { mutableIntStateOf(4) }
    var subType by remember { mutableIntStateOf(1) } // 1=negras, 2=corcheas, 3=tresillos, 4=semicorcheas
    var volAccent by remember { mutableFloatStateOf(1.0f) }
    var volQuarter by remember { mutableFloatStateOf(0.8f) }
    var volSub by remember { mutableFloatStateOf(0.5f) }

    // Tap tempo tracking
    var lastTapTime by remember { mutableLongStateOf(0L) }
    val tapTimes = remember { mutableStateListOf<Long>() }

    val coroutineScope = rememberCoroutineScope()
    var metronomeJob by remember { mutableStateOf<Job?>(null) }

    fun playClickSound(isAccent: Boolean, isSub: Boolean) {
        coroutineScope.launch(Dispatchers.Default) {
            try {
                val nodeVol = when {
                    isSub -> volSub
                    isAccent -> volAccent
                    else -> volQuarter
                } * masterVol

                if (nodeVol <= 0.01f) return@launch

                val sampleRate = 44100
                val durationMs = when (clickSound) {
                    "digital" -> 15
                    "woodblock" -> 35
                    else -> 45
                }
                val numSamples = (sampleRate * (durationMs / 1000.0)).toInt()

                val freq = when (clickSound) {
                    "woodblock" -> if (isAccent) 1200.0 else if (isSub) 600.0 else 800.0
                    "digital" -> if (isAccent) 2000.0 else if (isSub) 800.0 else 1000.0
                    else -> if (isAccent) 880.0 else if (isSub) 330.0 else 440.0
                }

                // Stereo buffer: Left channel, Right channel
                val leftGain = ((1f - pan) / 2f).coerceIn(0f, 1f) * nodeVol
                val rightGain = ((1f + pan) / 2f).coerceIn(0f, 1f) * nodeVol
                val buffer = ShortArray(numSamples * 2)

                for (i in 0 until numSamples) {
                    val angle = 2.0 * Math.PI * i / (sampleRate / freq)
                    val decay = 1.0 - (i.toDouble() / numSamples)
                    val sample = (sin(angle) * decay * Short.MAX_VALUE).toInt()
                    buffer[i * 2] = (sample * leftGain).toInt().toShort()
                    buffer[i * 2 + 1] = (sample * rightGain).toInt().toShort()
                }

                val audioTrack = AudioTrack.Builder()
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
                            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                            .build()
                    )
                    .setBufferSizeInBytes(buffer.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                audioTrack.write(buffer, 0, buffer.size)
                audioTrack.play()
                delay(durationMs + 20L)
                audioTrack.stop()
                audioTrack.release()
            } catch (e: Exception) {
                // Ignore audio generation glitches
            }
        }
    }

    LaunchedEffect(isPlaying, tempo, beatsPerBar, subType, volAccent, volQuarter, volSub, pan, masterVol, clickSound) {
        metronomeJob?.cancel()
        if (isPlaying) {
            metronomeJob = launch(Dispatchers.Default) {
                var currentBeat = 0
                while (isActive) {
                    val beatIntervalMs = (60_000L / tempo)
                    val subIntervalMs = beatIntervalMs / subType

                    for (sub in 0 until subType) {
                        val isAccent = (currentBeat == 0 && sub == 0)
                        val isSubBeat = sub > 0
                        playClickSound(isAccent, isSubBeat)
                        delay(subIntervalMs)
                    }

                    currentBeat = (currentBeat + 1) % beatsPerBar
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            metronomeJob?.cancel()
        }
    }

    fun handleTapTempo() {
        val now = System.currentTimeMillis()
        if (tapTimes.isNotEmpty() && now - tapTimes.last() > 2000L) {
            tapTimes.clear()
        }
        tapTimes.add(now)
        if (tapTimes.size > 5) tapTimes.removeAt(0)
        if (tapTimes.size >= 2) {
            var diffSum = 0L
            for (i in 1 until tapTimes.size) {
                diffSum += tapTimes[i] - tapTimes[i - 1]
            }
            val avgDiff = diffSum.toDouble() / (tapTimes.size - 1)
            val calculatedBpm = (60_000.0 / avgDiff).toInt()
            tempo = calculatedBpm.coerceIn(30, 300)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0A0A0E))
            .padding(14.dp)
    ) {
        // Tab Header: [ < MIXER ] button + Title matching Metronome.jsx
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
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
                text = "Metrónomo Digital",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }

        // Two-column layout exactly matching Capacitor Metronome.jsx
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // COLUMNA 1: CONTROLES PRINCIPALES
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Card 1: Big Tempo display & slider
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "$tempo",
                                color = Color.White,
                                fontSize = 56.sp,
                                fontWeight = FontWeight.Black,
                                lineHeight = 56.sp
                            )
                            Text(
                                text = "BPM",
                                color = Color(0xFF64748B),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Button(
                                onClick = { tempo = (tempo - 1).coerceAtLeast(30) },
                                modifier = Modifier.size(40.dp),
                                shape = CircleShape,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text("-", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            }

                            Slider(
                                value = tempo.toFloat(),
                                onValueChange = { tempo = it.toInt() },
                                valueRange = 30f..300f,
                                modifier = Modifier.weight(1f),
                                colors = SliderDefaults.colors(
                                    thumbColor = ZionTeal,
                                    activeTrackColor = ZionTeal
                                )
                            )

                            Button(
                                onClick = { tempo = (tempo + 1).coerceAtMost(300) },
                                modifier = Modifier.size(40.dp),
                                shape = CircleShape,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text("+", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // Card 2: Actions: [INICIAR/DETENER] + [TAP TEMPO]
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = { isPlaying = !isPlaying },
                        modifier = Modifier
                            .weight(1.4f)
                            .height(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPlaying) Color(0x2600D2D3) else ZionTeal
                        ),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, ZionTeal)
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Square else Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = if (isPlaying) ZionTeal else Color(0xFF020617),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isPlaying) "DETENER" else "INICIAR",
                            color = if (isPlaying) ZionTeal else Color(0xFF020617),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    Button(
                        onClick = { handleTapTempo() },
                        modifier = Modifier
                            .weight(1f)
                            .height(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x26FFFFFF))
                    ) {
                        Text(
                            text = "TAP TEMPO",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Card 3: Master Volume & Panning
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Master Vol
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.VolumeUp, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
                            Text("Master", color = Color(0xFFE2E8F0), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(50.dp))
                            Slider(
                                value = masterVol,
                                onValueChange = { masterVol = it },
                                valueRange = 0f..1f,
                                modifier = Modifier.weight(1f),
                                colors = SliderDefaults.colors(thumbColor = ZionTeal, activeTrackColor = ZionTeal)
                            )
                        }

                        // Panning
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.Tune, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
                            Text("Paneo", color = Color(0xFFE2E8F0), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(50.dp))
                            Slider(
                                value = pan,
                                onValueChange = { pan = it },
                                valueRange = -1f..1f,
                                modifier = Modifier.weight(1f),
                                colors = SliderDefaults.colors(thumbColor = ZionTeal, activeTrackColor = ZionTeal)
                            )
                            Button(
                                onClick = { pan = 0f },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                                shape = RoundedCornerShape(6.dp),
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("RESET", color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            }
                            Text(
                                text = when {
                                    pan < -0.05f -> "L${(kotlin.math.abs(pan) * 100).toInt()}%"
                                    pan > 0.05f -> "R${(pan * 100).toInt()}%"
                                    else -> "CTR"
                                },
                                color = ZionTeal,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.width(42.dp)
                            )
                        }
                    }
                }
            }

            // COLUMNA 2: MIXER INTERNO Y COMPÁS
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Compás & Subdivisión
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Compás
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("COMPÁS", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            val sigs = listOf("3/4" to 3, "4/4" to 4, "5/8" to 5, "6/8" to 6)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                sigs.take(2).forEach { (lbl, v) ->
                                    val sel = beatsPerBar == v
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(34.dp)
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(if (sel) Color(0x2600D2D3) else Color(0x0DFFFFFF))
                                            .border(1.dp, if (sel) ZionTeal else Color(0x14FFFFFF), RoundedCornerShape(6.dp))
                                            .clickable { beatsPerBar = v },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(lbl, color = if (sel) ZionTeal else Color(0xFFCBD5E1), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                sigs.drop(2).forEach { (lbl, v) ->
                                    val sel = beatsPerBar == v
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(34.dp)
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(if (sel) Color(0x2600D2D3) else Color(0x0DFFFFFF))
                                            .border(1.dp, if (sel) ZionTeal else Color(0x14FFFFFF), RoundedCornerShape(6.dp))
                                            .clickable { beatsPerBar = v },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(lbl, color = if (sel) ZionTeal else Color(0xFFCBD5E1), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    // Subdivisión
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("SUBDIVISIÓN", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            val subs = listOf("♩ Negras" to 1, "♫ Corcheas" to 2, "♬ Tresillos" to 3, "♬ Semicorcheas" to 4)
                            subs.forEach { (lbl, v) ->
                                val sel = subType == v
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(24.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(if (sel) Color(0x2600D2D3) else Color.Transparent)
                                        .clickable { subType = v }
                                        .padding(horizontal = 6.dp),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    Text(lbl, color = if (sel) ZionTeal else Color(0xFFCBD5E1), fontSize = 11.sp, fontWeight = if (sel) FontWeight.ExtraBold else FontWeight.Medium)
                                }
                            }
                        }
                    }
                }

                // Sound Selector (Clásico, Madera, Digital)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("woodblock" to "Madera", "classic" to "Clásico", "digital" to "Digital").forEach { (type, lbl) ->
                            val sel = clickSound == type
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(34.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (sel) Color(0x2600D2D3) else Color(0x0DFFFFFF))
                                    .border(1.dp, if (sel) ZionTeal else Color(0x14FFFFFF), RoundedCornerShape(8.dp))
                                    .clickable { clickSound = type },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(lbl, color = if (sel) ZionTeal else Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
