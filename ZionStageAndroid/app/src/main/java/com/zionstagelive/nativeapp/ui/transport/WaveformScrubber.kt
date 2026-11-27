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

@Composable
fun WaveformScrubber(
    songId: String?,
    waveformPeaks: FloatArray,
    playbackPosition: Double,
    duration: Double,
    onSeek: (Double) -> Unit,
    modifier: Modifier = Modifier
) {
    val hasRealPeaks = waveformPeaks.isNotEmpty()
    val displayPeaks = remember(songId, waveformPeaks) {
        if (hasRealPeaks) waveformPeaks else FloatArray(160) { 0.06f }
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

            val count = displayPeaks.size
            val barGap = 1.5f
            val barWidth = ((totalWidth - (count - 1) * barGap) / count).coerceAtLeast(1.5f)
            val playheadX = (fraction * totalWidth).coerceIn(0f, totalWidth)

            // Draw each waveform bar
            for (i in 0 until count) {
                val x = i * (barWidth + barGap)
                if (x > totalWidth) break

                val amp = displayPeaks[i].coerceIn(0.03f, 1f)
                val barHeight = (amp * (totalHeight - 4f)).coerceAtLeast(2.5f)
                val y = (totalHeight - barHeight) / 2f

                val isPlayed = (x + barWidth / 2f) <= playheadX

                val barColor = if (!hasRealPeaks) {
                    Color(0xFF1E293B)
                } else if (isPlayed) {
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
