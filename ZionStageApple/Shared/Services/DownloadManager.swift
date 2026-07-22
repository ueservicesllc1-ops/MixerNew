//
//  DownloadManager.swift
//  ZionStageApple
//
//  Gestiona la descarga de stems de audio desde B2/CDN a través del proxy Railway.
//  Guarda los archivos en el sandbox de la app (FileManager).
//  Replica la lógica de descarga de Multitrack.jsx (NativeEngine.saveTrackBlob).
//

import Foundation
import Combine

public struct DownloadProgress {
    public let songId: String
    public let trackName: String
    public let loaded: Int
    public let total: Int
    public var fraction: Double { total > 0 ? Double(loaded) / Double(total) : 0 }
    public var label: String { "Descargando \(trackName) (\(loaded)/\(total))..." }
}

public class DownloadManager: ObservableObject {
    public static let shared = DownloadManager()

    @Published public var progress: DownloadProgress? = nil
    @Published public var isDownloading: Bool = false
    @Published public var lastError: String? = nil

    // Railway proxy (mismo que app Android/Web)
    private let proxyBase = "https://mixernew-production.up.railway.app"

    private init() {}

    // MARK: - Directorio de stems locales
    private func stemsDirectory() -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("ZionStems", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    public func localPathForTrack(songId: String, trackName: String) -> URL {
        stemsDirectory()
            .appendingPathComponent("\(songId)_\(trackName).mp3")
    }

    public func localPathForTrackFLAC(songId: String, trackName: String) -> URL {
        stemsDirectory()
            .appendingPathComponent("\(songId)_\(trackName).flac")
    }

    public func isTrackDownloaded(songId: String, trackName: String) -> Bool {
        FileManager.default.fileExists(atPath: localPathForTrack(songId: songId, trackName: trackName).path) ||
        FileManager.default.fileExists(atPath: localPathForTrackFLAC(songId: songId, trackName: trackName).path)
    }

    public func localURL(songId: String, trackName: String) -> URL? {
        let flac = localPathForTrackFLAC(songId: songId, trackName: trackName)
        if FileManager.default.fileExists(atPath: flac.path) { return flac }
        let mp3 = localPathForTrack(songId: songId, trackName: trackName)
        if FileManager.default.fileExists(atPath: mp3.path) { return mp3 }
        return nil
    }

    // MARK: - Descarga de todos los stems de una canción
    /// Descarga todos los tracks de una canción al sandbox local.
    /// - Parameters:
    ///   - song: La canción con sus tracks de Firestore
    ///   - onComplete: Callback cuando terminan todas las descargas
    public func downloadAllTracks(for song: Song, onComplete: @escaping (Bool) -> Void) {
        let downloadable = song.tracks.filter {
            $0.name != "__PreviewMix" && !$0.url.isEmpty && $0.url != "undefined"
        }

        guard !downloadable.isEmpty else {
            onComplete(true)
            return
        }

        DispatchQueue.main.async {
            self.isDownloading = true
            self.lastError = nil
        }

        Task {
            var loaded = 0
            var hadError = false

            for track in downloadable {
                // Actualizar progreso
                DispatchQueue.main.async {
                    self.progress = DownloadProgress(
                        songId: song.id,
                        trackName: track.name,
                        loaded: loaded,
                        total: downloadable.count
                    )
                }

                // Verificar si ya está en disco
                if isTrackDownloaded(songId: song.id, trackName: track.name) {
                    loaded += 1
                    continue
                }

                // Elegir URL: FLAC normalizado (v2) si disponible, sino MP3 original
                let useFlac = track.normalizedReady && !(track.normalizedUrl?.isEmpty ?? true)
                let targetURL: String
                let localDest: URL

                if useFlac, let normalizedUrl = track.normalizedUrl {
                    targetURL = normalizedUrl
                    localDest = localPathForTrackFLAC(songId: song.id, trackName: track.name)
                } else {
                    // Usar proxy Railway para evitar bloqueos de CORS/B2
                    targetURL = "\(proxyBase)/api/download?url=\(track.url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? track.url)"
                    localDest = localPathForTrack(songId: song.id, trackName: track.name)
                }

                do {
                    try await downloadFile(from: targetURL, to: localDest)
                    loaded += 1
                } catch {
                    print("[DownloadManager] Error descargando \(track.name): \(error.localizedDescription)")
                    hadError = true
                    loaded += 1 // continúa con el siguiente
                }
            }

            DispatchQueue.main.async {
                self.isDownloading = false
                self.progress = nil
                if hadError {
                    self.lastError = "Algunas pistas no se pudieron descargar."
                }
                onComplete(!hadError)
            }
        }
    }

    // MARK: - Descargar un archivo individual
    private func downloadFile(from urlString: String, to destination: URL) async throws {
        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        let (tempURL, response) = try await URLSession.shared.download(from: url)

        guard let httpResp = response as? HTTPURLResponse, httpResp.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        // Mover del temp al destino final
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: tempURL, to: destination)
    }

    // MARK: - Eliminar stems locales de una canción
    public func deleteLocalTracks(songId: String) {
        let dir = stemsDirectory()
        do {
            let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            for file in files where file.lastPathComponent.hasPrefix(songId) {
                try FileManager.default.removeItem(at: file)
            }
        } catch {
            print("[DownloadManager] Error borrando stems locales: \(error)")
        }
    }
}
