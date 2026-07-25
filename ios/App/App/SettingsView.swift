import SwiftUI

struct SettingsView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @State private var enableAutoScroll: Bool = true
    @State private var bufferSize: String = "512 samples"
    @State private var audioOutput: String = "Salida Principal (Default)"
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Ajustes de la Aplicación")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(Color.zionTextPrimary)
                    .padding(.bottom, 5)
                
                // Account Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("CUENTA Y PERFIL")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(authViewModel.currentUser?.name ?? "Usuario Zion Stage")
                                .font(.headline)
                                .foregroundColor(Color.zionTextPrimary)
                            Text(authViewModel.currentUser?.email ?? "")
                                .font(.subheadline)
                                .foregroundColor(Color.zionTextSecondary)
                            Text("Plan: \(authViewModel.currentUser?.plan ?? "PRO")")
                                .font(.caption)
                                .foregroundColor(Color.zionCyan)
                        }
                        Spacer()
                        
                        Button(action: { authViewModel.logout() }) {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                Text("Cerrar Sesión")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.zionRed)
                            .cornerRadius(6)
                        }
                    }
                    .padding()
                    .background(Color.zionPanel)
                    .cornerRadius(8)
                }
                
                // Audio Engine Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("MOTOR DE AUDIO NATIVO (AVFoundation)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                    
                    VStack(spacing: 12) {
                        HStack {
                            Text("Salida de Audio")
                                .foregroundColor(Color.zionTextPrimary)
                            Spacer()
                            Text(audioOutput)
                                .foregroundColor(Color.zionCyan)
                        }
                        Divider().background(Color.zionBorderSubtle)
                        
                        HStack {
                            Text("Buffer de Procesamiento")
                                .foregroundColor(Color.zionTextPrimary)
                            Spacer()
                            Text(bufferSize)
                                .foregroundColor(Color.zionTextSecondary)
                        }
                    }
                    .font(.subheadline)
                    .padding()
                    .background(Color.zionPanel)
                    .cornerRadius(8)
                }
                
                // Preferences Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("PREFERENCIAS DE MEZCLA Y LETRAS")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                    
                    VStack(spacing: 12) {
                        Toggle(isOn: $enableAutoScroll) {
                            Text("Desplazamiento Automático de Letras")
                                .foregroundColor(Color.zionTextPrimary)
                        }
                        .toggleStyle(SwitchToggleStyle(tint: Color.zionCyan))
                    }
                    .font(.subheadline)
                    .padding()
                    .background(Color.zionPanel)
                    .cornerRadius(8)
                }
                
                // About Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("ACERCA DE")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Zion Stage iOS Native")
                                .font(.headline)
                                .foregroundColor(Color.zionTextPrimary)
                            Text("Versión 2.4.0 (Build Native SwiftUI)")
                                .font(.caption)
                                .foregroundColor(Color.zionTextSecondary)
                        }
                        Spacer()
                    }
                    .padding()
                    .background(Color.zionPanel)
                    .cornerRadius(8)
                }
            }
            .padding()
        }
        .background(Color.zionBackground)
    }
}
