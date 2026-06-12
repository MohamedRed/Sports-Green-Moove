package be.sportgreenmoove.app.data

enum class AppRole {
    Parent,
    Driver,
    Child,
    ClubManager,
    Admin,
}

data class AuthSession(
    val uid: String,
    val email: String?,
)

enum class TripStatus {
    Upcoming,
    Past,
    Pending,
}

enum class AppTab(val label: String) {
    Home("Accueil"),
    GreenList("Green-List"),
    Publish("Publier"),
    Search("Recherche"),
    Notifications("Notifs"),
    Co2("CO2"),
    Rewards("Rewards"),
    Options("Options"),
}

data class TripSummary(
    val id: String,
    val title: String,
    val club: String,
    val category: String,
    val sport: String = "Football",
    val departureLabel: String,
    val dateLabel: String = "MAR 07 NOV",
    val timeLabel: String = "16h45",
    val distanceLabel: String = "5.2 km",
    val seatsAvailable: Int,
    val seatsLabel: String = if (seatsAvailable > 1) "$seatsAvailable places" else "$seatsAvailable place",
    val priceLabel: String,
    val passengerInitials: List<String> = emptyList(),
    val reasons: List<String>,
    val status: TripStatus = TripStatus.Upcoming,
)

data class PlaceSuggestion(
    val placeId: String,
    val label: String,
    val mainText: String?,
    val secondaryText: String?,
)

data class ResolvedPlace(
    val placeId: String,
    val label: String,
    val formattedAddress: String,
    val lat: Double,
    val lng: Double,
)

data class TripSearchCriteria(
    val origin: ResolvedPlace,
    val destination: ResolvedPlace,
    val desiredDepartureAtIso: String,
    val seatsNeeded: Int,
    val baggage: String,
    val returnTrip: Boolean,
    val requireChildTracking: Boolean,
    val guardianConsent: Boolean,
    val childUserId: String? = null,
    val clubId: String? = null,
    val teamId: String? = null,
    val category: String? = null,
)

data class TripMatchSummary(
    val tripId: String,
    val score: Double,
    val summary: TripSummary,
    val reasons: List<String>,
    val detourMinutes: Int?,
    val pickupDistanceMeters: Int?,
)

data class ChildSummary(
    val id: String,
    val label: String,
    val teamLabel: String,
    val trackingEnabled: Boolean,
)

data class BookingRequestSummary(
    val bookingId: String,
    val tripId: String,
    val parentUserId: String,
    val childId: String?,
    val childLabel: String?,
    val seats: Int,
    val note: String?,
    val status: String,
    val title: String,
    val club: String,
    val dateLabel: String,
    val timeLabel: String,
    val priceLabel: String,
)

data class LiveRideSnapshot(
    val rideSessionId: String,
    val status: String,
    val vehicleLastUpdateLabel: String,
    val childLastUpdateLabel: String?,
    val etaLabel: String,
    val stale: Boolean,
    val passengers: List<RidePassengerStatus> = emptyList(),
)

data class RidePassengerStatus(
    val bookingId: String,
    val childId: String,
    val label: String,
    val pickupStatus: String,
    val dropoffStatus: String,
)

data class RideCompletionSummary(
    val rideSessionId: String,
    val co2SavedKg: Double,
    val rewardCents: Int,
)

data class PayableBookingSummary(
    val bookingId: String,
    val tripId: String,
    val title: String,
    val club: String,
    val dateLabel: String,
    val timeLabel: String,
    val seats: Int,
    val amountCents: Int,
    val amountLabel: String,
    val paymentStatus: String,
)

data class PaymentSheetConfig(
    val bookingId: String,
    val paymentIntentId: String,
    val clientSecret: String,
    val publishableKey: String,
    val amountCents: Int,
    val currency: String,
)

data class InboxSummary(
    val notifications: List<InboxNotificationSummary> = emptyList(),
    val chats: List<InboxChatSummary> = emptyList(),
    val reviews: List<InboxReviewPrompt> = emptyList(),
)

data class InboxNotificationSummary(
    val id: String,
    val title: String,
    val body: String,
    val dateLabel: String,
    val unread: Boolean,
    val initials: String,
)

data class InboxChatSummary(
    val id: String,
    val sourceType: String,
    val sourceId: String,
    val title: String,
    val preview: String,
    val dateLabel: String,
    val unreadCount: Int,
    val initials: String,
)

data class InboxReviewPrompt(
    val id: String,
    val rideSessionId: String,
    val ratedUserId: String,
    val title: String,
    val prompt: String,
    val initials: String,
)
