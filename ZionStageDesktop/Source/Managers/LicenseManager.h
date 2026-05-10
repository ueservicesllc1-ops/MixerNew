#pragma once
#include <juce_core/juce_core.h>

class LicenseManager {
public:
    enum class AppMode { Demo, Pro };

    LicenseManager();
    bool activate(const juce::String& serial);
    void checkLicense();
    AppMode getMode() const { return currentMode; }
    bool isPro() const { return currentMode == AppMode::Pro; }
    juce::String getHardwareId();

private:
    AppMode currentMode = AppMode::Demo;
    bool verifySerial(const juce::String& serial, const juce::String& hid);
    void saveLicense(const juce::String& serial);
    juce::File getLicenseFile();
};
