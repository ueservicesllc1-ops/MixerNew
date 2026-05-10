#include "AudioEngine.h"

namespace Zion {

AudioEngine::AudioEngine() {
}

AudioEngine::~AudioEngine() {
    shutdown();
}

void AudioEngine::initialize() {
    // Initialise the device manager with default settings
    auto error = deviceManager.initialiseWithDefaultDevices(defaultNumInputChannels, defaultNumOutputChannels);
    
    if (error.isNotEmpty()) {
        juce::Logger::writeToLog("AudioEngine Error: " + error);
    }

    // Connect the player to the device manager
    deviceManager.addAudioCallback(&audioSourcePlayer);
}

void AudioEngine::shutdown() {
    deviceManager.removeAudioCallback(&audioSourcePlayer);
    audioSourcePlayer.setSource(nullptr);
}

void AudioEngine::setSource(juce::AudioSource* newSource) {
    audioSourcePlayer.setSource(newSource);
}

} // namespace Zion
