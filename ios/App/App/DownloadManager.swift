import Foundation

class DownloadManager: ObservableObject {
    static let shared = DownloadManager()
    
    @Published var downloadedFiles: Set<String> = []
    @Published var downloadProgress: [String: Double] = [:]
    @Published var isDownloadingAll: Bool = false
    @Published var overallProgress: Double = 0.0
    
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
    
    func getLocalFilename(for track: SongTrack) -> String {
        guard let url = URL(string: track.path) else { return "\(track.id).mp3" }
        let ext = url.pathExtension.isEmpty ? "mp3" : url.pathExtension
        return "\(track.id).\(ext)"
    }
    
    func isTrackDownloaded(_ track: SongTrack) -> Bool {
        let filename = getLocalFilename(for: track)
        let fileURL = documentsURL.appendingPathComponent(filename)
        return fileManager.fileExists(atPath: fileURL.path)
    }
    
    func getLocalURL(for track: SongTrack) -> URL {
        let filename = getLocalFilename(for: track)
        return documentsURL.appendingPathComponent(filename)
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
            guard let url = URL(string: track.path) else { continue }
            let filename = getLocalFilename(for: track)
            
            group.enter()
            
            let task = URLSession.shared.downloadTask(with: url) { [weak self] tempLocalUrl, response, error in
                guard let self = self else {
                    group.leave()
                    return
                }
                
                if let error = error {
                    print("Error downloading track \(track.name ?? ""): \(error)")
                    hasError = true
                    group.leave()
                    return
                }
                
                guard let tempLocalUrl = tempLocalUrl else {
                    hasError = true
                    group.leave()
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
                        completedCount += 1
                        self.overallProgress = Double(completedCount) / Double(totalCount)
                    }
                } catch {
                    print("Error saving track file \(filename): \(error)")
                    hasError = true
                }
                
                group.leave()
            }
            task.resume()
        }
        
        group.notify(queue: .main) {
            self.isDownloadingAll = false
            completion(!hasError)
        }
    }
}
