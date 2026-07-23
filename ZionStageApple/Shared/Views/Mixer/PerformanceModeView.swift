//
//  PerformanceModeView.swift
//  ZionStageApple
//
//  Vista fullscreen de Alto Rendimiento para Escenario (Performance Mode).
//  Diseñada para ser clara a distancia bajo luces de escenario.
//  Mantiene la pantalla encendida (isIdleTimerDisabled), muestra compás/pulso en tiempo real,
//  letras sincronizadas de gran tamaño y sección actual -> siguiente.
//

import SwiftUI

public struct PerformanceModeView: View {
    @ObservedObject public var player: ZionAudioPlayer
    public var onClose: () -> Void

    @State private var lyricsText: String? = nil
    @State private var isLoadingLyrics: Bool = false

    public init(player: ZionAudioPlayer, onClose: @escaping () -> Void) {
        self.player = player
        self.onClose = onClose
    }

    private func formatTime(_ seconds: Double) -> String {
        guard !seconds.isNaN && seconds >= 0 else { return "00:00" }
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }

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
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 20) {
                // Header del Escenario (Título, Artista, Botón Salir)
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(player.currentSong?.title ?? "Zion Stage")
                            .font(.system(size: 28, weight: .black))
                            .foregroundColor(.white)
                            .lineLimit(1)

                        Text(player.currentSong?.artist ?? "")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.cyan)
                    }

                    Spacer()

                    Button(action: onClose) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(.gray)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)

                // Barra Gigante de Sección Actual y Siguiente
                let sections = currentAndNextSection
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("SECCIÓN ACTUAL")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.gray)
                        Text(sections.current)
                            .font(.system(size: 36, weight: .black))
                            .foregroundColor(.cyan)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color(red: 0.08, green: 0.12, blue: 0.20))
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cyan.opacity(0.4), lineWidth: 1.5))

                    Image(systemName: "arrow.right")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.gray)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("SIGUIENTE")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.gray)
                        Text(sections.next)
                            .font(.system(size: 36, weight: .black))
                            .foregroundColor(.yellow)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color(red: 0.16, green: 0.14, blue: 0.08))
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.yellow.opacity(0.4), lineWidth: 1.5))
                }
                .padding(.horizontal, 24)

                // Visor de Letras Gigante
                ScrollViewReader { proxy in
                    ScrollView {
                        if isLoadingLyrics {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
                                .padding(.top, 40)
                        } else if let lyrics = lyricsText, !lyrics.isEmpty {
                            Text(lyrics)
                                .font(.system(size: 26, weight: .bold))
                                .foregroundColor(.white)
                                .multilineTextAlignment(.center)
                                .lineSpacing(12)
                                .padding(24)
                        } else {
                            Text("Sin letra disponible para esta pista")
                                .font(.system(size: 20))
                                .foregroundColor(.gray)
                                .padding(.top, 40)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.06, green: 0.07, blue: 0.1))
                .cornerRadius(16)
                .padding(.horizontal, 24)

                // Barra Inferior de Transporte Grande
                HStack(spacing: 24) {
                    // Play/Pause Gigante
                    Button(action: { player.togglePlayPause() }) {
                        Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 56))
                            .foregroundColor(.cyan)
                    }

                    // Stop
                    Button(action: { player.stop() }) {
                        Image(systemName: "square.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.red.opacity(0.8))
                    }

                    Spacer()

                    // Tiempo Gigante
                    Text("\(formatTime(player.currentTime)) / \(formatTime(player.duration))")
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 24)
            }
        }
        .onAppear {
            #if os(iOS)
            UIApplication.shared.isIdleTimerDisabled = true
            #endif
            fetchLyrics()
        }
        .onDisappear {
            #if os(iOS)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
    }

    private func fetchLyrics() {
        guard let song = player.currentSong else { return }
        isLoadingLyrics = true
        FirebaseService.shared.fetchLyrics(songId: song.id) { text in
            DispatchQueue.main.async {
                self.lyricsText = text ?? song.lyrics
                self.isLoadingLyrics = false
            }
        }
    }
}
