import SwiftUI

struct SetlistsView: View {
    @ObservedObject var dataStore: DataStore
    @ObservedObject var downloader = DownloadManager.shared
    @ObservedObject var themeManager = ThemeManager.shared
    @ObservedObject var padPlayer = ZionPadPlayer.shared
    
    var compact: Bool = false
    var onOpenLibrary: (() -> Void)? = nil
    var onOpenPads: (() -> Void)? = nil
    @State private var showLibraryDrawer = false
    @State private var showSetlistsDrawer = false
    
    init(
        dataStore: DataStore = DataStore(),
        compact: Bool = false,
        onOpenLibrary: (() -> Void)? = nil,
        onOpenPads: (() -> Void)? = nil
    ) {
        self.dataStore = dataStore
        self.compact = compact
        self.onOpenLibrary = onOpenLibrary
        self.onOpenPads = onOpenPads
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 6) {
                Image(systemName: "music.note.list")
                    .font(.system(size: compact ? 12 : 14, weight: .bold))
                    .foregroundColor(Color.zionCyan)
                
                Text(dataStore.activeSetlist?.name ?? "Repertorio")
                    .font(.system(size: compact ? 12 : 14, weight: .bold))
                    .foregroundColor(Color.zionTextPrimary)
                    .lineLimit(1)
                
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
                
                Spacer(minLength: 2)
                
                Button(action: {
                    showLibraryDrawer = true
                }) {
                    Text("+Canciones")
                        .font(.system(size: compact ? 10 : 11, weight: .bold))
                        .foregroundColor(.purple)
                        .padding(.horizontal, compact ? 6 : 8)
                        .padding(.vertical, compact ? 3 : 4)
                        .background(Color.purple.opacity(0.18))
                        .cornerRadius(5)
                }
                
                Button(action: {
                    showSetlistsDrawer = true
                }) {
                    Text("+Setlist")
                        .font(.system(size: compact ? 10 : 11, weight: .bold))
                        .foregroundColor(Color.zionCyan)
                        .padding(.horizontal, compact ? 6 : 8)
                        .padding(.vertical, compact ? 3 : 4)
                        .background(Color.zionCyan.opacity(0.18))
                        .cornerRadius(5)
                }
            }
            .padding(.horizontal, compact ? 8 : 12)
            .padding(.vertical, compact ? 7 : 10)
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
                        .font(.caption)
                        .foregroundColor(Color.zionTextSecondary)
                        .padding(.top, 6)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else if dataStore.setlists.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "music.note.house")
                        .font(.system(size: compact ? 26 : 36))
                        .foregroundColor(Color.zionTextSecondary)
                    Text("Sin setlists guardados")
                        .font(.system(size: compact ? 13 : 15, weight: .bold))
                        .foregroundColor(Color.zionTextPrimary)
                    Text("Toca +Setlist o +Canciones")
                        .font(.system(size: compact ? 11 : 12))
                        .foregroundColor(Color.zionTextSecondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: compact ? 5 : 8) {
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
                                
                                HStack(spacing: 6) {
                                    Button(action: {
                                        if let tracks = song.tracks {
                                            AudioEngineViewModel.shared.currentSong = song
                                            AudioEngineViewModel.shared.loadTracks(tracks)
                                        }
                                    }) {
                                        HStack(spacing: 6) {
                                            Text(songNumber)
                                                .font(.system(size: compact ? 11 : 12, weight: .bold))
                                                .foregroundColor(isSelected ? Color.zionCyan : Color.zionTextSecondary)
                                                .frame(width: 18)
                                            
                                            VStack(alignment: .leading, spacing: 1) {
                                                Text(song.name)
                                                    .font(.system(size: compact ? 12 : 13, weight: .bold))
                                                    .foregroundColor(isSelected ? Color.zionCyan : Color.zionTextPrimary)
                                                    .lineLimit(1)
                                                Text(subtitle)
                                                    .font(.system(size: compact ? 10 : 11))
                                                    .foregroundColor(isSelected ? Color.zionCyan.opacity(0.8) : Color.zionTextSecondary)
                                                    .lineLimit(1)
                                            }
                                            
                                            Spacer(minLength: 2)
                                            
                                            HStack(spacing: 3) {
                                                if downloader.downloadingSongIds.contains(song.id) {
                                                    ProgressView()
                                                        .progressViewStyle(CircularProgressViewStyle(tint: downloadedTracks == 0 ? .red : Color.zionCyan))
                                                        .scaleEffect(0.55)
                                                    Text("\(downloadedTracks)/\(totalTracks)")
                                                        .font(.system(size: 10, weight: .bold))
                                                        .foregroundColor(downloadedTracks == 0 ? .red : Color.zionCyan)
                                                } else if downloadedTracks == totalTracks && totalTracks > 0 {
                                                    Image(systemName: "checkmark.icloud.fill")
                                                        .foregroundColor(.green)
                                                        .font(.system(size: 10, weight: .bold))
                                                    Text("\(totalTracks)/\(totalTracks)")
                                                        .font(.system(size: 10, weight: .bold))
                                                        .foregroundColor(.green)
                                                } else {
                                                    Text("\(downloadedTracks)/\(totalTracks)")
                                                        .font(.system(size: 10, weight: .bold))
                                                        .foregroundColor(downloadedTracks == 0 ? .red : Color.zionTextSecondary)
                                                }
                                            }
                                        }
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                    
                                    Menu {
                                        Button(role: .destructive, action: {
                                            dataStore.removeSongFromSetlist(songId: song.id)
                                        }) {
                                            Label("Eliminar de este setlist", systemImage: "trash")
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(Color.zionTextSecondary)
                                            .padding(4)
                                    }
                                }
                                .padding(.vertical, compact ? 6 : 8)
                                .padding(.horizontal, compact ? 8 : 10)
                                .background(isSelected ? Color.zionCyan.opacity(0.14) : Color.zionPanelLight)
                                .cornerRadius(7)
                                .overlay(RoundedRectangle(cornerRadius: 7).stroke(isSelected ? Color.zionCyan : Color.zionBorderSubtle, lineWidth: isSelected ? 1.5 : 1))
                            }
                        } else {
                            VStack(spacing: 6) {
                                Text("Setlist vacío")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(Color.zionTextSecondary)
                                Button(action: { showLibraryDrawer = true }) {
                                    Text("Añadir canciones")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.black)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(Color.zionCyan)
                                        .cornerRadius(6)
                                }
                            }
                            .padding(.top, 20)
                        }
                    }
                    .padding(compact ? 6 : 10)
                }
            }
            
            Divider().background(Color.zionBorderSubtle)
            
            // Ambient Pads Section Below Song List
            if compact {
                // Compact 1-line Ambient Pad quick bar for iPhone landscape so song list has full room
                HStack(spacing: 6) {
                    Button(action: {
                        if padPlayer.activeKey != nil {
                            padPlayer.stop()
                        } else {
                            let defaultKey = AudioEngineViewModel.shared.currentSong?.key?
                                .replacingOccurrences(of: "m", with: "")
                                .trimmingCharacters(in: .whitespacesAndNewlines) ?? "C"
                            padPlayer.start(key: defaultKey)
                        }
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "power")
                                .font(.system(size: 9, weight: .bold))
                            Text(padPlayer.activeKey != nil ? "PAD ON (\(padPlayer.activeKey!))" : "PAD OFF")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(padPlayer.activeKey != nil ? Color.zionCyan : Color.zionPanelLight)
                        .foregroundColor(padPlayer.activeKey != nil ? .black : Color.zionTextPrimary)
                        .cornerRadius(5)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        onOpenPads?()
                    }) {
                        HStack(spacing: 3) {
                            Text("Abrir Pads")
                                .font(.system(size: 10, weight: .semibold))
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .foregroundColor(Color.zionCyan)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color.zionPanel)
            } else {
                PadEngineView()
                    .padding(6)
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
