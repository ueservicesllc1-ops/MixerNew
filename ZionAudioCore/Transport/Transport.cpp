#include "Transport.h"

namespace Zion {

Transport::Transport() {
}

Transport::~Transport() {
    transportSource.setSource(nullptr);
}

void Transport::play() {
    transportSource.start();
}

void Transport::pause() {
    transportSource.stop();
}

void Transport::stop() {
    transportSource.stop();
    transportSource.setPosition(0);
}

void Transport::seek(double seconds) {
    transportSource.setPosition(seconds);
}

double Transport::getCurrentPosition() const {
    return transportSource.getCurrentPosition();
}

double Transport::getLengthInSeconds() const {
    return transportSource.getLengthInSeconds();
}

bool Transport::isPlaying() const {
    return transportSource.isPlaying();
}

void Transport::setSource(juce::PositionableAudioSource* newSource) {
    // AudioTransportSource manages the sample rate conversion and buffering
    // We pass 0 as the second argument if we don't want it to take ownership, 
    // or we can wrap it in a smart pointer.
    transportSource.setSource(newSource, 0, nullptr, 0);
}

} // namespace Zion
