package be.sportgreenmoove.app.data

data class ImpactMonthSummary(
    val label: String,
    val valueKg: Float,
)

data class ImpactSummary(
    val totalCo2Kg: Double,
    val sharedDistanceKm: Int,
    val rideCount: Int,
    val months: List<ImpactMonthSummary>,
)

data class RewardSummary(
    val balanceCents: Int,
    val nextTierCents: Int,
    val progress: Float,
    val entries: List<RewardEntrySummary>,
)

data class RewardEntrySummary(
    val title: String,
    val dateLabel: String,
    val amountLabel: String,
    val positive: Boolean,
)

data class NativeLedgerSummaries(
    val impact: ImpactSummary = emptyImpactSummary(),
    val rewards: RewardSummary = emptyRewardSummary(),
)

fun emptyImpactSummary(): ImpactSummary =
    ImpactSummary(totalCo2Kg = 0.0, sharedDistanceKm = 0, rideCount = 0, months = emptyList())

fun emptyRewardSummary(): RewardSummary =
    RewardSummary(balanceCents = 0, nextTierCents = 500, progress = 0f, entries = emptyList())
