import SwiftUI

struct VerticalFader: View {
    @Binding var value: Float // 0.0 to 1.2
    var trackId: String
    var trackColor: Color = Color.zionCyan
    @ObservedObject var engine = AudioEngineViewModel.shared
    
    let width: CGFloat = 10
    let faderMax: Float = 1.2
    
    private var currentDB: Float {
        guard !engine.mutedStems.contains(trackId), engine.isPlaying else { return -60.0 }
        return engine.vuLevels[trackId] ?? -60.0
    }
    
    var body: some View {
        GeometryReader { geometry in
            let height = geometry.size.height
            let progress = CGFloat(min(max(value / faderMax, Float(0.0)), Float(1.0)))
            
            ZStack(alignment: .bottom) {
                // Background Track (Decibel slider groove)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(red: 0.12, green: 0.16, blue: 0.24))
                    .frame(width: width, height: height)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
                
                // VU Meter LED Overlay inside groove
                VStack(spacing: 1) {
                    ForEach((0..<24).reversed(), id: \.self) { index in
                        let ledDB = Float(-60.0) + (Float(index) * Float(2.75))
                        let isActive = currentDB >= ledDB
                        let ledColor = index >= 20 ? Color.red : (index >= 16 ? Color.yellow : trackColor)
                        
                        Rectangle()
                            .fill(isActive ? ledColor.opacity(0.8) : Color.clear)
                            .frame(width: width - 2, height: (height / 24.0) - 1.0)
                    }
                }
                .frame(width: width, height: height)
                
                // Fill up to volume level (Mixer.jsx fader-color-fill)
                let fillHeight = progress * height
                RoundedRectangle(cornerRadius: 4)
                    .fill(trackColor.opacity(0.35))
                    .frame(width: width, height: fillHeight)
                
                // Fader Thumb / Knob (capuchón del fader)
                let thumbHeight: CGFloat = 20
                let thumbWidth: CGFloat = 34
                
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(red: 0.08, green: 0.10, blue: 0.16))
                    .frame(width: thumbWidth, height: thumbHeight)
                    .shadow(color: .black.opacity(0.5), radius: 3)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(trackColor.opacity(0.8), lineWidth: 1.5)
                            .overlay(
                                // Horizontal center line on fader knob
                                Rectangle()
                                    .fill(trackColor)
                                    .frame(height: 1.5)
                            )
                    )
                    .offset(y: -progress * height + thumbHeight / 2)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { gesture in
                                let dragY = height - gesture.location.y
                                let newValue = Float(dragY / height) * faderMax
                                self.value = max(0.0, min(faderMax, newValue))
                            }
                    )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 40)
    }
}
