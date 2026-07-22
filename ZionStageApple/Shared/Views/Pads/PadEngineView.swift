//
//  PadEngineView.swift
//  ZionStageApple
//
//  Vista de Pads Ambientales conectada al ZionPadPlayer (audio real sintetizado).
//  12 pads por tonalidad (C...B) con brillo Neón Cían y control de volumen/octava.
//

import SwiftUI

public struct PadEngineView: View {
    @ObservedObject var padPlayer: ZionPadPlayer = ZionPadPlayer.shared

    let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    public init() {}

    public var body: some View {
        VStack(spacing: 20) {
            // Título
            VStack(spacing: 4) {
                Text("Pads Ambientales")
                    .font(.title2.weight(.bold))
                    .foregroundColor(.white)

                if let activeKey = padPlayer.activeKey {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.cyan)
                            .frame(width: 8, height: 8)
                            .shadow(color: .cyan, radius: 4)
                        Text("Sonando en \(activeKey)")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.cyan)
                    }
                } else {
                    Text("Selecciona una tonalidad para sonar en continuo")
                        .font(.subheadline)
                        .foregroundColor(Color(white: 0.5))
                }
            }

            // Grilla de Pads (4 columnas × 3 filas)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
                ForEach(keys, id: \.self) { note in
                    let isActive = padPlayer.activeKey == note
                    Button(action: { padPlayer.toggleKey(note) }) {
                        VStack(spacing: 6) {
                            Text(note)
                                .font(.title3.weight(.bold))
                            if isActive {
                                HStack(spacing: 3) {
                                    ForEach(0..<4) { _ in
                                        RoundedRectangle(cornerRadius: 1)
                                            .fill(Color.black.opacity(0.6))
                                            .frame(width: 3, height: CGFloat.random(in: 6...16))
                                    }
                                }
                                .animation(.easeInOut(duration: 0.15).repeatForever(), value: isActive)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 70)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(isActive
                                    ? LinearGradient(colors: [.cyan, Color(red: 0.0, green: 0.6, blue: 0.85)], startPoint: .topLeading, endPoint: .bottomTrailing)
                                    : LinearGradient(colors: [Color(red: 0.12, green: 0.14, blue: 0.20), Color(red: 0.08, green: 0.09, blue: 0.14)], startPoint: .topLeading, endPoint: .bottomTrailing)
                                )
                                .shadow(color: isActive ? Color.cyan.opacity(0.7) : Color.black.opacity(0.3), radius: isActive ? 10 : 3)
                        )
                        .foregroundColor(isActive ? .black : .white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(isActive ? Color.white.opacity(0.6) : Color.cyan.opacity(0.15), lineWidth: isActive ? 1.5 : 0.5)
                        )
                        .scaleEffect(isActive ? 1.04 : 1.0)
                        .animation(.spring(response: 0.2, dampingFraction: 0.6), value: isActive)
                    }
                }
            }
            .padding(.horizontal)

            // Controles: Volumen + Octava
            VStack(spacing: 14) {
                // Volumen
                HStack(spacing: 12) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.cyan)
                        .frame(width: 22)

                    Slider(value: Binding(
                        get: { Double(padPlayer.volume) },
                        set: { padPlayer.setVolume(Float($0)) }
                    ), in: 0.0...1.0)
                    .accentColor(.cyan)

                    Text("\(Int(padPlayer.volume * 100))%")
                        .font(.system(size: 12, design: .monospaced).weight(.bold))
                        .foregroundColor(.cyan)
                        .frame(width: 38)
                }

                // Octava (Pitch offset: -1, 0, +1)
                HStack(spacing: 12) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 14))
                        .foregroundColor(.cyan)
                        .frame(width: 22)

                    Text("Octava:")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)

                    HStack(spacing: 8) {
                        ForEach([-1, 0, 1], id: \.self) { oct in
                            Button(action: {
                                padPlayer.pitchOffset = oct
                                if let key = padPlayer.activeKey {
                                    padPlayer.start(key: key)
                                }
                            }) {
                                Text(oct == 0 ? "Normal" : (oct > 0 ? "+\(oct)" : "\(oct)"))
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(padPlayer.pitchOffset == oct ? .black : .cyan)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(padPlayer.pitchOffset == oct ? Color.cyan : Color.cyan.opacity(0.1))
                                    )
                            }
                        }
                    }

                    Spacer()
                }
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color(red: 0.09, green: 0.11, blue: 0.16))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.cyan.opacity(0.2), lineWidth: 1))
            )
            .padding(.horizontal)

            Spacer()
        }
        .padding(.top)
        .background(Color(red: 0.06, green: 0.07, blue: 0.1).ignoresSafeArea())
    }
}
