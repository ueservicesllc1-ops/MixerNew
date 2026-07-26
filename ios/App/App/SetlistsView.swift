import SwiftUI

struct SetlistsView: View {
    @StateObject private var dataStore = DataStore()
    @ObservedObject var downloader = DownloadManager.shared
    @ObservedObject var themeManager = ThemeManager.shared
    
    var onOpenLibrary: (() -> Void)? = nil
    @State private var showLibraryDrawer = false
    @State private var showSetlistsDrawer = false
    @State private var newSetlistName = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "music.note.list")
                    .foregroundColor(Color.zionCyan)
                
                Text(dataStore.activeSetlist?.name ?? "Repertorio")
                    .font(.subheadline.bold())
                    .foregroundColor(Color.zionTextPrimary)
                    .lineLimit(1)
                
                // Show automatic sync status
                if let activeSetlist = dataStore.activeSetlist,
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
                
                // +Canciones and +Setlist Side Drawer Buttons
                Button(action: {
                    showLibraryDrawer = true
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
                    showSetlistsDrawer = true
                }) {
                    Text("+Setlist")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color.zionCyan)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.zionCyan.opacity(0.15))
                        .cornerRadius(6)
                }
            }
            .padding()
            .background(Color.zionPanel)
            .sheet(isPresented: $showLibraryDrawer) {
                LibraryDrawerSheet(onAddSongToSetlist: { song in
                    dataStore.addSongToSetlist(song: song)
                })
            }
            .sheet(isPresented: $showSetlistsDrawer) {
                SetlistsDrawerSheet(dataStore: dataStore)
            }
            
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
                        if let activeSetlist = dataStore.activeSetlist,
                           let songs = activeSetlist.songs, !songs.isEmpty {
                            ForEach(Array(songs.enumerated()), id: \.offset) { index, song in
                                let songNumber = String(index + 1)
                                let artistText = song.artist ?? "Desconocido"
                                let keyText = song.key ?? "C"
                                let bpmText = song.bpm != nil ? "\(Int(song.bpm!))" : "120"
                                let subtitle = "\(artistText) • \(keyText) • \(bpmText) BPM"
                                let isSelected = AudioEngineViewModel.shared.currentSong?.id == song.id
                                let totalTracks = song.tracks?.count ?? 0
                                let downloadedTracks = song.tracks?.filter { downloader.isTrackDownloaded($0) }.count ?? 0
                                
                                HStack(spacing: 8) {
                                    Button(action: {
                                        if let tracks = song.tracks {
                                            AudioEngineViewModel.shared.currentSong = song
                                            AudioEngineViewModel.shared.loadTracks(tracks)
                                        }
                                    }) {
                                        HStack {
                                            Text(songNumber)
                                                .font(.caption.bold())
                                                .foregroundColor(isSelected ? Color.zionCyan : Color.zionTextSecondary)
                                                .frame(width: 20)
                                            
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(song.name)
                                                    .font(.system(size: 14, weight: .bold))
                                                    .foregroundColor(isSelected ? Color.zionCyan : Color.zionTextPrimary)
                                                Text(subtitle)
                                                    .font(.system(size: 11))
                                                    .foregroundColor(isSelected ? Color.zionCyan.opacity(0.8) : Color.zionTextSecondary)
                                            }
                                            
                                            Spacer()
                                            
                                            HStack(spacing: 6) {
                                                if downloader.downloadingSongIds.contains(song.id) {
                                                    HStack(spacing: 4) {
                                                        ProgressView()
                                                            .progressViewStyle(CircularProgressViewStyle(tint: downloadedTracks == 0 ? .red : Color.zionCyan))
                                                            .scaleEffect(0.6)
                                                        Text("\(downloadedTracks)/\(totalTracks)")
                                                            .font(.system(size: 11, weight: .bold))
                                                            .foregroundColor(downloadedTracks == 0 ? .red : Color.zionCyan)
                                                    }
                                                } else if downloadedTracks == totalTracks && totalTracks > 0 {
                                                    HStack(spacing: 4) {
                                                        Image(systemName: "checkmark.icloud.fill")
                                                            .foregroundColor(.green)
                                                            .font(.system(size: 11, weight: .bold))
                                                        Text("\(totalTracks)/\(totalTracks)")
                                                            .font(.system(size: 11, weight: .bold))
                                                            .foregroundColor(.green)
                                                    }
                                                } else {
                                                    Text("\(downloadedTracks)/\(totalTracks)")
                                                        .font(.system(size: 11, weight: .bold))
                                                        .foregroundColor(downloadedTracks == 0 ? .red : Color.zionTextSecondary)
                                                }
                                            }
                                        }
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                    
                                    // 3-Dots Options Menu to remove song from setlist
                                    Menu {
                                        Button(role: .destructive, action: {
                                            dataStore.removeSongFromSetlist(songId: song.id)
                                        }) {
                                            Label("Eliminar de este setlist", systemImage: "trash")
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundColor(Color.zionTextSecondary)
                                            .padding(6)
                                    }
                                }
                                .padding(.vertical, 8)
                                .padding(.horizontal, 10)
                                .background(isSelected ? Color.zionCyan.opacity(0.12) : Color.zionPanelLight)
                                .cornerRadius(8)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(isSelected ? Color.zionCyan : Color.zionBorderSubtle, lineWidth: isSelected ? 1.5 : 1))
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
