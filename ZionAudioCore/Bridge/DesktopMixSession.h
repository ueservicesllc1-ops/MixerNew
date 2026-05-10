#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <SoundTouch.h>
#include <memory>
#include <utility>
#include <vector>

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

/** Mezcla stems: GuideBus → L seco; MusicBus → R (SoundTouch: tempo y pitch independientes). */
class DesktopMixSession : public juce::PositionableAudioSource {
public:
    DesktopMixSession();
    ~DesktopMixSession() override;

    void clear();

    /** Cada entrada: ruta de archivo + nombre del stem (p. ej. "Click", "Piano") para clasificar bus. */
    bool loadStems(juce::AudioFormatManager& fm,
                   const juce::File& stemsRoot,
                   const std::vector<std::pair<juce::String, juce::String>>& pathAndStemName);

    void setStemsPlaying(bool shouldPlay);

    /** Solo MusicBus (±12 semitonos). GuideBus no recibe pitch. */
    void setPitchSemitones(float semitones);
    void setTempoRatio(float ratio);

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
        juce::String logName;
        int numChannels = 2;
        std::unique_ptr<juce::AudioFormatReaderSource> reader; // solo GuideBus
        std::unique_ptr<PositionableSoundTouchBridge> musicBridge; // solo MusicBus
        std::unique_ptr<juce::AudioTransportSource> transport;
    };

    void updateMusicSoundTouchParams();

    std::vector<StemSlot> stemSlots;
    juce::AudioBuffer<float> scratch;

    double hostSampleRate = 44100.0;
    juce::int64 lengthInSamples = 0;
    double pitchSemitones = 0.0;
    double tempoRatio = 1.0;
};
