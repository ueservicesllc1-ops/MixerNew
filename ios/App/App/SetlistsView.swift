import SwiftUI

struct SetlistsView: View {
    @StateObject private var dataStore = DataStore()
    
    // Zion Theme Colors
    let zionBlue = Color(red: 0.1, green: 0.5, blue: 0.9)
    let darkBackground = Color(red: 0.05, green: 0.05, blue: 0.08)
    let cardBackground = Color(red: 0.1, green: 0.1, blue: 0.15)
    
    var body: some View {
        ZStack {
            darkBackground.edgesIgnoringSafeArea(.all)
            
            if dataStore.isLoading && dataStore.setlists.isEmpty {
                ProgressView("Cargando setlists...")
                    .foregroundColor(.white)
            } else if dataStore.setlists.isEmpty {
                Text("No tienes setlists.")
                    .foregroundColor(.gray)
            } else {
                List {
                    ForEach(dataStore.setlists) { setlist in
                        Section(header: Text(setlist.name).foregroundColor(.white).font(.headline)) {
                            if let songs = setlist.songs, !songs.isEmpty {
                                ForEach(songs) { song in
                                    Button(action: {
                                        if let tracks = song.tracks {
                                            // Load tracks to AudioEngine
                                            AudioEngineViewModel.shared.loadTracks(tracks)
                                        }
                                    }) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(song.name)
                                                .font(.subheadline)
                                                .foregroundColor(Color.Zion.primaryCyan)
                                            Text(song.artist ?? "Desconocido")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            } else {
                                Text("Sin canciones")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                        .listRowBackground(cardBackground)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .onAppear {
            dataStore.startListeningToSetlists()
        }
        .onDisappear {
            dataStore.stopListening()
        }
        .preferredColorScheme(.dark)
    }
}
