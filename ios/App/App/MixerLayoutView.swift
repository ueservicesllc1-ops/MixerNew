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
                    Text(authViewModel.currentUser?.name ?? "Usuario").font(.caption).foregroundColor(Color.zionTextSecondary)
                    Button(action: { authViewModel.logout() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(Color.zionTextSecondary)
                    }
                    Button(action: {}) {
                        Image(systemName: "arrow.triangle.2.circlepath").foregroundColor(Color.zionTextSecondary)
                    }
                    Button(action: { selectedTab = 7 }) {
                        Image(systemName: "gearshape").foregroundColor(selectedTab == 7 ? Color.zionCyan : Color.zionTextSecondary)
                    }
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            // 2. Waveform Timeline
            WaveformTimelineView()
                .frame(height: 50)
                .padding(.vertical, 6)
            
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
                // Left: Mixer, Lyrics or Settings
                VStack {
                    if selectedTab == 4 {
                        LyricsView()
                    } else if selectedTab == 7 {
                        SettingsView(authViewModel: authViewModel)
                    } else {
                        if AudioEngineViewModel.shared.loadedTracks.isEmpty {
                            VStack {
                                Spacer()
                                Text("Selecciona una canción del setlist para comenzar.")
                                    .foregroundColor(Color.zionTextSecondary)
                                Spacer()
                            }
                        } else {
                            ScrollView(.vertical, showsIndicators: true) {
                                LazyVGrid(
                                    columns: [GridItem(.adaptive(minimum: 110, maximum: 150), spacing: 8)],
                                    spacing: 8
                                ) {
                                    ForEach(AudioEngineViewModel.shared.loadedTracks) { track in
                                        MixerChannelView(track: track)
                                    }
                                }
                                .padding(8)
                            }
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

// MARK: - Interactive Waveform Timeline View
struct WaveformTimelineView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    
    private func formatTime(_ seconds: Double) -> String {
        guard !seconds.isNaN && seconds >= 0 else { return "00:00" }
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { geo in
                let width = geo.size.width
                let height = geo.size.height
                let progressPercent = CGFloat(engine.duration > 0 ? engine.currentTime / engine.duration : 0)
                
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.zionPanelLight)
                    
                    if !engine.waveformPeaks.isEmpty {
                        Path { path in
                            let peaks = engine.waveformPeaks
                            let step = width / CGFloat(peaks.count)
                            let midY = height / 2
                            
                            for (i, peak) in peaks.enumerated() {
                                let x = CGFloat(i) * step
                                let barHeight = max(2, CGFloat(peak) * height * 0.8)
                                path.move(to: CGPoint(x: x, y: midY - barHeight / 2))
                                path.addLine(to: CGPoint(x: x, y: midY + barHeight / 2))
                            }
                        }
                        .stroke(Color.zionCyan.opacity(0.6), lineWidth: 1.5)
                    } else if engine.isLoading {
                        HStack(spacing: 8) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                                .scaleEffect(0.8)
                            Text(engine.loadLabel)
                                .font(.caption)
                                .foregroundColor(Color.zionCyan)
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        Text("Ninguna canción cargada")
                            .font(.caption)
                            .foregroundColor(Color.zionTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    
                    // Progress Fill
                    Rectangle()
                        .fill(Color.zionCyan.opacity(0.15))
                        .frame(width: max(0, min(width, progressPercent * width)))
                    
                    // Playhead
                    Rectangle()
                        .fill(Color.white)
                        .frame(width: 2, height: height)
                        .shadow(color: Color.zionCyan, radius: 4)
                        .offset(x: max(0, min(width - 2, progressPercent * width)))
                }
                .cornerRadius(6)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let percent = max(0, min(1, value.location.x / width))
                            engine.seek(to: Double(percent) * engine.duration)
                        }
                )
            }
        }
        .padding(.horizontal)
    }
}
