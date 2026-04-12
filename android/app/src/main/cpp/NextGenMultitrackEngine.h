// NextGen multitrack engine — isolated from legacy MultitrackEngine (MixerNativeEngine.cpp).
// Phase 2: miniaudio ma_decoder per stem, single ma_device playback callback, native mix.

#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace nextgen {

enum class TransportState {
    Stopped,
    Playing,
    Paused,
};

struct StemDesc {
    std::string id;
    std::string path; // local filesystem path (absolute)
    float volume = 1.0f;
    bool muted = false;
};

class NextGenMultitrackEngine {
public:
    static constexpr int kDefaultSampleRate = 44100;

    NextGenMultitrackEngine();
    ~NextGenMultitrackEngine();

    NextGenMultitrackEngine(const NextGenMultitrackEngine&) = delete;
    NextGenMultitrackEngine& operator=(const NextGenMultitrackEngine&) = delete;

    void loadSongSession(const std::vector<StemDesc>& stems);

    void play();
    void pause();
    void stop();

    void seekSeconds(double seconds);

    void setTrackVolume(const std::string& id, float volume);
    void setTrackMute(const std::string& id, bool muted);

    std::string getSnapshotJson() const;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace nextgen
