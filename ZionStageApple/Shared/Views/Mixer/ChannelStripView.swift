//
//  ChannelStripView.swift
//  ZionStageApple
//
//  Tira de canal multitrack nativa en SwiftUI.
//  Réplica 1:1 exacta de ChannelStrip de React / Android (Mixer.jsx):
//  - Color pill badge por rol de pista (Click/Guía Rojo #b91c1c, Batería #00bcd4, Guitarras #ffb142, Voces #34ace0, Bajo #706fd3)
//  - Fader vertical con escala dB (+6, 0, -5, -10, -20, -40, -∞) y Medidor VU LED de 32 leds
//  - Botones de ruteo L / M / S / R (L: Izquierda/Monitores, M: Mute, S: Solo, R: Derecha/FOH)
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
    @State private var isMuted: Bool
    @State private var isSolo: Bool
    @State private var routeL: Bool
    @State private var routeR: Bool

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
        
        let isClickGuide = stem.name.lowercased().contains("click") ||
                           stem.name.lowercased().contains("guia") ||
                           stem.name.lowercased().contains("guide") ||
                           stem.role.lowercased().contains("click") ||
                           stem.role.lowercased().contains("guide")

        self._volume = State(initialValue: stem.volume)
        self._isMuted = State(initialValue: stem.isMuted)
        self._isSolo = State(initialValue: stem.isSolo)
        self._routeL = State(initialValue: isClickGuide ? false : (stem.pan <= 0.1))
        self._routeR = State(initialValue: isClickGuide ? true : (stem.pan >= -0.1))
    }

    private var isClickGuideStem: Bool {
        let n = stem.name.lowercased()
        let r = stem.role.lowercased()
        return n.contains("click") || n.contains("guia") || n.contains("guide") || r.contains("click") || r.contains("guide")
    }

    private var stemColor: Color {
        let n = stem.name.lowercased()
        let r = stem.role.lowercased()
        if isClickGuideStem { return Color(red: 0.73, green: 0.11, blue: 0.11) } // Rojo #b91c1c
        if n.contains("bat") || n.contains("drum") || n.contains("perc") || r.contains("drums") {
            return Color(red: 0.0, green: 0.74, blue: 0.83) // #00bcd4
        }
        if n.contains("guit") || n.contains("git") || r.contains("guitar") {
            return Color(red: 1.0, green: 0.69, blue: 0.26) // #ffb142
        }
        if n.contains("vox") || n.contains("voz") || r.contains("vocal") {
            return Color(red: 0.20, green: 0.67, blue: 0.88) // #34ace0
        }
        if n.contains("bass") || n.contains("bajo") || r.contains("bass") {
            return Color(red: 0.44, green: 0.44, blue: 0.83) // #706fd3
        }
        return Color(red: 0.0, green: 0.82, blue: 0.83) // #00d2d3
    }

    private var currentDB: Float {
        guard !isMuted, player.isPlaying else { return -60.0 }
        return player.vuLevels[stem.id] ?? -60.0
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Cabecera: Color Pill + Nombre del Stem
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(stemColor)
                    .frame(width: 14, height: 8)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(Color.white.opacity(0.3), lineWidth: 0.5))

                Text(stem.name)
                    .font(.system(size: 11, weight: .black))
                    .foregroundColor(isClickGuideStem ? Color(red: 0.97, green: 0.45, blue: 0.09) : .white)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 4)

            // Fader Stack: Escala dB + Medidor LED VU + Slider Fader
            HStack(spacing: 4) {
                // Escala de dB (+6, 0, -5, -10, -20, -40, -∞)
                VStack(alignment: .trailing, spacing: 0) {
                    Text("+6").font(.system(size: 7, weight: .bold)).foregroundColor(.gray)
                    Spacer()
                    Text("0").font(.system(size: 7, weight: .bold)).foregroundColor(Color(red: 0.0, green: 0.82, blue: 0.83))
                    Spacer()
                    Text("-5").font(.system(size: 7, weight: .bold)).foregroundColor(.gray)
                    Spacer()
                    Text("-10").font(.system(size: 7, weight: .bold)).foregroundColor(.gray)
                    Spacer()
                    Text("-20").font(.system(size: 7, weight: .bold)).foregroundColor(.gray)
                    Spacer()
                    Text("-40").font(.system(size: 7, weight: .bold)).foregroundColor(.gray)
                    Spacer()
                    Text("-∞").font(.system(size: 7, weight: .bold)).foregroundColor(.gray)
                }
                .frame(width: 16, height: 160)

                // Medidor VU LED Vertical de 32 segmentos
                VStack(spacing: 1.5) {
                    ForEach((0..<32).reversed(), id: \.self) { index in
                        let ledDB = Float(-60.0) + (Float(index) * Float(2.0625))
                        let isActive = currentDB >= ledDB
                        let ledColor: Color = index >= 28 ? Color(red: 0.96, green: 0.12, blue: 0.12) :
                                             (index >= 22 ? Color(red: 0.98, green: 0.75, blue: 0.14) : Color(red: 0.0, green: 0.82, blue: 0.83))

                        Rectangle()
                            .fill(isActive ? ledColor : Color.white.opacity(0.06))
                            .frame(width: 14, height: 3.5)
                            .cornerRadius(0.5)
                    }
                }
                .frame(height: 160)

                // Slider Fader Vertical
                VStack(spacing: 4) {
                    Text("\(Int(volume * 100))%")
                        .font(.system(size: 9, design: .monospaced).weight(.bold))
                        .foregroundColor(stemColor)

                    Slider(value: Binding(
                        get: { Double(volume) },
                        set: { newValue in
                            volume = Float(newValue)
                            onVolumeChange(volume)
                        }
                    ), in: 0.0...1.2)
                    .rotationEffect(.degrees(-90))
                    .accentColor(stemColor)
                    .frame(width: 140, height: 36)
                }
            }
            .frame(height: 170)

            // Grupo de Botones de Ruteo y Mute/Solo: [L] [M] [S] [R]
            HStack(spacing: 5) {
                // Botón L (Left)
                Button(action: toggleL) {
                    Text("L")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 32, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(routeL ? Color.cyan : Color(red: 0.12, green: 0.16, blue: 0.25))
                        )
                        .foregroundColor(routeL ? .black : Color.gray)
                }

                // Botón M (Mute)
                Button(action: {
                    isMuted.toggle()
                    onMuteToggle(isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 32, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isMuted ? Color.red : Color(red: 0.12, green: 0.16, blue: 0.25))
                        )
                        .foregroundColor(isMuted ? .white : Color.gray)
                }

                // Botón S (Solo)
                Button(action: {
                    isSolo.toggle()
                    onSoloToggle(isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 32, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isSolo ? Color.yellow : Color(red: 0.12, green: 0.16, blue: 0.25))
                        )
                        .foregroundColor(isSolo ? .black : Color.gray)
                }

                // Botón R (Right)
                Button(action: toggleR) {
                    Text("R")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 32, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(routeR ? Color.cyan : Color(red: 0.12, green: 0.16, blue: 0.25))
                        )
                        .foregroundColor(routeR ? .black : Color.gray)
                }
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(red: 0.08, green: 0.10, blue: 0.16))
                .shadow(color: Color.black.opacity(0.4), radius: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isClickGuideStem ? Color(red: 0.73, green: 0.11, blue: 0.11).opacity(0.6) : Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func toggleL() {
        routeL.toggle()
        updatePan()
    }

    private func toggleR() {
        routeR.toggle()
        updatePan()
    }

    private func updatePan() {
        var pan: Float = 0.0
        if routeL && !routeR { pan = -1.0 }
        else if routeR && !routeL { pan = 1.0 }
        onPanChange(pan)
    }
}

