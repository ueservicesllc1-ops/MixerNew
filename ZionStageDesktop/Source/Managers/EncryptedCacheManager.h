#pragma once
#include <juce_core/juce_core.h>
#include <memory>

class EncryptedCacheManager {
public:
    EncryptedCacheManager();
    bool saveSong(const juce::String& songId, const juce::MemoryBlock& data);
    juce::File getSongFile(const juce::String& songId);
    std::unique_ptr<juce::InputStream> createDecryptingStream(const juce::File& file);

private:
    juce::String generateKeyFromHID();
};
