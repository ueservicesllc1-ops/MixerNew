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
                        VStack(alignment: .leading, spacing: 5) {
                            Text(setlist.name)
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            Text("\(setlist.songs?.count ?? 0) canciones")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        .padding(.vertical, 8)
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
