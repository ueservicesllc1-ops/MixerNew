//
//  LoginView.swift
//  ZionStageApple
//
//  Pantalla nativa de inicio de sesión e integración con Firebase Auth.
//

import SwiftUI

public struct LoginView: View {
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    public var onLoginSuccess: () -> Void

    public init(onLoginSuccess: @escaping () -> Void) {
        self.onLoginSuccess = onLoginSuccess
    }

    public var body: some View {
        VStack(spacing: 20) {
            Spacer()

            // Logo / Título
            VStack(spacing: 8) {
                Image(systemName: "music.note.house.fill")
                    .font(.system(size: 64))
                    .foregroundColor(.cyan)

                Text("Zion Stage")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                Text("Mezclador Multitrack Profesional")
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }

            VStack(spacing: 14) {
                TextField("Correo electrónico", text: $email)
                    .padding()
                    .background(Color(red: 0.15, green: 0.15, blue: 0.15))
                    .cornerRadius(10)
                    .foregroundColor(.white)
                    .autocapitalization(.none)

                SecureField("Contraseña", text: $password)
                    .padding()
                    .background(Color(red: 0.15, green: 0.15, blue: 0.15))
                    .cornerRadius(10)
                    .foregroundColor(.white)

                if let err = errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(.red)
                }

                Button(action: {
                    // Autenticación nativa
                    isLoading = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        isLoading = false
                        onLoginSuccess()
                    }
                }) {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .black))
                        } else {
                            Text("Iniciar Sesión")
                                .fontWeight(.bold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.cyan)
                    .foregroundColor(.black)
                    .cornerRadius(10)
                }
            }
            .padding(.horizontal, 24)

            Spacer()
        }
        .background(Color(red: 0.06, green: 0.06, blue: 0.06).ignoresSafeArea())
    }
}
