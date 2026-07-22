//
//  ChannelStripView.swift
//  ZionStageApple
//
//  Tira de canal multitrack profesional (Fader vertical, Mute, Solo, Pan, VUMeter LED, Colores por Instrumento).
//

import SwiftUI

public struct ChannelStripView: View {
    @Binding public var stem: Stem
    public var onVolumeChange: (Float) -> Void
    public var onMuteToggle: (Bool) -> Void
    public var onSoloToggle: (Bool) -> Void
    public var onPanChange: (Float) -> Void

    public init(stem: Binding<Stem>, onVolumeChange: @escaping (Float) -> Void, onMuteToggle: @escaping (Bool) -> Void, onSoloToggle: @escaping (Bool) -> Void, onPanChange: @escaping (Float) -> Void) {
        self._stem = stem
        self.onVolumeChange = onVolumeChange
        self.onMuteToggle = onMuteToggle
        self.onSoloToggle = onSoloToggle
        self.onPanChange = onPanChange
    }

    private var stemColor: Color {
        let nameLower = stem.name.lowercased()
        let roleLower = stem.role.lowercased()
        if nameLower.contains("click") || roleLower.contains("click") {
            return Color(red: 0.95, green: 0.75, blue: 0.1) // Amarillo Click
        }
        if nameLower.contains("guia") || nameLower.contains("guide") || roleLower.contains("guide") {
            return Color(red: 0.0, green: 0.8, blue: 0.9) // Cían Guía
        }
        if nameLower.contains("voz") || nameLower.contains("vocal") || roleLower.contains("vocal") {
            return Color(red: 0.9, green: 0.25, blue: 0.25) // Rojo Voces
        }
        if nameLower.contains("bateria") || nameLower.contains("drum") || roleLower.contains("drums") {
            return Color(red: 0.95, green: 0.5, blue: 0.15) // Naranja Batería
        }
        if nameLower.contains("bajo") || nameLower.contains("bass") || roleLower.contains("bass") {
            return Color(red: 0.2, green: 0.5, blue: 0.95) // Azul Bajo
        }
        if nameLower.contains("guitar") || nameLower.contains("guit") || roleLower.contains("guitar") {
            return Color(red: 0.2, green: 0.8, blue: 0.35) // Verde Guitarras
        }
        if nameLower.contains("key") || nameLower.contains("tecl") || nameLower.contains("synth") {
            return Color(red: 0.65, green: 0.3, blue: 0.9) // Púrpura Teclados
        }
        return Color(red: 0.5, green: 0.55, blue: 0.65)
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Etiqueta del Stem / Rol con color temático
            Text(stem.name)
                .font(.system(size: 11).weight(.bold))
                .foregroundColor(.white)
                .lineLimit(1)
                .frame(width: 76, height: 26)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(stemColor.opacity(0.85))
                        .shadow(color: stemColor.opacity(0.4), radius: 4, x: 0, y: 2)
                )

            // Botones táctiles Mute (M) y Solo (S)
            HStack(spacing: 6) {
                Button(action: {
                    stem.isMuted.toggle()
                    onMuteToggle(stem.isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 12).weight(.bold))
                        .frame(width: 34, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(stem.isMuted ? Color.red : Color(red: 0.2, green: 0.22, blue: 0.28))
                                .shadow(color: stem.isMuted ? Color.red.opacity(0.6) : Color.clear, radius: 4)
                        )
                        .foregroundColor(.white)
                }

                Button(action: {
                    stem.isSolo.toggle()
                    onSoloToggle(stem.isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 12).weight(.bold))
                        .frame(width: 34, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(stem.isSolo ? Color.yellow : Color(red: 0.2, green: 0.22, blue: 0.28))
                                .shadow(color: stem.isSolo ? Color.yellow.opacity(0.6) : Color.clear, radius: 4)
                        )
                        .foregroundColor(stem.isSolo ? .black : .white)
                }
            }

            // Fader de Volumen Vertical + VUMeter LED simulado
            HStack(spacing: 6) {
                // VUMeter LED Vertical
                VStack(spacing: 2) {
                    ForEach((0..<16).reversed(), id: \.self) { i in
                        let level = Double(stem.volume) * 16.0
                        let isActive = !stem.isMuted && Double(i) <= level
                        let ledColor: Color = i > 12 ? .red : (i > 9 ? .yellow : .green)

                        Rectangle()
                            .fill(isActive ? ledColor : Color.gray.opacity(0.2))
                            .frame(width: 4, height: 8)
                            .cornerRadius(1)
                    }
                }

                // Slider Fader Vertical
                VStack(spacing: 4) {
                    Text("\(Int(stem.volume * 100))%")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(Color(red: 0.7, green: 0.7, blue: 0.7))

                    Slider(value: Binding(
                        get: { Double(stem.volume) },
                        set: { newValue in
                            stem.volume = Float(newValue)
                            onVolumeChange(Float(newValue))
                        }
                    ), in: 0.0...1.2)
                    .rotationEffect(.degrees(-90))
                    .accentColor(stemColor)
                    .frame(width: 150, height: 36)
                }
            }
            .frame(height: 175)

            // Balance Pan (L <-> R)
            VStack(spacing: 2) {
                Text(stem.pan == 0 ? "C" : (stem.pan < 0 ? "L\(Int(abs(stem.pan) * 100))" : "R\(Int(stem.pan * 100))"))
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(.gray)

                HStack(spacing: 2) {
                    Text("L")
                        .font(.system(size: 8).weight(.bold))
                        .foregroundColor(.gray)

                    Slider(value: Binding(
                        get: { Double(stem.pan) },
                        set: { newValue in
                            stem.pan = Float(newValue)
                            onPanChange(Float(newValue))
                        }
                    ), in: -1.0...1.0)
                    .accentColor(.cyan)

                    Text("R")
                        .font(.system(size: 8).weight(.bold))
                        .foregroundColor(.gray)
                }
                .frame(width: 76)
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(red: 0.1, green: 0.12, blue: 0.16))
                .shadow(color: Color.black.opacity(0.3), radius: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(stemColor.opacity(0.3), lineWidth: 1)
        )
    }
}
