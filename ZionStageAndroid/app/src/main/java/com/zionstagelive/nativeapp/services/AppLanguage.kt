package com.zionstagelive.nativeapp.services

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object AppLanguage {
    private const val PREFS_NAME = "zion_stage_prefs"
    private const val KEY_LANG = "app_language"

    private var prefs: SharedPreferences? = null

    private val _isEnglish = MutableStateFlow(false)
    val isEnglish: StateFlow<Boolean> = _isEnglish.asStateFlow()

    fun init(context: Context) {
        val p = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs = p
        val saved = p.getString(KEY_LANG, "es") ?: "es"
        _isEnglish.value = (saved == "en")
    }

    fun setEnglish(en: Boolean) {
        _isEnglish.value = en
        prefs?.edit()?.putString(KEY_LANG, if (en) "en" else "es")?.apply()
    }

    fun tr(es: String, en: String): String = if (_isEnglish.value) en else es
}

@Composable
fun rememberIsEnglish(): Boolean {
    val isEn by AppLanguage.isEnglish.collectAsState()
    return isEn
}

fun tr(isEn: Boolean, es: String, en: String): String = if (isEn) en else es
