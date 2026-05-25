#include "DesktopMixSession.h"
#include <juce_core/juce_core.h>
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
      numChannels(juce::jmax(1, numChannelsIn))
{
    // Wrap reader in a resampler so host SR (e.g. 48000) != source SR (e.g. 44100) is handled.
    if (reader != nullptr)
        resampler = std::make_unique<juce::ResamplingAudioSource>(reader.get(), false, numChannels);
}

void PositionableSoundTouchBridge::configureStretch() {
    const double sr = (hostSampleRate > 0.0 ? hostSampleRate : sourceSampleRate);
    stretch.setSampleRate((uint) juce::jlimit(8000.0, 192000.0, sr));
    stretch.setChannels((uint) numChannels);
    stretch.setRate(1.0);
    stretch.setTempo(juce::jlimit(0.5, 1.5, tempoRatio));
    stretch.setPitchSemiTones(pitchSemitones);
}

void PositionableSoundTouchBridge::prepareToPlay(int samplesPerBlockExpected, double sampleRate) {
    hostSampleRate = sampleRate > 0 ? sampleRate : 44100.0;
    blockSize = juce::jmax(256, samplesPerBlockExpected);
    readerPull.setSize(numChannels, blockSize);
    readerInterleaved.resize((size_t) blockSize * (size_t) numChannels);
    if (resampler != nullptr) {
        const double ratio = (hostSampleRate > 0 && sourceSampleRate > 0)
                              ? sourceSampleRate / hostSampleRate : 1.0;
        resampler->setResamplingRatio(ratio);
        resampler->prepareToPlay(samplesPerBlockExpected, hostSampleRate);
    } else if (reader != nullptr) {
        reader->prepareToPlay(samplesPerBlockExpected, hostSampleRate);
    }
    configureStretch();
    prepared = true;
}

void PositionableSoundTouchBridge::releaseResources() {
    prepared = false;
    if (resampler != nullptr)
        resampler->releaseResources();
    else if (reader != nullptr)
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
    if (frames <= 0) return;
    readerPull.clear();
    juce::AudioSourceChannelInfo pull(&readerPull, 0, frames);
    if (resampler != nullptr)
        resampler->getNextAudioBlock(pull);  // resampled to hostSampleRate
    else if (reader != nullptr)
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
    // newPosition is in host-rate samples; convert to source-rate for the underlying reader
    const double srRatio = (hostSampleRate > 0 && sourceSampleRate > 0)
                            ? sourceSampleRate / hostSampleRate : 1.0;
    const juce::int64 srcPos = (juce::int64) std::llround((double) newPosition * srRatio);
    reader->setNextReadPosition(juce::jlimit((juce::int64) 0, reader->getTotalLength(), srcPos));
    // Reset resampler buffer so stale samples are discarded
    if (resampler != nullptr && prepared) {
        resampler->releaseResources();
        resampler->setResamplingRatio(srRatio);
        resampler->prepareToPlay(blockSize, hostSampleRate);
    }
    stretch.clear();
    configureStretch();
}

juce::int64 PositionableSoundTouchBridge::getNextReadPosition() const {
    if (reader == nullptr) return 0;
    // Convert source-rate position back to host-rate for the session clock
    const double srRatio = (hostSampleRate > 0 && sourceSampleRate > 0)
                            ? sourceSampleRate / hostSampleRate : 1.0;
    return (juce::int64) std::llround((double) reader->getNextReadPosition() / srRatio);
}

juce::int64 PositionableSoundTouchBridge::getTotalLength() const {
    if (reader == nullptr) return 0;
    const double srRatio = (hostSampleRate > 0 && sourceSampleRate > 0)
                            ? sourceSampleRate / hostSampleRate : 1.0;
    return (juce::int64) std::llround((double) reader->getTotalLength() / srRatio);
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
static bool classifyVocalStem(const juce::String& name) {
    auto s = name.toLowerCase();
    return s.contains("vocal") || s.contains("vox") || s.contains("voz") || s.contains("lead")
        || s.contains("choir") || s.contains("bgv");
}
static bool classifyDrumStem(const juce::String& name) {
    auto s = name.toLowerCase();
    return s.contains("drum") || s.contains("kick") || s.contains("snare") || s.contains("tom")
        || s.contains("cymbal") || s.contains("overhead") || s.contains("percussion")
        || s.contains("redoble") || s.contains("tambor");
}

static DesktopStemBus classifyStemBus(const juce::String& stemLabel) {
    if (classifyClickStem(stemLabel))
        return DesktopStemBus::Click;
    if (classifyGuideStem(stemLabel))
        return DesktopStemBus::Guide;
    if (classifyVocalStem(stemLabel))
        return DesktopStemBus::Vocals;
    if (classifyDrumStem(stemLabel))
        return DesktopStemBus::Drums;
    return DesktopStemBus::Music;
}

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
        s.musicBridge.reset();
        s.reader.reset();
    }
    stemSlots.clear();
    lengthInSamples = 0;
    scratch.setSize(0, 0);
    globalSamplePosition = 0;
    isPlaying = false;
}

void DesktopMixSession::setMasterLinearGain(float linear) {
    const float g = juce::jlimit(0.0f, 1.0f, linear);
    masterLinearGain.store(g, std::memory_order_relaxed);
}

void DesktopMixSession::resyncTransportsToGuide() {
    // No-op: all sources share globalSamplePosition - no drift is possible
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

void DesktopMixSession::applyRoutingFromJson(const juce::String& json) {
    trackPairOverride.clear();
    trackPhysicalOutStart1Based.clear();
    useOrderedPhysicalRouting = false;
    if (json.isEmpty())
        return;

    const auto parsed = juce::JSON::parse(json);
    if (!parsed.isObject())
        return;

    auto* o = parsed.getDynamicObject();
    if (o == nullptr)
        return;

    bool multiOutHardware = false;
    if (o->hasProperty("multiOutHardware")) {
        const juce::var mv = o->getProperty("multiOutHardware");
        if (mv.isBool())
            multiOutHardware = (bool) mv;
        else if (mv.isInt())
            multiOutHardware = ((int) mv) != 0;
        else {
            const juce::String s = mv.toString().trim().toLowerCase();
            multiOutHardware = (s == "true" || s == "1");
        }
    }

    const juce::var orVar = o->getProperty("orderedRouting");
    if (multiOutHardware && orVar.isArray()) {
        if (auto* arr = orVar.getArray()) {
            if (arr->size() > 0) {
                useOrderedPhysicalRouting = true;
                for (const auto& item : *arr) {
                    if (!item.isObject())
                        continue;
                    auto* row = item.getDynamicObject();
                    if (row == nullptr)
                        continue;
                    const juce::String id = row->getProperty("id").toString();
                    if (id.isEmpty())
                        continue;
                    const int start = juce::jlimit(1, 16, (int) row->getProperty("outStart"));
                    trackPhysicalOutStart1Based[id] = start;
                }
                return;
            }
        }
    }

    auto gv = [&](const char* k, int def) {
        if (!o->hasProperty(k))
            return def;
        return juce::jlimit(0, 3, (int) o->getProperty(k));
    };

    busOutputPair[(int) DesktopStemBus::Music] = gv("music", 0);
    busOutputPair[(int) DesktopStemBus::Guide] = gv("guide", 0);
    busOutputPair[(int) DesktopStemBus::Click] = gv("click", 0);
    busOutputPair[(int) DesktopStemBus::Vocals] = gv("vocals", 0);
    busOutputPair[(int) DesktopStemBus::Drums] = gv("drums", 0);

    const juce::var trVar = o->getProperty("tracks");
    if (trVar.isObject()) {
        if (auto* to = trVar.getDynamicObject()) {
            const juce::NamedValueSet& props = to->getProperties();
            for (int i = 0; i < props.size(); ++i) {
                const juce::Identifier nm = props.getName(i);
                trackPairOverride[juce::String(nm.toString())] =
                    juce::jlimit(0, 3, (int) props.getValueAt(i));
            }
        }
    }
}

void DesktopMixSession::clearTrackRoutingOverrides() {
    trackPairOverride.clear();
    trackPhysicalOutStart1Based.clear();
    useOrderedPhysicalRouting = false;
}

int DesktopMixSession::resolveOutputPairForStem(const StemSlot& s) const {
    if (s.clientTrackId.isNotEmpty()) {
        const auto it = trackPairOverride.find(s.clientTrackId);
        if (it != trackPairOverride.end())
            return juce::jlimit(0, 3, it->second);
    }
    const int bi = (int) s.assignedBus;
    if (bi >= 0 && bi < (int) busOutputPair.size())
        return juce::jlimit(0, 3, busOutputPair[(size_t) bi]);
    return 0;
}

void DesktopMixSession::routeStereoSample(juce::AudioBuffer<float>* out,
                                          int start,
                                          int sampleIndex,
                                          int numOutCh,
                                          int pairIndex,
                                          float sampleL,
                                          float sampleR,
                                          DesktopStemBus bus) const {
    juce::ignoreUnused(bus);
    if (out == nullptr || numOutCh <= 0)
        return;

    if (numOutCh <= 2) {
        const int idxL = 0;
        const int idxR = juce::jmin(1, numOutCh - 1);
        if (idxL == idxR)
            out->addSample(idxL, start + sampleIndex, 0.5f * (sampleL + sampleR));
        else {
            out->addSample(idxL, start + sampleIndex, sampleL);
            out->addSample(idxR, start + sampleIndex, sampleR);
        }
        return;
    }

    const int maxPair = juce::jmax(0, numOutCh / 2 - 1);
    const int p = juce::jlimit(0, maxPair, pairIndex);
    const int c0 = p * 2;
    const int c1 = c0 + 1;
    if (c1 < numOutCh) {
        out->addSample(c0, start + sampleIndex, sampleL);
        out->addSample(c1, start + sampleIndex, sampleR);
    }
}

void DesktopMixSession::routeStereoToPhysical(juce::AudioBuffer<float>* out,
                                                int start,
                                                int sampleIndex,
                                                int numOutCh,
                                                int outStart1Based,
                                                float sampleL,
                                                float sampleR,
                                                DesktopStemBus bus) const {
    juce::ignoreUnused(bus);
    if (out == nullptr || numOutCh <= 0)
        return;

    if (numOutCh <= 2) {
        const int idxL = 0;
        const int idxR = juce::jmin(1, numOutCh - 1);
        if (idxL == idxR)
            out->addSample(idxL, start + sampleIndex, 0.5f * (sampleL + sampleR));
        else {
            out->addSample(idxL, start + sampleIndex, sampleL);
            out->addSample(idxR, start + sampleIndex, sampleR);
        }
        return;
    }

    const int c0 = juce::jlimit(0, numOutCh - 1, outStart1Based - 1);
    const int c1 = c0 + 1;
    if (c1 < numOutCh) {
        out->addSample(c0, start + sampleIndex, sampleL);
        out->addSample(c1, start + sampleIndex, sampleR);
    } else {
        out->addSample(c0, start + sampleIndex, 0.5f * (sampleL + sampleR));
    }
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
        NativeLog("[JUCE] opened reader: " + file.getFullPathName() +
                  " SR=" + juce::String((int)raw->sampleRate) +
                  " ch=" + juce::String((int)raw->numChannels));


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
        slot.assignedBus = classifyStemBus(stemLabel);
        slot.logName = stemLabel;
        slot.clientTrackId = spec.clientTrackId;
        slot.sourceSampleRate = readerSr;
        slot.lastMeterLevel = 0.f;
        slot.numChannels = nCh;
        slot.pan = guide ? -1.0f : 0.0f;
        slot.reader = std::move(frs);

        if (guide) {
            // GuideBus: reader directo, sin SoundTouch
            NativeLog("[AUDIO ROUTING] track " + stemLabel + " -> GuideBus LEFT DRY");
        } else {
            // MusicBus: SoundTouch bridge (tempo y pitch)
            slot.musicBridge = std::make_unique<PositionableSoundTouchBridge>(std::move(slot.reader), nCh, readerSr);
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
    // Requirement 3 & 4: Play/Pause only change the transport state flag.
    // No individual track start/stop. The processBlock clock drives everything.
    isPlaying = shouldPlay;
    NativeLog(juce::String("[TRANSPORT] ") + (isPlaying ? "play" : "pause") +
              " samplePosition=" + juce::String(globalSamplePosition));
}

void DesktopMixSession::prepareToPlay(int samplesPerBlockExpected, double sampleRate) {
    hostSampleRate = sampleRate > 0 ? sampleRate : 44100.0;
    debugBlockCounter = 0;

    int maxCh = 2;
    for (auto& s : stemSlots)
        maxCh = juce::jmax(maxCh, s.numChannels);
    scratch.setSize(maxCh, samplesPerBlockExpected);

    // Requirement: log sampleRate at initialization
    NativeLog("[TRANSPORT] sampleRate=" + juce::String(hostSampleRate, 2));

    for (auto& s : stemSlots) {
        if (auto* src = s.getActiveSource())
            src->prepareToPlay(samplesPerBlockExpected, hostSampleRate);
    }
    updateMusicSoundTouchParams();
    NativeLog(
        "[JUCE AUDIO] device_sr=" + juce::String(hostSampleRate, 2) +
        " buffer_size=" + juce::String(samplesPerBlockExpected) +
        " track_count=" + juce::String((int) stemSlots.size())
    );
}

void DesktopMixSession::releaseResources() {
    for (auto& s : stemSlots) {
        if (auto* src = s.getActiveSource())
            src->releaseResources();
    }
    scratch.setSize(0, 0);
}

void DesktopMixSession::getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) {
    if (bufferToFill.buffer == nullptr)
        return;

    bufferToFill.clearActiveBufferRegion();

    // Requirement 7: If not playing, output silence - do NOT advance clock
    if (!isPlaying)
        return;

    const int nSamp = bufferToFill.numSamples;
    const int start = bufferToFill.startSample;
    juce::AudioBuffer<float>* const outBuf = bufferToFill.buffer;
    const int outChannels = outBuf->getNumChannels();

    ++debugBlockCounter;
    const bool emitDebug = (debugBlockCounter % 24) == 0;
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

    // Requirement 7: Read ALL tracks from the same globalSamplePosition
    for (auto& s : stemSlots) {
        auto* src = s.getActiveSource();
        if (src == nullptr)
            continue;

        // Sync check: verify reader is at expected position
        if (emitDebug) {
            const juce::int64 readerPos = src->getNextReadPosition();
            const juce::int64 delta = readerPos - globalSamplePosition;
            NativeLog("[SYNC] track=" + s.logName +
                      " readerPos=" + juce::String(readerPos) +
                      " globalPos=" + juce::String(globalSamplePosition) +
                      " delta=" + juce::String(delta) + " samples");
        }


        const int useCh = juce::jmax(1, juce::jmin(s.numChannels, scratch.getNumChannels()));
        scratch.clear();
        juce::AudioSourceChannelInfo info(&scratch, 0, nSamp);
        src->getNextAudioBlock(info);


        const bool audible = !s.muted && (!anySolo || s.solo);
        float trackPeak = 0.0f;
        int phys1ForDebug = 0;

        if (audible) {
            const float pan = juce::jlimit(-1.0f, 1.0f, s.pan);
            const float panL = std::sqrt(0.5f * (1.0f - pan));
            const float panR = std::sqrt(0.5f * (1.0f + pan));
            const int pairIdx = resolveOutputPairForStem(s);
            const juce::String cid = s.clientTrackId;
            int phys1 = 0;
            if (useOrderedPhysicalRouting && cid.isNotEmpty()) {
                const auto it = trackPhysicalOutStart1Based.find(cid);
                if (it != trackPhysicalOutStart1Based.end())
                    phys1 = it->second;
            }
            phys1ForDebug = phys1;

            auto routeOne = [&](int si, float L, float R) {
                if (phys1 > 0)
                    routeStereoToPhysical(outBuf, start, si, outChannels, phys1, L, R, s.assignedBus);
                else
                    routeStereoSample(outBuf, start, si, outChannels, pairIdx, L, R, s.assignedBus);
            };

            if (s.isGuide) {
                const float guideGain = s.isClick ? kClickBusGain : kGuideBusGain;
                for (int i = 0; i < nSamp; ++i) {
                    const float inL = scratch.getSample(0, i);
                    const float inR = (useCh > 1) ? scratch.getSample(1, i) : inL;
                    const float mono = 0.5f * (inL + inR);
                    const float gL = mono * s.gain * guideGain * panL;
                    const float gR = mono * s.gain * guideGain * panR;
                    routeOne(i, gL, gR);
                    const float ag = juce::jmax(std::abs(gL), std::abs(gR));
                    if (ag > trackPeak)
                        trackPeak = ag;
                }
            } else {
                for (int i = 0; i < nSamp; ++i) {
                    const float inL = scratch.getSample(0, i);
                    const float inR = (useCh > 1) ? scratch.getSample(1, i) : inL;
                    const float mL = inL * s.gain * kMusicBusGain * panL;
                    const float mR = inR * s.gain * kMusicBusGain * panR;
                    routeOne(i, mL, mR);
                    const float am = juce::jmax(std::abs(mL), std::abs(mR));
                    if (am > trackPeak)
                        trackPeak = am;
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
                " bus=" + juce::String((int) s.assignedBus) +
                " pair=" + juce::String(resolveOutputPairForStem(s)) +
                " phys1=" + juce::String(phys1ForDebug) +
                " ord=" + juce::String((int) useOrderedPhysicalRouting) +
                " outs=" + juce::String(outChannels) +
                " muted=" + juce::String((int) s.muted) +
                " solo=" + juce::String((int) s.solo) +
                " audible=" + juce::String((int) audible)
            );
        }
    }

    const float masterG = masterLinearGain.load(std::memory_order_relaxed);

    for (int c = 0; c < outChannels; ++c) {
        float* ch = outBuf->getWritePointer(c, start);
        for (int i = 0; i < nSamp; ++i) {
            ch[i] *= kMasterTrim * masterG;
            const float v = ch[i];
            const float p = std::abs(v);
            if (p > masterPeak)
                masterPeak = p;
            masterSumSq += (double) v * (double) v;
            ++masterSamples;
        }
    }

    if (masterPeak > 1.0f) {
        NativeLog("[CLIPPING DETECTED] masterPeak=" + juce::String(masterPeak, 4));
    }
    if (emitDebug && masterSamples > 0) {
        const float masterRms = (float) std::sqrt(masterSumSq / (double) masterSamples);
        NativeLog(
            "[JUCE AUDIO] master peak=" + juce::String(masterPeak, 4) +
            " master RMS=" + juce::String(masterRms, 4) +
            " outCh=" + juce::String(outChannels) +
            " globalPos=" + juce::String(globalSamplePosition)
        );
    }

    // Requirement 7: advance the single global clock AFTER processing all tracks
    globalSamplePosition += nSamp;
}

void DesktopMixSession::setNextReadPosition(juce::int64 newPosition) {
    // newPosition is in host-rate samples
    globalSamplePosition = newPosition;
    const double seconds = hostSampleRate > 0 ? (double) newPosition / hostSampleRate : 0.0;
    for (auto& s : stemSlots) {
        if (s.isGuide && s.reader != nullptr) {
            // Guide/Click: direct reader, position in SOURCE-rate samples
            const double srRatio = (hostSampleRate > 0 && s.sourceSampleRate > 0)
                                    ? s.sourceSampleRate / hostSampleRate : 1.0;
            const juce::int64 srcPos = (juce::int64) std::llround((double) newPosition * srRatio);
            s.reader->setNextReadPosition(juce::jlimit((juce::int64) 0, s.reader->getTotalLength(), srcPos));
        } else if (s.musicBridge != nullptr) {
            // MusicBus bridge handles SR conversion internally
            s.musicBridge->setNextReadPosition(newPosition);
        }
    }
    NativeLog("[TRANSPORT] seek seconds=" + juce::String(seconds, 3) +
              " sample=" + juce::String(globalSamplePosition));
}

juce::int64 DesktopMixSession::getNextReadPosition() const {
    // Requirement 10: UI observes position; only read from single clock
    return globalSamplePosition;
}

juce::int64 DesktopMixSession::getTotalLength() const {
    return lengthInSamples;
}
