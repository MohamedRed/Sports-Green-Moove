package be.sportgreenmoove.app.data

enum class AppRole {
    Parent,
    Driver,
    Child,
    ClubManager,
    Admin,
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
    val departureLabel: String,
    val seatsAvailable: Int,
    val priceLabel: String,
    val reasons: List<String>,
)

data class LiveRideSnapshot(
    val rideSessionId: String,
    val status: String,
    val vehicleLastUpdateLabel: String,
    val childLastUpdateLabel: String?,
    val etaLabel: String,
    val stale: Boolean,
)
