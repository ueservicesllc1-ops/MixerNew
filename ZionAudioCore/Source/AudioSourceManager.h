#pragma once

#include <juce_audio_formats/juce_audio_formats.h>
#include <memory>
#include <string>

namespace Zion {

/**
 * AudioSourceManager: Handles loading audio files and creating JUCE AudioSources.
 */
class AudioSourceManager {
public:
    AudioSourceManager();
    ~AudioSourceManager();

    /**
     * Loads an audio file from the given path.
     * Returns a PositionableAudioSource that can be used by the Transport.
     */
    std::unique_ptr<juce::AudioFormatReaderSource> loadFile(const std::string& path);

private:
    juce::AudioFormatManager formatManager;
};

} // namespace Zion
