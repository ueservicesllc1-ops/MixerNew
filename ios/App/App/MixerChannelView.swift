import SwiftUI

struct MixerChannelView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var themeManager = ThemeManager.shared
    var track: SongTrack
    var compact: Bool = false
    var faderHeight: CGFloat = 175
    
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
    
    var trackColor: Color {
        if customColorIndex >= 0 && customColorIndex < stagePresetColors.count {
            return stagePresetColors[customColorIndex]
        }
        if isClickGuide {
            return Color(hex: "#ef4444")
        }
        return Color(hex: "#00bcd4")
    }
    
    var body: some View {
        VStack(alignment: .center, spacing: compact ? 6 : 10) {
            
            // Header: Tappable LED dot + Track Name
            HStack(spacing: 4) {
                Button(action: {
                    if customColorIndex == -1 {
                        customColorIndex = isClickGuide ? 0 : 2
                    } else {
                        customColorIndex = (customColorIndex + 1) % stagePresetColors.count
                    }
                }) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(trackColor)
                        .frame(width: compact ? 11 : 14, height: compact ? 8 : 10)
                        .overlay(RoundedRectangle(cornerRadius: 3).stroke(Color.white.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(PlainButtonStyle())
                
                Text((track.name ?? "TRACK").uppercased())
                    .font(.system(size: compact ? 10 : 11, weight: .bold))
                    .foregroundColor(Color.zionTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 4)
            
            // Fader Area with Decibel text
            HStack(spacing: compact ? 4 : 6) {
                // dB Scale
                VStack {
                    Text("+6").font(.system(size: compact ? 7 : 8))
                    Spacer()
                    Text("0").font(.system(size: compact ? 7 : 8, weight: .bold)).foregroundColor(trackColor)
                    Spacer()
                    if !compact || faderHeight > 110 {
                        Text("-10").font(.system(size: compact ? 7 : 8))
                        Spacer()
                    }
                    Text("-20").font(.system(size: compact ? 7 : 8))
                    Spacer()
                    Text("-∞").font(.system(size: compact ? 7 : 8))
                }
                .foregroundColor(Color.zionTextSecondary)
                .frame(height: faderHeight)
                
                let volBinding = Binding<Float>(
                    get: { self.engine.stemVolumes[track.id] ?? 1.0 },
                    set: { self.engine.setTrackVolume(id: track.id, volume: $0) }
                )
                
                VerticalFader(value: volBinding, trackId: track.id, trackColor: trackColor, compact: compact)
                    .frame(height: faderHeight)
            }
            
            // M (Mute) / S (Solo) Buttons
            HStack(spacing: compact ? 6 : 8) {
                let isMuted = engine.mutedStems.contains(track.id)
                Button(action: {
                    engine.setTrackMute(id: track.id, muted: !isMuted)
                }) {
                    Text("M")
                        .font(.system(size: compact ? 12 : 13, weight: .black))
                        .frame(maxWidth: .infinity)
                        .frame(height: compact ? 26 : 32)
                        .background(isMuted ? Color.zionRed : Color.zionPanelLight)
                        .foregroundColor(isMuted ? .white : Color.zionTextSecondary)
                        .cornerRadius(5)
                }
                
                let isSolo = engine.soloedStem == track.id
                Button(action: {
                    engine.setTrackSolo(id: track.id, solo: !isSolo)
                }) {
                    Text("S")
                        .font(.system(size: compact ? 12 : 13, weight: .black))
                        .frame(maxWidth: .infinity)
                        .frame(height: compact ? 26 : 32)
                        .background(isSolo ? Color.zionYellow : Color.zionPanelLight)
                        .foregroundColor(isSolo ? .black : Color.zionTextSecondary)
                        .cornerRadius(5)
                }
            }
            
            // Stereo Position Tag
            Text(isClickGuide ? "Canal R (Der)" : "Canal L (Izq)")
                .font(.system(size: compact ? 8 : 9, weight: .bold))
                .foregroundColor(isClickGuide ? Color.zionRed : Color.zionCyan)
                .lineLimit(1)
        }
        .padding(compact ? 6 : 8)
        .frame(width: compact ? 98 : 136)
        .background(Color.zionPanel)
        .cornerRadius(10)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.zionBorderSubtle, lineWidth: 1))
    }
}
