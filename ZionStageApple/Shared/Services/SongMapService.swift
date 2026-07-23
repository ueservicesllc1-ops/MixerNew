//
//  SongMapService.swift
//  ZionStageApple
//
//  Servicio Beat Grid & Song Map en Swift nativo.
//  Replica exacta de SongMapService.js para cálculo de compás (Bar), pulso (Beat) y tiempo.
//

import Foundation

public struct BarBeatPosition {
    public let bar: Int
    public let beat: Int
    public let fraction: Double
}

public struct SongMap {
    public let bpm: Double
    public let timeSignature: String // "4/4", "3/4", "6/8"
    public let firstDownbeatOffset: Double // Segundos del primer downbeat

    public var beatsPerBar: Int {
        switch timeSignature {
        case "3/4": return 3
        case "6/8": return 6
        default: return 4
        }
    }

    public var secondsPerBeat: Double {
        let b = bpm > 0 ? bpm : 120.0
        return 60.0 / b
    }

    public var secondsPerBar: Double {
        secondsPerBeat * Double(beatsPerBar)
    }

    public init(bpm: Double = 120.0, timeSignature: String = "4/4", firstDownbeatOffset: Double = 0.0) {
        self.bpm = bpm
        self.timeSignature = timeSignature
        self.firstDownbeatOffset = firstDownbeatOffset
    }
}

public class SongMapService {
    public static let shared = SongMapService()

    private init() {}

    /// Convierte tiempo en segundos a posición { bar, beat, fraction }
    public func secondsToBarBeat(positionSec: Double, map: SongMap) -> BarBeatPosition {
        let timeFromOffset = positionSec - map.firstDownbeatOffset

        if timeFromOffset < 0 {
            return BarBeatPosition(bar: 1, beat: 1, fraction: 0)
        }

        let totalBars = timeFromOffset / map.secondsPerBar
        let barNumber = Int(floor(totalBars)) + 1

        let remainingTimeInBar = timeFromOffset.truncatingRemainder(dividingBy: map.secondsPerBar)
        let totalBeatsInBar = remainingTimeInBar / map.secondsPerBeat
        let beatNumber = Int(floor(totalBeatsInBar)) + 1
        let fraction = totalBeatsInBar.truncatingRemainder(dividingBy: 1.0)

        return BarBeatPosition(bar: barNumber, beat: beatNumber, fraction: fraction)
    }

    /// Convierte posición { bar, beat } a tiempo en segundos
    public func barBeatToSeconds(bar: Int, beat: Int, map: SongMap) -> Double {
        let barOffset = Double(max(1, bar) - 1) * map.secondsPerBar
        let beatOffset = Double(max(1, beat) - 1) * map.secondsPerBeat
        return map.firstDownbeatOffset + barOffset + beatOffset
    }
}
