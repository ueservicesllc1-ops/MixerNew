//
//  TransposerService.swift
//  ZionStageApple
//
//  Servicio de transposición musical cromática para tonalidades y letras con acordes.
//  Replica el algoritmo de transposer.js de la versión Web/Android.
//

import Foundation

public class TransposerService {
    public static let shared = TransposerService()

    private let chromaticSharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    private let flatToSharp: [String: String] = [
        "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
    ]

    private init() {}

    /// Transpone una tonalidad individual (ej: "G", "Am", "F#m") por una cantidad de semitonos (-12 a +12).
    public func transposeKey(_ baseKey: String?, semitones: Float) -> String {
        guard let baseKey = baseKey, !baseKey.isEmpty else { return "-" }
        let semitoneShift = Int(round(semitones))
        if semitoneShift == 0 { return baseKey }

        let isMinor = baseKey.hasSuffix("m")
        let root = isMinor ? String(baseKey.dropLast()) : baseKey
        let normalized = flatToSharp[root] ?? root

        guard let idx = chromaticSharp.firstIndex(of: normalized) else {
            return baseKey
        }

        let newIdx = ((idx + semitoneShift) % 12 + 12) % 12
        return chromaticSharp[newIdx] + (isMinor ? "m" : "")
    }

    /// Transpone una cadena completa de texto con acordes (ej: letras con acordes en formato bracket o texto plano).
    public func transposeChordsText(_ text: String, semitones: Float) -> String {
        let shift = Int(round(semitones))
        if shift == 0 { return text }

        // Regex para detectar acordes comunes: A-G seguido opcionalmente de #, b, m, maj, min, 7, 9, sus, etc.
        let pattern = "\\b[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*\\b"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return text
        }

        let nsText = text as NSString
        let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: nsText.length))

        var result = text
        for match in matches.reversed() {
            let chordStr = nsText.substring(with: match.range)
            let transposedChord = transposeSingleChord(chordStr, shift: shift)
            if let range = Range(match.range, in: result) {
                result.replaceSubrange(range, with: transposedChord)
            }
        }
        return result
    }

    private func transposeSingleChord(_ chord: String, shift: Int) -> String {
        guard !chord.isEmpty else { return chord }
        let isMinor = chord.contains("m") && !chord.contains("maj")
        
        // Extraer la nota raíz del acorde
        var root = String(chord.prefix(1))
        if chord.count > 1 {
            let secondChar = String(chord[chord.index(chord.startIndex, offsetBy: 1)])
            if secondChar == "#" || secondChar == "b" {
                root += secondChar
            }
        }

        let suffix = String(chord.dropFirst(root.count))
        let normalized = flatToSharp[root] ?? root

        guard let idx = chromaticSharp.firstIndex(of: normalized) else {
            return chord
        }

        let newIdx = ((idx + shift) % 12 + 12) % 12
        return chromaticSharp[newIdx] + suffix
    }
}
