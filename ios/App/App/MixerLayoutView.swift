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
                
                // Mixer Grid Placeholder
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 12) {
                        ForEach(0..<8) { i in
                            VStack {
                                Text("Track \(i+1)")
                                    .foregroundColor(.white)
                                    .font(.caption)
                                Spacer()
                                Rectangle()
                                    .fill(Color.Zion.primaryCyan.opacity(0.3))
                                    .frame(width: 40)
                            }
                            .frame(width: 100)
                            .padding(.vertical)
                            .background(Color.Zion.cardDark)
                            .cornerRadius(12)
                        }
                    }
                    .padding()
                }
                .background(Color.Zion.backgroundDark)
                
                // Bottom Playback Bar Placeholder
                HStack {
                    Button(action: {}) {
                        Image(systemName: "play.fill")
                            .font(.title)
                            .foregroundColor(.white)
                            .padding()
                            .background(Color.Zion.primaryCyan)
                            .clipShape(Circle())
                    }
                    
                    Slider(value: .constant(0.3))
                        .accentColor(Color.Zion.primaryCyan)
                        .padding(.horizontal)
                    
                    Text("01:23 / 04:00")
                        .foregroundColor(Color.Zion.textSecondary)
                        .font(.caption)
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
