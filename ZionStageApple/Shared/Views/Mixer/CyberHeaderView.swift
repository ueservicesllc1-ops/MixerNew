//
//  CyberHeaderView.swift
//  ZionStageApple
//
//  Cabecera multitrack en SwiftUI estilo Android/Slate.
//  Muestra el título de la canción, artista, badges de BPM, Key y Compás,
//  junto con el control de Tono (Pitch Shift) y Tempo (Speed multiplier).
//

import SwiftUI

public struct CyberHeaderView: View {
    @ObservedObject public var player: ZionAudioPlayer

    public init(player: ZionAudioPlayer) {
        self.player = player
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 16) {
            // Título de la Canción, Artista y Badges
            VStack(alignment: .leading, spacing: 6) {
                Text(player.currentSong?.title ?? "Sin canción cargada")
                    .font(.system(size: 20, weight: .bold, design: .default))
                    .foregroundColor(.white)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Text(player.currentSong?.artist ?? "Selecciona un tema del catálogo")
                        .font(.system(size: 13))
                        .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))
                        .lineLimit(1)

                    if let song = player.currentSong {
                        // Badge BPM
                        HStack(spacing: 3) {
                            Image(systemName: "metronome.fill")
                                .font(.system(size: 10))
                            Text("\(Int(song.tempo ?? 120)) BPM")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(red: 0.97, green: 0.45, blue: 0.09).opacity(0.2))
                        .foregroundColor(Color(red: 0.97, green: 0.45, blue: 0.09))
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(red: 0.97, green: 0.45, blue: 0.09).opacity(0.5), lineWidth: 1))

                        // Badge Tonalidad / Key
                        HStack(spacing: 3) {
                            Image(systemName: "music.note")
                                .font(.system(size: 10))
                            Text(song.key ?? "-")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.2))
                        .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.5), lineWidth: 1))

                        // Badge Compás
                        Text(song.timeSignature ?? "4/4")
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(red: 0.66, green: 0.33, blue: 0.97).opacity(0.2))
                            .foregroundColor(Color(red: 0.66, green: 0.33, blue: 0.97))
                            .cornerRadius(6)
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(red: 0.66, green: 0.33, blue: 0.97).opacity(0.5), lineWidth: 1))
                    }
                }
            }

            Spacer()

            // Controles de Pitch y Tempo
            PitchTempoControl(player: player)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(red: 0.09, green: 0.12, blue: 0.2))
                .shadow(color: Color.black.opacity(0.5), radius: 6, x: 0, y: 3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal)
    }
}
