import SwiftUI

struct ProfileIdentity: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(SGM.green)
                if let initials = appState.session?.initials {
                    Text(initials)
                        .font(.sgmDisplay(30))
                        .foregroundStyle(SGM.textOnGreen)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .padding(.horizontal, 8)
                } else {
                    SGMIconView(icon: .profile, size: 30, color: SGM.textOnGreen)
                }
            }
            .frame(width: 80, height: 80)
            .accessibilityHidden(true)
            if let name = appState.session?.displayName, !name.isEmpty {
                Text(name)
                    .font(.sgmDisplay(22))
                    .foregroundStyle(SGM.textPrimary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .sgmUITestIdentifier(UITestIdentifier.profileName)
            }
            if let email = appState.session?.email {
                Text(email)
                    .font(.sgmBody(13, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let club = appState.clubSummaries.first(where: \.isMember) {
                Text(club.name)
                    .font(.sgmBody(13, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 16)
        .padding(.bottom, 10)
    }
}
