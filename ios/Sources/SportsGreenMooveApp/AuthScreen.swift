import SwiftUI

struct AuthScreen: View {
    @Environment(AppState.self) private var appState
    @State private var mode = AuthMode.signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        SGMScreen(spacing: 12, bottomPadding: 28) {
            AuthHero()
            VStack(spacing: 12) {
                HStack(spacing: 6) {
                    SGMChip(text: "Se connecter", selected: mode == .signIn) { mode = .signIn }
                    SGMChip(text: "S'inscrire", selected: mode == .signUp) { mode = .signUp }
                }
                if mode == .signUp {
                    AuthField(title: "Nom et prénom", text: $name)
                }
                AuthField(title: "votre@email.be", text: $email)
                AuthField(title: "Mot de passe", text: $password, isSecure: true)
                SGMButton(title: mode == .signIn ? "SE CONNECTER" : "CRÉER MON COMPTE") {
                    Task {
                        if mode == .signIn {
                            await appState.signIn(email: email, password: password)
                        } else {
                            await appState.signUp(name: name, email: email, password: password)
                        }
                    }
                }
                .opacity(appState.loading ? 0.62 : 1)
            }
            .padding(.horizontal, SGMSpace.padScreen)
        }
    }
}

private enum AuthMode {
    case signIn
    case signUp
}

private struct AuthHero: View {
    var body: some View {
        ZStack {
            SGM.heroGradient
            SGMGridTexture()
            VStack(spacing: 12) {
                Wordmark()
                Text("COVOITURAGE SPORTIF & CULTUREL")
                    .font(.sgmBody(12, weight: .bold))
                    .tracking(.sgmWide(for: 12))
                    .foregroundStyle(SGM.green)
                Text("REJOIGNEZ LA\nGREEN RÉVOLUTION\nDU SPORT")
                    .font(.sgmDisplay(32))
                    .tracking(.sgmWide(for: 32))
                    .foregroundStyle(SGM.textOnGreen)
                    .multilineTextAlignment(.center)
                    .lineSpacing(-2)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 34)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 250)
    }
}

private struct AuthField: View {
    let title: String
    @Binding var text: String
    var isSecure = false

    var body: some View {
        Group {
            if isSecure {
                SecureField(title, text: $text)
            } else {
                TextField(title, text: $text)
            }
        }
        .font(.sgmBody(14, weight: .medium))
        .foregroundStyle(SGM.textPrimary)
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

struct ConfigurationRequiredScreen: View {
    var body: some View {
        SGMScreen(spacing: 12, bottomPadding: 28) {
            SGMTopBar(title: "CONFIGURATION")
            VStack(alignment: .leading, spacing: 12) {
                Text("Firebase requis")
                    .font(.sgmDisplay(28))
                    .tracking(.sgmWide(for: 28))
                    .foregroundStyle(SGM.textPrimary)
                Text("Ajoutez GoogleService-Info.plist dans les ressources iOS pour activer Auth, Firestore et Cloud Functions.")
                    .font(.sgmBody(14, weight: .medium))
                    .foregroundStyle(SGM.textSecondary)
            }
            .padding(18)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
            .padding(.horizontal, SGMSpace.padScreen)
        }
    }
}
