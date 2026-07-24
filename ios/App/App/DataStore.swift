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
    @Published var isLoading: Bool = false
    
    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    
    func startListeningToSetlists() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        self.isLoading = true
        
        let query = db.collection("setlists")
            .whereField("uid", isEqualTo: uid)
            .order(by: "createdAt", descending: true)
        
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
                        let sName = sData["name"] as? String ?? "Canción"
                        let sArtist = sData["artist"] as? String
                        
                        var parsedTracks: [SongTrack] = []
                        if let tracksArray = sData["tracks"] as? [[String: Any]] {
                            for tData in tracksArray {
                                let tId = tData["id"] as? String ?? UUID().uuidString
                                let tPath = tData["path"] as? String ?? ""
                                let tName = tData["name"] as? String
                                parsedTracks.append(SongTrack(id: tId, path: tPath, name: tName))
                            }
                        }
                        parsedSongs.append(Song(id: sId, name: sName, artist: sArtist, tracks: parsedTracks, bpm: sData["bpm"] as? Double))
                    }
                }
                
                return Setlist(id: doc.documentID, name: name, songs: parsedSongs)
            }
        }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
    
    func fetchLyrics(for songId: String, completion: @escaping (String?) -> Void) {
        db.collection("lyrics").whereField("songId", isEqualTo: songId).getDocuments { snapshot, error in
            if let doc = snapshot?.documents.first {
                completion(doc.data()["content"] as? String)
            } else {
                completion(nil)
            }
        }
    }
}
