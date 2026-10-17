package com.zionstagelive.nativeapp.ui.mixer

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.zionstagelive.nativeapp.theme.LedGreen
import com.zionstagelive.nativeapp.theme.LedRed
import com.zionstagelive.nativeapp.theme.LedYellow

private const val LED_COUNT = 24

@Composable
fun VUMeterView(
    level: Float,
    isMuted: Boolean = false,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .width(8.dp)
            .fillMaxHeight()
    ) {
        val totalH = size.height
        val w = size.width
        val ledH = (totalH / LED_COUNT) - 1.5f
        val activeLeds = if (isMuted) 0 else (level.coerceIn(0f, 1f) * LED_COUNT).toInt()

        for (i in 0 until LED_COUNT) {
            val isLit = i < activeLeds
            val color = when {
                !isLit -> Color(0x1AFFFFFF)
                i >= LED_COUNT - 3 -> LedRed
                i >= LED_COUNT - 8 -> LedYellow
                else -> LedGreen
            }

            val y = totalH - ((i + 1) * (totalH / LED_COUNT))
            drawRect(
                color = color,
                topLeft = Offset(0f, y),
                size = Size(w, ledH.coerceAtLeast(1f))
            )
        }
    }
}
