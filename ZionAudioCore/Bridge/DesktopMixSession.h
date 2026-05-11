#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <vector>
#include <array>
#include <map>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <SoundTouch.h>
#include <memory>
#include <utility>

/**
 * MusicBus: lector → SoundTouch (tempo y/o pitch independientes) como PositionableAudioSource.
 * GuideBus: AudioFormatReaderSource directo (sin stretch ni pitch).
 */
class PositionableSoundTouchBridge : public juce::PositionableAudioSource {
public:
    PositionableSoundTouchBridge(std::unique_ptr<juce::AudioFormatReaderSource> readerIn, int numChannelsIn, double sourceRateIn);

    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override;
    void releaseResources() override;
    void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override;

    void setNextReadPosition(juce::int64 newPosition) override;
    juce::int64 getNextReadPosition() const override;
    juce::int64 getTotalLength() const override;
    bool isLooping() const override;
    void setLooping(bool shouldLoop) override;

    /** Ratio 1.0 = original; >1 más rápido; <1 más lento (time-stretch, tono preservado vía TDStretch). */
    void setTempoRatio(double ratio);
    /** Semitonos; duración musical preservada (pitch-shift vía RateTransposer + compensación interna). */
    void setPitchSemitones(double semitones);

private:
    void configureStretch();
    void pullFromReader(int frames);

    std::unique_ptr<juce::AudioFormatReaderSource> reader;
    soundtouch::SoundTouch stretch;
    double tempoRatio = 1.0;
    double pitchSemitones = 0.0;
    double sourceSampleRate = 44100.0;
    double hostSampleRate = 44100.0;
    int numChannels = 2;
    int blockSize = 512;

    juce::AudioBuffer<float> readerPull;
    std::vector<float> interleavedOut;
    std::vector<float> readerInterleaved;
    bool prepared = false;
};

/** Buses lógicos para multi-out (pares físicos 1-2 … 7-8). */
enum class DesktopStemBus : int {
    Music = 0,
    Guide,
    Click,
    Vocals,
    Drums,
    busCount = 5
};

/** Ruta en disco + nombre para clasificar bus + id de la UI (p. ej. songId_Click) para VU / IPC. */
struct DesktopStemLoadSpec {
    juce::String path;
    juce::String stemNameHint;
    juce::String clientTrackId;
};

/** Mezcla stems: GuideBus → L seco; MusicBus → R (SoundTouch: tempo y pitch independientes). */
class DesktopMixSession : public juce::PositionableAudioSource {
public:
    DesktopMixSession();
    ~DesktopMixSession() override;

    void clear();

    bool loadStems(juce::AudioFormatManager& fm,
                   const juce::File& stemsRoot,
                   const std::vector<DesktopStemLoadSpec>& specs);

    /** CSV `id:nivel,id2:nivel` consumido por AudioEngine (mismo formato que APK). */
    juce::String getTrackLevelsCsv() const;

    void setStemsPlaying(bool shouldPlay);

    /** Solo MusicBus (±12 semitonos). GuideBus no recibe pitch. */
    void setPitchSemitones(float semitones);
    void setTempoRatio(float ratio);

    /** Misma cadena que `id` del renderer / `clientTrackId` al cargar stems (p. ej. songId_Click). */
    void setTrackVolumeForClientId(const juce::String& clientTrackId, float linearGain);
    void setTrackMutedForClientId(const juce::String& clientTrackId, bool muted);
    void setTrackSoloForClientId(const juce::String& clientTrackId, bool solo);

    /** JSON legacy (buses) o v2: `orderedRouting:[{id,outStart}]` con outStart 1..16 = primer canal L (R=L+1). */
    void applyRoutingFromJson(const juce::String& json);
    void clearTrackRoutingOverrides();

    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override;
    void releaseResources() override;
    void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override;

    void setNextReadPosition(juce::int64 newPosition) override;
    juce::int64 getNextReadPosition() const override;
    juce::int64 getTotalLength() const override;
    bool isLooping() const override { return false; }
    void setLooping(bool shouldLoop) override { juce::ignoreUnused(shouldLoop); }

private:
    struct StemSlot {
        bool isGuide = false;
        bool isClick = false;
        DesktopStemBus assignedBus = DesktopStemBus::Music;
        juce::String logName;
        juce::String clientTrackId;
        float lastMeterLevel = 0.f;
        int numChannels = 2;
        float gain = 1.0f;
        bool muted = false;
        bool solo = false;
        float pan = 0.0f; // debug only: guide=-1, music=+1
        std::unique_ptr<juce::AudioFormatReaderSource> reader; // solo GuideBus
        std::unique_ptr<PositionableSoundTouchBridge> musicBridge; // solo MusicBus
        std::unique_ptr<juce::AudioTransportSource> transport;
    };

    void updateMusicSoundTouchParams();
    /** Alinea todos los transports al reloj de guía/click (seco) tras volver a tono nominal. */
    void resyncTransportsToGuide();
    StemSlot* findStemForClientId(const juce::String& id);
    int resolveOutputPairForStem(const StemSlot& s) const;
    void routeStereoSample(juce::AudioBuffer<float>* out,
                           int start,
                           int sampleIndex,
                           int numOutCh,
                           int pairIndex,
                           float sampleL,
                           float sampleR,
                           DesktopStemBus bus) const;
    /** outStart1Based 1..16 → canales 0-based; estéreo en ch y ch+1 si existe. */
    void routeStereoToPhysical(juce::AudioBuffer<float>* out,
                               int start,
                               int sampleIndex,
                               int numOutCh,
                               int outStart1Based,
                               float sampleL,
                               float sampleR,
                               DesktopStemBus bus) const;

    std::vector<StemSlot> stemSlots;
    juce::AudioBuffer<float> scratch;

    /** Índice de par de salida 0..3 → canales físicos [2p, 2p+1] (solo modo legacy). */
    std::array<int, (int) DesktopStemBus::busCount> busOutputPair { 0, 0, 0, 0, 0 };
    std::map<juce::String, int> trackPairOverride;

    bool useOrderedPhysicalRouting = false;
    /** clientTrackId → primer canal de salida 1..16 (UI). */
    std::map<juce::String, int> trackPhysicalOutStart1Based;

    double hostSampleRate = 44100.0;
    juce::int64 lengthInSamples = 0;
    double pitchSemitones = 0.0;
    double tempoRatio = 1.0;
    int debugBlockCounter = 0;
};
