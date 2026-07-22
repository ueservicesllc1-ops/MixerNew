//
//  MixerView.swift
//  ZionStageApple
//
//  Consola de Mezcla Multitrack Principal estilo Cyber/Dark en SwiftUI nativo.
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
        VStack(spacing: 14) {
            // Cabecera Cyber con Badges (BPM, Key, Compás) y Pitch/Tempo
            CyberHeaderView(player: player)

            // Canvas de Forma de Onda (Waveform) y Scrubber Neón
            WaveformCanvasView(player: player)

            // Consola de Tiras de Canales (Stems)
            if let song = player.currentSong, !song.stems.isEmpty {
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 12) {
                        ForEach(sortedStems) { stem in
                            if let idx = player.currentSong?.stems.firstIndex(where: { $0.id == stem.id }) {
                                ChannelStripView(
                                    stem: Binding(
                                        get: { player.currentSong!.stems[idx] },
                                        set: { player.currentSong!.stems[idx] = $0 }
                                    ),
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
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 4)
                }
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "slider.vertical.3")
                        .font(.system(size: 54))
                        .foregroundColor(Color.cyan.opacity(0.4))

                    Text("Selecciona una canción del catálogo para cargar la consola multitrack")
                        .font(.subheadline)
                        .foregroundColor(Color(red: 0.6, green: 0.6, blue: 0.6))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            // Barra de Transporte Inferior (Play, Pause, Stop, Master Volume)
            HStack(spacing: 28) {
                // Botón Stop
                Button(action: { player.stop() }) {
                    Image(systemName: "square.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(
                            Circle()
                                .fill(Color.red.opacity(0.85))
                                .shadow(color: .red.opacity(0.4), radius: 6)
                        )
                }

                // Botón Play / Pause Neón Cían
                Button(action: { player.togglePlayPause() }) {
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 26))
                        .foregroundColor(.black)
                        .frame(width: 60, height: 60)
                        .background(
                            Circle()
                                .fill(LinearGradient(gradient: Gradient(colors: [.cyan, Color(red: 0.0, green: 0.7, blue: 0.9)]), startPoint: .top, endPoint: .bottom))
                                .shadow(color: .cyan.opacity(0.6), radius: 8)
                        )
                }

                // Control de Volumen Master
                HStack(spacing: 8) {
                    Image(systemName: "speaker.wave.3.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.cyan)

                    Slider(value: Binding(
                        get: { Double(player.masterVolume) },
                        set: { player.masterVolume = Float($0) }
                    ), in: 0.0...1.2)
                    .accentColor(.cyan)
                    .frame(width: 140)

                    Text("\(Int(player.masterVolume * 100))%")
                        .font(.system(size: 11, design: .monospaced).weight(.bold))
                        .foregroundColor(.cyan)
                        .frame(width: 36)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color(red: 0.12, green: 0.14, blue: 0.2))
                )
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(red: 0.08, green: 0.09, blue: 0.14))
                    .shadow(color: Color.black.opacity(0.5), radius: 8, x: 0, y: -2)
            )
            .padding(.horizontal)
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(Color(red: 0.06, green: 0.07, blue: 0.1).ignoresSafeArea())
    }
}
