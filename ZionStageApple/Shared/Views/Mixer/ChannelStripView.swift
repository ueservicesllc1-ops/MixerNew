//
//  ChannelStripView.swift
//  ZionStageApple
//
//  Tira de canal multitrack nativa en SwiftUI.
//  Diseño visual exacto de la aplicación Android:
//  - Fondo Slate 900 (#0f172a) / Special track Slate 800 (#1e293b)
//  - Borde sutil o de color del stem (Naranja #f97316 para Click/Guía, Cían #13b5b6 para instrumentos)
//  - Fader vertical con capuchón antiderrapante y medidor LED VU de 24 segmentos
//  - Botones Mute (Rojo) y Solo (Amarillo)
//  - Control de Panorama L / R
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

    // Marca si es pista especial (Click / Guía)
    private var isSpecialTrack: Bool {
        let name = stem.name.lowercased()
        let role = stem.role.lowercased()
        return name.contains("click") || name.contains("guia") || name.contains("guide") || role.contains("click") || role.contains("guide")
    }

    // Color característico del stem
    private var stemColor: Color {
        let nameLower = stem.name.lowercased()
        let roleLower = stem.role.lowercased()
        if nameLower.contains("click") || roleLower.contains("click") {
            return Color(red: 0.95, green: 0.25, blue: 0.25) // Rojo Click
        }
        if nameLower.contains("guia") || nameLower.contains("guide") || roleLower.contains("guide") {
            return Color(red: 0.97, green: 0.45, blue: 0.09) // Naranja Guía #f97316
        }
        if nameLower.contains("voz") || nameLower.contains("vocal") || roleLower.contains("vocal") {
            return Color(red: 0.13, green: 0.77, blue: 0.36) // Verde Voces
        }
        if nameLower.contains("bateria") || nameLower.contains("drum") || roleLower.contains("drums") {
            return Color(red: 0.95, green: 0.6, blue: 0.15) // Naranja Batería
        }
        if nameLower.contains("bajo") || nameLower.contains("bass") || roleLower.contains("bass") {
            return Color(red: 0.23, green: 0.51, blue: 0.96) // Azul Bajo
        }
        if nameLower.contains("guitar") || nameLower.contains("guit") || roleLower.contains("guitar") {
            return Color(red: 0.07, green: 0.71, blue: 0.71) // Cían Guitarras #13b5b6
        }
        if nameLower.contains("key") || nameLower.contains("tecl") || nameLower.contains("synth") {
            return Color(red: 0.66, green: 0.33, blue: 0.97) // Púrpura Teclados
        }
        return Color(red: 0.58, green: 0.64, blue: 0.72) // Slate 400
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
            // Nombre del Stem (Cabecera estilo Android)
            HStack(spacing: 4) {
                Text(stem.name)
                    .font(.system(size: 11, weight: .bold, design: .default))
                    .foregroundColor(isSpecialTrack ? Color(red: 0.97, green: 0.45, blue: 0.09) : Color(red: 0.9, green: 0.95, blue: 1.0))
                    .lineLimit(1)
                    .truncationMode(.tail)
                
                if isClipping {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 6, height: 6)
                        .shadow(color: .red, radius: 3)
                }
            }
            .frame(width: 82, height: 28)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSpecialTrack ? Color(red: 0.97, green: 0.45, blue: 0.09).opacity(0.18) : stemColor.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(isSpecialTrack ? Color(red: 0.97, green: 0.45, blue: 0.09).opacity(0.6) : stemColor.opacity(0.3), lineWidth: 1)
                    )
            )

            // Botones Mute y Solo (Estilo Consola Pro)
            HStack(spacing: 6) {
                // Botón MUTE
                Button(action: {
                    isMuted.toggle()
                    onMuteToggle(isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 36, height: 28)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isMuted ? Color(red: 0.93, green: 0.27, blue: 0.27) : Color(red: 0.12, green: 0.16, blue: 0.25))
                                .shadow(color: isMuted ? Color.red.opacity(0.5) : Color.clear, radius: 4)
                        )
                        .foregroundColor(isMuted ? .white : Color(red: 0.6, green: 0.65, blue: 0.75))
                }

                // Botón SOLO
                Button(action: {
                    isSolo.toggle()
                    onSoloToggle(isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 36, height: 28)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isSolo ? Color(red: 0.96, green: 0.62, blue: 0.04) : Color(red: 0.12, green: 0.16, blue: 0.25))
                                .shadow(color: isSolo ? Color.yellow.opacity(0.5) : Color.clear, radius: 4)
                        )
                        .foregroundColor(isSolo ? .black : Color(red: 0.6, green: 0.65, blue: 0.75))
                }
            }

            // VU Meter LED + Slider Fader Vertical
            HStack(spacing: 6) {
                // Medidor LED Vertical de 24 leds
                VStack(spacing: 2) {
                    ForEach((0..<24).reversed(), id: \.self) { index in
                        let ledDB = -60.0 + (Float(index) * (60.0 / 24.0))
                        let isActive = currentDB >= ledDB
                        let ledColor: Color = index >= 21 ? .red : (index >= 16 ? .yellow : Color(red: 0.07, green: 0.71, blue: 0.71))

                        Rectangle()
                            .fill(isActive ? ledColor : Color.white.opacity(0.06))
                            .frame(width: 5, height: 6)
                            .cornerRadius(1)
                    }
                }

                // Slider Fader Vertical con indicador de porcentaje
                VStack(spacing: 4) {
                    Text("\(Int(volume * 100))%")
                        .font(.system(size: 10, design: .monospaced).weight(.bold))
                        .foregroundColor(Color(red: 0.7, green: 0.75, blue: 0.85))

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

            // Balance Panning L / R
            VStack(spacing: 2) {
                Text(pan == 0 ? "CENTER" : (pan < 0 ? "L \(Int(abs(pan) * 100))%" : "R \(Int(pan * 100))%"))
                    .font(.system(size: 9, design: .monospaced).weight(.bold))
                    .foregroundColor(Color(red: 0.5, green: 0.6, blue: 0.7))

                HStack(spacing: 2) {
                    Text("L")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(Color(red: 0.5, green: 0.6, blue: 0.7))

                    Slider(value: Binding(
                        get: { Double(pan) },
                        set: { newValue in
                            pan = Float(newValue)
                            onPanChange(pan)
                        }
                    ), in: -1.0...1.0)
                    .accentColor(Color(red: 0.07, green: 0.71, blue: 0.71))

                    Text("R")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(Color(red: 0.5, green: 0.6, blue: 0.7))
                }
                .frame(width: 80)
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isSpecialTrack ? Color(red: 0.12, green: 0.16, blue: 0.23) : Color(red: 0.06, green: 0.09, blue: 0.16))
                .shadow(color: Color.black.opacity(0.4), radius: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSpecialTrack ? Color(red: 0.97, green: 0.45, blue: 0.09).opacity(0.5) : Color.white.opacity(0.08), lineWidth: 1)
        )
    }
}
