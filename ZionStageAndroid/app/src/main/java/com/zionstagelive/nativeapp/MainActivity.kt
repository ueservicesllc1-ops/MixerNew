package com.zionstagelive.nativeapp

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.zionstagelive.nativeapp.theme.ZionStageTheme
import com.zionstagelive.nativeapp.ui.mixer.MixerScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Keep screen on during live stage performance
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContent {
            // Ignore the system font scale (the web WebView version does too) so the
            // layout matches the packaged web app regardless of accessibility settings.
            val baseDensity = LocalDensity.current
            CompositionLocalProvider(
                LocalDensity provides Density(density = baseDensity.density, fontScale = 1f)
            ) {
                ZionStageTheme {
                    MixerScreen()
                }
            }
        }
    }
}
