//
//  MixerView.swift
//  ZionStageApple
//
//  Consola de Mezcla Multitrack Principal en SwiftUI nativo.
//  Réplica exacta del diseño visual de Android:
//  - Fondo Slate 900 (#0f172a)
//  - Tiras de canal de stems ordenadas de forma estable (Click 1º, Guía 2º)
//  - Waveform canvas con scrubber táctil neón
//  - Barra de transporte inferior con botones circulares resplandecientes (Play Cían #13b5b6, Stop Rojo #ef4444)
//

import SwiftUI

public struct MixerView: View {
    @ObservedObject public var player: ZionAudioPlayer = ZionAudioPlayer.shared

    public init(player: ZionAudioPlayer = ZionAudioPlayer.shared) {
        self.player = player
    }

    /// Ordena los stems de manera estable: Click 1º, Guía 2º, luego el resto de instrumentos.
    private var sortedStems: [Stem] {
        guard let song = player.currentSong else { return [] }
        var list = song.stems

        let isClick: (Stem) -> Bool = { $0.name.lowercased().contains("click") || $0.role.lowercased().contains("click") }
        let isGuide: (Stem) -> Bool = { $0.name.lowercased().contains("guia") || $0.name.lowercased().contains("guide") || $0.role.lowercased().contains("guide") }

        let clicks = list.filter(isClick)
        let guides = list.filter(isGuide)
        let others = list.filter { !isClick($0) && !isGuide($0) }

        var result: [Stem] = []
        if let firstClick = clicks.first { result.append(firstClick) }
        if let firstGuide = guides.first { result.append(firstGuide) }

        let remainingClicks = clicks.dropFirst()
        let remainingGuides = guides.dropFirst()

        result.append(contentsOf: remainingClicks)
        result.append(contentsOf: remainingGuides)
        result.append(contentsOf: others)

        return result
    }

    public var body: some View {
        VStack(spacing: 12) {
            // Cabecera Cyber/Android con Badges y Pitch/Tempo
            CyberHeaderView(player: player)

            // Visualizador de Forma de Onda (Waveform Canvas)
            WaveformCanvasView(player: player)

            // Consola de Tiras de Canales (Stems)
            if let song = player.currentSong, !song.stems.isEmpty {
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 10) {
                        ForEach(sortedStems) { stem in
                            ChannelStripView(
                                stem: stem,
                                onVolumeChange: { vol in
                                    player.setTrackVolume(id: stem.id, volume: vol)
                                },
                                onMuteToggle: { muted in
                                    player.setTrackMute(id: stem.id, muted: muted)
                                },
                                onSoloToggle: { solo in
                                    player.setTrackSolo(id: stem.id, solo: solo)
                                },
                                onPanChange: { pan in
                                    player.setTrackPan(id: stem.id, pan: pan)
                                }
                            )
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 4)
                }
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "slider.vertical.3")
                        .font(.system(size: 56))
                        .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.4))

                    Text("Selecciona una canción del catálogo para abrir la consola multitrack")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            // Barra de Transporte Inferior (Play, Pause, Stop, Master Volume)
            HStack(spacing: 28) {
                // Botón Stop
                Button(action: { player.stop() }) {
                    Image(systemName: "square.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(
                            Circle()
                                .fill(Color(red: 0.93, green: 0.27, blue: 0.27))
                                .shadow(color: Color.red.opacity(0.5), radius: 6)
                        )
                }

                // Botón Play / Pause Cían estilo Android
                Button(action: { player.togglePlayPause() }) {
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.black)
                        .frame(width: 58, height: 58)
                        .background(
                            Circle()
                                .fill(LinearGradient(gradient: Gradient(colors: [Color(red: 0.07, green: 0.71, blue: 0.71), Color(red: 0.0, green: 0.85, blue: 0.95)]), startPoint: .top, endPoint: .bottom))
                                .shadow(color: Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.6), radius: 8)
                        )
                }

                // Control de Volumen Master
                HStack(spacing: 8) {
                    Image(systemName: "speaker.wave.3.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))

                    Slider(value: Binding(
                        get: { Double(player.masterVolume) },
                        set: { player.masterVolume = Float($0) }
                    ), in: 0.0...1.2)
                    .accentColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                    .frame(width: 140)

                    Text("\(Int(player.masterVolume * 100))%")
                        .font(.system(size: 11, design: .monospaced).weight(.bold))
                        .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                        .frame(width: 38)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color(red: 0.12, green: 0.16, blue: 0.24))
                )
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(red: 0.09, green: 0.12, blue: 0.20))
                    .shadow(color: Color.black.opacity(0.6), radius: 10, x: 0, y: -4)
            )
            .padding(.horizontal)
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(Color(red: 0.06, green: 0.08, blue: 0.14).ignoresSafeArea())
    }
}
