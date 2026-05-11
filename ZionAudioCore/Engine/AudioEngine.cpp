#include "AudioEngine.h"
#include <juce_core/juce_core.h>

namespace Zion {

static juce::String enumerateOutputDevices(juce::AudioDeviceManager& dm) {
    juce::Array<juce::var> rows;
    const juce::OwnedArray<juce::AudioIODeviceType>& types = dm.getAvailableDeviceTypes();
    for (int ti = 0; ti < types.size(); ++ti) {
        juce::AudioIODeviceType* ty = types[ti];
        if (ty == nullptr)
            continue;
        ty->scanForDevices();
        const juce::StringArray names = ty->getDeviceNames(true);
        for (int i = 0; i < names.size(); ++i) {
            juce::DynamicObject::Ptr row = new juce::DynamicObject();
            row->setProperty("type", ty->getTypeName());
            row->setProperty("name", names[i]);
            rows.add(juce::var(row.get()));
        }
    }
    return juce::JSON::toString(juce::var(rows));
}

AudioEngine::AudioEngine() {
}

AudioEngine::~AudioEngine() {
    shutdown();
}

void AudioEngine::initialize() {
    juce::String error = deviceManager.initialiseWithDefaultDevices(defaultNumInputChannels, defaultNumOutputChannels);
    if (error.isNotEmpty()) {
        juce::Logger::writeToLog("AudioEngine: reintento 2 salidas: " + error);
        error = deviceManager.initialiseWithDefaultDevices(defaultNumInputChannels, 2);
    }
    if (error.isNotEmpty()) {
        juce::Logger::writeToLog("AudioEngine Error: " + error);
    }

    deviceManager.addAudioCallback(&audioSourcePlayer);
}

juce::String AudioEngine::getOutputAudioDevicesJson() {
    return enumerateOutputDevices(getDeviceManager());
}

juce::String AudioEngine::getCurrentAudioOutputStatusJson() {
    juce::DynamicObject::Ptr o = new juce::DynamicObject();
    const juce::AudioDeviceManager::AudioDeviceSetup setup = deviceManager.getAudioDeviceSetup();
    o->setProperty("outputDeviceName", setup.outputDeviceName);
    juce::AudioIODevice* dev = deviceManager.getCurrentAudioDevice();
    if (dev != nullptr) {
        o->setProperty("deviceName", dev->getName());
        o->setProperty("activeOutputChannels", dev->getActiveOutputChannels().countNumberOfSetBits());
        o->setProperty("maxOutputChannels", dev->getOutputChannelNames().size());
    } else {
        o->setProperty("deviceName", setup.outputDeviceName);
        o->setProperty("activeOutputChannels", setup.outputChannels.countNumberOfSetBits());
        o->setProperty("maxOutputChannels", setup.outputChannels.countNumberOfSetBits());
    }
    return juce::JSON::toString(juce::var(o.get()));
}

bool AudioEngine::setAudioOutputDeviceWithChannels(const juce::String& outputDeviceName, int numOutputChannels) {
    juce::AudioDeviceManager::AudioDeviceSetup setup = deviceManager.getAudioDeviceSetup();
    if (outputDeviceName.isNotEmpty())
        setup.outputDeviceName = outputDeviceName;

    int n = juce::jlimit(2, 32, numOutputChannels);
    if ((n % 2) != 0)
        --n;
    if (n < 2)
        n = 2;

    setup.inputChannels = juce::BigInteger();
    setup.outputChannels = juce::BigInteger();
    for (int i = 0; i < n; ++i)
        setup.outputChannels.setBit(i);

    const juce::String err = deviceManager.setAudioDeviceSetup(setup, true);
    if (err.isNotEmpty()) {
        juce::Logger::writeToLog("AudioEngine setAudioDeviceSetup: " + err);
        return false;
    }
    return true;
}

void AudioEngine::shutdown() {
    deviceManager.removeAudioCallback(&audioSourcePlayer);
    audioSourcePlayer.setSource(nullptr);
}

void AudioEngine::setSource(juce::AudioSource* newSource) {
    audioSourcePlayer.setSource(newSource);
}

} // namespace Zion
