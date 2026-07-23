//
//  DownloadManager.swift
//  ZionStageApple
//
//  Gestiona la descarga de stems de audio desde B2/CDN a través del proxy Railway.
//  Usa OfflineStorageManager para almacenamiento y realiza descargas de baja memoria (staggered).
//

import Foundation
import Combine

public struct DownloadProgress {
    public let songId: String
    public let trackName: String
    public let currentTrackIndex: Int
    public let totalTracks: Int
    public let trackBytesLoaded: Int64
    public let trackBytesTotal: Int64

    public var trackFraction: Double {
        trackBytesTotal > 0 ? Double(trackBytesLoaded) / Double(trackBytesTotal) : 0
    }

    public var overallFraction: Double {
        guard totalTracks > 0 else { return 0 }
        let completedFraction = Double(currentTrackIndex) / Double(totalTracks)
        let currentPart = trackFraction / Double(totalTracks)
        return min(1.0, completedFraction + currentPart)
    }

    public var label: String {
        "Descargando \(trackName) (\(currentTrackIndex + 1)/\(totalTracks))..."
    }
}

public class DownloadManager: NSObject, ObservableObject, URLSessionDownloadDelegate {
    public static let shared = DownloadManager()

    @Published public var progress: DownloadProgress? = nil
    @Published public var isDownloading: Bool = false
    @Published public var lastError: String? = nil

    private let proxyBase = "https://mixernew-production.up.railway.app"
    private var downloadTask: Task<Void, Never>? = nil
    private var session: URLSession!

    // Seguimiento de progreso por URLSessionDownloadTask
    private var currentSongId: String = ""
    private var currentTrackName: String = ""
    private var currentTrackIndex: Int = 0
    private var totalTracks: Int = 0
    private var activeDownloadContinuation: CheckedContinuation<URL, Error>? = nil

    override private init() {
        super.init()
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue.main)
    }

    // MARK: - API Pública

    public func isTrackDownloaded(songId: String, trackName: String) -> Bool {
        OfflineStorageManager.shared.isTrackDownloaded(songId: songId, trackName: trackName)
    }

    public func isNormalizedDownloaded(songId: String, trackName: String) -> Bool {
        OfflineStorageManager.shared.isNormalizedDownloaded(songId: songId, trackName: trackName)
    }

    public func localURL(songId: String, trackName: String) -> URL? {
        OfflineStorageManager.shared.getTrackPath(songId: songId, trackName: trackName)
    }

    /// Descarga serialmente todos los stems de una canción respetando pausa de rendimiento.
    public func downloadAllTracks(for song: Song, onComplete: @escaping (Bool) -> Void) {
        let downloadable = song.tracks.filter {
            $0.name != "__PreviewMix" && !$0.url.isEmpty && $0.url != "undefined"
        }

        guard !downloadable.isEmpty else {
            onComplete(true)
            return
        }

        cancelDownload()

        DispatchQueue.main.async {
            self.isDownloading = true
            self.lastError = nil
            self.currentSongId = song.id
            self.totalTracks = downloadable.count
        }

        downloadTask = Task {
            var loaded = 0
            var hadError = false

            for (index, track) in downloadable.enumerated() {
                if Task.isCancelled { break }

                DispatchQueue.main.async {
                    self.currentTrackName = track.name
                    self.currentTrackIndex = index
                    self.progress = DownloadProgress(
                        songId: song.id,
                        trackName: track.name,
                        currentTrackIndex: index,
                        totalTracks: downloadable.count,
                        trackBytesLoaded: 0,
                        trackBytesTotal: 100
                    )
                }

                // Si ya está descargada y válida, omitir
                if isTrackDownloaded(songId: song.id, trackName: track.name) {
                    loaded += 1
                    try? await Task.sleep(nanoseconds: 15_000_000) // 15ms yield
                    continue
                }

                // Determinar formato (FLAC normalizado si está listo, sino MP3)
                let useFlac = track.normalizedReady && !(track.normalizedUrl?.isEmpty ?? true)
                let targetURLString: String
                let localDestURL: URL

                if useFlac, let normalizedUrl = track.normalizedUrl {
                    targetURLString = normalizedUrl
                    localDestURL = OfflineStorageManager.shared.trackURL(songId: song.id, trackName: track.name, extension: "flac")
                } else {
                    targetURLString = "\(proxyBase)/api/download?url=\(track.url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? track.url)"
                    localDestURL = OfflineStorageManager.shared.trackURL(songId: song.id, trackName: track.name, extension: "mp3")
                }

                // Descargar con hasta 2 reintentos automáticos
                var success = false
                for attempt in 1...3 {
                    if Task.isCancelled { break }
                    do {
                        let tempLocation = try await downloadFileWithProgress(from: targetURLString)
                        
                        // Mover al destino final
                        if FileManager.default.fileExists(atPath: localDestURL.path) {
                            try FileManager.default.removeItem(at: localDestURL)
                        }
                        try FileManager.default.moveItem(at: tempLocation, to: localDestURL)
                        
                        success = true
                        loaded += 1
                        break
                    } catch {
                        print("[DownloadManager] Reintento \(attempt)/3 para \(track.name): \(error.localizedDescription)")
                        try? await Task.sleep(nanoseconds: 500_000_000) // 500ms antes de reintentar
                    }
                }

                if !success {
                    hadError = true
                }

                // Pausa corta anti-RAM entre descargas (stagger)
                try? await Task.sleep(nanoseconds: 20_000_000) // 20ms yield
            }

            DispatchQueue.main.async {
                self.isDownloading = false
                self.progress = nil
                if hadError {
                    self.lastError = "Algunas pistas no se pudieron descargar."
                }
                onComplete(!hadError && !Task.isCancelled)
            }
        }
    }

    public func cancelDownload() {
        downloadTask?.cancel()
        downloadTask = nil
        if let cont = activeDownloadContinuation {
            activeDownloadContinuation = nil
            cont.resume(throwing: URLError(.cancelled))
        }
        DispatchQueue.main.async {
            self.isDownloading = false
            self.progress = nil
        }
    }

    public func deleteLocalTracks(songId: String) {
        OfflineStorageManager.shared.clearCacheForSong(songId: songId)
    }

    // MARK: - Descarga Asíncrona con URLSessionDelegate
    private func downloadFileWithProgress(from urlString: String) async throws -> URL {
        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.activeDownloadContinuation = continuation
            let task = self.session.downloadTask(with: url)
            task.resume()
        }
    }

    // MARK: - URLSessionDownloadDelegate
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // Copiar archivo temporal a una ubicación accesible antes de que URLSession lo elimine
        let tempDir = FileManager.default.temporaryDirectory
        let safeTemp = tempDir.appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.copyItem(at: location, to: safeTemp)
            activeDownloadContinuation?.resume(returning: safeTemp)
        } catch {
            activeDownloadContinuation?.resume(throwing: error)
        }
        activeDownloadContinuation = nil
    }

    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        DispatchQueue.main.async {
            self.progress = DownloadProgress(
                songId: self.currentSongId,
                trackName: self.currentTrackName,
                currentTrackIndex: self.currentTrackIndex,
                totalTracks: self.totalTracks,
                trackBytesLoaded: totalBytesWritten,
                trackBytesTotal: max(totalBytesWritten, totalBytesExpectedToWrite)
            )
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            activeDownloadContinuation?.resume(throwing: error)
            activeDownloadContinuation = nil
        }
    }
}
