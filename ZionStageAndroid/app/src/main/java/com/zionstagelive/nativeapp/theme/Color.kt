package com.zionstagelive.nativeapp.theme

import androidx.compose.ui.graphics.Color

val BgDark = Color(0xFF0F172A)
val BgDarker = Color(0xFF0B0F19)
val SurfaceDark = Color(0xFF1E293B)
val SurfaceCard = Color(0xFF243044)
val BorderSubtle = Color(0x1AFFFFFF)

val ZionTeal = Color(0xFF00BCD4)
val ZionTealLight = Color(0xFF00E5FF)
val ZionPurple = Color(0xFF9B59B6)
val ZionPurpleLight = Color(0xFFBA68C8)

val LedGreen = Color(0xFF00E676)
val LedYellow = Color(0xFFFFB142)
val LedRed = Color(0xFFFF1F1F)

val TextPrimary = Color(0xFFF8FAFC)
val TextSecondary = Color(0xFF94A3B8)
val TextMuted = Color(0xFF64748B)

val PrimeCoral = Color(0xFFF17853)
val PrimeCoralDark = Color(0xFFD63031)

val BtnActiveBlue = Color(0xFF2563EB)
val BtnActiveRed = Color(0xFFDC2626)
val BtnMuteRed = Color(0xFFFF5252)
val BtnSoloYellow = Color(0xFFEAB308)

// Stem Role Colors (matching web app)
val ColorClick = Color(0xFFDC2626) // Locked strip red
val ColorGuide = Color(0xFFDC2626) // Locked strip red
val ColorDrums = Color(0xFF00BCD4) // Cyan
val ColorBass = Color(0xFF706FD3)  // Purple
val ColorKeys = Color(0xFF00BCD4)  // Cyan
val ColorGuitar = Color(0xFFFFB142)// Warm orange
val ColorVocal = Color(0xFF34ACE0) // Sky blue
val ColorDefault = Color(0xFF00D2D3)

fun getRoleColor(role: String): Color {
    return when (role.lowercase()) {
        "click" -> ColorClick
        "guide" -> ColorGuide
        "drums", "percus" -> ColorDrums
        "bass", "bajo" -> ColorBass
        "keys", "piano", "teclado" -> ColorKeys
        "guitar", "guit", "eg" -> ColorGuitar
        "vocal", "voz", "bgvs", "coro" -> ColorVocal
        else -> ColorDefault
    }
}
