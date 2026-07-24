import SwiftUI

struct MainView: View {
    @StateObject private var authViewModel = AuthViewModel()
    
    var body: some View {
        if authViewModel.isAuthenticated {
            VStack {
                Text("Bienvenido, \(authViewModel.currentUser?.name ?? "Usuario")")
                    .font(.largeTitle)
                    .foregroundColor(.white)
                
                Button("Cerrar Sesión") {
                    authViewModel.logout()
                }
                .padding()
                .background(Color.red)
                .foregroundColor(.white)
                .cornerRadius(8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(red: 0.05, green: 0.05, blue: 0.08).edgesIgnoringSafeArea(.all))
        } else {
            LoginView(authViewModel: authViewModel)
        }
    }
}
