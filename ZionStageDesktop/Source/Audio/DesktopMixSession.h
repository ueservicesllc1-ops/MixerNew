#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <memory>
#include <utility>
#include <vector>

/** Encadena AudioFormatReaderSource → ResamplingAudioSource como PositionableAudioSource (requerido por AudioTransportSource). */
class PositionableResamplingBridge : public juce::PositionableAudioSource {
public:
    PositionableResamplingBridge(std::unique_ptr<juce::AudioFormatReaderSource> readerIn, int numChannels);

    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override;
    void releaseResources() override;
    void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override;

    void setNextReadPosition(juce::int64 newPosition) override;
    juce::int64 getNextReadPosition() const override;
    juce::int64 getTotalLength() const override;
    bool isLooping() const override;
    void setLooping(bool shouldLoop) override;

    juce::ResamplingAudioSource& getResampler() { return resampler; }

private:
    std::unique_ptr<juce::AudioFormatReaderSource> reader;
    juce::ResamplingAudioSource resampler;
};

/** Mezcla stems para Zion Desktop: GuideBus (click/guide/guía/cue) → L seco; MusicBus → R con pitch+tempo vía ResamplingAudioSource. */
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

    /** Solo MusicBus (stems no-guide). GuideBus ignora estos valores. */
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
        std::unique_ptr<PositionableResamplingBridge> musicBridge; // solo MusicBus
        std::unique_ptr<juce::AudioTransportSource> transport;
    };

    void updateMusicResamplingRatios();

    std::vector<StemSlot> stemSlots;
    juce::AudioBuffer<float> scratch;

    double hostSampleRate = 44100.0;
    juce::int64 lengthInSamples = 0;
    float pitchSemitones = 0.f;
    float tempoRatio = 1.f;
};
