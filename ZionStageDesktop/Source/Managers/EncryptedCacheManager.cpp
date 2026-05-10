#include "EncryptedCacheManager.h"

EncryptedCacheManager::EncryptedCacheManager() {}

bool EncryptedCacheManager::saveSong(const juce::String& songId, const juce::MemoryBlock& data) {
    juce::File f = getSongFile(songId);
    return f.replaceWithData(data.getData(), data.getSize());
}

juce::File EncryptedCacheManager::getSongFile(const juce::String& songId) {
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("ZionStage/Cache")
        .getChildFile(songId + ".zcache");
}

std::unique_ptr<juce::InputStream> EncryptedCacheManager::createDecryptingStream(const juce::File& file) {
    return file.createInputStream();
}

juce::String EncryptedCacheManager::generateKeyFromHID() {
    return "secret-key";
}
