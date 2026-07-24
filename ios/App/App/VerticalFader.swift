import SwiftUI

struct VerticalFader: View {
    @Binding var value: Float // 0.0 to 1.2
    var trackId: String
    var trackColor: Color = Color.zionCyan
    
    let height: CGFloat = 200
    let width: CGFloat = 20
    let faderMax: Float = 1.2
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                // Background Track
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.zionBackground.opacity(0.5))
                    .frame(width: width, height: height)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.zionBorderSubtle, lineWidth: 1)
                    )
                
                // Fill
                let fillHeight = CGFloat(min(max(value / faderMax, 0), 1)) * height
                RoundedRectangle(cornerRadius: 8)
                    .fill(trackColor)
                    .frame(width: width, height: fillHeight)
                
                // Thumb
                let thumbHeight: CGFloat = 24
                
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: "#1b2130"))
                    .frame(width: 40, height: thumbHeight)
                    .shadow(color: .black.opacity(0.5), radius: 3)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6).stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
                    .offset(y: -CGFloat(min(max(value / faderMax, 0), 1)) * height + thumbHeight / 2)
                    .gesture(
                        DragGesture()
                            .onChanged { gesture in
                                let dragY = height - gesture.location.y
                                let newValue = Float(dragY / height) * faderMax
                                self.value = max(0.0, min(faderMax, newValue))
                            }
                    )
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .center)
        }
        .frame(width: 40, height: height)
    }
}
