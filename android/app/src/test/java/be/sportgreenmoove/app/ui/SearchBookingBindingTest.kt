package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.services.FirebaseGateway
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchBookingBindingTest {
    @Test fun anUnsearchedTripCannotBeRequested() {
        val gateway = RecordingSearchGateway()
        SearchTestSession(gateway).use { test ->
            test.state.requestMatch(match("trip"))
            assertEquals(0, gateway.bookings.size)
            assertTrue(test.errors.isNotEmpty())
        }
    }

    @Test fun editingAPlaceInvalidatesThePreviousRequestAction() {
        val gateway = RecordingSearchGateway()
        SearchTestSession(gateway).use { test ->
            ready(test)
            val previous = test.state.matches.single()
            test.state.editPlace(SearchPlaceTarget.Origin)
            test.state.requestMatch(previous)
            assertEquals(0, gateway.bookings.size)
        }
    }

    @Test fun theRequestCannotSubstituteAChildDifferentFromTheCompletedSearch() {
        val gateway = RecordingSearchGateway()
        SearchTestSession(gateway).use { test ->
            ready(test, "child-a")
            val previous = test.state.matches.single()
            test.state.updateForm(test.state.form.copy(childUserId = "child-b"))
            test.state.requestMatch(previous)
            assertEquals(0, gateway.bookings.size)
        }
    }

    @Test fun aTripOutsideTheReturnedResultsCannotBeRequested() {
        val gateway = RecordingSearchGateway()
        SearchTestSession(gateway).use { test ->
            ready(test)
            test.state.requestMatch(match("unrelated"))
            assertEquals(0, gateway.bookings.size)
        }
    }

    @Test fun missingConsentIsRejectedInsteadOfDispatchingAContradictorySearch() {
        val gateway = RecordingSearchGateway()
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form.copy(requireChildTracking = false, guardianConsent = false))
            assertEquals(0, gateway.searches.size)
            assertTrue(test.errors.isNotEmpty())
        }
    }

    private fun ready(test: SearchTestSession, child: String? = null) {
        selectBoth(test.state)
        submitSearchForm(test.state, form.copy(childUserId = child, guardianConsent = true))
        assertEquals(1, test.state.matches.size)
    }
}

internal class RecordingSearchGateway : FirebaseGateway by placesGateway() {
    var results = listOf(match("trip"))
    val bookings = mutableListOf<Triple<String, String?, Int>>()
    val searches = mutableListOf<TripSearchCriteria>()
    override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<be.sportgreenmoove.app.data.TripMatchSummary> {
        searches += criteria
        return results
    }
    override suspend fun requestBooking(tripId: String, childId: String?, seats: Int): String {
        bookings += Triple(tripId, childId, seats)
        return "booking"
    }
}
