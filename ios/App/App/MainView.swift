import SwiftUI

struct MainView: View {
    @StateObject private var authViewModel = AuthViewModel()
    
    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                MixerLayoutView(authViewModel: authViewModel)
            } else {
                LoginView(authViewModel: authViewModel)
            }
        }
        .preferredColorScheme(.dark)
        .statusBar(hidden: true)
    }
}
