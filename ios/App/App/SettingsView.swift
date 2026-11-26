import SwiftUI

struct SettingsView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @ObservedObject var themeManager = ThemeManager.shared
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var downloader = DownloadManager.shared
    
    @State private var enableAutoScroll: Bool = true
    @State private var cacheSizeMB: Double = 0.0
    @State private var showClearCacheAlert: Bool = false
    
    private var appVersion: String {
        let ver = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.2"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "v\(ver) (Build \(build))"
    }
    
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
                            Text("Plan: \(authViewModel.currentUser?.displayPlanLabel ?? "Gratuito (100 GB incluidos)")")
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
                        Toggle(isOn: Binding(
                            get: { engine.splitRoutingMode },
                            set: { engine.applyRoutingMode(split: $0) }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Modo Split Estéreo (Click Der / Música Izq)")
                                    .foregroundColor(Color.zionTextPrimary)
                                Text("Desactívalo para escuchar todas las pistas al centro en Estéreo")
                                    .font(.caption)
                                    .foregroundColor(Color.zionTextSecondary)
                            }
                        }
                        .toggleStyle(SwitchToggleStyle(tint: Color.zionCyan))
                    }
                    .font(.subheadline)
                    .padding()
                    .background(Color.zionPanel)
                    .cornerRadius(8)
                }
                
                // Offline Storage Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("ALMACENAMIENTO LOCAL OFFLINE")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(String(format: "Pistas guardadas localmente: %.1f MB", cacheSizeMB))
                                .font(.subheadline.bold())
                                .foregroundColor(Color.zionTextPrimary)
                            Text("Se conservan al actualizar la app para carga instantánea en vivo.")
                                .font(.caption)
                                .foregroundColor(Color.zionTextSecondary)
                        }
                        Spacer()
                        Button(action: { showClearCacheAlert = true }) {
                            Text("Limpiar Caché")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Color.zionRed.opacity(0.85))
                                .cornerRadius(6)
                        }
                    }
                    .padding()
                    .background(Color.zionPanel)
                    .cornerRadius(8)
                }
                
                // Preferences Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("PREFERENCIAS")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.zionTextSecondary)
                    
                    VStack(spacing: 12) {
                        Toggle(isOn: $enableAutoScroll) {
                            Text("Desplazamiento Automático de Letras")
                                .foregroundColor(Color.zionTextPrimary)
                        }
                        .toggleStyle(SwitchToggleStyle(tint: Color.zionCyan))
                        
                        Divider().background(Color.zionBorderSubtle)
                        
                        Toggle(isOn: $themeManager.darkMode) {
                            Text("Modo Nocturno (Tema Oscuro)")
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
                            Text("Versión \(appVersion)")
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
        .onAppear {
            DispatchQueue.global(qos: .utility).async {
                let mb = downloader.getCacheSizeMB()
                DispatchQueue.main.async {
                    self.cacheSizeMB = mb
                }
            }
        }
        .alert("¿Limpiar pistas descargadas?", isPresented: $showClearCacheAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Limpiar", role: .destructive) {
                downloader.clearAudioCache()
                cacheSizeMB = 0.0
            }
        } message: {
            Text("Se eliminarán los archivos de audio locales. Podrás volver a descargarlos cuando los necesites.")
        }
    }
}
