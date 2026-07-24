import SwiftUI

struct MixerLayoutView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @State private var selectedTab: Int = 4 // 4 is Lyrics, 0 is Lista... we will just use a simple switcher
    
    var body: some View {
        VStack(spacing: 0) {
            
            // 1. Top Transport Bar
            HStack(spacing: 16) {
                // Menu Buttons
                HStack(spacing: 8) {
                    Button(action: {}) { Image(systemName: "line.3.horizontal") }
                    Button(action: {}) { Image(systemName: "music.note.list") }
                }
                .foregroundColor(Color.zionTextSecondary)
                
                // Master Fader
                HStack {
                    Text("MASTER").font(.caption2).bold().foregroundColor(.white)
                    Slider(value: .constant(1.0))
                        .accentColor(Color.zionCyan)
                        .frame(width: 100)
                    Text("100%").font(.caption2).foregroundColor(Color.zionCyan)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.zionPanelLight)
                .cornerRadius(6)
                
                Spacer()
                
                // Playback Controls
                let engine = AudioEngineViewModel.shared
                HStack(spacing: 12) {
                    Button(action: { engine.seek(to: 0) }) { Image(systemName: "backward.end.fill") }
                    Button(action: { engine.isPlaying ? engine.pause() : engine.play() }) {
                        Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                    }
                    Button(action: { engine.stop() }) { Image(systemName: "stop.fill") }
                    Button(action: {}) { Image(systemName: "forward.end.fill") }
                }
                .foregroundColor(Color.zionTextSecondary)
                .font(.title3)
                
                // Time
                Text(String(format: "%02d:%02d / %02d:%02d",
                            Int(engine.currentTime) / 60, Int(engine.currentTime) % 60,
                            Int(engine.duration) / 60, Int(engine.duration) % 60))
                    .foregroundColor(Color.zionTextPrimary)
                    .font(.caption.monospacedDigit())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.zionPanelLight)
                    .cornerRadius(6)
                
                // BPM & Key
                HStack(spacing: 12) {
                    HStack {
                        Text("-").foregroundColor(.gray)
                        Text("148.0 BPM").foregroundColor(.white)
                        Text("+").foregroundColor(.gray)
                    }
                    HStack {
                        Text("-").foregroundColor(.gray)
                        Text("F").foregroundColor(.white)
                        Text("+").foregroundColor(.gray)
                    }
                }
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.zionPanelLight)
                .cornerRadius(6)
                
                Spacer()
                
                // Profile
                HStack(spacing: 12) {
                    Text("Luis Uchubanda").font(.caption).foregroundColor(Color.zionTextSecondary)
                    Button(action: { authViewModel.logout() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(Color.zionTextSecondary)
                    }
                    Image(systemName: "arrow.triangle.2.circlepath").foregroundColor(Color.zionTextSecondary)
                    Image(systemName: "gearshape").foregroundColor(Color.zionTextSecondary)
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            // 2. Waveform Placeholder
            Rectangle()
                .fill(Color.zionPanelLight)
                .frame(height: 60)
                .overlay(
                    Text("Onda Guardada (Waveform)").foregroundColor(Color.zionTextSecondary).font(.caption)
                )
            
            // 3. Tab Bar
            HStack(spacing: 4) {
                let tabs = ["Lista", "Biblioteca", "Pads", "Partituras", "Lyrics", "Acordes", "Metrónomo", "Ajustes"]
                ForEach(0..<tabs.count, id: \.self) { i in
                    Button(action: { selectedTab = i }) {
                        Text(tabs[i])
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(selectedTab == i ? Color.zionCyan : Color.zionTextSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(selectedTab == i ? Color.zionPanelLight : Color.zionPanel)
                            .cornerRadius(4)
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.zionBackground)
            
            // 4. Main Content Area
            HStack(spacing: 8) {
                // Left: Mixer or Lyrics
                VStack {
                    if selectedTab == 4 {
                        LyricsView()
                    } else {
                        ScrollView(.horizontal, showsIndicators: true) {
                            HStack(spacing: 8) {
                                if AudioEngineViewModel.shared.loadedTracks.isEmpty {
                                    Text("Selecciona una canción del setlist para comenzar.")
                                        .foregroundColor(Color.zionTextSecondary)
                                        .padding(.top, 50)
                                } else {
                                    ForEach(AudioEngineViewModel.shared.loadedTracks) { track in
                                        MixerChannelView(track: track)
                                    }
                                }
                            }
                            .padding(8)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .background(Color.zionBackground)
                
                // Right: Setlist (fixed)
                SetlistsView()
                    .frame(width: 320)
            }
            .background(Color.zionBackground)
        }
        .background(Color.zionBackground)
    }
}
