package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary

interface FirebaseGateway {
    suspend fun searchTrips(): List<TripSummary>
    suspend fun startRide(tripId: String): LiveRideSnapshot
    suspend fun writeNativeLocationFallback(rideSessionId: String)
}

interface RadarTrackingGateway {
    suspend fun startTripTracking(rideSessionId: String, role: AppRole)
    suspend fun stopTripTracking(rideSessionId: String)
}

interface GoogleRoutesGateway {
    suspend fun explainRoute(tripId: String): List<String>
}

interface StripePaymentsGateway {
    suspend fun prepareRidePayment(amountCents: Int): String
}

class MockFirebaseGateway : FirebaseGateway {
    override suspend fun searchTrips(): List<TripSummary> =
        listOf(
            TripSummary(
                id = "trip-u8-royal",
                title = "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
                club = "Royal Ottignies",
                category = "U8",
                departureLabel = "07 NOV · 16h45",
                seatsAvailable = 2,
                priceLabel = "2,50 EUR",
                reasons = listOf("+6 min détour", "2 places disponibles", "Même équipe U8", "Suivi enfant disponible"),
            ),
            TripSummary(
                id = "trip-biereau",
                title = "ENTRAÎNEMENT U8 GROUPE B",
                club = "Collège du Biéreau",
                category = "U8",
                departureLabel = "10 NOV · 18h00",
                seatsAvailable = 1,
                priceLabel = "Gratuit",
                reasons = listOf("+9 min détour", "Même club", "Trajet gratuit"),
            ),
        )

    override suspend fun startRide(tripId: String): LiveRideSnapshot =
        LiveRideSnapshot(
            rideSessionId = "ride-$tripId",
            status = "Actif",
            vehicleLastUpdateLabel = "Il y a 12 s",
            childLastUpdateLabel = "Il y a 35 s",
            etaLabel = "Arrivée estimée 16h38",
            stale = false,
        )

    override suspend fun writeNativeLocationFallback(rideSessionId: String) {
        check(rideSessionId.isNotBlank())
    }
}

class MockRadarTrackingGateway : RadarTrackingGateway {
    override suspend fun startTripTracking(rideSessionId: String, role: AppRole) {
        check(rideSessionId.isNotBlank())
        check(role.name.isNotBlank())
    }

    override suspend fun stopTripTracking(rideSessionId: String) {
        check(rideSessionId.isNotBlank())
    }
}

class MockGoogleRoutesGateway : GoogleRoutesGateway {
    override suspend fun explainRoute(tripId: String): List<String> =
        listOf("Détour estimé: 6 min", "Distance supplémentaire: 800 m")
}

class MockStripePaymentsGateway : StripePaymentsGateway {
    override suspend fun prepareRidePayment(amountCents: Int): String =
        "payment-intent-client-secret-$amountCents"
}
