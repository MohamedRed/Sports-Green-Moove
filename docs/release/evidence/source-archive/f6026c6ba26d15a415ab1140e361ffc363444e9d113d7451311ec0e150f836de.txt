import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore

extension FirebaseBackendGateway {
    func getImpactSummary() async throws -> ImpactSummary {
        try await loadImpactSummary()
    }

    func getRewardSummary() async throws -> RewardSummary {
        try await loadRewardSummary()
    }
}

private func loadImpactSummary() async throws -> ImpactSummary {
    guard let uid = Auth.auth().currentUser?.uid else { return .empty }
    let documents = try await queryDocuments(
        Firestore.firestore()
            .collection("co2Ledger")
            .whereField("userId", isEqualTo: uid)
            .limit(to: 100)
    )
    let rows = documents.map { $0.data() }
    let totalCo2Kg = rows.reduce(0) { $0 + doubleValue($1["co2SavedKg"]) }
    let distanceMeters = rows.reduce(0) { $0 + intValue($1["distanceMeters"]) }
    let groupedMonths = Dictionary(grouping: rows.compactMap(impactMonth), by: \.monthStart)
    let months = groupedMonths
        .map { monthStart, values in
            DatedImpactMonth(
                monthStart: monthStart,
                summary: ImpactMonthSummary(
                    label: values.first?.label ?? "",
                    valueKg: values.reduce(0) { $0 + $1.co2SavedKg }
                )
            )
        }
        .sorted { $0.monthStart < $1.monthStart }
        .suffix(6)
        .map(\.summary)
    return ImpactSummary(
        totalCo2Kg: totalCo2Kg,
        sharedDistanceKm: distanceMeters / 1_000,
        rideCount: rows.count,
        months: months
    )
}

private func loadRewardSummary() async throws -> RewardSummary {
    guard let uid = Auth.auth().currentUser?.uid else { return .empty }
    let documents = try await queryDocuments(
        Firestore.firestore()
            .collection("rewardLedger")
            .whereField("userId", isEqualTo: uid)
            .limit(to: 100)
    )
    let rows = documents.map { $0.data() }
    let balance = rows.reduce(0) { $0 + intValue($1["amountCents"]) }
    let tier = nextTierCents(for: balance)
    let entries = rows
        .sorted { (dateValue($0["createdAt"]) ?? .distantPast) > (dateValue($1["createdAt"]) ?? .distantPast) }
        .prefix(8)
        .enumerated()
        .map { index, row in rewardEntry(index: index, data: row) }
    return RewardSummary(
        balanceCents: balance,
        nextTierCents: tier,
        progress: min(1, max(0, Double(balance) / Double(tier))),
        entries: entries
    )
}

private struct LedgerImpactMonth {
    let monthStart: Date
    let label: String
    let co2SavedKg: Double
}

private struct DatedImpactMonth {
    let monthStart: Date
    let summary: ImpactMonthSummary
}

private func impactMonth(from data: [String: Any]) -> LedgerImpactMonth? {
    guard let date = dateValue(data["createdAt"]) else { return nil }
    let monthStart = Calendar(identifier: .gregorian).dateInterval(of: .month, for: date)?.start ?? date
    return LedgerImpactMonth(
        monthStart: monthStart,
        label: monthLabel(date),
        co2SavedKg: doubleValue(data["co2SavedKg"])
    )
}

private func rewardEntry(index: Int, data: [String: Any]) -> RewardEntrySummary {
    let cents = intValue(data["amountCents"])
    return RewardEntrySummary(
        id: "\(dateValue(data["createdAt"])?.timeIntervalSince1970 ?? Double(index))-\(index)",
        title: rewardTitle(data["type"] as? String),
        dateLabel: dateLabel(data["createdAt"]),
        amountLabel: amountLabel(cents),
        positive: cents >= 0
    )
}

private func rewardTitle(_ type: String?) -> String {
    switch type {
    case "driverEarning": return "Trajet payé"
    case "co2Bonus": return "Bonus CO₂"
    case "referralBonus": return "Parrainage"
    case "manualAdjustment": return "Ajustement"
    case "payout": return "Retrait"
    case "refund": return "Remboursement"
    default: return "Mouvement"
    }
}

private func nextTierCents(for balance: Int) -> Int {
    [500, 1_000, 2_500, 5_000].first { balance < $0 } ?? 5_000
}

private func amountLabel(_ cents: Int) -> String {
    let sign = cents >= 0 ? "+" : "-"
    let absolute = abs(cents)
    return "\(sign)\(absolute / 100),\(String(format: "%02d", absolute % 100))€"
}

private func monthLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.dateFormat = "MMM"
    return formatter.string(from: date).uppercased(with: Locale(identifier: "fr_FR"))
}

private func dateLabel(_ value: Any?) -> String {
    guard let date = dateValue(value) else { return "DATE INCONNUE" }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.dateFormat = "dd MMM yyyy"
    return formatter.string(from: date).uppercased(with: Locale(identifier: "fr_FR"))
}

private func dateValue(_ value: Any?) -> Date? {
    if let timestamp = value as? Timestamp { return timestamp.dateValue() }
    if let date = value as? Date { return date }
    if let string = value as? String { return ISO8601DateFormatter().date(from: string) }
    return nil
}

private func intValue(_ value: Any?) -> Int {
    if let number = value as? NSNumber { return number.intValue }
    if let int = value as? Int { return int }
    return 0
}

private func doubleValue(_ value: Any?) -> Double {
    if let number = value as? NSNumber { return number.doubleValue }
    if let double = value as? Double { return double }
    if let int = value as? Int { return Double(int) }
    return 0
}

private func queryDocuments(_ query: Query) async throws -> [QueryDocumentSnapshot] {
    try await withCheckedThrowingContinuation { continuation in
        query.getDocuments { snapshot, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let snapshot {
                continuation.resume(returning: snapshot.documents)
            } else {
                continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Firestore invalide."))
            }
        }
    }
}
#endif
