#include "DesktopMixSession.h"
#include <cmath>
#include <iostream>

static void NativeLog(const juce::String& msg) {
    juce::Logger::writeToLog(msg);
    std::cerr << msg << std::endl;
}

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
    if (reader != nullptr)
        reader->prepareToPlay(samplesPerBlockExpected, hostSampleRate);
    configureStretch();
    prepared = true;
}

void PositionableSoundTouchBridge::releaseResources() {
    prepared = false;
    if (reader != nullptr)
        reader->releaseResources();
    readerPull.setSize(0, 0);
    interleavedOut.clear();
    readerInterleaved.clear();
    stretch.clear();
}

void PositionableSoundTouchBridge::setTempoRatio(double ratio) {
    const double next = juce::jlimit(0.5, 1.5, ratio);
    if (prepared && std::abs(next - tempoRatio) > 1.0e-6)
        stretch.clear();
    tempoRatio = next;
    if (prepared)
        configureStretch();
}

void PositionableSoundTouchBridge::setPitchSemitones(double semitones) {
    const double next = juce::jlimit(-12.0, 12.0, semitones);
    if (prepared && std::abs(next - pitchSemitones) > 1.0e-6)
        stretch.clear();
    pitchSemitones = next;
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

    // Siempre pasar por SoundTouch para stems de música (incluso tono/tempo nominal).
    // Un atajo "neutral" que leía directo del reader cambiaba la latencia y el consumo del
    // buffer al volver de ±semitonos a 0 → click/guías (sin ST) y stems quedaban desfasados.
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
static bool classifyClickStem(const juce::String& name) {
    return name.toLowerCase().contains("click");
}

// Transparent desktop mix gains (no auto normalization/compression).
constexpr float kMusicBusGain = 1.0f;
constexpr float kGuideBusGain = 1.0f;
constexpr float kClickBusGain = 0.90f;
constexpr float kMasterTrim = 0.92f;

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

void DesktopMixSession::resyncTransportsToGuide() {
    juce::AudioTransportSource* ref = nullptr;
    for (auto& s : stemSlots) {
        if (s.isGuide && s.transport != nullptr) {
            ref = s.transport.get();
            break;
        }
    }
    if (ref == nullptr) {
        for (auto& s : stemSlots) {
            if (s.transport != nullptr) {
                ref = s.transport.get();
                break;
            }
        }
    }
    if (ref == nullptr) return;
    const double t = ref->getCurrentPosition();
    for (auto& s : stemSlots) {
        if (s.transport == nullptr) continue;
        if (s.transport.get() == ref) continue;
        s.transport->setPosition(t);
    }
}

void DesktopMixSession::setPitchSemitones(float semitones) {
    const double prevPitch = pitchSemitones;
    pitchSemitones = (double) juce::jlimit(-12.0f, 12.0f, semitones);
    const double pitchRatio = std::pow(2.0, pitchSemitones / 12.0);
    juce::Logger::writeToLog("[PITCH] requested semitones: " + juce::String(pitchSemitones, 2));
    juce::Logger::writeToLog("[PITCH] pitchRatio: " + juce::String(pitchRatio, 6));
    juce::Logger::writeToLog("[PITCH] applied only to MusicBus");
    juce::Logger::writeToLog("[PITCH] GuideBus bypassed");
    juce::Logger::writeToLog("[PITCH] Click/Guide remain original");
    updateMusicSoundTouchParams();
    // SoundTouch deja cola desalineada vs. click (sin ST); al volver a 0 alineamos reloj de todos los transports.
    if (std::abs(prevPitch) >= 1.0e-3 && std::abs(pitchSemitones) < 1.0e-3)
        resyncTransportsToGuide();
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

juce::String DesktopMixSession::getTrackLevelsCsv() const {
    juce::String out;
    for (const auto& s : stemSlots) {
        const juce::String key = s.clientTrackId.isNotEmpty() ? s.clientTrackId : s.logName;
        if (key.isEmpty()) continue;
        if (out.isNotEmpty()) out << ',';
        out << key << ':' << juce::String(s.lastMeterLevel, 5);
    }
    return out;
}

DesktopMixSession::StemSlot* DesktopMixSession::findStemForClientId(const juce::String& id) {
    if (id.isEmpty()) return nullptr;
    for (auto& s : stemSlots) {
        if (s.clientTrackId.isNotEmpty() && s.clientTrackId == id) return &s;
    }
    for (auto& s : stemSlots) {
        if (s.logName == id) return &s;
    }
    return nullptr;
}

void DesktopMixSession::setTrackVolumeForClientId(const juce::String& clientTrackId, float linearGain) {
    auto* s = findStemForClientId(clientTrackId);
    if (s == nullptr) return;
    s->gain = juce::jlimit(0.0f, 4.0f, linearGain);
}

void DesktopMixSession::setTrackMutedForClientId(const juce::String& clientTrackId, bool muted) {
    auto* s = findStemForClientId(clientTrackId);
    if (s == nullptr) return;
    s->muted = muted;
}

void DesktopMixSession::setTrackSoloForClientId(const juce::String& clientTrackId, bool solo) {
    auto* s = findStemForClientId(clientTrackId);
    if (s == nullptr) return;
    s->solo = solo;
}

bool DesktopMixSession::loadStems(juce::AudioFormatManager& fm,
                                  const juce::File& stemsRoot,
                                  const std::vector<DesktopStemLoadSpec>& specs) {
    clear();

    bool any = false;
    juce::int64 maxLen = 0;

    for (const auto& spec : specs) {
        const juce::String& p = spec.path;
        const juce::String& stemNameIn = spec.stemNameHint;
        if (p.isEmpty()) continue;

        juce::File file(juce::File::isAbsolutePath(p) ? juce::File(p) : stemsRoot.getChildFile(p));

        if (!file.existsAsFile()) {
        NativeLog("DesktopMixSession: missing file " + file.getFullPathName());
            continue;
        }

        juce::AudioFormatReader* raw = fm.createReaderFor(file);
        if (raw == nullptr) {
            NativeLog("DesktopMixSession: cannot read " + file.getFullPathName());
            continue;
        }
        NativeLog("[JUCE] opened reader: " + file.getFullPathName());

        auto frs = std::make_unique<juce::AudioFormatReaderSource>(raw, true);
        const juce::int64 len = frs->getTotalLength();
        maxLen = juce::jmax(maxLen, len);

        const int nCh = juce::jmax(1, (int) raw->numChannels);
        const double readerSr = raw->sampleRate;

        juce::String stemLabel = stemNameIn.isNotEmpty() ? stemNameIn : file.getFileNameWithoutExtension();
        const bool guide = classifyGuideStem(stemLabel);

        StemSlot slot;
        slot.isGuide = guide;
        slot.isClick = classifyClickStem(stemLabel);
        slot.logName = stemLabel;
        slot.clientTrackId = spec.clientTrackId;
        slot.lastMeterLevel = 0.f;
        slot.numChannels = nCh;
        // Keep music centered by default to preserve clarity/stereo image.
        slot.pan = guide ? -1.0f : 0.0f;
        slot.reader = std::move(frs);

        juce::AudioFormatReaderSource* readerPtr = slot.reader.get();
        slot.transport = std::make_unique<juce::AudioTransportSource>();

        if (guide) {
            slot.transport->setSource(readerPtr, 0, nullptr, readerSr);
            NativeLog("[AUDIO ROUTING] track " + stemLabel + " -> GuideBus LEFT DRY");
        } else {
            slot.musicBridge = std::make_unique<PositionableSoundTouchBridge>(std::move(slot.reader), nCh, readerSr);
            slot.transport->setSource(slot.musicBridge.get(), 0, nullptr, readerSr);
            NativeLog("[AUDIO ROUTING] track " + stemLabel + " -> MusicBus RIGHT (SoundTouch tempo)");
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
    debugBlockCounter = 0;

    int maxCh = 2;
    for (auto& s : stemSlots)
        maxCh = juce::jmax(maxCh, s.numChannels);
    scratch.setSize(maxCh, samplesPerBlockExpected);

    for (auto& s : stemSlots) {
        if (s.transport != nullptr)
            s.transport->prepareToPlay(samplesPerBlockExpected, hostSampleRate);
    }
    updateMusicSoundTouchParams();
    NativeLog(
        "[JUCE AUDIO] device_sr=" + juce::String(hostSampleRate, 2) +
        " buffer_size=" + juce::String(samplesPerBlockExpected) +
        " output_channels=2 track_count=" + juce::String((int) stemSlots.size())
    );
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

    ++debugBlockCounter;
    const bool emitDebug = (debugBlockCounter % 24) == 0; // ~2 times/s at 48k, 1024 block
    float masterPeak = 0.0f;
    double masterSumSq = 0.0;
    int masterSamples = 0;

    bool anySolo = false;
    for (const auto& s : stemSlots) {
        if (s.solo) {
            anySolo = true;
            break;
        }
    }

    for (auto& s : stemSlots) {
        if (s.transport == nullptr) continue;

        const int useCh = juce::jmax(1, juce::jmin(s.numChannels, scratch.getNumChannels()));
        scratch.clear();
        juce::AudioSourceChannelInfo info(&scratch, 0, nSamp);
        s.transport->getNextAudioBlock(info);

        const bool audible = !s.muted && (!anySolo || s.solo);
        float trackPeak = 0.0f;

        if (audible) {
            const float pan = juce::jlimit(-1.0f, 1.0f, s.pan);
            const float panL = std::sqrt(0.5f * (1.0f - pan));
            const float panR = std::sqrt(0.5f * (1.0f + pan));
            if (s.isGuide) {
                const float guideGain = s.isClick ? kClickBusGain : kGuideBusGain;
                for (int i = 0; i < nSamp; ++i) {
                    const float inL = scratch.getSample(0, i);
                    const float inR = (useCh > 1) ? scratch.getSample(1, i) : inL;
                    const float mono = 0.5f * (inL + inR);
                    const float gL = mono * s.gain * guideGain * panL;
                    const float gR = mono * s.gain * guideGain * panR;
                    outL[i] += gL;
                    outR[i] += gR;
                    const float ag = juce::jmax(std::abs(gL), std::abs(gR));
                    if (ag > trackPeak) trackPeak = ag;
                }
            } else {
                for (int i = 0; i < nSamp; ++i) {
                    const float inL = scratch.getSample(0, i);
                    const float inR = (useCh > 1) ? scratch.getSample(1, i) : inL;
                    const float mL = inL * s.gain * kMusicBusGain * panL;
                    const float mR = inR * s.gain * kMusicBusGain * panR;
                    outL[i] += mL;
                    outR[i] += mR;
                    const float am = juce::jmax(std::abs(mL), std::abs(mR));
                    if (am > trackPeak) trackPeak = am;
                }
            }
            s.lastMeterLevel = juce::jlimit(0.f, 1.5f, juce::jmax(trackPeak, s.lastMeterLevel * 0.94f));
        } else {
            s.lastMeterLevel = juce::jmax(0.f, s.lastMeterLevel * 0.92f);
        }

        if (emitDebug) {
            NativeLog(
                "[JUCE AUDIO] track=" + s.logName +
                " peak=" + juce::String(trackPeak, 4) +
                " gain=" + juce::String(s.gain, 3) +
                " pan=" + juce::String(s.pan, 2) +
                " muted=" + juce::String((int) s.muted) +
                " solo=" + juce::String((int) s.solo) +
                " audible=" + juce::String((int) audible)
            );
        }
    }

    for (int i = 0; i < nSamp; ++i) {
        // Fixed transparent trim to keep headroom without compression/limiting.
        outL[i] *= kMasterTrim;
        outR[i] *= kMasterTrim;
        const float l = outL[i];
        const float r = outR[i];
        const float p = juce::jmax(std::abs(l), std::abs(r));
        if (p > masterPeak) masterPeak = p;
        masterSumSq += (double) l * (double) l + (double) r * (double) r;
        masterSamples += 2;
    }

    if (masterPeak > 1.0f) {
        NativeLog("[CLIPPING DETECTED] masterPeak=" + juce::String(masterPeak, 4));
    }
    if (emitDebug && masterSamples > 0) {
        const float masterRms = (float) std::sqrt(masterSumSq / (double) masterSamples);
        NativeLog(
            "[JUCE AUDIO] master peak=" + juce::String(masterPeak, 4) +
            " master RMS=" + juce::String(masterRms, 4)
        );
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
