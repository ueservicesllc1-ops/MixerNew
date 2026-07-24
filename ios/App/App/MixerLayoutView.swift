import SwiftUI

struct MixerLayoutView: View {
    @ObservedObject var authViewModel: AuthViewModel
    
    var body: some View {
        HStack(spacing: 0) {
            // Main Content Area (Mixer)
            VStack(spacing: 0) {
                // Top Transport Bar
                HStack {
                    Text("Zion Stage Nativo")
                        .font(.headline)
                        .foregroundColor(Color.Zion.textPrimary)
                    
                    Spacer()
                    
                    Button(action: {
                        authViewModel.logout()
                    }) {
                        Text("Cerrar Sesión")
                            .font(.subheadline)
                            .foregroundColor(Color.Zion.dangerRed)
                    }
                }
                .padding()
                .background(Color.Zion.cardDark)
                
                // Mixer Grid
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 12) {
                        if AudioEngineViewModel.shared.loadedTracks.isEmpty {
                            Text("Selecciona una canción del setlist para comenzar.")
                                .foregroundColor(Color.Zion.textSecondary)
                                .padding(.top, 50)
                        } else {
                            ForEach(AudioEngineViewModel.shared.loadedTracks) { track in
                                MixerChannelView(track: track)
                            }
                        }
                    }
                    .padding()
                }
                .background(Color.Zion.backgroundDark)
                
                // Bottom Playback Bar
                HStack(spacing: 20) {
                    let engine = AudioEngineViewModel.shared
                    
                    Button(action: {
                        if engine.isPlaying {
                            engine.pause()
                        } else {
                            engine.play()
                        }
                    }) {
                        Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                            .font(.title)
                            .foregroundColor(.white)
                            .frame(width: 50, height: 50)
                            .background(engine.isPlaying ? Color.Zion.warningYellow : Color.Zion.primaryCyan)
                            .clipShape(Circle())
                    }
                    
                    Button(action: {
                        engine.stop()
                    }) {
                        Image(systemName: "stop.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 40, height: 40)
                            .background(Color.Zion.dangerRed)
                            .clipShape(Circle())
                    }
                    
                    let timeBinding = Binding<Double>(
                        get: { engine.currentTime },
                        set: { engine.seek(to: $0) }
                    )
                    
                    Slider(value: timeBinding, in: 0...max(engine.duration, 1))
                        .accentColor(Color.Zion.primaryCyan)
                    
                    Text(String(format: "%02d:%02d / %02d:%02d",
                                Int(engine.currentTime) / 60, Int(engine.currentTime) % 60,
                                Int(engine.duration) / 60, Int(engine.duration) % 60))
                        .foregroundColor(Color.Zion.textSecondary)
                        .font(.caption.monospacedDigit())
                }
                .padding()
                .background(Color.Zion.cardDark)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Right Sidebar (Setlists)
            VStack {
                Text("Setlist")
                    .font(.headline)
                    .foregroundColor(Color.Zion.textPrimary)
                    .padding()
                
                SetlistsView()
            }
            .frame(width: 320)
            .background(Color.Zion.backgroundDark)
            .border(Color.Zion.borderSubtleDark, width: 1)
        }
        .edgesIgnoringSafeArea(.all)
    }
}
