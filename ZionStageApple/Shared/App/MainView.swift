//
//  MainView.swift
//  ZionStageApple
//
//  Vista contenedora con navegación de pestañas (TabView / Sidebar) para iPhone, iPad y Mac.
//

import SwiftUI

public struct MainView: View {
    @State private var selectedTab: Int = 0
    @State private var isLoggedIn: Bool = true

    public init() {}

    public var body: some View {
        if !isLoggedIn {
            LoginView(onLoginSuccess: {
                isLoggedIn = true
            })
        } else {
            TabView(selection: $selectedTab) {
                MixerView()
                    .tabItem {
                        Label("Consola", systemImage: "slider.vertical.3")
                    }
                    .tag(0)

                SongLibraryView()
                    .tabItem {
                        Label("Librería", systemImage: "music.note.list")
                    }
                    .tag(1)

                PadEngineView()
                    .tabItem {
                        Label("Pads", systemImage: "square.grid.3x3.fill")
                    }
                    .tag(2)
            }
            .accentColor(.cyan)
            .preferredColorScheme(.dark)
        }
    }
}
