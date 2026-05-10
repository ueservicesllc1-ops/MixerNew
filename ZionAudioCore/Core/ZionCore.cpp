#include "ZionCore.h"

namespace Zion {

ZionCore::ZionCore() {
    audioEngine = std::make_unique<AudioEngine>();
    transport = std::make_unique<Transport>();
    sourceManager = std::make_unique<AudioSourceManager>();
}

ZionCore::~ZionCore() {
    shutdown();
}

void ZionCore::initialize() {
    if (isInitialized) return;

    // 1. Initialize Engine (Setup Audio Device)
    audioEngine->initialize();

    // 2. Connect Transport to Engine
    audioEngine->setSource(transport->getTransportSource());

    isInitialized = true;
}

void ZionCore::shutdown() {
    if (!isInitialized) return;

    audioEngine->shutdown();
    isInitialized = false;
}

} // namespace Zion
