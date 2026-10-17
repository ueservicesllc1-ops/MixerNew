package com.zionstagelive.nativeapp.ui.mixer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.zionstagelive.nativeapp.theme.ZionTeal
import kotlin.math.roundToInt

@Composable
fun FaderSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    accentColor: Color = ZionTeal,
    isMuted: Boolean = false
) {
    val density = LocalDensity.current
    var totalHeightPx by remember { mutableFloatStateOf(0f) }
    val thumbHeightDp = 28.dp
    val thumbHeightPx = with(density) { thumbHeightDp.toPx() }
    val currentOnValueChange by rememberUpdatedState(onValueChange)

    // Local state for instant 120fps feedback during tap/drag
    var internalValue by remember(value) { mutableFloatStateOf(value.coerceIn(0f, 1f)) }
    LaunchedEffect(value) {
        internalValue = value.coerceIn(0f, 1f)
    }

    Box(
        modifier = modifier
            .width(46.dp)
            .fillMaxHeight()
            .onSizeChanged { totalHeightPx = it.height.toFloat() }
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val maxTravel = (totalHeightPx - thumbHeightPx).coerceAtLeast(1f)
                    fun updateAt(y: Float) {
                        val rawY = (y - thumbHeightPx / 2f).coerceIn(0f, maxTravel)
                        val fraction = (1f - (rawY / maxTravel)).coerceIn(0f, 1f)
                        internalValue = fraction
                        currentOnValueChange(fraction)
                    }
                    updateAt(down.position.y)
                    down.consume()

                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        updateAt(change.position.y)
                        change.consume()
                    }
                }
            },
        contentAlignment = Alignment.TopCenter
    ) {
        // Track Groove (Background Slot)
        Box(
            modifier = Modifier
                .width(6.dp)
                .fillMaxHeight()
                .padding(vertical = (thumbHeightDp / 2))
                .clip(RoundedCornerShape(3.dp))
                .background(Color(0xFF020617))
        ) {
            // Filled Level
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(if (isMuted) 0f else internalValue.coerceIn(0f, 1f))
                    .align(Alignment.BottomCenter)
                    .background(if (isMuted) Color(0xFF475569) else accentColor)
            )
        }

        // Fader Thumb / Cap (Hardware slider cap)
        val maxTravel = (totalHeightPx - thumbHeightPx).coerceAtLeast(0f)
        val topOffsetPx = ((1f - internalValue.coerceIn(0f, 1f)) * maxTravel).roundToInt()

        Box(
            modifier = Modifier
                .offset { IntOffset(0, topOffsetPx) }
                .width(40.dp)
                .height(thumbHeightDp)
                .clip(RoundedCornerShape(6.dp))
                .background(if (isMuted) Color(0xFF334155) else Color(0xFF1E293B))
                .border(
                    width = 1.dp,
                    color = if (isMuted) Color(0xFF475569) else Color(0xFF64748B),
                    shape = RoundedCornerShape(6.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            // Center grip lines with track accent color
            Column(
                verticalArrangement = Arrangement.spacedBy(2.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .width(24.dp)
                        .height(2.5.dp)
                        .background(if (isMuted) Color(0xFF94A3B8) else accentColor)
                )
                Box(
                    modifier = Modifier
                        .width(24.dp)
                        .height(1.dp)
                        .background(Color(0x33FFFFFF))
                )
            }
        }
    }
}
