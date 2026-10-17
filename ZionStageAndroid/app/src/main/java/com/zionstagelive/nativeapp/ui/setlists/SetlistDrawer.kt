package com.zionstagelive.nativeapp.ui.setlists

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zionstagelive.nativeapp.models.Setlist
import com.zionstagelive.nativeapp.models.Song
import com.zionstagelive.nativeapp.services.FirebaseService
import com.zionstagelive.nativeapp.theme.*

@Composable
fun SetlistDrawer(
    isOpen: Boolean,
    setlists: List<Setlist>,
    currentSong: Song?,
    initialOpenCreate: Boolean = false,
    onOpenLibrary: (() -> Unit)? = null,
    onSelectSong: (Song) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedSetlist by remember { mutableStateOf<Setlist?>(null) }
    var isCreatingSetlist by remember { mutableStateOf(false) }
    var newSetlistName by remember { mutableStateOf("") }
    val activeSetlist by FirebaseService.activeSetlist.collectAsState()

    LaunchedEffect(isOpen, initialOpenCreate) {
        if (isOpen && initialOpenCreate) {
            isCreatingSetlist = true
            selectedSetlist = null
        }
    }

    // If setlists change or selectedSetlist is deleted, keep in sync
    LaunchedEffect(setlists) {
        if (selectedSetlist != null) {
            selectedSetlist = setlists.find { it.id == selectedSetlist!!.id }
        }
    }

    AnimatedVisibility(
        visible = isOpen,
        enter = slideInHorizontally(initialOffsetX = { -it }) + fadeIn(),
        exit = slideOutHorizontally(targetOffsetX = { -it }) + fadeOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0x80000000))
                .clickable { onClose() },
            contentAlignment = Alignment.CenterStart
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
                ) {
                    // Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (selectedSetlist != null) {
                                IconButton(
                                    onClick = { selectedSetlist = null },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.ArrowBack, contentDescription = "Atrás", tint = TextPrimary)
                                }
                            }
                            Text(
                                text = selectedSetlist?.name ?: "Mis Setlists",
                                color = TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
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

                    Spacer(modifier = Modifier.height(14.dp))

                    if (selectedSetlist == null) {
                        // 1. List of Setlists

                        // + Crear Nuevo Setlist Button / Form
                        if (isCreatingSetlist) {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, ZionTeal.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(
                                        text = "Crear Nuevo Setlist",
                                        color = TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    OutlinedTextField(
                                        value = newSetlistName,
                                        onValueChange = { newSetlistName = it },
                                        placeholder = { Text("Nombre (Ej: Domingo AM, Ensayo)", color = TextMuted, fontSize = 13.sp) },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = ZionTeal,
                                            unfocusedBorderColor = BorderSubtle,
                                            focusedTextColor = TextPrimary,
                                            unfocusedTextColor = TextPrimary
                                        ),
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Button(
                                            onClick = {
                                                val name = newSetlistName.trim()
                                                if (name.isNotEmpty()) {
                                                    FirebaseService.createSetlist(name) { newSet ->
                                                        selectedSetlist = newSet
                                                    }
                                                    newSetlistName = ""
                                                    isCreatingSetlist = false
                                                }
                                            },
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text("✔ Guardar", fontWeight = FontWeight.Bold)
                                        }
                                        OutlinedButton(
                                            onClick = {
                                                isCreatingSetlist = false
                                                newSetlistName = ""
                                            },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(8.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                                        ) {
                                            Text("Cancelar")
                                        }
                                    }
                                }
                            }
                        } else {
                            Button(
                                onClick = { isCreatingSetlist = true },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("+ Crear Nuevo Setlist", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        if (setlists.isEmpty() && !isCreatingSetlist) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No tienes setlists creados aún.\nUsa el botón de arriba para crear uno.",
                                    color = TextSecondary,
                                    fontSize = 13.sp,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(setlists.size) { index ->
                                    val setlist = setlists[index]
                                    val isActive = activeSetlist?.id == setlist.id

                                    Card(
                                        colors = CardDefaults.cardColors(
                                            containerColor = if (isActive) ZionTeal.copy(alpha = 0.12f) else SurfaceDark
                                        ),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { selectedSetlist = setlist }
                                            .border(
                                                width = if (isActive) 1.5.dp else 1.dp,
                                                color = if (isActive) ZionTeal else BorderSubtle,
                                                shape = RoundedCornerShape(12.dp)
                                            )
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(14.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                modifier = Modifier.weight(1f),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(40.dp)
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(if (isActive) ZionTeal.copy(alpha = 0.25f) else Color(0x22FFFFFF)),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(
                                                        Icons.Default.QueueMusic,
                                                        contentDescription = null,
                                                        tint = if (isActive) ZionTealLight else TextSecondary
                                                    )
                                                }
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                    ) {
                                                        Text(
                                                            text = setlist.name,
                                                            color = if (isActive) ZionTealLight else TextPrimary,
                                                            fontSize = 14.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            maxLines = 1,
                                                            overflow = TextOverflow.Ellipsis
                                                        )
                                                        if (isActive) {
                                                            Surface(
                                                                color = ZionTeal,
                                                                shape = RoundedCornerShape(4.dp)
                                                            ) {
                                                                Text(
                                                                    text = "ACTIVO",
                                                                    color = Color.Black,
                                                                    fontSize = 9.sp,
                                                                    fontWeight = FontWeight.Black,
                                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                                                )
                                                            }
                                                        }
                                                    }
                                                    Text(
                                                        text = "${setlist.songs.size} canciones",
                                                        color = TextSecondary,
                                                        fontSize = 11.sp
                                                    )
                                                }
                                            }

                                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary)
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // 2. Songs in Selected Setlist
                        val currentList = selectedSetlist!!.songs
                        val isThisActive = activeSetlist?.id == selectedSetlist!!.id

                        // Action Bar for this Setlist
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Button(
                                onClick = {
                                    FirebaseService.setActiveSetlist(selectedSetlist)
                                    onClose()
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isThisActive) Color(0xFF1E293B) else ZionTeal
                                ),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = if (isThisActive) "✓ Setlist Activo en Mixer" else "Usar este Setlist",
                                    color = if (isThisActive) ZionTealLight else Color.Black,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            if (selectedSetlist!!.id != "default_setlist") {
                                IconButton(
                                    onClick = {
                                        FirebaseService.deleteSetlist(selectedSetlist!!.id)
                                        selectedSetlist = null
                                    },
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0x33EF4444))
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                                }
                            }
                        }

                        // Button to add downloaded / library songs to this setlist
                        Button(
                            onClick = {
                                if (!isThisActive) {
                                    FirebaseService.setActiveSetlist(selectedSetlist)
                                }
                                onOpenLibrary?.invoke()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp)
                                .height(40.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("+ Agregar Canciones al Setlist", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        if (currentList.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "Este setlist está vacío.",
                                        color = TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Usa el botón '+ Agregar Canciones al Setlist' para elegir canciones descargadas en tu dispositivo sin necesidad de internet.",
                                        color = TextSecondary,
                                        fontSize = 12.sp,
                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                    )
                                }
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                itemsIndexed(currentList) { idx, song ->
                                    val isCurrent = song.id == currentSong?.id
                                    Card(
                                        colors = CardDefaults.cardColors(
                                            containerColor = if (isCurrent) ZionTeal.copy(alpha = 0.12f) else SurfaceDark
                                        ),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                FirebaseService.setActiveSetlist(selectedSetlist)
                                                onSelectSong(song)
                                                onClose()
                                            }
                                            .border(
                                                width = if (isCurrent) 1.5.dp else 1.dp,
                                                color = if (isCurrent) ZionTeal else BorderSubtle,
                                                shape = RoundedCornerShape(10.dp)
                                            )
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            // Index number
                                            Text(
                                                text = "${idx + 1}.",
                                                color = if (isCurrent) ZionTealLight else TextSecondary,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Black,
                                                modifier = Modifier.width(24.dp)
                                            )

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = song.title,
                                                    color = if (isCurrent) ZionTealLight else TextPrimary,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                Text(
                                                    text = song.artist.ifEmpty { "Artista desconocido" },
                                                    color = TextSecondary,
                                                    fontSize = 11.sp,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }

                                            // Badges (Key & BPM)
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                song.key?.let {
                                                    Surface(
                                                        color = Color(0x2200D2D3),
                                                        shape = RoundedCornerShape(4.dp)
                                                    ) {
                                                        Text(
                                                            text = it,
                                                            color = ZionTealLight,
                                                            fontSize = 10.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                        )
                                                    }
                                                }
                                                song.tempo?.let {
                                                    Surface(
                                                        color = Color(0x22FBBF24),
                                                        shape = RoundedCornerShape(4.dp)
                                                    ) {
                                                        Text(
                                                            text = "${it.toInt()} BPM",
                                                            color = Color(0xFFFBBF24),
                                                            fontSize = 10.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
