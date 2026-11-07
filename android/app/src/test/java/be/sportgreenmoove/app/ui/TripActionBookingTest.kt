package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ReservationItem
import be.sportgreenmoove.app.data.ReservationPage
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.domain.BookingReplyUnconfirmedException
import be.sportgreenmoove.app.domain.BookingReviewRequiredException
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import be.sportgreenmoove.app.services.ReservationGateway
import be.sportgreenmoove.app.services.UnconfiguredReservationGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class TripActionBookingTest {
    @Test fun repeatedParentCardTapsMustNotResubmitAnAcknowledgedBooking() {
        Fixture().use { test ->
            repeat(3) {
                launchTripAction(test.scope, test.providers, test.trip, AppRole.Parent, emptyList(),
                    ActiveRidePermissionGate { fail("Parent booking must not request location") }, {}, {}, {}, {}, {}, test.state::open)
                test.state.confirm()
            }
            assertEquals("The same parent card must not submit three acknowledged bookings", 1, test.requests)
        }
    }

    @Test fun openingAndDismissingEitherCardNeverCreatesABooking() {
        Fixture().use { test ->
            repeat(3) { test.state.open(test.trip); assertTrue(test.state.canConfirm); test.state.dismiss() }
            assertEquals(0, test.requests); assertNull(test.state.trip)
        }
    }

    @Test fun repeatedConfirmationAndAnotherCardCannotChangeAnInFlightRequest() {
        Fixture().use { test ->
            val reply = CompletableDeferred<String>()
            test.send = { reply.await() }
            test.state.open(test.trip); repeat(3) { test.state.confirm() }
            test.state.open(test.trip.copy(id = "another-trip")); test.state.dismiss()
            assertEquals(1, test.requests); assertEquals("trip", test.state.trip?.id); assertTrue(test.state.submitting)
            reply.complete("booking"); test.state.confirm()
            assertEquals(1, test.requests); assertFalse(test.state.canConfirm); assertEquals("Demande envoyée.", test.state.confirmation)
        }
    }

    @Test fun aFreshControllerFindsAnEarlierReservationBeyondTheFirstPage() {
        Fixture().use { test ->
            val cursors = mutableListOf<String?>()
            test.page = { cursor -> cursors += cursor
                if (cursor == null) ReservationPage(listOf(test.reservation(tripId = "other")), "page-two")
                else ReservationPage(listOf(test.reservation(status = "approved")), null)
            }
            test.state.open(test.trip); test.state.confirm()
            assertEquals(listOf(null, "page-two"), cursors); assertEquals(0, test.requests)
            assertEquals("Votre réservation est approuvée.", test.state.confirmation)
        }
    }

    @Test fun anotherChildsReservationDoesNotBlockTheAdultsExplicitRequest() {
        Fixture().use { test ->
            test.page = { ReservationPage(listOf(test.reservation(childId = "child")), null) }
            test.state.open(test.trip); assertTrue(test.state.canConfirm); test.state.confirm()
            assertEquals(1, test.requests)
        }
    }

    @Test fun failedHistoryReadsCannotSilentlyPermitAnotherBooking() {
        Fixture().use { test ->
            test.page = { error("unavailable") }
            test.state.open(test.trip); test.state.confirm()
            assertEquals(0, test.requests); assertFalse(test.state.canConfirm); assertNotNull(test.state.error)
            test.page = { ReservationPage(emptyList(), null) }; test.state.reload()
            assertTrue(test.state.canConfirm); assertEquals(0, test.requests)
        }
    }

    @Test fun foreignAccountsAndRepeatedCursorsAreRejectedWithoutAnyWrite() {
        for (foreign in listOf(true, false)) Fixture().use { test ->
            test.page = { ReservationPage(if (foreign) listOf(test.reservation(parent = "outsider")) else emptyList(), "same-cursor") }
            test.state.open(test.trip); test.state.confirm()
            assertFalse(test.state.canConfirm); assertNotNull(test.state.error); assertEquals(0, test.requests)
        }
    }

    @Test fun onlyAnExplicitRetryResubmitsAnUnconfirmedReplyThroughTheExistingGateway() {
        Fixture().use { test ->
            test.send = { throw BookingReplyUnconfirmedException(IllegalStateException("unavailable")) }
            test.state.open(test.trip); test.state.confirm()
            assertTrue(test.state.replyUnconfirmed); assertNull(test.state.confirmation); assertEquals(1, test.requests)
            test.send = { "same-booking" }; test.state.confirm()
            assertEquals(2, test.requests); assertFalse(test.state.replyUnconfirmed); assertNotNull(test.state.confirmation)
        }
    }

    @Test fun changedTermsRequireReloadAndANewExplicitConfirmation() {
        Fixture().use { test ->
            test.send = { throw BookingReviewRequiredException(IllegalStateException("changed terms")) }
            test.state.open(test.trip); test.state.confirm(); test.state.confirm()
            assertFalse(test.state.canConfirm); assertEquals(1, test.requests)
            test.trip = test.trip.copy(priceLabel = "4,00 EUR"); test.send = { "booking" }
            test.state.reload(); assertEquals("4,00 EUR", test.state.trip?.priceLabel)
            assertEquals(1, test.requests); test.state.confirm(); assertEquals(2, test.requests)
        }
    }

    @Test fun aDelayedReadAfterAnAccountSwitchCannotEnableConfirmation() {
        Fixture().use { test ->
            val reply = CompletableDeferred<ReservationPage>()
            test.page = { withContext(NonCancellable) { reply.await() } }
            test.state.open(test.trip); test.uid = "other-account"
            reply.complete(ReservationPage(emptyList(), null)); test.state.confirm()
            assertFalse(test.state.canConfirm); assertEquals(0, test.requests); assertNull(test.state.confirmation)
        }
    }

    @Test fun accountClosureRejectsALateSuccessfulReplyAndClearsAllPrivateState() {
        Fixture().use { test ->
            val reply = CompletableDeferred<String>()
            test.send = { withContext(NonCancellable) { reply.await() } }
            test.state.open(test.trip); test.state.confirm(); test.state.close()
            reply.complete("old-account-booking")
            assertNull(test.state.trip); assertNull(test.state.confirmation); assertNull(test.state.error)
            assertFalse(test.state.submitting); assertFalse(test.state.canConfirm)
        }
    }

    private class Fixture : AutoCloseable {
        var uid = "parent"
        var trip = match("trip").summary
        var requests = 0
        var send: suspend () -> String = { "booking" }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val rows = mutableListOf<ReservationItem>()
        var page: suspend (String?) -> ReservationPage = { ReservationPage(rows.toList(), null) }
        val firebase = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun searchTrips() = listOf(trip)
            override suspend fun requestBooking(trip: TripSummary, childId: String?, seats: Int): String {
                assertNull(childId); assertEquals(1, seats); requests++
                return send().also { rows += reservation() }
            }
        }
        val reservations = object : ReservationGateway by UnconfiguredReservationGateway() {
            override suspend fun list(role: AppRole, cursor: String?): ReservationPage {
                assertEquals(AppRole.Parent, role)
                return page(cursor)
            }
        }
        val providers = AndroidProviderSet(UnconfiguredAuthGateway(), firebase, reservations = reservations)
        val state = DirectBookingState("parent", firebase, reservations, scope) { uid }
        fun reservation(tripId: String = "trip", childId: String? = null, status: String = "requested", parent: String = "parent") =
            ReservationItem(BookingRequestSummary("booking", tripId, parent, childId, null, 1, null, status, "Trajet", "Club", "Date", "Heure", "Prix"), emptySet(), false)
        override fun close() { state.close(); scope.cancel() }
    }
}
