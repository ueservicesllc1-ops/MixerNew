// Isolated experimental tempo-time-stretch path (NextGen). Not used unless explicitly activated.
// Pipeline when active: mixed buffer → SoundTouch (tempo only, pitch fixed) → output.

#pragma once

#include <cstdint>
#include <memory>

namespace nextgen {

class TempoLabProcessor {
public:
    static constexpr int kDefaultSampleRate = 44100;
    static constexpr uint32_t kDefaultChannels = 2;

    TempoLabProcessor();
    ~TempoLabProcessor();

    TempoLabProcessor(const TempoLabProcessor&) = delete;
    TempoLabProcessor& operator=(const TempoLabProcessor&) = delete;

    void init(int sampleRate, uint32_t channels);
    void clear();

    /** Clamped internally; logs [TEMPO_LAB] set ratio X */
    void setRatio(double ratio);

    /**
     * Interleaved stereo float in/out. When ratio≈1, passes through (no SoundTouch processing).
     * Logs frames in/out and whether processed output was used.
     */
    void processInterleaved(float* io, uint32_t frameCount);

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace nextgen
