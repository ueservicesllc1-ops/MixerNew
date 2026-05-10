#include "LicenseManager.h"
#include <juce_cryptography/juce_cryptography.h>
#include <juce_core/juce_core.h>

LicenseManager::LicenseManager() { checkLicense(); }

juce::String LicenseManager::getHardwareId() {
    juce::String raw = juce::SystemStats::getComputerName() + juce::SystemStats::getOperatingSystemName();
    juce::SHA256 hasher (raw.toRawUTF8(), raw.getNumBytesAsUTF8());
    
    // Corregido: Obtener el hash como MemoryBlock y luego a Hex
    auto digest = hasher.getRawData();
    return juce::String::toHexString(digest.getData(), (int)digest.getSize()).substring(0, 16).toUpperCase();
}

bool LicenseManager::activate(const juce::String& serial) {
    if (verifySerial(serial, getHardwareId())) {
        currentMode = AppMode::Pro;
        saveLicense(serial);
        return true;
    }
    return false;
}

void LicenseManager::checkLicense() {
    juce::File licenseFile = getLicenseFile();
    if (licenseFile.existsAsFile()) {
        juce::String serial = licenseFile.loadFileAsString().trim();
        if (verifySerial(serial, getHardwareId())) {
            currentMode = AppMode::Pro;
            return;
        }
    }
    currentMode = AppMode::Demo;
}

bool LicenseManager::verifySerial(const juce::String& serial, const juce::String& hid) {
    juce::StringArray parts;
    parts.addTokens(serial, ".", "");
    if (parts.size() != 2) return false;
    
    juce::MemoryBlock dataBlock;
    dataBlock.fromBase64Encoding(parts[0]);
    
    return dataBlock.toString().contains(hid);
}

void LicenseManager::saveLicense(const juce::String& serial) {
    juce::File f = getLicenseFile();
    f.getParentDirectory().createDirectory();
    f.replaceWithText(serial);
}

juce::File LicenseManager::getLicenseFile() {
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("ZionStage/license.dat");
}
