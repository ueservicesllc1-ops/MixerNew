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
    
    var isEmbedded: Bool = false
    var canAccessGlobal: Bool = false
    var onAddSongToSetlist: ((Song) -> Void)? = nil
    
    private let db = Firestore.firestore()
    
    var filteredSongs: [Song] {
        let base = (libraryTab == "global" && canAccessGlobal) ? globalSongs : mySongs
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
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color.zionTextPrimary)
                Spacer()
                if !isEmbedded {
                    Button(action: { presentationMode.wrappedValue.dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundColor(Color.zionTextSecondary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.zionPanel)
            
            // Tabs: Mi Librería vs Global (VIP only) + Search Input
            HStack(spacing: 8) {
                Button(action: { libraryTab = "mine" }) {
                    HStack(spacing: 4) {
                        Image(systemName: "music.note")
                        Text("Mi Librería (\(mySongs.count))")
                    }
                    .font(.system(size: 12, weight: .bold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(libraryTab == "mine" ? Color.zionCyan : Color.zionPanelLight)
                    .foregroundColor(libraryTab == "mine" ? .black : Color.zionTextSecondary)
                    .cornerRadius(6)
                }
                
                if canAccessGlobal {
                    Button(action: { libraryTab = "global" }) {
                        HStack(spacing: 4) {
                            Image(systemName: "globe")
                            Text("Global VIP (\(globalSongs.count))")
                        }
                        .font(.system(size: 12, weight: .bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(libraryTab == "global" ? Color.purple : Color.zionPanelLight)
                        .foregroundColor(libraryTab == "global" ? .white : Color.zionTextSecondary)
                        .cornerRadius(6)
                    }
                }
                
                // Search Input
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Color.zionCyan)
                        .font(.system(size: 12))
                    
                    ZStack(alignment: .leading) {
                        if searchQuery.isEmpty {
                            Text(libraryTab == "mine" ? "Buscar en mi librería..." : "Buscar en Global VIP...")
                                .foregroundColor(Color(white: 0.7))
                                .font(.system(size: 12))
                        }
                        TextField("", text: $searchQuery)
                            .foregroundColor(.white)
                            .font(.system(size: 12, weight: .medium))
                            .accentColor(Color.zionCyan)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                    }
                    
                    if !searchQuery.isEmpty {
                        Button(action: { searchQuery = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(Color.zionTextSecondary)
                                .font(.system(size: 12))
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(red: 0.14, green: 0.19, blue: 0.29))
                .cornerRadius(6)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.zionCyan.opacity(0.35), lineWidth: 1)
                )
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.zionBackground)
            
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
                        .font(.title2)
                        .foregroundColor(Color.zionTextSecondary)
                    Text("No se encontraron canciones")
                        .font(.subheadline.bold())
                        .foregroundColor(Color.zionTextPrimary)
                    Spacer()
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(filteredSongs) { song in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(song.name)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(Color.zionTextPrimary)
                                    Text("\(song.artist ?? "Artista") • \(song.key ?? "C") • \(song.bpm != nil ? "\(Int(song.bpm!))" : "120") BPM")
                                        .font(.system(size: 11))
                                        .foregroundColor(Color.zionTextSecondary)
                                }
                                
                                Spacer()
                                
                                Button(action: {
                                    if let tracks = song.tracks, !tracks.isEmpty {
                                        AudioEngineViewModel.shared.loadSong(song)
                                    }
                                    addedSongIds.insert(song.id)
                                    onAddSongToSetlist?(song)
                                }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: addedSongIds.contains(song.id) ? "checkmark" : "plus")
                                        Text(addedSongIds.contains(song.id) ? "Añadido" : "Añadir / Cargar")
                                    }
                                    .font(.system(size: 11, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(addedSongIds.contains(song.id) ? Color.green : Color.zionCyan)
                                    .foregroundColor(addedSongIds.contains(song.id) ? .white : .black)
                                    .cornerRadius(6)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Color.zionPanel)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.zionBorderSubtle, lineWidth: 1))
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                }
            }
        }
        .background(Color.zionBackground.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .onAppear {
            if !canAccessGlobal {
                libraryTab = "mine"
            }
            fetchSongs()
        }
    }
    
    private func fetchSongs() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isLoading = true
        
        db.collection("songs")
            .whereField("userId", isEqualTo: uid)
            .getDocuments { snapshot, _ in
                if let docs = snapshot?.documents {
                    self.mySongs = docs.compactMap { self.parseSong(doc: $0) }
                }
                
                guard self.canAccessGlobal else {
                    self.globalSongs = []
                    self.isLoading = false
                    return
                }
                
                self.db.collection("songs")
                    .whereField("isGlobal", isEqualTo: true)
                    .limit(to: 400)
                    .getDocuments { globalSnap, _ in
                        self.isLoading = false
                        let allDocs = globalSnap?.documents ?? []
                        self.globalSongs = allDocs
                            .compactMap { self.parseSong(doc: $0) }
                            .filter { ($0.tracks?.count ?? 0) > 0 }
                    }
            }
    }
    
    private func parseSong(doc: QueryDocumentSnapshot) -> Song? {
        let data = doc.data()
        let sId = doc.documentID
        let sName = data["name"] as? String ?? (data["title"] as? String ?? "Canción")
        let sArtist = data["artist"] as? String
        let sKey = data["key"] as? String
        let sBpm: Double? = (data["bpm"] as? Double)
            ?? (data["tempo"] as? Double)
            ?? (data["bpm"] as? Int).map { Double($0) }
            ?? (data["bpm"] as? String).flatMap { Double($0) }
        
        var parsedTracks: [SongTrack] = []
        
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
