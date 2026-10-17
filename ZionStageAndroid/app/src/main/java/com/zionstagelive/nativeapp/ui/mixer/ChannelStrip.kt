package com.zionstagelive.nativeapp.ui.mixer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.zionstagelive.nativeapp.models.Stem
import com.zionstagelive.nativeapp.theme.*

private val TRACK_PALETTE_COLORS = listOf(
    Color(0xFFEF4444), // Red
    Color(0xFFF97316), // Orange
    Color(0xFFF59E0B), // Amber
    Color(0xFF10B981), // Emerald
    Color(0xFF06B6D4), // Cyan
    Color(0xFF3B82F6), // Blue
    Color(0xFF8B5CF6), // Purple
    Color(0xFFEC4899), // Pink
    Color(0xFF84CC16), // Lime
    Color(0xFF14B8A6)  // Teal
)

@Composable
fun ChannelStrip(
    stem: Stem,
    level: Float,
    onVolumeChange: (Float) -> Unit,
    onMuteToggle: () -> Unit,
    onSoloToggle: () -> Unit,
    onRouteToggle: (routeL: Boolean, routeR: Boolean) -> Unit,
    onColorChange: (Color) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val isClickGuideStem = stem.role == "click" || stem.role == "guide"
    var showColorPicker by remember { mutableStateOf(false) }

    // Color: custom color takes precedence over default role color
    val activeTrackColor = stem.customColor?.let { Color(it.toULong()) } ?: getRoleColor(stem.role)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .height(265.dp) // Taller tracks as requested by user
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceDark)
            .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            .padding(horizontal = 6.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // TOP: Color pill (clickable to change color) + Track Name
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(width = 16.dp, height = 9.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(activeTrackColor)
                    .border(0.5.dp, Color(0x66FFFFFF), RoundedCornerShape(2.dp))
                    .clickable(enabled = !isClickGuideStem) {
                        showColorPicker = true
                    }
            )
            Text(
                text = stem.displayName.uppercase(),
                color = TextPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
        }

        // MIDDLE: dB scale + VU Meter + Fader Slider
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Decibel scale (+6, 0, -5, -10, -20, -40, -inf)
            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .padding(vertical = 12.dp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.End
            ) {
                Text(text = "+6", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "0", color = ZionTealLight, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold)
                Text(text = "-5", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-10", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-20", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-40", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text(text = "-∞", color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.width(4.dp))

            // Multi-segment LED VU Meter
            Box(
                modifier = Modifier
                    .width(10.dp)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF020617))
                    .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(4.dp))
                    .padding(1.dp)
            ) {
                VUMeterView(
                    level = level,
                    isMuted = stem.isMuted,
                    modifier = Modifier.fillMaxSize()
                )
            }

            Spacer(modifier = Modifier.width(5.dp))

            // Fader Slider (Smooth touch & drag)
            FaderSlider(
                value = stem.volume,
                onValueChange = onVolumeChange,
                accentColor = activeTrackColor,
                isMuted = stem.isMuted,
                modifier = Modifier.width(46.dp)
            )
        }

        // BOTTOM: [ L ] [ M ] [ S ] [ R ]
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // L Button (In-Ear Monitor routing) - Blue when active
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(if (stem.routeL) BtnActiveBlue else Color(0xFF131D2E))
                    .border(
                        width = 1.dp,
                        color = if (stem.routeL) BtnActiveBlue else Color(0x33FFFFFF),
                        shape = RoundedCornerShape(5.dp)
                    )
                    .clickable { onRouteToggle(!stem.routeL, stem.routeR) },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "L",
                    color = if (stem.routeL) Color.White else Color(0xFF64748B),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
            }

            // M Button (Mute) - Red when active
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(if (stem.isMuted) BtnMuteRed else Color(0xFF131D2E))
                    .border(
                        width = 1.dp,
                        color = if (stem.isMuted) BtnMuteRed else Color(0x33FFFFFF),
                        shape = RoundedCornerShape(5.dp)
                    )
                    .clickable { onMuteToggle() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "M",
                    color = if (stem.isMuted) Color.White else Color(0xFF64748B),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
            }

            // S Button (Solo) - Yellow when active
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(if (stem.isSolo) BtnSoloYellow else Color(0xFF131D2E))
                    .border(
                        width = 1.dp,
                        color = if (stem.isSolo) BtnSoloYellow else Color(0x33FFFFFF),
                        shape = RoundedCornerShape(5.dp)
                    )
                    .clickable { onSoloToggle() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "S",
                    color = if (stem.isSolo) Color.Black else Color(0xFF64748B),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
            }

            // R Button (PA FOH routing) - Red when active
            Box(
                modifier = Modifier
                    .size(width = 24.dp, height = 26.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(if (stem.routeR) BtnActiveRed else Color(0xFF131D2E))
                    .border(
                        width = 1.dp,
                        color = if (stem.routeR) BtnActiveRed else Color(0x33FFFFFF),
                        shape = RoundedCornerShape(5.dp)
                    )
                    .clickable { onRouteToggle(stem.routeL, !stem.routeR) },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "R",
                    color = if (stem.routeR) Color.White else Color(0xFF64748B),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }

    // COLOR PICKER DIALOG FOR THIS TRACK
    if (showColorPicker) {
        Dialog(onDismissRequest = { showColorPicker = false }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                modifier = Modifier.padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "Color del Track: ${stem.displayName}",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    // 5x2 Palette Grid
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            TRACK_PALETTE_COLORS.take(5).forEach { c ->
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(c)
                                        .border(
                                            width = if (activeTrackColor == c) 2.5.dp else 1.dp,
                                            color = if (activeTrackColor == c) Color.White else Color(0x44FFFFFF),
                                            shape = CircleShape
                                        )
                                        .clickable {
                                            stem.customColor = c.value.toLong()
                                            onColorChange(c)
                                            showColorPicker = false
                                        }
                                )
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            TRACK_PALETTE_COLORS.drop(5).take(5).forEach { c ->
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(c)
                                        .border(
                                            width = if (activeTrackColor == c) 2.5.dp else 1.dp,
                                            color = if (activeTrackColor == c) Color.White else Color(0x44FFFFFF),
                                            shape = CircleShape
                                        )
                                        .clickable {
                                            stem.customColor = c.value.toLong()
                                            onColorChange(c)
                                            showColorPicker = false
                                        }
                                )
                            }
                        }
                    }

                    TextButton(onClick = { showColorPicker = false }) {
                        Text(text = "Cerrar", color = ZionTealLight, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
