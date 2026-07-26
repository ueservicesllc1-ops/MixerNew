import AVFoundation
import Foundation

public class ZionPadPlayer: ObservableObject {
    public static let shared = ZionPadPlayer()

    @Published public var activeKey: String? = nil
    @Published public var volume: Float = 0.8
    @Published public var pitchOffset: Int = 0  // Octava: -1, 0, +1

    private let engine = AVAudioEngine()
    private var playerNode: AVAudioPlayerNode?
    private var timePitchNode: AVAudioUnitTimePitch?
    private var audioBuffers: [String: AVAudioPCMBuffer] = [:]
    private var isRunning = false

    // Map keys to canonical MP3 file names matching public/pads/
    private let keyToFileName: [String: String] = [
        "C": "C", "C#": "Db", "D": "D", "D#": "Eb",
        "E": "E", "F": "F", "F#": "Gb", "G": "G",
        "G#": "Ab", "A": "A", "A#": "Bb", "B": "B"
    ]

    private init() {
        setupEngine()
    }

    private func setupEngine() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    public func start(key: String) {
        stop()

        let fileName = keyToFileName[key] ?? key
        
        // Load real MP3 pad buffer asynchronously or load synthesized pad fallback
        loadPadBuffer(fileName: fileName) { [weak self] buffer in
            guard let self = self, let buffer = buffer else { return }
            
            DispatchQueue.main.async {
                let player = AVAudioPlayerNode()
                let timePitch = AVAudioUnitTimePitch()

                self.engine.attach(player)
                self.engine.attach(timePitch)
                self.engine.connect(player, to: timePitch, format: buffer.format)
                self.engine.connect(timePitch, to: self.engine.mainMixerNode, format: buffer.format)

                player.volume = self.volume
                timePitch.pitch = Float(self.pitchOffset * 1200) // -1200, 0, +1200 cents

                if !self.engine.isRunning {
                    try? self.engine.start()
                }

                player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
                player.play()

                self.playerNode = player
                self.timePitchNode = timePitch
                self.isRunning = true
                self.activeKey = key
            }
        }
    }

    private func loadPadBuffer(fileName: String, completion: @escaping (AVAudioPCMBuffer?) -> Void) {
        if let cached = audioBuffers[fileName] {
            completion(cached)
            return
        }
        
        let proxyBase = "https://mixernew-production.up.railway.app"
        guard let url = URL(string: "\(proxyBase)/pads/\(fileName).mp3") else {
            completion(synthesizePadFallback(key: fileName))
            return
        }
        
        DispatchQueue.global(qos: .userInitiated).async {
            var request = URLRequest(url: url)
            request.timeoutInterval = 10
            
            let task = URLSession.shared.downloadTask(with: request) { tempUrl, response, error in
                guard let tempUrl = tempUrl, error == nil,
                      let file = try? AVAudioFile(forReading: tempUrl),
                      let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else {
                    let fallback = self.synthesizePadFallback(key: fileName)
                    completion(fallback)
                    return
                }
                
                try? file.read(into: buffer)
                self.audioBuffers[fileName] = buffer
                completion(buffer)
            }
            task.resume()
        }
    }

    private func scheduleLoop(player: AVAudioPlayerNode, buffer: AVAudioPCMBuffer) {
        player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
    }

    public func stop() {
        playerNode?.stop()
        if let player = playerNode {
            engine.detach(player)
        }
        if let tp = timePitchNode {
            engine.detach(tp)
        }
        playerNode = nil
        timePitchNode = nil
        isRunning = false
        DispatchQueue.main.async { self.activeKey = nil }
    }

    public func toggleKey(_ key: String) {
        if activeKey == key {
            stop()
        } else {
            start(key: key)
        }
    }

    public func setVolume(_ vol: Float) {
        volume = max(0.0, min(1.0, vol))
        playerNode?.volume = volume
    }

    public func setOctave(_ offset: Int) {
        pitchOffset = max(-1, min(1, offset))
        if let currentKey = activeKey {
            start(key: currentKey)
        }
    }

    private func synthesizePadFallback(key: String) -> AVAudioPCMBuffer? {
        let noteFrequencies: [String: Float] = [
            "C": 261.63, "Db": 277.18, "D": 293.66, "Eb": 311.13,
            "E": 329.63, "F": 349.23, "Gb": 369.99, "G": 392.00,
            "Ab": 415.30, "A": 440.00, "Bb": 466.16, "B": 493.88
        ]
        let baseFreq = noteFrequencies[key] ?? 261.63
        return synthesizePad(frequency: baseFreq, duration: 4.0)
    }

    private func synthesizePad(frequency: Float, duration: Double) -> AVAudioPCMBuffer? {
        let sampleRate: Double = 44100.0
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)
        let frameCount = AVAudioFrameCount(sampleRate * duration)

        guard let buffer = AVAudioPCMBuffer(pcmFormat: format!, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        let left = buffer.floatChannelData![0]
        let right = buffer.floatChannelData![1]

        let twoPi = 2.0 * Double.pi
        let thetaInc1 = twoPi * Double(frequency) / sampleRate
        let thetaInc2 = twoPi * Double(frequency * 1.003) / sampleRate
        let thetaIncSub = twoPi * Double(frequency * 0.5) / sampleRate

        var theta1: Double = 0.0
        var theta2: Double = 0.0
        var thetaSub: Double = 0.0

        for i in 0..<Int(frameCount) {
            let envProgress = Double(i) / Double(frameCount)
            let fadeIn = min(1.0, envProgress / 0.1)
            let fadeOut = min(1.0, (1.0 - envProgress) / 0.1)
            let env = fadeIn * fadeOut

            let s1 = sin(theta1) * 0.4
            let s2 = sin(theta2) * 0.35
            let sub = sin(thetaSub) * 0.25

            let sampleL = Float((s1 + sub) * env)
            let sampleR = Float((s2 + sub) * env)

            left[i] = sampleL
            right[i] = sampleR

            theta1 += thetaInc1
            theta2 += thetaInc2
            thetaSub += thetaIncSub

            if theta1 > twoPi { theta1 -= twoPi }
            if theta2 > twoPi { theta2 -= twoPi }
            if thetaSub > twoPi { thetaSub -= twoPi }
        }

        return buffer
    }
}
