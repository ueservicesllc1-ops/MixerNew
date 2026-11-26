import SwiftUI

struct LoginView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @Environment(\.openURL) private var openURL
    
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focusedField: Field?
    
    enum Field: Hashable {
        case email
        case password
    }
    
    let zionCyan = Color(red: 0.0, green: 0.74, blue: 0.83)
    let darkBackground = Color(red: 0.04, green: 0.06, blue: 0.11)
    let cardBackground = Color(red: 0.08, green: 0.11, blue: 0.18)
    let inputBackground = Color(red: 0.14, green: 0.19, blue: 0.29)
    
    private func submitLogin() {
        focusedField = nil
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty, !password.isEmpty else { return }
        authViewModel.login(email: cleanEmail, password: password)
    }
    
    private func openSignUpWeb() {
        if let url = URL(string: "https://zionstage.live") {
            openURL(url)
        }
    }
    
    var body: some View {
        GeometryReader { geo in
            let isPhoneLandscape = UIDevice.current.userInterfaceIdiom == .phone && geo.size.width > geo.size.height
            let isKeyboardOpen = focusedField != nil && isPhoneLandscape
            
            ZStack {
                darkBackground
                    .ignoresSafeArea()
                    .onTapGesture {
                        focusedField = nil
                    }
                
                ScrollView(.vertical, showsIndicators: false) {
                    if authViewModel.needsEmailVerification {
                        emailVerificationCard(isPhoneLandscape: isPhoneLandscape)
                            .frame(maxWidth: .infinity, minHeight: geo.size.height)
                            .padding(.horizontal, 16)
                    } else {
                        VStack(spacing: isKeyboardOpen ? 8 : (isPhoneLandscape ? 12 : 18)) {
                            
                            // Header / Brand
                            HStack(spacing: 10) {
                                Image(systemName: "slider.vertical.3")
                                    .font(.system(size: isKeyboardOpen ? 18 : (isPhoneLandscape ? 22 : 30), weight: .bold))
                                    .foregroundColor(zionCyan)
                                
                                Text("ZION STAGE")
                                    .font(.system(size: isKeyboardOpen ? 18 : (isPhoneLandscape ? 24 : 32), weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                                
                                if !isKeyboardOpen {
                                    Text("•  LIVE MULTITRACK")
                                        .font(.system(size: isPhoneLandscape ? 10 : 12, weight: .bold))
                                        .foregroundColor(zionCyan)
                                        .tracking(1.2)
                                }
                                
                                Spacer()
                                
                                if focusedField != nil {
                                    Button(action: { focusedField = nil }) {
                                        HStack(spacing: 4) {
                                            Image(systemName: "keyboard.chevron.compact.down")
                                            Text("Ocultar")
                                        }
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(zionCyan)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(zionCyan.opacity(0.15))
                                        .cornerRadius(6)
                                    }
                                }
                            }
                            
                            // Input Fields
                            if isPhoneLandscape {
                                HStack(spacing: 10) {
                                    emailInputField(compact: true)
                                    passwordInputField(compact: true)
                                }
                            } else {
                                VStack(spacing: 14) {
                                    emailInputField(compact: false)
                                    passwordInputField(compact: false)
                                }
                            }
                            
                            if let errorMessage = authViewModel.errorMessage {
                                Text(errorMessage)
                                    .foregroundColor(Color(red: 1.0, green: 0.35, blue: 0.35))
                                    .font(.system(size: 12, weight: .semibold))
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                            }
                            
                            // Submit Button
                            Button(action: submitLogin) {
                                HStack(spacing: 8) {
                                    if authViewModel.isAuthenticating {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                    }
                                    Text("INICIAR SESIÓN")
                                        .font(.system(size: isPhoneLandscape ? 14 : 15, weight: .black))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, isKeyboardOpen ? 10 : (isPhoneLandscape ? 11 : 14))
                                .background(
                                    (email.isEmpty || password.isEmpty)
                                        ? zionCyan.opacity(0.4)
                                        : zionCyan
                                )
                                .foregroundColor(.black)
                                .cornerRadius(10)
                            }
                            .disabled(authViewModel.isAuthenticating || email.isEmpty || password.isEmpty)
                            
                            // Register / "Unirte" CTA -> zionstage.live
                            if !isKeyboardOpen {
                                HStack(spacing: 8) {
                                    Text("¿No tienes cuenta?")
                                        .font(.system(size: isPhoneLandscape ? 12 : 13, weight: .medium))
                                        .foregroundColor(Color(white: 0.72))
                                    
                                    Button(action: openSignUpWeb) {
                                        HStack(spacing: 5) {
                                            Text("Unirte")
                                                .font(.system(size: isPhoneLandscape ? 12 : 13, weight: .bold))
                                            Image(systemName: "arrow.up.right.square")
                                                .font(.system(size: isPhoneLandscape ? 11 : 12, weight: .bold))
                                        }
                                        .foregroundColor(zionCyan)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(zionCyan.opacity(0.14))
                                        .cornerRadius(7)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 7)
                                                .stroke(zionCyan.opacity(0.45), lineWidth: 1)
                                        )
                                    }
                                    
                                    if !ZionFeatureFlags.paidPlansEnabled {
                                        Text("• Gratis \(ZionFeatureFlags.freeLaunchStorageGB) GB")
                                            .font(.system(size: isPhoneLandscape ? 11 : 12, weight: .semibold))
                                            .foregroundColor(Color.green.opacity(0.9))
                                    }
                                }
                                .padding(.top, 2)
                            }
                        }
                        .padding(isKeyboardOpen ? 12 : (isPhoneLandscape ? 16 : 26))
                        .frame(maxWidth: isPhoneLandscape ? 680 : 460)
                        .background(cardBackground)
                        .cornerRadius(14)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.white.opacity(0.14), lineWidth: 1)
                        )
                        .shadow(color: .black.opacity(0.5), radius: 14, x: 0, y: 6)
                        .frame(maxWidth: .infinity, minHeight: geo.size.height)
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
        .environment(\.colorScheme, .dark)
    }
    
    @ViewBuilder
    private func emailVerificationCard(isPhoneLandscape: Bool) -> some View {
        VStack(spacing: isPhoneLandscape ? 10 : 16) {
            HStack(spacing: 10) {
                Image(systemName: "envelope.badge.shield.half.filled")
                    .font(.system(size: isPhoneLandscape ? 24 : 32, weight: .bold))
                    .foregroundColor(zionCyan)
                Text("Confirma tu correo electrónico")
                    .font(.system(size: isPhoneLandscape ? 17 : 21, weight: .black))
                    .foregroundColor(.white)
            }
            
            Text("Enviamos un enlace de verificación a \(authViewModel.pendingVerificationEmail). Haz clic en ese enlace para activar tu cuenta y entrar a Zion Stage.")
                .font(.system(size: isPhoneLandscape ? 12 : 14))
                .foregroundColor(Color(white: 0.78))
                .multilineTextAlignment(.center)
            
            if let feedback = authViewModel.verificationFeedback {
                Text(feedback)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(zionCyan)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(zionCyan.opacity(0.12))
                    .cornerRadius(8)
            }
            
            HStack(spacing: 10) {
                Button(action: { authViewModel.checkEmailVerification() }) {
                    HStack(spacing: 6) {
                        if authViewModel.isCheckingVerification {
                            ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .black))
                        }
                        Text(authViewModel.isCheckingVerification ? "Comprobando..." : "Ya confirmé mi correo")
                            .font(.system(size: isPhoneLandscape ? 12 : 14, weight: .black))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, isPhoneLandscape ? 10 : 12)
                    .background(zionCyan)
                    .foregroundColor(.black)
                    .cornerRadius(9)
                }
                .disabled(authViewModel.isCheckingVerification)
                
                Button(action: { authViewModel.resendVerificationEmail() }) {
                    Text(authViewModel.isResendingVerification ? "Enviando..." : "Reenviar enlace")
                        .font(.system(size: isPhoneLandscape ? 12 : 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, isPhoneLandscape ? 10 : 12)
                        .background(inputBackground)
                        .foregroundColor(.white)
                        .cornerRadius(9)
                }
                .disabled(authViewModel.isResendingVerification)
            }
            
            Button(action: { authViewModel.logout() }) {
                Text("Usar otra cuenta")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(white: 0.65))
            }
        }
        .padding(isPhoneLandscape ? 16 : 24)
        .frame(maxWidth: isPhoneLandscape ? 600 : 460)
        .background(cardBackground)
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(zionCyan.opacity(0.35), lineWidth: 1)
        )
    }
    
    @ViewBuilder
    private func emailInputField(compact: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "envelope.fill")
                .foregroundColor(zionCyan)
                .font(.system(size: compact ? 13 : 15))
                .frame(width: 18)
            
            ZStack(alignment: .leading) {
                if email.isEmpty {
                    Text("Correo electrónico")
                        .foregroundColor(Color(white: 0.75))
                        .font(.system(size: compact ? 14 : 15, weight: .medium))
                        .lineLimit(1)
                }
                TextField("", text: $email)
                    .focused($focusedField, equals: .email)
                    .foregroundColor(.white)
                    .font(.system(size: compact ? 14 : 15, weight: .semibold))
                    .accentColor(zionCyan)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .submitLabel(.next)
                    .onSubmit {
                        focusedField = .password
                    }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, compact ? 10 : 13)
        .background(inputBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(focusedField == .email ? zionCyan : zionCyan.opacity(0.4), lineWidth: focusedField == .email ? 1.8 : 1.1)
        )
    }
    
    @ViewBuilder
    private func passwordInputField(compact: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "lock.fill")
                .foregroundColor(zionCyan)
                .font(.system(size: compact ? 13 : 15))
                .frame(width: 18)
            
            ZStack(alignment: .leading) {
                if password.isEmpty {
                    Text("Contraseña")
                        .foregroundColor(Color(white: 0.75))
                        .font(.system(size: compact ? 14 : 15, weight: .medium))
                        .lineLimit(1)
                }
                if showPassword {
                    TextField("", text: $password)
                        .focused($focusedField, equals: .password)
                        .foregroundColor(.white)
                        .font(.system(size: compact ? 14 : 15, weight: .semibold))
                        .accentColor(zionCyan)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit {
                            submitLogin()
                        }
                } else {
                    SecureField("", text: $password)
                        .focused($focusedField, equals: .password)
                        .foregroundColor(.white)
                        .font(.system(size: compact ? 14 : 15, weight: .semibold))
                        .accentColor(zionCyan)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit {
                            submitLogin()
                        }
                }
            }
            
            Button(action: { showPassword.toggle() }) {
                Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                    .foregroundColor(Color(white: 0.75))
                    .font(.system(size: 13))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, compact ? 10 : 13)
        .background(inputBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(focusedField == .password ? zionCyan : zionCyan.opacity(0.4), lineWidth: focusedField == .password ? 1.8 : 1.1)
        )
    }
}
