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
            InstanceMethod("getPlaybackSnapshot", &ZionAudioBridge::GetPlaybackSnapshot),
            InstanceMethod("loadEncryptedSong", &ZionAudioBridge::LoadEncryptedSong),
            InstanceMethod("getHardwareId", &ZionAudioBridge::GetHardwareId),
            InstanceMethod("checkProStatus", &ZionAudioBridge::CheckProStatus)
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
        std::vector<std::pair<juce::String, juce::String>> entries;
        const uint32_t len = arr.Length();
        entries.reserve((size_t) len);

        for (uint32_t i = 0; i < len; ++i) {
            Napi::Value item = arr[i];
            juce::String ps;
            juce::String stemName;

            if (item.IsString()) {
                ps = juce::String(item.As<Napi::String>().Utf8Value());
            } else if (item.IsObject()) {
                Napi::Object o = item.As<Napi::Object>();
                if (o.Has("path")) {
                    ps = juce::String(o.Get("path").ToString().Utf8Value());
                } else if (o.Has("filename")) {
                    ps = juce::String(o.Get("filename").ToString().Utf8Value());
                }
                if (o.Has("name")) {
                    stemName = juce::String(o.Get("name").ToString().Utf8Value());
                } else if (o.Has("id")) {
                    juce::String id = juce::String(o.Get("id").ToString().Utf8Value());
                    const int u = id.lastIndexOfChar('_');
                    if (u >= 0 && u + 1 < id.length())
                        stemName = id.substring(u + 1);
                }
            }

            if (ps.isNotEmpty())
                entries.push_back({ ps, stemName });
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

    Napi::Value GetPlaybackSnapshot(const Napi::CallbackInfo& info) {
        juce::ignoreUnused(info);
        const auto& tr = Zion::ZionCore::getInstance().getTransport();
        juce::DynamicObject::Ptr o = new juce::DynamicObject();
        o->setProperty("positionSec", tr.getCurrentPosition());
        o->setProperty("durationSec", tr.getLengthInSeconds());
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
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return ZionAudioBridge::Init(env, exports);
}

NODE_API_MODULE(zion_audio_bridge, InitAll)
