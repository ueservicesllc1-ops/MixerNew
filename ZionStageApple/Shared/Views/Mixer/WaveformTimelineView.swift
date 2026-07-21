//
//  WaveformTimelineView.swift
//  ZionStageApple
//
//  Línea de tiempo de forma de onda e indicador de posición scrubber.
//

import SwiftUI

public struct WaveformTimelineView: View {
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
        VStack(spacing: 4) {
            // Tiempos
            HStack {
                Text(formatTime(player.currentTime))
                    .font(.caption.weight(.bold))
                    .foregroundColor(.cyan)

                Spacer()

                Text(formatTime(player.duration))
                    .font(.caption)
                    .foregroundColor(.gray)
            }

            // Barra de progreso interactiva
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(height: 8)
                        .cornerRadius(4)

                    Rectangle()
                        .fill(LinearGradient(gradient: Gradient(colors: [.cyan, .blue]), startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(0, CGFloat(player.currentTime / max(1, player.duration)) * geo.size.width), height: 8)
                        .cornerRadius(4)
                }
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let percent = max(0, min(1, value.location.x / geo.size.width))
                            player.seek(to: Double(percent) * player.duration)
                        }
                )
            }
            .frame(height: 12)
        }
        .padding(.horizontal)
    }
}
