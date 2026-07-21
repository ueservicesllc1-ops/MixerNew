//
//  Setlist.swift
//  ZionStageApple
//
//  Modelo nativo para listas de repertorio de la banda.
//

import Foundation

public struct Setlist: Identifiable, Codable, Equatable {
    public let id: String
    public var name: String
    public var date: Date
    public var songIds: [String]
    public var notes: String?

    public init(id: String = UUID().uuidString, name: String, date: Date = Date(), songIds: [String] = [], notes: String? = nil) {
        self.id = id
        self.name = name
        self.date = date
        self.songIds = songIds
        self.notes = notes
    }
}
