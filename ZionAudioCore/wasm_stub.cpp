#include <emscripten/bind.h>
#include <string>

using namespace emscripten;

void initEngine() { }
void play() { }
void pause() { }
void stop() { }
void seek(double) { }
void setVolume(float) { }
void setTrackVolume(std::string, float) { }
void loadTrack(std::string id, val buffer) { }
bool isPlaying() { return false; }
double getCurrentPosition() { return 0.0; }

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
