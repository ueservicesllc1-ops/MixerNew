import SwiftUI

public struct PadEngineView: View {
    @ObservedObject var padPlayer: ZionPadPlayer = ZionPadPlayer.shared

    let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    public init() {}

    public var body: some View {
        VStack(spacing: 8) {
            // Status bar with Power ON/OFF Button
            HStack(spacing: 8) {
                // Power Toggle
                Button(action: {
                    if padPlayer.activeKey != nil {
                        padPlayer.stop()
                    } else {
                        padPlayer.start(key: "C")
                    }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "power")
                            .font(.system(size: 10, weight: .bold))
                        Text(padPlayer.activeKey != nil ? "OFF" : "POWER")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                    .background(padPlayer.activeKey != nil ? Color.zionRed : Color.zionCyan)
                    .foregroundColor(padPlayer.activeKey != nil ? .white : .black)
                    .cornerRadius(6)
                }
                
                if let activeKey = padPlayer.activeKey {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.zionCyan)
                            .frame(width: 6, height: 6)
                            .shadow(color: .cyan, radius: 4)
                        Text("Sonando: \(activeKey)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color.zionCyan)
                    }
                } else {
                    Text("Pads Ambientales")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                }
                
                Spacer()
                
                // Octave Selector (-1, 0, +1)
                HStack(spacing: 4) {
                    Button(action: { padPlayer.setOctave(-1) }) {
                        Text("-1")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(padPlayer.pitchOffset == -1 ? .black : Color.zionTextSecondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(padPlayer.pitchOffset == -1 ? Color.zionCyan : Color.zionPanelLight)
                            .cornerRadius(4)
                    }
                    Button(action: { padPlayer.setOctave(0) }) {
                        Text("0")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(padPlayer.pitchOffset == 0 ? .black : Color.zionTextSecondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(padPlayer.pitchOffset == 0 ? Color.zionCyan : Color.zionPanelLight)
                            .cornerRadius(4)
                    }
                    Button(action: { padPlayer.setOctave(1) }) {
                        Text("+1")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(padPlayer.pitchOffset == 1 ? .black : Color.zionTextSecondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(padPlayer.pitchOffset == 1 ? Color.zionCyan : Color.zionPanelLight)
                            .cornerRadius(4)
                    }
                }
                
                // Volume Slider
                HStack(spacing: 4) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 10))
                        .foregroundColor(Color.zionCyan)
                    Slider(value: Binding(
                        get: { Double(padPlayer.volume) },
                        set: { padPlayer.setVolume(Float($0)) }
                    ), in: 0.0...1.0)
                    .accentColor(Color.zionCyan)
                    .frame(width: 60)
                }
            }
            .padding(.horizontal, 10)

            // 4 columns x 3 rows Pad Grid
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                ForEach(keys, id: \.self) { note in
                    let isActive = padPlayer.activeKey == note
                    Button(action: { padPlayer.toggleKey(note) }) {
                        VStack(spacing: 2) {
                            Text(note)
                                .font(.system(size: 13, weight: .bold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isActive
                                    ? Color.zionCyan
                                    : Color.zionPanelLight
                                )
                        )
                        .foregroundColor(isActive ? .black : Color.zionTextPrimary)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(isActive ? Color.white.opacity(0.6) : Color.zionBorderSubtle, lineWidth: 1)
                        )
                    }
                }
            }
            .padding(.horizontal, 8)
        }
        .padding(.vertical, 6)
        .background(Color.zionPanel)
        .cornerRadius(8)
    }
}
