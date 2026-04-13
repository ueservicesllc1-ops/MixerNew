// NextGenMultitrackEngine.cpp — Phase 2: ma_decoder per stem, one ma_device, mix in callback.

#include "NextGenMultitrackEngine.h"
#include "NextGenTempoLab.h"

#include "SoundTouch.h"
#include "miniaudio.h"

#include <android/log.h>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <future>
#include <jni.h>
#include <memory>
#include <mutex>
#include <sstream>
#include <vector>

#define NG_TAG "NextGenEngine"
#define NGD(...) __android_log_print(ANDROID_LOG_DEBUG, NG_TAG, __VA_ARGS__)
#define NGE(...) __android_log_print(ANDROID_LOG_ERROR, NG_TAG, __VA_ARGS__)
#define NGLOGI(msg) __android_log_print(ANDROID_LOG_INFO, "NEXTGEN", "%s", msg)
#define NGR(...) __android_log_print(ANDROID_LOG_INFO, "NEXTGEN_ROUTE", __VA_ARGS__)
#define NGSOLO(...) __android_log_print(ANDROID_LOG_INFO, "NEXTGEN_SOLO", __VA_ARGS__)
#define NGMIX(...) __android_log_print(ANDROID_LOG_INFO, "NEXTGEN_MIX", __VA_ARGS__)
#define NGPITCH(...) __android_log_print(ANDROID_LOG_INFO, "NEXTGEN_PITCH", __VA_ARGS__)
#define NGTEMPO(...) __android_log_print(ANDROID_LOG_INFO, "NEXTGEN_TEMPO", __VA_ARGS__)

namespace {
void logNextGenInfoMsgMs(const char* lineAfterTag, int64_t msSinceSeekStart) {
    char buf[192];
    std::snprintf(buf, sizeof(buf), "[NEXTGEN] %s (%lld ms)", lineAfterTag, (long long)msSinceSeekStart);
    NGLOGI(buf);
}

void logNextGenInfoFixed(const char* lineAfterTag) {
    char buf[160];
    std::snprintf(buf, sizeof(buf), "[NEXTGEN] %s", lineAfterTag);
    NGLOGI(buf);
}
} // namespace

namespace nextgen {

namespace {

constexpr ma_uint32 kChannels = 2;
constexpr ma_uint32 kSampleRate = (ma_uint32)NextGenMultitrackEngine::kDefaultSampleRate;

/// Live split: click + guía → one earpiece, band → the other. Flip for stage routing.
static constexpr bool clickGuideOnLeft = true;

static bool utf8ContainsKeywordInsensitive(const std::string& hay, const char* needleLowerAscii) {
    const size_t n = std::strlen(needleLowerAscii);
    if (n == 0 || hay.size() < n) return false;
    for (size_t i = 0; i + n <= hay.size(); ++i) {
        bool ok = true;
        for (size_t j = 0; j < n; ++j) {
            const unsigned char hc = static_cast<unsigned char>(hay[i + j]);
            const unsigned char nc = static_cast<unsigned char>(needleLowerAscii[j]);
            if (std::tolower(hc) != static_cast<int>(nc)) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}

/** Click / guía / guide stems → one output side; everything else → the other (see clickGuideOnLeft). */
static bool classifyStemClickOrGuide(const std::string& id, const std::string& path) {
    const std::string blob = id + " " + path;
    return utf8ContainsKeywordInsensitive(blob, "click") || utf8ContainsKeywordInsensitive(blob, "guia") ||
           utf8ContainsKeywordInsensitive(blob, "guide");
}

/** Stable build: realtime tempo (SoundTouch tempo + Tempo Lab) off; pitch post-mix unchanged. */
static constexpr bool kNextGenTempoRealtimeDisabled = true;

static std::atomic<bool> g_nextgen_tempo_disabled_logged{false};
static void logNextGenTempoDisabledOnce() {
    if (!g_nextgen_tempo_disabled_logged.exchange(true)) {
        NGTEMPO("[NEXTGEN_TEMPO] disabled in stable build");
    }
}

} // namespace

std::string jsonEscape(const std::string& s) {
    std::string o;
    o.reserve(s.size() + 8);
    for (unsigned char c : s) {
        if (c == '\n' || c == '\r' || c == '\t') {
            o += ' ';
            continue;
        }
        if (c == '\\' || c == '"') o += '\\';
        o += static_cast<char>(c);
    }
    return o;
}

struct StemChannel {
    std::string id;
    std::string path;
    ma_decoder decoder{};
    bool decoderOk = false;
    std::atomic<float> volume{1.f};
    std::atomic<bool> muted{false};
    std::atomic<bool> solo{false};
    std::atomic<bool> ended{false};
    ma_uint64 lengthFrames = 0;
    /// Set at load: click/guía/guide → split side; other stems → opposite (see onAudio routing).
    bool routeClickGuide = false;
    /// Diagnostic: log at most one partial-read line per stem after each seek (reset in seekSeconds).
    bool loggedPartialAfterSeek = false;
};

struct NextGenMultitrackEngine::Impl {
    std::vector<std::unique_ptr<StemChannel>> stems_;
    ma_device device{};
    bool deviceInitialized = false;

    mutable std::mutex snapshot_mtx_;
    std::atomic<ma_uint64> playhead_frames{0};
    ma_uint64 duration_frames = 0;

    /// 0=stopped, 1=playing, 2=paused — readable from audio thread
    std::atomic<int> transport{0};

    std::vector<float> mix_temp_;

    /// Wall-clock epoch for seek diagnostics (ms deltas in NEXTGEN INFO lines).
    std::chrono::steady_clock::time_point seek_diag_epoch_{};

    /// After seek, do not output or advance playhead until ma_device_start has returned (playing).
    std::atomic<bool> audio_ready_after_seek_{true};
    /// Log at most one "audio gated" line per seek while callbacks are silenced.
    std::atomic<bool> diag_logged_audio_gated_{false};
    /// After ungate, log once on first all-stems full block (audible clean mix).
    std::atomic<bool> diag_pending_first_audible_{false};

    /// Post-mix SoundTouch: pitch + tempo, whole song. LGPL, float samples.
    soundtouch::SoundTouch pitch_st_;
    std::atomic<float> pitch_semitones_{0.f};
    std::atomic<float> tempo_ratio_{1.f};
    std::atomic<float> pitch_applied_st_{0.f};
    std::atomic<float> tempo_applied_{1.f};
    std::atomic<bool> pitch_clear_pending_{false};
    std::atomic<bool> tempo_clear_pending_{false};
    std::atomic<int> pitch_log_mode_{0}; // 0 init, 1 bypass, 2 processing
    std::atomic<int> tempo_log_mode_{0};

    /// Post–SoundTouch master fader [0, 1]
    std::atomic<float> master_volume_{1.f};

    /** When true, mixed audio goes through TempoLabProcessor only (production SoundTouch post-mix skipped). */
    std::atomic<bool> tempo_lab_active_{false};
    TempoLabProcessor tempo_lab_;

    static constexpr float kTempoRatioMin = 0.8f;
    static constexpr float kTempoRatioMax = 1.2f;

    void initPostMixProcessorLocked() {
        pitch_st_.clear();
        pitch_st_.setSampleRate(kSampleRate);
        pitch_st_.setChannels(kChannels);
        pitch_st_.setPitchSemiTones(0.0);
        pitch_st_.setTempo(1.0);
        pitch_semitones_.store(0.f);
        tempo_ratio_.store(1.f);
        pitch_applied_st_.store(0.f);
        tempo_applied_.store(1.f);
        pitch_log_mode_.store(0);
        tempo_log_mode_.store(0);
        if constexpr (!kNextGenTempoRealtimeDisabled) {
            tempo_lab_.init((int)kSampleRate, kChannels);
            tempo_lab_.setRatio(1.0);
        }
        tempo_lab_active_.store(false);
        if constexpr (kNextGenTempoRealtimeDisabled) {
            logNextGenTempoDisabledOnce();
        }
    }

    void applyPostMixSoundTouch(float* pOut, ma_uint32 frameCount) {
        const float pTarget = pitch_semitones_.load(std::memory_order_relaxed);
        const float tTarget =
            kNextGenTempoRealtimeDisabled ? 1.0f : tempo_ratio_.load(std::memory_order_relaxed);
        const bool pitchBypass = std::abs(pTarget) < 0.01f;
        const bool tempoBypass = std::abs(tTarget - 1.0f) < 0.001f;

        const bool pClear = pitch_clear_pending_.exchange(false);
        const bool tClear = tempo_clear_pending_.exchange(false);
        if (pClear || tClear) {
            pitch_st_.clear();
            pitch_applied_st_.store(1e6f);
            tempo_applied_.store(1e6f);
        }

        if (pitchBypass && tempoBypass) {
            pitch_applied_st_.store(0.f);
            tempo_applied_.store(1.f);
            const int prevP = pitch_log_mode_.exchange(1);
            if (prevP != 1) {
                NGPITCH("[NEXTGEN_PITCH] bypass (pitch = 0)");
            }
            const int prevT = tempo_log_mode_.exchange(1);
            if (prevT != 1) {
                NGTEMPO("[NEXTGEN_TEMPO] bypass (tempo = 1.0)");
            }
            return;
        }

        if (!pitchBypass) {
            const int prev = pitch_log_mode_.exchange(2);
            if (prev != 2) {
                NGPITCH("[NEXTGEN_PITCH] processing active");
            }
        } else {
            pitch_log_mode_.store(1);
        }

        if (!tempoBypass) {
            const int prev = tempo_log_mode_.exchange(2);
            if (prev != 2) {
                NGTEMPO("[NEXTGEN_TEMPO] processing active");
            }
        } else {
            tempo_log_mode_.store(1);
        }

        if (!pitchBypass) {
            if (std::abs(pTarget - pitch_applied_st_.load(std::memory_order_relaxed)) > 1e-4f) {
                pitch_st_.setPitchSemiTones((double)pTarget);
                pitch_applied_st_.store(pTarget);
            }
        } else {
            if (std::abs(pitch_applied_st_.load(std::memory_order_relaxed)) > 1e-4f) {
                pitch_st_.setPitchSemiTones(0.0);
                pitch_applied_st_.store(0.f);
            }
        }

        if (!tempoBypass) {
            if (std::abs(tTarget - tempo_applied_.load(std::memory_order_relaxed)) > 1e-4f) {
                pitch_st_.setTempo((double)tTarget);
                tempo_applied_.store(tTarget);
            }
        } else {
            if (std::abs(tempo_applied_.load(std::memory_order_relaxed) - 1.f) > 1e-4f) {
                pitch_st_.setTempo(1.0);
                tempo_applied_.store(1.f);
            }
        }

        pitch_st_.putSamples(pOut, frameCount);
        ma_uint32 got = 0;
        while (got < frameCount) {
            const uint n = pitch_st_.receiveSamples(pOut + (size_t)got * kChannels, frameCount - got);
            if (n == 0) break;
            got += n;
        }
        if (got < frameCount) {
            std::memset(pOut + (size_t)got * kChannels, 0,
                        (size_t)(frameCount - got) * kChannels * sizeof(float));
        }
        const size_t samples = (size_t)frameCount * kChannels;
        for (size_t i = 0; i < samples; ++i) {
            float x = pOut[i];
            if (x > 1.f) x = 1.f;
            else if (x < -1.f) x = -1.f;
            pOut[i] = x;
        }
    }

    void stopDevice() {
        if (deviceInitialized) {
            ma_result r = ma_device_stop(&device);
            if (r != MA_SUCCESS && r != MA_INVALID_OPERATION) {
                NGD("ma_device_stop -> %d", (int)r);
            }
        }
    }

    void uninitDevice() {
        stopDevice();
        if (deviceInitialized) {
            ma_device_uninit(&device);
            deviceInitialized = false;
            std::memset(&device, 0, sizeof(device));
            NGD("ma_device_uninit done");
        }
    }

    void clearStems() {
        for (auto& s : stems_) {
            if (s && s->decoderOk) {
                ma_decoder_uninit(&s->decoder);
                s->decoderOk = false;
            }
        }
        stems_.clear();
        duration_frames = 0;
    }

    bool ensurePlaybackDevice() {
        if (deviceInitialized) return true;

        ma_device_config cfg = ma_device_config_init(ma_device_type_playback);
        cfg.playback.format = ma_format_f32;
        cfg.playback.channels = kChannels;
        cfg.sampleRate = kSampleRate;
        cfg.dataCallback = &NextGenMultitrackEngine::Impl::audioCallbackTrampoline;
        cfg.pUserData = this;
        cfg.noPreSilencedOutputBuffer = MA_TRUE;

        NGD("ma_device_init starting (playback f32 %d Hz, %d ch)", (int)kSampleRate, (int)kChannels);
        ma_result r = ma_device_init(nullptr, &cfg, &device);
        if (r != MA_SUCCESS) {
            NGE("ma_device_init failed: %d", (int)r);
            return false;
        }
        deviceInitialized = true;
        NGD("ma_device_init OK");
        return true;
    }

    static void audioCallbackTrampoline(ma_device* pDevice, void* pOutput, const void* /*pInput*/,
                                        ma_uint32 frameCount) {
        NextGenMultitrackEngine::Impl* self = static_cast<NextGenMultitrackEngine::Impl*>(pDevice->pUserData);
        if (!self || !pOutput) return;
        self->onAudio(static_cast<float*>(pOutput), frameCount);
    }

    void onAudio(float* pOut, ma_uint32 frameCount) {
        const size_t samples = (size_t)frameCount * kChannels;
        if (transport.load(std::memory_order_acquire) != 1) {
            std::memset(pOut, 0, samples * sizeof(float));
            return;
        }

        // Post-seek: device may still deliver callbacks before ma_device_start returns; never mix or
        // advance playhead until the engine explicitly ungates after successful resume.
        if (!audio_ready_after_seek_.load(std::memory_order_acquire)) {
            std::memset(pOut, 0, samples * sizeof(float));
            if (!diag_logged_audio_gated_.exchange(true, std::memory_order_acq_rel)) {
                logNextGenInfoFixed("audio gated (callback blocked)");
            }
            return;
        }

        std::memset(pOut, 0, samples * sizeof(float));
        if (mix_temp_.size() < samples) mix_temp_.resize(samples);

        bool sawActiveStem = false;
        bool blockAllStemsFullRead = true;

        bool anySolo = false;
        for (const auto& up : stems_) {
            if (up && up->decoderOk && up->solo.load(std::memory_order_relaxed)) {
                anySolo = true;
                break;
            }
        }

        // Stems vector is stable while device runs (only replaced after stop+lock in loadSongSession).
        for (auto& up : stems_) {
            StemChannel* stem = up.get();
            if (!stem || !stem->decoderOk) continue;
            sawActiveStem = true;

            ma_uint64 framesRead = 0;
            ma_result r = ma_decoder_read_pcm_frames(&stem->decoder, mix_temp_.data(), frameCount, &framesRead);
            (void)r;

            if (framesRead < frameCount) {
                blockAllStemsFullRead = false;
                if (!stem->loggedPartialAfterSeek) {
                    stem->loggedPartialAfterSeek = true;
                    const auto msPart = std::chrono::duration_cast<std::chrono::milliseconds>(
                                            std::chrono::steady_clock::now() - seek_diag_epoch_)
                                            .count();
                    char line[128];
                    std::snprintf(line, sizeof(line), "partial read after seek (stem %s)", stem->id.c_str());
                    logNextGenInfoMsgMs(line, (int64_t)msPart);
                }
            }

            const bool muted = stem->muted.load(std::memory_order_relaxed);
            const bool soloFlag = stem->solo.load(std::memory_order_relaxed);
            const float vol = stem->volume.load(std::memory_order_relaxed);
            float g = 0.f;
            if (anySolo) {
                if (!soloFlag) {
                    g = 0.f;
                } else if (muted) {
                    g = 0.f;
                } else {
                    g = vol;
                }
            } else {
                g = muted ? 0.f : vol;
            }
            // Split-stereo live routing: read stereo per stem as today; downmix to mono then write to ONE
            // output channel only (no dual-channel bleed). Transport/seek/decoders unchanged.
            const ma_uint32 nFrames = (ma_uint32)framesRead;
            for (ma_uint32 f = 0; f < nFrames; ++f) {
                const float L = mix_temp_[(size_t)f * 2];
                const float R = mix_temp_[(size_t)f * 2 + 1];
                const float m = 0.5f * (L + R);
                const size_t base = (size_t)f * 2;
                if (stem->routeClickGuide) {
                    if (clickGuideOnLeft) {
                        pOut[base + 0] += m * g;
                    } else {
                        pOut[base + 1] += m * g;
                    }
                } else {
                    if (clickGuideOnLeft) {
                        pOut[base + 1] += m * g;
                    } else {
                        pOut[base + 0] += m * g;
                    }
                }
            }

            // Short read usually means EOF for file-backed decoders.
            if (framesRead < frameCount) {
                stem->ended.store(true, std::memory_order_relaxed);
            }
        }

        if (sawActiveStem && blockAllStemsFullRead &&
            diag_pending_first_audible_.exchange(false, std::memory_order_acq_rel)) {
            logNextGenInfoFixed("first audible clean block");
        }

        for (size_t i = 0; i < samples; ++i) {
            float x = pOut[i];
            if (x > 1.f) x = 1.f;
            else if (x < -1.f) x = -1.f;
            pOut[i] = x;
        }

        applyPostMixSoundTouch(pOut, frameCount);

        const float master = master_volume_.load(std::memory_order_relaxed);
        for (size_t i = 0; i < samples; ++i) {
            pOut[i] *= master;
        }

        playhead_frames.fetch_add(frameCount, std::memory_order_relaxed);
    }

    void loadSongSession(const std::vector<StemDesc>& stems) {
        NGD("loadSongSession: begin (%zu paths)", stems.size());
        stopDevice();
        {
            std::lock_guard<std::mutex> lock(snapshot_mtx_);
            uninitDevice();
            clearStems();
            initPostMixProcessorLocked();

            for (const auto& d : stems) {
                auto ch = std::make_unique<StemChannel>();
                ch->id = d.id;
                ch->path = d.path;
                ch->volume.store(d.volume);
                ch->muted.store(d.muted);
                ch->solo.store(false);
                ch->ended.store(false);
                ch->routeClickGuide = classifyStemClickOrGuide(ch->id, ch->path);

                ma_decoder_config decCfg = ma_decoder_config_init(ma_format_f32, kChannels, kSampleRate);
                NGD("decoder init: id=%s path=%s", ch->id.c_str(), ch->path.c_str());
                ma_result dr = ma_decoder_init_file(ch->path.c_str(), &decCfg, &ch->decoder);
                if (dr != MA_SUCCESS) {
                    NGE("ma_decoder_init_file failed (%d) for %s", (int)dr, ch->path.c_str());
                    continue;
                }
                ch->decoderOk = true;
                ma_uint64 len = 0;
                if (ma_decoder_get_length_in_pcm_frames(&ch->decoder, &len) == MA_SUCCESS) {
                    ch->lengthFrames = len;
                    if (len > duration_frames) duration_frames = len;
                }
                NGD("decoder OK: id=%s lenFrames=%llu", ch->id.c_str(), (unsigned long long)ch->lengthFrames);
                if (ch->routeClickGuide) {
                    NGR("[NEXTGEN_ROUTE] click/guide stem -> %s", clickGuideOnLeft ? "LEFT" : "RIGHT");
                } else {
                    NGR("[NEXTGEN_ROUTE] band stem -> %s", clickGuideOnLeft ? "RIGHT" : "LEFT");
                }
                stems_.push_back(std::move(ch));
            }

            playhead_frames.store(0);
            transport.store(0);
            audio_ready_after_seek_.store(false, std::memory_order_release);
            diag_logged_audio_gated_.store(false, std::memory_order_relaxed);
            diag_pending_first_audible_.store(false, std::memory_order_relaxed);

            if (!stems_.empty()) {
                if (!ensurePlaybackDevice()) {
                    NGE("playback device unavailable — session loaded but cannot play");
                }
            }
        }
        NGD("loadSongSession: done (stems=%zu durationFrames=%llu)", stems_.size(),
            (unsigned long long)duration_frames);
    }

    void play() {
        std::lock_guard<std::mutex> lock(snapshot_mtx_);
        if (stems_.empty() || !deviceInitialized) {
            NGD("play ignored (no stems or no device)");
            return;
        }
        audio_ready_after_seek_.store(false, std::memory_order_release);
        diag_logged_audio_gated_.store(false, std::memory_order_relaxed);
        transport.store(1);
        ma_result r = ma_device_start(&device);
        NGD("play: ma_device_start -> %d", (int)r);
        if (r == MA_SUCCESS) {
            audio_ready_after_seek_.store(true, std::memory_order_release);
            diag_pending_first_audible_.store(true, std::memory_order_release);
            logNextGenInfoFixed("audio ungated (ready)");
        } else {
            transport.store(0);
            NGE("ma_device_start failed: %d", (int)r);
        }
    }

    void pause() {
        stopDevice();
        transport.store(2);
        NGD("pause: device stopped, transport=paused");
    }

    void stop() {
        stopDevice();
        std::lock_guard<std::mutex> lock(snapshot_mtx_);
        transport.store(0);
        for (auto& up : stems_) {
            if (!up || !up->decoderOk) continue;
            ma_decoder_seek_to_pcm_frame(&up->decoder, 0);
            up->ended.store(false);
        }
        playhead_frames.store(0);
        audio_ready_after_seek_.store(false, std::memory_order_release);
        diag_pending_first_audible_.store(false, std::memory_order_relaxed);
        NGD("stop: seek 0, transport=stopped");
    }

    void seekSeconds(double seconds) {
        using clock = std::chrono::steady_clock;
        const auto tSeekWallStart = clock::now();
        seek_diag_epoch_ = tSeekWallStart;
        audio_ready_after_seek_.store(false, std::memory_order_release);
        diag_logged_audio_gated_.store(false, std::memory_order_relaxed);
        diag_pending_first_audible_.store(false, std::memory_order_relaxed);

        const int prevTransport = transport.load();

        logNextGenInfoMsgMs("seek start", 0);

        // Stop output device so the audio callback never reads decoders while we reposition.
        // Latency here includes AAudio stop/drain — required so no concurrent ma_decoder_read
        // overlaps ma_decoder_seek_to_pcm_frame (would desync stems).
        stopDevice();

        const auto msAfterStop =
            std::chrono::duration_cast<std::chrono::milliseconds>(clock::now() - tSeekWallStart).count();
        logNextGenInfoMsgMs("seek device stopped", (int64_t)msAfterStop);

        std::lock_guard<std::mutex> lock(snapshot_mtx_);

        for (auto& up : stems_) {
            if (up) up->loggedPartialAfterSeek = false;
        }

        double durationSec = duration_frames / (double)kSampleRate;
        if (seconds < 0.0) seconds = 0.0;
        if (duration_frames > 0 && seconds > durationSec) seconds = durationSec;

        const ma_uint64 frame = (ma_uint64)(seconds * (double)kSampleRate + 0.5);

        // Reposition each stem decoder. Independent decoders → parallel seeks reduce wall time vs
        // sequential (common delay source: MP3/FLAC internal seek + disk).
        std::vector<std::future<void>> seekTasks;
        seekTasks.reserve(stems_.size());
        for (auto& up : stems_) {
            if (!up || !up->decoderOk) continue;
            StemChannel* stem = up.get();
            seekTasks.push_back(std::async(std::launch::async, [stem, frame]() {
                ma_result sr = ma_decoder_seek_to_pcm_frame(&stem->decoder, frame);
                if (sr != MA_SUCCESS) {
                    NGE("seek decoder failed id=%s res=%d", stem->id.c_str(), (int)sr);
                }
                stem->ended.store(false);
            }));
        }
        for (auto& f : seekTasks) {
            f.get();
        }

        playhead_frames.store(frame);
        pitch_st_.clear();
        if constexpr (!kNextGenTempoRealtimeDisabled) {
            tempo_lab_.clear();
        }
        pitch_applied_st_.store(1e6f);
        tempo_applied_.store(1e6f);

        const auto msAfterDecoders =
            std::chrono::duration_cast<std::chrono::milliseconds>(clock::now() - tSeekWallStart).count();
        logNextGenInfoMsgMs("seek decoders repositioned", (int64_t)msAfterDecoders);
        NGD("seek: %.3fs -> frame %llu", seconds, (unsigned long long)frame);

        if (prevTransport == 1 && deviceInitialized) {
            const auto msAboutResume =
                std::chrono::duration_cast<std::chrono::milliseconds>(clock::now() - tSeekWallStart).count();
            logNextGenInfoMsgMs("seek about to resume audio", (int64_t)msAboutResume);
            transport.store(1);
            ma_result r = ma_device_start(&device);
            const auto msResume =
                std::chrono::duration_cast<std::chrono::milliseconds>(clock::now() - tSeekWallStart).count();
            logNextGenInfoMsgMs("seek resume audio", (int64_t)msResume);
            NGD("seek: resume play ma_device_start -> %d", (int)r);
            if (r == MA_SUCCESS) {
                audio_ready_after_seek_.store(true, std::memory_order_release);
                diag_pending_first_audible_.store(true, std::memory_order_release);
                logNextGenInfoFixed("audio ungated (ready)");
            } else {
                transport.store(2);
            }
        } else {
            transport.store(prevTransport);
        }

        const auto msTotal =
            std::chrono::duration_cast<std::chrono::milliseconds>(clock::now() - tSeekWallStart).count();
        logNextGenInfoMsgMs("seek done", (int64_t)msTotal);
    }

    void setTrackVolume(const std::string& id, float volume) {
        if (volume < 0.f) volume = 0.f;
        if (volume > 1.f) volume = 1.f;
        for (auto& up : stems_) {
            if (up && up->id == id) {
                up->volume.store(volume);
                NGD("setTrackVolume %s -> %.3f", id.c_str(), volume);
                return;
            }
        }
    }

    void logSoloRoutingState() {
        bool anySolo = false;
        for (const auto& up : stems_) {
            if (up && up->decoderOk && up->solo.load(std::memory_order_relaxed)) {
                anySolo = true;
                break;
            }
        }
        NGSOLO("[NEXTGEN_SOLO] solo mode active = %s", anySolo ? "true" : "false");
        if (anySolo) {
            for (const auto& up : stems_) {
                if (!up || !up->decoderOk) continue;
                if (!up->solo.load(std::memory_order_relaxed)) {
                    NGMIX("[NEXTGEN_MIX] track suppressed by solo logic %s", up->id.c_str());
                }
            }
        }
    }

    void setTrackMute(const std::string& id, bool muted) {
        for (auto& up : stems_) {
            if (up && up->id == id) {
                up->muted.store(muted);
                NGD("setTrackMute %s -> %d", id.c_str(), muted ? 1 : 0);
                if (muted) {
                    NGMIX("[NEXTGEN_MIX] track suppressed by mute %s", id.c_str());
                }
                return;
            }
        }
    }

    void setTrackSolo(const std::string& id, bool solo) {
        for (auto& up : stems_) {
            if (up && up->id == id) {
                up->solo.store(solo);
                NGSOLO("[NEXTGEN_SOLO] set solo %s=%s", id.c_str(), solo ? "true" : "false");
                logSoloRoutingState();
                return;
            }
        }
    }

    void setPitchSemiTones(float semitones) {
        if (semitones < -3.f) semitones = -3.f;
        if (semitones > 3.f) semitones = 3.f;
        pitch_semitones_.store(semitones);
        NGPITCH("[NEXTGEN_PITCH] set pitch %.2f semitones", semitones);
        if (std::abs(semitones) < 0.01f) {
            pitch_clear_pending_.store(true);
        }
    }

    void setTempoRatio(float ratio) {
        (void)ratio;
        if constexpr (kNextGenTempoRealtimeDisabled) {
            logNextGenTempoDisabledOnce();
            tempo_ratio_.store(1.f);
            tempo_clear_pending_.store(true);
            return;
        }
        if (ratio < kTempoRatioMin) ratio = kTempoRatioMin;
        if (ratio > kTempoRatioMax) ratio = kTempoRatioMax;
        tempo_ratio_.store(ratio);
        NGTEMPO("[NEXTGEN_TEMPO] set tempo ratio %.4f", ratio);
        if (std::abs(ratio - 1.0f) < 0.001f) {
            tempo_clear_pending_.store(true);
        }
    }

    void setMasterVolume(float v) {
        if (v < 0.f) v = 0.f;
        if (v > 1.f) v = 1.f;
        master_volume_.store(v);
        NGD("setMasterVolume %.3f", v);
    }

    void tempoLabSetActive(bool on) {
        (void)on;
        tempo_lab_active_.store(false);
        if constexpr (!kNextGenTempoRealtimeDisabled) {
            tempo_lab_.clear();
        }
    }

    void tempoLabSetRatio(float ratio) {
        (void)ratio;
        if constexpr (kNextGenTempoRealtimeDisabled) {
            return;
        }
        if (ratio < 0.85f) ratio = 0.85f;
        if (ratio > 1.15f) ratio = 1.15f;
        tempo_lab_.setRatio((double)ratio);
    }

    std::string getSnapshotJson() const {
        std::lock_guard<std::mutex> lock(snapshot_mtx_);
        const ma_uint64 pf = playhead_frames.load(std::memory_order_relaxed);
        const double posSec = (double)pf / (double)kSampleRate;
        const double durSec = duration_frames > 0 ? (double)duration_frames / (double)kSampleRate : 0.0;

        const int tr = transport.load(std::memory_order_relaxed);
        const char* stateStr = "stopped";
        if (tr == 1) stateStr = "playing";
        else if (tr == 2) stateStr = "paused";

        std::ostringstream oss;
        oss.setf(std::ios::fixed);
        oss.precision(6);
        oss << "{\"engine\":\"NextGen\",\"transport\":\"" << stateStr << "\",";
        oss << "\"positionSec\":" << posSec << ",\"durationSec\":" << durSec << ",";
        oss << "\"pitchSemiTones\":" << (double)pitch_semitones_.load(std::memory_order_relaxed) << ",";
        oss << "\"tempoRatio\":"
            << (kNextGenTempoRealtimeDisabled ? 1.0 : (double)tempo_ratio_.load(std::memory_order_relaxed))
            << ",";
        oss << "\"masterVolume\":" << (double)master_volume_.load(std::memory_order_relaxed) << ",";
        oss << "\"sampleRate\":" << (int)kSampleRate << ",\"trackCount\":" << stems_.size() << ",";
        oss << "\"tracks\":[";
        for (size_t i = 0; i < stems_.size(); ++i) {
            const auto& t = *stems_[i];
            if (i) oss << ',';
            oss << "{\"id\":\"" << jsonEscape(t.id) << "\",";
            oss << "\"path\":\"" << jsonEscape(t.path) << "\",";
            oss << "\"volume\":" << (double)t.volume.load() << ",\"muted\":" << (t.muted.load() ? "true" : "false");
            oss << ",\"solo\":" << (t.solo.load() ? "true" : "false");
            oss << ",\"ended\":" << (t.ended.load() ? "true" : "false") << "}";
        }
        oss << "]}";
        return oss.str();
    }
};

NextGenMultitrackEngine::NextGenMultitrackEngine() : impl_(std::make_unique<Impl>()) {}

NextGenMultitrackEngine::~NextGenMultitrackEngine() {
    if (!impl_) return;
    impl_->stopDevice();
    std::lock_guard<std::mutex> lock(impl_->snapshot_mtx_);
    impl_->uninitDevice();
    impl_->clearStems();
}

void NextGenMultitrackEngine::loadSongSession(const std::vector<StemDesc>& stems) { impl_->loadSongSession(stems); }

void NextGenMultitrackEngine::play() { impl_->play(); }

void NextGenMultitrackEngine::pause() { impl_->pause(); }

void NextGenMultitrackEngine::stop() { impl_->stop(); }

void NextGenMultitrackEngine::seekSeconds(double seconds) { impl_->seekSeconds(seconds); }

void NextGenMultitrackEngine::setTrackVolume(const std::string& id, float volume) { impl_->setTrackVolume(id, volume); }

void NextGenMultitrackEngine::setTrackMute(const std::string& id, bool muted) { impl_->setTrackMute(id, muted); }

void NextGenMultitrackEngine::setTrackSolo(const std::string& id, bool solo) { impl_->setTrackSolo(id, solo); }

void NextGenMultitrackEngine::setPitchSemiTones(float semitones) { impl_->setPitchSemiTones(semitones); }

void NextGenMultitrackEngine::setTempoRatio(float ratio) { impl_->setTempoRatio(ratio); }

void NextGenMultitrackEngine::setMasterVolume(float volume) { impl_->setMasterVolume(volume); }

void NextGenMultitrackEngine::tempoLabSetActive(bool on) { impl_->tempoLabSetActive(on); }

void NextGenMultitrackEngine::tempoLabSetRatio(float ratio) { impl_->tempoLabSetRatio(ratio); }

std::string NextGenMultitrackEngine::getSnapshotJson() const { return impl_->getSnapshotJson(); }

} // namespace nextgen

// =============================================================================
// JNI — class: com.mixer.app.NextGenMixerPlugin
// =============================================================================

namespace {

nextgen::NextGenMultitrackEngine* gNextGen = nullptr;

} // namespace

extern "C" {

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeInit(JNIEnv*, jobject) {
    if (!gNextGen) {
        gNextGen = new nextgen::NextGenMultitrackEngine();
        NGD("NextGen engine instance created");
    }
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeRelease(JNIEnv*, jobject) {
    delete gNextGen;
    gNextGen = nullptr;
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeLoadSongSession(JNIEnv* env, jobject,
                                                                                    jobjectArray jIds,
                                                                                    jobjectArray jPaths) {
    if (!gNextGen || !jIds || !jPaths) return;
    jsize n = env->GetArrayLength(jPaths);
    jsize nIds = env->GetArrayLength(jIds);
    if (n <= 0 || n != nIds) return;

    std::vector<nextgen::StemDesc> stems;
    stems.reserve((size_t)n);
    for (jsize i = 0; i < n; ++i) {
        jstring jid = (jstring)env->GetObjectArrayElement(jIds, i);
        jstring jpath = (jstring)env->GetObjectArrayElement(jPaths, i);
        const char* cid = env->GetStringUTFChars(jid, nullptr);
        const char* cpath = env->GetStringUTFChars(jpath, nullptr);
        nextgen::StemDesc d;
        d.id = cid ? cid : "";
        d.path = cpath ? cpath : "";
        stems.push_back(std::move(d));
        env->ReleaseStringUTFChars(jpath, cpath);
        env->ReleaseStringUTFChars(jid, cid);
        env->DeleteLocalRef(jpath);
        env->DeleteLocalRef(jid);
    }
    gNextGen->loadSongSession(stems);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativePlay(JNIEnv*, jobject) {
    if (gNextGen) gNextGen->play();
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativePause(JNIEnv*, jobject) {
    if (gNextGen) gNextGen->pause();
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeStop(JNIEnv*, jobject) {
    if (gNextGen) gNextGen->stop();
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSeek(JNIEnv*, jobject, jdouble sec) {
    if (gNextGen) gNextGen->seekSeconds(sec);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSetTrackVolume(JNIEnv* env, jobject, jstring jid,
                                                                                  jfloat vol) {
    if (!gNextGen || !jid) return;
    const char* id = env->GetStringUTFChars(jid, nullptr);
    gNextGen->setTrackVolume(id ? id : "", vol);
    env->ReleaseStringUTFChars(jid, id);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSetTrackMute(JNIEnv* env, jobject, jstring jid,
                                                                                jboolean muted) {
    if (!gNextGen || !jid) return;
    const char* id = env->GetStringUTFChars(jid, nullptr);
    gNextGen->setTrackMute(id ? id : "", muted == JNI_TRUE);
    env->ReleaseStringUTFChars(jid, id);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSetTrackSolo(JNIEnv* env, jobject, jstring jid,
                                                                               jboolean solo) {
    if (!gNextGen || !jid) return;
    const char* id = env->GetStringUTFChars(jid, nullptr);
    gNextGen->setTrackSolo(id ? id : "", solo == JNI_TRUE);
    env->ReleaseStringUTFChars(jid, id);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSetPitchSemiTones(JNIEnv*, jobject, jfloat semitones) {
    if (gNextGen) gNextGen->setPitchSemiTones(semitones);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSetTempoRatio(JNIEnv*, jobject, jfloat ratio) {
    if (gNextGen) gNextGen->setTempoRatio(ratio);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeSetMasterVolume(JNIEnv*, jobject, jfloat volume) {
    if (gNextGen) gNextGen->setMasterVolume(volume);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeTempoLabSetActive(JNIEnv*, jobject, jboolean on) {
    if (gNextGen) gNextGen->tempoLabSetActive(on == JNI_TRUE);
}

JNIEXPORT void JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeTempoLabSetRatio(JNIEnv*, jobject, jfloat ratio) {
    if (gNextGen) gNextGen->tempoLabSetRatio(ratio);
}

JNIEXPORT jstring JNICALL Java_com_mixer_app_NextGenMixerPlugin_nativeGetSnapshotJson(JNIEnv* env, jobject) {
    if (!gNextGen) return env->NewStringUTF("{}");
    std::string j = gNextGen->getSnapshotJson();
    return env->NewStringUTF(j.c_str());
}

} // extern "C"
