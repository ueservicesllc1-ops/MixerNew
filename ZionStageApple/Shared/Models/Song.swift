//
//  Song.swift
//  ZionStageApple
//
//  Modelo nativo en Swift para Canciones y Pistas (Stems).
//

import Foundation

public struct Stem: Identifiable, Codable, Equatable {
    public let id: String
    public let name: String
    public let role: String // vocal, drums, bass, guitar, keys, click, guide, etc.
    public let audioUrl: String
    public var localPath: String?
    public var volume: Float = 1.0
    public var pan: Float = 0.0
    public var isMuted: Bool = false
    public var isSolo: Bool = false

    public init(id: String, name: String, role: String, audioUrl: String, localPath: String? = nil, volume: Float = 1.0, pan: Float = 0.0, isMuted: Bool = false, isSolo: Bool = false) {
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
}

public struct Song: Identifiable, Codable, Equatable {
    public let id: String
    public let title: String
    public let artist: String
    public let bpm: Double
    public let key: String
    public var stems: [Stem]
    public var isDownloaded: Bool
    public let timeSignature: String
    public let coverUrl: String?

    public init(id: String, title: String, artist: String, bpm: Double, key: String, stems: [Stem] = [], isDownloaded: Bool = false, timeSignature: String = "4/4", coverUrl: String? = nil) {
        self.id = id
        self.title = title
        self.artist = artist
        self.bpm = bpm
        self.key = key
        self.stems = stems
        self.isDownloaded = isDownloaded
        self.timeSignature = timeSignature
        self.coverUrl = coverUrl
    }
}
