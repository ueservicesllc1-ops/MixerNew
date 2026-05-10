#include "ZionDesktopBridge.h"
#include "Core/ZionCore.h"
#include <utility>
#include <vector>

namespace {

static const char* kZionNativeShim = R"(
(function () {
  if (typeof window.__JUCE__ === "undefined" || !window.__JUCE__.backend) {
    console.warn("[ZionStage] __JUCE__ backend missing — native audio unavailable");
    return;
  }
  const pending = new Map();
  let seq = 0;
  window.__JUCE__.backend.addEventListener("__juce__complete", function (ev) {
    if (!ev || ev.promiseId == null) return;
    const p = pending.get(ev.promiseId);
    if (!p) return;
    pending.delete(ev.promiseId);
    p.resolve(ev.result);
  });
  function callNative(name, params) {
    return new Promise(function (resolve, reject) {
      const resultId = seq++;
      pending.set(resultId, { resolve: resolve, reject: reject });
      try {
        window.__JUCE__.backend.emitEvent("__juce__invoke", {
          name: name,
          params: params,
          resultId: resultId,
        });
      } catch (e) {
        pending.delete(resultId);
        reject(e);
      }
    });
  }
  function b64ToArrayBuffer(b64) {
    if (typeof b64 !== "string") return b64;
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  window.zionNative = {
    isDesktop: true,
    play: function () { return callNative("zionPlay", []); },
    pause: function () { return callNative("zionPause", []); },
    stop: function () { return callNative("zionStop", []); },
    seek: function (sec) { return callNative("zionSeek", [sec]); },
    loadSong: function (tracks) { return callNative("zionLoadSong", [tracks]); },
    setPitchSemitones: function (s) { return callNative("zionSetPitch", [s]); },
    setTempoRatio: function (r) { return callNative("zionSetTempo", [r]); },
    getSnapshot: function () { return callNative("zionGetSnapshot", []); },
    isTrackDownloaded: function (filename) {
      return callNative("zionIsTrackDownloaded", [filename]).then(function (r) { return !!r; });
    },
    saveEncryptedTrack: function (filename, buffer) {
      var u8 = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer);
      var s = "";
      var chunk = 0x8000;
      for (var i = 0; i < u8.length; i += chunk)
        s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunk, u8.length)));
      var b64 = btoa(s);
      return callNative("zionSaveTrack", [filename, b64]);
    },
    readEncryptedTrack: function (filename) {
      return callNative("zionReadTrack", [filename]).then(b64ToArrayBuffer);
    },
  };
})();
)";

} // namespace

juce::WebBrowserComponent::Options ZionDesktopBridge::buildWebOptions(ZionDesktopBridge& b) {
    using Opt = juce::WebBrowserComponent::Options;

    Opt opts;
#if JUCE_WINDOWS && JUCE_USE_WIN_WEBVIEW2
    opts = opts.withBackend(Opt::Backend::webview2);
#endif
    opts = opts.withNativeIntegrationEnabled(true);
    opts = opts.withUserScript(kZionNativeShim);

    opts = opts.withNativeFunction("zionPlay", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::ignoreUnused(args);
        b.ensureAudio();
        b.play();
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionPause", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::ignoreUnused(args);
        b.ensureAudio();
        b.pause();
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionStop", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::ignoreUnused(args);
        b.ensureAudio();
        b.stop();
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionSeek", [&b](const juce::Array<juce::var>& args, auto completion) {
        b.ensureAudio();
        double sec = args.size() > 0 ? static_cast<double>(args[0]) : 0.0;
        b.seek(sec);
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionLoadSong", [&b](const juce::Array<juce::var>& args, auto completion) {
        b.ensureAudio();
        const juce::var tracks = args.size() > 0 ? args[0] : juce::var();
        b.loadSong(tracks);
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionSetPitch", [&b](const juce::Array<juce::var>& args, auto completion) {
        b.ensureAudio();
        float s = args.size() > 0 ? (float) static_cast<double>(args[0]) : 0.f;
        b.setPitchSemitones(s);
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionSetTempo", [&b](const juce::Array<juce::var>& args, auto completion) {
        b.ensureAudio();
        float r = args.size() > 0 ? (float) static_cast<double>(args[0]) : 1.f;
        b.setTempoRatio(r);
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionGetSnapshot", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::ignoreUnused(args);
        completion(b.getSnapshotJson());
    });

    opts = opts.withNativeFunction("zionIsTrackDownloaded", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::String fn = args.size() > 0 ? args[0].toString() : juce::String();
        completion(juce::var(b.isTrackDownloaded(fn)));
    });

    opts = opts.withNativeFunction("zionSaveTrack", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::String fn = args.size() > 0 ? args[0].toString() : juce::String();
        juce::String b64 = args.size() > 1 ? args[1].toString() : juce::String();
        b.saveTrackBase64(fn, b64);
        completion(juce::var());
    });

    opts = opts.withNativeFunction("zionReadTrack", [&b](const juce::Array<juce::var>& args, auto completion) {
        juce::String fn = args.size() > 0 ? args[0].toString() : juce::String();
        completion(b.readTrackBase64(fn));
    });

    return opts;
}

void ZionDesktopBridge::ensureAudio() {
    if (audioReady) return;
    formatManager.registerBasicFormats();
    Zion::ZionCore::getInstance().initialize();
    audioReady = true;
}

void ZionDesktopBridge::play() {
    mixSession.setStemsPlaying(true);
    Zion::ZionCore::getInstance().getTransport().play();
}

void ZionDesktopBridge::pause() {
    mixSession.setStemsPlaying(false);
    Zion::ZionCore::getInstance().getTransport().pause();
}

void ZionDesktopBridge::stop() {
    mixSession.setStemsPlaying(false);
    Zion::ZionCore::getInstance().getTransport().stop();
}

void ZionDesktopBridge::seek(double seconds) {
    Zion::ZionCore::getInstance().getTransport().seek(seconds);
}

void ZionDesktopBridge::loadSong(const juce::var& tracksVar) {
    auto* arr = tracksVar.getArray();
    if (arr == nullptr) {
        juce::Logger::writeToLog("ZionDesktopBridge::loadSong: expected array");
        return;
    }

    auto& transport = Zion::ZionCore::getInstance().getTransport();
    transport.stop();
    transport.setSource(nullptr);

    std::vector<std::pair<juce::String, juce::String>> entries;
    for (const auto& item : *arr) {
        auto* obj = item.getDynamicObject();
        if (obj == nullptr) continue;

        const bool visualOnly = static_cast<bool>(obj->getProperty("isVisualOnly"));
        if (visualOnly) continue;

        juce::String path = obj->getProperty("path").toString();
        if (path.isEmpty()) path = obj->getProperty("filename").toString();
        if (path.isEmpty()) continue;

        juce::String stemName = obj->getProperty("name").toString();
        entries.push_back({ path, stemName });
    }

    if (!mixSession.loadStems(formatManager, getStemsDirectory(), entries)) {
        juce::Logger::writeToLog("ZionDesktopBridge::loadSong: no stems loaded");
        return;
    }

    transport.setSource(&mixSession);
}

void ZionDesktopBridge::setPitchSemitones(float semitones) {
    mixSession.setPitchSemitones(semitones);
}

void ZionDesktopBridge::setTempoRatio(float ratio) {
    mixSession.setTempoRatio(ratio);
}

juce::String ZionDesktopBridge::getSnapshotJson() const {
    const auto& tr = Zion::ZionCore::getInstance().getTransport();
    juce::DynamicObject::Ptr o = new juce::DynamicObject();
    o->setProperty("positionSec", tr.getCurrentPosition());
    o->setProperty("durationSec", tr.getLengthInSeconds());
    return juce::JSON::toString(juce::var(o.get()));
}

juce::File ZionDesktopBridge::getStemsDirectory() const {
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("ZionStage")
        .getChildFile("Stems");
}

bool ZionDesktopBridge::isTrackDownloaded(const juce::String& filename) const {
    if (filename.isEmpty()) return false;
    return getStemsDirectory().getChildFile(filename).existsAsFile();
}

void ZionDesktopBridge::saveTrackBase64(const juce::String& filename, const juce::String& base64) {
    if (filename.isEmpty() || base64.isEmpty()) return;

    juce::MemoryOutputStream mos;
    if (!juce::Base64::convertFromBase64(mos, base64)) {
        juce::Logger::writeToLog("ZionDesktopBridge::saveTrackBase64: invalid base64");
        return;
    }

    const juce::File dir = getStemsDirectory();
    dir.createDirectory();
    dir.getChildFile(filename).replaceWithData(mos.getData(), mos.getDataSize());
}

juce::String ZionDesktopBridge::readTrackBase64(const juce::String& filename) const {
    if (filename.isEmpty()) return {};

    const juce::File f = getStemsDirectory().getChildFile(filename);
    if (!f.existsAsFile()) return {};

    juce::MemoryBlock mb;
    if (!f.loadFileAsData(mb)) return {};

    return juce::Base64::toBase64(mb.getData(), mb.getSize());
}
