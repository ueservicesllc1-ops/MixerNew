import SwiftUI

class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    
    @Published var darkMode: Bool {
        didSet {
            UserDefaults.standard.set(darkMode, forKey: "mixer_darkMode")
        }
    }
    
    private init() {
        self.darkMode = UserDefaults.standard.bool(forKey: "mixer_darkMode")
    }
    
    // Colors matching Android theme
    var background: Color {
        darkMode ? Color(red: 11/255.0, green: 14/255.0, blue: 20/255.0) : Color(red: 245/255.0, green: 246/255.0, blue: 250/255.0)
    }
    
    var panel: Color {
        darkMode ? Color(red: 18/255.0, green: 22/255.0, blue: 32/255.0) : Color.white
    }
    
    var panelLight: Color {
        darkMode ? Color(red: 26/255.0, green: 32/255.0, blue: 46/255.0) : Color(red: 223/255.0, green: 230/255.0, blue: 233/255.0)
    }
    
    var textPrimary: Color {
        darkMode ? Color.white : Color(red: 45/255.0, green: 52/255.0, blue: 54/255.0)
    }
    
    var textSecondary: Color {
        darkMode ? Color(red: 164/255.0, green: 176/255.0, blue: 190/255.0) : Color(red: 99/255.0, green: 110/255.0, blue: 114/255.0)
    }
    
    var borderSubtle: Color {
        darkMode ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }
}
