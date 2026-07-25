import AVFoundation
import Foundation
import Combine

class AudioEngineViewModel: ObservableObject {

    // MARK: - Singleton
    public static let shared = AudioEngineViewModel()

    // MARK: - Published State for SwiftUI
    @Published var isPlaying: Bool = false
    @Published var currentTime: Double = 0.0
    @Published var duration: Double = 0.0
    @Published var vuLevels: [String: Float] = [:]
    
    // For tracking which tracks are currently loaded
    @Published var loadedTracks: [SongTrack] = []
    @Published var currentSong: Song? = nil
    
    // Waveform Peaks
    @Published var waveformPeaks: [Float] = []
    @Published var isLoading: Bool = false
    @Published var loadLabel: String = ""

    // MARK: - Mixer Properties
    @Published var masterVolume: Float = 1.0 {
        didSet { engine.mainMixerNode.outputVolume = masterVolume }
    }

    @Published var tempoRatio: Float = 1.0 {
        didSet { timePitchNodes.values.forEach { $0.rate = tempoRatio } }
    }

    @Published var pitchSemitones: Float = 0.0 {
        didSet {
            let cents = pitchSemitones * 100.0
            timePitchNodes.values.forEach { $0.pitch = cents }
        }
    }
    
    @Published var stemVolumes: [String: Float] = [:]
    @Published var mutedStems: Set<String> = []
    @Published var soloedStem: String? = nil
    @Published var stemPans: [String: Float] = [:]

    // MARK: - Internals
    private let engine = AVAudioEngine()
    private var playerNodes: [String: AVAudioPlayerNode] = [:]
    private var stemMixerNodes: [String: AVAudioMixerNode] = [:]
    private var timePitchNodes: [String: AVAudioUnitTimePitch] = [:]
    private var audioFiles: [String: AVAudioFile] = [:]

    private var progressTimer: Timer?
    private var seekPosition: Double = 0.0

    private init() {
        setupEngine()
        configureSession()
    }

    // MARK: - Setup
    private func configureSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.allowBluetoothA2DP, .mixWithOthers])
            try session.setActive(true)
        } catch {
            print("[AudioEngine] AVAudioSession error: \(error.localizedDescription)")
        }
    }

    private func setupEngine() {
        engine.mainMixerNode.outputVolume = masterVolume
        do {
            try engine.start()
        } catch {
            print("[AudioEngine] AVAudioEngine start error: \(error.localizedDescription)")
        }
    }

    // MARK: - Track Loading
    func loadTracks(_ tracks: [SongTrack]) {
        stop()
        detachAllNodes()
        seekPosition = 0.0

        guard !tracks.isEmpty else { return }

        // Check if tracks are downloaded
        let missing = tracks.filter { !DownloadManager.shared.isTrackDownloaded($0) }
        if !missing.isEmpty {
            DispatchQueue.main.async {
                self.isLoading = true
                self.loadLabel = "Descargando stems..."
            }
            DownloadManager.shared.downloadAllTracks(for: tracks) { [weak self] success in
                guard let self = self else { return }
                if success {
                    self.loadTracks(tracks)
                } else {
                    DispatchQueue.main.async {
                        self.isLoading = false
                        self.loadLabel = "Error al descargar"
                    }
                }
            }
            return
        }

        DispatchQueue.main.async {
            self.isLoading = true
            self.loadLabel = "Preparando pistas..."
            self.waveformPeaks = []
        }

        var maxDuration: Double = 0
        
        DispatchQueue.main.async {
            self.loadedTracks = tracks
            self.stemVolumes.removeAll()
            self.mutedStems.removeAll()
            self.soloedStem = nil
            self.stemPans.removeAll()
        }

        for track in tracks {
            let localURL = DownloadManager.shared.getLocalURL(for: track)
            
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

                engine.connect(playerNode, to: stemMixer, format: audioFile.processingFormat)
                engine.connect(stemMixer, to: timePitch, format: audioFile.processingFormat)
                engine.connect(timePitch, to: engine.mainMixerNode, format: audioFile.processingFormat)

                DispatchQueue.main.async {
                    self.stemVolumes[track.id] = 1.0
                    self.stemPans[track.id] = 0.0
                }
                
                stemMixer.outputVolume = 1.0

                // Auto Pan: Click/Guide -> izquierda (-1), resto -> derecha (+1)
                let nameLow = (track.name ?? "").lowercased()
                let isClickGuide = nameLow.contains("click") || nameLow.contains("guide") || nameLow.contains("guia")
                stemMixer.pan = isClickGuide ? -1.0 : 1.0
                
                // Setup VU meter tap
                let stemId = track.id
                stemMixer.installTap(onBus: 0, bufferSize: 1024, format: audioFile.processingFormat) { [weak self] buffer, _ in
                    guard let self = self else { return }
                    let rms = self.calculateRMS(buffer: buffer)
                    let db = 20 * log10(max(rms, 0.00001))
                    let clampedDB = max(-60, min(0, db))
                    DispatchQueue.main.async {
                        self.vuLevels[stemId] = clampedDB
                    }
                }

                audioFiles[track.id] = audioFile
                playerNodes[track.id] = playerNode
                stemMixerNodes[track.id] = stemMixer
                timePitchNodes[track.id] = timePitch

                let fileDuration = Double(audioFile.length) / audioFile.fileFormat.sampleRate
                if fileDuration > maxDuration {
                    maxDuration = fileDuration
                }

            } catch {
                print("[AudioEngine] Error opening \(track.path): \(error.localizedDescription)")
            }
        }
        
        // Find a representative track for waveform (preferably not click/guide)
        let waveformTrack = tracks.first { 
            let name = ($0.name ?? "").lowercased()
            return !name.contains("click") && !name.contains("guide") && !name.contains("guia") && !name.contains("cues")
        } ?? tracks.first
        
        if let repTrack = waveformTrack, let file = audioFiles[repTrack.id] {
            Task {
                await generateWaveformPeaks(from: file)
            }
        }
        
        // Ensure engine is running before scheduling segment
        if !engine.isRunning {
            try? engine.start()
        }
        
        scheduleAllFromPosition(0)
        
        DispatchQueue.main.async {
            self.duration = maxDuration
            self.isLoading = false
            self.loadLabel = ""
        }
    }

    private func generateWaveformPeaks(from file: AVAudioFile) async {
        let displayWidth = 400
        let totalFrames = file.length
        guard totalFrames > 0 else { return }

        let step = max(1, totalFrames / Int64(displayWidth))
        let chunkSize: AVAudioFrameCount = 2048
        guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: chunkSize) else { return }

        var peaks = [Float](repeating: 0, count: displayWidth)

        for i in 0..<displayWidth {
            let targetFrame = Int64(i) * step
            file.framePosition = min(targetFrame, max(0, totalFrames - Int64(chunkSize)))
            do {
                try file.read(into: buffer, frameCount: chunkSize)
                if let channelData = buffer.floatChannelData {
                    let data = channelData[0]
                    var maxVal: Float = 0
                    let count = Int(buffer.frameLength)
                    for j in 0..<count {
                        maxVal = max(maxVal, abs(data[j]))
                    }
                    peaks[i] = maxVal
                }
            } catch {
                // Ignore border read errors
            }
        }

        file.framePosition = 0

        DispatchQueue.main.async {
            self.waveformPeaks = peaks
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

    private func scheduleAllFromPosition(_ positionSeconds: Double) {
        for (trackId, playerNode) in playerNodes {
            guard let audioFile = audioFiles[trackId] else { continue }
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
                completionCallbackType: .dataConsumed,
                completionHandler: nil
            )
        }
    }

    // MARK: - Playback Controls
    func play() {
        guard !isPlaying, !playerNodes.isEmpty else { return }

        if !engine.isRunning {
            try? engine.start()
        }

        // Synchronize all channels using sample-accurate start time
        let delaySeconds: Double = 0.05
        let sampleRate = engine.mainMixerNode.outputFormat(forBus: 0).sampleRate
        let startAVTime: AVAudioTime
        
        if let lastRenderTime = engine.mainMixerNode.lastRenderTime {
            let startSampleTime = lastRenderTime.sampleTime + AVAudioFramePosition(delaySeconds * sampleRate)
            startAVTime = AVAudioTime(sampleTime: startSampleTime, atRate: sampleRate)
        } else {
            startAVTime = AVAudioTime(sampleTime: 0, atRate: sampleRate)
        }

        for playerNode in playerNodes.values {
            playerNode.play(at: startAVTime)
        }
        isPlaying = true
        startProgressTimer()
    }

    func pause() {
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
    }

    func stop() {
        for playerNode in playerNodes.values { playerNode.stop() }
        isPlaying = false
        seekPosition = 0.0
        self.currentTime = 0.0
        stopProgressTimer()
        scheduleAllFromPosition(0)
    }

    func seek(to time: Double) {
        let wasPlaying = isPlaying
        let clampedTime = max(0, min(duration, time))

        for playerNode in playerNodes.values { playerNode.stop() }
        isPlaying = false
        stopProgressTimer()

        seekPosition = clampedTime
        self.currentTime = clampedTime

        scheduleAllFromPosition(clampedTime)

        if wasPlaying { play() }
    }

    // MARK: - Track Controls
    func setTrackVolume(id trackId: String, volume: Float) {
        stemVolumes[trackId] = volume
        if !mutedStems.contains(trackId) && soloedStem == nil {
            stemMixerNodes[trackId]?.outputVolume = max(0, min(1.2, volume))
        }
    }

    func setTrackMute(id trackId: String, muted: Bool) {
        if muted {
            mutedStems.insert(trackId)
            stemMixerNodes[trackId]?.outputVolume = 0
        } else {
            mutedStems.remove(trackId)
            if soloedStem == nil {
                stemMixerNodes[trackId]?.outputVolume = stemVolumes[trackId] ?? 1.0
            }
        }
    }

    func setTrackSolo(id trackId: String, solo: Bool) {
        if solo {
            soloedStem = trackId
            for (name, node) in stemMixerNodes {
                node.outputVolume = name == trackId ? (stemVolumes[name] ?? 1.0) : 0
            }
        } else {
            soloedStem = nil
            for (name, node) in stemMixerNodes {
                node.outputVolume = mutedStems.contains(name) ? 0 : (stemVolumes[name] ?? 1.0)
            }
        }
    }

    func setTrackPan(id trackId: String, pan: Float) {
        stemPans[trackId] = pan
        stemMixerNodes[trackId]?.pan = max(-1.0, min(1.0, pan))
    }

    // MARK: - Timer
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

        self.currentTime = clampedTime
    }

    // MARK: - Cleanup
    private func detachAllNodes() {
        for (_, stemMixer) in stemMixerNodes {
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
        
        DispatchQueue.main.async {
            self.duration = 0
            self.currentTime = 0
            self.vuLevels = [:]
        }
        
        engine.stop()
        do {
            try engine.start()
        } catch {
            print("[AudioEngine] Restart error: \(error.localizedDescription)")
        }
    }
}
