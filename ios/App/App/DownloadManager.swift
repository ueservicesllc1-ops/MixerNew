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
    
    // Helper to safely parse URLs containing unencoded spaces or special characters
    func getValidURL(from path: String) -> URL? {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed) {
            return url
        }
        if let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: encoded) {
            return url
        }
        return nil
    }
    
    // Stable filename based on SHA256 hash of URL path to guarantee length is well under the 255-character limit
    func getLocalFilename(for track: SongTrack) -> String {
        guard let data = track.path.data(using: .utf8) else {
            return "\(track.id).mp3"
        }
        let hash = SHA256.hash(data: data)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        
        let validURL = getValidURL(from: track.path)
        let ext = validURL?.pathExtension ?? "mp3"
        let fileExt = (ext.isEmpty || ext.count > 5) ? "mp3" : ext
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
            if activeTasks[path] != nil {
                completionHandlers[path, default: []].append(completion)
                return
            }
            
            completionHandlers[path] = [completion]
            
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                guard let self = self else { return }
                
                let success = self.perform3TierDownload(track: track, filename: filename)
                
                self.downloadQueue.sync {
                    self.activeTasks.removeValue(forKey: path)
                }
                
                self.executeCompletions(for: path, success: success)
            }
        }
    }
    
    private func perform3TierDownload(track: SongTrack, filename: String) -> Bool {
        let rawPath = track.path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawPath.isEmpty else { return false }
        
        let proxyBase = "https://mixernew-production.up.railway.app"
        let isB2Url = rawPath.contains("backblazeb2.com") || 
                      rawPath.contains("bcg.cloud") || 
                      rawPath.contains("b-cdn.net")
        
        // TIER 1: Try B2 Pre-Signed URL Fast Path (for B2 URLs)
        if isB2Url && !rawPath.contains("/api/download?") {
            if let encodedPath = rawPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
               let signedApiURL = URL(string: "\(proxyBase)/api/b2-signed-url?fileUrl=\(encodedPath)") {
                
                var signedReq = URLRequest(url: signedApiURL)
                signedReq.timeoutInterval = 8
                
                let semaphore = DispatchSemaphore(value: 0)
                var directDownloadURL: URL? = nil
                
                let signedTask = URLSession.shared.dataTask(with: signedReq) { [weak self] data, response, error in
                    defer { semaphore.signal() }
                    guard let self = self, let data = data, error == nil else { return }
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let signedUrlString = json["signedUrl"] as? String,
                       let validSignedURL = self.getValidURL(from: signedUrlString) {
                        directDownloadURL = validSignedURL
                    }
                }
                signedTask.resume()
                _ = semaphore.wait(timeout: .now() + 8.5)
                
                if let directURL = directDownloadURL {
                    print("[DownloadManager] TIER 1: Trying B2 Signed URL for \(track.name ?? "")")
                    if downloadFileToDisk(from: directURL, filename: filename) {
                        return true
                    }
                }
            }
        }
        
        // TIER 2: Railway Proxy Download Endpoint (Handles B2 auth & CORS/ISP relay)
        let proxiedPath = rawPath.contains("/api/download?url=") 
            ? rawPath 
            : "\(proxyBase)/api/download?url=\(rawPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? rawPath)"
        
        if let proxyURL = getValidURL(from: proxiedPath) {
            print("[DownloadManager] TIER 2: Trying Railway Proxy Download for \(track.name ?? "")")
            if downloadFileToDisk(from: proxyURL, filename: filename) {
                return true
            }
        }
        
        // TIER 3: Direct URL Download Fallback
        if let directURL = getValidURL(from: rawPath) {
            print("[DownloadManager] TIER 3: Trying Direct URL Download Fallback for \(track.name ?? "")")
            if downloadFileToDisk(from: directURL, filename: filename) {
                return true
            }
        }
        
        print("[DownloadManager] ERROR: All 3 download tiers failed for track \(track.name ?? "") (\(rawPath))")
        return false
    }
    
    private func downloadFileToDisk(from url: URL, filename: String) -> Bool {
        var request = URLRequest(url: url)
        request.timeoutInterval = 60
        request.setValue("ZionStage/1.0 (iOS)", forHTTPHeaderField: "User-Agent")
        
        let semaphore = DispatchSemaphore(value: 0)
        var success = false
        
        let task = URLSession.shared.downloadTask(with: request) { [weak self] tempLocalUrl, response, error in
            defer { semaphore.signal() }
            guard let self = self else { return }
            
            if let error = error {
                print("[DownloadManager] Network error downloading from \(url.host ?? ""): \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? -1
                print("[DownloadManager] HTTP status \(code) downloading from \(url.host ?? "")")
                return
            }
            
            guard let tempLocalUrl = tempLocalUrl else {
                print("[DownloadManager] Missing tempLocalUrl from \(url.host ?? "")")
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
                print("[DownloadManager] Successfully saved track file \(filename)")
            } catch {
                print("[DownloadManager] Error saving file to disk \(filename): \(error.localizedDescription)")
            }
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 65.0)
        
        return success
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
    
    // Download the entire setlist sequentially: one song at a time, and one track at a time.
    func downloadSetlist(setlist: Setlist) {
        guard let songs = setlist.songs, !songs.isEmpty else { return }
        
        func downloadSongNext(index: Int) {
            guard index < songs.count else {
                print("[DownloadManager] Completed downloading entire setlist!")
                return
            }
            
            let song = songs[index]
            guard let tracks = song.tracks, !tracks.isEmpty else {
                downloadSongNext(index: index + 1)
                return
            }
            
            let missing = tracks.filter { !isTrackDownloaded($0) }
            guard !missing.isEmpty else {
                // Song already fully cached, move to next song
                downloadSongNext(index: index + 1)
                return
            }
            
            DispatchQueue.main.async {
                self.downloadingSongIds.insert(song.id)
            }
            
            downloadAllTracks(for: tracks) { [weak self] success in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    self.downloadingSongIds.remove(song.id)
                }
                
                // Trigger the next song sequentially
                downloadSongNext(index: index + 1)
            }
        }
        
        // Start downloading from first song in setlist
        downloadSongNext(index: 0)
    }
    
    // Download tracks sequentially (one by one) inside the song to avoid network congestion
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
        
        func downloadTrackNext(index: Int) {
            guard index < missingTracks.count else {
                // Completed all tracks for this song
                DispatchQueue.main.async {
                    self.isDownloadingAll = false
                    completion(!hasError)
                }
                return
            }
            
            let track = missingTracks[index]
            downloadSingleTrack(track) { success in
                if !success {
                    hasError = true
                }
                completedCount += 1
                DispatchQueue.main.async {
                    self.overallProgress = Double(completedCount) / Double(totalCount)
                }
                
                // Trigger the next track sequentially
                downloadTrackNext(index: index + 1)
            }
        }
        
        // Start downloading the first track
        downloadTrackNext(index: 0)
    }
}
