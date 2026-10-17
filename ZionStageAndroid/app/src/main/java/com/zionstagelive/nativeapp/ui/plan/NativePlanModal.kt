package com.zionstagelive.nativeapp.ui.plan

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.zionstagelive.nativeapp.services.FirebaseService

@Composable
fun NativePlanModal(
    userPlanId: String,
    userEmail: String?,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val vipIds = setOf("vip1", "vip2", "vip3", "zion_desktop_pro_online", "universal_pro")
    val isVip = vipIds.contains(userPlanId)

    val planLabels = mapOf(
        "vip1" to "VIP",
        "vip2" to "VIP",
        "vip3" to "VIP ⭐",
        "zion_desktop_pro_online" to "PRO ⭐",
        "free" to "FREE",
        "std1" to "BÁSICO",
        "std2" to "ESTÁNDAR",
        "std3" to "PLUS",
        "zion_desktop_pro_local" to "PRO PC",
        "seller" to "VENDEDOR",
        "universal_pro" to "UP ⭐"
    )
    val displayLabel = planLabels[userPlanId] ?: (if (userPlanId.isNotBlank()) userPlanId.uppercase() else "FREE")

    // Login Form State
    var emailInput by remember { mutableStateOf(userEmail ?: "123@gmail.com") }
    var passwordInput by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .wrapContentHeight()
                .clip(RoundedCornerShape(18.dp))
                .border(1.dp, Color(0xFF333333), RoundedCornerShape(18.dp)),
            color = Color(0xFF14171F),
            shadowElevation = 24.dp
        ) {
            Box(modifier = Modifier.padding(24.dp)) {
                // Boton Cerrar
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color(0x33FFFFFF))
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cerrar",
                        tint = Color(0xFF888888),
                        modifier = Modifier.size(18.dp)
                    )
                }

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (!userEmail.isNullOrBlank()) {
                        // Usuario conectado
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(if (isVip) Color(0x33F1C40F) else Color(0x2600D2D3)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isVip) Icons.Default.Star else Icons.Default.Person,
                                contentDescription = null,
                                tint = if (isVip) Color(0xFFF1C40F) else Color(0xFF00D2D3),
                                modifier = Modifier.size(30.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = userEmail,
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Pill del Plan
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(
                                    if (isVip) Brush.horizontalGradient(
                                        listOf(Color(0x40F1C40F), Color(0x30E67E22))
                                    ) else Brush.horizontalGradient(
                                        listOf(Color(0x2600D2D3), Color(0x260984E3))
                                    )
                                )
                                .border(
                                    1.5.dp,
                                    if (isVip) Color(0xFFF1C40F) else Color(0xFF00D2D3),
                                    RoundedCornerShape(20.dp)
                                )
                                .padding(horizontal = 16.dp, vertical = 7.dp)
                        ) {
                            Text(
                                text = "PLAN ACTUAL: $displayLabel",
                                color = if (isVip) Color(0xFFF1C40F) else Color(0xFF00D2D3),
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp,
                                letterSpacing = 0.5.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0x0DFFFFFF))
                                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (isVip) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                                    Text("Acceso completo al Catálogo Global VIP", color = Color(0xFFE2E8F0), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                                    Text("Descargas de stems multitrack en alta calidad", color = Color(0xFFE2E8F0), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                                    Text("Sincronización de setlists en la nube", color = Color(0xFFE2E8F0), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            } else {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(16.dp))
                                    Text("Tu cuenta está en modalidad Gratuita (Free)", color = Color(0xFFCBD5E1), fontSize = 12.sp)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.Language, contentDescription = null, tint = Color(0xFF00D2D3), modifier = Modifier.size(16.dp))
                                    Text("Puedes actualizar tu plan en zionstage.live", color = Color(0xFF94A3B8), fontSize = 11.5.sp)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FirebaseService.signOut()
                                    errorMessage = null
                                    successMessage = null
                                },
                                modifier = Modifier.weight(1f).height(44.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x40EF4444))
                            ) {
                                Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Cerrar Sesión", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = onDismiss,
                                modifier = Modifier.weight(1f).height(44.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00D2D3))
                            ) {
                                Text("Aceptar", color = Color.Black, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                            }
                        }
                    } else {
                        // Usuario no conectado: Formulario de inicio de sesión
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(Color(0x2600D2D3)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = Color(0xFF00D2D3),
                                modifier = Modifier.size(26.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "Iniciar Sesión",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )

                        Text(
                            text = "Ingresa con tu correo registrado para activar tu plan y repertorios.",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        OutlinedTextField(
                            value = emailInput,
                            onValueChange = { emailInput = it; errorMessage = null },
                            label = { Text("Correo electrónico", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Email, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(18.dp))
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00D2D3),
                                unfocusedBorderColor = Color(0xFF334155),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            shape = RoundedCornerShape(10.dp)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = passwordInput,
                            onValueChange = { passwordInput = it; errorMessage = null },
                            label = { Text("Contraseña", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(18.dp))
                            },
                            trailingIcon = {
                                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                    Icon(
                                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                        contentDescription = null,
                                        tint = Color(0xFF64748B),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            },
                            singleLine = true,
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00D2D3),
                                unfocusedBorderColor = Color(0xFF334155),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            shape = RoundedCornerShape(10.dp)
                        )

                        if (!errorMessage.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = errorMessage ?: "",
                                color = Color(0xFFF87171),
                                fontSize = 11.5.sp,
                                textAlign = TextAlign.Center
                            )
                        }

                        if (!successMessage.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = successMessage ?: "",
                                color = Color(0xFF34D399),
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                if (isLoading) return@Button
                                isLoading = true
                                errorMessage = null
                                FirebaseService.signIn(emailInput, passwordInput) { success, error ->
                                    isLoading = false
                                    if (success) {
                                        successMessage = "¡Sesión iniciada con éxito!"
                                    } else {
                                        errorMessage = error ?: "Error al autenticar."
                                    }
                                }
                            },
                            enabled = !isLoading && emailInput.isNotBlank() && passwordInput.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF00D2D3),
                                disabledContainerColor = Color(0x3300D2D3)
                            )
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = Color.Black,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    text = "Iniciar Sesión",
                                    color = Color.Black,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        TextButton(
                            onClick = onDismiss,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Continuar como invitado (Modo Free)",
                                color = Color(0xFF64748B),
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
