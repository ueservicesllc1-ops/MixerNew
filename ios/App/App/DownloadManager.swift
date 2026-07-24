import Foundation

class DownloadManager: ObservableObject {
    static let shared = DownloadManager()
    
    @Published var downloadedFiles: Set<String> = []
    @Published var downloadProgress: [String: Double] = [:]
    
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
    
    func isDownloaded(filename: String) -> Bool {
        return downloadedFiles.contains(filename)
    }
    
    func getLocalURL(for filename: String) -> URL {
        return documentsURL.appendingPathComponent(filename)
    }
    
    func download(url: URL, filename: String) {
        if isDownloaded(filename: filename) { return }
        
        DispatchQueue.main.async {
            self.downloadProgress[filename] = 0.01
        }
        
        let task = URLSession.shared.downloadTask(with: url) { [weak self] tempLocalUrl, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("Error downloading \(filename): \(error)")
                DispatchQueue.main.async {
                    self.downloadProgress.removeValue(forKey: filename)
                }
                return
            }
            
            guard let tempLocalUrl = tempLocalUrl else { return }
            
            let finalUrl = self.documentsURL.appendingPathComponent(filename)
            
            do {
                if self.fileManager.fileExists(atPath: finalUrl.path) {
                    try self.fileManager.removeItem(at: finalUrl)
                }
                try self.fileManager.moveItem(at: tempLocalUrl, to: finalUrl)
                
                DispatchQueue.main.async {
                    self.downloadedFiles.insert(filename)
                    self.downloadProgress.removeValue(forKey: filename)
                }
            } catch {
                print("Error saving file \(filename): \(error)")
            }
        }
        
        task.resume()
    }
}
