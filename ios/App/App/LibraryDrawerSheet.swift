import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct LibraryDrawerSheet: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var downloader = DownloadManager.shared
    
    @State private var libraryTab: String = "mine" // "mine" | "global"
    @State private var searchQuery: String = ""
    @State private var mySongs: [Song] = []
    @State private var globalSongs: [Song] = []
    @State private var isLoading: Bool = false
    @State private var addedSongIds: Set<String> = []
    
    var onAddSongToSetlist: ((Song) -> Void)? = nil
    
    private let db = Firestore.firestore()
    
    var filteredSongs: [Song] {
        let base = libraryTab == "mine" ? mySongs : globalSongs
        guard !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty else { return base }
        let q = searchQuery.lowercased()
        return base.filter {
            $0.name.lowercased().contains(q) ||
            ($0.artist ?? "").lowercased().contains(q)
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("🎵 Pistas en la Nube")
                    .font(.headline.bold())
                    .foregroundColor(Color.zionTextPrimary)
                Spacer()
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(Color.zionTextSecondary)
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            // Tabs: Mi Librería vs Global (VIP)
            HStack(spacing: 8) {
                Button(action: { libraryTab = "mine" }) {
                    HStack {
                        Image(systemName: "music.note")
                        Text("Mi Librería (\(mySongs.count))")
                    }
                    .font(.system(size: 13, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(libraryTab == "mine" ? Color.zionCyan : Color.zionPanelLight)
                    .foregroundColor(libraryTab == "mine" ? .black : Color.zionTextSecondary)
                    .cornerRadius(8)
                }
                
                Button(action: { libraryTab = "global" }) {
                    HStack {
                        Image(systemName: "globe")
                        Text("Global VIP (\(globalSongs.count))")
                    }
                    .font(.system(size: 13, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(libraryTab == "global" ? Color.purple : Color.zionPanelLight)
                    .foregroundColor(libraryTab == "global" ? .white : Color.zionTextSecondary)
                    .cornerRadius(8)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.zionBackground)
            
            // Search Input
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(Color.zionTextSecondary)
                TextField(libraryTab == "mine" ? "Buscar en mi librería..." : "Buscar en Global VIP...", text: $searchQuery)
                    .foregroundColor(Color.zionTextPrimary)
                if !searchQuery.isEmpty {
                    Button(action: { searchQuery = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Color.zionTextSecondary)
                    }
                }
            }
            .padding(10)
            .background(Color.zionPanelLight)
            .cornerRadius(8)
            .padding(.horizontal)
            .padding(.bottom, 8)
            
            // Song List
            if isLoading {
                VStack {
                    Spacer()
                    ProgressView().progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                    Text("Cargando canciones...")
                        .font(.caption)
                        .foregroundColor(Color.zionTextSecondary)
                        .padding(.top, 8)
                    Spacer()
                }
            } else if filteredSongs.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "music.note.slash")
                        .font(.largeTitle)
                        .foregroundColor(Color.zionTextSecondary)
                    Text("No se encontraron canciones")
                        .font(.subheadline.bold())
                        .foregroundColor(Color.zionTextPrimary)
                    Spacer()
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(filteredSongs) { song in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(song.name)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color.zionTextPrimary)
                                    Text("\(song.artist ?? "Artista") • \(song.key ?? "C") • \(song.bpm != nil ? "\(Int(song.bpm!))" : "120") BPM")
                                        .font(.system(size: 11))
                                        .foregroundColor(Color.zionTextSecondary)
                                }
                                
                                Spacer()
                                
                                Button(action: {
                                    addedSongIds.insert(song.id)
                                    onAddSongToSetlist?(song)
                                }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: addedSongIds.contains(song.id) ? "checkmark" : "plus")
                                        Text(addedSongIds.contains(song.id) ? "Añadido" : "➕ Añadir")
                                    }
                                    .font(.system(size: 11, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(addedSongIds.contains(song.id) ? Color.green : Color.zionCyan)
                                    .foregroundColor(addedSongIds.contains(song.id) ? .white : .black)
                                    .cornerRadius(6)
                                }
                            }
                            .padding(10)
                            .background(Color.zionPanel)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.zionBorderSubtle, lineWidth: 1))
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
            }
        }
        .background(Color.zionBackground.ignoresSafeArea())
        .onAppear {
            fetchSongs()
        }
    }
    
    private func fetchSongs() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isLoading = true
        
        // 1. Fetch User Songs ("mine")
        db.collection("songs")
            .whereField("userId", isEqualTo: uid)
            .getDocuments { snapshot, error in
                if let docs = snapshot?.documents {
                    self.mySongs = docs.compactMap { self.parseSong(doc: $0) }
                }
                
                // 2. Fetch Global VIP Songs ("global")
                self.db.collection("songs")
                    .limit(to: 300)
                    .getDocuments { globalSnap, _ in
                        self.isLoading = false
                        if let gDocs = globalSnap?.documents {
                            let allParsed = gDocs.compactMap { self.parseSong(doc: $0) }
                            // Filter for songs marked isGlobal or forSale or containing tracks
                            self.globalSongs = allParsed.filter { song in
                                let isGlob = (gDocs.first(where: { $0.documentID == song.id })?.data()["isGlobal"] as? Bool) ?? false
                                let forSale = (gDocs.first(where: { $0.documentID == song.id })?.data()["forSale"] as? Bool) ?? false
                                return (isGlob || forSale) && (song.tracks?.isEmpty == false)
                            }
                        }
                    }
            }
    }
    
    private func parseSong(doc: QueryDocumentSnapshot) -> Song? {
        let data = doc.data()
        let sId = doc.documentID
        let sName = data["name"] as? String ?? (data["title"] as? String ?? "Canción")
        let sArtist = data["artist"] as? String
        let sKey = data["key"] as? String
        let sBpm = data["bpm"] as? Double ?? (data["tempo"] as? Double)
        
        var parsedTracks: [SongTrack] = []
        
        // 1. Array format
        let rawArray = (data["tracks"] as? [[String: Any]]) ?? 
                       (data["stems"] as? [[String: Any]]) ?? 
                       (data["audioFiles"] as? [[String: Any]]) ?? 
                       (data["files"] as? [[String: Any]]) ?? []
        
        for tData in rawArray {
            let tId = tData["id"] as? String ?? UUID().uuidString
            let tPath = tData["path"] as? String ?? 
                        (tData["url"] as? String ?? 
                        (tData["fileUrl"] as? String ?? 
                        (tData["downloadUrl"] as? String ?? "")))
            let tName = tData["name"] as? String ?? 
                        (tData["title"] as? String ?? 
                        (tData["type"] as? String ?? "Track"))
            let trimmedPath = tPath.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedPath.isEmpty {
                parsedTracks.append(SongTrack(id: tId, path: trimmedPath, name: tName))
            }
        }
        
        // 2. Dictionary format
        if parsedTracks.isEmpty {
            let rawDict = (data["tracks"] as? [String: Any]) ?? (data["stems"] as? [String: Any]) ?? [:]
            for (key, val) in rawDict {
                if let tData = val as? [String: Any] {
                    let tId = tData["id"] as? String ?? key
                    let tPath = tData["path"] as? String ?? 
                                (tData["url"] as? String ?? 
                                (tData["fileUrl"] as? String ?? 
                                (tData["downloadUrl"] as? String ?? "")))
                    let tName = tData["name"] as? String ?? (tData["title"] as? String ?? key)
                    let trimmedPath = tPath.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmedPath.isEmpty {
                        parsedTracks.append(SongTrack(id: tId, path: trimmedPath, name: tName))
                    }
                } else if let tPath = val as? String {
                    let trimmedPath = tPath.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmedPath.isEmpty {
                        parsedTracks.append(SongTrack(id: key, path: trimmedPath, name: key))
                    }
                }
            }
        }
        
        return Song(id: sId, name: sName, artist: sArtist, key: sKey, tracks: parsedTracks, bpm: sBpm)
    }
}
