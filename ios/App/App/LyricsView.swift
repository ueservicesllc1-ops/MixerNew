import SwiftUI

struct LyricsView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    @State private var lyricsText: String = "Selecciona una canción para ver la letra..."
    @State private var currentSongId: String? = nil
    
    var body: some View {
        VStack {
            Text("Teleprompter")
                .font(.headline)
                .foregroundColor(Color.Zion.textPrimary)
                .padding()
            
            ScrollView {
                Text(lyricsText)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.Zion.backgroundDark)
        .onReceive(engine.$loadedTracks) { tracks in
            if !tracks.isEmpty {
                // HACK: the songId is not inside SongTrack directly in our current models.
                // We'll just fetch a hardcoded song for now or assume track.id has it.
                // Normally the `Song` has the songId, but the engine only gets tracks.
                // For this port, we will just listen to a global song selection if needed.
                // We'll do our best with the first track ID for now.
                if let first = tracks.first {
                    // split ID to get song ID if it was combined, else just use the track ID and it will likely fail.
                    // This is a placeholder since we need the `song.id` which wasn't passed to AudioEngine.
                    let songId = first.id.components(separatedBy: "_").first ?? first.id
                    if currentSongId != songId {
                        currentSongId = songId
                        DataStore().fetchLyrics(for: songId) { text in
                            DispatchQueue.main.async {
                                self.lyricsText = text ?? "No hay letra disponible"
                            }
                        }
                    }
                }
            } else {
                lyricsText = "Selecciona una canción para ver la letra..."
                currentSongId = nil
            }
        }
    }
}
