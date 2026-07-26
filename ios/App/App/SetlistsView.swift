import SwiftUI

struct SetlistsView: View {
    @StateObject private var dataStore = DataStore()
    @ObservedObject var downloader = DownloadManager.shared
    @ObservedObject var themeManager = ThemeManager.shared
    
    var onOpenLibrary: (() -> Void)? = nil
    @State private var showCreateSetlistAlert = false
    @State private var newSetlistName = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "music.note.list")
                    .foregroundColor(Color.zionCyan)
                
                Text(dataStore.setlists.first?.name ?? "Repertorio")
                    .font(.subheadline.bold())
                    .foregroundColor(Color.zionTextPrimary)
                    .lineLimit(1)
                
                // Show automatic sync status
                if let activeSetlist = dataStore.setlists.first,
                   let songs = activeSetlist.songs, !songs.isEmpty {
                    
                    let anyDownloading = songs.contains { downloader.downloadingSongIds.contains($0.id) }
                    let allDownloaded = songs.allSatisfy { downloader.isSongDownloaded($0) }
                    
                    if anyDownloading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                            .scaleEffect(0.6)
                    } else if allDownloaded {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundColor(.green)
                            .font(.system(size: 11))
                    }
                }
                
                Spacer()
                
                // +Canciones and +Setlist Buttons
                Button(action: {
                    onOpenLibrary?()
                }) {
                    Text("+Canciones")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.purple)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.purple.opacity(0.15))
                        .cornerRadius(6)
                }
                
                Button(action: {
                    showCreateSetlistAlert = true
                }) {
                    Text("+Setlist")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color.zionCyan)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.zionCyan.opacity(0.15))
                        .cornerRadius(6)
                }
                .alert("Crear Nuevo Setlist", isPresented: $showCreateSetlistAlert) {
                    TextField("Nombre del repertorio", text: $newSetlistName)
                    Button("Cancelar", role: .cancel) { newSetlistName = "" }
                    Button("Crear") {
                        let trimmed = newSetlistName.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty {
                            dataStore.createSetlist(name: trimmed)
                            newSetlistName = ""
                        }
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
                                    let totalTracks = song.tracks?.count ?? 0
                                    let downloadedTracks = song.tracks?.filter { downloader.isTrackDownloaded($0) }.count ?? 0
                                    
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
                                                    HStack(spacing: 4) {
                                                        ProgressView()
                                                            .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                                                            .scaleEffect(0.7)
                                                        Text("\(downloadedTracks)/\(totalTracks)")
                                                            .font(.system(size: 10, weight: .bold))
                                                            .foregroundColor(Color.zionCyan)
                                                    }
                                                } else if downloadedTracks == totalTracks && totalTracks > 0 {
                                                    HStack(spacing: 4) {
                                                        Image(systemName: "checkmark.icloud.fill")
                                                            .foregroundColor(.green)
                                                            .font(.system(size: 11, weight: .bold))
                                                        Text("\(totalTracks)/\(totalTracks)")
                                                            .font(.system(size: 10, weight: .bold))
                                                            .foregroundColor(.green)
                                                    }
                                                } else {
                                                    Text("\(downloadedTracks)/\(totalTracks)")
                                                        .font(.system(size: 10))
                                                        .foregroundColor(Color.zionTextSecondary)
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
            
            Divider().background(Color.zionBorderSubtle)
            
            // Ambient Pads Section Below Song List
            PadEngineView()
                .padding(6)
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
