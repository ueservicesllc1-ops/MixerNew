#pragma once

#include <juce_audio_devices/juce_audio_devices.h>
#include "Engine/AudioEngine.h"
#include "Transport/Transport.h"
#include "Source/AudioSourceManager.h"
#include <memory>

namespace Zion {

/**
 * ZionCore: The central manager for the Zion Audio Engine.
 * Follows a singleton-like pattern for easy access across the system.
 */
class ZionCore {
public:
    ZionCore();
    ~ZionCore();

    // Prevent copying
    ZionCore(const ZionCore&) = delete;
    ZionCore& operator=(const ZionCore&) = delete;

    static ZionCore& getInstance() {
        static ZionCore instance;
        return instance;
    }

    void initialize();
    void shutdown();

    AudioEngine& getEngine() { return *audioEngine; }
    Transport& getTransport() { return *transport; }
    AudioSourceManager& getSourceManager() { return *sourceManager; }

private:
    std::unique_ptr<AudioEngine> audioEngine;
    std::unique_ptr<Transport> transport;
    std::unique_ptr<AudioSourceManager> sourceManager;
    
    bool isInitialized = false;
};

} // namespace Zion
