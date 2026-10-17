package com.zionstagelive.nativeapp.ui.bandsync

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.zionstagelive.nativeapp.services.BandSyncService
import com.zionstagelive.nativeapp.services.QRCodeGenerator
import com.zionstagelive.nativeapp.theme.SurfaceDark
import com.zionstagelive.nativeapp.theme.TextPrimary
import com.zionstagelive.nativeapp.theme.TextSecondary
import com.zionstagelive.nativeapp.theme.ZionTealLight

@Composable
fun BandSyncDialog(
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val clientsCount by BandSyncService.connectedClients.collectAsState()

    val syncUrl = remember {
        BandSyncService.startServer(context)
        BandSyncService.getSyncUrl(context)
    }

    val qrBitmap = remember(syncUrl) {
        QRCodeGenerator.generateQRCode(syncUrl, 320)
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .width(460.dp)
                .wrapContentHeight(),
            colors = CardDefaults.cardColors(containerColor = SurfaceDark),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header: Title + Close Button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Band Sync QR",
                        color = TextPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0xFF475569), CircleShape)
                            .clickable { onDismiss() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Cerrar",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Body: QR Image + Instructions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // QR Code Container
                    Box(
                        modifier = Modifier
                            .size(180.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (qrBitmap != null) {
                            Image(
                                bitmap = qrBitmap,
                                contentDescription = "QR Code",
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            CircularProgressIndicator(color = Color(0xFF0F172A))
                        }
                    }

                    // Text Details
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Escanea para entrar",
                            color = TextPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "Clientes conectados: $clientsCount",
                            color = Color(0xFF10B981),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )

                        Text(
                            text = "Misma red Wi‑Fi que este dispositivo. Si no escanea, abre la URL en el móvil.",
                            color = TextSecondary,
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xFF0B132B))
                                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(6.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = syncUrl,
                                color = ZionTealLight,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
