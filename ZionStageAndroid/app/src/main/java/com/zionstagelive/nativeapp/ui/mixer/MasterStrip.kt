package com.zionstagelive.nativeapp.ui.mixer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.theme.*

@Composable
fun MasterStrip(
    volume: Float,
    levelLeft: Float,
    levelRight: Float,
    onVolumeChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .height(265.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceDark)
            .border(1.dp, ZionTeal.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // TOP: Cyan pill + MASTER label
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(width = 16.dp, height = 8.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(ZionTeal)
                    .border(0.5.dp, Color(0x66FFFFFF), RoundedCornerShape(2.dp))
            )
            Text(
                text = "MASTER",
                color = ZionTealLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
        }

        // MIDDLE: dB scale + Stereo VU Meters + Fader
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Decibel scale
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

            // Stereo Meters (L and R)
            Box(
                modifier = Modifier
                    .width(16.dp)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF020617))
                    .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(4.dp))
                    .padding(1.dp)
            ) {
                Row(modifier = Modifier.fillMaxSize()) {
                    VUMeterView(level = levelLeft, modifier = Modifier.weight(1f).fillMaxHeight())
                    Spacer(modifier = Modifier.width(1.dp))
                    VUMeterView(level = levelRight, modifier = Modifier.weight(1f).fillMaxHeight())
                }
            }

            Spacer(modifier = Modifier.width(4.dp))

            // Master Fader
            FaderSlider(
                value = volume,
                onValueChange = onVolumeChange,
                accentColor = ZionTeal,
                modifier = Modifier.width(44.dp)
            )
        }

        // BOTTOM: Percentage badge
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(28.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(Color(0x1A00BCD4))
                .border(1.dp, ZionTeal.copy(alpha = 0.3f), RoundedCornerShape(5.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "${(volume * 100).toInt()}%",
                color = ZionTealLight,
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}
