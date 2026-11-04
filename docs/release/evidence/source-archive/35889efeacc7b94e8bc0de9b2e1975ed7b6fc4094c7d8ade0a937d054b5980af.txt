import Foundation

struct ImpactMonthSummary: Identifiable, Hashable, Sendable {
    let label: String
    let valueKg: Double

    var id: String { label }
}

struct ImpactSummary: Hashable, Sendable {
    let totalCo2Kg: Double
    let sharedDistanceKm: Int
    let rideCount: Int
    let months: [ImpactMonthSummary]

    static let empty = ImpactSummary(totalCo2Kg: 0, sharedDistanceKm: 0, rideCount: 0, months: [])
}

struct RewardSummary: Hashable, Sendable {
    let balanceCents: Int
    let nextTierCents: Int
    let progress: Double
    let entries: [RewardEntrySummary]

    static let empty = RewardSummary(balanceCents: 0, nextTierCents: 500, progress: 0, entries: [])
}

struct RewardEntrySummary: Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let dateLabel: String
    let amountLabel: String
    let positive: Bool
}
