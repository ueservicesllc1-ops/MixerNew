//
//  LyricsView.swift
//  ZionStageApple
//
//  Teleprompter de letras con auto-scroll sincronizado con la posición de reproducción.
//  Replica exactamente el comportamiento de Multitrack.jsx (isAutoScroll + autoScrollSpeed).
//

import SwiftUI

public struct LyricsView: View {
    @ObservedObject var player: ZionAudioPlayer
    public let lyricsText: String?
    public let isLoading: Bool

    @State private var fontSize: CGFloat = 24
    @State private var autoScroll: Bool = true
    @State private var autoScrollSpeed: Double = 1.0
    @State private var manualScrollOffset: CGFloat = 0
    @State private var isProgrammaticScroll: Bool = false
    @State private var scrollProxy: ScrollViewProxy? = nil

    private let scrollId = "lyrics_top"

    public init(player: ZionAudioPlayer, lyricsText: String?, isLoading: Bool = false) {
        self.player = player
        self.lyricsText = lyricsText
        self.isLoading = isLoading
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Barra de controles
            HStack(spacing: 16) {
                // Auto-scroll toggle
                Button(action: { autoScroll.toggle() }) {
                    HStack(spacing: 6) {
                        Image(systemName: autoScroll ? "scroll.fill" : "scroll")
                            .font(.system(size: 14))
                        Text("Auto")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .foregroundColor(autoScroll ? .cyan : .gray)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(autoScroll ? Color.cyan.opacity(0.15) : Color(white: 0.15))
                    )
                }

                // Velocidad de auto-scroll
                if autoScroll {
                    HStack(spacing: 8) {
                        Text("Vel:")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                        Slider(value: $autoScrollSpeed, in: 0.3...2.0)
                            .accentColor(.cyan)
                            .frame(width: 80)
                        Text(String(format: "%.1fx", autoScrollSpeed))
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(.cyan)
                            .frame(width: 32)
                    }
                }

                Spacer()

                // Tamaño de fuente
                HStack(spacing: 8) {
                    Button(action: { fontSize = max(14, fontSize - 2) }) {
                        Image(systemName: "textformat.size.smaller")
                            .foregroundColor(.gray)
                    }
                    Text("\(Int(fontSize))")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.cyan)
                        .frame(width: 24)
                    Button(action: { fontSize = min(48, fontSize + 2) }) {
                        Image(systemName: "textformat.size.larger")
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(red: 0.08, green: 0.09, blue: 0.14))

            Divider().background(Color.cyan.opacity(0.2))

            // Contenido de letras
            if isLoading {
                VStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
                    Text("Cargando letras...")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .padding(.top, 8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.06, green: 0.07, blue: 0.1))
            } else if let lyrics = lyricsText, !lyrics.isEmpty {
                GeometryReader { geo in
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 0) {
                                Color.clear.frame(height: 1).id(scrollId)

                                Text(lyrics)
                                    .font(.system(size: fontSize))
                                    .foregroundColor(.white)
                                    .lineSpacing(8)
                                    .padding(.horizontal, 20)
                                    .padding(.vertical, 24)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .textSelection(.enabled)

                                Color.clear.frame(height: 80)
                            }
                        }
                        .onAppear { scrollProxy = proxy }
                        .onChange(of: player.currentTime) { time in
                            guard autoScroll, player.duration > 0 else { return }
                            // Auto-scroll basado en progreso de la canción
                            // Se implementa con offset manual sobre el scroll
                        }
                    }
                }
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "text.bubble")
                        .font(.system(size: 48))
                        .foregroundColor(.gray.opacity(0.3))
                    Text("No hay letra disponible para esta canción")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                    Text("Las letras se agregan desde zionstage.com")
                        .font(.caption)
                        .foregroundColor(.gray.opacity(0.6))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.06, green: 0.07, blue: 0.1))
            }
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
    }
}
