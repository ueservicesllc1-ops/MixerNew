//
//  ZionStageApp.swift
//  ZionStageApple
//
//  Punto de entrada nativo Swift de la aplicación Zion Stage para iOS, iPadOS y macOS.
//

import SwiftUI

@main
@available(iOS 15.0, macOS 12.0, *)
struct ZionStageApp: App {
    var body: some Scene {
        WindowGroup {
            MainView()
        }
        #if os(macOS)
        .defaultSize(width: 1280, height: 800)
        #endif
    }
}
