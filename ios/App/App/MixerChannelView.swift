import SwiftUI

struct MixerChannelView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    var track: SongTrack
    
    var isClickGuide: Bool {
        let n = (track.name ?? "").lowercased()
        return n.contains("click") || n.contains("cue") || n.contains("guide") || n.contains("guia")
    }
    
    // Determine color based on track name matching React Mixer.jsx
    var trackColor: Color {
        let n = (track.name ?? "").lowercased()
        if isClickGuide { return Color(red: 0.73, green: 0.11, blue: 0.11) } // Rojo #b91c1c
        if n.contains("bat") || n.contains("drum") || n.contains("perc") { return Color(red: 0.0, green: 0.74, blue: 0.83) } // #00bcd4
        if n.contains("guit") || n.contains("git") { return Color(red: 1.0, green: 0.69, blue: 0.26) } // #ffb142
        if n.contains("vox") || n.contains("voz") { return Color(red: 0.20, green: 0.67, blue: 0.88) } // #34ace0
        if n.contains("bass") || n.contains("bajo") { return Color(red: 0.44, green: 0.44, blue: 0.83) } // #706fd3
        return Color(red: 0.0, green: 0.82, blue: 0.83) // #00d2d3
    }
    
    var body: some View {
        VStack(alignment: .center, spacing: 12) {
            
            // Header: Colored dot + Name
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(trackColor)
                    .frame(width: 12, height: 8)
                
                Text((track.name ?? "TRACK").uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color.zionTextPrimary)
                    .lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, 6)
            
            // Fader Area with Decibel text
            HStack(spacing: 8) {
                // dB Scale
                VStack {
                    Text("+6").font(.system(size: 8))
                    Spacer()
                    Text("0").font(.system(size: 8)).foregroundColor(trackColor)
                    Spacer()
                    Text("-5").font(.system(size: 8))
                    Spacer()
                    Text("-10").font(.system(size: 8))
                    Spacer()
                    Text("-20").font(.system(size: 8))
                    Spacer()
                    Text("-40").font(.system(size: 8))
                    Spacer()
                    Text("-∞").font(.system(size: 8))
                }
                .foregroundColor(Color.zionTextSecondary)
                .frame(height: 180)
                
                let volBinding = Binding<Float>(
                    get: { self.engine.stemVolumes[track.id] ?? 1.0 },
                    set: { self.engine.setTrackVolume(id: track.id, volume: $0) }
                )
                
                VerticalFader(value: volBinding, trackId: track.id, trackColor: trackColor)
                    .frame(height: 180)
            }
            
            // L / M / S / R Buttons
            HStack(spacing: 4) {
                let currentPan: Float = engine.stemPans[track.id] ?? (isClickGuide ? Float(-1.0) : Float(0.0))
                let isL = currentPan <= Float(0.1)
                let isR = currentPan >= Float(-0.1)
                
                // L Button
                Button(action: {
                    let nextPan: Float = isL ? (isR ? Float(1.0) : Float(0.0)) : (isR ? Float(-1.0) : Float(-1.0))
                    engine.setTrackPan(id: track.id, pan: nextPan)
                }) {
                    Text("L")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 25, height: 26)
                        .background(isL ? Color.zionCyan : Color.zionPanelLight)
                        .foregroundColor(isL ? .black : Color.zionTextSecondary)
                        .cornerRadius(4)
                }
                
                // M Button
                let isMuted = engine.mutedStems.contains(track.id)
                Button(action: {
                    engine.setTrackMute(id: track.id, muted: !isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 25, height: 26)
                        .background(isMuted ? Color.zionRed : Color.zionPanelLight)
                        .foregroundColor(isMuted ? .white : Color.zionTextSecondary)
                        .cornerRadius(4)
                }
                
                // S Button
                let isSolo = engine.soloedStem == track.id
                Button(action: {
                    engine.setTrackSolo(id: track.id, solo: !isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 25, height: 26)
                        .background(isSolo ? Color.zionYellow : Color.zionPanelLight)
                        .foregroundColor(isSolo ? .black : Color.zionTextSecondary)
                        .cornerRadius(4)
                }
                
                // R Button
                Button(action: {
                    let nextPan: Float = isR ? (isL ? Float(-1.0) : Float(0.0)) : (isL ? Float(1.0) : Float(1.0))
                    engine.setTrackPan(id: track.id, pan: nextPan)
                }) {
                    Text("R")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 25, height: 26)
                        .background(isR ? Color.zionCyan : Color.zionPanelLight)
                        .foregroundColor(isR ? .black : Color.zionTextSecondary)
                        .cornerRadius(4)
                }
            }
        }
        .padding(8)
        .frame(width: 120)
        .background(Color.zionPanel)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.zionBorderSubtle, lineWidth: 1))
    }
}
