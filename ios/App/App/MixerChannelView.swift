import SwiftUI

struct MixerChannelView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    var track: SongTrack
    
    var body: some View {
        VStack(spacing: 10) {
            // Track Name
            Text(track.name ?? "Track")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(Color.Zion.textPrimary)
                .lineLimit(1)
                .frame(height: 30)
            
            // Pan Knob Placeholder (Circle for now)
            VStack {
                Text("PAN")
                    .font(.system(size: 8))
                    .foregroundColor(Color.Zion.textSecondary)
                Circle()
                    .stroke(Color.Zion.textSecondary, lineWidth: 2)
                    .frame(width: 24, height: 24)
                    .overlay(
                        Rectangle()
                            .fill(Color.Zion.primaryCyan)
                            .frame(width: 2, height: 10)
                            .offset(y: -5)
                            .rotationEffect(.degrees(Double(engine.stemPans[track.id] ?? 0.0) * 90))
                    )
            }
            
            // Mute / Solo
            HStack(spacing: 8) {
                let isMuted = engine.mutedStems.contains(track.id)
                Button(action: {
                    engine.setTrackMute(id: track.id, muted: !isMuted)
                }) {
                    Text("M")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .frame(width: 28, height: 28)
                        .background(isMuted ? Color.Zion.dangerRed : Color.Zion.cardDark)
                        .foregroundColor(isMuted ? .white : Color.Zion.textSecondary)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.Zion.borderSubtleDark, lineWidth: 1))
                }
                
                let isSolo = engine.soloedStem == track.id
                Button(action: {
                    engine.setTrackSolo(id: track.id, solo: !isSolo)
                }) {
                    Text("S")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .frame(width: 28, height: 28)
                        .background(isSolo ? Color.Zion.warningYellow : Color.Zion.cardDark)
                        .foregroundColor(isSolo ? .black : Color.Zion.textSecondary)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.Zion.borderSubtleDark, lineWidth: 1))
                }
            }
            
            // Fader
            let volBinding = Binding<Float>(
                get: { self.engine.stemVolumes[track.id] ?? 1.0 },
                set: { self.engine.setTrackVolume(id: track.id, volume: $0) }
            )
            
            VerticalFader(value: volBinding, trackId: track.id)
                .padding(.vertical, 5)
                
            // VU Meter placeholder
            HStack(spacing: 2) {
                let level = engine.vuLevels[track.id] ?? -60
                let normalized = max(0, (level + 60) / 60) // 0.0 to 1.0
                
                Rectangle()
                    .fill(Color.green)
                    .frame(width: 4, height: 60)
                    .overlay(
                        Rectangle()
                            .fill(Color.Zion.backgroundDark)
                            .frame(width: 4, height: 60 * CGFloat(1 - normalized)),
                        alignment: .top
                    )
            }
            .frame(height: 60)
        }
        .padding(8)
        .frame(width: 100)
        .background(Color.Zion.cardDark)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.Zion.borderSubtleDark, lineWidth: 1))
    }
}
