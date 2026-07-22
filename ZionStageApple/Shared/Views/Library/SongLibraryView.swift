//
//  SongLibraryView.swift
//  ZionStageApple
//
//  Librería de canciones con descarga de stems, gestión de setlists y catálogo global.
//  Replica completa de la LibraryDrawer de Multitrack.jsx.
//

import SwiftUI

public struct SongLibraryView: View {
    @EnvironmentObject var firebase: FirebaseService
    @ObservedObject var player: ZionAudioPlayer = ZionAudioPlayer.shared
    @ObservedObject var downloader: DownloadManager = DownloadManager.shared

    @State private var searchQuery: String = ""
    @State private var libraryTab: LibraryTab = .mine
    @State private var showSetlistSheet: Bool = false
    @State private var showCreateSetlistSheet: Bool = false
    @State private var newSetlistName: String = ""
    @State private var selectedSetlist: Setlist? = nil
    @State private var songToAdd: Song? = nil
    @State private var downloadStatusMsg: String? = nil

    enum LibraryTab { case mine, global }

    public init() {}

    private var displayedSongs: [Song] {
        let base = libraryTab == .mine
            ? firebase.librarySongs
            : firebase.globalSongs.filter { !$0.tracks.isEmpty }

        guard !searchQuery.isEmpty else { return base }
        let q = searchQuery.lowercased()
        return base.filter {
            $0.name.lowercased().contains(q) ||
            $0.artist.lowercased().contains(q)
        }
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            // Tabs: Mi librería / Global
            tabSelector

            // Barra de búsqueda
            searchBar

            // Setlist activo
            if let setlist = selectedSetlist {
                activeSetlistBanner(setlist: setlist)
            }

            // Lista de canciones
            if firebase.isLoadingLibrary && libraryTab == .mine {
                loadingView("Cargando librería...")
            } else if firebase.isLoadingGlobal && libraryTab == .global {
                loadingView("Cargando catálogo global...")
            } else if displayedSongs.isEmpty {
                emptySongsView
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(displayedSongs) { song in
                            songRow(song)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
            }
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.1).ignoresSafeArea())
        // Sheet para seleccionar setlist
        .sheet(isPresented: $showSetlistSheet) {
            setlistPickerSheet
        }
        // Sheet para crear nuevo setlist
        .sheet(isPresented: $showCreateSetlistSheet) {
            createSetlistSheet
        }
        .onAppear {
            // Auto-seleccionar primer setlist si hay
            if selectedSetlist == nil, let first = firebase.setlists.first {
                selectedSetlist = first
            }
        }
    }

    // MARK: - Header
    private var headerView: some View {
        HStack {
            Text("Catálogo de Canciones")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.white)

            Spacer()

            // Botón setlist
            Button(action: { showSetlistSheet = true }) {
                HStack(spacing: 6) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 14))
                    Text(selectedSetlist?.name ?? "Setlist")
                        .font(.system(size: 13, weight: .medium))
                        .lineLimit(1)
                }
                .foregroundColor(.cyan)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.cyan.opacity(0.1))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.cyan.opacity(0.3), lineWidth: 1))
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Tabs
    private var tabSelector: some View {
        HStack(spacing: 0) {
            tabButton(title: "🎵 Mi Librería", count: firebase.librarySongs.count, tab: .mine)
            tabButton(title: "🌐 Global", count: firebase.globalSongs.filter { !$0.tracks.isEmpty }.count, tab: .global)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func tabButton(title: String, count: Int, tab: LibraryTab) -> some View {
        Button(action: { libraryTab = tab }) {
            Text("\(title) (\(count))")
                .font(.system(size: 13, weight: libraryTab == tab ? .bold : .regular))
                .foregroundColor(libraryTab == tab ? .black : .gray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(libraryTab == tab ? Color.cyan : Color(white: 0.12))
                )
        }
        .padding(.horizontal, 4)
    }

    // MARK: - Search Bar
    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.gray)
                .font(.system(size: 15))

            TextField("Buscar canción o artista...", text: $searchQuery)
                .foregroundColor(.white)
                .font(.system(size: 15))
                #if os(iOS)
                .autocapitalization(.none)
                #endif

            if !searchQuery.isEmpty {
                Button(action: { searchQuery = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(white: 0.1))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.cyan.opacity(0.2), lineWidth: 1))
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    // MARK: - Active Setlist Banner
    private func activeSetlistBanner(setlist: Setlist) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
                .font(.system(size: 14))
            Text("Setlist activo: \(setlist.name) (\(setlist.songs.count) canciones)")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.green)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.green.opacity(0.08))
    }

    // MARK: - Song Row
    private func songRow(_ song: Song) -> some View {
        let isActive = player.currentSong?.id == song.id
        let isDownloaded = song.tracks.allSatisfy { t in
            t.name == "__PreviewMix" ||
            DownloadManager.shared.isTrackDownloaded(songId: song.id, trackName: t.name)
        }
        let isDownloading = downloader.progress?.songId == song.id

        return HStack(spacing: 12) {
            // Indicador de canción activa
            RoundedRectangle(cornerRadius: 2)
                .fill(isActive ? Color.cyan : Color.clear)
                .frame(width: 3, height: 44)

            // Info de la canción
            VStack(alignment: .leading, spacing: 4) {
                Text(song.name)
                    .font(.system(size: 15, weight: isActive ? .bold : .medium))
                    .foregroundColor(isActive ? .cyan : .white)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    if !song.artist.isEmpty {
                        Text(song.artist)
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    // Badges
                    if let tempo = song.tempo, tempo > 0 {
                        badge(text: "\(Int(tempo)) BPM", color: .orange)
                    }
                    if let key = song.key, !key.isEmpty {
                        badge(text: key, color: .cyan)
                    }
                    if !song.tracks.isEmpty {
                        badge(text: "\(song.tracks.filter { $0.name != "__PreviewMix" }.count) stems", color: .purple)
                    }
                }

                if isDownloading, let prog = downloader.progress {
                    HStack(spacing: 6) {
                        ProgressView(value: prog.fraction)
                            .progressViewStyle(.linear)
                            .tint(.cyan)
                            .frame(width: 100)
                        Text(prog.label)
                            .font(.system(size: 10))
                            .foregroundColor(.cyan)
                    }
                }
            }

            Spacer()

            // Botones de acción
            VStack(spacing: 6) {
                // Cargar canción
                Button(action: { loadSong(song) }) {
                    Image(systemName: isActive ? "play.circle.fill" : "play.circle")
                        .font(.system(size: 26))
                        .foregroundColor(isActive ? .cyan : .gray)
                }

                // Descargar / Agregar a setlist
                if !isDownloaded && !isDownloading {
                    Button(action: { downloadAndAddToSetlist(song) }) {
                        Image(systemName: "arrow.down.circle")
                            .font(.system(size: 20))
                            .foregroundColor(.green)
                    }
                } else if isDownloaded {
                    Button(action: { addToActiveSetlist(song) }) {
                        Image(systemName: "plus.circle")
                            .font(.system(size: 20))
                            .foregroundColor(.green)
                    }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isActive
                    ? Color.cyan.opacity(0.08)
                    : Color(red: 0.09, green: 0.11, blue: 0.16)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isActive ? Color.cyan.opacity(0.3) : Color.clear, lineWidth: 1)
                )
        )
    }

    private func badge(text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .cornerRadius(4)
    }

    // MARK: - Empty / Loading Views
    private func loadingView(_ msg: String) -> some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
            Text(msg)
                .font(.subheadline)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptySongsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "music.note.list")
                .font(.system(size: 48))
                .foregroundColor(.gray.opacity(0.3))
            Text(searchQuery.isEmpty
                ? (libraryTab == .mine ? "Tu librería está vacía" : "No hay canciones globales")
                : "No se encontraron resultados para \"\(searchQuery)\"")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)

            if libraryTab == .mine && searchQuery.isEmpty {
                Text("Las canciones se suben desde zionstage.com")
                    .font(.caption)
                    .foregroundColor(.gray.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    // MARK: - Acciones
    private func loadSong(_ song: Song) {
        // Verificar que los stems estén descargados
        let notDownloaded = song.tracks.filter {
            $0.name != "__PreviewMix" &&
            !DownloadManager.shared.isTrackDownloaded(songId: song.id, trackName: $0.name)
        }

        if notDownloaded.isEmpty {
            player.loadSong(song)
        } else {
            // Descargar primero, luego cargar
            downloadAndAddToSetlist(song)
        }
    }

    private func downloadAndAddToSetlist(_ song: Song) {
        guard selectedSetlist != nil else {
            // Si no hay setlist, descargar igual y cargar directo
            downloader.downloadAllTracks(for: song) { success in
                if success { self.player.loadSong(song) }
            }
            return
        }

        downloader.downloadAllTracks(for: song) { success in
            if success {
                self.addToActiveSetlist(song)
                self.player.loadSong(song)
            }
        }
    }

    private func addToActiveSetlist(_ song: Song) {
        guard let setlist = selectedSetlist else { return }
        // Verificar que no esté ya en el setlist
        guard !setlist.songs.contains(where: { $0.id == song.id }) else { return }
        firebase.addSongToSetlist(setlistId: setlist.id, song: song) { _ in }
    }

    // MARK: - Setlist Picker Sheet
    private var setlistPickerSheet: some View {
        NavigationView {
            List {
                // Crear nuevo setlist
                Button(action: {
                    showSetlistSheet = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showCreateSetlistSheet = true
                    }
                }) {
                    Label("Crear nuevo setlist", systemImage: "plus.circle.fill")
                        .foregroundColor(.cyan)
                }

                // Setlists existentes
                ForEach(firebase.setlists) { setlist in
                    Button(action: {
                        selectedSetlist = setlist
                        showSetlistSheet = false
                    }) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(setlist.name)
                                    .foregroundColor(.white)
                                    .font(.system(size: 15, weight: .medium))
                                Text("\(setlist.songs.count) canciones")
                                    .foregroundColor(.gray)
                                    .font(.caption)
                            }
                            Spacer()
                            if selectedSetlist?.id == setlist.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.cyan)
                            }
                        }
                    }
                }
                .onDelete { idx in
                    idx.forEach { i in
                        let setlist = firebase.setlists[i]
                        firebase.deleteSetlist(id: setlist.id) { _ in }
                    }
                }

                if firebase.setlists.isEmpty {
                    Text("No tienes setlists. Crea uno para organizar tu repertorio.")
                        .foregroundColor(.gray)
                        .font(.caption)
                }
            }
            #if os(iOS)
            .listStyle(.insetGrouped)
            #else
            .listStyle(.inset)
            #endif
            .navigationTitle("Seleccionar Setlist")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { showSetlistSheet = false }
                        .foregroundColor(.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Crear Setlist Sheet
    private var createSetlistSheet: some View {
        NavigationView {
            VStack(spacing: 20) {
                TextField("Nombre del setlist...", text: $newSetlistName)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 16))
                    .padding()

                Button(action: createSetlist) {
                    Text("Crear Setlist")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.cyan)
                        .cornerRadius(12)
                }
                .padding(.horizontal)
                .disabled(newSetlistName.trimmingCharacters(in: .whitespaces).isEmpty)

                Spacer()
            }
            .navigationTitle("Nuevo Setlist")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { showCreateSetlistSheet = false }
                        .foregroundColor(.gray)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func createSetlist() {
        let name = newSetlistName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        firebase.createSetlist(name: name) { _ in
            self.newSetlistName = ""
            self.showCreateSetlistSheet = false
        }
    }
}
