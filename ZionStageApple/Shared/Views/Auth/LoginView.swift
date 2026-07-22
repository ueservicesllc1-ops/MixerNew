//
//  LoginView.swift
//  ZionStageApple
//
//  Pantalla de inicio de sesión con Firebase Auth real.
//  Soporta: Login, Registro, Recuperación de contraseña.
//

import SwiftUI

public struct LoginView: View {
    @EnvironmentObject var firebase: FirebaseService

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @State private var successMessage: String? = nil
    @State private var mode: AuthMode = .login

    enum AuthMode { case login, register, forgotPassword }

    public init() {}

    public var body: some View {
        ZStack {
            // Fondo Cyber
            Color(red: 0.04, green: 0.05, blue: 0.09).ignoresSafeArea()

            // Gradiente superior
            VStack {
                LinearGradient(
                    gradient: Gradient(colors: [Color.cyan.opacity(0.12), Color.clear]),
                    startPoint: .top, endPoint: .center
                )
                .frame(height: 240)
                Spacer()
            }
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    Spacer(minLength: 50)

                    // Logo
                    VStack(spacing: 10) {
                        ZStack {
                            Circle()
                                .fill(Color.cyan.opacity(0.15))
                                .frame(width: 96, height: 96)
                            Circle()
                                .stroke(Color.cyan.opacity(0.4), lineWidth: 1.5)
                                .frame(width: 96, height: 96)
                            Image(systemName: "waveform.and.mic")
                                .font(.system(size: 40))
                                .foregroundColor(.cyan)
                        }
                        Text("ZION STAGE")
                            .font(.system(size: 28, weight: .black, design: .default))
                            .foregroundColor(.white)
                            .tracking(4)
                        Text("Mezclador Multitrack Profesional")
                            .font(.system(size: 13))
                            .foregroundColor(Color(red: 0.5, green: 0.6, blue: 0.7))
                    }

                    // Formulario
                    VStack(spacing: 16) {
                        // Título del modo
                        Text(modeTitle)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)

                        // Email
                        cyberField(icon: "envelope.fill", placeholder: "Correo electrónico", text: $email, isSecure: false)

                        // Password (no en "olvidé contraseña")
                        if mode != .forgotPassword {
                            cyberField(icon: "lock.fill", placeholder: "Contraseña", text: $password, isSecure: true)
                        }

                        // Confirmar contraseña (solo en registro)
                        if mode == .register {
                            cyberField(icon: "lock.fill", placeholder: "Confirmar contraseña", text: $confirmPassword, isSecure: true)
                        }

                        // Mensajes de error / éxito
                        if let err = errorMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .foregroundColor(.red)
                                Text(err)
                                    .font(.system(size: 13))
                                    .foregroundColor(.red)
                            }
                            .padding(12)
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                        }

                        if let ok = successMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text(ok)
                                    .font(.system(size: 13))
                                    .foregroundColor(.green)
                            }
                            .padding(12)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(8)
                        }

                        // Botón principal
                        Button(action: primaryAction) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(LinearGradient(
                                        gradient: Gradient(colors: [.cyan, Color(red: 0.0, green: 0.6, blue: 0.8)]),
                                        startPoint: .leading, endPoint: .trailing
                                    ))
                                    .shadow(color: .cyan.opacity(0.4), radius: 8)

                                if isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                } else {
                                    Text(buttonLabel)
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.black)
                                }
                            }
                            .frame(height: 52)
                        }
                        .disabled(isLoading)

                        // Links secundarios
                        VStack(spacing: 12) {
                            if mode == .login {
                                Button(action: { switchMode(.forgotPassword) }) {
                                    Text("¿Olvidaste tu contraseña?")
                                        .font(.system(size: 13))
                                        .foregroundColor(.cyan)
                                }

                                Button(action: { switchMode(.register) }) {
                                    Text("¿No tienes cuenta? **Regístrate**")
                                        .font(.system(size: 14))
                                        .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))
                                }
                            } else {
                                Button(action: { switchMode(.login) }) {
                                    Text("← Volver a Iniciar Sesión")
                                        .font(.system(size: 14))
                                        .foregroundColor(.cyan)
                                }
                            }
                        }
                    }
                    .padding(24)
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color(red: 0.08, green: 0.10, blue: 0.16))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(Color.cyan.opacity(0.2), lineWidth: 1)
                            )
                    )
                    .padding(.horizontal, 20)

                    Spacer(minLength: 40)
                }
            }
        }
    }

    // MARK: - Helpers
    private var modeTitle: String {
        switch mode {
        case .login: return "Iniciar Sesión"
        case .register: return "Crear Cuenta"
        case .forgotPassword: return "Recuperar Contraseña"
        }
    }

    private var buttonLabel: String {
        switch mode {
        case .login: return "Iniciar Sesión"
        case .register: return "Crear Cuenta"
        case .forgotPassword: return "Enviar Correo de Recuperación"
        }
    }

    private func switchMode(_ newMode: AuthMode) {
        errorMessage = nil
        successMessage = nil
        mode = newMode
    }

    private func primaryAction() {
        errorMessage = nil
        successMessage = nil
        isLoading = true

        switch mode {
        case .login:
            guard !email.isEmpty, !password.isEmpty else {
                isLoading = false
                errorMessage = "Ingresa tu correo y contraseña."
                return
            }
            firebase.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password) { err in
                isLoading = false
                if let err = err {
                    errorMessage = localizedAuthError(err)
                }
                // El AuthStateListener en FirebaseService actualiza isAuthenticated automáticamente
            }

        case .register:
            guard !email.isEmpty, !password.isEmpty else {
                isLoading = false
                errorMessage = "Completa todos los campos."
                return
            }
            guard password == confirmPassword else {
                isLoading = false
                errorMessage = "Las contraseñas no coinciden."
                return
            }
            guard password.count >= 6 else {
                isLoading = false
                errorMessage = "La contraseña debe tener al menos 6 caracteres."
                return
            }
            firebase.createAccount(email: email.trimmingCharacters(in: .whitespaces), password: password) { err in
                isLoading = false
                if let err = err {
                    errorMessage = localizedAuthError(err)
                }
            }

        case .forgotPassword:
            guard !email.isEmpty else {
                isLoading = false
                errorMessage = "Ingresa tu correo electrónico."
                return
            }
            firebase.resetPassword(email: email.trimmingCharacters(in: .whitespaces)) { err in
                isLoading = false
                if let err = err {
                    errorMessage = localizedAuthError(err)
                } else {
                    successMessage = "✓ Correo enviado. Revisa tu bandeja de entrada."
                }
            }
        }
    }

    private func localizedAuthError(_ error: Error) -> String {
        let code = (error as NSError).code
        switch code {
        case 17004, 17009: return "Correo o contraseña incorrectos."
        case 17007: return "Este correo ya está registrado."
        case 17008: return "El correo no tiene un formato válido."
        case 17011: return "No existe una cuenta con ese correo."
        case 17026: return "La contraseña debe tener al menos 6 caracteres."
        default: return error.localizedDescription
        }
    }

    @ViewBuilder
    private func cyberField(icon: String, placeholder: String, text: Binding<String>, isSecure: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.cyan)
                .frame(width: 20)

            if isSecure {
                SecureField(placeholder, text: text)
                    .foregroundColor(.white)
                    .font(.system(size: 15))
            } else {
                #if os(iOS)
                TextField(placeholder, text: text)
                    .foregroundColor(.white)
                    .font(.system(size: 15))
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
                #else
                TextField(placeholder, text: text)
                    .foregroundColor(.white)
                    .font(.system(size: 15))
                #endif
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(red: 0.12, green: 0.14, blue: 0.20))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.cyan.opacity(0.25), lineWidth: 1)
                )
        )
    }
}
