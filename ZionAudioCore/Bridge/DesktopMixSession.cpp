#include "DesktopMixSession.h"
#include <cmath>

// --- PositionableSoundTouchBridge ---

PositionableSoundTouchBridge::PositionableSoundTouchBridge(std::unique_ptr<juce::AudioFormatReaderSource> readerIn,
                                                           int numChannelsIn,
                                                           double sourceRateIn)
    : reader(std::move(readerIn)),
      sourceSampleRate(sourceRateIn > 0 ? sourceRateIn : 44100.0),
      numChannels(juce::jmax(1, numChannelsIn)) {}

void PositionableSoundTouchBridge::configureStretch() {
    stretch.setSampleRate((uint) juce::jlimit(8000.0, 192000.0, sourceSampleRate));
    stretch.setChannels((uint) numChannels);
    // virtualRate = 1: no control global "rate" (eso sería tempo+pitch a la vez).
    stretch.setRate(1.0);
    stretch.setTempo(juce::jlimit(0.5, 1.5, tempoRatio));
    stretch.setPitchSemiTones(pitchSemitones);
}

void PositionableSoundTouchBridge::prepareToPlay(int samplesPerBlockExpected, double sampleRate) {
    hostSampleRate = sampleRate > 0 ? sampleRate : 44100.0;
    blockSize = juce::jmax(256, samplesPerBlockExpected);
    readerPull.setSize(numChannels, blockSize);
    readerInterleaved.resize((size_t) blockSize * (size_t) numChannels);
    configureStretch();
    prepared = true;
}

void PositionableSoundTouchBridge::releaseResources() {
    prepared = false;
    readerPull.setSize(0, 0);
    interleavedOut.clear();
    readerInterleaved.clear();
    stretch.clear();
}

void PositionableSoundTouchBridge::setTempoRatio(double ratio) {
    tempoRatio = juce::jlimit(0.5, 1.5, ratio);
    if (prepared)
        configureStretch();
}

void PositionableSoundTouchBridge::setPitchSemitones(double semitones) {
    pitchSemitones = juce::jlimit(-12.0, 12.0, semitones);
    if (prepared)
        configureStretch();
}

void PositionableSoundTouchBridge::pullFromReader(int frames) {
    if (reader == nullptr || frames <= 0) return;
    readerPull.clear();
    juce::AudioSourceChannelInfo pull(&readerPull, 0, frames);
    reader->getNextAudioBlock(pull);
}

void PositionableSoundTouchBridge::getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) {
    if (!prepared || bufferToFill.buffer == nullptr || reader == nullptr) return;

    const int ch = numChannels;
    const int framesOut = bufferToFill.numSamples;
    if (framesOut <= 0) return;

    bufferToFill.clearActiveBufferRegion();

    interleavedOut.resize((size_t) framesOut * (size_t) ch);

    int produced = 0;
    bool flushed = false;
    int safety = 0;

    while (produced < framesOut && safety < 4096) {
        ++safety;
        const uint maxFrames = (uint)(framesOut - produced);
        const uint got = stretch.receiveSamples(interleavedOut.data() + (size_t) produced * (size_t) ch, maxFrames);
        if (got > 0) {
            produced += (int) got;
            continue;
        }

        const bool atEnd =
            (!reader->isLooping() && reader->getTotalLength() > 0
             && reader->getNextReadPosition() >= reader->getTotalLength());
        if (atEnd && !flushed) {
            stretch.flush();
            flushed = true;
            continue;
        }
        if (atEnd && flushed) break;

        const int pull = juce::jmin(blockSize, juce::jmax(framesOut, 256));
        pullFromReader(pull);
        for (int i = 0; i < pull; ++i)
            for (int c = 0; c < ch; ++c)
                readerInterleaved[(size_t) i * (size_t) ch + (size_t) c] = readerPull.getSample(c, i);
        stretch.putSamples(readerInterleaved.data(), (uint) pull);
    }

    for (int i = 0; i < produced; ++i)
        for (int c = 0; c < ch; ++c)
            bufferToFill.buffer->addSample(c, bufferToFill.startSample + i,
                                           interleavedOut[(size_t) i * (size_t) ch + (size_t) c]);
}

void PositionableSoundTouchBridge::setNextReadPosition(juce::int64 newPosition) {
    if (reader == nullptr) return;
    const double tr = juce::jmax(0.5, juce::jmin(1.5, tempoRatio));
    const juce::int64 inPos = (juce::int64) std::llround((double) newPosition * tr);
    reader->setNextReadPosition(juce::jlimit((juce::int64) 0, reader->getTotalLength(), inPos));
    stretch.clear();
    configureStretch();
}

juce::int64 PositionableSoundTouchBridge::getNextReadPosition() const {
    if (reader == nullptr) return 0;
    const double tr = juce::jmax(0.5, juce::jmin(1.5, tempoRatio));
    return (juce::int64) std::llround((double) reader->getNextReadPosition() / tr);
}

juce::int64 PositionableSoundTouchBridge::getTotalLength() const {
    if (reader == nullptr) return 0;
    const double tr = juce::jmax(0.5, juce::jmin(1.5, tempoRatio));
    return (juce::int64) std::llround((double) reader->getTotalLength() / tr);
}

bool PositionableSoundTouchBridge::isLooping() const {
    return reader != nullptr && reader->isLooping();
}

void PositionableSoundTouchBridge::setLooping(bool shouldLoop) {
    if (reader != nullptr) reader->setLooping(shouldLoop);
}

// --- DesktopMixSession ---

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
    pitchSemitones = (double) juce::jlimit(-12.0f, 12.0f, semitones);
    const double pitchRatio = std::pow(2.0, pitchSemitones / 12.0);
    juce::Logger::writeToLog("[PITCH] requested semitones: " + juce::String(pitchSemitones, 2));
    juce::Logger::writeToLog("[PITCH] pitchRatio: " + juce::String(pitchRatio, 6));
    juce::Logger::writeToLog("[PITCH] applied only to MusicBus");
    juce::Logger::writeToLog("[PITCH] GuideBus bypassed");
    juce::Logger::writeToLog("[PITCH] Click/Guide remain original");
    updateMusicSoundTouchParams();
}

void DesktopMixSession::setTempoRatio(float ratio) {
    juce::Logger::writeToLog("[TEMPO] requested ratio: " + juce::String(ratio, 4));
    juce::Logger::writeToLog("[TEMPO] using time-stretch pitch-preserving mode");
    juce::Logger::writeToLog("[TEMPO] applied only to MusicBus");
    juce::Logger::writeToLog("[TEMPO] GuideBus bypassed");
    tempoRatio = (double) juce::jlimit(0.5f, 1.5f, ratio);
    updateMusicSoundTouchParams();
}

void DesktopMixSession::updateMusicSoundTouchParams() {
    for (auto& s : stemSlots) {
        if (!s.isGuide && s.musicBridge != nullptr) {
            s.musicBridge->setTempoRatio(tempoRatio);
            s.musicBridge->setPitchSemitones(pitchSemitones);
        }
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
            slot.musicBridge = std::make_unique<PositionableSoundTouchBridge>(std::move(slot.reader), nCh, readerSr);
            slot.transport->setSource(slot.musicBridge.get(), 0, nullptr, readerSr);
            juce::Logger::writeToLog("[AUDIO ROUTING] track " + stemLabel + " -> MusicBus RIGHT (SoundTouch tempo)");
        }

        stemSlots.push_back(std::move(slot));
        any = true;
    }

    lengthInSamples = maxLen;
    updateMusicSoundTouchParams();
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
    updateMusicSoundTouchParams();
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
