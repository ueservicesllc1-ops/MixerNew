package com.zionstagelive.nativeapp.ui.partituras

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.zionstagelive.nativeapp.models.Partitura
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.services.FirebaseService
import com.zionstagelive.nativeapp.theme.*

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PartiturasView(
    song: Song?,
    onBackToMixer: () -> Unit,
    modifier: Modifier = Modifier
) {
    val partituras by FirebaseService.activePartituras.collectAsState()
    var selectedPartitura by remember { mutableStateOf<Partitura?>(null) }
    var isFullscreen by remember { mutableStateOf(false) }

    LaunchedEffect(song?.id) {
        FirebaseService.loadPartiturasForSong(song?.id)
    }

    LaunchedEffect(partituras) {
        if (selectedPartitura == null || partituras.none { it.id == selectedPartitura?.id }) {
            selectedPartitura = partituras.firstOrNull()
        }
    }

    fun getInstrumentIcon(inst: String): String {
        val i = inst.lowercase()
        return when {
            i.contains("guit") -> "🎸"
            i.contains("piano") || i.contains("tecl") -> "🎹"
            i.contains("bajo") || i.contains("bass") -> "🎸"
            i.contains("bat") || i.contains("drum") -> "🥁"
            i.contains("voz") || i.contains("coro") || i.contains("lead") -> "🎤"
            i.contains("sax") -> "🎷"
            i.contains("tromp") -> "🎺"
            i.contains("viol") -> "🎻"
            i.contains("flaut") -> "🎶"
            else -> "🎵"
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0A0A0E))
            .padding(14.dp)
    ) {
        // Shared Tab Header: [ < MIXER ] button + Title
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
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
                    text = "🎼 Partituras",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold
                )

                if (song != null) {
                    Text(
                        text = "• ${song.title} (${song.artist.ifEmpty { "En vivo" }})",
                        color = TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            if (selectedPartitura != null) {
                Button(
                    onClick = { isFullscreen = !isFullscreen },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0x2600BCD4)),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x4D00BCD4))
                ) {
                    Icon(
                        imageVector = Icons.Default.Fullscreen,
                        contentDescription = "Pantalla completa",
                        tint = ZionTealLight,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isFullscreen) "Salir Pantalla Completa" else "Pantalla Completa",
                        color = ZionTealLight,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Tab Content Area: Left Sidebar (Instruments) + Right Area (PDF Viewer)
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Left: Instrument Selector Sidebar (hidden in full screen)
            if (!isFullscreen) {
                Card(
                    modifier = Modifier
                        .width(200.dp)
                        .fillMaxHeight(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(10.dp)
                    ) {
                        Text(
                            text = "INSTRUMENTO",
                            color = Color(0xFF64748B),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(bottom = 8.dp, start = 4.dp)
                        )

                        if (partituras.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No hay partituras para esta canción.\nSúbelas desde el Dashboard.",
                                    color = Color(0xFF64748B),
                                    fontSize = 11.5.sp,
                                    lineHeight = 16.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                items(partituras, key = { it.id }) { part ->
                                    val isSelected = selectedPartitura?.id == part.id
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(
                                                if (isSelected) Color(0x2600BCD4) else Color(0x0DFFFFFF)
                                            )
                                            .border(
                                                1.dp,
                                                if (isSelected) ZionTeal else Color(0x14FFFFFF),
                                                RoundedCornerShape(8.dp)
                                            )
                                            .clickable { selectedPartitura = part }
                                            .padding(horizontal = 10.dp, vertical = 8.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(getInstrumentIcon(part.instrument), fontSize = 16.sp)
                                            Text(
                                                text = part.instrument,
                                                color = if (isSelected) ZionTealLight else TextSecondary,
                                                fontSize = 12.sp,
                                                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Right: PDF Viewer or Placeholder
            Card(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                if (selectedPartitura != null && selectedPartitura!!.pdfUrl.isNotBlank()) {
                    val pdfUrl = selectedPartitura!!.pdfUrl
                    val viewerUrl = if (pdfUrl.startsWith("http")) {
                        "https://docs.google.com/viewer?embedded=true&url=" + android.net.Uri.encode(pdfUrl)
                    } else {
                        pdfUrl
                    }

                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.loadWithOverviewMode = true
                                settings.useWideViewPort = true
                                settings.builtInZoomControls = true
                                settings.displayZoomControls = false
                                webChromeClient = WebChromeClient()
                                webViewClient = WebViewClient()
                                loadUrl(viewerUrl)
                            }
                        },
                        update = { webView ->
                            webView.loadUrl(viewerUrl)
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("🎼", fontSize = 48.sp)
                            Text(
                                text = if (song != null) "Selecciona un instrumento para ver la partitura." else "Carga una canción primero.",
                                color = TextSecondary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}
