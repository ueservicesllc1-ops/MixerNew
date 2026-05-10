#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#include "ZionCore.h"

using namespace emscripten;
using namespace Zion;

// Function wrappers for ZionCore
void initEngine() {
    ZionCore::getInstance().initialize();
}

void play() {
    ZionCore::getInstance().getTransport().play();
}

void pause() {
    ZionCore::getInstance().getTransport().pause();
}

void stop() {
    ZionCore::getInstance().getTransport().stop();
}

void seek(double seconds) {
    ZionCore::getInstance().getTransport().seek(seconds);
}

void setVolume(float volume) {
    ZionCore::getInstance().getEngine().getDeviceManager().getCurrentAudioDevice()->setOutputVolume(volume);
}

void loadTrack(std::string id, emscripten::val buffer) {
    // In a real implementation, we would extract the raw data from the JS buffer 
    // and pass it to AudioSourceManager.
}

void setTrackVolume(std::string id, float volume) {
    // Implementation for specific tracks
}

bool isPlaying() {
    return ZionCore::getInstance().getTransport().isPlaying();
}

double getCurrentPosition() {
    return ZionCore::getInstance().getTransport().getCurrentPosition();
}

EMSCRIPTEN_BINDINGS(zion_audio_core) {
    function("initEngine", &initEngine);
    function("play", &play);
    function("pause", &pause);
    function("stop", &stop);
    function("seek", &seek);
    function("setVolume", &setVolume);
    function("setTrackVolume", &setTrackVolume);
    function("loadTrack", &loadTrack);
    function("isPlaying", &isPlaying);
    function("getCurrentPosition", &getCurrentPosition);
}

#endif
