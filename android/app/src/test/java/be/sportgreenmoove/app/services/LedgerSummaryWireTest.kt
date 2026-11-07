package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class LedgerSummaryWireTest {
    private val uid = "owner"
    private fun reward(balance: Any = -22_000, entries: List<Any> = emptyList()) =
        mapOf("userId" to uid, "balanceCents" to balance, "entries" to entries)
    private fun entry(amount: Any = -50_000) = mapOf("id" to "withdrawal", "type" to "payout",
        "amountCents" to amount, "createdAtMillis" to 1_767_225_600_000L)
    private fun impact() = mapOf("userId" to uid, "totalCo2Kg" to 321.25, "sharedDistanceKm" to 257,
        "rideCount" to 257, "months" to listOf(mapOf("month" to "2026-01", "co2SavedKg" to 1.25)))
    private fun rejected(block: () -> Unit) { assertTrue(runCatching(block).isFailure) }

    @Test fun completeTotalsAreNotRecomputedFromEightHistoryEntries() {
        val result = parseRewardSummary(reward(entries = listOf(entry())), uid)
        assertEquals(-22_000, result.balanceCents); assertEquals(0f, result.progress)
        assertEquals("-500,00€", result.entries.single().amountLabel)
        assertFalse(result.entries.single().positive)
        val co2 = parseImpactSummary(impact(), uid)
        assertEquals(257, co2.rideCount); assertEquals(257, co2.sharedDistanceKm)
        assertEquals(321.25, co2.totalCo2Kg, 0.0)
    }
    @Test fun emptyLedgerIsExplicitAndIntegerMinimumDoesNotOverflowFormatting() {
        assertEquals(0, parseRewardSummary(reward(0), uid).balanceCents)
        assertEquals("-21474836,48€", parseRewardSummary(reward(entries = listOf(entry(Int.MIN_VALUE))), uid).entries.single().amountLabel)
    }
    @Test fun foreignAndMalformedTotalsAreRejectedInsteadOfReplacingThemWithZero() {
        rejected { parseRewardSummary(reward(), "foreign") }
        rejected { parseImpactSummary(impact(), "foreign") }
        for (bad in listOf<Any>(0.5, "100", Double.NaN, Double.POSITIVE_INFINITY, 2_147_483_648L))
            rejected { parseRewardSummary(reward(bad), uid) }
        rejected { parseImpactSummary(impact() - "totalCo2Kg", uid) }
        rejected { parseImpactSummary(impact() + ("rideCount" to -1), uid) }
    }
    @Test fun unboundedDuplicateUnknownAndUnsortedHistoryIsRejected() {
        rejected { parseRewardSummary(reward(entries = List(9) { entry() }), uid) }
        rejected { parseRewardSummary(reward(entries = listOf(entry(), entry())), uid) }
        rejected { parseRewardSummary(reward(entries = listOf(entry() + ("type" to "unknown"))), uid) }
        rejected { parseRewardSummary(reward(entries = listOf(entry(), entry() + mapOf("id" to "newer", "createdAtMillis" to 1_800_000_000_000L))), uid) }
        rejected { parseImpactSummary(impact() + ("months" to List(7) { mapOf("month" to "2026-01", "co2SavedKg" to 1) }), uid) }
    }
}
