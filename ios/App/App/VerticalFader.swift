import SwiftUI

struct VerticalFader: View {
    @Binding var value: Float // 0.0 to 1.2
    var trackId: String
    var trackColor: Color = Color.zionCyan
    var compact: Bool = false
    @ObservedObject var engine = AudioEngineViewModel.shared
    
    var grooveWidth: CGFloat { compact ? 14 : 18 }
    let faderMax: Float = 1.2
    
    private var currentDB: Float {
        let isAudible = !engine.mutedStems.contains(trackId) && (engine.soloedStems.isEmpty || engine.soloedStems.contains(trackId))
        guard isAudible, engine.isPlaying else { return -60.0 }
        return engine.vuLevels[trackId] ?? -60.0
    }
    
    var body: some View {
        GeometryReader { geometry in
            let height = max(40, geometry.size.height)
            let progress = CGFloat(min(max(value / faderMax, Float(0.0)), Float(1.0)))
            
            ZStack(alignment: .bottom) {
                // Background Track (Decibel slider groove)
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(red: 0.12, green: 0.16, blue: 0.24))
                    .frame(width: grooveWidth, height: height)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                
                // VU Meter LED Overlay inside groove
                let ledCount = compact ? 16 : 24
                VStack(spacing: 1) {
                    ForEach((0..<ledCount).reversed(), id: \.self) { index in
                        let ledDB = Float(-60.0) + (Float(index) * (Float(66.0) / Float(ledCount)))
                        let isActive = currentDB >= ledDB
                        let redThreshold = Int(Double(ledCount) * 0.83)
                        let yellowThreshold = Int(Double(ledCount) * 0.66)
                        let ledColor = index >= redThreshold ? Color.red : (index >= yellowThreshold ? Color.yellow : trackColor)
                        
                        Rectangle()
                            .fill(isActive ? ledColor.opacity(0.85) : Color.clear)
                            .frame(width: grooveWidth - 2, height: max(1.0, (height / CGFloat(ledCount)) - 1.0))
                    }
                }
                .frame(width: grooveWidth, height: height)
                
                // Fill up to volume level
                let fillHeight = progress * height
                RoundedRectangle(cornerRadius: 6)
                    .fill(trackColor.opacity(0.35))
                    .frame(width: grooveWidth, height: fillHeight)
                
                // Fader Thumb / Knob
                let thumbHeight: CGFloat = compact ? 16 : 20
                let thumbWidth: CGFloat = compact ? 38 : 48
                let usableHeight = max(1, height - thumbHeight)
                
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(red: 0.08, green: 0.10, blue: 0.16))
                    .frame(width: thumbWidth, height: thumbHeight)
                    .shadow(color: .black.opacity(0.5), radius: 3)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(trackColor.opacity(0.85), lineWidth: 1.5)
                            .overlay(
                                Rectangle()
                                    .fill(trackColor)
                                    .frame(height: 1.5)
                            )
                    )
                    .offset(y: -progress * usableHeight)
                    .allowsHitTesting(false)
            }
            .frame(width: compact ? 44 : 56, height: height)
            .contentShape(Rectangle())
            .highPriorityGesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { gesture in
                        let thumbHeight: CGFloat = compact ? 16 : 20
                        let usableHeight = max(1, height - thumbHeight)
                        let clampedY = min(max(0, gesture.location.y - thumbHeight / 2), usableHeight)
                        let normalized = Float(1.0 - (clampedY / usableHeight))
                        self.value = max(0.0, min(faderMax, normalized * faderMax))
                    }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: compact ? 44 : 56)
    }
}
