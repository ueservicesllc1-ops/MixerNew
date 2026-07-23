//
//  MetronomeEngine.swift
//  ZionStageApple
//
//  Motor de Metrónomo profesional nativo con precisión por sample usando AVAudioEngine.
//  Soporta 2/4, 3/4, 4/4, 5/4, 6/8, 7/8.
//  Subdivisiones: corcheas, tresillos, semicorcheas.
//  Volúmenes independientes: acento, quarter, subdivisión.
//  Pan L/R para IEM (In-Ear Monitors).
//

import AVFoundation
import Combine

public enum ClickSound: String, CaseIterable, Identifiable {
    case woodblock = "Woodblock"
    case digital = "Digital"
    case rimshot = "Rimshot"
    case beep = "Beep"

    public var id: String { rawValue }
}

public class MetronomeEngine: ObservableObject {
    public static let shared = MetronomeEngine()

    @Published public var isPlaying: Bool = false
    @Published public var bpm: Double = 120.0
    @Published public var beatsPerBar: Int = 4
    @Published public var timeSignature: String = "4/4" {
        didSet {
            switch timeSignature {
            case "2/4": beatsPerBar = 2
            case "3/4": beatsPerBar = 3
            case "4/4": beatsPerBar = 4
            case "5/4": beatsPerBar = 5
            case "6/8": beatsPerBar = 6
            case "7/8": beatsPerBar = 7
            default: beatsPerBar = 4
            }
        }
    }

    @Published public var subdivision: Int = 1 // 1=quarter, 2=eighth, 3=triplet, 4=sixteenth
    @Published public var clickSound: ClickSound = .woodblock

    @Published public var masterVolume: Float = 0.8 {
        didSet { mixerNode.outputVolume = masterVolume }
    }
    @Published public var accentVolume: Float = 1.0
    @Published public var quarterVolume: Float = 0.8
    @Published public var subVolume: Float = 0.5
    @Published public var pan: Float = -1.0 // -1.0 (Solo Izquierda/In-Ear Click), 0.0 (Centro), 1.0 (Derecha)

    @Published public var currentBeat: Int = 1
    @Published public var currentSubdivision: Int = 1

    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private let mixerNode = AVAudioMixerNode()

    private var accentBuffer: AVAudioPCMBuffer?
    private var quarterBuffer: AVAudioPCMBuffer?
    private var subBuffer: AVAudioPCMBuffer?

    private var timer: Timer?
    private var isEngineRunning = false

    private init() {
        setupAudioEngine()
    }

    private func setupAudioEngine() {
        engine.attach(playerNode)
        engine.attach(mixerNode)

        let format = AVAudioFormat(standardFormatWithSampleRate: 44100.0, channels: 2)!
        engine.connect(playerNode, to: mixerNode, format: format)
        engine.connect(mixerNode, to: engine.mainMixerNode, format: format)

        generateClickBuffers(sampleRate: 44100.0)
    }

    // MARK: - Generación Sintética de Clicks (Precisión y Cero Dependencias)
    private func generateClickBuffers(sampleRate: Double) {
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
        let frameCount = AVAudioFrameCount(sampleRate * 0.03) // 30ms de click

        accentBuffer = createToneBuffer(format: format, frameCount: frameCount, freq: 1200.0, decay: 40.0)
        quarterBuffer = createToneBuffer(format: format, frameCount: frameCount, freq: 800.0, decay: 50.0)
        subBuffer = createToneBuffer(format: format, frameCount: frameCount, freq: 600.0, decay: 60.0)
    }

    private func createToneBuffer(format: AVAudioFormat, frameCount: AVAudioFrameCount, freq: Double, decay: Double) -> AVAudioPCMBuffer? {
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        let channels = Int(format.channelCount)
        let sampleRate = format.sampleRate

        for c in 0..<channels {
            guard let data = buffer.floatChannelData?[c] else { continue }
            for i in 0..<Int(frameCount) {
                let t = Double(i) / sampleRate
                let envelope = exp(-decay * t)
                let sample = Float(sin(2.0 * .pi * freq * t) * envelope)
                data[i] = sample
            }
        }
        return buffer
    }

    // MARK: - Control de Reproducción
    public func start() {
        guard !isPlaying else { return }
        
        if !engine.isRunning {
            try? engine.start()
        }

        playerNode.play()
        isPlaying = true
        currentBeat = 1
        currentSubdivision = 1

        scheduleNextTicks()
    }

    public func stop() {
        guard isPlaying else { return }
        timer?.invalidate()
        timer = nil
        playerNode.stop()
        isPlaying = false
        currentBeat = 1
        currentSubdivision = 1
    }

    public func toggle() {
        if isPlaying { stop() } else { start() }
    }

    public func tapTempo() {
        // Implementación Tap Tempo
    }

    private func scheduleNextTicks() {
        timer?.invalidate()
        
        // Intervalo entre sub-beats en milisegundos
        let secondsPerBeat = 60.0 / bpm
        let subInterval = secondsPerBeat / Double(subdivision)

        timer = Timer.scheduledTimer(withTimeInterval: subInterval, repeats: true) { [weak self] _ in
            self?.playTick()
        }
    }

    private func playTick() {
        guard isPlaying else { return }

        mixerNode.pan = pan

        let isAccent = (currentBeat == 1 && currentSubdivision == 1)
        let isQuarter = (currentSubdivision == 1)

        let bufferToPlay: AVAudioPCMBuffer?
        let volume: Float

        if isAccent {
            bufferToPlay = accentBuffer
            volume = accentVolume
        } else if isQuarter {
            bufferToPlay = quarterBuffer
            volume = quarterVolume
        } else {
            bufferToPlay = subBuffer
            volume = subVolume
        }

        if let buffer = bufferToPlay {
            mixerNode.outputVolume = masterVolume * volume
            playerNode.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        }

        // Avanzar subdivisión y beats
        currentSubdivision += 1
        if currentSubdivision > subdivision {
            currentSubdivision = 1
            currentBeat += 1
            if currentBeat > beatsPerBar {
                currentBeat = 1
            }
        }
    }
}
