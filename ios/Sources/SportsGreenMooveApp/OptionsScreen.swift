import SwiftUI

struct OptionsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var reason = "Sécurité"
    @State private var description = ""
    @State private var emergency = false
    @State private var submitting = false
    @State private var message: String?

    var body: some View {
        SGMScreen {
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
            reportCard
        }
    }

    private var reportCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SIGNALER AU SUPPORT")
                .font(.sgmDisplay(18))
                .tracking(.sgmWide(for: 18))
                .foregroundStyle(SGM.textPrimary)
            ReportField(label: "Raison", text: $reason, axis: .horizontal)
            ReportField(label: "Description", text: $description, axis: .vertical)
            Toggle("Urgent", isOn: $emergency)
                .font(.sgmBody(13, weight: .bold))
                .foregroundStyle(SGM.textPrimary)
                .tint(SGM.green)
            SGMButton(title: submitting ? "ENVOI..." : "ENVOYER", action: { Task { await submitReport() } })
            if let message {
                Text(message)
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(message.hasPrefix("Signalement") ? SGM.green : SGM.orange)
            }
        }
        .padding(14)
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
        .padding(.horizontal, SGMSpace.padScreen)
    }

    private func submitReport() async {
        guard !submitting else { return }
        let cleanReason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanReason.count >= 2, cleanDescription.count >= 5 else {
            message = "Ajoutez une raison et une description précise."
            return
        }

        submitting = true
        message = nil
        defer { submitting = false }
        do {
            let reportId = try await appState.firebase.createReport(
                subjectType: "other",
                subjectId: nil,
                reason: cleanReason,
                description: cleanDescription,
                emergency: emergency
            )
            description = ""
            message = "Signalement envoyé: \(reportId)"
        } catch {
            message = error.localizedDescription
        }
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

private struct ReportField: View {
    let label: String
    @Binding var text: String
    var axis: Axis

    var body: some View {
        TextField(label, text: $text, axis: axis)
            .font(.sgmBody(14, weight: .medium))
            .foregroundStyle(SGM.textPrimary)
            .lineLimit(axis == .vertical ? 3...5 : 1...1)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(SGM.bgInput, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
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
