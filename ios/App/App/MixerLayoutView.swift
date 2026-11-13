import SwiftUI

struct MixerLayoutView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var themeManager = ThemeManager.shared
    @StateObject private var sharedDataStore = DataStore()
    @State private var selectedTab: Int = 0 // 0: Consola, 1: Biblioteca, 2: Pads, 3: Partituras, 4: Lyrics, 5: Acordes, 6: Metrónomo, 7: Ajustes
    @State private var showSetlistSidebar: Bool = true
    
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
        GeometryReader { geo in
            // iPhones in landscape have height ~375-430pt; iPads in landscape have height ~744-1024pt
            let isCompact = geo.size.height < 520
            let sidebarWidth: CGFloat = isCompact
                ? min(255, max(210, geo.size.width * 0.31))
                : min(350, max(280, geo.size.width * 0.33))
            
            VStack(spacing: 0) {
                
                // 1. Top Transport Bar (Responsive for both iPhone & iPad)
                HStack(spacing: isCompact ? 8 : 14) {
                    
                    // Master Fader
                    HStack(spacing: 5) {
                        Text("MASTER")
                            .font(.system(size: isCompact ? 9 : 11, weight: .bold))
                            .foregroundColor(Color.zionTextPrimary)
                            .lineLimit(1)
                            .fixedSize()
                        
                        Slider(value: Binding(
                            get: { Double(engine.masterVolume) },
                            set: { engine.masterVolume = Float($0) }
                        ), in: 0.0...1.0)
                        .accentColor(Color.zionCyan)
                        .frame(width: isCompact ? 68 : 110)
                        
                        Text("\(Int(engine.masterVolume * 100))%")
                            .font(.system(size: isCompact ? 10 : 11, weight: .bold).monospacedDigit())
                            .foregroundColor(Color.zionCyan)
                            .frame(width: isCompact ? 32 : 38, alignment: .trailing)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, isCompact ? 6 : 10)
                    .padding(.vertical, isCompact ? 4 : 6)
                    .background(Color.zionPanelLight)
                    .cornerRadius(6)
                    
                    Spacer(minLength: 2)
                    
                    // Playback Controls
                    HStack(spacing: isCompact ? 10 : 14) {
                        Button(action: { engine.seek(to: 0) }) {
                            Image(systemName: "backward.end.fill")
                                .font(.system(size: isCompact ? 13 : 16, weight: .bold))
                                .foregroundColor(Color.zionTextSecondary)
                        }
                        
                        Button(action: { engine.isPlaying ? engine.pause() : engine.play() }) {
                            ZStack {
                                Circle()
                                    .fill(engine.isPlaying ? Color.zionOrange : Color.zionCyan)
                                    .frame(width: isCompact ? 32 : 40, height: isCompact ? 32 : 40)
                                    .shadow(color: (engine.isPlaying ? Color.zionOrange : Color.zionCyan).opacity(0.6), radius: 5)
                                
                                Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                                    .font(.system(size: isCompact ? 14 : 17, weight: .bold))
                                    .foregroundColor(.black)
                                    .offset(x: engine.isPlaying ? 0 : 1.5)
                            }
                        }
                        .disabled(engine.loadedTracks.isEmpty || engine.isLoading)
                        .opacity((engine.loadedTracks.isEmpty || engine.isLoading) ? 0.4 : 1.0)
                        
                        Button(action: { engine.stop() }) {
                            Image(systemName: "stop.fill")
                                .font(.system(size: isCompact ? 13 : 16, weight: .bold))
                                .foregroundColor(Color.zionTextSecondary)
                        }
                    }
                    
                    // Time Counter
                    Text(String(format: "%02d:%02d / %02d:%02d",
                                Int(engine.currentTime) / 60, Int(engine.currentTime) % 60,
                                Int(engine.duration) / 60, Int(engine.duration) % 60))
                        .foregroundColor(Color.zionTextPrimary)
                        .font(.system(size: isCompact ? 10 : 12, weight: .semibold).monospacedDigit())
                        .padding(.horizontal, isCompact ? 6 : 10)
                        .padding(.vertical, isCompact ? 4 : 6)
                        .background(Color.zionPanelLight)
                        .cornerRadius(6)
                        .fixedSize()
                    
                    // BPM & Key Controls
                    HStack(spacing: isCompact ? 6 : 10) {
                        // BPM
                        let baseBpm = engine.currentSong?.bpm ?? 120.0
                        let currentBpm = baseBpm * Double(engine.tempoRatio)
                        HStack(spacing: 4) {
                            Button(action: {
                                engine.tempoRatio = max(0.5, engine.tempoRatio - 0.01)
                            }) {
                                Text("-")
                                    .font(.system(size: isCompact ? 13 : 15, weight: .bold))
                                    .foregroundColor(Color.zionCyan)
                                    .frame(width: isCompact ? 20 : 24, height: isCompact ? 20 : 24)
                                    .background(Color.zionPanel)
                                    .cornerRadius(4)
                            }
                            
                            Text(String(format: "%.0f BPM", currentBpm))
                                .font(.system(size: isCompact ? 10 : 11, weight: .bold).monospacedDigit())
                                .foregroundColor(Color.zionTextPrimary)
                                .frame(minWidth: isCompact ? 50 : 64, alignment: .center)
                                .lineLimit(1)
                            
                            Button(action: {
                                engine.tempoRatio = min(2.0, engine.tempoRatio + 0.01)
                            }) {
                                Text("+")
                                    .font(.system(size: isCompact ? 13 : 15, weight: .bold))
                                    .foregroundColor(Color.zionCyan)
                                    .frame(width: isCompact ? 20 : 24, height: isCompact ? 20 : 24)
                                    .background(Color.zionPanel)
                                    .cornerRadius(4)
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                        .background(Color.zionPanelLight)
                        .cornerRadius(6)
                        
                        // Key
                        let baseKey = engine.currentSong?.key ?? "C"
                        let shiftedKey = getShiftedKey(baseKey: baseKey, shift: engine.pitchSemitones)
                        HStack(spacing: 4) {
                            Button(action: {
                                engine.pitchSemitones = max(-12.0, engine.pitchSemitones - 1.0)
                            }) {
                                Text("-")
                                    .font(.system(size: isCompact ? 13 : 15, weight: .bold))
                                    .foregroundColor(Color.zionCyan)
                                    .frame(width: isCompact ? 20 : 24, height: isCompact ? 20 : 24)
                                    .background(Color.zionPanel)
                                    .cornerRadius(4)
                            }
                            
                            let shiftInt = Int(round(engine.pitchSemitones))
                            let shiftText = shiftInt == 0 ? "" : (shiftInt > 0 ? "+\(shiftInt)" : "\(shiftInt)")
                            Text(shiftText.isEmpty ? shiftedKey : "\(shiftedKey)(\(shiftText))")
                                .font(.system(size: isCompact ? 10 : 11, weight: .bold))
                                .foregroundColor(Color.zionTextPrimary)
                                .frame(minWidth: isCompact ? 36 : 48, alignment: .center)
                                .lineLimit(1)
                            
                            Button(action: {
                                engine.pitchSemitones = min(12.0, engine.pitchSemitones + 1.0)
                            }) {
                                Text("+")
                                    .font(.system(size: isCompact ? 13 : 15, weight: .bold))
                                    .foregroundColor(Color.zionCyan)
                                    .frame(width: isCompact ? 20 : 24, height: isCompact ? 20 : 24)
                                    .background(Color.zionPanel)
                                    .cornerRadius(4)
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                        .background(Color.zionPanelLight)
                        .cornerRadius(6)
                    }
                    
                    Spacer(minLength: 2)
                    
                    // Right Icons (Sidebar toggle on compact, Theme, Settings, Logout)
                    HStack(spacing: isCompact ? 10 : 14) {
                        if !isCompact {
                            Text(authViewModel.currentUser?.name ?? "Usuario")
                                .font(.caption)
                                .foregroundColor(Color.zionTextSecondary)
                                .lineLimit(1)
                        }
                        
                        Button(action: { showSetlistSidebar.toggle() }) {
                            Image(systemName: "sidebar.right")
                                .foregroundColor(showSetlistSidebar ? Color.zionCyan : Color.zionTextSecondary)
                                .font(.system(size: isCompact ? 14 : 16, weight: .bold))
                        }
                        
                        Button(action: { selectedTab = 7 }) {
                            Image(systemName: "gearshape.fill")
                                .foregroundColor(selectedTab == 7 ? Color.zionCyan : Color.zionTextSecondary)
                                .font(.system(size: isCompact ? 14 : 16, weight: .bold))
                        }
                        
                        Button(action: { authViewModel.logout() }) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .foregroundColor(Color.zionTextSecondary)
                                .font(.system(size: isCompact ? 14 : 16, weight: .bold))
                        }
                    }
                }
                .padding(.horizontal, isCompact ? 10 : 16)
                .padding(.vertical, isCompact ? 5 : 10)
                .background(Color.zionPanel)
                
                // 2. Waveform Timeline
                WaveformTimelineView()
                    .frame(height: isCompact ? 36 : 64)
                    .padding(.vertical, isCompact ? 3 : 6)
                
                // 3. Tab Bar
                let tabs = ["Consola", "Biblioteca", "Pads", "Partituras", "Lyrics", "Acordes", "Metrónomo", "Ajustes"]
                HStack(spacing: 4) {
                    ForEach(0..<tabs.count, id: \.self) { i in
                        Button(action: { selectedTab = i }) {
                            Text(tabs[i])
                                .font(.system(size: isCompact ? 10.5 : 12, weight: .semibold))
                                .foregroundColor(selectedTab == i ? Color.zionCyan : Color.zionTextSecondary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, isCompact ? 5 : 9)
                                .background(selectedTab == i ? Color.zionPanelLight : Color.zionPanel)
                                .cornerRadius(4)
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, isCompact ? 2 : 4)
                .background(Color.zionBackground)
                
                // 4. Main Content Area
                HStack(spacing: 6) {
                    // Left Main Area
                    GeometryReader { mainGeo in
                        let availHeight = mainGeo.size.height
                        let calculatedFaderHeight = max(72, availHeight - (isCompact ? 96 : 122))
                        
                        Group {
                            if selectedTab == 1 {
                                LibraryDrawerSheet(isEmbedded: true, onAddSongToSetlist: { song in
                                    sharedDataStore.addSongToSetlist(song: song)
                                })
                            } else if selectedTab == 2 {
                                ScrollView {
                                    VStack(spacing: 12) {
                                        Text("AMBIENT PADS")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundColor(Color.zionCyan)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .padding(.horizontal, 12)
                                            .padding(.top, 8)
                                        PadEngineView()
                                            .padding(.horizontal, 12)
                                    }
                                }
                            } else if selectedTab == 3 {
                                LyricsView(mode: .chords)
                            } else if selectedTab == 4 {
                                LyricsView(mode: .lyrics)
                            } else if selectedTab == 5 {
                                LyricsView(mode: .chords)
                            } else if selectedTab == 6 {
                                // Quick Metronome / Tempo View
                                VStack(spacing: 14) {
                                    Spacer()
                                    Image(systemName: "metronome.fill")
                                        .font(.system(size: isCompact ? 32 : 44))
                                        .foregroundColor(Color.zionCyan)
                                    let baseBpm = engine.currentSong?.bpm ?? 120.0
                                    let currentBpm = baseBpm * Double(engine.tempoRatio)
                                    Text(String(format: "%.1f BPM", currentBpm))
                                        .font(.system(size: isCompact ? 24 : 32, weight: .black).monospacedDigit())
                                        .foregroundColor(.white)
                                    HStack(spacing: 16) {
                                        Button("-5 BPM") {
                                            engine.tempoRatio = max(0.5, engine.tempoRatio - Float(5.0 / baseBpm))
                                        }
                                        .padding(.horizontal, 14).padding(.vertical, 8)
                                        .background(Color.zionPanelLight).foregroundColor(.white).cornerRadius(8)
                                        
                                        Button("Reset (100%)") {
                                            engine.tempoRatio = 1.0
                                        }
                                        .padding(.horizontal, 14).padding(.vertical, 8)
                                        .background(Color.zionCyan).foregroundColor(.black).cornerRadius(8)
                                        
                                        Button("+5 BPM") {
                                            engine.tempoRatio = min(2.0, engine.tempoRatio + Float(5.0 / baseBpm))
                                        }
                                        .padding(.horizontal, 14).padding(.vertical, 8)
                                        .background(Color.zionPanelLight).foregroundColor(.white).cornerRadius(8)
                                    }
                                    Spacer()
                                }
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                            } else if selectedTab == 7 {
                                SettingsView(authViewModel: authViewModel)
                            } else {
                                // Tab 0: Consola (Mixer Channels)
                                if engine.loadedTracks.isEmpty {
                                    VStack(spacing: 10) {
                                        Spacer()
                                        Image(systemName: "slider.vertical.3")
                                            .font(.system(size: isCompact ? 28 : 40))
                                            .foregroundColor(Color.zionTextSecondary)
                                        Text("Selecciona una canción del repertorio o de la Biblioteca")
                                            .font(.system(size: isCompact ? 13 : 15, weight: .medium))
                                            .foregroundColor(Color.zionTextSecondary)
                                            .multilineTextAlignment(.center)
                                        Button(action: { selectedTab = 1 }) {
                                            Text("Abrir Biblioteca de Pistas")
                                                .font(.system(size: 12, weight: .bold))
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 8)
                                                .background(Color.zionCyan)
                                                .foregroundColor(.black)
                                                .cornerRadius(8)
                                        }
                                        Spacer()
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                } else {
                                    // Multi-row grid (2 or 3 rows depending on track count, just like iPad & desktop design)
                                    let trackCount = engine.loadedTracks.count
                                    let colsCount: Int = {
                                        if trackCount <= 8 { return 4 }
                                        if trackCount <= 10 { return 5 }
                                        return 6
                                    }()
                                    let targetRows: CGFloat = trackCount > 12 ? (isCompact ? 2.0 : 3.0) : 2.0
                                    let gridSpacing: CGFloat = isCompact ? 6 : 8
                                    let rowAvailHeight = (availHeight - 12 - (gridSpacing * (targetRows - 1))) / targetRows
                                    let gridFaderHeight = max(52, rowAvailHeight - (isCompact ? 62 : 84))
                                    let gridColumns = Array(repeating: GridItem(.flexible(), spacing: gridSpacing), count: colsCount)
                                    
                                    ScrollView(.vertical, showsIndicators: true) {
                                        LazyVGrid(columns: gridColumns, spacing: gridSpacing) {
                                            ForEach(engine.loadedTracks) { track in
                                                MixerChannelView(
                                                    track: track,
                                                    compact: isCompact || trackCount > 12,
                                                    faderHeight: gridFaderHeight
                                                )
                                            }
                                        }
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 6)
                                    }
                                }
                            }
                        }
                        .frame(width: mainGeo.size.width, height: mainGeo.size.height)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.zionBackground)
                    
                    // Right: Setlist Sidebar
                    if showSetlistSidebar {
                        SetlistsView(
                            dataStore: sharedDataStore,
                            compact: isCompact,
                            onOpenLibrary: { selectedTab = 1 },
                            onOpenPads: { selectedTab = 2 }
                        )
                        .frame(width: sidebarWidth)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.zionBackground)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .background(Color.zionBackground)
        }
        .background(Color.zionBackground.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

// MARK: - Interactive Waveform Timeline View
struct WaveformTimelineView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    @State private var dragTime: Double? = nil

    var body: some View {
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
                        let step = width / CGFloat(max(1, peaks.count))
                        let midY = height / 2
                        
                        for (i, peak) in peaks.enumerated() {
                            let x = CGFloat(i) * step
                            let barHeight = max(2, CGFloat(peak) * height * 0.82)
                            path.move(to: CGPoint(x: x, y: midY - barHeight / 2))
                            path.addLine(to: CGPoint(x: x, y: midY + barHeight / 2))
                        }
                    }
                    .stroke(Color.zionCyan.opacity(0.65), lineWidth: 1.5)
                } else if engine.isLoading {
                    HStack(spacing: 8) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                            .scaleEffect(0.75)
                        Text(engine.loadLabel)
                            .font(.caption)
                            .foregroundColor(Color.zionCyan)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                } else {
                    Text(engine.currentSong?.name ?? "Ninguna canción cargada")
                        .font(.caption)
                        .foregroundColor(Color.zionTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                
                // Progress Fill
                Rectangle()
                    .fill(Color.zionCyan.opacity(0.18))
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
                        let percent = max(0, min(1, value.location.x / max(1, width)))
                        dragTime = Double(percent) * engine.duration
                    }
                    .onEnded { _ in
                        if let finalTime = dragTime {
                            engine.seek(to: finalTime)
                        }
                        dragTime = nil
                    }
            )
        }
        .padding(.horizontal, 8)
    }
}
