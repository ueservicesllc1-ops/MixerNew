#include <napi.h>
#include "Core/ZionCore.h"
#include "Bridge/DesktopMixSession.h"
#include <juce_core/juce_core.h>
#include <utility>
#include <vector>

class ZionAudioBridge : public Napi::ObjectWrap<ZionAudioBridge> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "ZionAudioBridge", {
            InstanceMethod("initialize", &ZionAudioBridge::Initialize),
            InstanceMethod("play", &ZionAudioBridge::Play),
            InstanceMethod("pause", &ZionAudioBridge::Pause),
            InstanceMethod("stop", &ZionAudioBridge::Stop),
            InstanceMethod("seek", &ZionAudioBridge::Seek),
            InstanceMethod("loadStemsFromPaths", &ZionAudioBridge::LoadStemsFromPaths),
            InstanceMethod("setPitchSemitones", &ZionAudioBridge::SetPitchSemitones),
            InstanceMethod("setTempoRatio", &ZionAudioBridge::SetTempoRatio),
            InstanceMethod("setTrackVolume", &ZionAudioBridge::SetTrackVolume),
            InstanceMethod("setTrackMute", &ZionAudioBridge::SetTrackMute),
            InstanceMethod("setTrackSolo", &ZionAudioBridge::SetTrackSolo),
            InstanceMethod("getPlaybackSnapshot", &ZionAudioBridge::GetPlaybackSnapshot),
            InstanceMethod("loadEncryptedSong", &ZionAudioBridge::LoadEncryptedSong),
            InstanceMethod("getHardwareId", &ZionAudioBridge::GetHardwareId),
            InstanceMethod("checkProStatus", &ZionAudioBridge::CheckProStatus),
            InstanceMethod("getAudioOutputDevicesJson", &ZionAudioBridge::GetAudioOutputDevicesJson),
            InstanceMethod("getAudioOutputStatusJson", &ZionAudioBridge::GetAudioOutputStatusJson),
            InstanceMethod("applyAudioRoutingJson", &ZionAudioBridge::ApplyAudioRoutingJson)
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("ZionAudioBridge", func);
        return exports;
    }

    explicit ZionAudioBridge(const Napi::CallbackInfo& info) : Napi::ObjectWrap<ZionAudioBridge>(info) {}

private:
    DesktopMixSession mixSession;
    juce::AudioFormatManager formatManager;

    Napi::Value Initialize(const Napi::CallbackInfo& info) {
        formatManager.registerBasicFormats();
        Zion::ZionCore::getInstance().initialize();
        return info.Env().Undefined();
    }

    Napi::Value Play(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        mixSession.setStemsPlaying(true);
        Zion::ZionCore::getInstance().getTransport().play();
        return info.Env().Undefined();
    }

    Napi::Value Pause(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        mixSession.setStemsPlaying(false);
        Zion::ZionCore::getInstance().getTransport().pause();
        return info.Env().Undefined();
    }

    Napi::Value Stop(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        mixSession.setStemsPlaying(false);
        Zion::ZionCore::getInstance().getTransport().stop();
        return info.Env().Undefined();
    }

    Napi::Value Seek(const Napi::CallbackInfo& info) {
        double sec = info.Length() > 0 ? info[0].As<Napi::Number>().DoubleValue() : 0.0;
        Zion::ZionCore::getInstance().getTransport().seek(sec);
        return info.Env().Undefined();
    }

    Napi::Value LoadStemsFromPaths(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsArray()) {
            return Napi::Boolean::New(env, false);
        }

        Napi::Array arr = info[0].As<Napi::Array>();
        std::vector<DesktopStemLoadSpec> entries;
        const uint32_t len = arr.Length();
        entries.reserve((size_t) len);

        for (uint32_t i = 0; i < len; ++i) {
            Napi::Value item = arr[i];
            DesktopStemLoadSpec row;

            if (item.IsString()) {
                row.path = juce::String(item.As<Napi::String>().Utf8Value());
            } else if (item.IsObject()) {
                Napi::Object o = item.As<Napi::Object>();
                if (o.Has("path")) {
                    row.path = juce::String(o.Get("path").ToString().Utf8Value());
                } else if (o.Has("filename")) {
                    row.path = juce::String(o.Get("filename").ToString().Utf8Value());
                }
                if (o.Has("id"))
                    row.clientTrackId = juce::String(o.Get("id").ToString().Utf8Value());
                if (o.Has("name")) {
                    row.stemNameHint = juce::String(o.Get("name").ToString().Utf8Value());
                } else if (row.clientTrackId.isNotEmpty()) {
                    const int u = row.clientTrackId.lastIndexOfChar('_');
                    if (u >= 0 && u + 1 < row.clientTrackId.length())
                        row.stemNameHint = row.clientTrackId.substring(u + 1);
                }
            }

            if (row.path.isNotEmpty())
                entries.push_back(row);
        }

        if (entries.empty()) {
            return Napi::Boolean::New(env, false);
        }

        auto& transport = Zion::ZionCore::getInstance().getTransport();
        transport.stop();
        transport.setSource(nullptr);

        juce::File stemsRoot;
        if (!mixSession.loadStems(formatManager, stemsRoot, entries)) {
            return Napi::Boolean::New(env, false);
        }

        transport.setSource(&mixSession);
        return Napi::Boolean::New(env, true);
    }

    Napi::Value SetPitchSemitones(const Napi::CallbackInfo& info) {
        float s = 0.f;
        if (info.Length() > 0) {
            Napi::Value v = info[0];
            if (v.IsNumber())
                s = (float) v.As<Napi::Number>().DoubleValue();
            else
                s = (float) v.ToNumber().DoubleValue();
        }
        mixSession.setPitchSemitones(s);
        return info.Env().Undefined();
    }

    Napi::Value SetTempoRatio(const Napi::CallbackInfo& info) {
        float r = 1.f;
        if (info.Length() > 0) {
            Napi::Value v = info[0];
            if (v.IsNumber())
                r = (float) v.As<Napi::Number>().DoubleValue();
            else
                r = (float) v.ToNumber().DoubleValue();
        }
        mixSession.setTempoRatio(r);
        return info.Env().Undefined();
    }

    Napi::Value SetTrackVolume(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 2) return env.Undefined();
        const std::string id = info[0].IsString() ? info[0].As<Napi::String>().Utf8Value() : std::string();
        float v = 1.f;
        if (info.Length() > 1) {
            Napi::Value x = info[1];
            if (x.IsNumber()) v = (float) x.As<Napi::Number>().DoubleValue();
            else v = (float) x.ToNumber().DoubleValue();
        }
        mixSession.setTrackVolumeForClientId(juce::String(id), v);
        return env.Undefined();
    }

    Napi::Value SetTrackMute(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 2) return env.Undefined();
        const std::string id = info[0].IsString() ? info[0].As<Napi::String>().Utf8Value() : std::string();
        const bool m = info[1].IsBoolean() ? info[1].As<Napi::Boolean>().Value() : info[1].ToBoolean().Value();
        mixSession.setTrackMutedForClientId(juce::String(id), m);
        return env.Undefined();
    }

    Napi::Value SetTrackSolo(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 2) return env.Undefined();
        const std::string id = info[0].IsString() ? info[0].As<Napi::String>().Utf8Value() : std::string();
        const bool s = info[1].IsBoolean() ? info[1].As<Napi::Boolean>().Value() : info[1].ToBoolean().Value();
        mixSession.setTrackSoloForClientId(juce::String(id), s);
        return env.Undefined();
    }

    Napi::Value GetPlaybackSnapshot(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        const auto& tr = Zion::ZionCore::getInstance().getTransport();
        juce::DynamicObject::Ptr o = new juce::DynamicObject();
        o->setProperty("positionSec", tr.getCurrentPosition());
        o->setProperty("durationSec", tr.getLengthInSeconds());
        o->setProperty("trackLevelsCsv", mixSession.getTrackLevelsCsv());
        const juce::String json = juce::JSON::toString(juce::var(o.get()));
        return Napi::String::New(info.Env(), json.toStdString());
    }

    Napi::Value LoadEncryptedSong(const Napi::CallbackInfo& info) {
        std::string path = info[0].As<Napi::String>().Utf8Value();
        juce::File file(path);

        if (file.existsAsFile()) {
            return Napi::Boolean::New(info.Env(), true);
        }
        return Napi::Boolean::New(info.Env(), false);
    }

    Napi::Value GetHardwareId(const Napi::CallbackInfo& info) {
        juce::String hid = juce::SystemStats::getComputerName() + "_" + juce::SystemStats::getOperatingSystemName();
        return Napi::String::New(info.Env(), hid.toStdString());
    }

    Napi::Value CheckProStatus(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        return Napi::Boolean::New(info.Env(), false);
    }

    Napi::Value GetAudioOutputDevicesJson(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        const juce::String j = Zion::ZionCore::getInstance().getEngine().getOutputAudioDevicesJson();
        return Napi::String::New(info.Env(), j.toStdString());
    }

    Napi::Value GetAudioOutputStatusJson(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        const juce::String j = Zion::ZionCore::getInstance().getEngine().getCurrentAudioOutputStatusJson();
        return Napi::String::New(info.Env(), j.toStdString());
    }

    Napi::Value ApplyAudioRoutingJson(const Napi::CallbackInfo& info) {
        std::string jsonStr;
        if (info.Length() > 0 && info[0].IsString())
            jsonStr = info[0].As<Napi::String>().Utf8Value();
        const juce::String j(jsonStr);

        auto& eng = Zion::ZionCore::getInstance().getEngine();
        const auto parsed = juce::JSON::parse(j);
        if (parsed.isObject()) {
            if (auto* o = parsed.getDynamicObject()) {
                const bool hasDev =
                    o->hasProperty("deviceName") && o->getProperty("deviceName").toString().isNotEmpty();
                const bool hasCh = o->hasProperty("outputChannelCount");
                if (hasDev || hasCh) {
                    const juce::String dev = hasDev ? o->getProperty("deviceName").toString() : juce::String();
                    int nch = hasCh ? (int) o->getProperty("outputChannelCount") : 16;
                    nch = juce::jlimit(2, 16, nch);
                    if ((nch % 2) != 0)
                        --nch;
                    eng.setAudioOutputDeviceWithChannels(dev, nch);
                }
            }
        }

        mixSession.applyRoutingFromJson(j);
        return Napi::Boolean::New(info.Env(), true);
    }
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return ZionAudioBridge::Init(env, exports);
}

NODE_API_MODULE(zion_audio_bridge, InitAll)
