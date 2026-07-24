import SwiftUI

struct MixerChannelView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    var track: SongTrack
    
    // Determine color based on track name (hacky mapping for demo, usually passed down)
    var trackColor: Color {
        let n = (track.name ?? "").lowercased()
        if n.contains("click") || n.contains("cues") || n.contains("guitarra") { return Color.zionTrackOrange }
        if n.contains("bateria") || n.contains("coros") || n.contains("piano") || n.contains("sint") { return Color.zionTrackCyan }
        if n.contains("bajo") || n.contains("pads") { return Color.zionTrackPurple }
        return Color.zionTrackCyan
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
            
            // Mute / Solo Buttons
            HStack(spacing: 4) {
                let isMuted = engine.mutedStems.contains(track.id)
                Button(action: {
                    engine.setTrackMute(id: track.id, muted: !isMuted)
                }) {
                    Text("M")
                        .font(.system(size: 12, weight: .bold))
                        .frame(width: 32, height: 28)
                        .background(isMuted ? Color.zionRed : Color.zionPanelLight)
                        .foregroundColor(isMuted ? .white : Color.zionTextSecondary)
                        .cornerRadius(4)
                }
                
                let isSolo = engine.soloedStem == track.id
                Button(action: {
                    engine.setTrackSolo(id: track.id, solo: !isSolo)
                }) {
                    Text("S")
                        .font(.system(size: 12, weight: .bold))
                        .frame(width: 32, height: 28)
                        .background(isSolo ? Color.zionYellow : Color.zionPanelLight)
                        .foregroundColor(isSolo ? .black : Color.zionTextSecondary)
                        .cornerRadius(4)
                }
            }
        }
        .padding(8)
        .frame(width: 100)
        .background(Color.zionPanel)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.zionBorderSubtle, lineWidth: 1))
    }
}
