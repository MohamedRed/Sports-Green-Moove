import SwiftUI

struct MembershipClubRow: View {
    let club: MembershipClub
    let busy: Bool
    let open: () -> Void
    let request: () -> Void
    let requestAllowed: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: open) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(club.name ?? "Nom indisponible").font(.sgmBody(17, weight: .semibold))
                            .fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
                        if let sport = club.sport { Text(sport).font(.sgmBody(13)).foregroundStyle(SGM.textSecondary) }
                    }
                    Image(systemName: "chevron.right").frame(width: 24, height: 24)
                }.frame(minHeight: 44).contentShape(Rectangle())
            }.buttonStyle(.plain).disabled(busy).accessibilityIdentifier("membership.club.\(club.id)")
            if let membership = club.membership {
                Text(membership.label).font(.sgmBody(13)).accessibilityIdentifier("membership.status.\(club.id)")
            }
            if club.requestable {
                Button("Demander l’adhésion", action: request).frame(minHeight: 44).disabled(!requestAllowed)
                    .accessibilityIdentifier(UITestIdentifier.groupsJoinAction)
            }
        }.foregroundStyle(SGM.textPrimary)
    }
}

struct MembershipClubDetail: View {
    let club: MembershipClub
    let canRequest: Bool
    let request: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(club.name ?? "Nom indisponible").font(.sgmBody(22, weight: .bold))
                .fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("membership.club.title")
            if let sport = club.sport { Text(sport) }
            if let count = club.count { Text("\(count.formatted()) membres") }
            if let member = club.membership { Text(member.label).accessibilityIdentifier("membership.detail.status") }
            if club.requestable { Button("Demander l’adhésion", action: request).frame(minHeight: 44).disabled(!canRequest)
                .accessibilityIdentifier(UITestIdentifier.groupsJoinAction) }
        }
    }
}
