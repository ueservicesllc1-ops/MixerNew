package com.zionstagelive.nativeapp

import android.app.Application
import com.google.firebase.FirebaseApp
import com.zionstagelive.nativeapp.audio.NativeAudioEngine

class ZionApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        NativeAudioEngine.init()
    }

    override fun onTerminate() {
        NativeAudioEngine.release()
        super.onTerminate()
    }
}
