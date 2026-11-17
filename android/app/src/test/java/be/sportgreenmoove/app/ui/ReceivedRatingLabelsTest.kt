package be.sportgreenmoove.app.ui

import org.junit.Assert.*
import org.junit.Test

class ReceivedRatingLabelsTest {
    @Test fun preservesFrenchGrammarAndFullIntegerCounts() {
        assertEquals("0 avis reçus", receivedRatingCountLabel(0))
        assertEquals("1 avis reçu", receivedRatingCountLabel(1))
        assertEquals("104 avis reçus", receivedRatingCountLabel(104))
        assertEquals("1 000 avis reçus", receivedRatingCountLabel(1000))
        assertEquals("9 007 199 254 740 991 avis reçus", receivedRatingCountLabel(9_007_199_254_740_991L))
    }
    @Test fun usesBreakableGroupingWithoutRoundingOrDroppingDigits() {
        val count = 9_007_199_254_740_991L
        val label = receivedRatingCountLabel(count)
        assertFalse(label.contains('\u00A0')); assertFalse(label.contains('\u202F'))
        assertEquals(count.toString(), label.filter(Char::isDigit))
    }
    @Test fun rejectsNegativeCountsInsteadOfInventingAnEmptySummary() {
        assertThrows(IllegalArgumentException::class.java) { receivedRatingCountLabel(-1) }
    }
}
