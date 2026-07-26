import SwiftUI

struct MixerLayoutView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var themeManager = ThemeManager.shared
    @State private var selectedTab: Int = 0 // Default to Mixer tab (0) so faders show immediately
    
    private func getShiftedKey(baseKey: String?, shift: Float) -> String {
        let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        let cleanKey = baseKey?.replacingOccurrences(of: "m", with: "").trimmingCharacters(in: .whitespacesAndNewlines) ?? "C"
        guard let index = keys.firstIndex(of: cleanKey.uppercased()) else { return baseKey ?? "C" }
        let shiftSteps = Int(round(shift))
        let newIndex = (index + shiftSteps + keys.count * 120) % keys.count
        let isMinor = baseKey?.contains("m") ?? false
        return keys[newIndex] + (isMinor ? "m" : "")
    }
    
    var body: some View {
        VStack(spacing: 0) {
            
            // 1. Top Transport Bar
            HStack(spacing: 16) {
                
                // Master Fader
                HStack {
                    Text("MASTER").font(.caption2).bold().foregroundColor(Color.zionTextPrimary)
                    Slider(value: Binding(
                        get: { Double(engine.masterVolume) },
                        set: { engine.masterVolume = Float($0) }
                    ), in: 0.0...1.0)
                    .accentColor(Color.zionCyan)
                    .frame(width: 140)
                    Text("\(Int(engine.masterVolume * 100))%").font(.caption2).foregroundColor(Color.zionCyan)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.zionPanelLight)
                .cornerRadius(6)
                
                Spacer()
                
                // Playback Controls
                HStack(spacing: 12) {
                    Button(action: { engine.seek(to: 0) }) { Image(systemName: "backward.end.fill") }
                    Button(action: { engine.isPlaying ? engine.pause() : engine.play() }) {
                        Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                    }
                    .disabled(engine.loadedTracks.isEmpty || engine.isLoading)
                    .opacity((engine.loadedTracks.isEmpty || engine.isLoading) ? 0.4 : 1.0)
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
                
                // BPM & Key Controls
                HStack(spacing: 12) {
                    // BPM
                    let baseBpm = engine.currentSong?.bpm ?? 120.0
                    let currentBpm = baseBpm * Double(engine.tempoRatio)
                    HStack(spacing: 6) {
                        Button(action: {
                            engine.tempoRatio = max(0.5, engine.tempoRatio - 0.01)
                        }) {
                            Text("-")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color.zionCyan)
                                .frame(width: 24, height: 24)
                                .background(Color.zionPanel)
                                .cornerRadius(4)
                        }
                        
                        Text(String(format: "%.1f BPM", currentBpm))
                            .font(.system(size: 11, weight: .bold).monospacedDigit())
                            .foregroundColor(Color.zionTextPrimary)
                            .frame(width: 80, alignment: .center)
                        
                        Button(action: {
                            engine.tempoRatio = min(2.0, engine.tempoRatio + 0.01)
                        }) {
                            Text("+")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color.zionCyan)
                                .frame(width: 24, height: 24)
                                .background(Color.zionPanel)
                                .cornerRadius(4)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                    .background(Color.zionPanelLight)
                    .cornerRadius(6)
                    
                    // Key
                    let baseKey = engine.currentSong?.key ?? "C"
                    let shiftedKey = getShiftedKey(baseKey: baseKey, shift: engine.pitchSemitones)
                    HStack(spacing: 6) {
                        Button(action: {
                            engine.pitchSemitones = max(-12.0, engine.pitchSemitones - 1.0)
                        }) {
                            Text("-")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color.zionCyan)
                                .frame(width: 24, height: 24)
                                .background(Color.zionPanel)
                                .cornerRadius(4)
                        }
                        
                        let shiftInt = Int(round(engine.pitchSemitones))
                        let shiftText = shiftInt == 0 ? "" : (shiftInt > 0 ? " (+\(shiftInt))" : " (\(shiftInt))")
                        Text("\(shiftedKey)\(shiftText)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.zionTextPrimary)
                            .frame(width: 60, alignment: .center)
                        
                        Button(action: {
                            engine.pitchSemitones = min(12.0, engine.pitchSemitones + 1.0)
                        }) {
                            Text("+")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color.zionCyan)
                                .frame(width: 24, height: 24)
                                .background(Color.zionPanel)
                                .cornerRadius(4)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                    .background(Color.zionPanelLight)
                    .cornerRadius(6)
                }
                
                Spacer()
                
                // Profile & Theme Controls
                HStack(spacing: 14) {
                    Text(authViewModel.currentUser?.name ?? "Usuario").font(.caption).foregroundColor(Color.zionTextSecondary)
                    
                    // Theme Switcher (Moon / Sun)
                    Button(action: { themeManager.darkMode.toggle() }) {
                        Image(systemName: themeManager.darkMode ? "sun.max.fill" : "moon.stars.fill")
                            .foregroundColor(themeManager.darkMode ? Color.zionYellow : Color.zionCyan)
                            .font(.system(size: 16, weight: .bold))
                    }
                    
                    Button(action: { authViewModel.logout() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(Color.zionTextSecondary)
                    }
                    
                    Button(action: { selectedTab = 7 }) {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(selectedTab == 7 ? Color.zionCyan : Color.zionTextSecondary)
                    }
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            // 2. Waveform Timeline
            WaveformTimelineView()
                .frame(height: 70)
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
                                    columns: [GridItem(.adaptive(minimum: 140, maximum: 180), spacing: 10)],
                                    spacing: 10
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
    @State private var dragTime: Double? = nil
    
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
                
                let activeTime = dragTime ?? engine.currentTime
                let progressPercent = CGFloat(engine.duration > 0 ? activeTime / engine.duration : 0)
                
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
                            dragTime = Double(percent) * engine.duration
                        }
                        .onEnded { value in
                            if let finalTime = dragTime {
                                engine.seek(to: finalTime)
                            }
                            dragTime = nil
                        }
                )
            }
        }
        .padding(.horizontal)
    }
}
