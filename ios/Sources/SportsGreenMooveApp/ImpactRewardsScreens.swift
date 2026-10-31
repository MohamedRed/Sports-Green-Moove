import SwiftUI

struct ImpactScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        let summary = appState.impactSummary
        OverlayListScreen(title: "MON IMPACT CO₂", testID: UITestIdentifier.impactScreen) {
            OverlayHeroMetric(value: "\(kgValue(summary.totalCo2Kg)) kg", label: "CO₂ économisés", accent: SGM.green)
            if summary.months.isEmpty {
                OverlayProgressRow(title: "Aucun trajet terminé", value: "0 kg", progress: 0)
            } else {
                ForEach(summary.months) { month in
                    OverlayProgressRow(
                        title: month.label,
                        value: "\(kgValue(month.valueKg)) kg",
                        progress: monthProgress(month, in: summary.months)
                    )
                }
            }
            OverlayProgressRow(title: "Distance partagée", value: "\(summary.sharedDistanceKm) km", progress: summary.sharedDistanceKm > 0 ? 1 : 0)
            OverlayProgressRow(title: "Trajets clôturés", value: "\(summary.rideCount)", progress: summary.rideCount > 0 ? 1 : 0)
        }
    }
}

struct RewardsScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        let summary = appState.rewardSummary
        OverlayListScreen(title: "RÉCOMPENSES", testID: UITestIdentifier.rewardsScreen) {
            OverlayHeroMetric(value: moneyLabel(summary.balanceCents), label: "Solde disponible", accent: SGM.orange)
            SGMButton(title: "RETIRER MES GAINS", variant: .orange, testID: UITestIdentifier.rewardsWithdrawAction) {}
            OverlayProgressRow(title: "Prochain palier", value: percentLabel(summary.progress), progress: CGFloat(summary.progress))
            ForEach(rewardTiers(summary)) { tier in
                OverlayProgressRow(title: tier.label, value: tier.status, progress: tier.progress)
            }
            if summary.entries.isEmpty {
                RewardHistoryRow(title: "Aucun mouvement enregistré", subtitle: "Reward ledger", meta: "0,00€", positive: true)
            } else {
                ForEach(summary.entries) { entry in
                    RewardHistoryRow(title: entry.title, subtitle: entry.dateLabel, meta: entry.amountLabel, positive: entry.positive)
                }
            }
        }
    }
}

private struct RewardTier: Identifiable {
    let id: Int
    let label: String
    let status: String
    let progress: CGFloat
}

private struct RewardHistoryRow: View {
    let title: String
    let subtitle: String
    let meta: String
    let positive: Bool

    var body: some View {
        HStack(spacing: 12) {
            SGMAvatar(initials: String(title.prefix(2)), size: 38, muted: true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.sgmBody(14, weight: .bold))
                    .foregroundStyle(SGM.textPrimary)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.sgmBody(12, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
            }
            Spacer()
            Text(meta)
                .font(.sgmBody(11, weight: .bold))
                .foregroundStyle(positive ? SGM.green : SGM.orange)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .padding(14)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private func monthProgress(_ month: ImpactMonthSummary, in months: [ImpactMonthSummary]) -> CGFloat {
    let maxValue = months.map(\.valueKg).max() ?? 0
    guard maxValue > 0 else { return 0 }
    return CGFloat(min(1, max(0, month.valueKg / maxValue)))
}

private func rewardTiers(_ summary: RewardSummary) -> [RewardTier] {
    [500, 1_000, 2_500, 5_000].map { cents in
        let reached = summary.balanceCents >= cents
        let current = !reached && summary.nextTierCents == cents
        return RewardTier(
            id: cents,
            label: "Palier \(moneyLabel(cents))",
            status: reached ? "Atteint" : (current ? "En cours" : "À venir"),
            progress: reached ? 1 : (current ? CGFloat(summary.progress) : 0)
        )
    }
}

private func kgValue(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.minimumFractionDigits = 1
    formatter.maximumFractionDigits = 1
    return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.1f", value)
}

private func moneyLabel(_ cents: Int) -> String {
    let sign = cents < 0 ? "-" : ""
    let absolute = abs(cents)
    return "\(sign)\(absolute / 100),\(String(format: "%02d", absolute % 100))€"
}

private func percentLabel(_ progress: Double) -> String {
    "\(Int(min(1, max(0, progress)) * 100))%"
}
