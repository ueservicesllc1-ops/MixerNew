#include "DesktopMixSession.h"
#include <cmath>

PositionableResamplingBridge::PositionableResamplingBridge(std::unique_ptr<juce::AudioFormatReaderSource> readerIn,
                                                           int numChannels)
    : reader(std::move(readerIn)),
      resampler(reader.get(), false, numChannels) {}

void PositionableResamplingBridge::prepareToPlay(int samplesPerBlockExpected, double sampleRate) {
    resampler.prepareToPlay(samplesPerBlockExpected, sampleRate);
}

void PositionableResamplingBridge::releaseResources() {
    resampler.releaseResources();
}

void PositionableResamplingBridge::getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) {
    resampler.getNextAudioBlock(bufferToFill);
}

void PositionableResamplingBridge::setNextReadPosition(juce::int64 newPosition) {
    reader->setNextReadPosition(newPosition);
    resampler.flushBuffers();
}

juce::int64 PositionableResamplingBridge::getNextReadPosition() const {
    return reader->getNextReadPosition();
}

juce::int64 PositionableResamplingBridge::getTotalLength() const {
    return reader->getTotalLength();
}

bool PositionableResamplingBridge::isLooping() const {
    return reader->isLooping();
}

void PositionableResamplingBridge::setLooping(bool shouldLoop) {
    reader->setLooping(shouldLoop);
}

static bool classifyGuideStem(const juce::String& name) {
    auto s = name.toLowerCase();
    return s.contains("click") || s.contains("guide") || s.contains("guia") || s.contains("cue");
}

DesktopMixSession::DesktopMixSession() = default;

DesktopMixSession::~DesktopMixSession() {
    clear();
}

void DesktopMixSession::clear() {
    for (auto& s : stemSlots) {
        if (s.transport != nullptr) {
            s.transport->stop();
            s.transport->setSource(nullptr);
        }
        s.musicBridge.reset();
        s.reader.reset();
        s.transport.reset();
    }
    stemSlots.clear();
    lengthInSamples = 0;
    scratch.setSize(0, 0);
}

void DesktopMixSession::setPitchSemitones(float semitones) {
    pitchSemitones = semitones;
    updateMusicResamplingRatios();
    juce::Logger::writeToLog("[PITCH] set semitones " + juce::String(pitchSemitones) + " applied to MusicBus only");
}

void DesktopMixSession::setTempoRatio(float ratio) {
    tempoRatio = juce::jlimit(0.1f, 4.0f, ratio);
    updateMusicResamplingRatios();
    juce::Logger::writeToLog("[TEMPO] set ratio " + juce::String(tempoRatio) + " applied to MusicBus only");
}

void DesktopMixSession::updateMusicResamplingRatios() {
    double r = (double) tempoRatio * std::pow(2.0, (double) pitchSemitones / 12.0);
    r = juce::jlimit(0.25, 4.0, r);
    for (auto& s : stemSlots) {
        if (!s.isGuide && s.musicBridge != nullptr)
            s.musicBridge->getResampler().setResamplingRatio(r);
    }
}

bool DesktopMixSession::loadStems(juce::AudioFormatManager& fm,
                                  const juce::File& stemsRoot,
                                  const std::vector<std::pair<juce::String, juce::String>>& pathAndStemName) {
    clear();

    bool any = false;
    juce::int64 maxLen = 0;

    for (const auto& entry : pathAndStemName) {
        const juce::String& p = entry.first;
        const juce::String& stemNameIn = entry.second;
        if (p.isEmpty()) continue;

        juce::File file(juce::File::isAbsolutePath(p) ? juce::File(p) : stemsRoot.getChildFile(p));

        if (!file.existsAsFile()) {
            juce::Logger::writeToLog("DesktopMixSession: missing file " + file.getFullPathName());
            continue;
        }

        juce::AudioFormatReader* raw = fm.createReaderFor(file);
        if (raw == nullptr) {
            juce::Logger::writeToLog("DesktopMixSession: cannot read " + file.getFullPathName());
            continue;
        }

        auto frs = std::make_unique<juce::AudioFormatReaderSource>(raw, true);
        const juce::int64 len = frs->getTotalLength();
        maxLen = juce::jmax(maxLen, len);

        const int nCh = juce::jmax(1, (int) raw->numChannels);
        const double readerSr = raw->sampleRate;

        juce::String stemLabel = stemNameIn.isNotEmpty() ? stemNameIn : file.getFileNameWithoutExtension();
        const bool guide = classifyGuideStem(stemLabel);

        StemSlot slot;
        slot.isGuide = guide;
        slot.logName = stemLabel;
        slot.numChannels = nCh;
        slot.reader = std::move(frs);

        juce::AudioFormatReaderSource* readerPtr = slot.reader.get();
        slot.transport = std::make_unique<juce::AudioTransportSource>();

        if (guide) {
            slot.transport->setSource(readerPtr, 0, nullptr, readerSr);
            juce::Logger::writeToLog("[AUDIO ROUTING] track " + stemLabel + " -> GuideBus LEFT DRY");
        } else {
            slot.musicBridge = std::make_unique<PositionableResamplingBridge>(std::move(slot.reader), nCh);
            slot.transport->setSource(slot.musicBridge.get(), 0, nullptr, readerSr);
            juce::Logger::writeToLog("[AUDIO ROUTING] track " + stemLabel + " -> MusicBus RIGHT PROCESSED");
        }

        stemSlots.push_back(std::move(slot));
        any = true;
    }

    lengthInSamples = maxLen;
    updateMusicResamplingRatios();
    return any;
}

void DesktopMixSession::setStemsPlaying(bool shouldPlay) {
    for (auto& s : stemSlots) {
        if (s.transport == nullptr) continue;
        if (shouldPlay)
            s.transport->start();
        else
            s.transport->stop();
    }
}

void DesktopMixSession::prepareToPlay(int samplesPerBlockExpected, double sampleRate) {
    hostSampleRate = sampleRate > 0 ? sampleRate : 44100.0;

    int maxCh = 2;
    for (auto& s : stemSlots)
        maxCh = juce::jmax(maxCh, s.numChannels);
    scratch.setSize(maxCh, samplesPerBlockExpected);

    for (auto& s : stemSlots) {
        if (s.transport != nullptr)
            s.transport->prepareToPlay(samplesPerBlockExpected, hostSampleRate);
    }
    updateMusicResamplingRatios();
}

void DesktopMixSession::releaseResources() {
    for (auto& s : stemSlots) {
        if (s.transport != nullptr)
            s.transport->releaseResources();
    }
    scratch.setSize(0, 0);
}

void DesktopMixSession::getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) {
    if (bufferToFill.buffer == nullptr) return;

    bufferToFill.clearActiveBufferRegion();

    const int nSamp = bufferToFill.numSamples;
    const int start = bufferToFill.startSample;
    float* outL = bufferToFill.buffer->getWritePointer(0, start);
    const int outChannels = bufferToFill.buffer->getNumChannels();
    float* outR = outChannels > 1 ? bufferToFill.buffer->getWritePointer(1, start) : outL;

    for (auto& s : stemSlots) {
        if (s.transport == nullptr) continue;

        const int useCh = juce::jmax(1, juce::jmin(s.numChannels, scratch.getNumChannels()));
        scratch.clear();
        juce::AudioSourceChannelInfo info(&scratch, 0, nSamp);
        s.transport->getNextAudioBlock(info);

        if (s.isGuide) {
            for (int i = 0; i < nSamp; ++i) {
                float sum = 0.f;
                for (int c = 0; c < useCh; ++c)
                    sum += scratch.getSample(c, i);
                outL[i] += sum / (float) useCh;
            }
        } else {
            for (int i = 0; i < nSamp; ++i) {
                float sum = 0.f;
                for (int c = 0; c < useCh; ++c)
                    sum += scratch.getSample(c, i);
                outR[i] += sum / (float) useCh;
            }
        }
    }
}

void DesktopMixSession::setNextReadPosition(juce::int64 newPosition) {
    const double sec = hostSampleRate > 0 ? (double) newPosition / hostSampleRate : 0.0;
    for (auto& s : stemSlots)
        if (s.transport != nullptr)
            s.transport->setPosition(sec);
}

juce::int64 DesktopMixSession::getNextReadPosition() const {
    if (stemSlots.empty() || hostSampleRate <= 0 || stemSlots[0].transport == nullptr) return 0;
    return (juce::int64)(stemSlots[0].transport->getCurrentPosition() * hostSampleRate);
}

juce::int64 DesktopMixSession::getTotalLength() const {
    return lengthInSamples;
}
