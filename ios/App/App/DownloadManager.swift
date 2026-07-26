import Foundation
import CryptoKit

class DownloadManager: ObservableObject {
    static let shared = DownloadManager()
    
    @Published var downloadedFiles: Set<String> = []
    @Published var downloadProgress: [String: Double] = [:]
    @Published var isDownloadingAll: Bool = false
    @Published var overallProgress: Double = 0.0
    
    // Track which songs are currently downloading in the background
    @Published var downloadingSongIds: Set<String> = []
    
    private let fileManager = FileManager.default
    private lazy var documentsURL: URL = {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }()
    
    private init() {
        loadDownloadedFiles()
    }
    
    private func loadDownloadedFiles() {
        do {
            let files = try fileManager.contentsOfDirectory(atPath: documentsURL.path)
            for file in files {
                downloadedFiles.insert(file)
            }
        } catch {
            print("Error loading local files: \(error)")
        }
    }
    
    private var activeTasks: [String: URLSessionDownloadTask] = [:]
    private var completionHandlers: [String: [(Bool) -> Void]] = [:]
    private let downloadQueue = DispatchQueue(label: "com.zionstage.downloadqueue")
    
    // Stable filename based on SHA256 hash of URL path to guarantee length is well under the 255-character limit
    func getLocalFilename(for track: SongTrack) -> String {
        guard let data = track.path.data(using: .utf8) else {
            // Fallback to sanitized basic ID if encoding fails
            return "\(track.id).mp3"
        }
        let hash = SHA256.hash(data: data)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        
        let ext = URL(string: track.path)?.pathExtension ?? "mp3"
        let fileExt = ext.isEmpty ? "mp3" : ext
        return "\(hashString).\(fileExt)"
    }
    
    func isTrackDownloaded(_ track: SongTrack) -> Bool {
        let filename = getLocalFilename(for: track)
        return downloadedFiles.contains(filename)
    }
    
    func getLocalURL(for track: SongTrack) -> URL {
        let filename = getLocalFilename(for: track)
        return documentsURL.appendingPathComponent(filename)
    }
    
    func isSongDownloaded(_ song: Song) -> Bool {
        guard let tracks = song.tracks, !tracks.isEmpty else { return false }
        return tracks.allSatisfy { isTrackDownloaded($0) }
    }
    
    func downloadSingleTrack(_ track: SongTrack, completion: @escaping (Bool) -> Void) {
        let path = track.path
        let filename = getLocalFilename(for: track)
        
        if isTrackDownloaded(track) {
            completion(true)
            return
        }
        
        downloadQueue.sync {
            // If already downloading this URL, append the completion handler and return
            if activeTasks[path] != nil {
                completionHandlers[path, default: []].append(completion)
                return
            }
            
            // Register first completion handler
            completionHandlers[path] = [completion]
            
            guard let url = URL(string: path) else {
                executeCompletions(for: path, success: false)
                return
            }
            
            let task = URLSession.shared.downloadTask(with: url) { [weak self] tempLocalUrl, response, error in
                guard let self = self else { return }
                
                var success = false
                defer {
                    self.downloadQueue.sync {
                        self.activeTasks.removeValue(forKey: path)
                    }
                    self.executeCompletions(for: path, success: success)
                }
                
                if error != nil {
                    return
                }
                
                guard let tempLocalUrl = tempLocalUrl else {
                    return
                }
                
                let finalUrl = self.documentsURL.appendingPathComponent(filename)
                
                do {
                    if self.fileManager.fileExists(atPath: finalUrl.path) {
                        try self.fileManager.removeItem(at: finalUrl)
                    }
                    try self.fileManager.moveItem(at: tempLocalUrl, to: finalUrl)
                    
                    DispatchQueue.main.async {
                        self.downloadedFiles.insert(filename)
                    }
                    success = true
                } catch {
                    print("Error saving track file \(filename): \(error)")
                }
            }
            
            activeTasks[path] = task
            task.resume()
        }
    }
    
    private func executeCompletions(for path: String, success: Bool) {
        downloadQueue.sync {
            if let handlers = completionHandlers[path] {
                for handler in handlers {
                    DispatchQueue.main.async {
                        handler(success)
                    }
                }
                completionHandlers.removeValue(forKey: path)
            }
        }
    }
    
    func downloadSongStems(song: Song) {
        guard let tracks = song.tracks, !tracks.isEmpty else { return }
        let missing = tracks.filter { !isTrackDownloaded($0) }
        guard !missing.isEmpty else { return }
        
        DispatchQueue.main.async {
            self.downloadingSongIds.insert(song.id)
        }
        
        downloadAllTracks(for: tracks) { [weak self] success in
            DispatchQueue.main.async {
                self?.downloadingSongIds.remove(song.id)
            }
        }
    }
    
    func downloadSetlist(setlist: Setlist) {
        guard let songs = setlist.songs else { return }
        for song in songs {
            downloadSongStems(song: song)
        }
    }
    
    func downloadAllTracks(for tracks: [SongTrack], completion: @escaping (Bool) -> Void) {
        let missingTracks = tracks.filter { !isTrackDownloaded($0) }
        guard !missingTracks.isEmpty else {
            completion(true)
            return
        }
        
        DispatchQueue.main.async {
            self.isDownloadingAll = true
            self.overallProgress = 0.0
        }
        
        let totalCount = missingTracks.count
        var completedCount = 0
        var hasError = false
        
        let group = DispatchGroup()
        
        for track in missingTracks {
            group.enter()
            downloadSingleTrack(track) { success in
                if !success {
                    hasError = true
                }
                completedCount += 1
                DispatchQueue.main.async {
                    self.overallProgress = Double(completedCount) / Double(totalCount)
                }
                group.leave()
            }
        }
        
        group.notify(queue: .main) {
            self.isDownloadingAll = false
            completion(!hasError)
        }
    }
}
