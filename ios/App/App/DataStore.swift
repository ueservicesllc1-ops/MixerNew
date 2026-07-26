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

class DataStore: ObservableObject {
    @Published var setlists: [Setlist] = []
    @Published var activeSetlistId: String? = nil
    @Published var isLoading: Bool = false
    
    var activeSetlist: Setlist? {
        if let id = activeSetlistId, let found = setlists.first(where: { $0.id == id }) {
            return found
        }
        return setlists.first
    }
    
    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    
    func startListeningToSetlists() {
        guard let uid = Auth.auth().currentUser?.uid else { 
            self.isLoading = false
            return 
        }
        self.isLoading = true
        
        // Firestore field in Zion Stage is 'userId'
        let query = db.collection("setlists")
            .whereField("userId", isEqualTo: uid)
        
        listener = query.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }
            self.isLoading = false
            
            if let error = error {
                print("Error fetching setlists: \(error.localizedDescription)")
                return
            }
            
            guard let docs = snapshot?.documents else { return }
            
            self.setlists = docs.compactMap { doc -> Setlist? in
                let data = doc.data()
                let name = data["name"] as? String ?? "Setlist Sin Nombre"
                
                var parsedSongs: [Song] = []
                if let songsArray = data["songs"] as? [[String: Any]] {
                    for sData in songsArray {
                        let sId = sData["id"] as? String ?? UUID().uuidString
                        let sName = sData["name"] as? String ?? (sData["title"] as? String ?? "Canción")
                        let sArtist = sData["artist"] as? String
                        let sKey = sData["key"] as? String
                        
                        var parsedTracks: [SongTrack] = []
                        if let tracksArray = sData["tracks"] as? [[String: Any]] {
                            for tData in tracksArray {
                                let tId = tData["id"] as? String ?? UUID().uuidString
                                let tPath = tData["path"] as? String ?? (tData["url"] as? String ?? "")
                                let tName = tData["name"] as? String ?? (tData["title"] as? String ?? "")
                                parsedTracks.append(SongTrack(id: tId, path: tPath, name: tName))
                            }
                        }
                        parsedSongs.append(Song(id: sId, name: sName, artist: sArtist, key: sKey, tracks: parsedTracks, bpm: sData["bpm"] as? Double))
                    }
                }
                
                return Setlist(id: doc.documentID, name: name, songs: parsedSongs)
            }
            
            // Auto select first setlist if none selected
            if self.activeSetlistId == nil, let first = self.setlists.first {
                self.activeSetlistId = first.id
            }
            
            // Auto background-download the active setlist
            if let targetSetlist = self.activeSetlist {
                DispatchQueue.main.async {
                    DownloadManager.shared.downloadSetlist(setlist: targetSetlist)
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
    
    func addSongToSetlist(song: Song, setlistId: String? = nil) {
        let targetId = setlistId ?? activeSetlistId ?? setlists.first?.id
        guard let targetId = targetId else { return }
        
        if song.tracks == nil || song.tracks?.isEmpty == true {
            db.collection("songs").document(song.id).getDocument { [weak self] docSnap, error in
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
        let sBpm = data["bpm"] as? Double ?? (data["tempo"] as? Double)
        
        var parsedTracks: [SongTrack] = []
        let rawTracks = (data["tracks"] as? [[String: Any]]) ?? (data["stems"] as? [[String: Any]]) ?? (data["audioFiles"] as? [[String: Any]]) ?? []
        
        for tData in rawTracks {
            let tId = tData["id"] as? String ?? UUID().uuidString
            let tPath = tData["path"] as? String ?? (tData["url"] as? String ?? (tData["fileUrl"] as? String ?? ""))
            let tName = tData["name"] as? String ?? (tData["title"] as? String ?? (tData["type"] as? String ?? "Track"))
            if !tPath.isEmpty {
                parsedTracks.append(SongTrack(id: tId, path: tPath, name: tName))
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
        
        // Trigger background download of stems immediately!
        DownloadManager.shared.downloadSongStems(song: song)
        
        DispatchQueue.main.async {
            if let idx = self.setlists.firstIndex(where: { $0.id == targetId }) {
                var updatedSongs = self.setlists[idx].songs ?? []
                if !updatedSongs.contains(where: { $0.id == song.id }) {
                    updatedSongs.append(song)
                    self.setlists[idx].songs = updatedSongs
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
    
    func fetchLyrics(for songId: String, completion: @escaping (String?, String?) -> Void) {
        db.collection("lyrics").whereField("songId", isEqualTo: songId).getDocuments { [weak self] snapshot, error in
            if let doc = snapshot?.documents.first {
                let data = doc.data()
                let lyrics = data["lyrics"] as? String ?? (data["content"] as? String ?? (data["text"] as? String))
                let chords = data["chords"] as? String ?? (data["chordsText"] as? String)
                completion(lyrics, chords)
                return
            }
            
            self?.db.collection("lyrics").document(songId).getDocument { docSnap, _ in
                if let docSnap = docSnap, docSnap.exists, let data = docSnap.data() {
                    let lyrics = data["lyrics"] as? String ?? (data["content"] as? String ?? (data["text"] as? String))
                    let chords = data["chords"] as? String ?? (data["chordsText"] as? String)
                    completion(lyrics, chords)
                } else {
                    completion(nil, nil)
                }
            }
        }
    }
}
