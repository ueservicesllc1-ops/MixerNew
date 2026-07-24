import Foundation
import FirebaseAuth
import FirebaseFirestore
import Combine

struct UserProfile {
    let uid: String
    let email: String
    let name: String
    let plan: String
}

class AuthViewModel: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: UserProfile?
    @Published var isAuthenticating: Bool = false
    @Published var errorMessage: String? = nil
    
    private let db = Firestore.firestore()
    
    init() {
        if let user = Auth.auth().currentUser {
            self.fetchUserProfile(uid: user.uid)
        }
    }
    
    func login(email: String, password: String) {
        self.isAuthenticating = true
        self.errorMessage = nil
        
        Auth.auth().signIn(withEmail: email, password: password) { [weak self] authResult, error in
            guard let self = self else { return }
            
            if let error = error {
                DispatchQueue.main.async {
                    self.isAuthenticating = false
                    self.errorMessage = error.localizedDescription
                }
                return
            }
            
            if let user = authResult?.user {
                self.fetchUserProfile(uid: user.uid)
            }
        }
    }
    
    func logout() {
        do {
            try Auth.auth().signOut()
            DispatchQueue.main.async {
                self.isAuthenticated = false
                self.currentUser = nil
            }
        } catch {
            print("Error signing out: \(error.localizedDescription)")
        }
    }
    
    private func fetchUserProfile(uid: String) {
        db.collection("users").document(uid).getDocument { [weak self] document, error in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                self.isAuthenticating = false
                
                if let doc = document, doc.exists {
                    let data = doc.data() ?? [:]
                    self.currentUser = UserProfile(
                        uid: uid,
                        email: data["email"] as? String ?? "",
                        name: data["name"] as? String ?? "Usuario",
                        plan: data["plan"] as? String ?? "Free"
                    )
                    self.isAuthenticated = true
                } else {
                    // Si no hay perfil, creamos uno básico
                    self.currentUser = UserProfile(
                        uid: uid,
                        email: Auth.auth().currentUser?.email ?? "",
                        name: "Usuario",
                        plan: "Free"
                    )
                    self.isAuthenticated = true
                }
            }
        }
    }
}
