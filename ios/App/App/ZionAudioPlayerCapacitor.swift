import AVFoundation
import Foundation

public struct SongTrackCapacitor {
    public let id: String
    public let path: String // file name from Capacitor Data directory
    public let name: String
}

public class ZionAudioPlayerCapacitor {

    // MARK: - Singleton
    public static let shared = ZionAudioPlayerCapacitor()

    // MARK: - State
    public var isPlaying: Bool = false
    public var currentTime: Double = 0.0
    public var duration: Double = 0.0
    public var vuLevels: [String: Float] = [:]

    public var masterVolume: Float = 1.0 {
        didSet { engine.mainMixerNode.outputVolume = masterVolume }
    }

    public var tempoRatio: Float = 1.0 {
        didSet { timePitchNodes.values.forEach { $0.rate = tempoRatio } }
    }

    public var pitchSemitones: Float = 0.0 {
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
    }

    // MARK: - Setup
    private func configureSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.allowBluetoothA2DP, .mixWithOthers])
            try session.setActive(true)
        } catch {
            print("[ZionAudioPlayerCap] AVAudioSession error: \(error.localizedDescription)")
        }
    }

    private func setupEngine() {
        engine.mainMixerNode.outputVolume = masterVolume
        do {
            try engine.start()
        } catch {
            print("[ZionAudioPlayerCap] AVAudioEngine start error: \(error.localizedDescription)")
        }
    }

    // MARK: - Track Loading
    public func loadTracks(_ tracks: [SongTrackCapacitor]) {
        stop()
        detachAllNodes()
        seekPosition = 0.0

        guard !tracks.isEmpty else { return }

        // Resolve Capacitor Directory.Data path (Library/NoCloud)
        let libraryDir = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first!
        let noCloudDir = libraryDir.appendingPathComponent("NoCloud")
        
        var maxDuration: Double = 0

        for track in tracks {
            let localURL = noCloudDir.appendingPathComponent(track.path)
            
            if !FileManager.default.fileExists(atPath: localURL.path) {
                print("[ZionAudioPlayerCap] Track file not found at: \(localURL.path)")
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

                engine.connect(playerNode, to: stemMixer, format: audioFile.processingFormat)
                engine.connect(stemMixer, to: timePitch, format: audioFile.processingFormat)
                engine.connect(timePitch, to: engine.mainMixerNode, format: audioFile.processingFormat)

                let vol = stemVolumes[track.id] ?? 1.0
                stemMixer.outputVolume = mutedStems.contains(track.id) ? 0 : vol

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
                print("[ZionAudioPlayerCap] Error opening \(track.path): \(error.localizedDescription)")
            }
        }
        
        self.duration = maxDuration
        scheduleAllFromPosition(0)
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

    public func stop() {
        for playerNode in playerNodes.values { playerNode.stop() }
        isPlaying = false
        seekPosition = 0.0
        self.currentTime = 0.0
        stopProgressTimer()
        scheduleAllFromPosition(0)
    }

    public func seek(to time: Double) {
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
    public func setTrackVolume(id trackId: String, volume: Float) {
        stemVolumes[trackId] = volume
        if !mutedStems.contains(trackId) && soloedStem == nil {
            stemMixerNodes[trackId]?.outputVolume = max(0, min(1.2, volume))
        }
    }

    public func setTrackMute(id trackId: String, muted: Bool) {
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

    public func setTrackSolo(id trackId: String, solo: Bool) {
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

    public func setTrackPan(id trackId: String, pan: Float) {
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
        
        self.duration = 0
        self.currentTime = 0
        self.vuLevels = [:]
    }
}
