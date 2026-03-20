// MixerNativeEngine.cpp
#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"

#include <jni.h>
#include <android/log.h>
#include <string>
#include <list>
#include <mutex>

#define TAG     "MixerNative"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

struct Track {
    std::string id;
    ma_sound    sound;
    bool        soundReady = false;
    float       volume     = 1.0f;
    bool        muted      = false;
    bool        solo       = false;

    void release() {
        if (soundReady) {
            ma_sound_uninit(&sound);
            soundReady = false;
        }
    }
};

class MultitrackEngine {
public:
    ma_engine          engine;
    bool               engineReady = false;
    std::list<Track>   tracks;
    std::mutex         mtx;

    double  playbackTimeStart = 0.0;
    ma_uint64 engineTimeStart = 0;
    bool    playing           = false;
    float   masterVolume      = 1.0f;
    float   speedRatio        = 1.0f; // Tempo: 1.0 = normal speed

    static constexpr int kSampleRate = 44100;

    void init() {
        if (engineReady) return;
        ma_engine_config cfg = ma_engine_config_init();
        cfg.sampleRate = kSampleRate;
        if (ma_engine_init(&cfg, &engine) == MA_SUCCESS) {
            ma_engine_stop(&engine);
            engineReady = true;
            LOGD("ma_engine_init OK");
        }
    }

    void loadTrack(const std::string& id, const std::string& path) {
        if (!engineReady) return;
        std::lock_guard<std::mutex> lk(mtx);

        Track* tPtr = nullptr;
        for (auto& tr : tracks) { if (tr.id == id) { tPtr = &tr; break; } }

        if (!tPtr) {
            tracks.emplace_back();
            tPtr = &tracks.back();
            tPtr->id = id;
        } else {
            tPtr->release();
        }

        ma_result r = ma_sound_init_from_file(&engine, path.c_str(), MA_SOUND_FLAG_DECODE | MA_SOUND_FLAG_NO_SPATIALIZATION, nullptr, nullptr, &tPtr->sound);
        if (r == MA_SUCCESS) {
            tPtr->soundReady = true;
            double currentPos = getPositionInternal();
            ma_uint64 frame = (ma_uint64)(currentPos * kSampleRate);
            ma_sound_seek_to_pcm_frame(&tPtr->sound, frame);
            ma_sound_set_volume(&tPtr->sound, tPtr->volume * masterVolume);
            
            updateMuteSoloInternal();
            LOGD("Track %s cargado y sincronizado a %.2fs", id.c_str(), currentPos);
        } else {
            LOGE("Error cargando track %s: %d", id.c_str(), r);
        }
    }

    void play() {
        if (!engineReady || playing) return;
        std::lock_guard<std::mutex> lk(mtx);
        
        ma_engine_start(&engine);
        ma_uint64 syncFrame = ma_engine_get_time_in_pcm_frames(&engine);
        engineTimeStart = syncFrame;
        
        playing = true;
        updateMuteSoloInternal();
        LOGD("Play() a las %.2fs", playbackTimeStart);
    }

    void pause() {
        if (!playing) return;
        std::lock_guard<std::mutex> lk(mtx);
        playbackTimeStart = getPositionInternal();
        for (auto& t : tracks) if (t.soundReady) ma_sound_stop(&t.sound);
        ma_engine_stop(&engine);
        playing = false;
        LOGD("Pause() a las %.2fs", playbackTimeStart);
    }

    void seekAll(double seconds) {
        std::lock_guard<std::mutex> lk(mtx);
        playbackTimeStart = seconds;
        engineTimeStart = ma_engine_get_time_in_pcm_frames(&engine);
        ma_uint64 frame = (ma_uint64)(seconds * kSampleRate);
        for (auto& t : tracks) if (t.soundReady) ma_sound_seek_to_pcm_frame(&t.sound, frame);
    }

    double getPositionInternal() {
        if (!playing) return playbackTimeStart;
        ma_uint64 currentEngineFrame = ma_engine_get_time_in_pcm_frames(&engine);
        double elapsed = (double)(currentEngineFrame - engineTimeStart) / kSampleRate;
        return playbackTimeStart + elapsed;
    }

    void clearTracks() {
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) t.release();
        tracks.clear();
        playbackTimeStart = 0;
        playing = false;
    }
    
    void setTrackVolume(const std::string& id, float vol) {
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) { if (t.id == id) { t.volume = vol; if (t.soundReady) ma_sound_set_volume(&t.sound, vol * masterVolume); break; } }
    }

    void setTrackMute(const std::string& id, bool muted) {
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) { if (t.id == id) { t.muted = muted; break; } }
        updateMuteSoloInternal();
    }

    void setTrackSolo(const std::string& id, bool solo) {
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) { if (t.id == id) { t.solo = solo; break; } }
        updateMuteSoloInternal();
    }

    void updateMuteSoloInternal() {
        bool anySolo = false;
        for (auto& t : tracks) { if (t.solo) { anySolo = true; break; } }

        for (auto& t : tracks) {
            if (!t.soundReady) continue;
            bool shouldMute = t.muted;
            if (anySolo && !t.solo) shouldMute = true;

            float finalVol = shouldMute ? 0.0f : t.volume;
            ma_sound_set_volume(&t.sound, finalVol * masterVolume);
            
            // Asegurar que esten corriendo si no estan muteados y estamos en play
            if (!shouldMute && playing) {
                ma_sound_start(&t.sound);
            }
        }
    }
    
    void setMasterVolume(float vol) { masterVolume = vol; ma_engine_set_volume(&engine, vol); }
    void setSpeed(float ratio) {
        speedRatio = ratio;
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) {
            if (t.soundReady) ma_sound_set_pitch(&t.sound, ratio);
        }
    }
    int getTrackCount() { std::lock_guard<std::mutex> lk(mtx); return (int)tracks.size(); }
};

static MultitrackEngine* gEngine = nullptr;

extern "C" {
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeInit(JNIEnv*, jobject) { if (!gEngine) { gEngine = new MultitrackEngine(); gEngine->init(); } }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeLoadTrack(JNIEnv* env, jobject, jstring jId, jstring jPath) {
        const char *id = env->GetStringUTFChars(jId, 0), *path = env->GetStringUTFChars(jPath, 0);
        if (gEngine) gEngine->loadTrack(id, path);
        env->ReleaseStringUTFChars(jId, id); env->ReleaseStringUTFChars(jPath, path);
    }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeClearTracks(JNIEnv*, jobject) { if (gEngine) gEngine->clearTracks(); }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativePlay(JNIEnv*, jobject) { if (gEngine) gEngine->play(); }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativePause(JNIEnv*, jobject) { if (gEngine) gEngine->pause(); }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeStop(JNIEnv*, jobject) { if (gEngine) { gEngine->pause(); gEngine->seekAll(0); } }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSeek(JNIEnv*, jobject, jdouble s) { if (gEngine) gEngine->seekAll(s); }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetVolume(JNIEnv*, jobject, jfloat v) { if (gEngine) gEngine->setMasterVolume(v); }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetTrackVolume(JNIEnv* env, jobject, jstring jId, jfloat v) {
        const char *id = env->GetStringUTFChars(jId, 0); if (gEngine) gEngine->setTrackVolume(id, v); env->ReleaseStringUTFChars(jId, id);
    }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetTrackMute(JNIEnv* env, jobject, jstring jId, jboolean m) {
        const char *id = env->GetStringUTFChars(jId, 0); if (gEngine) gEngine->setTrackMute(id, m); env->ReleaseStringUTFChars(jId, id);
    }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetTrackSolo(JNIEnv* env, jobject, jstring jId, jboolean m) {
        const char *id = env->GetStringUTFChars(jId, 0); if (gEngine) gEngine->setTrackSolo(id, m); env->ReleaseStringUTFChars(jId, id);
    }
    JNIEXPORT jdouble JNICALL Java_com_mixer_app_MultitrackPlugin_nativeGetPosition(JNIEnv*, jobject) { return gEngine ? gEngine->getPositionInternal() : 0.0; }
    JNIEXPORT jint JNICALL Java_com_mixer_app_MultitrackPlugin_nativeGetTrackCount(JNIEnv*, jobject) { return gEngine ? gEngine->getTrackCount() : 0; }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetSpeed(JNIEnv*, jobject, jfloat speed) { if (gEngine) gEngine->setSpeed(speed); }
}
