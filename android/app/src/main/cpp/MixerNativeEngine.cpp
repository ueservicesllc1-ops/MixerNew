// MixerNativeEngine.cpp
#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"

#include "soundtouch/SoundTouch.h"
using namespace soundtouch;

#include <jni.h>
#include <android/log.h>
#include <string>
#include <list>
#include <mutex>
#include <thread>
#include <atomic>
#include <cstring>
#include <chrono>

#define TAG     "MixerNative"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// ── SOUNDTOUCH NODE ──────────────────────────────────────────────────────────
// Per-track pitch-shifting processor inserted into the miniaudio node graph.
// Each track now has its own SoundTouch instance so seeks flush independently
// without contaminating sibling tracks through a shared buffer.

struct SoundTouchNodeData {
    ma_node_base        base;               // Must be first — miniaudio casts this to ma_node*
    SoundTouch          st;
    std::atomic<float>  pendingPitch{0.0f}; // Written by Java thread
    float               activePitch  = 0.0f; // Only touched by audio thread
    std::atomic<bool>   needsFlush{false};   // Set by Java thread on seek/clear; consumed by audio thread
};

static void stNodeProcess(
    ma_node* pNode, const float** ppFramesIn, ma_uint32* pFrameCountIn,
    float** ppFramesOut, ma_uint32* pFrameCountOut)
{
    auto* d = (SoundTouchNodeData*)pNode;

    // 1. Handle flush request (seek/clear happened on Java thread).
    //    needsFlush is set TRUE by the Java thread and cleared HERE by the audio
    //    thread — guaranteeing the flush runs exactly where it must.
    bool doFlush = d->needsFlush.exchange(false, std::memory_order_acq_rel);

    // 2. Handle pitch change
    float newPitch = d->pendingPitch.load(std::memory_order_relaxed);
    if (newPitch != d->activePitch) {
        d->activePitch = newPitch;
        d->st.setPitchSemiTones(newPitch);
        doFlush = true;
    }

    if (doFlush) {
        const ma_uint32 outFrames = *pFrameCountOut;
        d->st.clear();
        // Output silence for this one buffer (~5ms) so the track fully settles
        // at the new seek position before we start feeding SoundTouch again.
        memset(ppFramesOut[0], 0, outFrames * 2 * sizeof(float));
        *pFrameCountOut = outFrames;
        return;
    }

    // 3. Bypass when no pitch shift active — copy input, zero-fill remainder,
    //    always report full outFrames so the mixer never gets a short buffer.
    if (d->activePitch == 0.0f) {
        const ma_uint32 outFrames = *pFrameCountOut;
        const ma_uint32 inFrames  = *pFrameCountIn;
        const ma_uint32 copy      = (inFrames < outFrames) ? inFrames : outFrames;
        if (copy > 0) memcpy(ppFramesOut[0], ppFramesIn[0], copy * 2 * sizeof(float));
        if (copy < outFrames)
            memset(ppFramesOut[0] + copy * 2, 0, (outFrames - copy) * 2 * sizeof(float));
        *pFrameCountOut = outFrames;
        return;
    }

    // 4. Normal pitch-shifted processing
    d->st.putSamples(ppFramesIn[0], *pFrameCountIn);
    ma_uint32 received = (ma_uint32)d->st.receiveSamples(ppFramesOut[0], *pFrameCountOut);
    if (received < *pFrameCountOut) {
        memset(ppFramesOut[0] + received * 2, 0,
               (*pFrameCountOut - received) * 2 * sizeof(float));
    }
}

static ma_uint32 stBusChannels[1] = { 2 };  // 1 bus, stereo

static ma_node_vtable stNodeVtable = {
    stNodeProcess,  // onProcess
    nullptr,        // onGetRequiredInputFrameCount
    1,              // inputBusCount
    1,              // outputBusCount
    0               // flags
};
// ─────────────────────────────────────────────────────────────────────────────

// ── PER-TRACK METER NODE ─────────────────────────────────────────────────────
// Passthrough node that sits between each ma_sound and its per-track SoundTouch
// node. Computes RMS amplitude per audio callback and stores it in an atomic
// float so the Java thread can read it without synchronization overhead.

struct MeterNode {
    ma_node_base         base;
    std::atomic<float>   level{0.0f};
};

static ma_uint32 meterBusChannels[1] = { 2 };

static void meterNodeProcess(
    ma_node* pNode, const float** ppFramesIn, ma_uint32* pFrameCountIn,
    float** ppFramesOut, ma_uint32* pFrameCountOut)
{
    auto* m = (MeterNode*)pNode;
    const ma_uint32 outFrames  = *pFrameCountOut;
    const ma_uint32 inFrames   = *pFrameCountIn;
    const ma_uint32 copyFrames = (inFrames < outFrames) ? inFrames : outFrames;

    if (ppFramesOut[0]) {
        if (copyFrames > 0 && ppFramesIn[0]) {
            memcpy(ppFramesOut[0], ppFramesIn[0], copyFrames * 2 * sizeof(float));
        }
        // Zero-fill any remaining output frames so all tracks always deliver the
        // same frame count to SoundTouch. Without this, a seek-induced short buffer
        // on one track causes misaligned inputs in the stNode mix → desync.
        if (copyFrames < outFrames) {
            memset(ppFramesOut[0] + copyFrames * 2, 0,
                   (outFrames - copyFrames) * 2 * sizeof(float));
        }
    }

    // RMS metering on the copied samples
    if (copyFrames > 0 && ppFramesIn[0]) {
        float sum = 0.0f;
        const float* src = ppFramesIn[0];
        for (ma_uint32 i = 0; i < copyFrames * 2; i++) { sum += src[i] * src[i]; }
        float rms = sqrtf(sum / (float)(copyFrames * 2));
        float prev = m->level.load(std::memory_order_relaxed);
        float next = (rms > prev) ? rms : (prev * 0.92f);
        m->level.store(next, std::memory_order_relaxed);
    }

    // Always report full outFrames written — miniaudio expects this to be stable.
    *pFrameCountOut = outFrames;
}

static ma_node_vtable meterNodeVtable = {
    meterNodeProcess,
    nullptr,
    1,
    1,
    0
};
// ─────────────────────────────────────────────────────────────────────────────

// ── TRACK ─────────────────────────────────────────────────────────────────────
// Each track owns its full processing chain:
//   ma_sound → MeterNode → SoundTouchNode → engine endpoint
// This eliminates the shared-SoundTouch desync: each track's ST buffer is
// flushed independently, so a seek on track N cannot corrupt track M.

struct Track {
    std::string        id;
    ma_sound           sound;
    bool               soundReady  = false;
    MeterNode          meterNode;
    bool               meterReady  = false;
    SoundTouchNodeData stNode;           // Per-track SoundTouch (no longer shared)
    bool               stNodeReady = false;
    float              volume      = 1.0f;
    bool               muted       = false;
    bool               solo        = false;

    void release() {
        // Uninit in reverse attachment order: stNode → meterNode → sound
        if (stNodeReady)  { ma_node_uninit(&stNode.base,    nullptr); stNodeReady = false; }
        if (meterReady)   { ma_node_uninit(&meterNode.base, nullptr); meterReady  = false; }
        if (soundReady)   { ma_sound_uninit(&sound);                  soundReady  = false; }
    }
};
// ─────────────────────────────────────────────────────────────────────────────

class MultitrackEngine {
public:
    ma_engine          engine;
    bool               engineReady = false;
    std::list<Track>   tracks;
    std::mutex         mtx;

    // ── PRE-LOAD BUFFER (siguiente canción, carga mientras la actual suena) ──
    std::list<Track>   pendingTracks;
    std::mutex         pendingMtx;
    std::string        pendingSongId;
    std::atomic<bool>  preloading{false};

    double    playbackTimeStart = 0.0;
    ma_uint64 engineTimeStart   = 0;
    bool      playing           = false;
    float     masterVolume      = 1.0f;
    float     speedRatio        = 1.0f;
    float     currentPitch      = 0.0f; // Remembered for tracks loaded after setPitch()

    static constexpr int kSampleRate = 44100;

    void init() {
        if (engineReady) return;
        ma_engine_config cfg = ma_engine_config_init();
        cfg.sampleRate = kSampleRate;
        if (ma_engine_init(&cfg, &engine) == MA_SUCCESS) {
            ma_engine_stop(&engine);
            engineReady = true;
            LOGD("ma_engine_init OK — per-track SoundTouch mode");
        }
    }

    // ── Helper: init the per-track SoundTouch node and wire the full chain ──
    // sound → meterNode → stNode → endpoint
    // Called from loadTrack() and preloadTrack() after both sound and meter
    // have been initialized successfully.
    void initTrackStNode(Track* tPtr, ma_node_graph* pGraph) {
        tPtr->stNode.st.setChannels(2);
        tPtr->stNode.st.setSampleRate(kSampleRate);
        tPtr->stNode.st.setPitchSemiTones(currentPitch);
        tPtr->stNode.st.setSetting(SETTING_USE_QUICKSEEK, 1);
        tPtr->stNode.st.setSetting(SETTING_OVERLAP_MS, 8);
        tPtr->stNode.pendingPitch.store(currentPitch, std::memory_order_relaxed);
        tPtr->stNode.activePitch  = currentPitch;
        tPtr->stNode.needsFlush.store(false, std::memory_order_relaxed);

        ma_node_config stCfg        = ma_node_config_init();
        stCfg.vtable                = &stNodeVtable;
        stCfg.inputBusCount         = 1;
        stCfg.outputBusCount        = 1;
        stCfg.pInputChannels        = stBusChannels;
        stCfg.pOutputChannels       = stBusChannels;

        if (ma_node_init(pGraph, &stCfg, nullptr, &tPtr->stNode.base) == MA_SUCCESS) {
            tPtr->stNodeReady = true;
            // Chain: meterNode → stNode → endpoint
            ma_node_attach_output_bus(&tPtr->meterNode.base, 0, &tPtr->stNode.base, 0);
            ma_node_attach_output_bus(&tPtr->stNode.base, 0, ma_engine_get_endpoint(&engine), 0);
            LOGD("Per-track stNode OK for %s (pitch=%.1f)", tPtr->id.c_str(), (double)currentPitch);
        } else {
            // Fallback: meter → endpoint directly if stNode init fails
            ma_node_attach_output_bus(&tPtr->meterNode.base, 0, ma_engine_get_endpoint(&engine), 0);
            LOGE("Per-track stNode FAILED for %s — direct to endpoint", tPtr->id.c_str());
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

        // MA_SOUND_FLAG_NO_DEFAULT_ATTACHMENT: prevent sound from attaching to
        // the engine endpoint directly — we route it through meter → stNode instead.
        ma_uint32 sflags = MA_SOUND_FLAG_STREAM
                         | MA_SOUND_FLAG_NO_SPATIALIZATION
                         | MA_SOUND_FLAG_NO_DEFAULT_ATTACHMENT;

        ma_result r = ma_sound_init_from_file(&engine, path.c_str(), sflags, nullptr, nullptr, &tPtr->sound);
        if (r == MA_SUCCESS) {
            tPtr->soundReady = true;
            double currentPos = getPositionInternal();
            ma_uint64 frame = (ma_uint64)(currentPos * kSampleRate);
            ma_sound_seek_to_pcm_frame(&tPtr->sound, frame);
            ma_sound_set_volume(&tPtr->sound, tPtr->volume * masterVolume);

            ma_node_config mCfg      = ma_node_config_init();
            mCfg.vtable              = &meterNodeVtable;
            mCfg.inputBusCount       = 1;
            mCfg.outputBusCount      = 1;
            mCfg.pInputChannels      = meterBusChannels;
            mCfg.pOutputChannels     = meterBusChannels;
            ma_node_graph* pGraph = ma_engine_get_node_graph(&engine);

            if (ma_node_init(pGraph, &mCfg, nullptr, &tPtr->meterNode.base) == MA_SUCCESS) {
                tPtr->meterReady = true;
                tPtr->meterNode.level.store(0.0f, std::memory_order_relaxed);
                // Attach sound → meterNode (stNode attachment done inside initTrackStNode)
                ma_node_attach_output_bus((ma_node*)&tPtr->sound, 0, &tPtr->meterNode.base, 0);
                initTrackStNode(tPtr, pGraph);
            } else {
                // Fallback: sound → endpoint directly
                ma_node_attach_output_bus((ma_node*)&tPtr->sound, 0, ma_engine_get_endpoint(&engine), 0);
                LOGE("MeterNode init FAILED for track %s", id.c_str());
            }

            updateMuteSoloInternal();
            LOGD("Track %s cargado (stream) y sincronizado a %.2fs", id.c_str(), currentPos);
        } else {
            LOGE("Error cargando track %s: %d", id.c_str(), r);
        }
    }

    /**
     * Carga una pista en el buffer pendiente (pre-carga en background).
     * No interrumpe la reproducción actual.
     */
    void preloadTrack(const std::string& songId, const std::string& id, const std::string& path) {
        if (!engineReady) return;
        std::lock_guard<std::mutex> lk(pendingMtx);

        if (pendingSongId != songId) {
            for (auto& t : pendingTracks) t.release();
            pendingTracks.clear();
            pendingSongId = songId;
        }

        Track* tPtr = nullptr;
        for (auto& tr : pendingTracks) { if (tr.id == id) { tPtr = &tr; break; } }
        if (!tPtr) {
            pendingTracks.emplace_back();
            tPtr = &pendingTracks.back();
            tPtr->id = id;
        } else {
            tPtr->release();
        }

        ma_uint32 pflags = MA_SOUND_FLAG_STREAM
                         | MA_SOUND_FLAG_NO_SPATIALIZATION
                         | MA_SOUND_FLAG_NO_DEFAULT_ATTACHMENT;

        ma_result r = ma_sound_init_from_file(&engine, path.c_str(), pflags, nullptr, nullptr, &tPtr->sound);
        if (r == MA_SUCCESS) {
            tPtr->soundReady = true;
            ma_sound_seek_to_pcm_frame(&tPtr->sound, 0);
            ma_sound_set_volume(&tPtr->sound, tPtr->volume * masterVolume);

            ma_node_config mCfg      = ma_node_config_init();
            mCfg.vtable              = &meterNodeVtable;
            mCfg.inputBusCount       = 1;
            mCfg.outputBusCount      = 1;
            mCfg.pInputChannels      = meterBusChannels;
            mCfg.pOutputChannels     = meterBusChannels;
            ma_node_graph* pGraph = ma_engine_get_node_graph(&engine);

            if (ma_node_init(pGraph, &mCfg, nullptr, &tPtr->meterNode.base) == MA_SUCCESS) {
                tPtr->meterReady = true;
                tPtr->meterNode.level.store(0.0f, std::memory_order_relaxed);
                ma_node_attach_output_bus((ma_node*)&tPtr->sound, 0, &tPtr->meterNode.base, 0);
                initTrackStNode(tPtr, pGraph);
            } else {
                ma_node_attach_output_bus((ma_node*)&tPtr->sound, 0, ma_engine_get_endpoint(&engine), 0);
                LOGE("MeterNode init FAILED for preload track %s", id.c_str());
            }
            LOGD("Preload track %s (stream) de cancion %s OK", id.c_str(), songId.c_str());
        } else {
            LOGE("Error preload track %s: %d", id.c_str(), r);
        }
    }

    /**
     * Swap atómico O(1): convierte los tracks pendientes en activos.
     */
    bool swapToPending(const std::string& songId) {
        std::lock_guard<std::mutex> lkP(pendingMtx);
        if (pendingSongId != songId || pendingTracks.empty()) {
            LOGD("swapToPending: no hay pending para %s", songId.c_str());
            return false;
        }

        std::lock_guard<std::mutex> lkA(mtx);
        for (auto& t : tracks) t.release();
        tracks.clear();

        tracks = std::move(pendingTracks);
        pendingTracks.clear();
        pendingSongId = "";

        playbackTimeStart = 0;
        engineTimeStart = ma_engine_get_time_in_pcm_frames(&engine);
        playing = false;

        for (auto& t : tracks) {
            if (t.soundReady) ma_sound_seek_to_pcm_frame(&t.sound, 0);
        }

        // Signal each per-track stNode to flush — audio thread executes it safely
        for (auto& t : tracks) {
            if (t.stNodeReady) t.stNode.needsFlush.store(true, std::memory_order_release);
        }

        LOGD("swapToPending OK: %zu tracks activos", tracks.size());
        return true;
    }

    void play() {
        if (!engineReady || playing) return;
        std::lock_guard<std::mutex> lk(mtx);

        // Start every track while engine is stopped, then start engine once.
        for (auto& t : tracks) if (t.soundReady) ma_sound_start(&t.sound);
        ma_engine_start(&engine);
        engineTimeStart = ma_engine_get_time_in_pcm_frames(&engine);

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

        // 1. Stop all sounds — but KEEP the engine (audio device) running.
        //    Reason: ma_sound_seek_to_pcm_frame() posts seek jobs to the job queue.
        //    Those jobs are processed by the audio callback (inline) when the engine
        //    runs. If the engine is stopped, jobs only run on the resource-manager
        //    background thread, which is slower and non-deterministic. Keeping the
        //    engine alive means all seeks are dispatched within the next 1–2 callbacks
        //    (~5–10 ms), and the ring buffers start pre-filling immediately.
        for (auto& t : tracks) if (t.soundReady) ma_sound_stop(&t.sound);

        // 2. Seek every track to the EXACT same PCM frame.
        playbackTimeStart = seconds;
        ma_uint64 frame = (ma_uint64)(seconds * kSampleRate);
        for (auto& t : tracks) if (t.soundReady) ma_sound_seek_to_pcm_frame(&t.sound, frame);

        // 3. If the engine was stopped (song paused), start it temporarily so the
        //    audio callback runs and can process the queued seek jobs.
        bool wasRunning = playing;
        if (!wasRunning) {
            ma_engine_start(&engine);
        }

        // 4. BARRIER: give the running audio callback + resource manager time to:
        //    a) process all seek jobs (each ~1–3 ms, handled sequentially in job thread)
        //    b) pre-fill the first ring-buffer page at the new position for each track
        //    50 ms is ample for 5–8 MP3 tracks on any Android device.
        std::this_thread::sleep_for(std::chrono::milliseconds(50));

        // 5. Signal per-track SoundTouch nodes to flush stale pitch-shifted samples
        //    on the NEXT audio callback — never call st.clear() here to avoid races.
        for (auto& t : tracks) {
            if (t.stNodeReady) t.stNode.needsFlush.store(true, std::memory_order_release);
        }

        // 6. Resume or stop cleanly.
        if (wasRunning) {
            // Engine already running — restart sounds; they now have pre-filled buffers.
            for (auto& t : tracks) if (t.soundReady) ma_sound_start(&t.sound);
            engineTimeStart = ma_engine_get_time_in_pcm_frames(&engine);
        } else {
            // Was paused — stop the engine again (we only ran it to process seek jobs).
            ma_engine_stop(&engine);
            engineTimeStart = ma_engine_get_time_in_pcm_frames(&engine);
        }
    }

    double getPositionInternal() {
        if (!playing) return playbackTimeStart;
        ma_uint64 currentEngineFrame = ma_engine_get_time_in_pcm_frames(&engine);
        double elapsed = (double)(currentEngineFrame - engineTimeStart) / kSampleRate;
        return playbackTimeStart + elapsed;
    }

    void clearTracks() {
        // Signal flush before releasing so audio thread cleans up cleanly
        {
            std::lock_guard<std::mutex> lk(mtx);
            for (auto& t : tracks) {
                if (t.stNodeReady) t.stNode.needsFlush.store(true, std::memory_order_release);
            }
        }
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) t.release();
        tracks.clear();
        playbackTimeStart = 0;
        playing = false;
    }

    void clearPending() {
        std::lock_guard<std::mutex> lk(pendingMtx);
        for (auto& t : pendingTracks) t.release();
        pendingTracks.clear();
        pendingSongId = "";
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

    double getDurationInternal() {
        std::lock_guard<std::mutex> lk(mtx);
        double maxDur = 0.0;
        for (auto& t : tracks) {
            if (!t.soundReady) continue;
            float dur = 0.0f;
            if (ma_sound_get_length_in_seconds(&t.sound, &dur) == MA_SUCCESS && dur > maxDur) {
                maxDur = (double)dur;
            }
        }
        return maxDur;
    }

    // Tempo-independent pitch shifting via per-track SoundTouch.
    // semitones: negative = lower pitch, positive = raise pitch (range: -12..+12)
    void setPitch(float semitones) {
        currentPitch = semitones; // Remembered for tracks loaded after this call
        std::lock_guard<std::mutex> lk(mtx);
        for (auto& t : tracks) {
            if (t.stNodeReady) {
                t.stNode.pendingPitch.store(semitones, std::memory_order_relaxed);
            }
        }
        LOGD("setPitch %.1f semitones → %zu tracks", (double)semitones, tracks.size());
    }

    // Returns per-track RMS levels as "id1:0.45,id2:0.22,..." string.
    std::string getTrackLevels() {
        std::lock_guard<std::mutex> lk(mtx);
        std::string result;
        result.reserve(tracks.size() * 20);
        for (auto& t : tracks) {
            if (!t.soundReady || !t.meterReady) continue;
            if (!result.empty()) result += ',';
            float raw = t.meterNode.level.load(std::memory_order_relaxed);
            if (raw > 1.0f) raw = 1.0f;
            char buf[64];
            snprintf(buf, sizeof(buf), "%.3f", raw);
            result += t.id;
            result += ':';
            result += buf;
        }
        return result;
    }
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
    JNIEXPORT jdouble JNICALL Java_com_mixer_app_MultitrackPlugin_nativeGetDuration(JNIEnv*, jobject) { return gEngine ? gEngine->getDurationInternal() : 0.0; }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetSpeed(JNIEnv*, jobject, jfloat speed) { if (gEngine) gEngine->setSpeed(speed); }

    // ── PRE-LOAD ──────────────────────────────────────────────────────────────
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativePreloadTrack(JNIEnv* env, jobject, jstring jSongId, jstring jId, jstring jPath) {
        const char* songId = env->GetStringUTFChars(jSongId, 0);
        const char* id     = env->GetStringUTFChars(jId,     0);
        const char* path   = env->GetStringUTFChars(jPath,   0);
        if (gEngine) gEngine->preloadTrack(songId, id, path);
        env->ReleaseStringUTFChars(jSongId, songId);
        env->ReleaseStringUTFChars(jId,     id);
        env->ReleaseStringUTFChars(jPath,   path);
    }
    JNIEXPORT jboolean JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSwapToPending(JNIEnv* env, jobject, jstring jSongId) {
        const char* songId = env->GetStringUTFChars(jSongId, 0);
        jboolean result = (gEngine && gEngine->swapToPending(songId)) ? JNI_TRUE : JNI_FALSE;
        env->ReleaseStringUTFChars(jSongId, songId);
        return result;
    }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeClearPending(JNIEnv*, jobject) {
        if (gEngine) gEngine->clearPending();
    }
    JNIEXPORT void JNICALL Java_com_mixer_app_MultitrackPlugin_nativeSetPitch(JNIEnv*, jobject, jfloat semitones) {
        if (gEngine) gEngine->setPitch((float)semitones);
    }
    JNIEXPORT jstring JNICALL Java_com_mixer_app_MultitrackPlugin_nativeGetTrackLevels(JNIEnv* env, jobject) {
        if (!gEngine) return env->NewStringUTF("");
        std::string levels = gEngine->getTrackLevels();
        return env->NewStringUTF(levels.c_str());
    }
}
