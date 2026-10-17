package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.domain.BookingReviewRequiredException
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class SearchBookingRecoveryTest {
    @Test fun aChangedTripClearsResultsAndRequiresAnotherSearchWithoutAutomaticBookingRetry() {
        var bookings = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: be.sportgreenmoove.app.data.TripSearchCriteria) = listOf(match("trip"))
            override suspend fun requestBooking(tripId: String, childId: String?, seats: Int): String {
                bookings++
                throw BookingReviewRequiredException()
            }
        }
        SearchTestSession(gateway).use { test ->
            ready(test)
            val original = test.state.matches.single()
            test.state.requestMatch(original)
            assertFalse(test.state.hasSearched); assertTrue(test.state.matches.isEmpty())
            assertEquals(1, bookings); assertTrue(test.notices.isEmpty())
            assertTrue(test.errors.single().contains("Relancez la recherche"))
            test.state.requestMatch(original)
            assertEquals(1, bookings)
            submitSearchForm(test.state, form)
            assertEquals(1, test.state.matches.size)
        }
    }

    @Test fun anOldRejectionDoesNotEraseResultsFromANewerSearch() {
        val response = CompletableDeferred<String>()
        var searches = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: be.sportgreenmoove.app.data.TripSearchCriteria) = listOf(match("trip-${++searches}"))
            override suspend fun requestBooking(tripId: String, childId: String?, seats: Int) = withContext(NonCancellable) { response.await() }
        }
        SearchTestSession(gateway).use { test ->
            ready(test)
            test.state.requestMatch(test.state.matches.single())
            submitSearchForm(test.state, form)
            val newer = test.state.matches
            response.completeExceptionally(BookingReviewRequiredException())
            assertTrue(test.state.hasSearched); assertEquals(newer, test.state.matches)
        }
    }

    @Test fun aClosedAccountDoesNotReceiveTheOldFailureOrClearAnotherController() {
        val response = CompletableDeferred<String>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: be.sportgreenmoove.app.data.TripSearchCriteria) = listOf(match("trip"))
            override suspend fun requestBooking(tripId: String, childId: String?, seats: Int) = withContext(NonCancellable) { response.await() }
        }
        SearchTestSession(gateway).use { previous ->
            ready(previous); previous.state.requestMatch(previous.state.matches.single()); previous.state.close()
            SearchTestSession(gateway).use { current ->
                ready(current)
                response.completeExceptionally(BookingReviewRequiredException())
                assertTrue(previous.errors.isEmpty()); assertTrue(previous.notices.isEmpty())
                assertTrue(current.state.hasSearched); assertEquals(1, current.state.matches.size)
            }
        }
    }

    @Test fun anUnrelatedFailureKeepsTheExistingErrorPolicyAndDoesNotClaimChangedTerms() {
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: be.sportgreenmoove.app.data.TripSearchCriteria) = listOf(match("trip"))
            override suspend fun requestBooking(tripId: String, childId: String?, seats: Int): String = error("network unavailable")
        }
        SearchTestSession(gateway).use { test ->
            ready(test); test.state.requestMatch(test.state.matches.single())
            assertTrue(test.state.hasSearched); assertEquals(1, test.state.matches.size)
            assertTrue(test.errors.single().contains("Connexion réseau")); assertTrue(test.notices.isEmpty())
        }
    }

    private fun ready(test: SearchTestSession) {
        selectBoth(test.state)
        submitSearchForm(test.state, form)
        assertEquals(1, test.state.matches.size)
    }
}
