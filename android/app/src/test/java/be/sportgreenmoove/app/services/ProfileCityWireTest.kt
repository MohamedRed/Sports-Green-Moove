package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.normalizedProfileCity
import org.junit.Assert.*
import org.junit.Test

class ProfileCityWireTest {
    private val data = mapOf("userId" to "parent", "city" to "Liège", "revision" to 1)
    @Test fun parsesAnExplicitAbsentCityAndExactSavedRevision() {
        assertEquals("Liège", parseProfileCity(data, "parent").city)
        assertEquals(0L, parseProfileCity(data + mapOf("city" to null, "revision" to 0), "parent").revision)
    }
    @Test fun rejectsForeignMissingExtraAndMalformedFields() {
        for (value in listOf(data + ("userId" to "other"), data - "city", data + ("extra" to true),
            data + ("city" to 42), data + ("city" to " Wavre "), data + ("city" to ""),
            data + ("revision" to 0), data + ("revision" to "1"))) {
            assertTrue(runCatching { parseProfileCity(value, "parent") }.isFailure)
        }
    }
    @Test fun rejectsFractionalNonfiniteAndUnsafeVersions() {
        for (revision in listOf(-1, 0.5, Double.NaN, Double.POSITIVE_INFINITY, 9_007_199_254_740_992L))
            assertTrue(runCatching { parseProfileCity(data + ("revision" to revision), "parent") }.isFailure)
    }
    @Test fun normalizesUnicodeAndRejectsControlsInsteadOfSilentlyRemovingThem() {
        assertEquals("Liège", normalizedProfileCity(" Lie\u0300ge "))
        for (value in listOf("", " ", "a".repeat(101), "a\nb", "\tWavre", "a\u202eb", "a\u200bb"))
            assertNull(normalizedProfileCity(value))
    }
}
