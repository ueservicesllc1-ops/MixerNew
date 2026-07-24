//
//  FirebaseService.swift
//  ZionStageApple
//
//  Servicio nativo en Swift para Firebase Auth + Firestore.
//  Replica exacta de las consultas de Multitrack.jsx (app Android/Web).
//  Colecciones: songs, setlists, lyrics, chords, partituras
//

import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

// MARK: - FirebaseService
public class FirebaseService: ObservableObject {
    public static let shared = FirebaseService()

    // MARK: State publicado
    @Published public var currentUser: User? = nil
    @Published public var isAuthenticated: Bool = false
    @Published public var authError: String? = nil

    @Published public var librarySongs: [Song] = []
    @Published public var globalSongs: [Song] = []
    @Published public var setlists: [Setlist] = []
    @Published public var isLoadingLibrary: Bool = false
    @Published public var isLoadingGlobal: Bool = false

    // MARK: - Internals
    private lazy var db = Firestore.firestore()
    private var authStateHandle: AuthStateDidChangeListenerHandle?
    private var unsubSongs: ListenerRegistration?
    private var unsubGlobal: ListenerRegistration?
    private var unsubSetlists: ListenerRegistration?

    private init() {
        startAuthListener()
    }

    // MARK: - Auth State Listener
    private func startAuthListener() {
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            DispatchQueue.main.async {
                self?.currentUser = user
                self?.isAuthenticated = user != nil
                if let user = user {
                    self?.startFirestoreListeners(userId: user.uid)
                } else {
                    self?.stopFirestoreListeners()
                    self?.librarySongs = []
                    self?.globalSongs = []
                    self?.setlists = []
                }
            }
        }
    }

    // MARK: - Firestore Listeners
    private func startFirestoreListeners(userId: String) {
        // 1. Canciones del usuario
        isLoadingLibrary = true
        let songsQuery = db.collection("songs").whereField("userId", isEqualTo: userId)
        unsubSongs = songsQuery.addSnapshotListener { [weak self] snap, err in
            DispatchQueue.main.async {
                self?.isLoadingLibrary = false
                guard let snap = snap, err == nil else {
                    print("[FirebaseService] Error songs listener: \(err?.localizedDescription ?? "")")
                    return
                }
                self?.librarySongs = snap.documents.compactMap { Self.parseSong(doc: $0) }
            }
        }

        // 2. Catálogo Global (isGlobal == true)
        isLoadingGlobal = true
        let globalQuery = db.collection("songs")
            .whereField("isGlobal", isEqualTo: true)
            .limit(to: 400)
        unsubGlobal = globalQuery.addSnapshotListener { [weak self] snap, err in
            DispatchQueue.main.async {
                self?.isLoadingGlobal = false
                guard let snap = snap, err == nil else { return }
                let parsed = snap.documents.compactMap { Self.parseSong(doc: $0) }
                    .filter { !($0.tracks.isEmpty) }
                self?.globalSongs = parsed
            }
        }

        // 3. Setlists del usuario
        let setlistsQuery = db.collection("setlists").whereField("userId", isEqualTo: userId)
        unsubSetlists = setlistsQuery.addSnapshotListener { [weak self] snap, err in
            DispatchQueue.main.async {
                guard let snap = snap, err == nil else { return }
                self?.setlists = snap.documents.compactMap { Self.parseSetlist(doc: $0) }
            }
        }
    }

    private func stopFirestoreListeners() {
        unsubSongs?.remove(); unsubSongs = nil
        unsubGlobal?.remove(); unsubGlobal = nil
        unsubSetlists?.remove(); unsubSetlists = nil
    }

    // MARK: - Auth Operations
    public func signIn(email: String, password: String, completion: @escaping (Error?) -> Void) {
        Auth.auth().signIn(withEmail: email, password: password) { _, error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func createAccount(email: String, password: String, completion: @escaping (Error?) -> Void) {
        Auth.auth().createUser(withEmail: email, password: password) { _, error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func resetPassword(email: String, completion: @escaping (Error?) -> Void) {
        Auth.auth().sendPasswordReset(withEmail: email) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func signOut() {
        try? Auth.auth().signOut()
    }

    // MARK: - Setlist Operations
    public func createSetlist(name: String, completion: @escaping (Error?) -> Void) {
        guard let uid = currentUser?.uid else {
            completion(NSError(domain: "auth", code: 0, userInfo: [NSLocalizedDescriptionKey: "No autenticado"]))
            return
        }
        db.collection("setlists").addDocument(data: [
            "name": name,
            "userId": uid,
            "songs": [],
            "createdAt": FieldValue.serverTimestamp()
        ]) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func deleteSetlist(id: String, completion: @escaping (Error?) -> Void) {
        db.collection("setlists").document(id).delete { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func addSongToSetlist(setlistId: String, song: Song, completion: @escaping (Error?) -> Void) {
        let songData = encodeSongForSetlist(song)
        db.collection("setlists").document(setlistId).updateData([
            "songs": FieldValue.arrayUnion([songData])
        ]) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func removeSongFromSetlist(setlistId: String, song: Song, completion: @escaping (Error?) -> Void) {
        let songData = encodeSongForSetlist(song)
        db.collection("setlists").document(setlistId).updateData([
            "songs": FieldValue.arrayRemove([songData])
        ]) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    public func updateSetlistSongsOrder(setlistId: String, songs: [Song], completion: @escaping (Error?) -> Void) {
        let songsData = songs.map { encodeSongForSetlist($0) }
        db.collection("setlists").document(setlistId).updateData([
            "songs": songsData
        ]) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    // MARK: - Lyrics & Chords
    public func fetchLyrics(songId: String, completion: @escaping (String?) -> Void) {
        db.collection("lyrics").whereField("songId", isEqualTo: songId)
            .getDocuments { snap, _ in
                DispatchQueue.main.async {
                    completion(snap?.documents.first?.data()["text"] as? String)
                }
            }
    }

    public func fetchChords(songId: String, completion: @escaping (String?) -> Void) {
        db.collection("chords").whereField("songId", isEqualTo: songId)
            .getDocuments { snap, _ in
                DispatchQueue.main.async {
                    completion(snap?.documents.first?.data()["text"] as? String)
                }
            }
    }

    public func listenLyrics(songId: String, onChange: @escaping (String?) -> Void) -> ListenerRegistration {
        return db.collection("lyrics").whereField("songId", isEqualTo: songId)
            .addSnapshotListener { snap, _ in
                DispatchQueue.main.async {
                    onChange(snap?.documents.first?.data()["text"] as? String)
                }
            }
    }

    public func listenChords(songId: String, onChange: @escaping (String?) -> Void) -> ListenerRegistration {
        return db.collection("chords").whereField("songId", isEqualTo: songId)
            .addSnapshotListener { snap, _ in
                DispatchQueue.main.async {
                    onChange(snap?.documents.first?.data()["text"] as? String)
                }
            }
    }

    // MARK: - Partituras
    public func listenPartituras(songId: String, onChange: @escaping ([Partitura]) -> Void) -> ListenerRegistration {
        return db.collection("partituras").whereField("songId", isEqualTo: songId)
            .addSnapshotListener { snap, _ in
                DispatchQueue.main.async {
                    let list = snap?.documents.compactMap { doc -> Partitura? in
                        let d = doc.data()
                        guard let pdfUrl = d["pdfUrl"] as? String else { return nil }
                        return Partitura(
                            id: doc.documentID,
                            songId: songId,
                            instrument: d["instrument"] as? String ?? "",
                            title: d["title"] as? String ?? d["instrument"] as? String ?? "Partitura",
                            pdfUrl: pdfUrl
                        )
                    }.sorted { $0.instrument < $1.instrument } ?? []
                    onChange(list)
                }
            }
    }

    // MARK: - Firestore Parsers
    private static func parseSong(doc: QueryDocumentSnapshot) -> Song? {
        let d = doc.data()
        guard let name = d["name"] as? String, !name.isEmpty else { return nil }

        let rawTracks = d["tracks"] as? [[String: Any]] ?? []
        let tracks: [Track] = rawTracks.compactMap { t in
            guard let tName = t["name"] as? String,
                  let url = t["url"] as? String,
                  !url.isEmpty else { return nil }
            return Track(
                name: tName,
                url: url,
                normalizedUrl: t["normalizedUrl"] as? String,
                normalizedReady: t["normalizedReady"] as? Bool ?? false
            )
        }

        let rawMarkers = d["markers"] as? [[String: Any]] ?? []
        let markers: [SongMarker] = rawMarkers.compactMap { m in
            guard let time = m["time"] as? Double,
                  let label = m["label"] as? String else { return nil }
            return SongMarker(
                id: m["id"] as? String ?? UUID().uuidString,
                time: time,
                label: label
            )
        }

        return Song(
            id: doc.documentID,
            name: name,
            artist: d["artist"] as? String ?? "",
            tempo: d["tempo"] as? Double ?? (d["bpm"] as? Double),
            key: d["key"] as? String,
            timeSignature: d["timeSignature"] as? String ?? "4/4",
            duration: d["duration"] as? Double,
            coverUrl: d["coverUrl"] as? String,
            tracks: tracks,
            lyrics: d["lyrics"] as? String,
            chords: d["chords"] as? String,
            markers: markers,
            userId: d["userId"] as? String,
            isGlobal: d["isGlobal"] as? Bool ?? false
        )
    }

    private static func parseSetlist(doc: QueryDocumentSnapshot) -> Setlist? {
        let d = doc.data()
        guard let name = d["name"] as? String,
              let userId = d["userId"] as? String else { return nil }

        // Songs en el setlist están almacenados como array de dicts
        let rawSongs = d["songs"] as? [[String: Any]] ?? []
        let songs: [Song] = rawSongs.compactMap { sd in
            guard let id = sd["id"] as? String,
                  let name = sd["name"] as? String else { return nil }
            let rawTracks = sd["tracks"] as? [[String: Any]] ?? []
            let tracks: [Track] = rawTracks.compactMap { t in
                guard let tName = t["name"] as? String, let url = t["url"] as? String else { return nil }
                return Track(name: tName, url: url, normalizedUrl: t["normalizedUrl"] as? String, normalizedReady: t["normalizedReady"] as? Bool ?? false)
            }
            return Song(
                id: id, name: name,
                artist: sd["artist"] as? String ?? "",
                tempo: sd["tempo"] as? Double,
                key: sd["key"] as? String,
                timeSignature: sd["timeSignature"] as? String ?? "4/4",
                duration: sd["duration"] as? Double,
                tracks: tracks,
                userId: sd["userId"] as? String,
                isGlobal: false
            )
        }

        return Setlist(id: doc.documentID, name: name, userId: userId, songs: songs)
    }

    private func encodeSongForSetlist(_ song: Song) -> [String: Any] {
        var data: [String: Any] = [
            "id": song.id,
            "name": song.name,
            "artist": song.artist,
            "isGlobal": song.isGlobal
        ]
        if let tempo = song.tempo { data["tempo"] = tempo }
        if let key = song.key { data["key"] = key }
        if let ts = song.timeSignature { data["timeSignature"] = ts }
        if let dur = song.duration { data["duration"] = dur }
        data["tracks"] = song.tracks.map { t -> [String: Any] in
            var td: [String: Any] = ["name": t.name, "url": t.url]
            if let nu = t.normalizedUrl { td["normalizedUrl"] = nu }
            td["normalizedReady"] = t.normalizedReady
            return td
        }
        return data
    }
}
