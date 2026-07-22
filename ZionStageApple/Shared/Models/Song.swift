//
//  Song.swift
//  ZionStageApple
//
//  Modelos nativos en Swift para Canciones, Pistas (Stems) y Setlists.
//  Replica exacta de los campos que usa Firestore en la app Android/Web.
//

import Foundation

// MARK: - Track / Stem
// Refleja el array `tracks` de Firestore (app Android y Web).
public struct Track: Identifiable, Codable, Equatable {
    public var id: String { name }
    public let name: String          // "Click", "Drums", "Bass", "Guide", etc.
    public var url: String           // URL del archivo en B2 / CDN
    public var normalizedUrl: String? // FLAC lossless (v2, si disponible)
    public var normalizedReady: Bool  // true = FLAC listo en servidor

    public init(name: String, url: String, normalizedUrl: String? = nil, normalizedReady: Bool = false) {
        self.name = name
        self.url = url
        self.normalizedUrl = normalizedUrl
        self.normalizedReady = normalizedReady
    }
}

// MARK: - Stem (estado local en motor de audio)
// Extiende Track con el estado mutable de mezcla (volumen, mute, solo, pan).
public struct Stem: Identifiable, Codable, Equatable {
    public let id: String
    public let name: String
    public let role: String       // vocal, drums, bass, guitar, keys, click, guide
    public let audioUrl: String
    public var localPath: String?
    public var volume: Float = 1.0
    public var pan: Float = 0.0
    public var isMuted: Bool = false
    public var isSolo: Bool = false

    public init(id: String, name: String, role: String, audioUrl: String,
                localPath: String? = nil, volume: Float = 1.0, pan: Float = 0.0,
                isMuted: Bool = false, isSolo: Bool = false) {
        self.id = id
        self.name = name
        self.role = role
        self.audioUrl = audioUrl
        self.localPath = localPath
        self.volume = volume
        self.pan = pan
        self.isMuted = isMuted
        self.isSolo = isSolo
    }

    /// Crea un Stem desde un Track de Firestore, infiriendo el rol por nombre.
    public init(from track: Track, songId: String) {
        let nameLow = track.name.lowercased()
        let role: String
        if nameLow.contains("click") {
            role = "click"
        } else if nameLow.contains("guide") || nameLow.contains("guia") || nameLow.contains("cue") {
            role = "guide"
        } else if nameLow.contains("drum") || nameLow.contains("bat") || nameLow.contains("perc") {
            role = "drums"
        } else if nameLow.contains("bass") || nameLow.contains("bajo") {
            role = "bass"
        } else if nameLow.contains("guitar") || nameLow.contains("guit") {
            role = "guitar"
        } else if nameLow.contains("key") || nameLow.contains("piano") || nameLow.contains("synth") || nameLow.contains("teclado") {
            role = "keys"
        } else if nameLow.contains("vocal") || nameLow.contains("lead") || nameLow.contains("voz") || nameLow.contains("voc") {
            role = "vocal"
        } else {
            role = "instrument"
        }

        self.id = "\(songId)_\(track.name)"
        self.name = track.name
        self.role = role
        self.audioUrl = track.url
        self.localPath = nil
        self.volume = 1.0
        self.pan = 0.0
        self.isMuted = false
        self.isSolo = false
    }
}

// MARK: - Marker (sección de la canción)
public struct SongMarker: Identifiable, Codable, Equatable {
    public let id: String
    public let time: Double   // posición en segundos
    public let label: String  // "INTRO", "CORO", "PUENTE", etc.

    public init(id: String = UUID().uuidString, time: Double, label: String) {
        self.id = id
        self.time = time
        self.label = label
    }
}

// MARK: - Partitura (PDF)
public struct Partitura: Identifiable, Codable, Equatable {
    public let id: String
    public let songId: String
    public let instrument: String  // "Piano", "Guitarra", etc.
    public let title: String
    public let pdfUrl: String

    public init(id: String, songId: String, instrument: String, title: String, pdfUrl: String) {
        self.id = id
        self.songId = songId
        self.instrument = instrument
        self.title = title
        self.pdfUrl = pdfUrl
    }
}

// MARK: - Song
// Replica los campos del documento en Firestore colección `songs`.
public struct Song: Identifiable, Codable, Equatable {
    public let id: String
    public let name: String           // Nombre de la canción (campo "name" en Firestore)
    public var title: String { name } // Alias
    public let artist: String
    public let tempo: Double?         // BPM
    public let key: String?           // Tonalidad ej. "G", "Am", "F#"
    public let timeSignature: String? // "4/4", "6/8", etc.
    public let duration: Double?      // Duración en segundos
    public let coverUrl: String?
    public var tracks: [Track]        // Pistas/Stems (array en Firestore)
    public var lyrics: String?        // Letra almacenada en doc (fallback)
    public var chords: String?        // Acordes almacenados en doc (fallback)
    public var markers: [SongMarker]
    public let userId: String?
    public let isGlobal: Bool
    public var isDownloadedLocally: Bool = false

    /// Genera el array de Stems con estado de mezcla a partir de los Tracks de Firestore.
    public var stems: [Stem] {
        tracks
            .filter { $0.name != "__PreviewMix" }
            .map { Stem(from: $0, songId: id) }
    }

    public init(
        id: String, name: String, artist: String = "", tempo: Double? = nil,
        key: String? = nil, timeSignature: String? = "4/4", duration: Double? = nil,
        coverUrl: String? = nil, tracks: [Track] = [], lyrics: String? = nil,
        chords: String? = nil, markers: [SongMarker] = [],
        userId: String? = nil, isGlobal: Bool = false
    ) {
        self.id = id
        self.name = name
        self.artist = artist
        self.tempo = tempo
        self.key = key
        self.timeSignature = timeSignature
        self.duration = duration
        self.coverUrl = coverUrl
        self.tracks = tracks
        self.lyrics = lyrics
        self.chords = chords
        self.markers = markers
        self.userId = userId
        self.isGlobal = isGlobal
    }
}

// MARK: - Setlist
public struct Setlist: Identifiable, Codable, Equatable {
    public let id: String
    public let name: String
    public let userId: String
    public var songs: [Song]

    public init(id: String, name: String, userId: String, songs: [Song] = []) {
        self.id = id
        self.name = name
        self.userId = userId
        self.songs = songs
    }
}
