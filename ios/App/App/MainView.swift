import SwiftUI

struct MainView: View {
    var body: some View {
        VStack {
            Text("Hola iOS Nativo")
                .font(.largeTitle)
                .padding()
            Text("Adiós Capacitor")
                .foregroundColor(.secondary)
        }
    }
}

struct MainView_Previews: PreviewProvider {
    static var previews: some View {
        MainView()
    }
}
