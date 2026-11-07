package be.sportgreenmoove.app.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TripPriceInputTest {
    @Test
    fun publicationSummaryUsesTheSameExactCentsAsThePayload() {
        for ((text, label) in listOf("" to "Gratuit", "   " to "Gratuit", "0" to "Gratuit",
            "0.29" to "0,29 EUR", "4,50" to "4,50 EUR", "4.2" to "4,20 EUR", "1000" to "1000,00 EUR")) {
            assertEquals(text, label, publicationPriceLabel(text))
        }
    }

    @Test
    fun malformedPricesAreRejectedInsteadOfLabelledAsFree() {
        for (input in listOf("invalid", "NaN", "Infinity", "1e300", "-1", "1e2", "0.001", "1000.01", "1001",
            "1,2,3", "1.2.3", "4,", ".5", "00.50", "1 000", "999999999999999999999999", "+1", "1\n2", "1 EUR", "١", "１")) {
            assertNull(input, publicationPriceCents(input))
            assertEquals(input, "Prix invalide", publicationPriceLabel(input))
        }
    }

    @Test
    fun everySupportedCentAmountRoundTripsExactly() {
        for (cents in 0..100_000) {
            val input = "${cents / 100}.${(cents % 100).toString().padStart(2, '0')}"
            assertEquals(input, cents, publicationPriceCents(input))
        }
    }

    @Test
    fun tripEditingStillRequiresAnExplicitPrice() {
        assertNull(tripChangePriceCents("")); assertNull(tripChangePriceCents("   "))
        assertEquals(0, tripChangePriceCents("0"))
        assertEquals(29, tripChangePriceCents("0.29"))
    }
}
