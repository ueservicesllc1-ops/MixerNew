import SwiftUI

struct MixerLayoutView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @ObservedObject var engine = AudioEngineViewModel.shared
    @ObservedObject var themeManager = ThemeManager.shared
    @ObservedObject var metronome = ZionMetronome.shared
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
    
    private func switchSetlistSong(offset: Int) {
        guard let activeSetlist = sharedDataStore.activeSetlist,
              let songs = activeSetlist.songs, !songs.isEmpty else { return }
        let currentIdx = songs.firstIndex(where: { $0.id == engine.currentSong?.id }) ?? -1
        let nextIdx = currentIdx + offset
        guard nextIdx >= 0 && nextIdx < songs.count else { return }
        engine.loadSong(songs[nextIdx], inSetlist: activeSetlist)
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
                        .frame(width: isCompact ? 62 : 105)
                        
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
                    
                    // Playback Controls (with Prev / Next song for fast live stage switching)
                    HStack(spacing: isCompact ? 8 : 12) {
                        Button(action: { switchSetlistSong(offset: -1) }) {
                            Image(systemName: "backward.fill")
                                .font(.system(size: isCompact ? 12 : 14, weight: .bold))
                                .foregroundColor(Color.zionTextSecondary)
                        }
                        
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
                        
                        Button(action: { switchSetlistSong(offset: 1) }) {
                            Image(systemName: "forward.fill")
                                .font(.system(size: isCompact ? 12 : 14, weight: .bold))
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
                    
                    // BPM & Key Controls (Exact ±1 BPM steps + Tap to Reset)
                    HStack(spacing: isCompact ? 6 : 10) {
                        // BPM
                        let baseBpm = max(40.0, engine.currentSong?.bpm ?? 120.0)
                        let currentBpm = baseBpm * Double(engine.tempoRatio)
                        HStack(spacing: 4) {
                            Button(action: {
                                let target = max(baseBpm * 0.5, round(currentBpm) - 1.0)
                                engine.tempoRatio = Float(target / baseBpm)
                            }) {
                                Text("-")
                                    .font(.system(size: isCompact ? 13 : 15, weight: .bold))
                                    .foregroundColor(Color.zionCyan)
                                    .frame(width: isCompact ? 20 : 24, height: isCompact ? 20 : 24)
                                    .background(Color.zionPanel)
                                    .cornerRadius(4)
                            }
                            
                            Button(action: { engine.tempoRatio = 1.0 }) {
                                Text(String(format: "%.0f BPM", currentBpm))
                                    .font(.system(size: isCompact ? 10 : 11, weight: .bold).monospacedDigit())
                                    .foregroundColor(abs(engine.tempoRatio - 1.0) > 0.004 ? Color.zionCyan : Color.zionTextPrimary)
                                    .frame(minWidth: isCompact ? 48 : 62, alignment: .center)
                                    .lineLimit(1)
                            }
                            .buttonStyle(PlainButtonStyle())
                            
                            Button(action: {
                                let target = min(baseBpm * 2.0, round(currentBpm) + 1.0)
                                engine.tempoRatio = Float(target / baseBpm)
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
                        
                        // Key (Tap readout to reset pitch to 0)
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
                            Button(action: { engine.pitchSemitones = 0.0 }) {
                                Text(shiftText.isEmpty ? shiftedKey : "\(shiftedKey)(\(shiftText))")
                                    .font(.system(size: isCompact ? 10 : 11, weight: .bold))
                                    .foregroundColor(shiftInt != 0 ? Color.zionCyan : Color.zionTextPrimary)
                                    .frame(minWidth: isCompact ? 34 : 46, alignment: .center)
                                    .lineLimit(1)
                            }
                            .buttonStyle(PlainButtonStyle())
                            
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
                    
                    // Right Icons
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
                
                // 2. Real Interactive Waveform Timeline
                WaveformTimelineView()
                    .frame(height: isCompact ? 38 : 66)
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
                                LibraryDrawerSheet(
                                    isEmbedded: true,
                                    canAccessGlobal: authViewModel.hasVipAccess,
                                    onAddSongToSetlist: { song in
                                        sharedDataStore.addSongToSetlist(song: song)
                                    }
                                )
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
                                // Real Audio Metronome View (Android Parity)
                                MetronomeTabView(compact: isCompact)
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
                                    if isCompact {
                                        ScrollView(.horizontal, showsIndicators: true) {
                                            HStack(alignment: .center, spacing: 6) {
                                                ForEach(engine.loadedTracks) { track in
                                                    MixerChannelView(
                                                        track: track,
                                                        compact: true,
                                                        channelWidth: 98,
                                                        faderHeight: calculatedFaderHeight
                                                    )
                                                }
                                            }
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .frame(minHeight: availHeight)
                                        }
                                    } else {
                                        let ipadRowHeight = (availHeight - 24) / 2.0
                                        let ipadFaderHeight = max(130, ipadRowHeight - 92)
                                        ScrollView(.vertical, showsIndicators: true) {
                                            LazyVGrid(
                                                columns: [GridItem(.adaptive(minimum: 138, maximum: 175), spacing: 10)],
                                                spacing: 10
                                            ) {
                                                ForEach(engine.loadedTracks) { track in
                                                    MixerChannelView(
                                                        track: track,
                                                        compact: false,
                                                        channelWidth: 148,
                                                        faderHeight: ipadFaderHeight
                                                    )
                                                }
                                            }
                                            .padding(8)
                                        }
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
                            canAccessGlobal: authViewModel.hasVipAccess,
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

// MARK: - Real Audio Metronome View (Android Parity)
struct MetronomeTabView: View {
    @ObservedObject var metronome = ZionMetronome.shared
    @ObservedObject var engine = AudioEngineViewModel.shared
    var compact: Bool = false
    
    let signatures = [2, 3, 4, 6]
    
    var body: some View {
        ScrollView {
            VStack(spacing: compact ? 10 : 18) {
                // Visual Beat Indicators
                HStack(spacing: compact ? 10 : 16) {
                    ForEach(1...max(1, metronome.beatsPerMeasure), id: \.self) { beat in
                        let isLit = metronome.isRunning && metronome.currentBeat == beat
                        let isAccent = (beat == 1)
                        Circle()
                            .fill(isLit ? (isAccent ? Color.zionOrange : Color.zionCyan) : Color.zionPanelLight)
                            .frame(width: compact ? 18 : 26, height: compact ? 18 : 26)
                            .overlay(
                                Circle().stroke(isAccent ? Color.zionOrange.opacity(0.6) : Color.zionCyan.opacity(0.4), lineWidth: 1.5)
                            )
                            .shadow(color: isLit ? (isAccent ? Color.zionOrange : Color.zionCyan).opacity(0.75) : .clear, radius: 8)
                    }
                }
                .padding(.top, compact ? 6 : 16)
                
                // BPM Display & +/- Controls
                HStack(spacing: compact ? 10 : 16) {
                    Button("-5") { metronome.bpm = max(40, metronome.bpm - 5) }
                        .font(.system(size: compact ? 12 : 14, weight: .bold))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.zionPanelLight).foregroundColor(.white).cornerRadius(8)
                    
                    Button("-1") { metronome.bpm = max(40, metronome.bpm - 1) }
                        .font(.system(size: compact ? 12 : 14, weight: .bold))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.zionPanelLight).foregroundColor(Color.zionCyan).cornerRadius(8)
                    
                    Text(String(format: "%.0f BPM", metronome.bpm))
                        .font(.system(size: compact ? 24 : 34, weight: .black).monospacedDigit())
                        .foregroundColor(.white)
                        .frame(minWidth: compact ? 110 : 150)
                    
                    Button("+1") { metronome.bpm = min(240, metronome.bpm + 1) }
                        .font(.system(size: compact ? 12 : 14, weight: .bold))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.zionPanelLight).foregroundColor(Color.zionCyan).cornerRadius(8)
                    
                    Button("+5") { metronome.bpm = min(240, metronome.bpm + 5) }
                        .font(.system(size: compact ? 12 : 14, weight: .bold))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.zionPanelLight).foregroundColor(.white).cornerRadius(8)
                }
                
                // Play/Stop + Tap Tempo + Sync to Song
                HStack(spacing: 12) {
                    Button(action: { metronome.toggle() }) {
                        HStack(spacing: 6) {
                            Image(systemName: metronome.isRunning ? "stop.fill" : "play.fill")
                            Text(metronome.isRunning ? "DETENER" : "INICIAR CLICK")
                        }
                        .font(.system(size: compact ? 12 : 14, weight: .black))
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(metronome.isRunning ? Color.zionRed : Color.zionCyan)
                        .foregroundColor(metronome.isRunning ? .white : .black)
                        .cornerRadius(8)
                    }
                    
                    Button(action: { metronome.tapTempo() }) {
                        Text("TAP TEMPO")
                            .font(.system(size: compact ? 12 : 14, weight: .bold))
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(Color.zionPanelLight)
                            .foregroundColor(Color.zionCyan)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.zionCyan.opacity(0.5), lineWidth: 1))
                    }
                    
                    if let songBpm = engine.currentSong?.bpm {
                        Button(action: {
                            metronome.bpm = round(songBpm * Double(engine.tempoRatio))
                        }) {
                            Text("Sync Canción (\(Int(round(songBpm * Double(engine.tempoRatio)))))")
                                .font(.system(size: compact ? 11 : 12, weight: .bold))
                                .padding(.horizontal, 12).padding(.vertical, 10)
                                .background(Color.purple.opacity(0.25))
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }
                }
                
                // Time Signature & Volume
                HStack(spacing: 16) {
                    HStack(spacing: 6) {
                        Text("Compás:")
                            .font(.caption.bold())
                            .foregroundColor(Color.zionTextSecondary)
                        ForEach(signatures, id: \.self) { sig in
                            Button(action: { metronome.beatsPerMeasure = sig }) {
                                Text(sig == 6 ? "6/8" : "\(sig)/4")
                                    .font(.system(size: 11, weight: .bold))
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(metronome.beatsPerMeasure == sig ? Color.zionCyan : Color.zionPanelLight)
                                    .foregroundColor(metronome.beatsPerMeasure == sig ? .black : Color.zionTextSecondary)
                                    .cornerRadius(6)
                            }
                        }
                    }
                    
                    HStack(spacing: 6) {
                        Image(systemName: "speaker.wave.2.fill")
                            .foregroundColor(Color.zionCyan)
                            .font(.caption)
                        Slider(value: Binding(
                            get: { Double(metronome.volume) },
                            set: { metronome.volume = Float($0) }
                        ), in: 0.0...1.0)
                        .accentColor(Color.zionCyan)
                        .frame(width: compact ? 90 : 140)
                    }
                }
                .padding(.bottom, 10)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Interactive Real Waveform Timeline View (Played vs Unplayed Split)
struct WaveformTimelineView: View {
    @ObservedObject var engine = AudioEngineViewModel.shared
    @State private var dragTime: Double? = nil

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let height = geo.size.height
            
            let activeTime = dragTime ?? engine.currentTime
            let progressPercent = CGFloat(engine.duration > 0 ? max(0, min(1, activeTime / engine.duration)) : 0)
            let playheadX = max(0, min(width, progressPercent * width))
            
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.zionPanelLight)
                
                if !engine.waveformPeaks.isEmpty {
                    let peaks = engine.waveformPeaks
                    let count = max(1, peaks.count)
                    let step = width / CGFloat(count)
                    let midY = height / 2
                    let barWidth = max(1.2, step * 0.65)
                    
                    // Unplayed waveform (right of playhead)
                    Path { path in
                        for (i, peak) in peaks.enumerated() {
                            let x = CGFloat(i) * step + step * 0.5
                            let barHeight = max(2, CGFloat(peak) * height * 0.84)
                            path.move(to: CGPoint(x: x, y: midY - barHeight / 2))
                            path.addLine(to: CGPoint(x: x, y: midY + barHeight / 2))
                        }
                    }
                    .stroke(Color.zionCyan.opacity(0.32), style: StrokeStyle(lineWidth: barWidth, lineCap: .round))
                    
                    // Played waveform (left of playhead — bright cyan)
                    Path { path in
                        for (i, peak) in peaks.enumerated() {
                            let x = CGFloat(i) * step + step * 0.5
                            if x > playheadX { break }
                            let barHeight = max(2, CGFloat(peak) * height * 0.84)
                            path.move(to: CGPoint(x: x, y: midY - barHeight / 2))
                            path.addLine(to: CGPoint(x: x, y: midY + barHeight / 2))
                        }
                    }
                    .stroke(Color.zionCyan, style: StrokeStyle(lineWidth: barWidth, lineCap: .round))
                    
                    // Song name pill overlay
                    if let songName = engine.currentSong?.name {
                        Text(songName)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white.opacity(0.85))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.black.opacity(0.45))
                            .cornerRadius(4)
                            .padding(.leading, 8)
                            .frame(maxHeight: .infinity, alignment: .topLeading)
                            .padding(.top, 3)
                    }
                } else if engine.isLoading {
                    HStack(spacing: 8) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                            .scaleEffect(0.75)
                        Text(engine.loadLabel.isEmpty ? "Cargando..." : engine.loadLabel)
                            .font(.caption.bold())
                            .foregroundColor(Color.zionCyan)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                } else if let song = engine.currentSong {
                    HStack(spacing: 6) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                            .scaleEffect(0.65)
                        Text("Analizando onda real de \(song.name)...")
                            .font(.caption)
                            .foregroundColor(Color.zionTextSecondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                } else {
                    Text("Ninguna canción cargada")
                        .font(.caption)
                        .foregroundColor(Color.zionTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                
                // Subtle loading badge even when cached waveform is already displayed
                if engine.isLoading && !engine.waveformPeaks.isEmpty {
                    HStack(spacing: 6) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.zionCyan))
                            .scaleEffect(0.65)
                        Text(engine.loadLabel)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color.zionCyan)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.black.opacity(0.65))
                    .cornerRadius(5)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.trailing, 8)
                }
                
                // Playhead
                Rectangle()
                    .fill(Color.white)
                    .frame(width: 2, height: height)
                    .shadow(color: Color.zionCyan, radius: 4)
                    .offset(x: max(0, min(width - 2, playheadX)))
            }
            .cornerRadius(6)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard engine.duration > 0 else { return }
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
