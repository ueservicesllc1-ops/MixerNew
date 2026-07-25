//
//  MainView.swift
//  ZionStageApple
//
//  Vista contenedora principal nativa en SwiftUI.
//  Estructura de interfaz estilo Android / iPad Pro:
//  - Centro: Consola de Mezcla Multitrack (MixerView)
//  - Lado Derecho (Slide Drawer / Side Panel): Catálogo de Canciones y Setlists (SongLibraryView)
//  - Abajo (Slide Sheet): Pads Ambientales (PadEngineView), Letras, Acordes, Partituras y Metrónomo
//

import SwiftUI
import FirebaseFirestore

public struct MainView: View {
    @EnvironmentObject var firebase: FirebaseService
    @ObservedObject var player: ZionAudioPlayer = ZionAudioPlayer.shared

    @State private var isPerformanceModeActive: Bool = false
    @State private var isRightDrawerOpen: Bool = false
    @State private var isSettingsOpen: Bool = false
    @State private var bottomPanel: BottomPanel? = nil
    @State private var showSetlistManager: Bool = false
    @State private var showCreateSetlistSheet: Bool = false
    @State private var newSetlistName: String = ""
    
    @State private var activeLyrics: String? = nil
    @State private var activeChords: String? = nil
    @State private var activePartituras: [Partitura] = []
    
    @State private var lyricsListener: Any? = nil
    @State private var chordsListener: Any? = nil
    @State private var partiturasListener: Any? = nil

    enum BottomPanel: String, CaseIterable {
        case pads = "Pads"
        case lyrics = "Letras"
        case chords = "Acordes"
        case partituras = "Partituras"
        case metronome = "Metrónomo"
    }

    public init() {}

    public var body: some View {
        if !firebase.isAuthenticated {
            LoginView()
        } else {
            ZStack(alignment: .trailing) {
                // Layout Principal: Consola + Panel Derecho
                ZStack(alignment: .bottom) {
                    VStack(spacing: 0) {
                        // Barra Superior con Botones
                        topNavigationBar

                        // Consola de Mezcla Multitrack Principal
                        MixerView(player: player)
                    }

                    // Panel Inferior Deslizable (Pads, Letras, Acordes, Partituras, Metrónomo)
                    if let panel = bottomPanel {
                        VStack(spacing: 0) {
                            panelHeader(currentPanel: panel)

                            switch panel {
                            case .pads:
                                PadEngineView()
                                    .frame(height: 340)

                            case .lyrics:
                                LyricsView(
                                    player: player,
                                    lyricsText: activeLyrics,
                                    isLoading: activeLyrics == nil && player.currentSong != nil
                                )
                                .frame(height: 340)

                            case .chords:
                                ChordsView(
                                    player: player,
                                    chordsText: activeChords,
                                    isLoading: activeChords == nil && player.currentSong != nil
                                )
                                .frame(height: 340)

                            case .partituras:
                                PartiturasView(partituras: activePartituras)
                                    .frame(height: 340)

                            case .metronome:
                                MetronomePanelView()
                                    .frame(height: 340)
                            }
                        }
                        .background(
                            RoundedRectangle(cornerRadius: 20)
                                .fill(Color(red: 0.06, green: 0.08, blue: 0.14))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 20)
                                        .stroke(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.3), lineWidth: 1)
                                )
                                .shadow(color: .black.opacity(0.7), radius: 20, x: 0, y: -4)
                        )
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: bottomPanel)
                    }

                    // Botones Inferiores Flotantes de Selección Rápidas
                    bottomFloatingToolbar
                }

                // Panel Lateral Derecho Deslizable (Drawer de Catálogo / Setlists)
                if isRightDrawerOpen {
                    Color.black.opacity(0.5)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeOut(duration: 0.25)) { isRightDrawerOpen = false }
                        }

                    HStack(spacing: 0) {
                        Spacer()
                        VStack(spacing: 0) {
                            // Cabecera del Drawer Derecho
                            HStack {
                                Text("Librería y Setlists")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                                Spacer()
                                Button(action: {
                                    withAnimation(.easeOut(duration: 0.25)) { isRightDrawerOpen = false }
                                }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))
                                }
                            }
                            .padding()
                            .background(Color(red: 0.09, green: 0.12, blue: 0.20))

                            Divider().background(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.3))

                            // Vista de Catálogo y Setlists
                            SongLibraryView()
                        }
                        .frame(width: 360)
                        .background(Color(red: 0.06, green: 0.08, blue: 0.14))
                        .shadow(color: .black.opacity(0.6), radius: 16, x: -4, y: 0)
                    }
                    .transition(.move(edge: .trailing))
                    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: isRightDrawerOpen)
                }
            }
            .preferredColorScheme(.dark)
            #if os(iOS)
            .fullScreenCover(isPresented: $isPerformanceModeActive) {
                PerformanceModeView(player: player, onClose: { isPerformanceModeActive = false })
            }
            #else
            .sheet(isPresented: $isPerformanceModeActive) {
                PerformanceModeView(player: player, onClose: { isPerformanceModeActive = false })
            }
            .sheet(isPresented: $isSettingsOpen) {
                SettingsView()
            }
            .onChange(of: player.currentSong?.id) { songId in
                loadTextContent(songId: songId)
            }
        }
    }

    // MARK: - Barra de Navegación Superior
    private var topNavigationBar: some View {
        HStack {
            // Nombre de la App / Logo
            HStack(spacing: 8) {
                Image(systemName: "waveform.and.mic")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                Text("ZION STAGE")
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(.white)
                    .tracking(2)
            }

            Spacer()

            // Botón Ajustes (Gear)
            Button(action: { isSettingsOpen = true }) {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 14))
                    .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))
                    .padding(8)
                    .background(
                        Circle()
                            .fill(Color(red: 0.12, green: 0.16, blue: 0.24))
                            .overlay(Circle().stroke(Color.white.opacity(0.1), lineWidth: 1))
                    )
            }

            // Botón Modo Escenario (Performance)
            Button(action: { isPerformanceModeActive = true }) {
                HStack(spacing: 4) {
                    Image(systemName: "rectangle.inset.topright.fill")
                        .font(.system(size: 13))
                    Text("Escenario")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundColor(.black)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(red: 0.97, green: 0.45, blue: 0.09))
                        .shadow(color: Color(red: 0.97, green: 0.45, blue: 0.09).opacity(0.5), radius: 4)
                )
            }

            // Botón para desplegar el Catálogo/Setlist a la Derecha
            Button(action: {
                withAnimation(.easeOut(duration: 0.25)) {
                    isRightDrawerOpen.toggle()
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "music.note.list")
                        .font(.system(size: 14))
                    Text("Canciones")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isRightDrawerOpen
                            ? Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.3)
                            : Color(red: 0.12, green: 0.16, blue: 0.24))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.4), lineWidth: 1)
                        )
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(red: 0.05, green: 0.06, blue: 0.10))
    }

    // MARK: - Setlist Manager Sheet
    private var setlistManagerSheet: some View {
        NavigationView {
            List {
                // Crear nuevo setlist
                Button(action: {
                    showSetlistManager = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showCreateSetlistSheet = true
                    }
                }) {
                    Label("Crear nuevo setlist", systemImage: "plus.circle.fill")
                        .foregroundColor(.cyan)
                }

                // Setlists existentes
                ForEach(firebase.setlists) { setlist in
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
            .navigationTitle("Mis Setlists")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { showSetlistManager = false }
                        .foregroundColor(.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Create Setlist Sheet
    private var createSetlistSheet: some View {
        NavigationView {
            VStack(spacing: 20) {
                TextField("Nombre del setlist...", text: $newSetlistName)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 16))
                    .padding()

                Button(action: {
                    let name = newSetlistName.trimmingCharacters(in: .whitespaces)
                    guard !name.isEmpty else { return }
                    firebase.createSetlist(name: name) { _ in
                        self.newSetlistName = ""
                        self.showCreateSetlistSheet = false
                    }
                }) {
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

    // MARK: - Panel Header Inferior
    private func panelHeader(currentPanel: BottomPanel) -> some View {
        VStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.gray.opacity(0.4))
                .frame(width: 40, height: 4)
                .padding(.top, 10)
                .padding(.bottom, 6)

            HStack(spacing: 0) {
                ForEach(BottomPanel.allCases, id: \.self) { p in
                    Button(action: { bottomPanel = p }) {
                        Text(p.rawValue)
                            .font(.system(size: 13, weight: bottomPanel == p ? .bold : .regular))
                            .foregroundColor(bottomPanel == p ? Color(red: 0.07, green: 0.71, blue: 0.71) : .gray)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity)
                            .background(
                                bottomPanel == p
                                ? Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.12)
                                : Color.clear
                            )
                    }
                }

                Button(action: { withAnimation { bottomPanel = nil } }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.gray)
                        .padding(.trailing, 14)
                }
            }
            .background(Color(red: 0.08, green: 0.10, blue: 0.16))

            Divider().background(Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.2))
        }
    }

    // MARK: - Botones Flotantes Inferiores
    private var bottomFloatingToolbar: some View {
        HStack(spacing: 8) {
            Spacer()

            panelToggleButton(panel: .pads, icon: "square.grid.3x3.fill", label: "Pads")
            panelToggleButton(panel: .lyrics, icon: "text.bubble.fill", label: "Letras")
            panelToggleButton(panel: .chords, icon: "music.quarternote.3", label: "Acordes")
            panelToggleButton(panel: .partituras, icon: "doc.richtext.fill", label: "Partituras")
            panelToggleButton(panel: .metronome, icon: "metronome.fill", label: "Click")
        }
        .padding(.horizontal, 16)
        .padding(.bottom, bottomPanel != nil ? 360 : 70)
        .animation(.spring(response: 0.3), value: bottomPanel)
    }

    // MARK: - Panel Toggle Button Helper
    private func panelToggleButton(panel: BottomPanel, icon: String, label: String) -> some View {
        let isActive = bottomPanel == panel
        return Button(action: {
            withAnimation {
                bottomPanel = bottomPanel == panel ? nil : panel
            }
        }) {
            VStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(label)
                    .font(.system(size: 9, weight: .bold))
            }
            .foregroundColor(isActive ? .black : Color(red: 0.07, green: 0.71, blue: 0.71))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isActive ? Color(red: 0.07, green: 0.71, blue: 0.71) : Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.12))
                    .shadow(color: isActive ? Color(red: 0.07, green: 0.71, blue: 0.71).opacity(0.4) : .clear, radius: 6)
            )
        }
    }

    // MARK: - Cargar Contenidos de Texto
    private func loadTextContent(songId: String?) {
        activeLyrics = nil
        activeChords = nil
        activePartituras = []

        guard let songId = songId else { return }

        let lyr = firebase.listenLyrics(songId: songId) { text in
            if let text = text { self.activeLyrics = text }
        }

        let ch = firebase.listenChords(songId: songId) { text in
            if let text = text { self.activeChords = text }
        }

        let par = firebase.listenPartituras(songId: songId) { list in
            self.activePartituras = list
        }

        lyricsListener = lyr
        chordsListener = ch
        partiturasListener = par
    }
}
