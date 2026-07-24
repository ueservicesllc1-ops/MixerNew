import SwiftUI

struct MainView: View {
    @StateObject private var authViewModel = AuthViewModel()
    
    var body: some View {
        if authViewModel.isAuthenticated {
            VStack(spacing: 0) {
                HStack {
                    Text("Bienvenido, \(authViewModel.currentUser?.name ?? "Usuario")")
                        .foregroundColor(.white)
                    Spacer()
                    Button("Cerrar Sesión") {
                        authViewModel.logout()
                    }
                    .foregroundColor(.red)
                }
                .padding()
                .background(Color(red: 0.1, green: 0.1, blue: 0.15))
                
                SetlistsView()
            }
            .background(Color(red: 0.05, green: 0.05, blue: 0.08).edgesIgnoringSafeArea(.all))
        } else {
            LoginView(authViewModel: authViewModel)
        }
    }
}
