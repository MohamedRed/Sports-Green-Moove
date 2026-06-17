package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.InboxChatSummary
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.data.ImpactMonthSummary
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.MapPoint
import be.sportgreenmoove.app.data.MapRoutePreview
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.RideCompletionSummary
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.RewardEntrySummary
import be.sportgreenmoove.app.data.RewardSummary
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripPublishDraft
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.FirebaseGateway

object UiFlowFixtures {
    val origin = ResolvedPlace("origin", "Wavre", "Rue du Stade 1, Wavre", 50.715, 4.612)
    val destination = ResolvedPlace("dest", "Ottignies", "Avenue du Club 8, Ottignies", 50.669, 4.567)
    val child = ChildSummary("child-1", "Nora", "U8 Royal Ottignies", trackingEnabled = true)
    val clubs = listOf(
        ClubSummary("club-royal", "Royal Ottignies Sports", "Football", 89, "PARENT", "RO", listOf("NO", "CO")),
        ClubSummary("club-tennis", "Tennis Club Wavre", "Tennis", 56, null, "TC", emptyList()),
    )
    val route = MapRoutePreview(MapPoint(50.715, 4.612), MapPoint(50.669, 4.567))

    val trip = TripSummary(
        id = "trip-1",
        title = "U8 Nationaux vs Royal Ottignies SC",
        club = "Royal Ottignies",
        category = "U8",
        departureLabel = "Aujourd'hui 16h45",
        seatsAvailable = 2,
        priceLabel = "4,00 EUR",
        passengerInitials = listOf("NO"),
        reasons = listOf("+6 min détour", "Même équipe U8"),
        mapPreview = route,
    )

    val match = TripMatchSummary(
        tripId = trip.id,
        score = 91.0,
        summary = trip,
        reasons = trip.reasons,
        detourMinutes = 6,
        pickupDistanceMeters = 850,
    )

    val bookingRequest = BookingRequestSummary(
        bookingId = "booking-1",
        tripId = trip.id,
        parentUserId = "parent-123456",
        childId = child.id,
        childLabel = child.label,
        seats = 1,
        note = "Besoin d'un siège enfant.",
        status = "requested",
        title = trip.title,
        club = trip.club,
        dateLabel = trip.dateLabel,
        timeLabel = trip.timeLabel,
        priceLabel = trip.priceLabel,
    )

    val activeRide = LiveRideSnapshot(
        rideSessionId = "ride-session-1",
        tripId = trip.id,
        status = "active",
        vehicleLastUpdateLabel = "Il y a 1 min",
        childLastUpdateLabel = "Il y a 2 min",
        etaLabel = "Arrivée 17h05",
        stale = false,
        passengers = listOf(RidePassengerStatus("booking-1", child.id, child.label, "pending", "pending")),
    )

    val payableBooking = PayableBookingSummary(
        bookingId = "booking-1",
        tripId = trip.id,
        title = trip.title,
        club = trip.club,
        dateLabel = trip.dateLabel,
        timeLabel = trip.timeLabel,
        seats = 1,
        amountCents = 400,
        amountLabel = "4,00 EUR",
        paymentStatus = "required",
    )

    val impact = ImpactSummary(
        totalCo2Kg = 6.8,
        sharedDistanceKm = 412,
        rideCount = 9,
        months = listOf(
            ImpactMonthSummary("SEPT", 1.4f),
            ImpactMonthSummary("OCT", 2.2f),
            ImpactMonthSummary("NOV", 3.2f),
        ),
    )

    val rewards = RewardSummary(
        balanceCents = 680,
        nextTierCents = 1_000,
        progress = 0.68f,
        entries = listOf(
            RewardEntrySummary("Bonus CO₂", "07 NOV 2022", "+0,50€", true),
            RewardEntrySummary("Trajet payé", "03 NOV 2022", "+1,20€", true),
        ),
    )
}

class UiFlowFirebaseGateway : FirebaseGateway {
    var createdTripDraft: TripPublishDraft? = null
        private set
    var requestedClubId: String? = null
        private set
    var submittedRating: SubmittedRating? = null
        private set
    var createdReport: CreatedReport? = null
        private set

    override val isConfigured = true
    override suspend fun searchTrips() = listOf(UiFlowFixtures.trip)
    override suspend fun listChildren() = listOf(UiFlowFixtures.child)
    override suspend fun listClubSummaries() = UiFlowFixtures.clubs
    override suspend fun requestClubMembership(clubId: String): String {
        requestedClubId = clubId
        return "requested"
    }
    override suspend fun suggestPlaces(input: String) = listOf(PlaceSuggestion("place-1", input, input, "Belgique"))
    override suspend fun resolvePlace(placeId: String) = UiFlowFixtures.origin
    override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(UiFlowFixtures.match)
    override suspend fun createTrip(draft: TripPublishDraft): String {
        createdTripDraft = draft
        return "trip-created"
    }
    override suspend fun requestBooking(tripId: String, childId: String?) = "booking-created"
    override suspend fun getDriverBookingRequests() = listOf(UiFlowFixtures.bookingRequest)
    override suspend fun approveBooking(bookingId: String) = "approved"
    override suspend fun startRide(tripId: String, bookingIds: List<String>) = UiFlowFixtures.activeRide
    override suspend fun getActiveRide() = UiFlowFixtures.activeRide
    override suspend fun markPickup(rideSessionId: String, bookingId: String, childId: String) = "pickedUp"
    override suspend fun markDropoff(rideSessionId: String, bookingId: String, childId: String) = "droppedOff"

    override suspend fun endRide(
        rideSessionId: String,
        distanceMeters: Int,
        passengersSharing: Int,
    ) = RideCompletionSummary(rideSessionId, co2SavedKg = 2.4, rewardCents = 50)

    override suspend fun getPayableBookings() = listOf(UiFlowFixtures.payableBooking)
    override suspend fun getImpactSummary() = UiFlowFixtures.impact
    override suspend fun getRewardSummary() = UiFlowFixtures.rewards

    override suspend fun getInbox() = InboxSummary(
        chats = listOf(InboxChatSummary("chat-1", "trip", "trip-1", "Coach U8", "Départ confirmé.", "16h12", 1, "CO")),
        reviews = listOf(InboxReviewPrompt("review-1", "ride-session-1", "driver-1", "Avis conducteur", "Notez le trajet.", "DR")),
    )

    override suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?): String {
        submittedRating = SubmittedRating(rideSessionId, ratedUserId, score, comment)
        return "rating-1"
    }

    override suspend fun createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Boolean): String {
        createdReport = CreatedReport(subjectType, subjectId, reason, description, emergency)
        return "report-1"
    }

    override suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole) = Unit
    override fun stopNativeLocationFallback(rideSessionId: String) = Unit
}

data class SubmittedRating(
    val rideSessionId: String,
    val ratedUserId: String,
    val score: Int,
    val comment: String?,
)

data class CreatedReport(
    val subjectType: String,
    val subjectId: String?,
    val reason: String,
    val description: String,
    val emergency: Boolean,
)
