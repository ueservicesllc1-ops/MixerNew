//
//  OfflineStorageManager.swift
//  ZionStageApple
//
//  Gestor de almacenamiento en disco local (caché offline).
//  Guarda los stems en Documents/ZionCache/{songId}/{trackName}.ext
//  Soporta verificación de integridad, cálculo de espacio disponible y borrado selectivo.
//

import Foundation

public class OfflineStorageManager {
    public static let shared = OfflineStorageManager()

    private let fileManager = FileManager.default

    private init() {
        createCacheDirectoryIfNeeded()
    }

    // MARK: - Directorio Raíz de Caché
    public var cacheDirectory: URL {
        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("ZionCache", isDirectory: true)
    }

    private func createCacheDirectoryIfNeeded() {
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true, attributes: nil)
        }
    }

    public func songDirectory(songId: String) -> URL {
        let dir = cacheDirectory.appendingPathComponent(songId, isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
        }
        return dir
    }

    // MARK: - Rutas de Archivos
    public func trackURL(songId: String, trackName: String, extension ext: String = "mp3") -> URL {
        let safeTrackName = trackName.replacingOccurrences(of: "/", with: "_")
        return songDirectory(songId: songId).appendingPathComponent("\(safeTrackName).\(ext)")
    }

    // MARK: - Verificación de Descarga e Integridad
    public func isTrackDownloaded(songId: String, trackName: String) -> Bool {
        let mp3URL = trackURL(songId: songId, trackName: trackName, extension: "mp3")
        let flacURL = trackURL(songId: songId, trackName: trackName, extension: "flac")
        return isFileValid(at: mp3URL) || isFileValid(at: flacURL)
    }

    public func isNormalizedDownloaded(songId: String, trackName: String) -> Bool {
        let flacURL = trackURL(songId: songId, trackName: trackName, extension: "flac")
        return isFileValid(at: flacURL)
    }

    public func getTrackPath(songId: String, trackName: String) -> URL? {
        let flacURL = trackURL(songId: songId, trackName: trackName, extension: "flac")
        if isFileValid(at: flacURL) { return flacURL }

        let mp3URL = trackURL(songId: songId, trackName: trackName, extension: "mp3")
        if isFileValid(at: mp3URL) { return mp3URL }

        // Compatibilidad con directorio heredado "ZionStems"
        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let legacyFlac = docs.appendingPathComponent("ZionStems/\(songId)_\(trackName).flac")
        if isFileValid(at: legacyFlac) { return legacyFlac }

        let legacyMp3 = docs.appendingPathComponent("ZionStems/\(songId)_\(trackName).mp3")
        if isFileValid(at: legacyMp3) { return legacyMp3 }

        return nil
    }

    public func getNormalizedPath(songId: String, trackName: String) -> URL? {
        let flacURL = trackURL(songId: songId, trackName: trackName, extension: "flac")
        if isFileValid(at: flacURL) { return flacURL }
        return nil
    }

    private func isFileValid(at url: URL) -> Bool {
        guard fileManager.fileExists(atPath: url.path) else { return false }
        do {
            let attrs = try fileManager.attributesOfItem(atPath: url.path)
            if let size = attrs[.size] as? Int64, size > 500 { // mínimo 500 bytes para evitar archivos truncados o 0 bytes
                return true
            }
        } catch {
            return false
        }
        return false
    }

    // MARK: - Espacio en Disco y Caché
    public func totalCacheSizeBytes() -> Int64 {
        guard let enumerator = fileManager.enumerator(at: cacheDirectory, includingPropertiesForKeys: [.fileSizeKey]) else {
            return 0
        }
        var totalSize: Int64 = 0
        for case let fileURL as URL in enumerator {
            if let resourceValues = try? fileURL.resourceValues(forKeys: [.fileSizeKey]),
               let size = resourceValues.fileSize {
                totalSize += Int64(size)
            }
        }
        return totalSize
    }

    public func availableFreeDiskSpaceBytes() -> Int64 {
        do {
            let values = try cacheDirectory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            if let capacity = values.volumeAvailableCapacityForImportantUsage {
                return capacity
            }
        } catch {
            print("[OfflineStorageManager] Error obteniendo espacio en disco: \(error)")
        }
        return 0
    }

    // MARK: - Borrado de Caché
    public func clearCacheForSong(songId: String) {
        let dir = songDirectory(songId: songId)
        try? fileManager.removeItem(at: dir)

        // Limpiar también del directorio heredado "ZionStems" si existe
        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let legacyDir = docs.appendingPathComponent("ZionStems")
        if let files = try? fileManager.contentsOfDirectory(at: legacyDir, includingPropertiesForKeys: nil) {
            for file in files where file.lastPathComponent.hasPrefix(songId) {
                try? fileManager.removeItem(at: file)
            }
        }
    }

    public func clearAllCache() {
        try? fileManager.removeItem(at: cacheDirectory)
        createCacheDirectoryIfNeeded()

        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let legacyDir = docs.appendingPathComponent("ZionStems")
        try? fileManager.removeItem(at: legacyDir)
    }
}
