package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.RideCompletionSummary
import be.sportgreenmoove.app.data.RewardSummary
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripPublishDraft
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.data.emptyImpactSummary
import be.sportgreenmoove.app.data.emptyRewardSummary
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ActiveRideStartupTest {
    @Test
    fun startTrackedRideStartsRadarAndNativeFallbackBeforeReturningLiveNotice() = runBlocking {
        val firebase = RecordingFirebaseGateway()
        val radar = RecordingRadarTrackingGateway(isConfigured = true)
        val providers = AndroidProviderSet(
            auth = UnconfiguredAuthGateway(),
            firebase = firebase,
            radar = radar,
        )

        val result = providers.startTrackedRide(
            tripId = "trip-1",
            role = AppRole.Driver,
            bookingIds = listOf("booking-1"),
        )

        assertEquals("ride-session-1", result.ride.rideSessionId)
        assertEquals("Suivi Radar et secours GPS Firebase activés.", result.notice)
        assertEquals(listOf("startRide:trip-1:booking-1", "nativeFallback:ride-session-1:Driver"), firebase.events)
        assertEquals(listOf("startRadar:ride-session-1:Driver"), radar.events)
    }

    @Test
    fun startAccessibleRideTrackingUsesNativeFallbackWhenRadarIsUnavailable() = runBlocking {
        val firebase = RecordingFirebaseGateway()
        val radar = RecordingRadarTrackingGateway(isConfigured = false)
        val providers = AndroidProviderSet(
            auth = UnconfiguredAuthGateway(),
            firebase = firebase,
            radar = radar,
        )

        val result = providers.startAccessibleRideTracking(role = AppRole.Child)

        assertEquals("ride-session-1", result.ride.rideSessionId)
        assertEquals("Secours GPS Firebase activé.", result.notice)
        assertEquals(listOf("activeRide", "nativeFallback:ride-session-1:Child"), firebase.events)
        assertTrue(radar.events.isEmpty())
    }

    @Test
    fun endTrackedRideStopsNativeFallbackAndRadarTracking() = runBlocking {
        val firebase = RecordingFirebaseGateway()
        val radar = RecordingRadarTrackingGateway(isConfigured = true)
        val providers = AndroidProviderSet(
            auth = UnconfiguredAuthGateway(),
            firebase = firebase,
            radar = radar,
        )

        val completion = providers.endTrackedRide(
            rideSessionId = "ride-session-1",
            distanceMeters = 12_000,
            passengersSharing = 2,
        )

        assertEquals("ride-session-1", completion.rideSessionId)
        assertEquals(listOf("endRide:ride-session-1:12000:2", "stopNativeFallback:ride-session-1"), firebase.events)
        assertEquals(listOf("stopRadar:ride-session-1"), radar.events)
    }
}

private class RecordingFirebaseGateway : FirebaseGateway {
    val events = mutableListOf<String>()
    override val isConfigured = true
    private val ride = LiveRideSnapshot(
        rideSessionId = "ride-session-1",
        tripId = "trip-1",
        status = "active",
        vehicleLastUpdateLabel = "Il y a 1 min",
        childLastUpdateLabel = "Il y a 2 min",
        etaLabel = "Arrivée 17h05",
        stale = false,
    )

    override suspend fun startRide(tripId: String, bookingIds: List<String>): LiveRideSnapshot {
        events += "startRide:$tripId:${bookingIds.joinToString(",")}"
        return ride.copy(tripId = tripId)
    }

    override suspend fun getActiveRide(): LiveRideSnapshot? {
        events += "activeRide"
        return ride
    }

    override suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole) {
        events += "nativeFallback:$rideSessionId:${role.name}"
    }

    override suspend fun endRide(
        rideSessionId: String,
        distanceMeters: Int,
        passengersSharing: Int,
    ): RideCompletionSummary {
        events += "endRide:$rideSessionId:$distanceMeters:$passengersSharing"
        return RideCompletionSummary(rideSessionId, co2SavedKg = 2.4, rewardCents = 50)
    }

    override fun stopNativeLocationFallback(rideSessionId: String) {
        events += "stopNativeFallback:$rideSessionId"
    }

    override suspend fun searchTrips(): List<TripSummary> = emptyList()
    override suspend fun listChildren(): List<ChildSummary> = emptyList()
    override suspend fun listClubSummaries(): List<ClubSummary> = emptyList()
    override suspend fun requestClubMembership(clubId: String): String = "requested"
    override suspend fun suggestPlaces(input: String): List<PlaceSuggestion> = emptyList()
    override suspend fun resolvePlace(placeId: String): ResolvedPlace = error("unused")
    override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary> = emptyList()
    override suspend fun createTrip(draft: TripPublishDraft): String = "trip-1"
    override suspend fun requestBooking(tripId: String, childId: String?): String = "booking-1"
    override suspend fun getDriverBookingRequests(): List<BookingRequestSummary> = emptyList()
    override suspend fun approveBooking(bookingId: String): String = "approved"
    override suspend fun markPickup(rideSessionId: String, bookingId: String, childId: String): String = "pickedUp"
    override suspend fun markDropoff(rideSessionId: String, bookingId: String, childId: String): String = "droppedOff"
    override suspend fun getPayableBookings(): List<PayableBookingSummary> = emptyList()
    override suspend fun getImpactSummary(): ImpactSummary = emptyImpactSummary()
    override suspend fun getRewardSummary(): RewardSummary = emptyRewardSummary()
    override suspend fun getInbox(): InboxSummary = InboxSummary()
    override suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?): String = "rating-1"
    override suspend fun createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Boolean): String = "report-1"
}

private class RecordingRadarTrackingGateway(
    override val isConfigured: Boolean,
) : RadarTrackingGateway {
    val events = mutableListOf<String>()

    override suspend fun startTripTracking(rideSessionId: String, role: AppRole) {
        events += "startRadar:$rideSessionId:${role.name}"
    }

    override suspend fun stopTripTracking(rideSessionId: String) {
        events += "stopRadar:$rideSessionId"
    }
}
