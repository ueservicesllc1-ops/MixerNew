//
//  ZionPadPlayer.swift
//  ZionStageApple
//
//  Motor de Pads Ambientales con audio real generado por síntesis nativa.
//  Genera un tono sinusoidal suave + armónicos por tonalidad en loop infinito.
//  Replica el PadEngine.js de la app web/Android.
//

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
    private var currentBuffer: AVAudioPCMBuffer?
    private var isRunning = false

    // Frecuencias base (Hz) de cada nota en C4 (4ª octava)
    private let noteFrequencies: [String: Float] = [
        "C":  261.63, "C#": 277.18, "D":  293.66,
        "D#": 311.13, "E":  329.63, "F":  349.23,
        "F#": 369.99, "G":  392.00, "G#": 415.30,
        "A":  440.00, "A#": 466.16, "B":  493.88
    ]

    private init() {
        setupEngine()
    }

    private func setupEngine() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif
    }

    // MARK: - Iniciar pad
    public func start(key: String) {
        stop()

        guard let baseFreq = noteFrequencies[key] else { return }

        // Ajustar frecuencia según octava
        let octaveMultiplier = pow(2.0, Float(pitchOffset))
        let freq = baseFreq * octaveMultiplier

        // Crear buffer sintetizado (pad ambiental de 4 segundos en loop)
        guard let buffer = synthesizePad(frequency: freq, duration: 4.0) else { return }
        currentBuffer = buffer

        let player = AVAudioPlayerNode()
        let timePitch = AVAudioUnitTimePitch()

        engine.attach(player)
        engine.attach(timePitch)
        engine.connect(player, to: timePitch, format: buffer.format)
        engine.connect(timePitch, to: engine.mainMixerNode, format: buffer.format)

        player.volume = volume

        if !engine.isRunning {
            try? engine.start()
        }

        // Schedule en loop infinito
        scheduleLoop(player: player, buffer: buffer)
        player.play()

        playerNode = player
        timePitchNode = timePitch
        isRunning = true

        DispatchQueue.main.async { self.activeKey = key }
    }

    private func scheduleLoop(player: AVAudioPlayerNode, buffer: AVAudioPCMBuffer) {
        player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
    }

    // MARK: - Detener pad
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

    public func setVolume(_ vol: Float) {
        volume = vol
        playerNode?.volume = vol
    }

    public func toggleKey(_ key: String) {
        if activeKey == key {
            stop()
        } else {
            start(key: key)
        }
    }

    // MARK: - Síntesis de pad ambiental
    /// Genera un pad ambiental suave con fundamental + 2 armónicos para la tonalidad dada.
    private func synthesizePad(frequency: Float, duration: Double) -> AVAudioPCMBuffer? {
        let sampleRate: Double = 44100
        let frameCount = AVAudioFrameCount(sampleRate * duration)

        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard let left = buffer.floatChannelData?[0],
              let right = buffer.floatChannelData?[1] else { return nil }

        let twoPi = 2.0 * Float.pi
        let totalFrames = Int(frameCount)
        let fadeFrames = Int(sampleRate * 0.5) // 500ms fade in/out

        for i in 0..<totalFrames {
            let t = Float(i) / Float(sampleRate)
            let phase = twoPi * frequency * t

            // Fundamental + 5ta + 8va (pad ambiental estilo sintetizador)
            var sample: Float = 0
            sample += 0.50 * sin(phase)                          // Fundamental
            sample += 0.25 * sin(twoPi * frequency * 1.5 * t)   // 5ta
            sample += 0.15 * sin(twoPi * frequency * 2.0 * t)   // Octava
            sample += 0.08 * sin(twoPi * frequency * 3.0 * t)   // Tercera octava (suavizada)

            // Envelope: fade in y fade out suave
            var envelope: Float = 1.0
            if i < fadeFrames {
                envelope = Float(i) / Float(fadeFrames)
            } else if i > totalFrames - fadeFrames {
                envelope = Float(totalFrames - i) / Float(fadeFrames)
            }

            let finalSample = sample * envelope * 0.4 // Amplitud suave
            left[i] = finalSample
            right[i] = finalSample
        }

        return buffer
    }
}
