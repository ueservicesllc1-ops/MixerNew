import Foundation
import FirebaseAuth
import FirebaseFirestore
import Combine

// Interruptores temporales (nada se borra, 100% reversible).
// Cambiar `paidPlansEnabled = true` cuando se quieran reactivar todos los cobros/planes.
enum ZionFeatureFlags {
    static let paidPlansEnabled: Bool = false
    static let freeLaunchStorageGB: Int = 100
}

struct UserProfile {
    let uid: String
    let email: String
    let name: String
    let plan: String
    let planId: String
    let role: String
    
    var hasVipAccess: Bool {
        if !ZionFeatureFlags.paidPlansEnabled { return true }
        let pid = planId.lowercased()
        let p = plan.lowercased()
        let r = role.lowercased()
        if r == "admin" || r == "superadmin" { return true }
        let vipIds: Set<String> = ["vip1", "vip2", "vip3", "vip", "zion_desktop_pro_online", "universal_pro"]
        return vipIds.contains(pid) || p.contains("vip")
    }
    
    var displayPlanLabel: String {
        if !ZionFeatureFlags.paidPlansEnabled {
            return "Gratuito (\(ZionFeatureFlags.freeLaunchStorageGB) GB incluidos)"
        }
        return plan
    }
}

class AuthViewModel: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: UserProfile?
    @Published var isAuthenticating: Bool = false
    @Published var errorMessage: String? = nil
    
    // Email verification gate (matches Web Dashboard)
    @Published var needsEmailVerification: Bool = false
    @Published var pendingVerificationEmail: String = ""
    @Published var verificationFeedback: String? = nil
    @Published var isCheckingVerification: Bool = false
    @Published var isResendingVerification: Bool = false
    
    var hasVipAccess: Bool {
        currentUser?.hasVipAccess ?? false
    }
    
    private let db = Firestore.firestore()
    private let exemptVerifyEmails: Set<String> = ["ueservicesllc1@gmail.com", "123@gmail.com"]
    
    init() {
        if let user = Auth.auth().currentUser {
            self.verifyAndLoadUser(user)
        }
    }
    
    private func isEmailExempt(_ email: String?) -> Bool {
        let normalized = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return exemptVerifyEmails.contains(normalized)
    }
    
    private func verifyAndLoadUser(_ user: User) {
        user.reload { [weak self] _ in
            guard let self = self else { return }
            let refreshed = Auth.auth().currentUser ?? user
            let verified = refreshed.isEmailVerified || self.isEmailExempt(refreshed.email)
            
            if !verified {
                DispatchQueue.main.async {
                    self.isAuthenticating = false
                    self.isAuthenticated = false
                    self.needsEmailVerification = true
                    self.pendingVerificationEmail = refreshed.email ?? ""
                    self.errorMessage = nil
                }
                return
            }
            
            DispatchQueue.main.async {
                self.needsEmailVerification = false
                self.verificationFeedback = nil
            }
            self.fetchUserProfile(uid: refreshed.uid)
        }
    }
    
    func login(email: String, password: String) {
        self.isAuthenticating = true
        self.errorMessage = nil
        self.verificationFeedback = nil
        
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
                self.verifyAndLoadUser(user)
            }
        }
    }
    
    func checkEmailVerification() {
        guard let user = Auth.auth().currentUser else { return }
        isCheckingVerification = true
        verificationFeedback = nil
        
        user.reload { [weak self] error in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.isCheckingVerification = false
                if let error = error {
                    self.verificationFeedback = error.localizedDescription
                    return
                }
                let refreshed = Auth.auth().currentUser ?? user
                if refreshed.isEmailVerified || self.isEmailExempt(refreshed.email) {
                    self.needsEmailVerification = false
                    self.verificationFeedback = nil
                    self.fetchUserProfile(uid: refreshed.uid)
                } else {
                    self.verificationFeedback = "Todavía no aparece verificado. Abre el enlace en tu correo y vuelve a intentar."
                }
            }
        }
    }
    
    func resendVerificationEmail() {
        guard let user = Auth.auth().currentUser else { return }
        isResendingVerification = true
        verificationFeedback = nil
        
        user.getIDToken { [weak self] token, _ in
            guard let self = self else { return }
            
            let fallbackToFirebase: () -> Void = {
                user.sendEmailVerification { err in
                    DispatchQueue.main.async {
                        self.isResendingVerification = false
                        if let err = err {
                            self.verificationFeedback = err.localizedDescription
                        } else {
                            self.verificationFeedback = "Enviamos un nuevo enlace de confirmación a \(user.email ?? ""). Revisa tu bandeja o Spam."
                        }
                    }
                }
            }
            
            guard let token = token,
                  let url = URL(string: "https://mixernew-production.up.railway.app/api/auth/send-verification") else {
                fallbackToFirebase()
                return
            }
            
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.timeoutInterval = 12
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            
            URLSession.shared.dataTask(with: req) { data, response, error in
                if error != nil {
                    fallbackToFirebase()
                    return
                }
                let status = (response as? HTTPURLResponse)?.statusCode ?? 500
                let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
                let needsFallback = (status < 200 || status >= 300) || (json["fallbackToFirebase"] as? Bool == true)
                
                if needsFallback {
                    fallbackToFirebase()
                } else {
                    DispatchQueue.main.async {
                        self.isResendingVerification = false
                        self.verificationFeedback = "Enviamos un nuevo enlace de confirmación a \(user.email ?? ""). Revisa tu bandeja o Spam."
                    }
                }
            }.resume()
        }
    }
    
    func logout() {
        do {
            try Auth.auth().signOut()
            DispatchQueue.main.async {
                self.isAuthenticated = false
                self.currentUser = nil
                self.needsEmailVerification = false
                self.pendingVerificationEmail = ""
                self.verificationFeedback = nil
            }
        } catch {
            print("Error signing out: \(error.localizedDescription)")
        }
    }
    
    private func fetchUserProfile(uid: String) {
        db.collection("users").document(uid).getDocument { [weak self] document, _ in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                self.isAuthenticating = false
                
                if let doc = document, doc.exists {
                    let data = doc.data() ?? [:]
                    let planStr = data["plan"] as? String ?? "Free"
                    let planIdStr = data["planId"] as? String ?? planStr.lowercased()
                    let roleStr = data["role"] as? String ?? "user"
                    self.currentUser = UserProfile(
                        uid: uid,
                        email: data["email"] as? String ?? (Auth.auth().currentUser?.email ?? ""),
                        name: data["name"] as? String ?? "Usuario",
                        plan: planStr,
                        planId: planIdStr,
                        role: roleStr
                    )
                    self.isAuthenticated = true
                } else {
                    self.currentUser = UserProfile(
                        uid: uid,
                        email: Auth.auth().currentUser?.email ?? "",
                        name: "Usuario",
                        plan: "Free",
                        planId: "free",
                        role: "user"
                    )
                    self.isAuthenticated = true
                }
            }
        }
    }
}
