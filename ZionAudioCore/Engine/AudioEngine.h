#pragma once

#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_utils/juce_audio_utils.h>

namespace Zion {

/**
 * AudioEngine: Handles the audio hardware interface and the main audio callback.
 */
class AudioEngine {
public:
    AudioEngine();
    ~AudioEngine();

    void initialize();
    void shutdown();

    // Sets the main audio source to be played
    void setSource(juce::AudioSource* newSource);

    juce::AudioDeviceManager& getDeviceManager() { return deviceManager; }

private:
    juce::AudioDeviceManager deviceManager;
    juce::AudioSourcePlayer audioSourcePlayer;
    
    // Default audio settings
    static constexpr int defaultNumInputChannels = 0;
    static constexpr int defaultNumOutputChannels = 2;
};

} // namespace Zion
