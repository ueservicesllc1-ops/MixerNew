//
//  MetronomePanelView.swift
//  ZionStageApple
//
//  Vista UI para el Metrónomo nativo profesional en el panel inferior.
//

import SwiftUI

public struct MetronomePanelView: View {
    @ObservedObject public var metronome = MetronomeEngine.shared

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            // Fila 1: Botón Play / Stop + BPM + Tap Tempo
            HStack(spacing: 20) {
                Button(action: { metronome.toggle() }) {
                    Image(systemName: metronome.isPlaying ? "stop.fill" : "play.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.black)
                        .frame(width: 50, height: 50)
                        .background(Circle().fill(metronome.isPlaying ? Color.red : Color.cyan))
                        .shadow(color: metronome.isPlaying ? Color.red.opacity(0.5) : Color.cyan.opacity(0.5), radius: 6)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(Int(metronome.bpm)) BPM")
                        .font(.system(size: 24, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    Text("TEMPO")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.gray)
                }

                Slider(value: $metronome.bpm, in: 40...240, step: 1)
                    .accentColor(.cyan)

                Button(action: { metronome.bpm = max(40, metronome.bpm - 1) }) {
                    Text("-1")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)
                        .frame(width: 32, height: 32)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color.cyan.opacity(0.15)))
                }

                Button(action: { metronome.bpm = min(240, metronome.bpm + 1) }) {
                    Text("+1")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)
                        .frame(width: 32, height: 32)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color.cyan.opacity(0.15)))
                }
            }
            .padding(.horizontal, 20)

            // Fila 2: Compás (Time Signature) + Subdivisión
            HStack(spacing: 16) {
                // Selector de Compás
                VStack(alignment: .leading, spacing: 4) {
                    Text("COMPÁS")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.gray)

                    HStack(spacing: 6) {
                        ForEach(["2/4", "3/4", "4/4", "6/8"], id: \.self) { ts in
                            Button(action: { metronome.timeSignature = ts }) {
                                Text(ts)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(metronome.timeSignature == ts ? .black : .white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(RoundedRectangle(cornerRadius: 6).fill(metronome.timeSignature == ts ? Color.cyan : Color.white.opacity(0.1)))
                            }
                        }
                    }
                }

                Spacer()

                // Output Panning (IEM Click)
                VStack(alignment: .leading, spacing: 4) {
                    Text("SALIDA CLICK (PAN)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.gray)

                    HStack(spacing: 6) {
                        Button(action: { metronome.pan = -1.0 }) {
                            Text("IZQ (L)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(metronome.pan == -1.0 ? .black : .white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                                .background(RoundedRectangle(cornerRadius: 6).fill(metronome.pan == -1.0 ? Color.orange : Color.white.opacity(0.1)))
                        }

                        Button(action: { metronome.pan = 0.0 }) {
                            Text("AMBOS")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(metronome.pan == 0.0 ? .black : .white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                                .background(RoundedRectangle(cornerRadius: 6).fill(metronome.pan == 0.0 ? Color.cyan : Color.white.opacity(0.1)))
                        }
                    }
                }
            }
            .padding(.horizontal, 20)

            // Visualizador Animado de Beats
            HStack(spacing: 8) {
                ForEach(1...metronome.beatsPerBar, id: \.self) { beat in
                    let isCurrent = metronome.isPlaying && metronome.currentBeat == beat
                    Circle()
                        .fill(isCurrent ? (beat == 1 ? Color.red : Color.cyan) : Color.gray.opacity(0.25))
                        .frame(width: 24, height: 24)
                        .overlay(
                            Text("\(beat)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(isCurrent ? .black : .gray)
                        )
                        .shadow(color: isCurrent ? (beat == 1 ? Color.red : Color.cyan) : .clear, radius: 6)
                }
            }
            .padding(.top, 8)

            Spacer()
        }
        .padding(.top, 16)
        .background(Color(red: 0.08, green: 0.09, blue: 0.14))
    }
}
