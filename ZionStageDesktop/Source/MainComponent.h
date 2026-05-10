#pragma once
#include <memory>
#include <juce_gui_extra/juce_gui_extra.h>
#include "Audio/ZionDesktopBridge.h"

class MainComponent : public juce::Component {
public:
    MainComponent();
    ~MainComponent() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    ZionDesktopBridge desktopBridge;
    std::unique_ptr<juce::WebBrowserComponent> webView;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainComponent)
};
