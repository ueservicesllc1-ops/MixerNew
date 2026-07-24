import Foundation
import Capacitor
import AVFoundation

@objc(NextGenMixerPlugin)
public class NextGenMixerPlugin: CAPPlugin {
    
    // We will use our dedicated Capacitor Audio Player instance
    private let audioPlayer = ZionAudioPlayerCapacitor.shared

    @objc func loadSongSession(_ call: CAPPluginCall) {
        guard let tracksArray = call.getArray("tracks") as? [[String: Any]] else {
            call.reject("Missing or invalid 'tracks' array")
            return
        }

        // Map JS tracks to Swift models
        var tracks = [SongTrackCapacitor]()
        for t in tracksArray {
            let id = t["id"] as? String ?? ""
            let path = t["path"] as? String ?? ""
            let name = path.replacingOccurrences(of: ".mp3", with: "").replacingOccurrences(of: ".flac", with: "") // Basic name extraction if needed
            tracks.append(SongTrackCapacitor(id: id, path: path, name: name))
        }

        audioPlayer.loadTracks(tracks)
        
        call.resolve()
    }

    @objc func play(_ call: CAPPluginCall) {
        audioPlayer.play()
        call.resolve()
    }

    @objc func pause(_ call: CAPPluginCall) {
        audioPlayer.pause()
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        audioPlayer.stop()
        call.resolve()
    }
    
    @objc func clearTracks(_ call: CAPPluginCall) {
        audioPlayer.stop()
        call.resolve()
    }

    @objc func seek(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 0.0
        audioPlayer.seek(to: seconds)
        call.resolve()
    }

    @objc func setTrackVolume(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let volume = call.getFloat("volume") ?? 1.0
        audioPlayer.setTrackVolume(id: id, volume: volume)
        call.resolve()
    }

    @objc func setTrackMute(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let muted = call.getBool("muted") ?? false
        audioPlayer.setTrackMute(id: id, muted: muted)
        call.resolve()
    }

    @objc func setTrackSolo(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let solo = call.getBool("solo") ?? false
        audioPlayer.setTrackSolo(id: id, solo: solo)
        call.resolve()
    }

    @objc func setTrackPan(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let pan = call.getFloat("pan") ?? 0.0
        audioPlayer.setTrackPan(id: id, pan: pan)
        call.resolve()
    }

    @objc func setPitchSemiTones(_ call: CAPPluginCall) {
        let semitones = call.getFloat("semitones") ?? 0.0
        audioPlayer.pitchSemitones = semitones
        call.resolve()
    }

    @objc func setTempoRatio(_ call: CAPPluginCall) {
        let ratio = call.getFloat("ratio") ?? 1.0
        audioPlayer.tempoRatio = ratio
        call.resolve()
    }

    @objc func setMasterVolume(_ call: CAPPluginCall) {
        let volume = call.getFloat("volume") ?? 1.0
        audioPlayer.masterVolume = volume
        call.resolve()
    }

    @objc func getSnapshot(_ call: CAPPluginCall) {
        let currentTime = audioPlayer.currentTime
        let duration = audioPlayer.duration
        let isPlaying = audioPlayer.isPlaying
        let vuLevels = audioPlayer.vuLevels

        var jsonObject: [String: Any] = [
            "currentTime": currentTime,
            "duration": duration,
            "isPlaying": isPlaying,
            "levels": vuLevels
        ]

        if let jsonData = try? JSONSerialization.data(withJSONObject: jsonObject, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            call.resolve(["json": jsonString])
        } else {
            call.reject("Could not serialize snapshot")
        }
    }
}
