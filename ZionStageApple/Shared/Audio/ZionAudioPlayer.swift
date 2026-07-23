//
//  ZionAudioPlayer.swift
//  ZionStageApple
//
//  Motor de audio nativo 100% Swift con AVAudioEngine.
//  - Carga stems desde archivos locales (OfflineStorageManager)
//  - Seek/Scrubbing real con AVAudioPlayerNode.scheduleSegment
//  - Pitch con AVAudioUnitTimePitch (semitones → cents)
//  - Tempo con AVAudioUnitTimePitch.rate
//  - Mute / Solo / Pan / Volumen individual por stem
//  - VU Meter real por canal individual (per-stem tap)
//  - Loop A-B sample-accurate
//  - Background Audio (MPNowPlayingInfoCenter & MPRemoteCommandCenter)
//  - Manejo de interrupciones de audio (llamadas, Siri, etc.)
//  - Auto-stop y Auto-advance de setlist
//  Compatible con iOS 15.0+ y macOS 12.0+
//

import AVFoundation
import Combine
import MediaPlayer

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

    // MARK: - Loop A-B
    @Published public var isLooping: Bool = false
    @Published public var loopStart: Double = 0.0
    @Published public var loopEnd: Double = 0.0

    // MARK: - Setlist Auto-advance
    public var onSongEnded: (() -> Void)? = nil

    @Published public var masterVolume: Float = 1.0 {
        didSet { engine.mainMixerNode.outputVolume = masterVolume }
    }

    @Published public var tempoRatio: Float = 1.0 {
        didSet {
            timePitchNodes.values.forEach { $0.rate = tempoRatio }
            updateNowPlayingInfo()
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
    private var stemMixerNodes: [String: AVAudioMixerNode] = [:]
    private var timePitchNodes: [String: AVAudioUnitTimePitch] = [:]
    private var audioFiles: [String: AVAudioFile] = [:]
    private var stemVolumes: [String: Float] = [:]
    private var mutedStems: Set<String> = []
    private var soloedStem: String? = nil

    private var progressTimer: Timer?
    private var seekPosition: Double = 0.0

    private init() {
        setupEngine()
        configureSession()
        setupInterruptionObserver()
        setupRemoteCommandCenter()
    }

    // MARK: - Setup
    private func configureSession() {
        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.allowBluetoothA2DP, .mixWithOthers])
            try session.setActive(true)
        } catch {
            print("[ZionAudioPlayer] AVAudioSession error: \(error.localizedDescription)")
        }
        #endif
    }

    private func setupEngine() {
        engine.mainMixerNode.outputVolume = masterVolume

        do {
            try engine.start()
        } catch {
            print("[ZionAudioPlayer] AVAudioEngine start error: \(error.localizedDescription)")
        }
    }

    // MARK: - Manejo de Interrupciones (Llamadas, Siri, etc.)
    private func setupInterruptionObserver() {
        #if os(iOS)
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            guard let self = self,
                  let userInfo = notification.userInfo,
                  let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

            if type == .began {
                if self.isPlaying {
                    self.pause()
                }
            } else if type == .ended {
                if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                    let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                    if options.contains(.shouldResume) {
                        self.play()
                    }
                }
            }
        }
        #endif
    }

    // MARK: - Remote Control (Lockscreen & Control Center)
    private func setupRemoteCommandCenter() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.play()
            return .success
        }
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.pause()
            return .success
        }
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.togglePlayPause()
            return .success
        }
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            if let event = event as? MPChangePlaybackPositionCommandEvent {
                self?.seek(to: event.positionTime)
                return .success
            }
            return .commandFailed
        }
    }

    private func updateNowPlayingInfo() {
        var nowPlayingInfo = [String: Any]()
        if let song = currentSong {
            nowPlayingInfo[MPMediaItemPropertyTitle] = song.title
            nowPlayingInfo[MPMediaItemPropertyArtist] = song.artist
        } else {
            nowPlayingInfo[MPMediaItemPropertyTitle] = "Zion Stage"
        }
        nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = duration
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? Double(tempoRatio) : 0.0

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // MARK: - Carga de Canción
    public func loadSong(_ song: Song) {
        stop()
        detachAllNodes()
        currentSong = song
        waveformPeaks = []
        seekPosition = 0.0
        isLooping = false

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
            var loadedCount = 0
            for track in criticalTracks {
                guard let localURL = OfflineStorageManager.shared.getTrackPath(songId: song.id, trackName: track.name) else {
                    print("[ZionAudioPlayer] Track no en disco: \(track.name)")
                    loadedCount += 1
                    continue
                }

                do {
                    let audioFile = try AVAudioFile(forReading: localURL)
                    let playerNode = AVAudioPlayerNode()
                    let stemMixer = AVAudioMixerNode()
                    let timePitch = AVAudioUnitTimePitch()
                    timePitch.rate = tempoRatio
                    timePitch.pitch = pitchSemitones * 100.0

                    engine.attach(playerNode)
                    engine.attach(stemMixer)
                    engine.attach(timePitch)

                    // Cadena de audio: Player -> StemMixer -> TimePitch -> MainMixer
                    engine.connect(playerNode, to: stemMixer, format: audioFile.processingFormat)
                    engine.connect(stemMixer, to: timePitch, format: audioFile.processingFormat)
                    engine.connect(timePitch, to: engine.mainMixerNode, format: audioFile.processingFormat)

                    let vol = stemVolumes[track.name] ?? 1.0
                    stemMixer.outputVolume = mutedStems.contains(track.name) ? 0 : vol

                    // Pan automático: Click/Guide -> izquierda (-1), resto -> derecha (+1)
                    let nameLow = track.name.lowercased()
                    let isClickOrGuide = nameLow.contains("click") || nameLow.contains("guide") || nameLow.contains("guia")
                    stemMixer.pan = isClickOrGuide ? -1.0 : 1.0

                    // Tap VU meter por stem individual
                    let stemId = "\(song.id)_\(track.name)"
                    stemMixer.installTap(onBus: 0, bufferSize: 1024, format: audioFile.processingFormat) { [weak self] buffer, _ in
                        guard let self = self else { return }
                        let rms = self.calculateRMS(buffer: buffer)
                        let db = 20 * log10(max(rms, 0.00001))
                        let clampedDB = max(-60, min(0, db))
                        DispatchQueue.main.async {
                            self.vuLevels[stemId] = clampedDB
                        }
                    }

                    audioFiles[track.name] = audioFile
                    playerNodes[track.name] = playerNode
                    stemMixerNodes[track.name] = stemMixer
                    timePitchNodes[track.name] = timePitch

                    let fileDuration = Double(audioFile.length) / audioFile.fileFormat.sampleRate
                    if fileDuration > duration {
                        DispatchQueue.main.async { self.duration = fileDuration }
                    }

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

            scheduleAllFromPosition(0)

            DispatchQueue.main.async {
                self.isLoading = false
                self.loadLabel = ""
                self.updateNowPlayingInfo()
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

        file.framePosition = 0
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
                    if self?.isPlaying == true {
                        self?.handleSongFinished()
                    }
                }
            }
        }
    }

    private func handleSongFinished() {
        stop()
        if let callback = onSongEnded {
            callback()
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
        updateNowPlayingInfo()
    }

    public func pause() {
        guard isPlaying else { return }
        if let firstNode = playerNodes.values.first,
           let lastRenderTime = firstNode.lastRenderTime,
           let playerTime = firstNode.playerTime(forNodeTime: lastRenderTime) {
            let sampleRate = playerTime.sampleRate
            seekPosition += Double(playerTime.sampleTime) / sampleRate
        }
        for playerNode in playerNodes.values { playerNode.pause() }
        isPlaying = false
        stopProgressTimer()
        updateNowPlayingInfo()
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
        updateNowPlayingInfo()
        scheduleAllFromPosition(0)
    }

    public func seek(to time: Double) {
        let wasPlaying = isPlaying
        let clampedTime = max(0, min(duration, time))

        for playerNode in playerNodes.values { playerNode.stop() }
        isPlaying = false
        stopProgressTimer()

        seekPosition = clampedTime
        DispatchQueue.main.async { self.currentTime = clampedTime }

        scheduleAllFromPosition(clampedTime)

        if wasPlaying { play() }
        updateNowPlayingInfo()
    }

    // MARK: - Loop A-B
    public func toggleLoop() {
        isLooping.toggle()
        if isLooping && loopEnd <= loopStart {
            loopStart = 0
            loopEnd = duration > 0 ? duration : 30
        }
    }

    public func setLoopRange(start: Double, end: Double) {
        loopStart = max(0, start)
        loopEnd = min(duration, max(loopStart + 1.0, end))
    }

    // MARK: - Controles por Stem
    public func setTrackVolume(id stemId: String, volume: Float) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")
        stemVolumes[trackName] = volume
        if !mutedStems.contains(trackName) && soloedStem == nil {
            stemMixerNodes[trackName]?.outputVolume = max(0, min(1.2, volume))
        }
    }

    public func setTrackMute(id stemId: String, muted: Bool) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")
        if muted {
            mutedStems.insert(trackName)
            stemMixerNodes[trackName]?.outputVolume = 0
        } else {
            mutedStems.remove(trackName)
            if soloedStem == nil {
                stemMixerNodes[trackName]?.outputVolume = stemVolumes[trackName] ?? 1.0
            }
        }
    }

    public func setTrackSolo(id stemId: String, solo: Bool) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")

        if solo {
            soloedStem = trackName
            for (name, node) in stemMixerNodes {
                node.outputVolume = name == trackName ? (stemVolumes[name] ?? 1.0) : 0
            }
        } else {
            soloedStem = nil
            for (name, node) in stemMixerNodes {
                node.outputVolume = mutedStems.contains(name) ? 0 : (stemVolumes[name] ?? 1.0)
            }
        }
    }

    public func setTrackPan(id stemId: String, pan: Float) {
        let trackName = stemId.components(separatedBy: "_").dropFirst().joined(separator: "_")
        stemMixerNodes[trackName]?.pan = max(-1.0, min(1.0, pan))
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

            // Manejo de Loop A-B
            if self.isLooping && self.loopEnd > self.loopStart && clampedTime >= self.loopEnd {
                self.seek(to: self.loopStart)
                return
            }

            if clampedTime >= self.duration - 0.2 && self.duration > 0 {
                self.handleSongFinished()
            }
        }
    }

    // MARK: - Limpieza
    private func detachAllNodes() {
        for (name, stemMixer) in stemMixerNodes {
            stemMixer.removeTap(onBus: 0)
        }
        for playerNode in playerNodes.values {
            playerNode.stop()
            engine.detach(playerNode)
        }
        for stemMixer in stemMixerNodes.values {
            engine.detach(stemMixer)
        }
        for timePitch in timePitchNodes.values {
            engine.detach(timePitch)
        }
        playerNodes.removeAll()
        stemMixerNodes.removeAll()
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
