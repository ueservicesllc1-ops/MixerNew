#pragma once
#include <JuceHeader.h>
#include "AudioEngine.h" // Desde ZionAudioCore

class DesktopAudioEngine {
public:
    DesktopAudioEngine() {
        engine.initialize();
    }
    
    ~DesktopAudioEngine() {
        engine.shutdown();
    }
    
    void loadStems(const StringArray& paths) {
        // Aquí iría la lógica para cargar múltiples archivos
        // y mezclarlos usando MixerAudioSource de JUCE
    }
    
    void play() { /* ... */ }
    void stop() { /* ... */ }
    
    Zion::AudioEngine& getCore() { return engine; }

private:
    Zion::AudioEngine engine;
    MixerAudioSource mixer;
};
