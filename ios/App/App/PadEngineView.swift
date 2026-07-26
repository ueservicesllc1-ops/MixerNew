import SwiftUI

public struct PadEngineView: View {
    @ObservedObject var padPlayer: ZionPadPlayer = ZionPadPlayer.shared

    let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    public init() {}

    public var body: some View {
        VStack(spacing: 8) {
            // Status bar
            HStack {
                if let activeKey = padPlayer.activeKey {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.zionCyan)
                            .frame(width: 8, height: 8)
                            .shadow(color: .cyan, radius: 4)
                        Text("Pad en \(activeKey)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.zionCyan)
                    }
                } else {
                    Text("Pads Ambientales")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                }
                
                Spacer()
                
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
                    .frame(width: 70)
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
