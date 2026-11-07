import SwiftUI

struct MembershipHeader: View {
    let title: String
    let busy: Bool
    let back: () -> Void
    let refresh: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: back) { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                .accessibilityLabel("Retour").help("Retour").accessibilityIdentifier("membership.back")
            Text(title).font(.sgmDisplay(24)).fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
            MembershipRefreshButton(busy: busy, action: refresh)
        }.buttonStyle(.plain).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
    }
}
struct MembershipRefreshButton: View {
    let busy: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) { Image(systemName: "arrow.clockwise").frame(width: 44, height: 44) }
            .buttonStyle(.plain).disabled(busy).accessibilityLabel("Actualiser les adhésions").help("Actualiser les adhésions")
            .accessibilityIdentifier("membership.refresh")
    }
}
