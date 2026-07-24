import SwiftUI

struct SetlistsView: View {
    @StateObject private var dataStore = DataStore()
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Image(systemName: "music.note.list")
                    .foregroundColor(Color.zionCyan)
                Text("Domingo")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                Button("+Canciones") {}.font(.caption).foregroundColor(.purple)
                Button("+Setlist") {}.font(.caption).foregroundColor(Color.zionCyan)
            }
            .padding()
            .background(Color.zionPanel)
            
            // List
            if dataStore.setlists.isEmpty {
                VStack {
                    Spacer()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                    Text("Cargando Setlists...")
                        .foregroundColor(Color.zionTextSecondary)
                        .padding(.top, 10)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(dataStore.setlists) { setlist in
                            if let songs = setlist.songs, !songs.isEmpty {
                                ForEach(Array(songs.enumerated()), id: \.element.id) { index, song in
                                    let isSelected = AudioEngineViewModel.shared.loadedTracks.first?.id.contains(song.id) ?? false
                                    
                                    Button(action: {
                                        if let tracks = song.tracks {
                                            AudioEngineViewModel.shared.loadTracks(tracks)
                                        }
                                    }) {
                                        HStack {
                                            Text("\(index + 1)")
                                                .font(.caption)
                                                .foregroundColor(isSelected ? .white : Color.zionTextSecondary)
                                                .frame(width: 20)
                                            
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(song.name)
                                                    .font(.system(size: 14, weight: .bold))
                                                    .foregroundColor(isSelected ? .white : Color.zionTextPrimary)
                                                Text("\(song.artist ?? "Desconocido") • \(song.key ?? "C") • \(song.bpm ?? 120) BPM")
                                                    .font(.system(size: 11))
                                                    .foregroundColor(isSelected ? .white.opacity(0.8) : Color.zionTextSecondary)
                                            }
                                            
                                            Spacer()
                                            
                                            if isSelected {
                                                HStack(spacing: 4) {
                                                    Circle().fill(Color.green).frame(width: 6, height: 6)
                                                    Text("READY").font(.caption2).bold().foregroundColor(.green)
                                                }
                                            }
                                            
                                            Image(systemName: "trash")
                                                .foregroundColor(isSelected ? .white : Color.zionRed)
                                                .font(.caption)
                                        }
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 12)
                                        .background(isSelected ? Color.zionOrange : Color.zionPanelLight)
                                        .cornerRadius(8)
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.zionBorderSubtle, lineWidth: 1))
                                    }
                                }
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.zionBackground)
        .onAppear {
            dataStore.startListeningToSetlists()
        }
        .onDisappear {
            dataStore.stopListening()
        }
    }
}
