package com.zionstagelive.nativeapp.ui.settings

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.audio.NativeAudioEngine
import com.zionstagelive.nativeapp.models.Stem
import com.zionstagelive.nativeapp.services.FirebaseService
import com.zionstagelive.nativeapp.theme.*

enum class AudioRoutingMode {
    SPLIT,   // L: Click & Guide, R: Music tracks
    STEREO,  // Natural stereo
    MONO     // All centered
}

@Composable
fun SettingsDrawer(
    isOpen: Boolean,
    onClose: () -> Unit,
    activeStems: List<Stem>,
    onUpdateStemsPan: (List<Stem>) -> Unit,
    modifier: Modifier = Modifier
) {
    var darkMode by remember { mutableStateOf(true) }
    var routingMode by remember { mutableStateOf(AudioRoutingMode.STEREO) }
    var dynamicClickActive by remember { mutableStateOf(false) }
    val currentUser by FirebaseService.currentUser.collectAsState()

    AnimatedVisibility(
        visible = isOpen,
        enter = slideInHorizontally(initialOffsetX = { it }) + fadeIn(),
        exit = slideOutHorizontally(targetOffsetX = { it }) + fadeOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0x80000000))
                .clickable { onClose() },
            contentAlignment = Alignment.CenterEnd
        ) {
            Surface(
                modifier = Modifier
                    .width(420.dp)
                    .fillMaxHeight()
                    .clickable(enabled = false) {}, // absorb clicks
                color = BgDarker,
                shadowElevation = 16.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp)
                        .verticalScroll(rememberScrollState()),
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
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(
                                        Brush.linearGradient(
                                            listOf(Color(0xFF00BCD4), Color(0xFF0097A7))
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Settings, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            }
                            Column {
                                Text(
                                    text = "Ajustes",
                                    color = TextPrimary,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Personaliza tu experiencia",
                                    color = TextSecondary,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        IconButton(
                            onClick = onClose,
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(SurfaceDark)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextSecondary, modifier = Modifier.size(20.dp))
                        }
                    }

                    HorizontalDivider(color = BorderSubtle)

                    // 1. Modo Oscuro
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFF2D3748)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.DarkMode, contentDescription = null, tint = Color(0xFFA0AEC0), modifier = Modifier.size(18.dp))
                                }
                                Column {
                                    Text("Modo Oscuro", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Text("Tema oscuro para escenario activo", color = TextSecondary, fontSize = 10.sp)
                                }
                            }
                            Switch(
                                checked = darkMode,
                                onCheckedChange = { darkMode = it },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = ZionTeal
                                )
                            )
                        }
                    }

                    // 2. Salida de Audio y Paneo (Enrutamiento para consola / monitores)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFF1E3A8A)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Headphones, contentDescription = null, tint = Color(0xFF60A5FA), modifier = Modifier.size(18.dp))
                                }
                                Column {
                                    Text("Salida de Audio y Paneo", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Text("Enrutamiento para consola / monitores", color = TextSecondary, fontSize = 10.sp)
                                }
                            }

                            // 3 Options: Split, Stereo, Mono
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val options = listOf(
                                    Triple(AudioRoutingMode.SPLIT, "L Click / R Pistas", "Click/Guía L, Pistas R"),
                                    Triple(AudioRoutingMode.STEREO, "Estéreo", "Estéreo natural"),
                                    Triple(AudioRoutingMode.MONO, "Mono", "Todo al centro")
                                )

                                options.forEach { (mode, label, desc) ->
                                    val isSelected = routingMode == mode
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (isSelected) ZionTeal.copy(alpha = 0.2f) else BgDarker)
                                            .border(
                                                width = if (isSelected) 1.5.dp else 1.dp,
                                                color = if (isSelected) ZionTeal else BorderSubtle,
                                                shape = RoundedCornerShape(8.dp)
                                            )
                                            .clickable {
                                                routingMode = mode
                                                // Apply routing to stems
                                                val updated = activeStems.map { stem ->
                                                    val isClickOrGuide = stem.name.contains("click", ignoreCase = true) ||
                                                            stem.name.contains("guia", ignoreCase = true) ||
                                                            stem.name.contains("guide", ignoreCase = true)
                                                    val newPan = when (mode) {
                                                        AudioRoutingMode.SPLIT -> if (isClickOrGuide) -1f else 1f
                                                        AudioRoutingMode.STEREO -> stem.pan
                                                        AudioRoutingMode.MONO -> 0f
                                                    }
                                                    NativeAudioEngine.setTrackPan(stem.id, newPan)
                                                    stem.copy(pan = newPan)
                                                }
                                                onUpdateStemsPan(updated)
                                            }
                                            .padding(vertical = 10.dp, horizontal = 4.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.spacedBy(2.dp)
                                        ) {
                                            if (isSelected) {
                                                Icon(Icons.Default.Check, contentDescription = null, tint = ZionTeal, modifier = Modifier.size(12.dp))
                                            }
                                            Text(
                                                text = label,
                                                color = if (isSelected) ZionTealLight else TextSecondary,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                            )
                                            Text(
                                                text = desc,
                                                color = TextMuted,
                                                fontSize = 8.sp,
                                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 3. Metrónomo & Click Dinámico
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFF7C2D12)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.HourglassTop, contentDescription = null, tint = Color(0xFFF97316), modifier = Modifier.size(18.dp))
                                }
                                Column {
                                    Text("Click Dinámico", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Text("Metrónomo sincronizado al BPM", color = TextSecondary, fontSize = 10.sp)
                                }
                            }
                            Switch(
                                checked = dynamicClickActive,
                                onCheckedChange = { dynamicClickActive = it },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = Color(0xFFF97316)
                                )
                            )
                        }
                    }

                    // 4. Motor de Audio Nativo
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFF064E3B)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Speed, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(18.dp))
                                }
                                Column {
                                    Text("Motor Nativo C++ (Oboe)", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Text("48,000 Hz • Latencia ultrabaja (<5ms)", color = TextSecondary, fontSize = 10.sp)
                                }
                            }
                            Text(
                                text = "Renderizado de audio multi-canal a 120 FPS sin interpolación JNI.",
                                color = TextMuted,
                                fontSize = 10.sp
                            )
                        }
                    }

                    // 5. Info de Usuario
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFF312E81)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF818CF8), modifier = Modifier.size(18.dp))
                                }
                                Column {
                                    Text(
                                        text = currentUser?.email ?: "Modo En Vivo (Invitado)",
                                        color = TextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = if (currentUser != null) "Plan: ${FirebaseService.userPlanId.value.uppercase()}" else "Toca la píldora superior para iniciar sesión",
                                        color = TextSecondary,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Reset defaults button
                    OutlinedButton(
                        onClick = {
                            darkMode = true
                            routingMode = AudioRoutingMode.STEREO
                            dynamicClickActive = false
                            val restored = activeStems.map {
                                NativeAudioEngine.setTrackPan(it.id, 0f)
                                it.copy(pan = 0f)
                            }
                            onUpdateStemsPan(restored)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                    ) {
                        Text("Restaurar valores por defecto", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
