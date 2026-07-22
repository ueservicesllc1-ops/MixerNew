//
//  SongLibraryView.swift
//  ZionStageApple
//
//  Catálogo nativo de canciones y repertorios en SwiftUI con estética Cyber/Dark.
//

import SwiftUI

private func makeDemoSongs() -> [Song] {
    let stems1: [Stem] = [
        Stem(id: "s1", name: "Click",    role: "click",  audioUrl: "click.mp3"),
        Stem(id: "s2", name: "Guía",     role: "guide",  audioUrl: "guide.mp3"),
        Stem(id: "s3", name: "Batería",  role: "drums",  audioUrl: "drums.mp3"),
        Stem(id: "s4", name: "Bajo",     role: "bass",   audioUrl: "bass.mp3"),
        Stem(id: "s5", name: "Guitarra", role: "guitar", audioUrl: "guitar.mp3"),
        Stem(id: "s6", name: "Teclados", role: "keys",   audioUrl: "keys.mp3"),
        Stem(id: "s7", name: "Voz Lead", role: "vocal",  audioUrl: "vocal.mp3")
    ]
    let song1 = Song(
        id: "1",
        title: "Cuan Grande es Él",
        artist: "Zion Stage Band",
        bpm: 72.0,
        key: "G",
        stems: stems1,
        isDownloaded: true,
        timeSignature: "4/4"
    )

    let stems2: [Stem] = [
        Stem(id: "s8",  name: "Click",    role: "click", audioUrl: "click.mp3"),
        Stem(id: "s9",  name: "Guía",     role: "guide", audioUrl: "guide.mp3"),
        Stem(id: "s10", name: "Batería",  role: "drums", audioUrl: "drums.mp3"),
        Stem(id: "s11", name: "Bajo",     role: "bass",  audioUrl: "bass.mp3"),
        Stem(id: "s12", name: "Teclados", role: "keys",  audioUrl: "keys.mp3")
    ]
    let song2 = Song(
        id: "2",
        title: "La Bondad de Dios",
        artist: "Bethel Music",
        bpm: 68.0,
        key: "A",
        stems: stems2,
        isDownloaded: true,
        timeSignature: "4/4"
    )

    let stems3: [Stem] = [
        Stem(id: "s13", name: "Click",    role: "click", audioUrl: "click.mp3"),
        Stem(id: "s14", name: "Guía",     role: "guide", audioUrl: "guide.mp3"),
        Stem(id: "s15", name: "Batería",  role: "drums", audioUrl: "drums.mp3"),
        Stem(id: "s16", name: "Bajo",     role: "bass",  audioUrl: "bass.mp3"),
        Stem(id: "s17", name: "Guitarras",role: "guitar",audioUrl: "guitar.mp3"),
        Stem(id: "s18", name: "Synths",   role: "keys",  audioUrl: "keys.mp3")
    ]
    let song3 = Song(
        id: "3",
        title: "Tumbas a Jardines",
        artist: "Elevation Worship",
        bpm: 70.0,
        key: "B",
        stems: stems3,
        isDownloaded: true,
        timeSignature: "6/8"
    )

    return [song1, song2, song3]
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
        VStack(spacing: 12) {
            // Buscador Cyber
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.cyan)
                TextField("Buscar canción o artista...", text: $searchText)
                    .foregroundColor(.white)
            }
            .padding(12)
            .background(Color(red: 0.12, green: 0.14, blue: 0.2))
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.cyan.opacity(0.3), lineWidth: 1))
            .padding(.horizontal)
            .padding(.top, 8)

            // Lista de canciones
            List(filteredSongs) { song in
                songRow(song)
                    .listRowBackground(Color(red: 0.08, green: 0.09, blue: 0.14))
            }
            .listStyle(.plain)
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.1).ignoresSafeArea())
    }

    @ViewBuilder
    private func songRow(_ song: Song) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(song.title)
                    .font(.headline.weight(.bold))
                    .foregroundColor(.white)

                HStack(spacing: 8) {
                    Text(song.artist)
                        .font(.subheadline)
                        .foregroundColor(Color(red: 0.7, green: 0.7, blue: 0.7))

                    Text("• \(Int(song.bpm)) BPM")
                        .font(.caption.weight(.bold))
                        .foregroundColor(.orange)

                    Text("• \(song.key)")
                        .font(.caption.weight(.bold))
                        .foregroundColor(.cyan)

                    Text("• \(song.stems.count) Pistas")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }

            Spacer()

            Button(action: {
                player.loadSong(song)
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 11))
                    Text("Cargar")
                        .font(.caption.weight(.bold))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    LinearGradient(gradient: Gradient(colors: [.cyan, Color(red: 0.0, green: 0.7, blue: 0.9)]), startPoint: .leading, endPoint: .trailing)
                )
                .foregroundColor(.black)
                .cornerRadius(16)
                .shadow(color: .cyan.opacity(0.4), radius: 4)
            }
        }
        .padding(.vertical, 4)
    }
}
