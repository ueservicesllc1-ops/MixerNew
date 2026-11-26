import Foundation
import FirebaseFirestore
import Combine
import FirebaseAuth

struct SongTrack: Identifiable, Codable {
    var id: String
    var path: String
    var name: String?
}

struct Song: Identifiable, Codable {
    var id: String
    var name: String
    var artist: String?
    var key: String?
    var tracks: [SongTrack]?
    var bpm: Double?
}

struct Setlist: Identifiable, Codable {
    var id: String
    var name: String
    var songs: [Song]?
}

private struct CachedLyricsPayload: Codable {
    let lyrics: String?
    let chords: String?
}

class DataStore: ObservableObject {
    @Published var setlists: [Setlist] = []
    @Published var activeSetlistId: String? = nil {
        didSet {
            if let id = activeSetlistId {
                UserDefaults.standard.set(id, forKey: "zion_active_setlist_id")
            }
        }
    }
    @Published var isLoading: Bool = false
    
    var activeSetlist: Setlist? {
        if let id = activeSetlistId, let found = setlists.first(where: { $0.id == id }) {
            return found
        }
        return setlists.first
    }
    
    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    private let fileManager = FileManager.default
    
    private var documentsURL: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    private var setlistsCacheURL: URL {
        documentsURL.appendingPathComponent("zion_setlists_cache.json")
    }
    
    private var lyricsCacheDirURL: URL {
        let dir = documentsURL.appendingPathComponent("ZionLyrics", isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }
    
    init() {
        self.activeSetlistId = UserDefaults.standard.string(forKey: "zion_active_setlist_id")
        loadCachedSetlists()
    }
    
    // Instant local boot: load last saved setlists from Documents before Firestore responds
    private func loadCachedSetlists() {
        guard let data = try? Data(contentsOf: setlistsCacheURL),
              let cached = try? JSONDecoder().decode([Setlist].self, from: data),
              !cached.isEmpty else {
            return
        }
        self.setlists = cached
        if self.activeSetlistId == nil || !cached.contains(where: { $0.id == self.activeSetlistId }) {
            self.activeSetlistId = cached.first?.id
        }
    }
    
    private func saveSetlistsCache(_ list: [Setlist]) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else { return }
            if let data = try? JSONEncoder().encode(list) {
                try? data.write(to: self.setlistsCacheURL, options: .atomic)
            }
        }
    }
    
    func startListeningToSetlists() {
        guard let uid = Auth.auth().currentUser?.uid else {
            self.isLoading = false
            return
        }
        // Only show loading spinner if we don't already have locally cached setlists
        if self.setlists.isEmpty {
            self.isLoading = true
        }
        
        // Firestore field in Zion Stage is 'userId'
        let query = db.collection("setlists")
            .whereField("userId", isEqualTo: uid)
        
        listener?.remove()
        listener = query.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }
            self.isLoading = false
            
            if let error = error {
                print("[DataStore] Error fetching setlists: \(error.localizedDescription)")
                return
            }
            
            guard let docs = snapshot?.documents else { return }
            
            let parsedSetlists: [Setlist] = docs.compactMap { doc -> Setlist? in
                let data = doc.data()
                let name = data["name"] as? String ?? "Setlist Sin Nombre"
                
                var parsedSongs: [Song] = []
                if let songsArray = data["songs"] as? [[String: Any]] {
                    for sData in songsArray {
                        let sId = sData["id"] as? String ?? UUID().uuidString
                        let sName = sData["name"] as? String ?? (sData["title"] as? String ?? "Canción")
                        let sArtist = sData["artist"] as? String
                        let sKey = sData["key"] as? String
                        let sBpm: Double? = (sData["bpm"] as? Double)
                            ?? (sData["bpm"] as? Int).map { Double($0) }
                            ?? (sData["bpm"] as? String).flatMap { Double($0) }
                        
                        var parsedTracks: [SongTrack] = []
                        if let tracksArray = sData["tracks"] as? [[String: Any]] {
                            for tData in tracksArray {
                                let tId = tData["id"] as? String ?? UUID().uuidString
                                let tPath = tData["path"] as? String ?? (tData["url"] as? String ?? "")
                                let tName = tData["name"] as? String ?? (tData["title"] as? String ?? "")
                                let trimmedPath = tPath.trimmingCharacters(in: .whitespacesAndNewlines)
                                if !trimmedPath.isEmpty {
                                    parsedTracks.append(SongTrack(id: tId, path: trimmedPath, name: tName))
                                }
                            }
                        }
                        parsedSongs.append(Song(id: sId, name: sName, artist: sArtist, key: sKey, tracks: parsedTracks, bpm: sBpm))
                    }
                }
                
                return Setlist(id: doc.documentID, name: name, songs: parsedSongs)
            }
            
            self.setlists = parsedSetlists
            self.saveSetlistsCache(parsedSetlists)
            
            // Auto select first setlist if none selected or previous was deleted
            if self.activeSetlistId == nil || !parsedSetlists.contains(where: { $0.id == self.activeSetlistId }) {
                self.activeSetlistId = parsedSetlists.first?.id
            }
            
            // Auto background-preload the active setlist (stems + real waveforms)
            if let targetSetlist = self.activeSetlist {
                DispatchQueue.main.async {
                    DownloadManager.shared.downloadSetlist(
                        setlist: targetSetlist,
                        prioritizingAfter: AudioEngineViewModel.shared.currentSong?.id
                    )
                }
            }
        }
    }
    
    func createSetlist(name: String) {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let docRef = db.collection("setlists").document()
        let newId = docRef.documentID
        let newDoc: [String: Any] = [
            "name": name,
            "userId": uid,
            "songs": [],
            "createdAt": FieldValue.serverTimestamp()
        ]
        docRef.setData(newDoc) { [weak self] error in
            if error == nil {
                DispatchQueue.main.async {
                    self?.activeSetlistId = newId
                }
            }
        }
    }
    
    func deleteSetlist(id: String) {
        db.collection("setlists").document(id).delete()
        DispatchQueue.main.async {
            self.setlists.removeAll { $0.id == id }
            if self.activeSetlistId == id {
                self.activeSetlistId = self.setlists.first?.id
            }
            self.saveSetlistsCache(self.setlists)
        }
    }
    
    func addSongToSetlist(song: Song, setlistId: String? = nil) {
        let targetId = setlistId ?? activeSetlistId ?? setlists.first?.id
        guard let targetId = targetId else { return }
        
        if song.tracks == nil || song.tracks?.isEmpty == true {
            db.collection("songs").document(song.id).getDocument { [weak self] docSnap, _ in
                if let docSnap = docSnap, docSnap.exists, let data = docSnap.data() {
                    let fullSong = self?.parseSongFromDict(id: docSnap.documentID, data: data) ?? song
                    self?.performAddSongToSetlist(song: fullSong, targetId: targetId)
                } else {
                    self?.performAddSongToSetlist(song: song, targetId: targetId)
                }
            }
        } else {
            performAddSongToSetlist(song: song, targetId: targetId)
        }
    }
    
    private func parseSongFromDict(id: String, data: [String: Any]) -> Song {
        let sName = data["name"] as? String ?? (data["title"] as? String ?? "Canción")
        let sArtist = data["artist"] as? String
        let sKey = data["key"] as? String
        let sBpm: Double? = (data["bpm"] as? Double)
            ?? (data["tempo"] as? Double)
            ?? (data["bpm"] as? Int).map { Double($0) }
            ?? (data["bpm"] as? String).flatMap { Double($0) }
        
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
        
        return Song(id: id, name: sName, artist: sArtist, key: sKey, tracks: parsedTracks, bpm: sBpm)
    }
    
    private func performAddSongToSetlist(song: Song, targetId: String) {
        let songDict: [String: Any] = [
            "id": song.id,
            "name": song.name,
            "artist": song.artist ?? "",
            "key": song.key ?? "C",
            "bpm": song.bpm ?? 120.0,
            "tracks": song.tracks?.map { ["id": $0.id, "path": $0.path, "name": $0.name ?? ""] } ?? []
        ]
        
        db.collection("setlists").document(targetId).updateData([
            "songs": FieldValue.arrayUnion([songDict])
        ]) { [weak self] error in
            if error != nil {
                self?.db.collection("setlists").document(targetId).setData([
                    "songs": FieldValue.arrayUnion([songDict])
                ], merge: true)
            }
        }
        
        // Trigger background download of stems + waveform immediately!
        DownloadManager.shared.downloadSongStems(song: song)
        
        DispatchQueue.main.async {
            if let idx = self.setlists.firstIndex(where: { $0.id == targetId }) {
                var updatedSongs = self.setlists[idx].songs ?? []
                if !updatedSongs.contains(where: { $0.id == song.id }) {
                    updatedSongs.append(song)
                    self.setlists[idx].songs = updatedSongs
                    self.saveSetlistsCache(self.setlists)
                }
            }
        }
    }
    
    func removeSongFromSetlist(songId: String, setlistId: String? = nil) {
        let targetId = setlistId ?? activeSetlistId ?? setlists.first?.id
        guard let targetId = targetId else { return }
        
        if let idx = setlists.firstIndex(where: { $0.id == targetId }),
           var songs = setlists[idx].songs {
            
            if let songIdx = songs.firstIndex(where: { $0.id == songId }) {
                songs.remove(at: songIdx)
                setlists[idx].songs = songs
                saveSetlistsCache(setlists)
                
                let updatedSongsDict = songs.map { song -> [String: Any] in
                    [
                        "id": song.id,
                        "name": song.name,
                        "artist": song.artist ?? "",
                        "key": song.key ?? "C",
                        "bpm": song.bpm ?? 120.0,
                        "tracks": song.tracks?.map { ["id": $0.id, "path": $0.path, "name": $0.name ?? ""] } ?? []
                    ]
                }
                
                db.collection("setlists").document(targetId).updateData([
                    "songs": updatedSongsDict
                ])
            }
        }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
    
    // MARK: - Lyrics & Chords (with Local Offline Cache)
    private func lyricsFileURL(for songId: String) -> URL {
        let safeId = songId.replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        return lyricsCacheDirURL.appendingPathComponent("\(safeId).json")
    }
    
    func fetchLyrics(for songId: String, completion: @escaping (String?, String?) -> Void) {
        let cacheURL = lyricsFileURL(for: songId)
        
        // 1. Return local cache immediately if available
        if let data = try? Data(contentsOf: cacheURL),
           let cached = try? JSONDecoder().decode(CachedLyricsPayload.self, from: data) {
            completion(cached.lyrics, cached.chords)
        }
        
        // 2. Refresh from Firestore in background
        let saveAndComplete: (String?, String?) -> Void = { lyrics, chords in
            if lyrics != nil || chords != nil {
                let payload = CachedLyricsPayload(lyrics: lyrics, chords: chords)
                if let encoded = try? JSONEncoder().encode(payload) {
                    try? encoded.write(to: cacheURL, options: .atomic)
                }
            }
            completion(lyrics, chords)
        }
        
        db.collection("lyrics").whereField("songId", isEqualTo: songId).getDocuments { [weak self] snapshot, _ in
            if let doc = snapshot?.documents.first {
                let data = doc.data()
                let lyrics = data["lyrics"] as? String ?? (data["content"] as? String ?? (data["text"] as? String))
                let chords = data["chords"] as? String ?? (data["chordsText"] as? String)
                saveAndComplete(lyrics, chords)
                return
            }
            
            self?.db.collection("lyrics").document(songId).getDocument { docSnap, _ in
                if let docSnap = docSnap, docSnap.exists, let data = docSnap.data() {
                    let lyrics = data["lyrics"] as? String ?? (data["content"] as? String ?? (data["text"] as? String))
                    let chords = data["chords"] as? String ?? (data["chordsText"] as? String)
                    saveAndComplete(lyrics, chords)
                } else {
                    // Only send nil if we didn't have local cache
                    if !FileManager.default.fileExists(atPath: cacheURL.path) {
                        completion(nil, nil)
                    }
                }
            }
        }
    }
}
