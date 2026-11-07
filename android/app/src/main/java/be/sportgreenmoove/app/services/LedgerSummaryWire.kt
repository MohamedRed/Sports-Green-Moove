package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ImpactMonthSummary
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.RewardEntrySummary
import be.sportgreenmoove.app.data.RewardSummary
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private fun ledgerRow(raw: Any?, keys: Set<String>): Map<*, *> {
    val row = raw as? Map<*, *> ?: error("Invalid ledger response")
    check(row.keys == keys)
    return row
}
private fun ledgerNumber(raw: Any?): Double {
    val number = (raw as? Number)?.toDouble() ?: error("Invalid ledger number")
    check(number.isFinite())
    return number
}
private fun ledgerInt(raw: Any?, min: Int = 0): Int {
    val number = ledgerNumber(raw)
    check(number % 1.0 == 0.0 && number >= min.toDouble() && number <= Int.MAX_VALUE.toDouble())
    return number.toInt()
}
private fun ledgerList(raw: Any?, limit: Int): List<*> {
    val values = raw as? List<*> ?: error("Invalid ledger list")
    check(values.size <= limit)
    return values
}
internal fun parseImpactSummary(raw: Any?, uid: String): ImpactSummary {
    val row = ledgerRow(raw, setOf("userId", "totalCo2Kg", "sharedDistanceKm", "rideCount", "months"))
    check(uid.isNotBlank() && row["userId"] == uid)
    val total = ledgerNumber(row["totalCo2Kg"]).also { check(it >= 0.0) }
    var previous: YearMonth? = null
    val months = ledgerList(row["months"], 6).map { value ->
        val month = ledgerRow(value, setOf("month", "co2SavedKg"))
        val key = YearMonth.parse(month["month"] as? String ?: error("Invalid impact month"))
        check(previous == null || key > previous)
        previous = key
        val kg = ledgerNumber(month["co2SavedKg"]).also { check(it >= 0.0 && it.toFloat().isFinite()) }
        ImpactMonthSummary(key.month.getDisplayName(TextStyle.SHORT, Locale.FRANCE).uppercase(Locale.FRANCE), kg.toFloat())
    }
    return ImpactSummary(total, ledgerInt(row["sharedDistanceKm"]), ledgerInt(row["rideCount"]), months)
}

private val rewardTitles = mapOf("ridePayment" to "Paiement trajet", "driverEarning" to "Trajet payé",
    "co2Bonus" to "Bonus CO₂", "referralBonus" to "Parrainage", "manualAdjustment" to "Ajustement",
    "payout" to "Retrait", "refund" to "Remboursement")
internal fun parseRewardSummary(raw: Any?, uid: String): RewardSummary {
    val row = ledgerRow(raw, setOf("userId", "balanceCents", "entries"))
    check(uid.isNotBlank() && row["userId"] == uid)
    val balance = ledgerInt(row["balanceCents"], Int.MIN_VALUE)
    val ids = mutableSetOf<String>()
    var previousTime: Long? = null
    val entries = ledgerList(row["entries"], 8).map { value ->
        val entry = ledgerRow(value, setOf("id", "type", "amountCents", "createdAtMillis"))
        val id = entry["id"] as? String ?: error("Invalid reward identity")
        check(id.isNotBlank() && ids.add(id))
        val millis = ledgerNumber(entry["createdAtMillis"])
        check(millis % 1.0 == 0.0 && millis in -8_640_000_000_000_000.0..8_640_000_000_000_000.0)
        val time = millis.toLong()
        check(previousTime == null || time <= previousTime)
        previousTime = time
        val cents = ledgerInt(entry["amountCents"], Int.MIN_VALUE)
        val absolute = kotlin.math.abs(cents.toLong())
        val sign = if (cents >= 0) "+" else "-"
        RewardEntrySummary(rewardTitles[entry["type"]] ?: error("Invalid reward type"),
            DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.FRANCE).withZone(ZoneId.of("Europe/Brussels"))
                .format(Instant.ofEpochMilli(time)).uppercase(Locale.FRANCE),
            "$sign${absolute / 100},${(absolute % 100).toString().padStart(2, '0')}€", cents >= 0)
    }
    val tier = listOf(500, 1_000, 2_500, 5_000).firstOrNull { balance < it } ?: 5_000
    return RewardSummary(balance, tier, (balance.toFloat() / tier).coerceIn(0f, 1f), entries)
}
