//
//  ZionStageApp.swift
//  ZionStageApple
//
//  Punto de entrada nativo Swift — iOS 15+, iPadOS 15+, macOS 12+.
//  Inicializa Firebase en el arranque y provee FirebaseService como EnvironmentObject.
//

import SwiftUI
import FirebaseCore

@main
struct ZionStageApp: App {

    // FirebaseService como StateObject: se crea una única vez y persiste en toda la app.
    @StateObject private var firebase = FirebaseService.shared

    init() {
        // Configurar Firebase con GoogleService-Info.plist embebido en el bundle
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            MainView()
                .environmentObject(firebase)
        }
    }
}
