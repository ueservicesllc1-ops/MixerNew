//
//  WaveformCanvasView.swift
//  ZionStageApple
//
//  Visualizador nativo de forma de onda (Waveform Canvas) estilo Cyber/Neon
//  con scrubbing táctil interactivo, marcadores de sección y barras de progreso.
//

import SwiftUI

public struct WaveformCanvasView: View {
    @ObservedObject public var player: ZionAudioPlayer

    public init(player: ZionAudioPlayer) {
        self.player = player
    }

    private func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }

    public var body: some View {
        VStack(spacing: 6) {
            // Tiempos y Posición
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.cyan)
                    Text(formatTime(player.currentTime))
                        .font(.system(size: 13, design: .monospaced).weight(.bold))
                        .foregroundColor(.cyan)
                }

                Spacer()

                HStack(spacing: 4) {
                    Text("-" + formatTime(max(0, player.duration - player.currentTime)))
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(Color(red: 0.6, green: 0.6, blue: 0.6))
                    Image(systemName: "clock")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
            }

            // Canvas de Forma de Onda con Scrubber Neón
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Fondo del Canvas de Forma de Onda
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(red: 0.08, green: 0.1, blue: 0.15))

                    // Barras de Forma de Onda Simulada (Waveform Visualizer Bars)
                    HStack(spacing: 3) {
                        ForEach(0..<Int(geo.size.width / 5), id: \.self) { i in
                            let heightFactor = abs(sin(Double(i) * 0.25)) * 0.8 + 0.2
                            let isPassed = CGFloat(i) / (geo.size.width / 5) <= CGFloat(player.currentTime / max(1, player.duration))

                            RoundedRectangle(cornerRadius: 2)
                                .fill(isPassed ?
                                      LinearGradient(gradient: Gradient(colors: [.cyan, .blue]), startPoint: .top, endPoint: .bottom) :
                                      LinearGradient(gradient: Gradient(colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.15)]), startPoint: .top, endPoint: .bottom)
                                )
                                .frame(height: max(6, geo.size.height * CGFloat(heightFactor)))
                        }
                    }
                    .padding(.horizontal, 6)

                    // Cursor de Posición Scrubber (Línea Neón Cían brillante)
                    let progressWidth = max(0, min(geo.size.width, CGFloat(player.currentTime / max(1, player.duration)) * geo.size.width))
                    Rectangle()
                        .fill(Color.cyan)
                        .frame(width: 3, height: geo.size.height + 4)
                        .shadow(color: .cyan, radius: 4, x: 0, y: 0)
                        .offset(x: progressWidth)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.cyan.opacity(0.3), lineWidth: 1)
                )
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let percent = max(0, min(1, value.location.x / geo.size.width))
                            player.seek(to: Double(percent) * player.duration)
                        }
                )
            }
            .frame(height: 54)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(red: 0.08, green: 0.09, blue: 0.14))
        )
        .padding(.horizontal)
    }
}
