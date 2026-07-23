//
//  ChannelStripView.swift
//  ZionStageApple
//
//  Tira de canal multitrack profesional.
//  Incluye fader vertical, VU meter de 24 LEDs alimentado por ZionAudioPlayer real,
//  indicadores Mute/Solo, medidor de clip y Pan control.
//

import SwiftUI

public struct ChannelStripView: View {
    public let stem: Stem
    public var onVolumeChange: (Float) -> Void
    public var onMuteToggle: (Bool) -> Void
    public var onSoloToggle: (Bool) -> Void
    public var onPanChange: (Float) -> Void

    @ObservedObject private var player = ZionAudioPlayer.shared

    @State private var volume: Float
    @State private var pan: Float
    @State private var isMuted: Bool
    @State private var isSolo: Bool

    public init(
        stem: Stem,
        onVolumeChange: @escaping (Float) -> Void,
        onMuteToggle: @escaping (Bool) -> Void,
        onSoloToggle: @escaping (Bool) -> Void,
        onPanChange: @escaping (Float) -> Void
    ) {
        self.stem = stem
        self.onVolumeChange = onVolumeChange
        self.onMuteToggle = onMuteToggle
        self.onSoloToggle = onSoloToggle
        self.onPanChange = onPanChange
        self._volume = State(initialValue: stem.volume)
        self._pan = State(initialValue: stem.pan)
        self._isMuted = State(initialValue: stem.isMuted)
        self._isSolo = State(initialValue: stem.isSolo)
    }

    private var stemColor: Color {
        let nameLower = stem.name.lowercased()
        let roleLower = stem.role.lowercased()
        if nameLower.contains("click") || roleLower.contains("click") {
            return Color(red: 0.95, green: 0.25, blue: 0.25) // Rojo Click
        }
        if nameLower.contains("guia") || nameLower.contains("guide") || roleLower.contains("guide") {
            return Color(red: 0.95, green: 0.8, blue: 0.1) // Amarillo Guía
        }
        if nameLower.contains("voz") || nameLower.contains("vocal") || roleLower.contains("vocal") {
            return Color(red: 0.2, green: 0.8, blue: 0.35) // Verde Voces
        }
        if nameLower.contains("bateria") || nameLower.contains("drum") || roleLower.contains("drums") {
            return Color(red: 0.95, green: 0.5, blue: 0.15) // Naranja Batería
        }
        if nameLower.contains("bajo") || nameLower.contains("bass") || roleLower.contains("bass") {
            return Color(red: 0.2, green: 0.5, blue: 0.95) // Azul Bajo
        }
        if nameLower.contains("guitar") || nameLower.contains("guit") || roleLower.contains("guitar") {
            return Color(red: 0.0, green: 0.8, blue: 0.9) // Cían Guitarras
        }
        if nameLower.contains("key") || nameLower.contains("tecl") || nameLower.contains("synth") {
            return Color(red: 0.65, green: 0.3, blue: 0.9) // Púrpura Teclados
        }
        return Color(red: 0.5, green: 0.55, blue: 0.65)
    }

    // Nivel dB actual en escala de -60 a 0 dB desde el motor
    private var currentDB: Float {
        guard !isMuted, player.isPlaying else { return -60.0 }
        return player.vuLevels[stem.id] ?? -60.0
    }

    private var isClipping: Bool {
        currentDB >= -0.5
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Header del Stem con indicador de clip
            HStack(spacing: 4) {
                Text(stem.name)
                    .font(.system(size: 11).weight(.bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                if isClipping {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 6, height: 6)
                        .shadow(color: .red, radius: 3)
                }
            }
            .frame(width: 80, height: 26)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(stemColor.opacity(0.85))
                    .shadow(color: stemColor.opacity(0.4), radius: 4, x: 0, y: 2)
            )

            // Botones Mute y Solo
            HStack(spacing: 6) {
                Button(action: {
                    isMuted.toggle()
                    onMuteToggle(isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 12).weight(.bold))
                        .frame(width: 36, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isMuted ? Color.red : Color(red: 0.18, green: 0.20, blue: 0.26))
                                .shadow(color: isMuted ? Color.red.opacity(0.6) : Color.clear, radius: 4)
                        )
                        .foregroundColor(.white)
                }

                Button(action: {
                    isSolo.toggle()
                    onSoloToggle(isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 12).weight(.bold))
                        .frame(width: 36, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isSolo ? Color.yellow : Color(red: 0.18, green: 0.20, blue: 0.26))
                                .shadow(color: isSolo ? Color.yellow.opacity(0.6) : Color.clear, radius: 4)
                        )
                        .foregroundColor(isSolo ? .black : .white)
                }
            }

            // VU Meter + Slider Fader
            HStack(spacing: 6) {
                // VUMeter LED Vertical de 24 segmentos
                VStack(spacing: 2) {
                    ForEach((0..<24).reversed(), id: \.self) { index in
                        let ledDB = -60.0 + (Float(index) * (60.0 / 24.0))
                        let isActive = currentDB >= ledDB
                        let ledColor: Color = index >= 21 ? .red : (index >= 16 ? .yellow : .green)

                        Rectangle()
                            .fill(isActive ? ledColor : Color.gray.opacity(0.15))
                            .frame(width: 5, height: 6)
                            .cornerRadius(1)
                    }
                }

                // Slider Fader Vertical
                VStack(spacing: 4) {
                    Text("\(Int(volume * 100))%")
                        .font(.system(size: 10, design: .monospaced).weight(.bold))
                        .foregroundColor(Color(red: 0.7, green: 0.7, blue: 0.7))

                    Slider(value: Binding(
                        get: { Double(volume) },
                        set: { newValue in
                            volume = Float(newValue)
                            onVolumeChange(volume)
                        }
                    ), in: 0.0...1.2)
                    .rotationEffect(.degrees(-90))
                    .accentColor(stemColor)
                    .frame(width: 155, height: 36)
                }
            }
            .frame(height: 175)

            // Pan Balance
            VStack(spacing: 2) {
                Text(pan == 0 ? "C" : (pan < 0 ? "L\(Int(abs(pan) * 100))" : "R\(Int(pan * 100))"))
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(.gray)

                HStack(spacing: 2) {
                    Text("L")
                        .font(.system(size: 8).weight(.bold))
                        .foregroundColor(.gray)

                    Slider(value: Binding(
                        get: { Double(pan) },
                        set: { newValue in
                            pan = Float(newValue)
                            onPanChange(pan)
                        }
                    ), in: -1.0...1.0)
                    .accentColor(.cyan)

                    Text("R")
                        .font(.system(size: 8).weight(.bold))
                        .foregroundColor(.gray)
                }
                .frame(width: 80)
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(red: 0.09, green: 0.11, blue: 0.16))
                .shadow(color: Color.black.opacity(0.3), radius: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(stemColor.opacity(0.3), lineWidth: 1)
        )
    }
}
