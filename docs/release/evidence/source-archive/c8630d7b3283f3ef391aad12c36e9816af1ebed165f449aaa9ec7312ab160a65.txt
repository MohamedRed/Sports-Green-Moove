package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ImpactMonthSummary
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.RewardEntrySummary
import be.sportgreenmoove.app.data.RewardSummary
import be.sportgreenmoove.app.data.emptyImpactSummary
import be.sportgreenmoove.app.data.emptyRewardSummary
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

internal class FirebaseAndroidLedgerGateway(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun getImpactSummary(): ImpactSummary {
        val uid = auth.currentUser?.uid ?: return emptyImpactSummary()
        val entries = firestore.collection("co2Ledger")
            .whereEqualTo("userId", uid)
            .limit(100)
            .get()
            .await()
            .documents
            .map { it.data.orEmpty() }
        val totalKg = entries.sumOf { numberValue(it["co2SavedKg"]) ?: 0.0 }
        val totalMeters = entries.sumOf { (numberValue(it["distanceMeters"]) ?: 0.0).toInt() }
        val months = entries
            .mapNotNull(::monthImpact)
            .groupBy { it.monthStartMillis }
            .map { (monthStartMillis, values) ->
                MonthSummary(
                    monthStartMillis = monthStartMillis,
                    summary = ImpactMonthSummary(values.first().label, values.sumOf { it.co2SavedKg }.toFloat()),
                )
            }
            .sortedBy { it.monthStartMillis }
            .takeLast(6)
            .map { it.summary }
        return ImpactSummary(totalKg, totalMeters / 1000, entries.size, months)
    }

    suspend fun getRewardSummary(): RewardSummary {
        val uid = auth.currentUser?.uid ?: return emptyRewardSummary()
        val documents = firestore.collection("rewardLedger")
            .whereEqualTo("userId", uid)
            .limit(100)
            .get()
            .await()
            .documents
        val entries = documents.map { it.id to it.data.orEmpty() }
        val balance = entries.sumOf { (_, data) -> (numberValue(data["amountCents"]) ?: 0.0).toInt() }
        val tier = nextTierCents(balance)
        val history = entries
            .sortedByDescending { (_, data) -> epochMillis(data["createdAt"]) }
            .take(8)
            .map { (_, data) -> rewardEntry(data) }
        return RewardSummary(balance, tier, min(1f, max(0f, balance.toFloat() / tier.toFloat())), history)
    }
}

private data class MonthImpact(
    val monthStartMillis: Long,
    val label: String,
    val co2SavedKg: Double,
)

private data class MonthSummary(
    val monthStartMillis: Long,
    val summary: ImpactMonthSummary,
)

private fun monthImpact(data: Map<String, Any>): MonthImpact? {
    val millis = epochMillis(data["createdAt"]).takeIf { it > 0 } ?: return null
    return MonthImpact(
        monthStartMillis = monthStartMillis(millis),
        label = monthLabel(millis),
        co2SavedKg = numberValue(data["co2SavedKg"]) ?: 0.0,
    )
}

private fun rewardEntry(data: Map<String, Any>): RewardEntrySummary {
    val cents = (numberValue(data["amountCents"]) ?: 0.0).toInt()
    return RewardEntrySummary(
        title = rewardTitle(data["type"] as? String),
        dateLabel = dateLabel(data["createdAt"]),
        amountLabel = amountLabel(cents),
        positive = cents >= 0,
    )
}

private fun rewardTitle(type: String?): String = when (type) {
    "driverEarning" -> "Trajet payé"
    "co2Bonus" -> "Bonus CO₂"
    "referralBonus" -> "Parrainage"
    "manualAdjustment" -> "Ajustement"
    "payout" -> "Retrait"
    "refund" -> "Remboursement"
    else -> "Mouvement"
}

private fun nextTierCents(balance: Int): Int =
    listOf(500, 1_000, 2_500, 5_000).firstOrNull { balance < it } ?: 5_000

private fun amountLabel(cents: Int): String {
    val sign = if (cents >= 0) "+" else "-"
    val abs = kotlin.math.abs(cents)
    return "$sign${abs / 100},${(abs % 100).toString().padStart(2, '0')}€"
}

private fun monthLabel(millis: Long): String =
    SimpleDateFormat("MMM", Locale.FRANCE).format(java.util.Date(millis)).uppercase(Locale.FRANCE)

private fun monthStartMillis(millis: Long): Long {
    val calendar = Calendar.getInstance(Locale.FRANCE)
    calendar.timeInMillis = millis
    calendar.set(Calendar.DAY_OF_MONTH, 1)
    calendar.set(Calendar.HOUR_OF_DAY, 0)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    return calendar.timeInMillis
}

private fun dateLabel(value: Any?): String =
    epochMillis(value)
        .takeIf { it > 0 }
        ?.let { SimpleDateFormat("dd MMM yyyy", Locale.FRANCE).format(java.util.Date(it)).uppercase(Locale.FRANCE) }
        ?: "DATE INCONNUE"

private fun epochMillis(value: Any?): Long = when (value) {
    is Timestamp -> value.toDate().time
    is String -> runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrDefault(0L)
    else -> 0L
}

private fun numberValue(value: Any?): Double? =
    (value as? Number)?.toDouble()
