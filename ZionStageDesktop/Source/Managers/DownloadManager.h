#pragma once
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include "EncryptedCacheManager.h"

class DownloadManager : public juce::Thread, public juce::AsyncUpdater {
public:
    DownloadManager(EncryptedCacheManager& cm);
    void startDownload(const juce::String& url, const juce::String& songId);
    void run() override;
    void handleAsyncUpdate() override;
    
    std::function<void(bool)> onFinished;

private:
    EncryptedCacheManager& cacheManager;
    juce::String targetUrl;
    juce::String currentSongId;
    bool finishedSuccessfully = false;
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(DownloadManager)
};
