package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary

interface AuthGateway {
    val isConfigured: Boolean
    suspend fun currentSession(): AuthSession?
    suspend fun signIn(email: String, password: String): AuthSession
    suspend fun signUp(name: String, email: String, password: String): AuthSession
    fun signOut()
}

interface FirebaseGateway {
    val isConfigured: Boolean
    suspend fun searchTrips(): List<TripSummary>
    suspend fun requestBooking(tripId: String): String
    suspend fun startRide(tripId: String): LiveRideSnapshot
    suspend fun getActiveRide(): LiveRideSnapshot?
    suspend fun writeNativeLocationFallback(rideSessionId: String)
}

interface RadarTrackingGateway {
    val isConfigured: Boolean
    suspend fun startTripTracking(rideSessionId: String, role: AppRole)
    suspend fun stopTripTracking(rideSessionId: String)
}

interface GoogleRoutesGateway {
    val isConfigured: Boolean
    suspend fun explainRoute(tripId: String): List<String>
}

interface StripePaymentsGateway {
    val isConfigured: Boolean
    suspend fun prepareRidePayment(amountCents: Int): String
}

class ProviderConfigurationException(message: String) : IllegalStateException(message)

class UnconfiguredAuthGateway : AuthGateway {
    override val isConfigured: Boolean = false

    override suspend fun currentSession(): AuthSession? = null

    override suspend fun signIn(email: String, password: String): AuthSession {
        throw ProviderConfigurationException("Firebase Android n'est pas configuré.")
    }

    override suspend fun signUp(name: String, email: String, password: String): AuthSession {
        throw ProviderConfigurationException("Firebase Android n'est pas configuré.")
    }

    override fun signOut() = Unit
}

class UnconfiguredFirebaseGateway : FirebaseGateway {
    override val isConfigured: Boolean = false

    override suspend fun searchTrips(): List<TripSummary> {
        throw ProviderConfigurationException("Firestore Android n'est pas configuré.")
    }

    override suspend fun requestBooking(tripId: String): String {
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun startRide(tripId: String): LiveRideSnapshot {
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun getActiveRide(): LiveRideSnapshot? = null

    override suspend fun writeNativeLocationFallback(rideSessionId: String) {
        throw ProviderConfigurationException("Realtime Database Android n'est pas configuré.")
    }
}

class UnconfiguredRadarTrackingGateway : RadarTrackingGateway {
    override val isConfigured: Boolean = false

    override suspend fun startTripTracking(rideSessionId: String, role: AppRole) {
        throw ProviderConfigurationException("Radar Android n'est pas configuré.")
    }

    override suspend fun stopTripTracking(rideSessionId: String) {
        check(rideSessionId.isNotBlank())
    }
}

class UnconfiguredGoogleRoutesGateway : GoogleRoutesGateway {
    override val isConfigured: Boolean = false

    override suspend fun explainRoute(tripId: String): List<String> =
        throw ProviderConfigurationException("Google Routes Android n'est pas configuré.")
}

class UnconfiguredStripePaymentsGateway : StripePaymentsGateway {
    override val isConfigured: Boolean = false

    override suspend fun prepareRidePayment(amountCents: Int): String =
        throw ProviderConfigurationException("Stripe Android n'est pas configuré.")
}
