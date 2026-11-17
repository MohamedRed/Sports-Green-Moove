package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class SearchCriteriaStateTest {
    @Test fun everyChangedOptionInvalidatesResultsAndTheirBookingAction() {
        val changes: List<(SearchFormState) -> SearchFormState> = listOf(
            { it.copy(seatsNeeded = 2) }, { it.copy(baggage = "large") }, { it.copy(returnTrip = true) },
            { it.copy(desiredDepartureAtIso = "2026-10-17T14:00:00Z") },
            { it.copy(requireChildTracking = true) }, { it.copy(childUserId = "child-b") }, { it.copy(guardianConsent = false) },
        )
        for (change in changes) {
            val gateway = RecordingSearchGateway()
            SearchTestSession(gateway).use { test ->
                ready(test)
                val old = test.state.matches.single()
                test.state.updateForm(change(test.state.form))
                assertTrue(test.state.matches.isEmpty())
                assertFalse(test.state.hasSearched)
                test.state.requestMatch(old)
                assertTrue(gateway.bookings.isEmpty())
            }
        }
    }
    @Test fun changingAnOptionRejectsAnAlreadyRunningSearchResponse() = runBlocking {
        val response = CompletableDeferred<List<TripMatchSummary>>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria) = withContext(NonCancellable) { response.await() }
        }
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form)
            test.state.updateForm(test.state.form.copy(seatsNeeded = 2))
            response.complete(listOf(match("old")))
            assertTrue(test.state.matches.isEmpty())
            assertFalse(test.state.hasSearched || test.state.loading)
        }
    }
    @Test fun bookingUsesTheCompletedSearchsSeatCountAndChild() {
        for (seats in 1..3) {
            val gateway = RecordingSearchGateway().apply { results = listOf(match("trip").let { it.copy(summary = it.summary.copy(seatsAvailable = 4)) }) }
            SearchTestSession(gateway).use { test ->
                selectBoth(test.state)
                submitSearchForm(test.state, form.copy(seatsNeeded = seats, childUserId = "child-a"))
                test.state.requestMatch(test.state.matches.single())
                assertEquals(listOf(Triple("trip", "child-a", seats)), gateway.bookings)
            }
        }
    }
    @Test fun changingChildOrTrackingRequiresANewExplicitConsent() {
        SearchTestSession(RecordingSearchGateway()).use { test ->
            ready(test)
            test.state.updateForm(test.state.form.copy(childUserId = "child-b", guardianConsent = true))
            assertFalse(test.state.form.guardianConsent)
            test.state.updateForm(test.state.form.copy(guardianConsent = true))
            assertTrue(test.state.form.guardianConsent)
            test.state.updateForm(test.state.form.copy(requireChildTracking = true, guardianConsent = true))
            assertFalse(test.state.form.guardianConsent)
        }
    }
    @Test fun removedChildClearsSelectionConsentAndResultsWithoutSelectingAnotherChild() {
        SearchTestSession(RecordingSearchGateway()).use { test ->
            val a = ChildSummary("child-a", "Enfant A", "U8 QA", false)
            val b = a.copy(id = "child-b", label = "Enfant B")
            test.state.updateChildren(listOf(a, b))
            ready(test)
            test.state.updateChildren(listOf(b))
            assertNull(test.state.form.childUserId)
            assertFalse(test.state.form.guardianConsent)
            assertTrue(test.state.matches.isEmpty())
        }
    }
    @Test fun unchangedOptionsKeepTheCurrentResults() {
        SearchTestSession(RecordingSearchGateway()).use { test ->
            ready(test)
            val results = test.state.matches
            test.state.updateForm(test.state.form.copy())
            assertEquals(results, test.state.matches)
            assertTrue(test.state.hasSearched)
        }
    }
    @Test fun invalidOptionsAreExplicitFailuresNotEmptySearchResults() {
        val invalid = listOf(form.copy(desiredDepartureAtIso = "not a date"), form.copy(seatsNeeded = 0),
            form.copy(seatsNeeded = 9), form.copy(baggage = "unknown"))
        for (selection in invalid) {
            val gateway = RecordingSearchGateway()
            SearchTestSession(gateway).use { test ->
                selectBoth(test.state)
                submitSearchForm(test.state, selection)
                assertTrue(gateway.searches.isEmpty() && test.errors.isNotEmpty())
                assertFalse(test.state.hasSearched)
            }
        }
    }
    @Test fun insufficientReturnedCapacityCannotBeRequested() {
        val gateway = RecordingSearchGateway().apply { results = listOf(match("trip").let { it.copy(summary = it.summary.copy(seatsAvailable = 1)) }) }
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form.copy(seatsNeeded = 2))
            test.state.requestMatch(test.state.matches.single())
            assertTrue(gateway.bookings.isEmpty())
            assertTrue(test.errors.last().contains("places"))
        }
    }
    @Test fun aClosedSearchLosesUnresolvedInputAndAllFormChoices() {
        SearchTestSession(RecordingSearchGateway()).use { test ->
            test.state.editPlace(SearchPlaceTarget.Origin, "Brouillon privé")
            test.state.updateForm(form.copy(seatsNeeded = 3, baggage = "large"))
            test.state.close()
            assertEquals("", test.state.originInput)
            assertEquals("", test.state.destinationInput)
            assertEquals(1, test.state.form.seatsNeeded)
            assertEquals("medium", test.state.form.baggage)
            assertNull(test.state.form.childUserId)
            assertFalse(test.state.form.guardianConsent)
        }
    }
    private fun ready(test: SearchTestSession) {
        selectBoth(test.state)
        submitSearchForm(test.state, form.copy(childUserId = "child-a"))
        assertTrue(test.state.hasSearched)
    }
}
