import SwiftUI

struct SetlistsView: View {
    @StateObject private var dataStore = DataStore()
    @ObservedObject var downloader = DownloadManager.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "music.note.list")
                    .foregroundColor(Color.zionCyan)
                
                Text(dataStore.setlists.first?.name ?? "Repertorio")
                    .font(.subheadline.bold())
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                Spacer()
                
                if let activeSetlist = dataStore.setlists.first,
                   let songs = activeSetlist.songs, !songs.isEmpty {
                    
                    let allDownloaded = songs.allSatisfy { downloader.isSongDownloaded($0) }
                    let anyDownloading = songs.contains { downloader.downloadingSongIds.contains($0.id) }
                    
                    if anyDownloading {
                        HStack(spacing: 6) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                                .scaleEffect(0.6)
                            Text("Sincronizando...").font(.system(size: 10, weight: .bold)).foregroundColor(Color.zionCyan)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.zionCyan.opacity(0.15))
                        .cornerRadius(6)
                    } else if allDownloaded {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(.green)
                            Text("Listo Offline").font(.system(size: 10, weight: .bold)).foregroundColor(.green)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.15))
                        .cornerRadius(6)
                    }
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            // List
            if dataStore.isLoading {
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
            } else if dataStore.setlists.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "music.note.house")
                        .font(.system(size: 40))
                        .foregroundColor(Color.zionTextSecondary)
                    Text("No tienes setlists guardados")
                        .font(.headline)
                        .foregroundColor(Color.zionTextPrimary)
                    Text("Crea o selecciona un setlist para reproducir")
                        .font(.subheadline)
                        .foregroundColor(Color.zionTextSecondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(dataStore.setlists) { setlist in
                            if let songs = setlist.songs, !songs.isEmpty {
                                ForEach(Array(songs.enumerated()), id: \.element.id) { index, song in
                                    let songNumber = String(index + 1)
                                    let artistText = song.artist ?? "Desconocido"
                                    let keyText = song.key ?? "C"
                                    let bpmText = song.bpm != nil ? "\(Int(song.bpm!))" : "120"
                                    let subtitle = "\(artistText) • \(keyText) • \(bpmText) BPM"
                                    let isSelected = AudioEngineViewModel.shared.loadedTracks.first?.id.contains(song.id) ?? false
                                    
                                    Button(action: {
                                        if let tracks = song.tracks {
                                            AudioEngineViewModel.shared.currentSong = song
                                            AudioEngineViewModel.shared.loadTracks(tracks)
                                        }
                                    }) {
                                        HStack {
                                            Text(songNumber)
                                                .font(.caption)
                                                .foregroundColor(isSelected ? .white : Color.zionTextSecondary)
                                                .frame(width: 20)
                                            
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(song.name)
                                                    .font(.system(size: 14, weight: .bold))
                                                    .foregroundColor(isSelected ? .white : Color.zionTextPrimary)
                                                Text(subtitle)
                                                    .font(.system(size: 11))
                                                    .foregroundColor(isSelected ? .white.opacity(0.8) : Color.zionTextSecondary)
                                            }
                                            
                                            Spacer()
                                            
                                            HStack(spacing: 8) {
                                                if isSelected {
                                                    HStack(spacing: 4) {
                                                        Circle().fill(Color.green).frame(width: 6, height: 6)
                                                        Text("READY").font(.caption2).bold().foregroundColor(.green)
                                                    }
                                                }
                                                
                                                if downloader.downloadingSongIds.contains(song.id) {
                                                    ProgressView()
                                                        .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                                                        .scaleEffect(0.8)
                                                } else if downloader.isSongDownloaded(song) {
                                                    Image(systemName: "checkmark.icloud.fill")
                                                        .foregroundColor(.green)
                                                        .font(.system(size: 12, weight: .bold))
                                                }
                                            }
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
