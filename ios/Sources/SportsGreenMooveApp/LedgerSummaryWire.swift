import Foundation

enum LedgerSummaryError: Error { case invalid }
enum LedgerSummaryWire {
    private struct Month: Decodable { let month: String; let co2SavedKg: Double }
    private struct Impact: Decodable {
        let userId: String; let totalCo2Kg: Double; let sharedDistanceKm: Int; let rideCount: Int; let months: [Month]
    }
    private struct Entry: Decodable { let id: String; let type: String; let amountCents: Int; let createdAtMillis: Double }
    private struct Rewards: Decodable { let userId: String; let balanceCents: Int; let entries: [Entry] }
    private static func require(_ value: Bool) throws { if !value { throw LedgerSummaryError.invalid } }
    private static func object(_ value: Any, keys: Set<String>) throws -> [String: Any] {
        guard let row = value as? [String: Any], Set(row.keys) == keys else { throw LedgerSummaryError.invalid }
        return row
    }
    private static func decode<T: Decodable>(_ type: T.Type, _ value: Any) throws -> T {
        try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: value))
    }
    private static func nativeInt(_ value: Int, min: Int = 0) throws {
        try require(value >= min && value <= Int(Int32.max))
    }
    static func impact(_ value: Any, uid: String) throws -> ImpactSummary {
        let raw = try object(value, keys: ["userId", "totalCo2Kg", "sharedDistanceKm", "rideCount", "months"])
        guard let rows = raw["months"] as? [Any] else { throw LedgerSummaryError.invalid }
        for row in rows { _ = try object(row, keys: ["month", "co2SavedKg"]) }
        let payload = try decode(Impact.self, value)
        try require(!uid.isEmpty && payload.userId == uid && payload.totalCo2Kg.isFinite && payload.totalCo2Kg >= 0)
        try nativeInt(payload.sharedDistanceKm); try nativeInt(payload.rideCount)
        try require(payload.months.count <= 6)
        var previous = ""
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "fr_FR")
        formatter.timeZone = calendar.timeZone; formatter.dateFormat = "MMM"
        let months = try payload.months.map { month in
            try require(month.month.range(of: "^[0-9]{4}-(0[1-9]|1[0-2])$", options: .regularExpression) != nil && month.month > previous)
            previous = month.month
            let parts = month.month.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 2, parts[0] >= 1,
                  let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)) else { throw LedgerSummaryError.invalid }
            try require(month.co2SavedKg.isFinite && month.co2SavedKg >= 0)
            return ImpactMonthSummary(label: formatter.string(from: date).uppercased(), valueKg: month.co2SavedKg)
        }
        return ImpactSummary(totalCo2Kg: payload.totalCo2Kg, sharedDistanceKm: payload.sharedDistanceKm, rideCount: payload.rideCount, months: months)
    }
    static func rewards(_ value: Any, uid: String) throws -> RewardSummary {
        let raw = try object(value, keys: ["userId", "balanceCents", "entries"])
        guard let rows = raw["entries"] as? [Any] else { throw LedgerSummaryError.invalid }
        for row in rows { _ = try object(row, keys: ["id", "type", "amountCents", "createdAtMillis"]) }
        let payload = try decode(Rewards.self, value)
        try require(!uid.isEmpty && payload.userId == uid && payload.entries.count <= 8)
        try nativeInt(payload.balanceCents, min: Int(Int32.min))
        var ids = Set<String>(), previousTime = Double.infinity
        let titles = ["ridePayment": "Paiement trajet", "driverEarning": "Trajet payé", "co2Bonus": "Bonus CO₂",
            "referralBonus": "Parrainage", "manualAdjustment": "Ajustement", "payout": "Retrait", "refund": "Remboursement"]
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "fr_FR")
        formatter.timeZone = TimeZone(identifier: "Europe/Brussels")!; formatter.dateFormat = "dd MMM yyyy"
        let entries = try payload.entries.map { entry in
            try require(!entry.id.isEmpty && ids.insert(entry.id).inserted)
            try require(entry.createdAtMillis.isFinite && entry.createdAtMillis.rounded() == entry.createdAtMillis &&
                abs(entry.createdAtMillis) <= 8_640_000_000_000_000 && entry.createdAtMillis <= previousTime)
            previousTime = entry.createdAtMillis
            try nativeInt(entry.amountCents, min: Int(Int32.min))
            guard let title = titles[entry.type] else { throw LedgerSummaryError.invalid }
            let absolute = abs(entry.amountCents), sign = entry.amountCents >= 0 ? "+" : "-"
            return RewardEntrySummary(id: entry.id, title: title,
                dateLabel: formatter.string(from: Date(timeIntervalSince1970: entry.createdAtMillis / 1000)).uppercased(),
                amountLabel: "\(sign)\(absolute / 100),\(String(format: "%02d", absolute % 100))€", positive: entry.amountCents >= 0)
        }
        let tier = [500, 1_000, 2_500, 5_000].first { payload.balanceCents < $0 } ?? 5_000
        return RewardSummary(balanceCents: payload.balanceCents, nextTierCents: tier,
            progress: min(1, max(0, Double(payload.balanceCents) / Double(tier))), entries: entries)
    }
}
