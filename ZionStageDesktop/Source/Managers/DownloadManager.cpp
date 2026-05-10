#include "DownloadManager.h"

DownloadManager::DownloadManager(EncryptedCacheManager& cm) 
    : juce::Thread("DownloadThread"), cacheManager(cm) {}

void DownloadManager::startDownload(const juce::String& url, const juce::String& songId) {
    targetUrl = url;
    currentSongId = songId;
    startThread();
}

void DownloadManager::run() {
    juce::URL url(targetUrl);
    auto stream = url.createInputStream(juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress));
    
    if (stream != nullptr) {
        juce::MemoryBlock dataBlock;
        stream->readIntoMemoryBlock(dataBlock);
        cacheManager.saveSong(currentSongId, dataBlock);
        finishedSuccessfully = true;
    }
    triggerAsyncUpdate();
}

void DownloadManager::handleAsyncUpdate() {
    if (onFinished) onFinished(finishedSuccessfully);
}
