//
//  HorizontalMixerView.swift
//  ZionStageApple
//
//  Mezclador multitrack en disposición horizontal / landscape optimizado para iPad y escenarios.
//

import SwiftUI

public struct HorizontalMixerView: View {
    @ObservedObject public var player: ZionAudioPlayer

    public init(player: ZionAudioPlayer) {
        self.player = player
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: true) {
            HStack(spacing: 12) {
                if let song = player.currentSong {
                    ForEach(song.stems) { stem in
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
                } else {
                    Text("Carga una canción desde la librería")
                        .foregroundColor(.gray)
                        .padding()
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
    }
}
