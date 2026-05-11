/**
 * ZionEngine.cpp
 * Real C++ audio engine for Zion WebAssembly target.
 * No JUCE dependency — pure C++ audio DSP.
 * 
 * Architecture:
 * - JS decodes audio (Web Audio decodeAudioData) → gets PCM float arrays
 * - JS sends PCM to WASM via loadTrackData()
 * - ScriptProcessorNode calls processBlock() each audio frame
 * - C++ mixes all tracks with volume/mute/solo → fills output buffer
 */

#include <emscripten/bind.h>
#include <vector>
#include <map>
#include <string>
#include <cmath>
#include <algorithm>
#include <memory>
#include <sstream>
#include <iomanip>

using namespace emscripten;

namespace {

constexpr float kVuSmooth = 0.8f;   // smoothed = smoothed * kVuSmooth + instant * (1 - kVuSmooth)
constexpr float kVuMuteDecay = 0.85f;

static std::string floatToJson(float v) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(4) << v;
    return o.str();
}

static std::string jsonEscapeTrackId(const std::string& id) {
    std::string o;
    o.reserve(id.size() + 8);
    for (char c : id) {
        if (c == '"' || c == '\\') o += '\\';
        o += c;
    }
    return o;
}

} // namespace

struct Track {
    std::vector<float> samplesL;
    std::vector<float> samplesR;
    float volume   = 1.0f;
    bool  muted    = false;
    bool  solo     = false;
    bool  loaded   = false;
    bool  isGuide  = false;
    /** Smoothed per-block peak / RMS of post-fader samples (respects mute/solo). */
    float smoothedPeak = 0.0f;
    float smoothedRms  = 0.0f;
};

class ZionEngine {
public:
    double   sampleRate    = 44100.0;
    bool     playing       = false;
    double   playPosition  = 0.0;  // float for sub-sample accuracy
    float    masterVolume  = 1.0f;
    float    tempoRatio    = 1.0f;
    
    std::map<std::string, Track> tracks;
    std::vector<float> outputBuffer;  // pre-allocated output

    // ---------- Lifecycle ----------
    void init(double sr) {
        sampleRate    = sr > 0 ? sr : 44100.0;
        playing       = false;
        playPosition  = 0.0;
        masterVolume  = 1.0f;
        tempoRatio    = 1.0f;
        tracks.clear();
        outputBuffer.resize(4096 * 4, 0.0f);
    }

    // ---------- Track loading ----------
    // Called from JS after decoding audio. Receives pointers into JS TypedArrays
    // copied into WASM memory using HEAPF32.set().
    void loadTrackData(std::string id, uintptr_t ptrL, uintptr_t ptrR, int length) {
        if (length <= 0) return;
        const float* dataL = reinterpret_cast<const float*>(ptrL);
        const float* dataR = reinterpret_cast<const float*>(ptrR);
        Track& t   = tracks[id];
        t.samplesL.assign(dataL, dataL + length);
        t.samplesR.assign(dataR, dataR + length);
        t.loaded   = true;
    }

    void removeTrack(std::string id) {
        tracks.erase(id);
    }

    void   clearTracks()         { tracks.clear(); playPosition = 0.0; playing = false; }

    // ---------- Transport ----------
    void   play()                { playing = true; }
    void   pause()               { playing = false; }
    void   stop()                { playing = false; playPosition = 0.0; }
    void   seek(double seconds)  { playPosition = seconds * sampleRate; }
    double getCurrentPosition()  { return playPosition / sampleRate; }
    bool   getIsPlaying()        { return playing; }

    // ---------- Volume / Mute / Solo / Tempo ----------
    void setTempoRatio(float t)                   { tempoRatio = std::max(0.1f, std::min(4.0f, t)); }
    void setMasterVolume(float vol)               { masterVolume = std::max(0.0f, std::min(2.0f, vol)); }
    void setTrackVolume(std::string id, float vol){ if (tracks.count(id)) tracks[id].volume = std::max(0.0f, std::min(2.0f, vol)); }
    void setTrackMute(std::string id, bool muted) { if (tracks.count(id)) tracks[id].muted = muted; }
    void setTrackSolo(std::string id, bool solo)  { if (tracks.count(id)) tracks[id].solo = solo; }
    void setTrackIsGuide(std::string id, bool g)  { if (tracks.count(id)) tracks[id].isGuide = g; }

    double getDuration() {
        double maxDur = 0.0;
        for (auto& kv : tracks) {
            double dur = static_cast<double>(kv.second.samplesL.size()) / sampleRate;
            if (dur > maxDur) maxDur = dur;
        }
        return maxDur;
    }

    float getTrackMeterPeak(const std::string& id) const {
        auto it = tracks.find(id);
        if (it == tracks.end() || !it->second.loaded) return 0.0f;
        return it->second.smoothedPeak;
    }

    float getTrackMeterRms(const std::string& id) const {
        auto it = tracks.find(id);
        if (it == tracks.end() || !it->second.loaded) return 0.0f;
        return it->second.smoothedRms;
    }

    std::string getTrackLevelsJson() const {
        std::string j = "[";
        bool first = true;
        for (const auto& kv : tracks) {
            if (!kv.second.loaded) continue;
            if (!first) j += ",";
            first = false;
            j += "{\"trackId\":\"" + jsonEscapeTrackId(kv.first) + "\",\"peak\":" + floatToJson(kv.second.smoothedPeak)
               + ",\"rms\":" + floatToJson(kv.second.smoothedRms) + "}";
        }
        j += "]";
        return j;
    }

    // ---------- Audio processing ----------
    // Called by JS ScriptProcessorNode every audio block.
    // Returns pointer to output buffer (4 interleaved floats: MusicL, MusicR, GuideL, GuideR).
    uintptr_t processBlock(int frames) {
        // Resize output buffer if needed
        if (static_cast<int>(outputBuffer.size()) < frames * 4) {
            outputBuffer.resize(frames * 4);
        }
        // Clear output
        std::fill(outputBuffer.begin(), outputBuffer.begin() + frames * 4, 0.0f);

        // Detect any solo track (same rule as mix: muted or non-solo when any solo → no audio)
        bool anySolo = false;
        for (auto& kv : tracks) {
            if (kv.second.solo) { anySolo = true; break; }
        }

        if (!playing) {
            for (auto& kv : tracks) {
                kv.second.smoothedPeak *= 0.92f;
                kv.second.smoothedRms *= 0.92f;
            }
            return reinterpret_cast<uintptr_t>(outputBuffer.data());
        }

        // Mix all tracks + real per-track VU (post-fader, pre-bus; obeys mute/solo)
        for (auto& kv : tracks) {
            Track& t = kv.second;
            if (!t.loaded) continue;

            bool effectiveMute = t.muted || (anySolo && !t.solo);
            float vol = t.volume * masterVolume;
            long long trackLen = static_cast<long long>(t.samplesL.size());

            if (effectiveMute) {
                t.smoothedPeak = t.smoothedPeak * kVuMuteDecay;
                t.smoothedRms = t.smoothedRms * kVuMuteDecay;
                continue;
            }

            float blockPeak = 0.0f;
            double sumSq = 0.0;
            int nSamp = 0;

            for (int i = 0; i < frames; i++) {
                double exactPos = playPosition + (i * tempoRatio);
                long long posInt = static_cast<long long>(exactPos);
                double frac = exactPos - posInt;

                if (posInt >= 0 && posInt < trackLen - 1) {
                    float sL = t.samplesL[posInt] + frac * (t.samplesL[posInt + 1] - t.samplesL[posInt]);
                    float sR = t.samplesR[posInt] + frac * (t.samplesR[posInt + 1] - t.samplesR[posInt]);

                    float mono = 0.5f * (std::fabs(sL) + std::fabs(sR));
                    float lev = mono * vol;
                    blockPeak = std::max(blockPeak, lev);
                    sumSq += static_cast<double>(lev) * static_cast<double>(lev);
                    nSamp++;

                    if (t.isGuide) {
                        outputBuffer[i * 4 + 2] += sL * vol;
                        outputBuffer[i * 4 + 3] += sR * vol;
                    } else {
                        outputBuffer[i * 4]     += sL * vol;
                        outputBuffer[i * 4 + 1] += sR * vol;
                    }
                }
            }

            if (nSamp > 0) {
                float rms = static_cast<float>(std::sqrt(sumSq / static_cast<double>(nSamp)));
                t.smoothedPeak = t.smoothedPeak * kVuSmooth + blockPeak * (1.0f - kVuSmooth);
                t.smoothedRms = t.smoothedRms * kVuSmooth + rms * (1.0f - kVuSmooth);
            } else {
                t.smoothedPeak *= 0.9f;
                t.smoothedRms *= 0.9f;
            }
        }

        // Soft limiter (-1..+1 with gentle saturation)
        for (int i = 0; i < frames * 4; i++) {
            float s = outputBuffer[i];
            outputBuffer[i] = tanhf(s * 0.9f);
        }

        // Advance position
        playPosition += (frames * tempoRatio);

        // Auto-stop at end
        double dur = getDuration();
        if (dur > 0 && getCurrentPosition() >= dur) {
            playing      = false;
            playPosition = 0.0;
        }

        return reinterpret_cast<uintptr_t>(outputBuffer.data());
    }

    // Allocate scratch space in WASM heap for JS to write PCM data into
    // before calling loadTrackData. Returns pointer to allocated buffer.
    uintptr_t allocateBuffer(int floatCount) {
        scratchBuffer.resize(floatCount);
        std::fill(scratchBuffer.begin(), scratchBuffer.end(), 0.0f);
        return reinterpret_cast<uintptr_t>(scratchBuffer.data());
    }

private:
    std::vector<float> scratchBuffer;
};

// ---- Global singleton ----
static ZionEngine g_engine;

EMSCRIPTEN_BINDINGS(zion_audio_core) {
    function("initEngine",            optional_override([](double sr) { g_engine.init(sr); }));
    function("play",                  optional_override([]() { g_engine.play(); }));
    function("pause",                 optional_override([]() { g_engine.pause(); }));
    function("stop",                  optional_override([]() { g_engine.stop(); }));
    function("seek",                  optional_override([](double s) { g_engine.seek(s); }));
    function("getCurrentPosition",    optional_override([]() { return g_engine.getCurrentPosition(); }));
    function("isPlaying",             optional_override([]() { return g_engine.getIsPlaying(); }));
    function("setVolume",             optional_override([](float v) { g_engine.setMasterVolume(v); }));
    function("setTempoRatio",         optional_override([](float t) { g_engine.setTempoRatio(t); }));
    function("setTrackVolume",        optional_override([](std::string id, float v) { g_engine.setTrackVolume(id, v); }));
    function("setTrackMute",          optional_override([](std::string id, bool m) { g_engine.setTrackMute(id, m); }));
    function("setTrackSolo",          optional_override([](std::string id, bool s) { g_engine.setTrackSolo(id, s); }));
    function("setTrackIsGuide",       optional_override([](std::string id, bool g) { g_engine.setTrackIsGuide(id, g); }));
    function("getDuration",           optional_override([]() { return g_engine.getDuration(); }));
    function("removeTrack",           optional_override([](std::string id) { g_engine.removeTrack(id); }));
    function("clearTracks",           optional_override([]() { g_engine.clearTracks(); }));
    function("loadTrackData",         optional_override([](std::string id, uintptr_t pL, uintptr_t pR, int len) {
                                          g_engine.loadTrackData(id, pL, pR, len);
                                      }));
    function("processBlock",          optional_override([](int frames) { return g_engine.processBlock(frames); }));
    function("allocateBuffer",        optional_override([](int count) { return g_engine.allocateBuffer(count); }));
    function("getTrackMeterPeak",     optional_override([](std::string id) { return g_engine.getTrackMeterPeak(id); }));
    function("getTrackMeterRms",      optional_override([](std::string id) { return g_engine.getTrackMeterRms(id); }));
    function("getTrackLevelsJson",    optional_override([]() { return g_engine.getTrackLevelsJson(); }));
}
