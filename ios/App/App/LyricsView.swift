import SwiftUI

struct LyricsView: View {
    enum DisplayMode { case lyrics, chords }
    var mode: DisplayMode = .lyrics
    
    @ObservedObject var engine = AudioEngineViewModel.shared
    @State private var lyricsText: String = ""
    @State private var chordsText: String = ""
    @State private var isLoading: Bool = false
    @AppStorage("zion_lyrics_font_size") private var fontSize: Double = 18.0
    
    private let dataStore = DataStore()
    
    private static let sharpScale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    private static let flatToSharp: [String: String] = [
        "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
    ]
    
    private func transposeNote(_ note: String, semitones: Int) -> String {
        let normalized = Self.flatToSharp[note] ?? note
        guard let idx = Self.sharpScale.firstIndex(of: normalized) else { return note }
        let newIdx = (idx + semitones + 120) % 12
        return Self.sharpScale[newIdx]
    }
    
    private func transposeChordToken(_ token: String, semitones: Int) -> String {
        guard semitones != 0 else { return token }
        // Match chord like C, F#m7, Bbmaj7, G/B, Dsus4, Am7/G
        let pattern = "^([A-G][#b]?)(m|min|maj|dim|aug|sus|add|[0-9])*(\\/([A-G][#b]?))?$"
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: token, range: NSRange(token.startIndex..., in: token)) else {
            return token
        }
        
        var result = token
        // Transpose bass note after slash first (so ranges don't shift)
        if match.range(at: 4).location != NSNotFound,
           let bassRange = Range(match.range(at: 4), in: result) {
            let bass = String(result[bassRange])
            result.replaceSubrange(bassRange, with: transposeNote(bass, semitones: semitones))
        }
        // Transpose root note
        if match.range(at: 1).location != NSNotFound,
           let rootRange = Range(match.range(at: 1), in: result) {
            let root = String(result[rootRange])
            result.replaceSubrange(rootRange, with: transposeNote(root, semitones: semitones))
        }
        return result
    }
    
    private func transposeText(_ text: String, semitones: Int) -> String {
        guard semitones != 0 else { return text }
        
        // 1. Transpose bracketed chords like [G], [Em7], [C/E]
        var output = text
        if let bracketRegex = try? NSRegularExpression(pattern: "\\[([A-G][#b]?[^\\]\\s]*)\\]") {
            let nsText = output as NSString
            let matches = bracketRegex.matches(in: output, range: NSRange(location: 0, length: nsText.length))
            for m in matches.reversed() {
                guard m.range(at: 1).location != NSNotFound,
                      let innerRange = Range(m.range(at: 1), in: output) else { continue }
                let chord = String(output[innerRange])
                let transposed = transposeChordToken(chord, semitones: semitones)
                output.replaceSubrange(innerRange, with: transposed)
            }
        }
        
        // 2. Transpose chord-only lines (e.g. "C   G/B   Am7   F")
        let lines = output.components(separatedBy: "\n")
        let processedLines = lines.map { line -> String in
            let tokens = line.split(whereSeparator: { $0.isWhitespace }).map(String.init)
            guard !tokens.isEmpty else { return line }
            let chordMatches = tokens.filter { transposeChordToken($0, semitones: semitones) != $0 || (Self.sharpScale.contains($0) || Self.flatToSharp[$0] != nil) }
            // Treat as a chord line if at least 60% of tokens are chords
            if Double(chordMatches.count) / Double(tokens.count) >= 0.6 {
                var newLine = ""
                var currentToken = ""
                for ch in line {
                    if ch.isWhitespace {
                        if !currentToken.isEmpty {
                            newLine += transposeChordToken(currentToken, semitones: semitones)
                            currentToken = ""
                        }
                        newLine.append(ch)
                    } else {
                        currentToken.append(ch)
                    }
                }
                if !currentToken.isEmpty {
                    newLine += transposeChordToken(currentToken, semitones: semitones)
                }
                return newLine
            }
            return line
        }
        return processedLines.joined(separator: "\n")
    }
    
    var displayText: String {
        if isLoading { return "Cargando..." }
        let semitones = Int(round(engine.pitchSemitones))
        if mode == .chords {
            let raw = chordsText.isEmpty ? (lyricsText.isEmpty ? "No hay acordes disponibles para esta canción" : lyricsText) : chordsText
            return transposeText(raw, semitones: semitones)
        } else {
            return lyricsText.isEmpty ? "No hay letra disponible para esta canción" : lyricsText
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 10) {
                Text(mode == .chords ? "🎸 Acordes" : "🎤 Teleprompter / Letra")
                    .font(.headline.bold())
                    .foregroundColor(Color.zionTextPrimary)
                
                if mode == .chords {
                    let shift = Int(round(engine.pitchSemitones))
                    if shift != 0 {
                        Text(shift > 0 ? "Transpuesto +\(shift)" : "Transpuesto \(shift)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.zionCyan)
                            .cornerRadius(4)
                    }
                }
                
                Spacer()
                
                // Font size controls (matching Android/Web default 18pt)
                HStack(spacing: 6) {
                    Button(action: { fontSize = max(12, fontSize - 2) }) {
                        Text("A-")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.zionCyan)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.zionPanelLight)
                            .cornerRadius(5)
                    }
                    Text("\(Int(fontSize))")
                        .font(.system(size: 11, weight: .bold).monospacedDigit())
                        .foregroundColor(Color.zionTextSecondary)
                    Button(action: { fontSize = min(36, fontSize + 2) }) {
                        Text("A+")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.zionCyan)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.zionPanelLight)
                            .cornerRadius(5)
                    }
                }
                
                if let current = engine.currentSong {
                    Text(current.name)
                        .font(.subheadline.bold())
                        .foregroundColor(Color.zionCyan)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.zionPanel)
            
            ScrollView {
                Text(displayText)
                    .font(.system(size: CGFloat(fontSize), weight: .bold, design: mode == .chords ? .monospaced : .default))
                    .foregroundColor(.white)
                    .multilineTextAlignment(mode == .chords ? .leading : .center)
                    .frame(maxWidth: .infinity, alignment: mode == .chords ? .leading : .center)
                    .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.zionBackground)
        .onAppear {
            loadLyrics()
        }
        .onChange(of: engine.currentSong?.id) { _ in
            loadLyrics()
        }
    }
    
    private func loadLyrics() {
        guard let songId = engine.currentSong?.id else {
            lyricsText = "Selecciona una canción del repertorio"
            chordsText = ""
            return
        }
        isLoading = true
        dataStore.fetchLyrics(for: songId) { lyrics, chords in
            DispatchQueue.main.async {
                self.isLoading = false
                self.lyricsText = lyrics ?? ""
                self.chordsText = chords ?? ""
            }
        }
    }
}
