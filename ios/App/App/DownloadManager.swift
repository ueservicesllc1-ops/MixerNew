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
    // Track which songs have both audio stems & cached waveform ready
    @Published var preloadedWaveformSongIds: Set<String> = []
    
    private let fileManager = FileManager.default
    
    // Documents directory survives app updates and is never purged by iOS under storage pressure.
    // We mark cached media with isExcludedFromBackup = true per Apple guidelines.
    private lazy var documentsURL: URL = {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }()
    
    private lazy var waveformsDirURL: URL = {
        let dir = documentsURL.appendingPathComponent("ZionWaveforms", isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
            excludeFromBackup(dir)
        }
        return dir
    }()
    
    private init() {
        loadDownloadedFiles()
        loadCachedWaveformIds()
    }
    
    private func excludeFromBackup(_ url: URL) {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? mutableURL.setResourceValues(values)
    }
    
    private func loadDownloadedFiles() {
        do {
            let files = try fileManager.contentsOfDirectory(atPath: documentsURL.path)
            for file in files {
                let fullURL = documentsURL.appendingPathComponent(file)
                var isDir: ObjCBool = false
                guard fileManager.fileExists(atPath: fullURL.path, isDirectory: &isDir), !isDir.boolValue else {
                    continue
                }
                // Validate file integrity: ignore 0-byte or tiny corrupted files
                if let attrs = try? fileManager.attributesOfItem(atPath: fullURL.path),
                   let size = attrs[.size] as? UInt64 {
                    if size > 1024 {
                        downloadedFiles.insert(file)
                        excludeFromBackup(fullURL)
                    } else if file.hasSuffix(".mp3") || file.hasSuffix(".wav") || file.hasSuffix(".flac") || file.hasSuffix(".m4a") {
                        // Clean up corrupted partial audio file so it will be re-downloaded
                        try? fileManager.removeItem(at: fullURL)
                    }
                }
            }
        } catch {
            print("[DownloadManager] Error loading local files: \(error)")
        }
    }
    
    private func loadCachedWaveformIds() {
        if let files = try? fileManager.contentsOfDirectory(atPath: waveformsDirURL.path) {
            for file in files where file.hasSuffix(".json") {
                let songId = String(file.dropLast(5))
                preloadedWaveformSongIds.insert(songId)
            }
        }
    }
    
    // MARK: - Waveform Disk Cache (Persistent across app updates)
    private func waveformFileURL(for songId: String) -> URL {
        let safeId = songId.replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        return waveformsDirURL.appendingPathComponent("\(safeId).json")
    }
    
    func getCachedWaveform(for songId: String) -> [Float]? {
        let url = waveformFileURL(for: songId)
        guard let data = try? Data(contentsOf: url),
              let peaks = try? JSONDecoder().decode([Float].self, from: data),
              peaks.count >= 20 else {
            return nil
        }
        return peaks
    }
    
    func saveWaveform(_ peaks: [Float], for songId: String) {
        guard peaks.count >= 20 else { return }
        let url = waveformFileURL(for: songId)
        if let data = try? JSONEncoder().encode(peaks) {
            do {
                try data.write(to: url, options: .atomic)
                excludeFromBackup(url)
                DispatchQueue.main.async {
                    self.preloadedWaveformSongIds.insert(songId)
                }
            } catch {
                print("[DownloadManager] Error saving waveform cache for \(songId): \(error)")
            }
        }
    }
    
    func hasCachedWaveform(for songId: String) -> Bool {
        let url = waveformFileURL(for: songId)
        return fileManager.fileExists(atPath: url.path)
    }
    
    // MARK: - Thread-safe Download Deduplication & Preload Coordination
    private var inFlightPaths: Set<String> = []
    private var completionHandlers: [String: [(Bool) -> Void]] = [:]
    private let downloadQueue = DispatchQueue(label: "com.zionstage.downloadqueue")
    private let preloadQueue = DispatchQueue(label: "com.zionstage.preloadqueue", qos: .utility)
    private var preloadGeneration: Int = 0
    
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
    
    // Stable filename based on SHA256 hash of URL path (preserved identically across app updates!)
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
        if downloadedFiles.contains(filename) {
            return true
        }
        // Fallback disk check in case file was saved on another thread before @Published updated
        let url = documentsURL.appendingPathComponent(filename)
        if let attrs = try? fileManager.attributesOfItem(atPath: url.path),
           let size = attrs[.size] as? UInt64, size > 1024 {
            DispatchQueue.main.async {
                self.downloadedFiles.insert(filename)
            }
            return true
        }
        return false
    }
    
    func getLocalURL(for track: SongTrack) -> URL {
        let filename = getLocalFilename(for: track)
        return documentsURL.appendingPathComponent(filename)
    }
    
    func isSongDownloaded(_ song: Song) -> Bool {
        guard let tracks = song.tracks, !tracks.isEmpty else { return false }
        return tracks.allSatisfy { isTrackDownloaded($0) }
    }
    
    func removeCorruptTrack(_ track: SongTrack) {
        let filename = getLocalFilename(for: track)
        let url = documentsURL.appendingPathComponent(filename)
        try? fileManager.removeItem(at: url)
        DispatchQueue.main.async {
            self.downloadedFiles.remove(filename)
        }
    }
    
    // MARK: - Single Track Download (Deduplicated)
    func downloadSingleTrack(_ track: SongTrack, completion: @escaping (Bool) -> Void) {
        let path = track.path
        let filename = getLocalFilename(for: track)
        
        if isTrackDownloaded(track) {
            completion(true)
            return
        }
        
        var shouldStart = false
        downloadQueue.sync {
            if inFlightPaths.contains(path) {
                completionHandlers[path, default: []].append(completion)
                shouldStart = false
            } else {
                inFlightPaths.insert(path)
                completionHandlers[path] = [completion]
                shouldStart = true
            }
        }
        
        guard shouldStart else { return }
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            
            let success = self.perform3TierDownload(track: track, filename: filename)
            
            self.downloadQueue.sync {
                self.inFlightPaths.remove(path)
            }
            
            self.executeCompletions(for: path, success: success)
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
                
                let signedTask = URLSession.shared.dataTask(with: signedReq) { [weak self] data, _, error in
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
            if downloadFileToDisk(from: proxyURL, filename: filename) {
                return true
            }
        }
        
        // TIER 3: Direct URL Download Fallback
        if let directURL = getValidURL(from: rawPath) {
            if downloadFileToDisk(from: directURL, filename: filename) {
                return true
            }
        }
        
        print("[DownloadManager] ERROR: All 3 download tiers failed for track \(track.name ?? "")")
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
                print("[DownloadManager] Network error from \(url.host ?? ""): \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? -1
                print("[DownloadManager] HTTP status \(code) from \(url.host ?? "")")
                return
            }
            
            guard let tempLocalUrl = tempLocalUrl else { return }
            
            // Reject tiny/corrupt responses (e.g. HTML error page or empty body)
            if let attrs = try? self.fileManager.attributesOfItem(atPath: tempLocalUrl.path),
               let size = attrs[.size] as? UInt64, size < 1024 {
                print("[DownloadManager] Rejecting tiny file (\(size) bytes) for \(filename)")
                return
            }
            
            let finalUrl = self.documentsURL.appendingPathComponent(filename)
            
            do {
                if self.fileManager.fileExists(atPath: finalUrl.path) {
                    try self.fileManager.removeItem(at: finalUrl)
                }
                try self.fileManager.moveItem(at: tempLocalUrl, to: finalUrl)
                self.excludeFromBackup(finalUrl)
                
                DispatchQueue.main.async {
                    self.downloadedFiles.insert(filename)
                }
                success = true
            } catch {
                print("[DownloadManager] Error saving file \(filename): \(error.localizedDescription)")
            }
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 65.0)
        
        return success
    }
    
    private func executeCompletions(for path: String, success: Bool) {
        var handlers: [(Bool) -> Void] = []
        downloadQueue.sync {
            handlers = completionHandlers[path] ?? []
            completionHandlers.removeValue(forKey: path)
        }
        for handler in handlers {
            DispatchQueue.main.async {
                handler(success)
            }
        }
    }
    
    // MARK: - Parallel Track Download (Up to 3 concurrent stems for fast loading)
    func downloadAllTracks(for tracks: [SongTrack], maxConcurrent: Int = 3, completion: @escaping (Bool) -> Void) {
        let missingTracks = tracks.filter { !isTrackDownloaded($0) }
        guard !missingTracks.isEmpty else {
            DispatchQueue.main.async {
                completion(true)
            }
            return
        }
        
        DispatchQueue.main.async {
            self.isDownloadingAll = true
            self.overallProgress = 0.0
        }
        
        let totalCount = missingTracks.count
        let concurrencySemaphore = DispatchSemaphore(value: max(1, maxConcurrent))
        let group = DispatchGroup()
        let lock = NSLock()
        var completedCount = 0
        var hasError = false
        
        DispatchQueue.global(qos: .userInitiated).async {
            for track in missingTracks {
                concurrencySemaphore.wait()
                group.enter()
                self.downloadSingleTrack(track) { success in
                    lock.lock()
                    if !success { hasError = true }
                    completedCount += 1
                    let currentProgress = Double(completedCount) / Double(totalCount)
                    lock.unlock()
                    
                    DispatchQueue.main.async {
                        self.overallProgress = currentProgress
                    }
                    concurrencySemaphore.signal()
                    group.leave()
                }
            }
            
            group.notify(queue: .main) {
                self.isDownloadingAll = false
                completion(!hasError)
            }
        }
    }
    
    func downloadSongStems(song: Song) {
        guard let tracks = song.tracks, !tracks.isEmpty else { return }
        let missing = tracks.filter { !isTrackDownloaded($0) }
        if missing.isEmpty {
            // Stems already local; ensure real waveform is precomputed too
            if !hasCachedWaveform(for: song.id) {
                preloadQueue.async {
                    _ = AudioEngineViewModel.computeAndCacheWaveform(for: song)
                }
            }
            return
        }
        
        DispatchQueue.main.async {
            self.downloadingSongIds.insert(song.id)
        }
        
        downloadAllTracks(for: tracks, maxConcurrent: 2) { [weak self] _ in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.downloadingSongIds.remove(song.id)
            }
            if self.isSongDownloaded(song) && !self.hasCachedWaveform(for: song.id) {
                self.preloadQueue.async {
                    _ = AudioEngineViewModel.computeAndCacheWaveform(for: song)
                }
            }
        }
    }
    
    // MARK: - Continuous Setlist Background Preloader
    // Prioritizes the NEXT song after `currentSongId` so live song switching is instant!
    func downloadSetlist(setlist: Setlist, prioritizingAfter currentSongId: String? = nil) {
        guard let songs = setlist.songs, !songs.isEmpty else { return }
        
        // Reorder queue: start from song right after currentSongId, then remaining, then wrap around
        var orderedSongs: [Song] = songs
        if let curId = currentSongId, let idx = songs.firstIndex(where: { $0.id == curId }) {
            let after = Array(songs[(idx + 1)...])
            let before = Array(songs[..<idx])
            orderedSongs = after + before
        }
        
        preloadGeneration += 1
        let myGen = preloadGeneration
        
        preloadQueue.async { [weak self] in
            guard let self = self else { return }
            
            for song in orderedSongs {
                // Abort if a newer setlist/priority preload superseded this one
                if self.preloadGeneration != myGen { return }
                
                guard let tracks = song.tracks, !tracks.isEmpty else { continue }
                
                let missing = tracks.filter { !self.isTrackDownloaded($0) }
                if !missing.isEmpty {
                    DispatchQueue.main.async {
                        self.downloadingSongIds.insert(song.id)
                    }
                    
                    let songSem = DispatchSemaphore(value: 0)
                    self.downloadAllTracks(for: tracks, maxConcurrent: 2) { _ in
                        songSem.signal()
                    }
                    _ = songSem.wait(timeout: .now() + 600)
                    
                    DispatchQueue.main.async {
                        self.downloadingSongIds.remove(song.id)
                    }
                }
                
                if self.preloadGeneration != myGen { return }
                
                // Pre-compute and cache the real waveform peaks so switching to this song is instant
                if self.isSongDownloaded(song) && !self.hasCachedWaveform(for: song.id) {
                    _ = AudioEngineViewModel.computeAndCacheWaveform(for: song)
                }
            }
            
            print("[DownloadManager] Continuous setlist preload complete (gen \(myGen))!")
        }
    }
    
    // MARK: - Cache Management (for Settings)
    func getCacheSizeMB() -> Double {
        var totalBytes: UInt64 = 0
        if let enumerator = fileManager.enumerator(at: documentsURL, includingPropertiesForKeys: [.fileSizeKey]) {
            for case let fileURL as URL in enumerator {
                if let size = (try? fileURL.resourceValues(forKeys: [.fileSizeKey]))?.fileSize {
                    totalBytes += UInt64(size)
                }
            }
        }
        return Double(totalBytes) / (1024.0 * 1024.0)
    }
    
    func clearAudioCache() {
        do {
            let files = try fileManager.contentsOfDirectory(atPath: documentsURL.path)
            for file in files {
                if file.hasSuffix(".mp3") || file.hasSuffix(".wav") || file.hasSuffix(".flac") || file.hasSuffix(".m4a") {
                    try? fileManager.removeItem(at: documentsURL.appendingPathComponent(file))
                }
            }
            if let wfFiles = try? fileManager.contentsOfDirectory(atPath: waveformsDirURL.path) {
                for wf in wfFiles {
                    try? fileManager.removeItem(at: waveformsDirURL.appendingPathComponent(wf))
                }
            }
            DispatchQueue.main.async {
                self.downloadedFiles.removeAll()
                self.preloadedWaveformSongIds.removeAll()
            }
        } catch {
            print("[DownloadManager] Error clearing cache: \(error)")
        }
    }
}
