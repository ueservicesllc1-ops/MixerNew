//
//  MainView.swift
//  ZionStageApple
//
//  Vista contenedora principal. Integra:
//  - Firebase Auth (login/logout)
//  - Navegación por pestañas: Consola, Catálogo, Pads
//  - Panel inferior con Letras / Acordes / Partituras
//  - Estado de descarga y carga de canciones
//

import SwiftUI
import FirebaseFirestore
public struct MainView: View {
    @EnvironmentObject var firebase: FirebaseService
    @ObservedObject var player: ZionAudioPlayer = ZionAudioPlayer.shared

    @State private var isPerformanceModeActive: Bool = false
    @State private var selectedTab = 0
    @State private var bottomPanel: BottomPanel? = nil
    
    @State private var activeLyrics: String? = nil
    @State private var activeChords: String? = nil
    @State private var activePartituras: [Partitura] = []
    
    @State private var lyricsListener: Any? = nil
    @State private var chordsListener: Any? = nil
    @State private var partiturasListener: Any? = nil

    enum BottomPanel: String, CaseIterable {
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
            ZStack(alignment: .bottom) {
                // Contenido principal con tabs
                TabView(selection: $selectedTab) {
                    // Consola de mezcla
                    MixerView(player: player)
                        .tabItem {
                            Label("Consola", systemImage: "slider.vertical.3")
                        }
                        .tag(0)

                    // Catálogo de canciones
                    SongLibraryView()
                        .tabItem {
                            Label("Catálogo", systemImage: "music.note.list")
                        }
                        .tag(1)

                    // Pads ambientales
                    PadEngineView()
                        .tabItem {
                            Label("Pads", systemImage: "square.grid.3x3.fill")
                        }
                        .tag(2)
                }
                .accentColor(.cyan)
                .preferredColorScheme(.dark)

                // Panel inferior (Letras / Acordes / Partituras / Metrónomo)
                if let panel = bottomPanel {
                    VStack(spacing: 0) {
                        // Handle + selector de panel
                        panelHeader(currentPanel: panel)

                        // Contenido del panel
                        switch panel {
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
                            .fill(Color(red: 0.06, green: 0.07, blue: 0.10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(Color.cyan.opacity(0.25), lineWidth: 1)
                            )
                            .shadow(color: .black.opacity(0.6), radius: 20, x: 0, y: -4)
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: bottomPanel)
                }

                // Botones flotantes de panel cuando hay canción activa
                if player.currentSong != nil {
                    HStack(spacing: 8) {
                        // Botón Performance Mode (Fullscreen Stage)
                        Button(action: { isPerformanceModeActive = true }) {
                            HStack(spacing: 4) {
                                Image(systemName: "rectangle.inset.topright.fill")
                                    .font(.system(size: 14))
                                Text("Escenario")
                                    .font(.system(size: 9, weight: .bold))
                            }
                            .foregroundColor(.black)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color.orange)
                                    .shadow(color: Color.orange.opacity(0.5), radius: 6)
                            )
                        }

                        Spacer()

                        panelToggleButton(panel: .lyrics, icon: "text.bubble.fill", label: "Letras")
                        panelToggleButton(panel: .chords, icon: "music.quarternote.3", label: "Acordes")
                        panelToggleButton(panel: .partituras, icon: "doc.richtext.fill", label: "Partituras")
                        panelToggleButton(panel: .metronome, icon: "metronome.fill", label: "Click")
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, bottomPanel != nil ? 360 : 80)
                    .animation(.spring(response: 0.3), value: bottomPanel)
                }
            }
            #if os(iOS)
            .fullScreenCover(isPresented: $isPerformanceModeActive) {
                PerformanceModeView(player: player, onClose: { isPerformanceModeActive = false })
            }
            #else
            .sheet(isPresented: $isPerformanceModeActive) {
                PerformanceModeView(player: player, onClose: { isPerformanceModeActive = false })
            }
            #endif
            .onChange(of: player.currentSong?.id) { songId in
                loadTextContent(songId: songId)
            }
        }
    }

    // MARK: - Panel Header
    private func panelHeader(currentPanel: BottomPanel) -> some View {
        VStack(spacing: 0) {
            // Handle
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
                            .foregroundColor(bottomPanel == p ? .cyan : .gray)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity)
                            .background(
                                bottomPanel == p
                                ? Color.cyan.opacity(0.1)
                                : Color.clear
                            )
                    }
                }

                // Cerrar panel
                Button(action: { withAnimation { bottomPanel = nil } }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.gray)
                        .padding(.trailing, 14)
                }
            }
            .background(Color(red: 0.08, green: 0.09, blue: 0.14))

            Divider().background(Color.cyan.opacity(0.15))
        }
    }

    // MARK: - Panel Toggle Button
    private func panelToggleButton(panel: BottomPanel, icon: String, label: String) -> some View {
        let isActive = bottomPanel == panel
        return Button(action: {
            withAnimation {
                bottomPanel = bottomPanel == panel ? nil : panel
            }
        }) {
            VStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                Text(label)
                    .font(.system(size: 9, weight: .medium))
            }
            .foregroundColor(isActive ? .black : .cyan)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isActive ? Color.cyan : Color.cyan.opacity(0.1))
                    .shadow(color: isActive ? Color.cyan.opacity(0.4) : .clear, radius: 6)
            )
        }
    }

    // MARK: - Cargar Letras / Acordes / Partituras al cambiar de canción
    private func loadTextContent(songId: String?) {
        // Limpiar estado anterior
        activeLyrics = nil
        activeChords = nil
        activePartituras = []

        guard let songId = songId else { return }

        // Letras
        let lyr = firebase.listenLyrics(songId: songId) { text in
            if let text = text { self.activeLyrics = text }
        }

        // Acordes
        let ch = firebase.listenChords(songId: songId) { text in
            if let text = text { self.activeChords = text }
        }

        // Partituras
        let par = firebase.listenPartituras(songId: songId) { list in
            self.activePartituras = list
        }

        // Guardar listeners (cast genérico)
        lyricsListener = lyr
        chordsListener = ch
        partiturasListener = par
    }
}
