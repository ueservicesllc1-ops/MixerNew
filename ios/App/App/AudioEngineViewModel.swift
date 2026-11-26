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
    
    // Real Waveform Peaks (per song, cached on disk)
    @Published var waveformPeaks: [Float] = []
    @Published var isLoading: Bool = false
    @Published var loadLabel: String = ""

    // Stereo Split Mode (true = Click/Guide R, Music L; false = All Center Stereo)
    @Published var splitRoutingMode: Bool = true

    // MARK: - Mixer Properties
    @Published var masterVolume: Float = 1.0 {
        didSet { engine.mainMixerNode.outputVolume = masterVolume }
    }

    @Published var tempoRatio: Float = 1.0 {
        didSet {
            timePitchNodes.values.forEach { $0.rate = tempoRatio }
        }
    }

    @Published var pitchSemitones: Float = 0.0 {
        didSet {
            let cents = pitchSemitones * 100.0
            for (trackId, timePitchNode) in timePitchNodes {
                if let track = loadedTracks.first(where: { $0.id == trackId }) {
                    let isClickGuide = Self.isClickOrGuideTrack(track.name)
                    timePitchNode.pitch = isClickGuide ? 0.0 : cents
                } else {
                    timePitchNode.pitch = cents
                }
            }
        }
    }
    
    @Published var stemVolumes: [String: Float] = [:]
    @Published var mutedStems: Set<String> = []
    @Published var soloedStems: Set<String> = []
    @Published var stemPans: [String: Float] = [:]

    // MARK: - Internals
    private let engine = AVAudioEngine()
    private var playerNodes: [String: AVAudioPlayerNode] = [:]
    private var stemMixerNodes: [String: AVAudioMixerNode] = [:]
    private var timePitchNodes: [String: AVAudioUnitTimePitch] = [:]
    private var audioFiles: [String: AVAudioFile] = [:]

    // Serial queue for non-blocking file opening & pre-warming
    private let audioIOQueue = DispatchQueue(label: "com.zionstage.audioio", qos: .userInitiated)
    private let waveformQueue = DispatchQueue(label: "com.zionstage.waveform", qos: .userInitiated)
    private var loadGeneration: Int = 0

    // Pre-warmed AVAudioFile handles for the NEXT song in the setlist (instant switching!)
    private var prewarmedSongId: String? = nil
    private var prewarmedFiles: [String: AVAudioFile] = [:]

    private var progressTimer: Timer?
    private var seekPosition: Double = 0.0

    private init() {
        setupEngine()
        configureSession()
    }

    // MARK: - Helpers
    static func isClickOrGuideTrack(_ name: String?) -> Bool {
        let low = (name ?? "").lowercased()
        return low.contains("click") || low.contains("guide") || low.contains("guia") || low.contains("guía") || low.contains("cue") || low.contains("metronom")
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

    // MARK: - High-Level Song Loading (Fast, Non-Blocking, Real Waveform + Next-Song Prewarm)
    func loadSong(_ song: Song, inSetlist setlist: Setlist? = nil) {
        DispatchQueue.main.async {
            self.currentSong = song
        }
        let tracks = song.tracks ?? []
        loadTracks(tracks, songId: song.id, songForWaveform: song, activeSetlist: setlist)
    }

    // Backward-compatible overload
    func loadTracks(_ tracks: [SongTrack]) {
        loadTracks(tracks, songId: currentSong?.id, songForWaveform: currentSong, activeSetlist: nil)
    }

    private func loadTracks(_ tracks: [SongTrack], songId: String?, songForWaveform: Song?, activeSetlist: Setlist?) {
        loadGeneration += 1
        let myGen = loadGeneration

        stop()
        detachAllNodes()
        seekPosition = 0.0

        // Immediately show cached real waveform for this song, or clear old song's waveform!
        let cachedPeaks: [Float]? = songId.flatMap { DownloadManager.shared.getCachedWaveform(for: $0) }
        DispatchQueue.main.async {
            self.waveformPeaks = cachedPeaks ?? []
        }

        guard !tracks.isEmpty else {
            DispatchQueue.main.async {
                self.loadedTracks.removeAll()
                self.isLoading = false
                self.loadLabel = "Canción sin pistas"
            }
            return
        }

        // Sort tracks so Click / Guia / Guide / Cue are ALWAYS FIRST
        let sortedTracks = tracks.sorted { a, b in
            let isClickA = Self.isClickOrGuideTrack(a.name)
            let isClickB = Self.isClickOrGuideTrack(b.name)
            if isClickA && !isClickB { return true }
            if !isClickA && isClickB { return false }
            return (a.name ?? "") < (b.name ?? "")
        }

        // Check if any stems are missing locally
        let missing = sortedTracks.filter { !DownloadManager.shared.isTrackDownloaded($0) }
        if !missing.isEmpty {
            DispatchQueue.main.async {
                self.isLoading = true
                self.loadLabel = "Descargando \(missing.count) pista(s)..."
            }
            DownloadManager.shared.downloadAllTracks(for: sortedTracks, maxConcurrent: 3) { [weak self] success in
                guard let self = self, self.loadGeneration == myGen else { return }
                if success {
                    self.loadTracks(sortedTracks, songId: songId, songForWaveform: songForWaveform, activeSetlist: activeSetlist)
                } else {
                    // Even if 1 track failed, try loading whatever tracks succeeded
                    let available = sortedTracks.filter { DownloadManager.shared.isTrackDownloaded($0) }
                    if !available.isEmpty {
                        self.loadTracks(available, songId: songId, songForWaveform: songForWaveform, activeSetlist: activeSetlist)
                    } else {
                        DispatchQueue.main.async {
                            self.isLoading = false
                            self.loadLabel = "Error al descargar pistas"
                        }
                    }
                }
            }
            return
        }

        DispatchQueue.main.async {
            self.isLoading = true
            self.loadLabel = "Preparando pistas..."
            self.tempoRatio = 1.0
            self.pitchSemitones = 0.0
        }

        // Open AVAudioFiles off the Main Thread (or reuse pre-warmed handles for instant switching!)
        audioIOQueue.async { [weak self] in
            guard let self = self, self.loadGeneration == myGen else { return }

            var openedFiles: [(SongTrack, AVAudioFile)] = []
            var maxDuration: Double = 0

            let usePrewarmed = (songId != nil && self.prewarmedSongId == songId)

            for track in sortedTracks {
                if self.loadGeneration != myGen { return }

                if usePrewarmed, let warmFile = self.prewarmedFiles[track.id] {
                    openedFiles.append((track, warmFile))
                    let dur = Double(warmFile.length) / warmFile.fileFormat.sampleRate
                    if dur > maxDuration { maxDuration = dur }
                    continue
                }

                let localURL = DownloadManager.shared.getLocalURL(for: track)
                do {
                    let audioFile = try AVAudioFile(forReading: localURL)
                    openedFiles.append((track, audioFile))
                    let dur = Double(audioFile.length) / audioFile.fileFormat.sampleRate
                    if dur > maxDuration { maxDuration = dur }
                } catch {
                    print("[AudioEngine] Error opening \(track.name ?? track.id): \(error.localizedDescription)")
                    // Mark corrupt file so next load re-downloads it
                    DownloadManager.shared.removeCorruptTrack(track)
                }
            }

            if usePrewarmed {
                self.prewarmedSongId = nil
                self.prewarmedFiles.removeAll()
            }

            // Attach & connect audio graph on main thread to stay synchronized with UI state
            DispatchQueue.main.async { [weak self] in
                guard let self = self, self.loadGeneration == myGen else { return }

                self.loadedTracks = openedFiles.map { $0.0 }
                self.stemVolumes.removeAll()
                self.mutedStems.removeAll()
                self.soloedStems.removeAll()
                self.stemPans.removeAll()

                for (track, audioFile) in openedFiles {
                    let playerNode = AVAudioPlayerNode()
                    let stemMixer = AVAudioMixerNode()
                    let timePitch = AVAudioUnitTimePitch()

                    let isClickGuide = Self.isClickOrGuideTrack(track.name)
                    timePitch.rate = self.tempoRatio
                    timePitch.pitch = isClickGuide ? 0.0 : (self.pitchSemitones * 100.0)

                    self.engine.attach(playerNode)
                    self.engine.attach(stemMixer)
                    self.engine.attach(timePitch)

                    self.engine.connect(playerNode, to: stemMixer, format: audioFile.processingFormat)
                    self.engine.connect(stemMixer, to: timePitch, format: audioFile.processingFormat)
                    self.engine.connect(timePitch, to: self.engine.mainMixerNode, format: audioFile.processingFormat)

                    let defaultPan: Float = self.splitRoutingMode ? (isClickGuide ? 1.0 : -1.0) : 0.0
                    self.stemVolumes[track.id] = 1.0
                    self.stemPans[track.id] = defaultPan

                    stemMixer.outputVolume = 1.0
                    stemMixer.pan = defaultPan

                    // VU meter tap (throttled lightly to keep UI buttery smooth)
                    let stemId = track.id
                    stemMixer.installTap(onBus: 0, bufferSize: 2048, format: audioFile.processingFormat) { [weak self] buffer, _ in
                        guard let self = self else { return }
                        let rms = self.calculateRMS(buffer: buffer)
                        let db = 20 * log10(max(rms, 0.00001))
                        let clampedDB = max(-60, min(0, db))
                        DispatchQueue.main.async {
                            self.vuLevels[stemId] = clampedDB
                        }
                    }

                    self.audioFiles[track.id] = audioFile
                    self.playerNodes[track.id] = playerNode
                    self.stemMixerNodes[track.id] = stemMixer
                    self.timePitchNodes[track.id] = timePitch
                }

                if !self.engine.isRunning {
                    try? self.engine.start()
                }

                self.scheduleAllFromPosition(0)
                self.duration = maxDuration
                self.isLoading = false
                self.loadLabel = ""

                // If waveform wasn't cached yet, compute REAL composite multi-stem waveform asynchronously
                if cachedPeaks == nil, let songObj = songForWaveform {
                    self.waveformQueue.async { [weak self] in
                        let realPeaks = Self.computeAndCacheWaveform(for: songObj)
                        DispatchQueue.main.async {
                            guard let self = self, self.loadGeneration == myGen else { return }
                            self.waveformPeaks = realPeaks
                        }
                    }
                }

                // Trigger continuous preloading & pre-warming for the NEXT song in the setlist
                if let setlist = activeSetlist {
                    DownloadManager.shared.downloadSetlist(setlist: setlist, prioritizingAfter: songId)
                    self.prewarmNextSong(after: songId, in: setlist)
                }
            }
        }
    }

    // Pre-open the NEXT song's AVAudioFile handles in the background so switching is instant (<100ms)
    private func prewarmNextSong(after currentSongId: String?, in setlist: Setlist) {
        guard let curId = currentSongId,
              let songs = setlist.songs,
              let idx = songs.firstIndex(where: { $0.id == curId }),
              idx + 1 < songs.count else { return }

        let nextSong = songs[idx + 1]
        guard DownloadManager.shared.isSongDownloaded(nextSong),
              let nextTracks = nextSong.tracks, !nextTracks.isEmpty else { return }

        audioIOQueue.async { [weak self] in
            guard let self = self else { return }
            if self.prewarmedSongId == nextSong.id { return }

            var files: [String: AVAudioFile] = [:]
            for tr in nextTracks {
                let url = DownloadManager.shared.getLocalURL(for: tr)
                if let f = try? AVAudioFile(forReading: url) {
                    files[tr.id] = f
                }
            }
            self.prewarmedSongId = nextSong.id
            self.prewarmedFiles = files
        }
    }

    // MARK: - Real Multi-Stem Waveform Generator (Sequential Streaming — Works on MP3/M4A/WAV/FLAC)
    static func computeAndCacheWaveform(for song: Song, binCount: Int = 240) -> [Float] {
        if let existing = DownloadManager.shared.getCachedWaveform(for: song.id) {
            return existing
        }

        guard let allTracks = song.tracks, !allTracks.isEmpty else {
            return []
        }

        // Filter out click/guide/cue tracks so the waveform reflects the real music
        let musicalTracks = allTracks.filter { !isClickOrGuideTrack($0.name) && DownloadManager.shared.isTrackDownloaded($0) }
        let candidateTracks = musicalTracks.isEmpty
            ? allTracks.filter { DownloadManager.shared.isTrackDownloaded($0) }
            : musicalTracks

        guard !candidateTracks.isEmpty else { return [] }

        // Prioritize main rhythmic/harmonic stems (up to 4 stems for fast + accurate composite waveform)
        let priorityKeywords = ["drum", "bater", "perc", "bass", "bajo", "piano", "key", "tecl", "guit", "eg", "ag", "voc", "voz", "synth"]
        let sortedForWave = candidateTracks.sorted { a, b in
            let na = (a.name ?? "").lowercased()
            let nb = (b.name ?? "").lowercased()
            let scoreA = priorityKeywords.firstIndex(where: { na.contains($0) }) ?? 99
            let scoreB = priorityKeywords.firstIndex(where: { nb.contains($0) }) ?? 99
            return scoreA < scoreB
        }
        let selectedTracks = Array(sortedForWave.prefix(4))

        var combinedEnergy = [Double](repeating: 0.0, count: binCount)
        var binSampleCounts = [Int](repeating: 0, count: binCount)
        let chunkFrames: AVAudioFrameCount = 65536

        for track in selectedTracks {
            let url = DownloadManager.shared.getLocalURL(for: track)
            guard let file = try? AVAudioFile(forReading: url) else { continue }
            let totalFrames = file.length
            guard totalFrames > 0 else { continue }

            let format = file.processingFormat
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: chunkFrames) else { continue }

            var framesReadSoFar: Int64 = 0
            let channelCount = Int(format.channelCount)

            // Sequential streaming read from frame 0 to EOF (100% reliable on VBR/CBR MP3 & AAC!)
            while framesReadSoFar < totalFrames {
                buffer.frameLength = 0
                do {
                    try file.read(into: buffer, frameCount: chunkFrames)
                } catch {
                    break
                }
                let frameLen = Int(buffer.frameLength)
                if frameLen <= 0 { break }

                guard let floatData = buffer.floatChannelData else {
                    framesReadSoFar += Int64(frameLen)
                    continue
                }

                let ch0 = floatData[0]
                let ch1 = channelCount > 1 ? floatData[1] : nil

                // Sample every 16th frame for speed while keeping exact temporal envelope
                let strideStep = 16
                var i = 0
                while i < frameLen {
                    let globalFrame = framesReadSoFar + Int64(i)
                    let binIdx = min(binCount - 1, max(0, Int((globalFrame * Int64(binCount)) / totalFrames)))

                    let s0 = Double(ch0[i])
                    let amp: Double
                    if let c1 = ch1 {
                        let s1 = Double(c1[i])
                        amp = 0.5 * (s0 * s0 + s1 * s1)
                    } else {
                        amp = s0 * s0
                    }

                    combinedEnergy[binIdx] += amp
                    binSampleCounts[binIdx] += 1
                    i += strideStep
                }

                framesReadSoFar += Int64(frameLen)
            }
        }

        // Convert accumulated energy per bin into RMS amplitudes
        var rmsBins = [Float](repeating: 0.0, count: binCount)
        var maxRms: Float = 0.0
        for i in 0..<binCount {
            if binSampleCounts[i] > 0 {
                let rms = Float(sqrt(combinedEnergy[i] / Double(binSampleCounts[i])))
                rmsBins[i] = rms
                if rms > maxRms { maxRms = rms }
            }
        }

        guard maxRms > 0.00001 else {
            return [Float](repeating: 0.08, count: binCount)
        }

        // Apply slight power curve (0.72) so quiet intros & loud choruses look natural and readable
        let normalized: [Float] = rmsBins.map { val in
            let ratio = max(0.0, min(1.0, val / maxRms))
            let shaped = powf(ratio, 0.72)
            return max(0.05, min(1.0, shaped))
        }

        DownloadManager.shared.saveWaveform(normalized, for: song.id)
        return normalized
    }

    private func calculateRMS(buffer: AVAudioPCMBuffer) -> Float {
        guard let channelData = buffer.floatChannelData else { return 0 }
        let frameCount = Int(buffer.frameLength)
        guard frameCount > 0 else { return 0 }
        var sum: Float = 0
        let data = channelData[0]
        var i = 0
        while i < frameCount {
            let s = data[i]
            sum += s * s
            i += 2
        }
        return sqrt(sum / Float(max(1, frameCount / 2)))
    }

    private func scheduleAllFromPosition(_ positionSeconds: Double) {
        for (trackId, playerNode) in playerNodes {
            guard let audioFile = audioFiles[trackId] else { continue }
            let sampleRate = audioFile.fileFormat.sampleRate
            let startFrame = AVAudioFramePosition(positionSeconds * sampleRate)
            let totalFrames = audioFile.length
            let remainingFrames = AVAudioFrameCount(max(0, totalFrames - startFrame))

            guard remainingFrames > 0 else { continue }

            playerNode.stop()
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

        // If we are at the end, rewind to 0 before playing
        if duration > 0 && seekPosition >= duration - 0.1 {
            seekPosition = 0.0
            currentTime = 0.0
            scheduleAllFromPosition(0)
        }

        for playerNode in playerNodes.values {
            playerNode.play()
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
        if !playerNodes.isEmpty {
            scheduleAllFromPosition(0)
        }
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
    private func applyMixVolumes() {
        let hasSolo = !soloedStems.isEmpty
        for (name, node) in stemMixerNodes {
            let isMuted = mutedStems.contains(name)
            let isAudible = !isMuted && (!hasSolo || soloedStems.contains(name))
            let targetVol = max(0, min(1.2, stemVolumes[name] ?? 1.0))
            node.outputVolume = isAudible ? targetVol : 0
        }
    }

    func setTrackVolume(id trackId: String, volume: Float) {
        stemVolumes[trackId] = volume
        applyMixVolumes()
    }

    func setTrackMute(id trackId: String, muted: Bool) {
        if muted {
            mutedStems.insert(trackId)
        } else {
            mutedStems.remove(trackId)
        }
        applyMixVolumes()
    }

    func setTrackSolo(id trackId: String, solo: Bool) {
        if solo {
            soloedStems.insert(trackId)
        } else {
            soloedStems.remove(trackId)
        }
        applyMixVolumes()
    }

    func setTrackPan(id trackId: String, pan: Float) {
        let clamped = max(-1.0, min(1.0, pan))
        stemPans[trackId] = clamped
        stemMixerNodes[trackId]?.pan = clamped
    }

    // Cycle track pan L (-1) -> C (0) -> R (+1) -> L (-1), matching Android/Web
    func cycleTrackPan(id trackId: String) {
        let current = stemPans[trackId] ?? 0.0
        let next: Float
        if current < -0.3 {
            next = 0.0
        } else if current < 0.3 {
            next = 1.0
        } else {
            next = -1.0
        }
        setTrackPan(id: trackId, pan: next)
    }

    // Toggle global Split (Click R / Music L) vs Stereo Center (All C)
    func applyRoutingMode(split: Bool) {
        splitRoutingMode = split
        for track in loadedTracks {
            let isClick = Self.isClickOrGuideTrack(track.name)
            let pan: Float = split ? (isClick ? 1.0 : -1.0) : 0.0
            setTrackPan(id: track.id, pan: pan)
        }
    }

    // MARK: - Timer & Auto-Stop at Song End
    private func startProgressTimer() {
        stopProgressTimer()
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in
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

        if duration > 0.5 && total >= duration - 0.08 {
            // Song finished naturally: stop and reset playhead to 00:00 (matching Android/Web)
            stop()
            return
        }

        self.currentTime = max(0, min(duration, total))
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
    }
}

// MARK: - Built-In Standalone Audio Metronome (Android Parity)
class ZionMetronome: ObservableObject {
    static let shared = ZionMetronome()

    @Published var isRunning: Bool = false
    @Published var bpm: Double = 120.0 {
        didSet {
            if isRunning { restartTimer() }
        }
    }
    @Published var beatsPerMeasure: Int = 4
    @Published var currentBeat: Int = 0 // 1...beatsPerMeasure
    @Published var volume: Float = 0.85 {
        didSet { engine.mainMixerNode.outputVolume = volume }
    }

    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private var accentBuffer: AVAudioPCMBuffer?
    private var normalBuffer: AVAudioPCMBuffer?
    private var timer: DispatchSourceTimer?
    private let timerQueue = DispatchQueue(label: "com.zionstage.metronome", qos: .userInteractive)
    private var internalBeat: Int = 0
    private var tapTimestamps: [Date] = []

    private init() {
        setupAudio()
    }

    private func setupAudio() {
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        accentBuffer = makeClickBuffer(frequency: 1550.0, duration: 0.028, amplitude: 0.9, format: format)
        normalBuffer = makeClickBuffer(frequency: 1050.0, duration: 0.022, amplitude: 0.65, format: format)

        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = volume
    }

    private func makeClickBuffer(frequency: Double, duration: Double, amplitude: Float, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let sampleRate = format.sampleRate
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount
        guard let data = buffer.floatChannelData?[0] else { return nil }

        for i in 0..<Int(frameCount) {
            let t = Double(i) / sampleRate
            let env = exp(-t * 140.0)
            data[i] = Float(sin(2.0 * Double.pi * frequency * t) * env) * amplitude
        }
        return buffer
    }

    func toggle() {
        isRunning ? stop() : start()
    }

    func start() {
        if !engine.isRunning {
            try? engine.start()
        }
        if !playerNode.isPlaying {
            playerNode.play()
        }
        isRunning = true
        internalBeat = 0
        currentBeat = 0
        restartTimer()
    }

    func stop() {
        timer?.cancel()
        timer = nil
        playerNode.stop()
        isRunning = false
        internalBeat = 0
        currentBeat = 0
    }

    private func restartTimer() {
        timer?.cancel()
        let clampedBpm = max(40.0, min(240.0, bpm))
        let interval = 60.0 / clampedBpm

        let newTimer = DispatchSource.makeTimerSource(queue: timerQueue)
        newTimer.schedule(deadline: .now(), repeating: interval, leeway: .milliseconds(2))
        newTimer.setEventHandler { [weak self] in
            self?.tick()
        }
        timer = newTimer
        newTimer.resume()
    }

    private func tick() {
        let beats = max(1, beatsPerMeasure)
        internalBeat = (internalBeat % beats) + 1
        let nextBeat = internalBeat
        let isAccent = (nextBeat == 1)

        if let buf = isAccent ? accentBuffer : normalBuffer {
            if !engine.isRunning { try? engine.start() }
            if !playerNode.isPlaying { playerNode.play() }
            playerNode.scheduleBuffer(buf, at: nil, options: [], completionHandler: nil)
        }

        DispatchQueue.main.async {
            self.currentBeat = nextBeat
        }
    }

    func tapTempo() {
        let now = Date()
        if let last = tapTimestamps.last, now.timeIntervalSince(last) > 2.0 {
            tapTimestamps.removeAll()
        }
        tapTimestamps.append(now)
        if tapTimestamps.count > 5 {
            tapTimestamps.removeFirst()
        }
        guard tapTimestamps.count >= 2 else { return }
        var totalInterval: TimeInterval = 0
        for i in 1..<tapTimestamps.count {
            totalInterval += tapTimestamps[i].timeIntervalSince(tapTimestamps[i - 1])
        }
        let avg = totalInterval / Double(tapTimestamps.count - 1)
        if avg > 0.2 {
            let detected = round(60.0 / avg)
            self.bpm = max(40.0, min(240.0, detected))
        }
    }
}
