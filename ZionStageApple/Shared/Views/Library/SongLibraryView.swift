//
//  SongLibraryView.swift
//  ZionStageApple
//
//  Catálogo nativo de canciones y repertorios en SwiftUI.
//

import SwiftUI

private func makeDemoSongs() -> [Song] {
    let stems1: [Stem] = [
        Stem(id: "s1", name: "Click",    role: "click",  audioUrl: ""),
        Stem(id: "s2", name: "Guía",     role: "guide",  audioUrl: ""),
        Stem(id: "s3", name: "Batería",  role: "drums",  audioUrl: ""),
        Stem(id: "s4", name: "Bajo",     role: "bass",   audioUrl: ""),
        Stem(id: "s5", name: "Guitarra", role: "guitar", audioUrl: ""),
        Stem(id: "s6", name: "Teclados", role: "keys",   audioUrl: ""),
        Stem(id: "s7", name: "Voz Lead", role: "vocal",  audioUrl: "")
    ]
    let song1 = Song(
        id: "1",
        title: "Cuan Grande es Él",
        artist: "Zion Stage Band",
        bpm: 72.0,
        key: "G",
        stems: stems1,
        isDownloaded: true
    )

    let stems2: [Stem] = [
        Stem(id: "s8",  name: "Click",    role: "click", audioUrl: ""),
        Stem(id: "s9",  name: "Guía",     role: "guide", audioUrl: ""),
        Stem(id: "s10", name: "Batería",  role: "drums", audioUrl: ""),
        Stem(id: "s11", name: "Bajo",     role: "bass",  audioUrl: ""),
        Stem(id: "s12", name: "Teclados", role: "keys",  audioUrl: "")
    ]
    let song2 = Song(
        id: "2",
        title: "La Bondad de Dios",
        artist: "Bethel Music",
        bpm: 68.0,
        key: "A",
        stems: stems2,
        isDownloaded: true
    )

    return [song1, song2]
}

public struct SongLibraryView: View {
    @ObservedObject var player: ZionAudioPlayer
    @State private var searchText: String = ""
    @State private var songs: [Song] = makeDemoSongs()

    public init(player: ZionAudioPlayer = ZionAudioPlayer.shared) {
        self.player = player
    }

    private var filteredSongs: [Song] {
        if searchText.isEmpty { return songs }
        return songs.filter {
            $0.title.localizedCaseInsensitiveContains(searchText) ||
            $0.artist.localizedCaseInsensitiveContains(searchText)
        }
    }

    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.gray)
                    TextField("Buscar canción o artista...", text: $searchText)
                        .foregroundColor(.white)
                }
                .padding(10)
                .background(Color(red: 0.18, green: 0.18, blue: 0.18))
                .cornerRadius(10)
                .padding(.horizontal)
                .padding(.top, 8)

                List(filteredSongs) { song in
                    songRow(song)
                        .listRowBackground(Color(red: 0.12, green: 0.12, blue: 0.12))
                }
                .listStyle(.plain)
            }
            .navigationTitle("Catálogo de Pistas")
            .background(Color(red: 0.06, green: 0.06, blue: 0.06).ignoresSafeArea())
        }
    }

    @ViewBuilder
    private func songRow(_ song: Song) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(song.title)
                    .font(.headline.weight(.bold))
                    .foregroundColor(.white)
                HStack(spacing: 8) {
                    Text(song.artist)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                    Text("• \(Int(song.bpm)) BPM")
                        .font(.caption)
                        .foregroundColor(.orange)
                    Text("• \(song.key)")
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
                .font(.caption.weight(.bold))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.cyan)
                .foregroundColor(.black)
                .cornerRadius(16)
            }
        }
    }
}
