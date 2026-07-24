import SwiftUI

extension Color {
    static let zionBackground = Color(hex: "#0b0f19")
    static let zionPanel = Color(hex: "#151b2b")
    static let zionPanelLight = Color(hex: "#1e2638")
    
    static let zionBorderSubtle = Color.white.opacity(0.1)
    static let zionButtonDark = Color(hex: "#1a2235")
    static let zionButtonHover = Color(hex: "#252f48")
    static let zionTextPrimary = Color.white
    static let zionTextSecondary = Color(hex: "#8b949e")
    
    static let zionCyan = Color(hex: "#00bcd4")
    static let zionFaderThumb = Color(hex: "#2c3e50")
    
    static let zionRed = Color(hex: "#ef4444")
    static let zionYellow = Color(hex: "#f59e0b")
    static let zionOrange = Color(hex: "#ff7043")
    
    static let zionTrackOrange = Color(hex: "#ff9800")
    static let zionTrackCyan = Color(hex: "#00bcd4")
    static let zionTrackPurple = Color(hex: "#673ab7")
    static let zionTrackYellow = Color(hex: "#ffc107")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
