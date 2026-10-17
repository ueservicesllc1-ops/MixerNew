#include "NextGenTempoLab.h"

#include "SoundTouch.h"
#include <android/log.h>
#include <cmath>
#include <cstring>
#include <memory>

#define TL(...) __android_log_print(ANDROID_LOG_INFO, "TEMPO_LAB", __VA_ARGS__)

namespace nextgen {

namespace {
constexpr double kRatioMin = 0.85;
constexpr double kRatioMax = 1.15;
constexpr double kBypassEps = 1e-6;
} // namespace

struct TempoLabProcessor::Impl {
    soundtouch::SoundTouch st{};
    int sample_rate = TempoLabProcessor::kDefaultSampleRate;
    uint32_t channels = TempoLabProcessor::kDefaultChannels;
    double ratio = 1.0;
    bool inited = false;

    void configureEngine() {
        st.setSampleRate(sample_rate);
        st.setChannels((int)channels);
        st.setPitchSemiTones(0.0);
        st.setTempo(ratio);
    }
};

TempoLabProcessor::TempoLabProcessor() : impl_(std::make_unique<Impl>()) {}

TempoLabProcessor::~TempoLabProcessor() = default;

void TempoLabProcessor::init(int sampleRate, uint32_t channels) {
    if (sampleRate < 8000) sampleRate = kDefaultSampleRate;
    if (channels < 1 || channels > 2) channels = kDefaultChannels;
    impl_->sample_rate = sampleRate;
    impl_->channels = channels;
    impl_->st.clear();
    impl_->configureEngine();
    impl_->inited = true;
}

void TempoLabProcessor::clear() {
    impl_->st.clear();
}

void TempoLabProcessor::setRatio(double ratio) {
    if (ratio < kRatioMin) ratio = kRatioMin;
    if (ratio > kRatioMax) ratio = kRatioMax;
    impl_->ratio = ratio;
    TL("[TEMPO_LAB] set ratio %.4f", ratio);
    if (!impl_->inited) return;
    impl_->st.setPitchSemiTones(0.0);
    impl_->st.setTempo(ratio);
}

void TempoLabProcessor::processInterleaved(float* io, uint32_t frameCount) {
    if (!io || frameCount == 0 || !impl_->inited) return;

    const uint32_t ch = impl_->channels;
    TL("[TEMPO_LAB] frames in %u", (unsigned)frameCount);

    if (std::abs(impl_->ratio - 1.0) < kBypassEps) {
        TL("[TEMPO_LAB] bypass ratio 1.0 (identity)");
        TL("[TEMPO_LAB] frames out %u", (unsigned)frameCount);
        TL("[TEMPO_LAB] using processed output (pass-through)");
        return;
    }

    impl_->st.setPitchSemiTones(0.0);
    impl_->st.setTempo(impl_->ratio);

    impl_->st.putSamples(io, frameCount);

    uint32_t got = 0;
    while (got < frameCount) {
        const uint32_t n = impl_->st.receiveSamples(io + (size_t)got * ch, frameCount - got);
        if (n == 0) {
            TL("[TEMPO_LAB] no frames returned (need %u, have %u)", (unsigned)(frameCount - got),
               (unsigned)got);
            break;
        }
        got += n;
    }

    TL("[TEMPO_LAB] frames out %u", (unsigned)got);

    if (got > 0) {
        TL("[TEMPO_LAB] using processed output");
    }

    if (got < frameCount) {
        std::memset(io + (size_t)got * ch, 0, (size_t)(frameCount - got) * ch * sizeof(float));
    }

    const size_t samples = (size_t)frameCount * ch;
    for (size_t i = 0; i < samples; ++i) {
        float x = io[i];
        if (x > 1.f) x = 1.f;
        else if (x < -1.f) x = -1.f;
        io[i] = x;
    }
}

} // namespace nextgen
