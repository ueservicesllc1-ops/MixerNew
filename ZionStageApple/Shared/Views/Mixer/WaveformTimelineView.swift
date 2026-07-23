//
//  WaveformTimelineView.swift
//  ZionStageApple
//
//  Línea de tiempo profesional con forma de onda real, marcadores de sección,
//  controles de Loop A-B e indicador de sección actual -> siguiente.
//

import SwiftUI

public struct WaveformTimelineView: View {
    @ObservedObject public var player: ZionAudioPlayer

    public init(player: ZionAudioPlayer) {
        self.player = player
    }

    private func formatTime(_ seconds: Double) -> String {
        guard !seconds.isNaN && seconds >= 0 else { return "00:00" }
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }

    // Sección actual y siguiente según los marcadores de la canción
    private var currentAndNextSection: (current: String, next: String) {
        guard let song = player.currentSong, !song.markers.isEmpty else {
            return ("-", "-")
        }
        let sortedMarkers = song.markers.sorted { $0.time < $1.time }
        let time = player.currentTime

        var currentLabel = "INTRO"
        var nextLabel = "-"

        for (index, marker) in sortedMarkers.enumerated() {
            if time >= marker.time {
                currentLabel = marker.label
                if index + 1 < sortedMarkers.count {
                    nextLabel = sortedMarkers[index + 1].label
                } else {
                    nextLabel = "FIN"
                }
            }
        }
        return (currentLabel, nextLabel)
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Fila Superior: Tiempos + Indicador Sección Actual -> Siguiente + Loop A-B
            HStack {
                // Tiempo Transcurrido
                Text(formatTime(player.currentTime))
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.cyan)

                Spacer()

                // Sección Actual -> Siguiente
                if let song = player.currentSong, !song.markers.isEmpty {
                    let sections = currentAndNextSection
                    HStack(spacing: 6) {
                        Text(sections.current)
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.cyan.opacity(0.25))
                            .foregroundColor(.cyan)
                            .cornerRadius(6)

                        Image(systemName: "arrow.right")
                            .font(.system(size: 9))
                            .foregroundColor(.gray)

                        Text(sections.next)
                            .font(.system(size: 11, weight: .medium))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.white.opacity(0.1))
                            .foregroundColor(.gray)
                            .cornerRadius(6)
                    }
                }

                Spacer()

                // Botón Loop A-B
                Button(action: { player.toggleLoop() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "repeat")
                            .font(.system(size: 12))
                        Text(player.isLooping ? "LOOP ON" : "LOOP")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(player.isLooping ? Color.orange : Color.gray.opacity(0.2))
                    .foregroundColor(player.isLooping ? .black : .white)
                    .cornerRadius(6)
                }

                // Tiempo Total
                Text(formatTime(player.duration))
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.gray)
            }

            // Canvas de Forma de Onda (Waveform) con Marcadores de Sección
            GeometryReader { geo in
                let width = geo.size.width
                let height = geo.size.height
                let progressPercent = CGFloat(player.duration > 0 ? player.currentTime / player.duration : 0)

                ZStack(alignment: .leading) {
                    // Fondo Waveform
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(red: 0.1, green: 0.12, blue: 0.18))

                    // Pintado de picos reales de forma de onda
                    if !player.waveformPeaks.isEmpty {
                        Path { path in
                            let peaks = player.waveformPeaks
                            let step = width / CGFloat(peaks.count)
                            let midY = height / 2

                            for (i, peak) in peaks.enumerated() {
                                let x = CGFloat(i) * step
                                let barHeight = max(2, CGFloat(peak) * height * 0.85)
                                path.move(to: CGPoint(x: x, y: midY - barHeight / 2))
                                path.addLine(to: CGPoint(x: x, y: midY + barHeight / 2))
                            }
                        }
                        .stroke(
                            LinearGradient(
                                colors: [.cyan.opacity(0.4), .blue.opacity(0.4)],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            lineWidth: max(1, width / CGFloat(player.waveformPeaks.count))
                        )
                    }

                    // Overlay de Progreso Transcurrido
                    Rectangle()
                        .fill(Color.cyan.opacity(0.3))
                        .frame(width: max(0, min(width, progressPercent * width)))

                    // Rango de Loop A-B en la línea de tiempo
                    if player.isLooping && player.duration > 0 {
                        let startX = CGFloat(player.loopStart / player.duration) * width
                        let endX = CGFloat(player.loopEnd / player.duration) * width
                        Rectangle()
                            .fill(Color.orange.opacity(0.25))
                            .frame(width: max(0, endX - startX))
                            .offset(x: startX)
                            .overlay(
                                Rectangle().stroke(Color.orange, lineWidth: 1.5).offset(x: startX)
                            )
                    }

                    // Marcadores de Sección (Vertical Flags)
                    if let song = player.currentSong {
                        ForEach(song.markers) { marker in
                            let posX = CGFloat(player.duration > 0 ? marker.time / player.duration : 0) * width
                            VStack(spacing: 0) {
                                Rectangle()
                                    .fill(Color.yellow.opacity(0.8))
                                    .frame(width: 1.5, height: height)
                            }
                            .offset(x: posX)
                            .overlay(
                                Text(marker.label)
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.black)
                                    .padding(.horizontal, 3)
                                    .padding(.vertical, 1)
                                    .background(Color.yellow)
                                    .cornerRadius(3)
                                    .offset(x: posX, y: -height / 2 + 6)
                            )
                        }
                    }

                    // Cabeza de Reproducción (Playhead Line)
                    Rectangle()
                        .fill(Color.white)
                        .frame(width: 2, height: height)
                        .shadow(color: .cyan, radius: 4)
                        .offset(x: max(0, min(width - 2, progressPercent * width)))
                }
                .cornerRadius(6)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let percent = max(0, min(1, value.location.x / width))
                            player.seek(to: Double(percent) * player.duration)
                        }
                )
            }
            .frame(height: 48)
        }
        .padding(.horizontal)
    }
}
