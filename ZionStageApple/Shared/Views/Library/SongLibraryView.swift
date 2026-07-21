//
//  SongLibraryView.swift
//  ZionStageApple
//
//  Catálogo nativo de canciones y repertorios en SwiftUI.
//

import SwiftUI

@available(iOS 15.0, macOS 12.0, *)
public struct SongLibraryView: View {
    @ObservedObject public var player: ZionAudioPlayer = ZionAudioPlayer.shared
    @State private var searchText: String = ""

    // Canciones de muestra para vista previa e integración Firestore
    @State private var songs: [Song] = [
        Song(
            id: "1",
            title: "Cuan Grande es Él",
            artist: "Zion Stage Band",
            bpm: 72.0,
            key: "G",
            stems: [
                Stem(id: "s1", name: "Click", role: "click", audioUrl: ""),
                Stem(id: "s2", name: "Guía", role: "guide", audioUrl: ""),
                Stem(id: "s3", name: "Batería", role: "drums", audioUrl: ""),
                Stem(id: "s4", name: "Bajo", role: "bass", audioUrl: ""),
                Stem(id: "s5", name: "Guitarra 1", role: "guitar", audioUrl: ""),
                Stem(id: "s6", name: "Teclados", role: "keys", audioUrl: ""),
                Stem(id: "s7", name: "Voz Lead", role: "vocal", audioUrl: "")
            ],
            isDownloaded: true
        ),
        Song(
            id: "2",
            title: "La Bondad de Dios",
            artist: "Bethel Music",
            bpm: 68.0,
            key: "A",
            stems: [
                Stem(id: "s8", name: "Click", role: "click", audioUrl: ""),
                Stem(id: "s9", name: "Guía", role: "guide", audioUrl: ""),
                Stem(id: "s10", name: "Batería", role: "drums", audioUrl: ""),
                Stem(id: "s11", name: "Bajo", role: "bass", audioUrl: ""),
                Stem(id: "s12", name: "Teclados", role: "keys", audioUrl: "")
            ],
            isDownloaded: true
        )
    ]

    var filteredSongs: [Song] {
        if searchText.isEmpty { return songs }
        return songs.filter { $0.title.localizedCaseInsensitiveContains(searchText) || $0.artist.localizedCaseInsensitiveContains(searchText) }
    }

    public var body: some View {
        NavigationView {
            List(filteredSongs) { song in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(song.title)
                            .font(.headline)
                            .foregroundColor(.white)
                        HStack(spacing: 8) {
                            Text(song.artist)
                                .font(.subheadline)
                                .foregroundColor(.gray)
                            Text("• \(Int(song.bpm)) BPM")
                                .font(.caption)
                                .foregroundColor(.orange)
                            Text("• Tono: \(song.key)")
                                .font(.caption)
                                .foregroundColor(.cyan)
                        }
                    }

                    Spacer()

                    Button(action: {
                        player.loadSong(song)
                    }) {
                        HStack {
                            Image(systemName: "play.fill")
                            Text("Cargar")
                        }
                        .font(.caption)
                        .bold()
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.cyan)
                        .foregroundColor(.black)
                        .cornerRadius(16)
                    }
                }
                .listRowBackground(Color(white: 0.12))
            }
            .searchable(text: $searchText, prompt: "Buscar canción...")
            .navigationTitle("Catálogo de Pistas")
            .background(Color(white: 0.06).ignoresSafeArea())
        }
    }
}
