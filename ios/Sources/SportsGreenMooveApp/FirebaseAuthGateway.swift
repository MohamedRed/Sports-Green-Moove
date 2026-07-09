import Foundation

#if canImport(FirebaseAuth)
import FirebaseAuth
import FirebaseCore
#if canImport(FacebookCore) && canImport(FacebookLogin) && canImport(UIKit)
import FacebookCore
import FacebookLogin
import UIKit
#endif
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

    func signInWithFacebook() async throws -> AuthSession {
        #if canImport(FacebookCore) && canImport(FacebookLogin) && canImport(UIKit)
        return try await facebookSignInSession()
        #else
        throw ProviderConfigurationError(message: "FacebookLogin iOS n'est pas lié au build.")
        #endif
    }

    func signOut() throws {
        #if canImport(GoogleSignIn) && canImport(UIKit)
        GIDSignIn.sharedInstance.signOut()
        #endif
        #if canImport(FacebookLogin) && canImport(UIKit)
        LoginManager().logOut()
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

    #if canImport(FacebookCore) && canImport(FacebookLogin) && canImport(UIKit)
    @MainActor
    private func facebookSignInSession() async throws -> AuthSession {
        let appId = Bundle.main.object(forInfoDictionaryKey: "FacebookAppID") as? String
        guard let appId, !appId.isEmpty else {
            throw ProviderConfigurationError(message: "Configurez SGM_FACEBOOK_APP_ID pour Facebook Auth iOS.")
        }
        let clientToken = Bundle.main.object(forInfoDictionaryKey: "FacebookClientToken") as? String
        guard let clientToken, !clientToken.isEmpty else {
            throw ProviderConfigurationError(message: "Configurez SGM_FACEBOOK_CLIENT_TOKEN pour Facebook Auth iOS.")
        }
        guard let presenter = UIApplication.shared.sgmTopViewController else {
            throw ProviderConfigurationError(message: "Fenêtre iOS indisponible pour Facebook Auth.")
        }

        Settings.shared.appID = appId
        Settings.shared.clientToken = clientToken
        return try await withCheckedThrowingContinuation { continuation in
            LoginManager().logIn(permissions: ["public_profile", "email"], from: presenter) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let result, !result.isCancelled else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Connexion Facebook annulée."))
                    return
                }
                guard let token = result.token?.tokenString, !token.isEmpty else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Jeton Facebook iOS invalide."))
                    return
                }
                let credential = FacebookAuthProvider.credential(withAccessToken: token)
                Auth.auth().signIn(with: credential) { authResult, authError in
                    if let authError {
                        continuation.resume(throwing: authError)
                    } else if let user = authResult?.user {
                        continuation.resume(returning: AuthSession(uid: user.uid, email: user.email))
                    } else {
                        continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Facebook Auth invalide."))
                    }
                }
            }
        }
    }
    #endif
}

#endif
