import SwiftUI

struct LoginView: View {
    @ObservedObject var authViewModel: AuthViewModel
    
    @State private var email = ""
    @State private var password = ""
    
    // Zion Theme Colors (Translating from CSS)
    let zionBlue = Color(red: 0.1, green: 0.5, blue: 0.9) // Update later to exact hex
    let darkBackground = Color(red: 0.05, green: 0.05, blue: 0.08)
    let cardBackground = Color(red: 0.1, green: 0.1, blue: 0.15)
    
    var body: some View {
        ZStack {
            darkBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                Text("ZION STAGE")
                    .font(.system(size: 40, weight: .bold, design: .default))
                    .foregroundColor(.white)
                    .padding(.bottom, 30)
                
                VStack(spacing: 15) {
                    TextField("Email", text: $email)
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                        .autocapitalization(.none)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Contraseña", text: $password)
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 40)
                
                if let errorMessage = authViewModel.errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                        .padding(.top, 5)
                }
                
                Button(action: {
                    authViewModel.login(email: email, password: password)
                }) {
                    HStack {
                        if authViewModel.isAuthenticating {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .padding(.trailing, 5)
                        }
                        Text("INICIAR SESIÓN")
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(zionBlue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(authViewModel.isAuthenticating || email.isEmpty || password.isEmpty)
                .padding(.horizontal, 40)
                .padding(.top, 10)
            }
        }
    }
}
