//
//  PitchTempoControl.swift
//  ZionStageApple
//
//  Controles nativos SwiftUI para cambio de Tono (Semitonos -3 a +3) y Tempo (BPM).
//

import SwiftUI

public struct PitchTempoControl: View {
    @ObservedObject public var player: ZionAudioPlayer

    public init(player: ZionAudioPlayer) {
        self.player = player
    }

    public var body: some View {
        HStack(spacing: 20) {
            // Control de Tono (Pitch Shift)
            VStack(alignment: .leading, spacing: 4) {
                Text("TONO (PITCH)")
                    .font(.caption2)
                    .bold()
                    .foregroundColor(.gray)

                HStack {
                    Button(action: {
                        if player.pitchSemitones > -3.0 {
                            player.pitchSemitones -= 1.0
                        }
                    }) {
                        Image(systemName: "minus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.cyan)
                    }

                    Text("\(player.pitchSemitones >= 0 ? "+" : "")\(Int(player.pitchSemitones)) st")
                        .font(.callout)
                        .bold()
                        .foregroundColor(.white)
                        .frame(width: 55)

                    Button(action: {
                        if player.pitchSemitones < 3.0 {
                            player.pitchSemitones += 1.0
                        }
                    }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.cyan)
                    }
                }
            }
            .padding(8)
            .background(Color(red: 0.15, green: 0.15, blue: 0.15))
            .cornerRadius(8)

            // Control de Tempo / BPM
            VStack(alignment: .leading, spacing: 4) {
                Text("TEMPO (BPM)")
                    .font(.caption2)
                    .bold()
                    .foregroundColor(.gray)

                HStack {
                    Button(action: {
                        if player.tempoRatio > 0.8 {
                            player.tempoRatio -= 0.05
                        }
                    }) {
                        Image(systemName: "minus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.orange)
                    }

                    Text("\(Int(player.tempoRatio * 100))%")
                        .font(.callout)
                        .bold()
                        .foregroundColor(.white)
                        .frame(width: 55)

                    Button(action: {
                        if player.tempoRatio < 1.2 {
                            player.tempoRatio += 0.05
                        }
                    }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.orange)
                    }
                }
            }
            .padding(8)
            .background(Color(red: 0.15, green: 0.15, blue: 0.15))
            .cornerRadius(8)
        }
    }
}
