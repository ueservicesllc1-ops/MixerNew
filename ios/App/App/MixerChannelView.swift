import SwiftUI

struct MixerChannelView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var themeManager = ThemeManager.shared
    var track: SongTrack
    
    var isClickGuide: Bool {
        let n = (track.name ?? "").lowercased()
        return n.contains("click") || n.contains("cue") || n.contains("guide") || n.contains("guia")
    }
    
    @State private var customColorIndex: Int = -1
    
    let stagePresetColors: [Color] = [
        Color(hex: "#4a5568"), // Gris Claro
        Color(hex: "#ef4444"), // Rojo (Click/Cue)
        Color(hex: "#00bcd4"), // Cian
        Color(hex: "#f59e0b"), // Dorado
        Color(hex: "#673ab7"), // Púrpura
        Color(hex: "#ff7043")  // Naranja
    ]
    
    // Determine color: Red for Click/Cue, Light Gray for others by default, or user selected LED color
    var trackColor: Color {
        if customColorIndex >= 0 && customColorIndex < stagePresetColors.count {
            return stagePresetColors[customColorIndex]
        }
        if isClickGuide {
            return Color(hex: "#ef4444") // Rojo por defecto para Click / Cue
        }
        return Color(hex: "#4a5568") // Gris claro por defecto para los demás
    }
    
    var body: some View {
        VStack(alignment: .center, spacing: 12) {
            
            // Header: Tappable LED dot + Track Name
            HStack(spacing: 6) {
                Button(action: {
                    if customColorIndex == -1 {
                        customColorIndex = isClickGuide ? 0 : 2
                    } else {
                        customColorIndex = (customColorIndex + 1) % stagePresetColors.count
                    }
                }) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(trackColor)
                        .frame(width: 14, height: 10)
                        .overlay(RoundedRectangle(cornerRadius: 3).stroke(Color.white.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(PlainButtonStyle())
                
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
