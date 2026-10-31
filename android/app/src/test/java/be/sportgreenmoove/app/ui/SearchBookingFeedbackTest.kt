package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.domain.BookingReplyUnconfirmedException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class SearchBookingFeedbackTest {
    @Test fun aConfirmedResultCannotSubmitAgainFromTheSameSearch() {
        var calls = 0
        val gateway = gateway { calls++; "booking-$calls" }
        SearchTestSession(gateway).use { test ->
            ready(test)
            val displayed = test.state.matches.single()
            test.state.requestMatch(displayed)
            test.state.requestMatch(displayed)
            assertEquals("A confirmed search result must not offer another submission", 1, calls)
            assertEquals(listOf("Demande envoyée."), test.notices)
            assertEquals(setOf("trip"), test.state.confirmedBookingTripIds)
            assertNull(test.state.bookingTripId)
        }
    }

    @Test fun aFailedReplyRemainsExplicitlyRetryableWithoutPretendingItSucceeded() {
        var calls = 0
        val gateway = gateway { if (++calls == 1) throw BookingReplyUnconfirmedException(IllegalStateException("network unavailable")) else "booking" }
        SearchTestSession(gateway).use { test ->
            ready(test)
            val displayed = test.state.matches.single()
            test.state.requestMatch(displayed)
            assertTrue(test.notices.isEmpty()); assertEquals(1, test.errors.size)
            assertEquals(setOf("trip"), test.state.retryBookingTripIds)
            test.state.requestMatch(displayed)
            assertEquals(2, calls); assertEquals(listOf("Demande envoyée."), test.notices)
            assertTrue(test.state.retryBookingTripIds.isEmpty())
        }
    }

    @Test fun anExplicitNewSearchDoesNotInventASingleBookingBusinessRestriction() {
        var calls = 0
        SearchTestSession(gateway { calls++; "booking-$calls" }).use { test ->
            ready(test)
            test.state.requestMatch(test.state.matches.single())
            submitSearchForm(test.state, form)
            test.state.requestMatch(test.state.matches.single())
            assertEquals(2, calls)
        }
    }

    @Test fun aPendingRequestStillRejectsRepeatedTapsUntilItsReplyArrives() {
        var calls = 0
        val reply = CompletableDeferred<String>()
        SearchTestSession(gateway { calls++; reply.await() }).use { test ->
            ready(test)
            val displayed = test.state.matches.single()
            repeat(3) { test.state.requestMatch(displayed) }
            assertEquals(1, calls); assertTrue(test.notices.isEmpty())
            assertEquals("trip", test.state.bookingTripId)
            reply.complete("booking")
            test.state.requestMatch(displayed)
            assertEquals(1, calls)
        }
    }

    @Test fun aReplyFromAnEarlierSearchCannotMarkTheNewSelectionConfirmed() {
        var calls = 0
        val reply = CompletableDeferred<String>()
        SearchTestSession(gateway { if (++calls == 1) reply.await() else "new-booking" }).use { test ->
            ready(test)
            test.state.requestMatch(test.state.matches.single())
            submitSearchForm(test.state, form.copy(seatsNeeded = 2))
            assertTrue(test.state.confirmedBookingTripIds.isEmpty())
            reply.complete("previous-booking")
            assertNull(test.state.bookingTripId)
            assertTrue(test.state.confirmedBookingTripIds.isEmpty())
            test.state.requestMatch(test.state.matches.single())
            assertEquals(2, calls); assertEquals(setOf("trip"), test.state.confirmedBookingTripIds)
        }
    }

    @Test fun newCriteriaDiscardThePreviousConfirmationButDoNotSubmitAnything() {
        var calls = 0
        SearchTestSession(gateway { calls++; "booking" }).use { test ->
            ready(test); test.state.requestMatch(test.state.matches.single())
            test.state.updateForm(test.state.form.copy(seatsNeeded = 2))
            assertTrue(test.state.confirmedBookingTripIds.isEmpty())
            assertTrue(test.state.retryBookingTripIds.isEmpty()); assertEquals(1, calls)
        }
    }

    @Test fun closingTheAccountClearsFeedbackAndRejectsADelayedSuccessfulReply() {
        val reply = CompletableDeferred<String>()
        SearchTestSession(gateway { withContext(NonCancellable) { reply.await() } }).use { test ->
            ready(test); test.state.requestMatch(test.state.matches.single())
            test.state.close(); reply.complete("previous-account-booking")
            assertNull(test.state.bookingTripId); assertTrue(test.state.confirmedBookingTripIds.isEmpty())
            assertTrue(test.state.retryBookingTripIds.isEmpty()); assertTrue(test.notices.isEmpty())
        }
    }

    private fun gateway(request: suspend () -> String) = object : FirebaseGateway by placesGateway() {
        override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(match("trip"))
        override suspend fun requestBooking(trip: TripSummary, childId: String?, seats: Int) = request()
    }
    @Test fun aDefinitiveBusinessRejectionIsNotLabelledAsAnUnconfirmedRetry() {
        SearchTestSession(gateway { error("permission-denied") }).use { test ->
            ready(test); test.state.requestMatch(test.state.matches.single())
            assertTrue(test.state.retryBookingTripIds.isEmpty())
            assertTrue(test.state.confirmedBookingTripIds.isEmpty())
            assertTrue(test.notices.isEmpty()); assertEquals(1, test.errors.size)
        }
    }
    private fun ready(test: SearchTestSession) {
        selectBoth(test.state); submitSearchForm(test.state, form)
        assertEquals(1, test.state.matches.size)
    }
}
