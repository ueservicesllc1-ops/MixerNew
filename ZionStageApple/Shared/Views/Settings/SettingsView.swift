//
//  SettingsView.swift
//  ZionStageApple
//
//  Vista de Ajustes de la Aplicación (Cuenta, Salida de Audio, Preferencias y Acerca de)
//

import SwiftUI

public struct SettingsView: View {
    @EnvironmentObject var firebase: FirebaseService
    @ObservedObject var player: ZionAudioPlayer = ZionAudioPlayer.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var enableAutoScroll: Bool = true
    @State private var defaultPanClickLeft: Bool = true

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // SECCIÓN CUENTA Y PERFIL
                    VStack(alignment: .leading, spacing: 10) {
                        Text("CUENTA Y PERFIL")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(firebase.userProfile?.displayName ?? firebase.currentUser?.email ?? "Usuario Zion Stage")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text(firebase.currentUser?.email ?? "")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                Text("Plan: \(firebase.userProfile?.role ?? "PRO")")
                                    .font(.caption)
                                    .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                            }
                            Spacer()

                            Button(action: {
                                firebase.signOut()
                                presentationMode.wrappedValue.dismiss()
                            }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "rectangle.portrait.and.arrow.right")
                                    Text("Cerrar Sesión")
                                        .font(.system(size: 12, weight: .bold))
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.red)
                                .cornerRadius(8)
                            }
                        }
                        .padding()
                        .background(Color(red: 0.09, green: 0.12, blue: 0.20))
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    }

                    // SECCIÓN MOTOR DE AUDIO
                    VStack(alignment: .leading, spacing: 10) {
                        Text("MOTOR DE AUDIO NATIVO (AVFoundation)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))

                        VStack(spacing: 12) {
                            HStack {
                                Text("Salida de Audio")
                                    .foregroundColor(.white)
                                Spacer()
                                Text("Altavoces / Auriculares (Default)")
                                    .font(.caption)
                                    .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                            }
                            Divider().background(Color.white.opacity(0.1))

                            HStack {
                                Text("Separación Estéreo Click/Guía")
                                    .foregroundColor(.white)
                                Spacer()
                                Toggle("", isOn: $defaultPanClickLeft)
                                    .labelsHidden()
                                    .tint(Color(red: 0.07, green: 0.71, blue: 0.71))
                            }
                            Divider().background(Color.white.opacity(0.1))

                            HStack {
                                Text("Estado del Reproductor")
                                    .foregroundColor(.white)
                                Spacer()
                                Text(player.isPlaying ? "▶ Reproduciendo" : "⏹ Detenido")
                                    .font(.caption)
                                    .foregroundColor(player.isPlaying ? .green : .gray)
                            }
                        }
                        .font(.subheadline)
                        .padding()
                        .background(Color(red: 0.09, green: 0.12, blue: 0.20))
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    }

                    // SECCIÓN PREFERENCIAS DE LETRAS
                    VStack(alignment: .leading, spacing: 10) {
                        Text("PREFERENCIAS DE PANTALLA Y LETRAS")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))

                        VStack(spacing: 12) {
                            Toggle(isOn: $enableAutoScroll) {
                                Text("Desplazamiento Automático de Letras")
                                    .foregroundColor(.white)
                            }
                            .tint(Color(red: 0.07, green: 0.71, blue: 0.71))
                        }
                        .font(.subheadline)
                        .padding()
                        .background(Color(red: 0.09, green: 0.12, blue: 0.20))
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    }

                    // SECCIÓN ACERCA DE
                    VStack(alignment: .leading, spacing: 10) {
                        Text("ACERCA DE")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.6, green: 0.7, blue: 0.8))

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Zion Stage iOS Native")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("Versión 2.4.0 (Build SwiftUI Nativo)")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            Spacer()
                            Image(systemName: "waveform.and.mic")
                                .font(.system(size: 24))
                                .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                        }
                        .padding()
                        .background(Color(red: 0.09, green: 0.12, blue: 0.20))
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    }
                }
                .padding()
            }
            .background(Color(red: 0.06, green: 0.08, blue: 0.14).ignoresSafeArea())
            .navigationTitle("Ajustes")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { presentationMode.wrappedValue.dismiss() }
                        .foregroundColor(Color(red: 0.07, green: 0.71, blue: 0.71))
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
