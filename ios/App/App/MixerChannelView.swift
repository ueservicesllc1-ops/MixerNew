import SwiftUI

struct MixerChannelView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var themeManager = ThemeManager.shared
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
            
            // M (Mute) / S (Solo) Buttons & Stereo Routing Tag
            HStack(spacing: 10) {
                // M Button
                let isMuted = engine.mutedStems.contains(track.id)
                Button(action: {
                    engine.setTrackMute(id: track.id, muted: !isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 14, weight: .black))
                        .frame(width: 54, height: 34)
                        .background(isMuted ? Color.zionRed : Color.zionPanelLight)
                        .foregroundColor(isMuted ? .white : Color.zionTextSecondary)
                        .cornerRadius(6)
                }
                
                // S Button
                let isSolo = engine.soloedStem == track.id
                Button(action: {
                    engine.setTrackSolo(id: track.id, solo: !isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 14, weight: .black))
                        .frame(width: 54, height: 34)
                        .background(isSolo ? Color.zionYellow : Color.zionPanelLight)
                        .foregroundColor(isSolo ? .black : Color.zionTextSecondary)
                        .cornerRadius(6)
                }
            }
            
            // Stereo Position Tag
            Text(isClickGuide ? "Canal R (Derecha)" : "Canal L (Izquierda)")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(isClickGuide ? Color.zionRed : Color.zionCyan)
        }
        .padding(8)
        .frame(width: 150)
        .background(Color.zionPanel)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.zionBorderSubtle, lineWidth: 1))
    }
}
