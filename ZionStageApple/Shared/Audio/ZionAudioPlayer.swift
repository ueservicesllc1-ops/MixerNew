//
//  ZionAudioPlayer.swift
//  ZionStageApple
//
//  Gestor de audio reactivo SwiftUI (ObservableObject) para la reproducción multitrack.
//

import Foundation
import Combine
import AVFoundation

public class ZionAudioPlayer: ObservableObject {
    public static let shared = ZionAudioPlayer()

    @Published public var currentSong: Song?
    @Published public var isPlaying: Bool = false
    @Published public var currentTime: Double = 0.0
    @Published public var duration: Double = 240.0 // Duración estimada/real
    @Published public var masterVolume: Float = 1.0 {
        didSet { bridge?.setMasterVolume(masterVolume) }
    }
    @Published public var pitchSemitones: Float = 0.0 {
        didSet { bridge?.setPitchSemiTones(pitchSemitones) }
    }
    @Published public var tempoRatio: Float = 1.0 {
        didSet { bridge?.setTempoRatio(tempoRatio) }
    }

    private var bridge: NextGenEngineBridge?
    private var timer: Timer?

    public init() {
        #if targetEnvironment(simulator) || os(iOS) || os(macOS)
        self.bridge = NextGenEngineBridge()
        #endif
        setupAudioSession()
    }

    private func setupAudioSession() {
        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .allowBluetooth])
            try session.setActive(true)
        } catch {
            print("Error al configurar AVAudioSession: \(error.localizedDescription)")
        }
        #endif
    }

    public func loadSong(_ song: Song) {
        self.currentSong = song
        self.currentTime = 0.0
        self.isPlaying = false

        // Serializar stems a JSON para el motor nativo
        let stemDicts = song.stems.map { stem -> [String: Any] in
            return [
                "id": stem.id,
                "path": stem.localPath ?? "",
                "volume": stem.volume,
                "muted": stem.isMuted,
                "solo": stem.isSolo
            ]
        }

        if let jsonData = try? JSONSerialization.data(withJSONObject: stemDicts, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            bridge?.loadSong(withStemsJson: jsonString)
        }
    }

    public func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    public func play() {
        guard currentSong != nil else { return }
        bridge?.play()
        isPlaying = true
        startTimer()
    }

    public func pause() {
        bridge?.pause()
        isPlaying = false
        stopTimer()
    }

    public func stop() {
        bridge?.stop()
        isPlaying = false
        currentTime = 0.0
        stopTimer()
    }

    public func seek(to time: Double) {
        self.currentTime = time
        bridge?.seek(toSeconds: time)
    }

    public func setTrackVolume(id: String, volume: Float) {
        guard var song = currentSong, let idx = song.stems.firstIndex(where: { $0.id == id }) else { return }
        song.stems[idx].volume = volume
        self.currentSong = song
        bridge?.setTrackVolumeWithId(id, volume: volume)
    }

    public func setTrackMute(id: String, muted: Bool) {
        guard var song = currentSong, let idx = song.stems.firstIndex(where: { $0.id == id }) else { return }
        song.stems[idx].isMuted = muted
        self.currentSong = song
        bridge?.setTrackMuteWithId(id, muted: muted)
    }

    public func setTrackSolo(id: String, solo: Bool) {
        guard var song = currentSong, let idx = song.stems.firstIndex(where: { $0.id == id }) else { return }
        song.stems[idx].isSolo = solo
        self.currentSong = song
        bridge?.setTrackSoloWithId(id, solo: solo)
    }

    public func setTrackPan(id: String, pan: Float) {
        guard var song = currentSong, let idx = song.stems.firstIndex(where: { $0.id == id }) else { return }
        song.stems[idx].pan = pan
        self.currentSong = song
        bridge?.setTrackPanWithId(id, pan: pan)
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, self.isPlaying else { return }
            self.currentTime += 0.1
            if self.currentTime >= self.duration {
                self.stop()
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}
