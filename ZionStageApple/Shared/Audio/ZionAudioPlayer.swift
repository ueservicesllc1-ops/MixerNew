//
//  ZionAudioPlayer.swift
//  ZionStageApple
//
//  Motor de audio nativo 100% Swift con AVAudioEngine.
//  - Carga stems desde archivos locales (descargados por DownloadManager)
//  - Seek/Scrubbing real con AVAudioPlayerNode.scheduleSegment
//  - Pitch con AVAudioUnitTimePitch (semitones → cents)
//  - Tempo con AVAudioUnitTimePitch.rate
//  - Mute / Solo / Pan / Volumen individual por stem
//  - VU Meter real via installTap en mainMixerNode
//  - Auto-stop cuando la canción termina
//  Compatible con iOS 15.0+ y macOS 12.0+
//

import AVFoundation
import Combine

// MARK: - VU Meter Data
public struct VUMeterData {
    public let stemId: String
    public let rmsDB: Float   // dB, -60 a 0
}

public class ZionAudioPlayer: ObservableObject {

    // MARK: - Singleton
    public static let shared = ZionAudioPlayer()

    // MARK: - Estado publicado (SwiftUI reactive)
    @Published public var currentSong: Song? = nil
    @Published public var isPlaying: Bool = false
    @Published public var currentTime: Double = 0.0
    @Published public var duration: Double = 0.0
    @Published public var isLoading: Bool = false
    @Published public var loadProgress: Double = 0.0   // 0.0 a 1.0
    @Published public var loadLabel: String = ""
    @Published public var vuLevels: [String: Float] = [:]  // stemId → dB (-60...0)
    @Published public var waveformPeaks: [Float] = []       // Array de picos para canvas

    @Published public var masterVolume: Float = 1.0 {
        didSet { engine.mainMixerNode.outputVolume = masterVolume }
    }

    @Published public var tempoRatio: Float = 1.0 {
        didSet {
            timePitchNodes.values.forEach { $0.rate = tempoRatio }
        }
    }

    @Published public var pitchSemitones: Float = 0.0 {
        didSet {
            let cents = pitchSemitones * 100.0
            timePitchNodes.values.forEach { $0.pitch = cents }
        }
    }

    // MARK: - Internals
    private let engine = AVAudioEngine()
    private var playerNodes: [String: AVAudioPlayerNode] = [:]
    private var timePitchNodes: [String: AVAudioUnitTimePitch] = [:]
    private var audioFiles: [String: AVAudioFile] = [:]
    private var stemVolumes: [String: Float] = [:]        // volumen real por stem
    private var mutedStems: Set<String> = []
    private var soloedStem: String? = nil

    private var progressTimer: Timer?
    private var vuTap: Bool = false
    private var startSampleTime: AVAudioFramePosition = 0
    private var seekPosition: Double = 0.0                // posición de seek en segundos

    private init() {
        setupEngine()
        configureSession()
    }

    // MARK: - Setup
    private func configureSession() {
        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.allowBluetoothA2DP])
            try session.setActive(true)
        } catch {
            print("[ZionAudioPlayer] AVAudioSession error: \(error.localizedDescription)")
        }
        #endif
    }

    private func setupEngine() {
        // Instalar VU tap en mainMixerNode para leer niveles reales
        let format = engine.mainMixerNode.outputFormat(forBus: 0)
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self = self else { return }
            let rms = self.calculateRMS(buffer: buffer)
            let db = 20 * log10(max(rms, 0.00001))
            let clampedDB = max(-60, min(0, db))
            DispatchQueue.main.async {
                // Distribuir el nivel master a todos los stems (simplificado)
                for stemId in self.playerNodes.keys {
                    self.vuLevels[stemId] = clampedDB
                }
            }
        }
        vuTap = true

        engine.mainMixerNode.outputVolume = masterVolume

        do {
            try engine.start()
        } catch {
            print("[ZionAudioPlayer] AVAudioEngine start error: \(error.localizedDescription)")
        }
    }

    private func calculateRMS(buffer: AVAudioPCMBuffer) -> Float {
        guard let channelData = buffer.floatChannelData else { return 0 }
        let frameCount = Int(buffer.frameLength)
        guard frameCount > 0 else { return 0 }
        var sum: Float = 0
        let data = channelData[0]
        for i in 0..<frameCount {
            sum += data[i] * data[i]
        }
        return sqrt(sum / Float(frameCount))
    }

    // MARK: - Carga de Canción
    public func loadSong(_ song: Song) {
        stop()
        detachAllNodes()
        currentSong = song
        waveformPeaks = []
        seekPosition = 0.0

        let dl = DownloadManager.shared
        var loadedCount = 0
        let criticalTracks = song.tracks.filter {
            $0.name != "__PreviewMix" && !$0.url.isEmpty
        }

        guard !criticalTracks.isEmpty else { return }

        DispatchQueue.main.async {
            self.isLoading = true
            self.loadProgress = 0
            self.loadLabel = "Preparando canción..."
        }

        Task {
            for track in criticalTracks {
                // Obtener path local
                guard let localURL = dl.localURL(songId: song.id, trackName: track.name) else {
                    print("[ZionAudioPlayer] Track no descargado: \(track.name)")
                    loadedCount += 1
                    continue
                }

                do {
                    let audioFile = try AVAudioFile(forReading: localURL)
                    let playerNode = AVAudioPlayerNode()
                    let timePitch = AVAudioUnitTimePitch()
                    timePitch.rate = tempoRatio
                    timePitch.pitch = pitchSemitones * 100.0

                    engine.attach(playerNode)
                    engine.attach(timePitch)
                    engine.connect(playerNode, to: timePitch, format: audioFile.processingFormat)
                    engine.connect(timePitch, to: engine.mainMixerNode, format: audioFile.processingFormat)

                    playerNode.volume = stemVolumes[track.name] ?? 1.0
                    if mutedStems.contains(track.name) { playerNode.volume = 0 }

                    // Pan automático: Click/Guide → izquierda (-1), resto → derecha (+1)
                    // (igual que la app Android con panMode)
                    let nameLow = track.name.lowercased()
                    let isClickOrGuide = nameLow.contains("click") || nameLow.contains("guide") || nameLow.contains("guia")
                    playerNode.pan = isClickOrGuide ? -1.0 : 1.0

                    audioFiles[track.name] = audioFile
                    playerNodes[track.name] = playerNode

                    // Extraer duración real del archivo
                    let fileDuration = Double(audioFile.length) / audioFile.fileFormat.sampleRate
                    if fileDuration > duration {
                        DispatchQueue.main.async { self.duration = fileDuration }
                    }

                    // Generar peaks para la waveform (del primer stem cargado)
                    if waveformPeaks.isEmpty {
                        await generateWaveformPeaks(from: audioFile)
                    }

                } catch {
                    print("[ZionAudioPlayer] Error abriendo \(track.name): \(error.localizedDescription)")
                }

                loadedCount += 1
                let progress = Double(loadedCount) / Double(criticalTracks.count)
                DispatchQueue.main.async {
                    self.loadProgress = progress
                    self.loadLabel = "Cargando \(track.name)..."
                }
            }

            // Programar buffers en todos los players listos
            scheduleAllFromPosition(0)

            DispatchQueue.main.async {
                self.isLoading = false
                self.loadLabel = ""
            }
        }
    }

    // MARK: - Waveform Peaks reales
    private func generateWaveformPeaks(from file: AVAudioFile) async {
        let displayWidth = 800
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: file.processingFormat,
            frameCapacity: AVAudioFrameCount(file.length)
        ) else { return }

        do {
            file.framePosition = 0
            try file.read(into: buffer)
        } catch { return }

        guard let channelData = buffer.floatChannelData else { return }
        let frameCount = Int(buffer.frameLength)
        guard frameCount > 0 else { return }

        let step = max(1, frameCount / displayWidth)
        var peaks = [Float](repeating: 0, count: displayWidth)
        let data = channelData[0]

        for i in 0..<displayWidth {
            var maxVal: Float = 0
            let start = i * step
            let end = min(start + step, frameCount)
            for j in start..<end {
                maxVal = max(maxVal, abs(data[j]))
            }
            peaks[i] = maxVal
        }

        DispatchQueue.main.async {
            self.waveformPeaks = peaks
        }

        // Resetear posición del archivo
        file.framePosition = 0
    }

    // MARK: - Programar audio desde una posición (seek)
    private func scheduleAllFromPosition(_ positionSeconds: Double) {
        for (trackName, playerNode) in playerNodes {
            guard let audioFile = audioFiles[trackName] else { continue }
            let sampleRate = audioFile.fileFormat.sampleRate
            let startFrame = AVAudioFramePosition(positionSeconds * sampleRate)
            let totalFrames = audioFile.length
            let remainingFrames = AVAudioFrameCount(max(0, totalFrames - startFrame))

            guard remainingFrames > 0 else { continue }

            playerNode.scheduleSegment(
                audioFile,
                startingFrame: startFrame,
                frameCount: remainingFrames,
                at: nil,
                completionCallbackType: .dataConsumed
            ) { [weak self] _ in
                DispatchQueue.main.async {
                    // Auto-stop cuando el stem más largo termina
                    if self?.isPlaying == true {
                        self?.stop()
                    }
                }
            }
        }
    }

    // MARK: - Controles de Reproducción
    public func play() {
        guard !isPlaying, !playerNodes.isEmpty else { return }

        if !engine.isRunning {
            try? engine.start()
        }

        for playerNode in playerNodes.values {
            playerNode.play()
        }
        isPlaying = true
        startProgressTimer()
    }

    public func pause() {
        guard isPlaying else { return }
        // Capturar posición actual antes de pausar
        if let firstNode = playerNodes.values.first,
           let lastRenderTime = firstNode.lastRenderTime,
           let playerTime = firstNode.playerTime(forNodeTime: lastRenderTime) {
            let sampleRate = playerTime.sampleRate
            seekPosition += Double(playerTime.sampleTime) / sampleRate
        }
        for playerNode in playerNodes.values { playerNode.pause() }
        isPlaying = false
        stopProgressTimer()
    }

    public func togglePlayPause() {
        if isPlaying { pause() } else { play() }
    }

    public func stop() {
        for playerNode in playerNodes.values { playerNode.stop() }
        isPlaying = false
        seekPosition = 0.0
        DispatchQueue.main.async {
            self.currentTime = 0.0
        }
        stopProgressTimer()
        // Re-programar desde el inicio para permitir reproducir de nuevo
        scheduleAllFromPosition(0)
    }

    public func seek(to time: Double) {
        let wasPlaying = isPlaying
        let clampedTime = max(0, min(duration, time))

        // Detener players sin resetear seekPosition
        for playerNode in playerNodes.values { playerNode.stop() }
        isPlaying = false
        stopProgressTimer()

        seekPosition = clampedTime
        DispatchQueue.main.async { self.currentTime = clampedTime }

        scheduleAllFromPosition(clampedTime)

        if wasPlaying { play() }
    }

    // MARK: - Controles por Stem
    public func setTrackVolume(id stemId: String, volume: Float) {
        // stemId = "songId_trackName" — extraer trackName
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")
        stemVolumes[trackName] = volume
        if !mutedStems.contains(trackName) && soloedStem == nil {
            playerNodes[trackName]?.volume = max(0, min(1.2, volume))
        }
        // Actualizar stem en currentSong para que SwiftUI lo refleje
        if var song = currentSong, let idx = song.tracks.firstIndex(where: { $0.name == trackName }) {
            _ = idx // solo para actualizar el binding
            currentSong = song
        }
    }

    public func setTrackMute(id stemId: String, muted: Bool) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")
        if muted {
            mutedStems.insert(trackName)
            playerNodes[trackName]?.volume = 0
        } else {
            mutedStems.remove(trackName)
            if soloedStem == nil {
                playerNodes[trackName]?.volume = stemVolumes[trackName] ?? 1.0
            }
        }
    }

    public func setTrackSolo(id stemId: String, solo: Bool) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")

        if solo {
            soloedStem = trackName
            for (name, node) in playerNodes {
                node.volume = name == trackName ? (stemVolumes[name] ?? 1.0) : 0
            }
        } else {
            soloedStem = nil
            for (name, node) in playerNodes {
                node.volume = mutedStems.contains(name) ? 0 : (stemVolumes[name] ?? 1.0)
            }
        }
    }

    public func setTrackPan(id stemId: String, pan: Float) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")
        playerNodes[trackName]?.pan = max(-1.0, min(1.0, pan))
    }

    // MARK: - Timer de Progreso
    private func startProgressTimer() {
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateCurrentTime()
        }
    }

    private func stopProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }

    private func updateCurrentTime() {
        guard isPlaying,
              let firstNode = playerNodes.values.first,
              let lastRenderTime = firstNode.lastRenderTime,
              let playerTime = firstNode.playerTime(forNodeTime: lastRenderTime) else { return }

        let elapsed = Double(playerTime.sampleTime) / playerTime.sampleRate
        let total = seekPosition + elapsed
        let clampedTime = max(0, min(duration, total))

        DispatchQueue.main.async {
            self.currentTime = clampedTime
            // Auto-stop cuando llega al final
            if clampedTime >= self.duration - 0.2 && self.duration > 0 {
                self.stop()
            }
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
        audioFiles.removeAll()
        stemVolumes.removeAll()
        mutedStems.removeAll()
        soloedStem = nil
        DispatchQueue.main.async {
            self.duration = 0
            self.currentTime = 0
            self.vuLevels = [:]
        }
    }
}
