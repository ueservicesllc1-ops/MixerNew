//
//  PadEngineView.swift
//  ZionStageApple
//
//  Reproductor nativo de Pads continuos ambientales por tonalidad (C, C#, D, etc.).
//

import SwiftUI

public struct PadEngineView: View {
    @State private var activeKey: String? = nil
    @State private var padVolume: Float = 0.8

    let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    public var body: some View {
        VStack(spacing: 20) {
            Text("Pads Ambientales")
                .font(.title2)
                .bold()
                .foregroundColor(.white)

            Text(activeKey == nil ? "Selecciona una nota para sonar en continuo" : "Sonando en tonalidad: \(activeKey!)")
                .font(.subheadline)
                .foregroundColor(activeKey == nil ? .gray : .cyan)

            // Grilla de Notas (3 columnas x 4 filas)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
                ForEach(keys, id: \.self) { note in
                    Button(action: {
                        if activeKey == note {
                            activeKey = nil // Apagar pad
                        } else {
                            activeKey = note // Encender nota
                        }
                    }) {
                        Text(note)
                            .font(.title3)
                            .bold()
                            .frame(maxWidth: .infinity, minHeight: 60)
                            .background(activeKey == note ? Color.cyan : Color(white: 0.15))
                            .foregroundColor(activeKey == note ? .black : .white)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(activeKey == note ? Color.white : Color.clear, lineWidth: 2)
                            )
                    }
                }
            }
            .padding(.horizontal)

            // Slider de Volumen Pad
            HStack {
                Image(systemName: "speaker.wave.2.fill")
                    .foregroundColor(.gray)
                Slider(value: $padVolume, in: 0.0...1.0)
                    .accentColor(.cyan)
                Text("\(Int(padVolume * 100))%")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .frame(width: 40)
            }
            .padding()
            .background(Color(white: 0.12))
            .cornerRadius(12)
            .padding(.horizontal)

            Spacer()
        }
        .padding(.top)
        .background(Color(white: 0.06).ignoresSafeArea())
    }
}
