import SwiftUI

struct LyricsView: View {
    enum DisplayMode { case lyrics, chords }
    var mode: DisplayMode = .lyrics
    
    @ObservedObject var engine = AudioEngineViewModel.shared
    @State private var lyricsText: String = ""
    @State private var chordsText: String = ""
    @State private var isLoading: Bool = false
    
    private let dataStore = DataStore()
    
    var displayText: String {
        if isLoading { return "Cargando..." }
        if mode == .chords {
            return chordsText.isEmpty ? (lyricsText.isEmpty ? "No hay acordes disponibles para esta canción" : lyricsText) : chordsText
        } else {
            return lyricsText.isEmpty ? "No hay letra disponible para esta canción" : lyricsText
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(mode == .chords ? "🎸 Acordes" : "🎤 Teleprompter / Letra")
                    .font(.headline.bold())
                    .foregroundColor(Color.zionTextPrimary)
                Spacer()
                if let current = engine.currentSong {
                    Text(current.name)
                        .font(.subheadline.bold())
                        .foregroundColor(Color.zionCyan)
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            ScrollView {
                Text(displayText)
                    .font(.system(size: mode == .chords ? 20 : 24, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.zionBackground)
        .onAppear {
            loadLyrics()
        }
        .onChange(of: engine.currentSong?.id) { _ in
            loadLyrics()
        }
    }
    
    private func loadLyrics() {
        guard let songId = engine.currentSong?.id else {
            lyricsText = "Selecciona una canción de la setlist"
            chordsText = ""
            return
        }
        isLoading = true
        dataStore.fetchLyrics(for: songId) { lyrics, chords in
            DispatchQueue.main.async {
                self.isLoading = false
                self.lyricsText = lyrics ?? ""
                self.chordsText = chords ?? ""
            }
        }
    }
}
