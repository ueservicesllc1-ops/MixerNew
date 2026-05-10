#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>

namespace Zion {

/**
 * Transport: Controls playback state (play, pause, stop, seek).
 * Uses juce::AudioTransportSource for high-level transport control.
 */
class Transport {
public:
    Transport();
    ~Transport();

    void play();
    void pause();
    void stop();
    
    // Seek to position in seconds
    void seek(double seconds);

    // Get current position in seconds
    double getCurrentPosition() const;
    
    // Get total duration in seconds
    double getLengthInSeconds() const;

    bool isPlaying() const;

    // Connect a source to the transport
    void setSource(juce::PositionableAudioSource* newSource);

    juce::AudioTransportSource* getTransportSource() { return &transportSource; }

private:
    juce::AudioTransportSource transportSource;
};

} // namespace Zion
