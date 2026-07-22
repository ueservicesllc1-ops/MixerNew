//
//  ChordsView.swift
//  ZionStageApple
//
//  Vista de acordes con transposición automática sincronizada con el Pitch Shift del motor.
//  Replica la transposición de transposeKey() en Multitrack.jsx.
//

import SwiftUI

// MARK: - Transposición de tonalidad
private let chromatic = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
private let flatToSharp: [String: String] = [
    "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
]

private func transposeChordText(_ text: String, semitones: Int) -> String {
    guard semitones != 0 else { return text }

    // Regex para detectar acordes en texto
    // Patrones como: C, Cm, C#, C#m, Dm7, G/B, F#maj7, etc.
    let pattern = "\\b([A-G][b#]?)((?:m(?:aj)?|dim|aug|sus|add|maj)?\\d*(?:/[A-G][b#]?)?)\\b"

    guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
        return text
    }

    var result = text as NSString
    var offset = 0

    let matches = regex.matches(in: text, options: [], range: NSRange(text.startIndex..., in: text))

    for match in matches {
        let fullRange = NSRange(location: match.range.location + offset, length: match.range.length)
        guard let rootRange = Range(match.range(at: 1), in: text) else { continue }
        let root = String(text[rootRange])
        let normalized = flatToSharp[root] ?? root
        guard let idx = chromatic.firstIndex(of: normalized) else { continue }
        let newIdx = ((idx + semitones) % 12 + 12) % 12
        let newRoot = chromatic[newIdx]

        // Reemplazar solo la parte de la raíz del acorde
        let rootNSRange = NSRange(rootRange, in: text)
        let adjustedRange = NSRange(location: rootNSRange.location + offset, length: rootNSRange.length)
        result = result.replacingCharacters(in: adjustedRange, with: newRoot) as NSString
        offset += newRoot.count - root.count
    }

    return result as String
}

// MARK: - ChordsView
public struct ChordsView: View {
    @ObservedObject var player: ZionAudioPlayer
    public let chordsText: String?
    public let isLoading: Bool

    @State private var fontSize: CGFloat = 16
    @State private var autoScroll: Bool = true

    public init(player: ZionAudioPlayer, chordsText: String?, isLoading: Bool = false) {
        self.player = player
        self.chordsText = chordsText
        self.isLoading = isLoading
    }

    private var transposedText: String? {
        guard let text = chordsText else { return nil }
        let semitones = Int(player.pitchSemitones)
        return semitones == 0 ? text : transposeChordText(text, semitones: semitones)
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Barra de controles
            HStack(spacing: 16) {
                // Transposición activa
                if player.pitchSemitones != 0 {
                    HStack(spacing: 6) {
                        Image(systemName: "music.note.list")
                            .font(.system(size: 12))
                            .foregroundColor(.yellow)
                        Text("Transponiendo \(player.pitchSemitones > 0 ? "+" : "")\(Int(player.pitchSemitones)) st")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.yellow)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.yellow.opacity(0.1))
                    .cornerRadius(8)
                }

                Spacer()

                // Tamaño de fuente
                HStack(spacing: 8) {
                    Button(action: { fontSize = max(12, fontSize - 2) }) {
                        Image(systemName: "textformat.size.smaller")
                            .foregroundColor(.gray)
                    }
                    Text("\(Int(fontSize))")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.cyan)
                        .frame(width: 24)
                    Button(action: { fontSize = min(36, fontSize + 2) }) {
                        Image(systemName: "textformat.size.larger")
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(red: 0.08, green: 0.09, blue: 0.14))

            Divider().background(Color.cyan.opacity(0.2))

            // Contenido
            if isLoading {
                loadingView
            } else if let chords = transposedText, !chords.isEmpty {
                ScrollView {
                    Text(chords)
                        .font(.system(size: fontSize, design: .monospaced))
                        .foregroundColor(.white)
                        .lineSpacing(6)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                }
            } else {
                emptyView
            }
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
    }

    private var loadingView: some View {
        VStack {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
            Text("Cargando acordes...")
                .font(.caption)
                .foregroundColor(.gray)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "music.quarternote.3")
                .font(.system(size: 48))
                .foregroundColor(.gray.opacity(0.3))
            Text("No hay acordes disponibles para esta canción")
                .font(.subheadline)
                .foregroundColor(.gray)
            Text("Los acordes se agregan desde zionstage.com")
                .font(.caption)
                .foregroundColor(.gray.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
    }
}
