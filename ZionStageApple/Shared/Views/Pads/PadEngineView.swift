//
//  PadEngineView.swift
//  ZionStageApple
//
//  Reproductor nativo de Pads continuos ambientales por tonalidad (C, C#, D, etc.) estilo Cyber/Neon.
//

import SwiftUI

public struct PadEngineView: View {
    @State private var activeKey: String? = nil
    @State private var padVolume: Float = 0.8

    public init() {}

    let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    public var body: some View {
        VStack(spacing: 20) {
            // Título de sección
            VStack(spacing: 4) {
                Text("Pads Ambientales")
                    .font(.title2.weight(.bold))
                    .foregroundColor(.white)

                Text(activeKey == nil ? "Selecciona una tonalidad para sonar en continuo" : "Sonando continuo en: \(activeKey!)")
                    .font(.subheadline)
                    .foregroundColor(activeKey == nil ? Color(red: 0.6, green: 0.6, blue: 0.6) : .cyan)
            }

            // Grilla de Pads (4 columnas x 3 filas)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 4), spacing: 14) {
                ForEach(keys, id: \.self) { note in
                    Button(action: {
                        if activeKey == note {
                            activeKey = nil // Apagar pad
                        } else {
                            activeKey = note // Encender pad
                        }
                    }) {
                        Text(note)
                            .font(.title3.weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 64)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(activeKey == note ?
                                          LinearGradient(gradient: Gradient(colors: [.cyan, Color(red: 0.0, green: 0.6, blue: 0.8)]), startPoint: .top, endPoint: .bottom) :
                                          LinearGradient(gradient: Gradient(colors: [Color(red: 0.12, green: 0.14, blue: 0.2), Color(red: 0.08, green: 0.09, blue: 0.14)]), startPoint: .top, endPoint: .bottom)
                                    )
                                    .shadow(color: activeKey == note ? .cyan.opacity(0.6) : Color.black.opacity(0.3), radius: activeKey == note ? 8 : 4)
                            )
                            .foregroundColor(activeKey == note ? .black : .white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(activeKey == note ? Color.white : Color.cyan.opacity(0.2), lineWidth: activeKey == note ? 2 : 1)
                            )
                    }
                }
            }
            .padding(.horizontal)

            // Slider de Volumen Pad
            HStack(spacing: 12) {
                Image(systemName: "speaker.wave.2.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.cyan)

                Slider(value: $padVolume, in: 0.0...1.0)
                    .accentColor(.cyan)

                Text("\(Int(padVolume * 100))%")
                    .font(.system(size: 12, design: .monospaced).weight(.bold))
                    .foregroundColor(.cyan)
                    .frame(width: 40)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(red: 0.1, green: 0.12, blue: 0.18))
            )
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cyan.opacity(0.3), lineWidth: 1))
            .padding(.horizontal)

            Spacer()
        }
        .padding(.top)
        .background(Color(red: 0.06, green: 0.07, blue: 0.1).ignoresSafeArea())
    }
}
