import SwiftUI

struct OptionsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var showSupport = false

    var body: some View {
        SGMScreen(testID: UITestIdentifier.optionsScreen) {
            SGMTopBar(title: "OPTIONS", showsBack: true)
            OptionsHero()
            SGMSectionLabel("SÉCURITÉ")
            OptionsSectionCard(rows: [
                .init(icon: .profile, label: "Contact urgence", value: "+32 470 00 00 00", detail: "Action visible pendant une course active"),
                .init(icon: .check, label: "Journal d'audit", value: "Activé", detail: "Pickup, dropoff, consentements et paiements"),
                .init(icon: .groups, label: "Consentement parent", value: "Obligatoire", detail: "Chaque enfant reste lié à son tuteur"),
            ])
            SGMSectionLabel("LOCALISATION")
            OptionsSectionCard(rows: [
                .init(icon: .location, label: "Arrière-plan", value: "Trajets actifs", detail: "Suivi arrêté hors session de course"),
                .init(icon: .search, label: "Alertes position", value: "Activées", detail: "Dernière mise à jour et statut obsolète"),
                .init(icon: .bell, label: "Notifications", value: "Activées", detail: "Départ, pickup, dropoff et retard"),
            ])
            SGMSectionLabel("PAIEMENTS")
            OptionsSectionCard(rows: [
                .init(icon: .award, label: "Carte", value: "Stripe PaymentSheet", detail: "Autorisation avant validation conducteur"),
                .init(icon: .arrowRight, label: "Payout", value: "Stripe Connect", detail: "Versements visibles dans le ledger"),
                .init(icon: .settings, label: "Frais plateforme", value: "0 EUR", detail: "En attente des conditions business"),
            ])
            SGMSectionLabel("SUPPORT")
            if let uid = appState.session?.uid { SupportSubmissionCard(uid: uid, gateway: appState.firebase).id(uid) }
            SGMButton(title: "MES DEMANDES", action: { showSupport = true })
                .padding(.horizontal, SGMSpace.padScreen)
        }
        .sheet(isPresented: $showSupport) {
            if let uid = appState.session?.uid { SupportInboxScreen(uid: uid, gateway: appState.firebase).id(uid) }
        }
        .onChange(of: appState.session?.uid) { _, _ in showSupport = false }
    }

}

private struct OptionsHero: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("CONTRÔLES DU COMPTE")
                .font(.sgmBody(11, weight: .bold))
                .foregroundStyle(SGM.green)
            Text("Sécurité, localisation et paiements")
                .font(.sgmDisplay(20))
                .tracking(.sgmWide(for: 20))
                .foregroundStyle(SGM.textPrimary)
            Text("Les réglages sensibles restent liés aux courses actives et aux consentements tuteur.")
                .font(.sgmBody(12, weight: .medium))
                .foregroundStyle(SGM.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(SGM.border, lineWidth: 1))
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 8)
    }
}

private struct OptionsSectionCard: View {
    let rows: [OptionsRow]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(rows) { row in
                OptionsRowView(row: row)
                if row.id != rows.last?.id {
                    Divider().background(SGM.border).padding(.leading, 46)
                }
            }
        }
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 8)
    }
}

private struct OptionsRowView: View {
    let row: OptionsRow

    var body: some View {
        HStack(spacing: 12) {
            SGMIconView(icon: row.icon, size: 18, color: SGM.textMuted)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(row.label)
                        .font(.sgmBody(14, weight: .semibold))
                        .foregroundStyle(SGM.textPrimary)
                    Spacer()
                    Text(row.value)
                        .font(.sgmBody(12, weight: .bold))
                        .foregroundStyle(SGM.green)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
                Text(row.detail)
                    .font(.sgmBody(11, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
    }
}

private struct OptionsRow: Identifiable {
    let id = UUID()
    let icon: SGMIcon
    let label: String
    let value: String
    let detail: String
}
