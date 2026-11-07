package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.BookingIntentSnapshot
import be.sportgreenmoove.app.data.MapPoint
import be.sportgreenmoove.app.data.TripSummary
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

    @Test fun theRequestCarriesTheDisplayedTripObjectWithoutFetchingNewTerms() {
        val gateway = RecordingSearchGateway()
        val intent = BookingIntentSnapshot("2027-01-10T10:00:00Z", null, MapPoint(50.7, 4.6), MapPoint(50.8, 4.3), 250, "driver", 4)
        gateway.results = listOf(match("trip").let { it.copy(summary = it.summary.copy(bookingIntent = intent)) })
        SearchTestSession(gateway).use { test ->
            ready(test)
            val displayed = test.state.matches.single()
            test.state.requestMatch(displayed)
            gateway.results = listOf(displayed.copy(summary = displayed.summary.copy(bookingIntent = intent.copy(priceCents = 900))))
            assertTrue(gateway.submittedTrips.single() === displayed.summary)
            assertEquals(250, gateway.submittedTrips.single().bookingIntent!!.priceCents)
        }
    }

    @Test fun aMismatchedSummaryCannotSubstituteAnotherTrip() {
        val gateway = RecordingSearchGateway()
        gateway.results = listOf(match("trip").let { it.copy(summary = it.summary.copy(id = "other")) })
        SearchTestSession(gateway).use { test ->
            ready(test)
            test.state.requestMatch(test.state.matches.single())
            assertTrue(gateway.bookings.isEmpty())
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
    val submittedTrips = mutableListOf<TripSummary>()
    override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<be.sportgreenmoove.app.data.TripMatchSummary> {
        searches += criteria
        return results
    }
    override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int): String {
        submittedTrips += trip
        bookings += Triple(trip.id, childId, seats)
        return "booking"
    }
}
