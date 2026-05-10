#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include "DesktopMixSession.h"

class ZionDesktopBridge {
public:
    static juce::WebBrowserComponent::Options buildWebOptions(ZionDesktopBridge& bridge);

    void ensureAudio();
    void play();
    void pause();
    void stop();
    void seek(double seconds);
    void loadSong(const juce::var& tracksVar);
    void setPitchSemitones(float semitones);
    void setTempoRatio(float ratio);
    juce::String getSnapshotJson() const;

    bool isTrackDownloaded(const juce::String& filename) const;
    void saveTrackBase64(const juce::String& filename, const juce::String& base64);
    juce::String readTrackBase64(const juce::String& filename) const;

    juce::File getStemsDirectory() const;

private:
    juce::AudioFormatManager formatManager;
    DesktopMixSession mixSession;
    bool audioReady = false;
};
