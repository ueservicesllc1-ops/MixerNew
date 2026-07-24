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

    @StateObject private var firebase: FirebaseService

    init() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        _firebase = StateObject(wrappedValue: FirebaseService.shared)
    }

    var body: some Scene {
        WindowGroup {
            MainView()
                .environmentObject(firebase)
        }
    }
}
