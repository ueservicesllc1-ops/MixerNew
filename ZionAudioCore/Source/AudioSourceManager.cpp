#include "AudioSourceManager.h"

namespace Zion {

AudioSourceManager::AudioSourceManager() {
    // Register basic formats
    formatManager.registerBasicFormats();
}

AudioSourceManager::~AudioSourceManager() {
}

std::unique_ptr<juce::AudioFormatReaderSource> AudioSourceManager::loadFile(const std::string& path) {
    juce::File file(path);
    
    if (!file.existsAsFile()) {
        juce::Logger::writeToLog("File does not exist: " + path);
        return nullptr;
    }

    auto* reader = formatManager.createReaderFor(file);
    
    if (reader != nullptr) {
        // Create a new source that reads from this reader. 
        // true = the source will delete the reader when it's deleted.
        return std::make_unique<juce::AudioFormatReaderSource>(reader, true);
    }

    juce::Logger::writeToLog("Could not create reader for: " + path);
    return nullptr;
}

} // namespace Zion
