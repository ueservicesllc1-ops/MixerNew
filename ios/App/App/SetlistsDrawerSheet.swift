import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct SetlistsDrawerSheet: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var dataStore: DataStore
    
    @State private var showCreateAlert: Bool = false
    @State private var newSetName: String = ""
    
    var onSelectSetlist: ((Setlist) -> Void)? = nil
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("📋 Mis Setlists")
                    .font(.headline.bold())
                    .foregroundColor(Color.zionTextPrimary)
                
                Spacer()
                
                Button(action: { showCreateAlert = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                        Text("Nuevo Setlist")
                    }
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.zionCyan)
                    .foregroundColor(.black)
                    .cornerRadius(6)
                }
                
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(Color.zionTextSecondary)
                        .padding(.leading, 8)
                }
            }
            .padding()
            .background(Color.zionPanel)
            
            // Setlists List
            if dataStore.setlists.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "music.note.house")
                        .font(.system(size: 40))
                        .foregroundColor(Color.zionTextSecondary)
                    Text("No tienes setlists creados")
                        .font(.headline)
                        .foregroundColor(Color.zionTextPrimary)
                    Text("Toca 'Nuevo Setlist' para crear tu primer repertorio")
                        .font(.subheadline)
                        .foregroundColor(Color.zionTextSecondary)
                    Spacer()
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(dataStore.setlists) { setlist in
                            let songCount = setlist.songs?.count ?? 0
                            Button(action: {
                                onSelectSetlist?(setlist)
                                presentationMode.wrappedValue.dismiss()
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(setlist.name)
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundColor(Color.zionTextPrimary)
                                        Text("\(songCount) canciones en este repertorio")
                                            .font(.system(size: 11))
                                            .foregroundColor(Color.zionTextSecondary)
                                    }
                                    
                                    Spacer()
                                    
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(Color.zionTextSecondary)
                                }
                                .padding(12)
                                .background(Color.zionPanel)
                                .cornerRadius(8)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.zionBorderSubtle, lineWidth: 1))
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.zionBackground.ignoresSafeArea())
        .alert("Crear Nuevo Setlist", isPresented: $showCreateAlert) {
            TextField("Nombre del repertorio", text: $newSetName)
            Button("Cancelar", role: .cancel) { newSetName = "" }
            Button("Crear") {
                let trimmed = newSetName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    dataStore.createSetlist(name: trimmed)
                    newSetName = ""
                }
            }
        }
    }
}
