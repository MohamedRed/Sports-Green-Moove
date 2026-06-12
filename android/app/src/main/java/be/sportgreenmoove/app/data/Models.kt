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

data class LiveRideSnapshot(
    val rideSessionId: String,
    val status: String,
    val vehicleLastUpdateLabel: String,
    val childLastUpdateLabel: String?,
    val etaLabel: String,
    val stale: Boolean,
)

data class PaymentSheetConfig(
    val bookingId: String,
    val paymentIntentId: String,
    val clientSecret: String,
    val publishableKey: String,
    val amountCents: Int,
    val currency: String,
)
