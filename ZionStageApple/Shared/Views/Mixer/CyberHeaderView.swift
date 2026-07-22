//
//  CyberHeaderView.swift
//  ZionStageApple
//
//  Cabecera estilo Cyber/Dark con información de la canción (Título, Artista, BPM, Key, Compás)
//  y controles avanzados de Tono (Pitch Shift -3 a +3 semitonos) y Tempo (Ratio BPM).
//

import SwiftUI

public struct CyberHeaderView: View {
    @ObservedObject public var player: ZionAudioPlayer

    public init(player: ZionAudioPlayer) {
        self.player = player
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 16) {
            // Título, Artista y Badges
            VStack(alignment: .leading, spacing: 6) {
                Text(player.currentSong?.title ?? "Ninguna canción cargada")
                    .font(.title2.weight(.bold))
                    .foregroundColor(.white)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Text(player.currentSong?.artist ?? "Selecciona una pista de la librería")
                        .font(.subheadline)
                        .foregroundColor(Color(red: 0.7, green: 0.7, blue: 0.7))
                        .lineLimit(1)

                    if let song = player.currentSong {
                        // Badge BPM
                        HStack(spacing: 3) {
                            Image(systemName: "metronome")
                                .font(.system(size: 10))
                            Text("\(Int(song.bpm)) BPM")
                                .font(.system(size: 11).weight(.bold))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.orange.opacity(0.2))
                        .foregroundColor(.orange)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.orange.opacity(0.4), lineWidth: 1))

                        // Badge Tonalidad / Key
                        HStack(spacing: 3) {
                            Image(systemName: "music.note")
                                .font(.system(size: 10))
                            Text(song.key)
                                .font(.system(size: 11).weight(.bold))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.cyan.opacity(0.2))
                        .foregroundColor(.cyan)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.cyan.opacity(0.4), lineWidth: 1))

                        // Badge Compás
                        Text(song.timeSignature)
                            .font(.system(size: 11).weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.purple.opacity(0.2))
                            .foregroundColor(.purple)
                            .cornerRadius(6)
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.purple.opacity(0.4), lineWidth: 1))
                    }
                }
            }

            Spacer()

            // Controles de Pitch y Tempo
            PitchTempoControl(player: player)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(red: 0.1, green: 0.12, blue: 0.18))
                .shadow(color: Color.black.opacity(0.4), radius: 6, x: 0, y: 3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.cyan.opacity(0.25), lineWidth: 1)
        )
        .padding(.horizontal)
    }
}
