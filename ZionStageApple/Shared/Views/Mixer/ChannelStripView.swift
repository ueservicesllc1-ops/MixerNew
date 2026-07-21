//
//  ChannelStripView.swift
//  ZionStageApple
//
//  Tira de canal individual para la consola multitrack (Fader, Mute, Solo, Pan, VUMeter).
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
        switch stem.role.lowercased() {
        case "vocal", "guias", "lead vocal": return Color.red
        case "drums", "bateria": return Color.orange
        case "bass", "bajo": return Color.blue
        case "guitar", "guitarras": return Color.green
        case "keys", "teclados", "synths": return Color.purple
        case "click", "metronomo": return Color.yellow
        case "guide", "guia": return Color.cyan
        default: return Color.gray
        }
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Nombre del Stem / Rol
            Text(stem.name)
                .font(.caption)
                .bold()
                .foregroundColor(.white)
                .lineLimit(1)
                .frame(maxWidth: 70)
                .padding(.vertical, 4)
                .background(stemColor.opacity(0.8))
                .cornerRadius(4)

            // Controles de Mute / Solo
            HStack(spacing: 4) {
                Button(action: {
                    stem.isMuted.toggle()
                    onMuteToggle(stem.isMuted)
                }) {
                    Text("M")
                        .font(.caption2)
                        .bold()
                        .frame(width: 28, height: 28)
                        .background(stem.isMuted ? Color.red : Color.gray.opacity(0.3))
                        .foregroundColor(.white)
                        .cornerRadius(4)
                }

                Button(action: {
                    stem.isSolo.toggle()
                    onSoloToggle(stem.isSolo)
                }) {
                    Text("S")
                        .font(.caption2)
                        .bold()
                        .frame(width: 28, height: 28)
                        .background(stem.isSolo ? Color.yellow : Color.gray.opacity(0.3))
                        .foregroundColor(stem.isSolo ? .black : .white)
                        .cornerRadius(4)
                }
            }

            // Slider de Fader vertical
            VStack {
                Text("\(Int(stem.volume * 100))%")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)

                Slider(value: Binding(
                    get: { Double(stem.volume) },
                    set: { newValue in
                        stem.volume = Float(newValue)
                        onVolumeChange(Float(newValue))
                    }
                ), in: 0.0...1.2)
                .rotationEffect(.degrees(-90))
                .frame(width: 160, height: 40)
            }
            .frame(height: 180)

            // Knob/Slider de Pan (L <-> R)
            HStack {
                Text("L")
                    .font(.system(size: 8))
                    .foregroundColor(.gray)
                Slider(value: Binding(
                    get: { Double(stem.pan) },
                    set: { newValue in
                        stem.pan = Float(newValue)
                        onPanChange(Float(newValue))
                    }
                ), in: -1.0...1.0)
                Text("R")
                    .font(.system(size: 8))
                    .foregroundColor(.gray)
            }
            .frame(width: 70)
        }
        .padding(6)
        .background(Color(red: 0.12, green: 0.12, blue: 0.12))
        .cornerRadius(8)
    }
}
