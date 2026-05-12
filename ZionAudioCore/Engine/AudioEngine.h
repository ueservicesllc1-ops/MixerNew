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

    /** Lista JSON: [{ "type", "name" }, ...] salidas disponibles. */
    juce::String getOutputAudioDevicesJson();
    /** Estado: deviceName, activeOutputChannels, maxOutputChannels. */
    juce::String getCurrentAudioOutputStatusJson();
    /** `outputDeviceName` vacío = mantener dispositivo; numOutputChannels 2..8 (par). */
    bool setAudioOutputDeviceWithChannels(const juce::String& outputDeviceName, int numOutputChannels);

private:
    juce::AudioDeviceManager deviceManager;
    juce::AudioSourcePlayer audioSourcePlayer;
    
    // Salida estéreo por defecto (estable). Multi-salida solo tras "Aplicar" en el modal de ruteo.
    static constexpr int defaultNumInputChannels = 0;
    static constexpr int defaultNumOutputChannels = 2;
};

} // namespace Zion
