package com.zionstagelive.nativeapp.ui.transport

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlin.math.sin

@Composable
fun WaveformScrubber(
    songId: String?,
    playbackPosition: Double,
    duration: Double,
    onSeek: (Double) -> Unit,
    modifier: Modifier = Modifier
) {
    // Generate organic, realistic multitrack waveform peaks (160 slices)
    val peaks = remember(songId) {
        generateWaveformPeaks(songId, 160)
    }

    val fraction = if (duration > 0) {
        (playbackPosition / duration).toFloat().coerceIn(0f, 1f)
    } else {
        0f
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFF0B132B))
            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(6.dp))
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 6.dp, vertical = 2.dp)
                .pointerInput(duration, onSeek) {
                    detectTapGestures { offset ->
                        if (duration > 0 && size.width > 0) {
                            val targetFrac = (offset.x / size.width).coerceIn(0f, 1f)
                            onSeek(targetFrac.toDouble() * duration)
                        }
                    }
                }
                .pointerInput(duration, onSeek) {
                    detectDragGestures { change, _ ->
                        change.consume()
                        if (duration > 0 && size.width > 0) {
                            val targetFrac = (change.position.x / size.width).coerceIn(0f, 1f)
                            onSeek(targetFrac.toDouble() * duration)
                        }
                    }
                }
        ) {
            val totalWidth = size.width
            val totalHeight = size.height
            if (totalWidth <= 0 || totalHeight <= 0) return@Canvas

            val count = peaks.size
            val barGap = 1.5f
            val barWidth = ((totalWidth - (count - 1) * barGap) / count).coerceAtLeast(1.5f)
            val playheadX = (fraction * totalWidth).coerceIn(0f, totalWidth)

            // Draw each waveform bar
            for (i in 0 until count) {
                val x = i * (barWidth + barGap)
                if (x > totalWidth) break

                val amp = peaks[i]
                val barHeight = (amp * (totalHeight - 4f)).coerceAtLeast(3f)
                val y = (totalHeight - barHeight) / 2f

                val isPlayed = (x + barWidth / 2f) <= playheadX

                val barColor = if (isPlayed) {
                    // Played: Vibrant Cyan / Neon Teal
                    Color(0xFF00E5FF)
                } else {
                    // Unplayed: Dark Slate Gray
                    Color(0xFF334155)
                }

                drawRoundRect(
                    color = barColor,
                    topLeft = Offset(x, y),
                    size = Size(barWidth, barHeight),
                    cornerRadius = CornerRadius(barWidth / 2f, barWidth / 2f)
                )
            }

            // Draw Playhead needle
            val needleX = playheadX.coerceIn(0f, totalWidth)
            // Yellow shadow / glow
            drawLine(
                color = Color(0x80FACC15),
                start = Offset(needleX, 0f),
                end = Offset(needleX, totalHeight),
                strokeWidth = 4f
            )
            // Crisp White / Amber center line
            drawLine(
                color = Color(0xFFFEF08A),
                start = Offset(needleX, 0f),
                end = Offset(needleX, totalHeight),
                strokeWidth = 2f
            )
        }
    }
}

/**
 * Generates an organic, DAW-grade multitrack waveform peak envelope.
 * Seeds from the song ID to give each song a unique, consistent silhouette.
 */
private fun generateWaveformPeaks(seedKey: String?, count: Int): FloatArray {
    val s = seedKey ?: "zion_default_track"
    var seed = 2166136261L
    for (ch in s) {
        seed = (seed xor ch.code.toLong()) * 16777619L
    }

    val peaks = FloatArray(count)
    for (i in 0 until count) {
        val pos = i.toFloat() / count.toFloat()
        // Pseudo-random deterministic noise
        val pseudoRand = ((sin((i * 12.9898 + seed % 1000).toDouble()) * 43758.5453).let { it - it.toInt() }).toFloat().let { if (it < 0) -it else it }
        val pseudoRand2 = ((sin((i * 78.233 + seed % 777).toDouble()) * 43758.5453).let { it - it.toInt() }).toFloat().let { if (it < 0) -it else it }

        // Multitrack energy envelope: Intro (0-12%) builds up, Verse (12-35%), Chorus 1 (35-52% high),
        // Verse 2 (52-65%), Chorus 2 / Solo (65-85% peak), Outro (85-100% taper)
        val sectionEnv = when {
            pos < 0.12f -> 0.25f + pos * 2.5f
            pos < 0.35f -> 0.50f + 0.25f * sin(pos * 18.0).toFloat()
            pos < 0.52f -> 0.75f + 0.20f * sin(pos * 24.0).toFloat()
            pos < 0.65f -> 0.55f + 0.20f * sin(pos * 16.0).toFloat()
            pos < 0.85f -> 0.85f + 0.15f * sin(pos * 28.0).toFloat()
            else -> (0.85f - (pos - 0.85f) * 4.5f).coerceAtLeast(0.15f)
        }

        val organicVariation = 0.75f + 0.25f * pseudoRand
        val dynamicPeak = (sectionEnv * organicVariation + 0.05f * pseudoRand2).coerceIn(0.12f, 0.98f)
        peaks[i] = dynamicPeak
    }
    return peaks
}
