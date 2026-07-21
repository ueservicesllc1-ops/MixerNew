//
//  ZionAudioPlayer.swift
//  ZionStageApple
//
//  Motor de audio nativo 100% Swift usando AVAudioEngine.
//  Multitrack con control individual de volumen, mute, solo, pan y pitch/tempo.
//  Compatible iOS 15.0+ y macOS 12.0+
//

import AVFoundation
import Combine

@available(iOS 15.0, macOS 12.0, *)
public class ZionAudioPlayer: ObservableObject {

    // MARK: - Singleton
    public static let shared = ZionAudioPlayer()

    // MARK: - Estado publicado (SwiftUI reactive)
    @Published public var currentSong: Song? = nil
    @Published public var isPlaying: Bool = false
    @Published public var currentTime: Double = 0.0
    @Published public var duration: Double = 0.0
    
    @Published public var masterVolume: Float = 1.0 {
        didSet {
            mixerNode.outputVolume = masterVolume
        }
    }
    
    @Published public var tempoRatio: Float = 1.0 {
        didSet {
            for node in timePitchNodes.values {
                node.rate = tempoRatio
            }
        }
    }
    
    @Published public var pitchSemitones: Float = 0.0 {
        didSet {
            // AVAudioUnitTimePitch.pitch se especifica en cents (1 semitono = 100 cents)
            let cents = pitchSemitones * 100.0
            for node in timePitchNodes.values {
                node.pitch = cents
            }
        }
    }

    // MARK: - AVAudio internals
    private let engine = AVAudioEngine()
    private var playerNodes: [String: AVAudioPlayerNode] = [:]
    private var timePitchNodes: [String: AVAudioUnitTimePitch] = [:]
    private var mixerNode: AVAudioMixerNode = AVAudioMixerNode()
    private var timer: Timer?

    private init() {
        setupEngine()
        configureSession()
    }

    // MARK: - Configuración de sesión de audio

    private func configureSession() {
        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .allowBluetoothHFP])
            try session.setActive(true)
        } catch {
            print("ZionAudioPlayer: Error al configurar AVAudioSession: \(error.localizedDescription)")
        }
        #endif
    }

    private func setupEngine() {
        engine.attach(mixerNode)
        engine.connect(mixerNode, to: engine.mainMixerNode, format: nil)
        do {
            try engine.start()
        } catch {
            print("ZionAudioPlayer: Error al iniciar AVAudioEngine: \(error.localizedDescription)")
        }
    }

    // MARK: - Carga de Canción

    public func loadSong(_ song: Song) {
        stop()
        detachAllNodes()

        currentSong = song
        duration = 180.0 // Duración inicial estimada

        for stem in song.stems {
            guard !stem.audioUrl.isEmpty else { continue }

            let playerNode = AVAudioPlayerNode()
            let timePitch = AVAudioUnitTimePitch()
            timePitch.rate = tempoRatio
            timePitch.pitch = pitchSemitones * 100.0

            engine.attach(playerNode)
            engine.attach(timePitch)
            engine.connect(playerNode, to: timePitch, format: nil)
            engine.connect(timePitch, to: mixerNode, format: nil)

            playerNodes[stem.id] = playerNode
            timePitchNodes[stem.id] = timePitch
        }

        print("ZionAudioPlayer: Canción '\(song.title)' cargada con \(song.stems.count) pistas.")
    }

    // MARK: - Controles de Reproducción

    public func play() {
        guard currentSong != nil, !isPlaying else { return }
        for playerNode in playerNodes.values {
            playerNode.play()
        }
        isPlaying = true
        startTimer()
    }

    public func pause() {
        for playerNode in playerNodes.values {
            playerNode.pause()
        }
        isPlaying = false
        stopTimer()
    }

    public func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    public func stop() {
        for playerNode in playerNodes.values {
            playerNode.stop()
        }
        isPlaying = false
        currentTime = 0.0
        stopTimer()
    }

    public func seek(to time: Double) {
        currentTime = max(0, min(duration, time))
    }

    // MARK: - Controles por Pista / Stem

    public func setTrackVolume(id stemId: String, volume: Float) {
        playerNodes[stemId]?.volume = max(0, min(1.2, volume))
        if var song = currentSong,
           let idx = song.stems.firstIndex(where: { $0.id == stemId }) {
            song.stems[idx].volume = volume
            currentSong = song
        }
    }

    public func setTrackMute(id stemId: String, muted: Bool) {
        playerNodes[stemId]?.volume = muted ? 0.0 : (currentSong?.stems.first(where: { $0.id == stemId })?.volume ?? 1.0)
        if var song = currentSong,
           let idx = song.stems.firstIndex(where: { $0.id == stemId }) {
            song.stems[idx].isMuted = muted
            currentSong = song
        }
    }

    public func setTrackSolo(id stemId: String, solo: Bool) {
        guard var song = currentSong else { return }
        for i in 0..<song.stems.count {
            let isSoloTarget = song.stems[i].id == stemId
            song.stems[i].isSolo = isSoloTarget && solo
            let vol: Float = solo ? (isSoloTarget ? 1.0 : 0.0) : song.stems[i].volume
            playerNodes[song.stems[i].id]?.volume = vol
        }
        currentSong = song
    }

    public func setTrackPan(id stemId: String, pan: Float) {
        playerNodes[stemId]?.pan = max(-1.0, min(1.0, pan))
        if var song = currentSong,
           let idx = song.stems.firstIndex(where: { $0.id == stemId }) {
            song.stems[idx].pan = pan
            currentSong = song
        }
    }

    // MARK: - Limpieza

    private func detachAllNodes() {
        for playerNode in playerNodes.values {
            playerNode.stop()
            engine.detach(playerNode)
        }
        for timePitch in timePitchNodes.values {
            engine.detach(timePitch)
        }
        playerNodes.removeAll()
        timePitchNodes.removeAll()
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            guard let self = self, self.isPlaying else { return }
            self.currentTime += 0.25
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}
