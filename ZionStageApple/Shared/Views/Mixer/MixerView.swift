//
//  MixerView.swift
//  ZionStageApple
//
//  Consola de Mezcla Multitrack Principal en SwiftUI nativo.
//

import SwiftUI

public struct MixerView: View {
    @ObservedObject public var player: ZionAudioPlayer = ZionAudioPlayer.shared

    public init(player: ZionAudioPlayer = ZionAudioPlayer.shared) {
        self.player = player
    }

    public var body: some View {
        VStack(spacing: 12) {
            // Header: Canción Actual e Info
            HStack {
                VStack(alignment: .leading) {
                    Text(player.currentSong?.title ?? "Ninguna canción cargada")
                        .font(.headline)
                        .bold()
                        .foregroundColor(.white)
                    Text(player.currentSong?.artist ?? "Selecciona una pista del catálogo")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }

                Spacer()

                // Controles de Pitch y Tempo
                PitchTempoControl(player: player)
            }
            .padding(.horizontal)

            // Timeline y Waveform
            WaveformTimelineView(player: player)

            // Consola de Tiras de Canales (Stems)
            if let song = player.currentSong, !song.stems.isEmpty {
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 10) {
                        ForEach(song.stems.indices, id: \.self) { idx in
                            ChannelStripView(
                                stem: Binding(
                                    get: { player.currentSong!.stems[idx] },
                                    set: { player.currentSong!.stems[idx] = $0 }
                                ),
                                onVolumeChange: { vol in
                                    player.setTrackVolume(id: song.stems[idx].id, volume: vol)
                                },
                                onMuteToggle: { muted in
                                    player.setTrackMute(id: song.stems[idx].id, muted: muted)
                                },
                                onSoloToggle: { solo in
                                    player.setTrackSolo(id: song.stems[idx].id, solo: solo)
                                },
                                onPanChange: { pan in
                                    player.setTrackPan(id: song.stems[idx].id, pan: pan)
                                }
                            )
                        }
                    }
                    .padding(.horizontal)
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "slider.vertical.3")
                        .font(.system(size: 48))
                        .foregroundColor(.gray.opacity(0.5))
                    Text("Carga una canción desde la librería para ver la consola multitrack")
                        .foregroundColor(.gray)
                }
                .frame(maxHeight: .infinity)
            }

            // Transport Bar (Play, Pause, Stop, Master Volume)
            HStack(spacing: 24) {
                Button(action: { player.stop() }) {
                    Image(systemName: "square.fill")
                        .font(.title2)
                        .foregroundColor(.red)
                }

                Button(action: { player.togglePlayPause() }) {
                    Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 52))
                        .foregroundColor(.cyan)
                }

                // Master Volume
                HStack {
                    Image(systemName: "speaker.wave.3.fill")
                        .foregroundColor(.gray)
                    Slider(value: Binding(
                        get: { Double(player.masterVolume) },
                        set: { player.masterVolume = Float($0) }
                    ), in: 0.0...1.2)
                    .frame(width: 120)
                }
            }
            .padding()
            .background(Color(red: 0.1, green: 0.1, blue: 0.1))
            .cornerRadius(12)
            .padding(.horizontal)
        }
        .background(Color(red: 0.06, green: 0.06, blue: 0.06).ignoresSafeArea())
    }
}
