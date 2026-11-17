import SwiftUI

struct GroupsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var requestedClubIds: Set<String> = []

    var body: some View {
        OverlayListScreen(title: "GROUPES", testID: UITestIdentifier.groupsScreen) {
            GroupsSection(title: "MES CLUBS") {
                let memberships = appState.clubSummaries.filter(\.isMember)
                if memberships.isEmpty {
                    GroupEmptyRow(text: "Aucun club lié à votre compte.")
                } else {
                    ForEach(memberships) { club in
                        ClubSummaryRow(club: club, actionTitle: "OUVRIR")
                    }
                }
            }
            GroupsSection(title: "DÉCOUVRIR DES CLUBS") {
                let suggestions = appState.clubSummaries.filter { !$0.isMember }
                if suggestions.isEmpty {
                    GroupEmptyRow(text: "Aucun club public disponible.")
                } else {
                    ForEach(suggestions) { club in
                        ClubSummaryRow(
                            club: club,
                            actionTitle: requestedClubIds.contains(club.id) ? "DEMANDÉ" : "REJOINDRE",
                            testID: requestedClubIds.contains(club.id) ? nil : UITestIdentifier.groupsJoinAction
                        ) {
                            requestedClubIds.insert(club.id)
                        }
                    }
                }
            }
        }
    }
}

private struct GroupsSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.sgmBody(11, weight: .bold))
                .tracking(.sgmWider(for: 11))
                .foregroundStyle(SGM.textMuted)
            content()
        }
    }
}

private struct ClubSummaryRow: View {
    let club: ClubSummary
    let actionTitle: String
    var testID: String?
    var action: (() -> Void)?

    var body: some View {
        Button(action: { action?() }) {
            HStack(spacing: 12) {
                SGMAvatar(initials: club.initials, size: 38, muted: !club.isMember)
                VStack(alignment: .leading, spacing: 4) {
                    Text(club.name)
                        .font(.sgmBody(14, weight: .bold))
                        .foregroundStyle(SGM.textPrimary)
                        .lineLimit(1)
                    Text("\(club.sport) · \(club.memberCount) membres")
                        .font(.sgmBody(12, weight: .medium))
                        .foregroundStyle(SGM.textMuted)
                }
                Spacer()
                Text(club.roleLabel ?? actionTitle)
                    .font(.sgmBody(11, weight: .bold))
                    .foregroundStyle(club.isMember ? SGM.green : SGM.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .padding(14)
            .sgmUITestIdentifier(testID)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct GroupEmptyRow: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.sgmBody(13, weight: .semibold))
            .foregroundStyle(SGM.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}
