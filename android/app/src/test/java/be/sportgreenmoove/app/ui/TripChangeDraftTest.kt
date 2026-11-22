package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.domain.tripChangeInstant
import be.sportgreenmoove.app.domain.tripChangePriceCents
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class TripChangeDraftTest {
    @Test fun pricesUseExactCentsAndRejectImplicitRounding() {
        for (input in listOf("4,25", "4.25", " 4,25 ")) assertEquals(425, tripChangePriceCents(input))
        assertEquals(0, tripChangePriceCents("0")); assertEquals(100000, tripChangePriceCents("1000"))
        for (input in listOf("", "4,255", "-1", "1e2", "NaN", "1 000", "1000,01", "4,", ".5")) assertNull(input, tripChangePriceCents(input))
    }
    @Test fun ambiguousAndNonexistentBelgianTimesRequireAnotherExplicitTime() {
        assertNull(tripChangeInstant(LocalDate.of(2027, 3, 28), LocalTime.of(2, 30)))
        assertNull(tripChangeInstant(LocalDate.of(2026, 10, 25), LocalTime.of(2, 30)))
        assertEquals("2026-12-01T09:30:00Z", tripChangeInstant(LocalDate.of(2026, 12, 1), LocalTime.of(10, 30)))
    }
    @Test fun untouchedInstantsKeepOriginalPrecisionAndOffset() {
        val initial = ChangeFixture.terms.copy(departureAt = "2026-10-25T02:30:00.123+02:00", arrivalBy = null)
        val draft = TripChangeDraft(initial)
        assertEquals(initial, draft.terms(ChangeFixture.now)); assertFalse(draft.changedFrom(initial, ChangeFixture.now))
        draft.price = "4,00"
        assertEquals(initial.departureAt, draft.terms(ChangeFixture.now)?.departureAt)
        draft.departureTime = LocalTime.of(2, 45); assertNull(draft.terms(ChangeFixture.now))
        assertEquals("Cette heure de départ est ambiguë ou inexistante à Bruxelles.", draft.validationMessage(ChangeFixture.now))
    }
    @Test fun invalidScheduleOrUnresolvedPlaceCannotBecomeAProposal() {
        val draft = TripChangeDraft(ChangeFixture.terms)
        draft.price = "4,00"; assertTrue(draft.changedFrom(ChangeFixture.terms, ChangeFixture.now))
        draft.arrivalTime = LocalTime.of(10, 0); assertNull(draft.terms(ChangeFixture.now))
        assertEquals("L’arrivée ne peut pas précéder le départ.", draft.validationMessage(ChangeFixture.now))
        draft.hasArrival = false; assertNotNull(draft.terms(ChangeFixture.now))
        draft.origin.edit("Unconfirmed place"); assertNull(draft.terms(ChangeFixture.now))
        assertEquals("L’adresse de départ n’est pas encore confirmée.", draft.validationMessage(ChangeFixture.now))
        draft.origin.keepOriginal(); assertNotNull(draft.terms(ChangeFixture.now))
        draft.departureDate = LocalDate.of(2020, 1, 1); assertNull(draft.terms(ChangeFixture.now))
    }
    @Test fun editingPlaceInvalidatesCoordinatesAndLateSuggestions() = runBlocking {
        val reply = CompletableDeferred<List<PlaceSuggestion>>()
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun suggestPlaces(input: String) = reply.await()
        }
        val draft = TripChangePlaceDraft(ChangeFixture.terms.origin)
        draft.edit("Wavre"); assertNull(draft.point)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { draft.suggest(gateway) }
        draft.edit("Ottignies"); reply.complete(listOf(PlaceSuggestion("old", "Wavre", "Wavre", "Belgique"))); job.join()
        assertTrue(draft.suggestions.isEmpty()); assertNull(draft.point)
        draft.keepOriginal(); assertEquals(ChangeFixture.terms.origin, draft.point)
    }
    @Test fun staleResolutionAndClosedSessionCannotRestorePrivateData() = runBlocking {
        val suggestion = PlaceSuggestion("place", "Wavre", "Wavre", "Belgique")
        val reply = CompletableDeferred<ResolvedPlace>()
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun suggestPlaces(input: String) = listOf(suggestion)
            override suspend fun resolvePlace(placeId: String) = withContext(NonCancellable) { reply.await() }
        }
        val draft = TripChangePlaceDraft(ChangeFixture.terms.origin); draft.edit("Wavre"); draft.suggest(gateway)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { draft.select(suggestion, gateway) }
        draft.close(); reply.complete(ResolvedPlace("place", "Wavre", "Rue de Wavre", 50.7, 4.6)); job.join()
        assertNull(draft.point); assertNull(draft.address); assertEquals("", draft.input); assertFalse(draft.busy)
    }
}
