import Foundation

#if canImport(FirebaseAuth)
import FirebaseAuth
import FirebaseCore
#if canImport(GoogleSignIn) && canImport(UIKit)
import GoogleSignIn
import UIKit
#endif

struct FirebaseAuthGateway: AuthGateway {
    let isConfigured = true

    func currentSession() async throws -> AuthSession? {
        guard let user = Auth.auth().currentUser else { return nil }
        return AuthSession(uid: user.uid, email: user.email)
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        try await authSession { completion in
            Auth.auth().signIn(withEmail: email, password: password, completion: completion)
        }
    }

    func signUp(name: String, email: String, password: String) async throws -> AuthSession {
        _ = name
        return try await authSession { completion in
            Auth.auth().createUser(withEmail: email, password: password, completion: completion)
        }
    }

    func signInWithGoogle() async throws -> AuthSession {
        #if canImport(GoogleSignIn) && canImport(UIKit)
        return try await googleSignInSession()
        #else
        throw ProviderConfigurationError(message: "GoogleSignIn iOS n'est pas lié au build.")
        #endif
    }

    func signOut() throws {
        #if canImport(GoogleSignIn) && canImport(UIKit)
        GIDSignIn.sharedInstance.signOut()
        #endif
        try Auth.auth().signOut()
    }

    @MainActor
    private func authSession(_ action: (@escaping (AuthDataResult?, Error?) -> Void) -> Void) async throws -> AuthSession {
        try await withCheckedThrowingContinuation { continuation in
            action { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let result {
                    let session = AuthSession(uid: result.user.uid, email: result.user.email)
                    continuation.resume(returning: session)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Firebase Auth invalide."))
                }
            }
        }
    }

    #if canImport(GoogleSignIn) && canImport(UIKit)
    @MainActor
    private func googleSignInSession() async throws -> AuthSession {
        let reversedClientId = Bundle.main.object(forInfoDictionaryKey: "SGMGoogleReversedClientID") as? String
        guard let reversedClientId, !reversedClientId.isEmpty else {
            throw ProviderConfigurationError(message: "Configurez SGM_GOOGLE_REVERSED_CLIENT_ID pour Google Auth iOS.")
        }
        guard let clientId = FirebaseApp.app()?.options.clientID, !clientId.isEmpty else {
            throw ProviderConfigurationError(message: "Client OAuth Google manquant dans GoogleService-Info.plist.")
        }
        guard let presenter = UIApplication.shared.sgmTopViewController else {
            throw ProviderConfigurationError(message: "Fenêtre iOS indisponible pour Google Auth.")
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        guard let idToken = result.user.idToken?.tokenString else {
            throw ProviderConfigurationError(message: "Jeton Google iOS invalide.")
        }
        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: result.user.accessToken.tokenString
        )
        return try await authSession { completion in
            Auth.auth().signIn(with: credential, completion: completion)
        }
    }
    #endif
}

#endif
