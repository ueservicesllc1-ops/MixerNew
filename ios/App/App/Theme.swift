import SwiftUI

extension Color {
    struct Zion {
        static let primaryCyan = Color(hex: "#13b5b6")
        static let transportBlue = Color(hex: "#13b5b6")
        static let dangerRed = Color(hex: "#ef4444")
        static let warningYellow = Color(hex: "#f59e0b")
        static let primeCoral = Color(hex: "#f17853")
        
        static let backgroundDark = Color(hex: "#0f172a")
        static let cardDark = Color(hex: "#1e293b")
        static let borderSubtleDark = Color.white.opacity(0.1)
        
        static let textPrimary = Color(hex: "#e2e8f0")
        static let textSecondary = Color(hex: "#94a3b8")
        
        static let faderTrackDark = Color(hex: "#0f172a")
        static let faderFill = Color(hex: "#13b5b6")
    }
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
