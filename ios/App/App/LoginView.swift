import SwiftUI

struct LoginView: View {
    @ObservedObject var authViewModel: AuthViewModel
    
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    
    let zionCyan = Color(red: 0.0, green: 0.74, blue: 0.83)
    let darkBackground = Color(red: 0.04, green: 0.06, blue: 0.11)
    let cardBackground = Color(red: 0.08, green: 0.11, blue: 0.18)
    let inputBackground = Color(red: 0.14, green: 0.19, blue: 0.29)
    
    var body: some View {
        GeometryReader { geo in
            let isCompactHeight = geo.size.height < 500
            
            ZStack {
                darkBackground.ignoresSafeArea()
                
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: isCompactHeight ? 14 : 22) {
                        // Header / Brand
                        HStack(spacing: 10) {
                            Image(systemName: "slider.vertical.3")
                                .font(.system(size: isCompactHeight ? 24 : 32, weight: .bold))
                                .foregroundColor(zionCyan)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("ZION STAGE")
                                    .font(.system(size: isCompactHeight ? 26 : 34, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                                Text("MULTITRACK LIVE PLAYER")
                                    .font(.system(size: isCompactHeight ? 10 : 12, weight: .bold))
                                    .foregroundColor(zionCyan)
                                    .tracking(1.5)
                            }
                        }
                        .padding(.top, isCompactHeight ? 6 : 16)
                        
                        // Input Fields
                        VStack(spacing: isCompactHeight ? 10 : 14) {
                            // Email Field
                            HStack(spacing: 10) {
                                Image(systemName: "envelope.fill")
                                    .foregroundColor(zionCyan)
                                    .frame(width: 20)
                                
                                ZStack(alignment: .leading) {
                                    if email.isEmpty {
                                        Text("Correo electrónico")
                                            .foregroundColor(Color(white: 0.75))
                                            .font(.system(size: 15, weight: .medium))
                                    }
                                    TextField("", text: $email)
                                        .foregroundColor(.white)
                                        .font(.system(size: 15, weight: .semibold))
                                        .accentColor(zionCyan)
                                        .autocapitalization(.none)
                                        .disableAutocorrection(true)
                                        .keyboardType(.emailAddress)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, isCompactHeight ? 11 : 14)
                            .background(inputBackground)
                            .cornerRadius(10)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(zionCyan.opacity(0.45), lineWidth: 1.2)
                            )
                            
                            // Password Field
                            HStack(spacing: 10) {
                                Image(systemName: "lock.fill")
                                    .foregroundColor(zionCyan)
                                    .frame(width: 20)
                                
                                ZStack(alignment: .leading) {
                                    if password.isEmpty {
                                        Text("Contraseña")
                                            .foregroundColor(Color(white: 0.75))
                                            .font(.system(size: 15, weight: .medium))
                                    }
                                    if showPassword {
                                        TextField("", text: $password)
                                            .foregroundColor(.white)
                                            .font(.system(size: 15, weight: .semibold))
                                            .accentColor(zionCyan)
                                            .autocapitalization(.none)
                                            .disableAutocorrection(true)
                                    } else {
                                        SecureField("", text: $password)
                                            .foregroundColor(.white)
                                            .font(.system(size: 15, weight: .semibold))
                                            .accentColor(zionCyan)
                                    }
                                }
                                
                                Button(action: { showPassword.toggle() }) {
                                    Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                        .foregroundColor(Color(white: 0.75))
                                        .font(.system(size: 14))
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, isCompactHeight ? 11 : 14)
                            .background(inputBackground)
                            .cornerRadius(10)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(zionCyan.opacity(0.45), lineWidth: 1.2)
                            )
                        }
                        
                        if let errorMessage = authViewModel.errorMessage {
                            Text(errorMessage)
                                .foregroundColor(Color(red: 1.0, green: 0.35, blue: 0.35))
                                .font(.system(size: 12, weight: .semibold))
                                .multilineTextAlignment(.center)
                        }
                        
                        // Submit Button
                        Button(action: {
                            authViewModel.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
                        }) {
                            HStack(spacing: 8) {
                                if authViewModel.isAuthenticating {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                }
                                Text("INICIAR SESIÓN")
                                    .font(.system(size: 15, weight: .black))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, isCompactHeight ? 12 : 15)
                            .background(
                                (email.isEmpty || password.isEmpty)
                                    ? zionCyan.opacity(0.4)
                                    : zionCyan
                            )
                            .foregroundColor(.black)
                            .cornerRadius(10)
                        }
                        .disabled(authViewModel.isAuthenticating || email.isEmpty || password.isEmpty)
                    }
                    .padding(isCompactHeight ? 20 : 28)
                    .frame(maxWidth: 440)
                    .background(cardBackground)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.5), radius: 16, x: 0, y: 8)
                    .frame(maxWidth: .infinity, minHeight: geo.size.height)
                    .padding(.horizontal, 20)
                }
            }
        }
        .preferredColorScheme(.dark)
        .environment(\.colorScheme, .dark)
    }
}
