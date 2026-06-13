package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.PaymentSheetConfig
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.RideCompletionSummary
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
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
    suspend fun listChildren(): List<ChildSummary>
    suspend fun suggestPlaces(input: String): List<PlaceSuggestion>
    suspend fun resolvePlace(placeId: String): ResolvedPlace
    suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary>
    suspend fun requestBooking(tripId: String, childId: String? = null): String
    suspend fun getDriverBookingRequests(): List<BookingRequestSummary>
    suspend fun approveBooking(bookingId: String): String
    suspend fun startRide(tripId: String, bookingIds: List<String>): LiveRideSnapshot
    suspend fun getActiveRide(): LiveRideSnapshot?
    suspend fun markPickup(rideSessionId: String, bookingId: String, childId: String): String
    suspend fun markDropoff(rideSessionId: String, bookingId: String, childId: String): String
    suspend fun endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int): RideCompletionSummary
    suspend fun getPayableBookings(): List<PayableBookingSummary>
    suspend fun getInbox(): InboxSummary
    suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String? = null): String
    suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole)
    fun stopNativeLocationFallback(rideSessionId: String)
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
    suspend fun prepareRidePayment(bookingId: String): PaymentSheetConfig
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

    override suspend fun listChildren(): List<ChildSummary> = emptyList()

    override suspend fun suggestPlaces(input: String): List<PlaceSuggestion> {
        check(input.isNotBlank())
        throw ProviderConfigurationException("Google Places Android n'est pas configuré.")
    }

    override suspend fun resolvePlace(placeId: String): ResolvedPlace {
        check(placeId.isNotBlank())
        throw ProviderConfigurationException("Google Places Android n'est pas configuré.")
    }

    override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary> {
        check(criteria.seatsNeeded > 0)
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun requestBooking(tripId: String, childId: String?): String {
        check(childId == null || childId.isNotBlank())
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun getDriverBookingRequests(): List<BookingRequestSummary> = emptyList()

    override suspend fun approveBooking(bookingId: String): String {
        check(bookingId.isNotBlank())
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun startRide(tripId: String, bookingIds: List<String>): LiveRideSnapshot {
        check(bookingIds.isNotEmpty() || tripId.isNotBlank())
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun getActiveRide(): LiveRideSnapshot? = null

    override suspend fun markPickup(rideSessionId: String, bookingId: String, childId: String): String {
        check(rideSessionId.isNotBlank() && bookingId.isNotBlank() && childId.isNotBlank())
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun markDropoff(rideSessionId: String, bookingId: String, childId: String): String {
        check(rideSessionId.isNotBlank() && bookingId.isNotBlank() && childId.isNotBlank())
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun endRide(
        rideSessionId: String,
        distanceMeters: Int,
        passengersSharing: Int,
    ): RideCompletionSummary {
        check(rideSessionId.isNotBlank() && distanceMeters >= 0 && passengersSharing >= 0)
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun getPayableBookings(): List<PayableBookingSummary> = emptyList()

    override suspend fun getInbox(): InboxSummary {
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?): String {
        check(rideSessionId.isNotBlank() && ratedUserId.isNotBlank() && score in 1..5)
        check(comment == null || comment.length <= 500)
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole) {
        check(role.name.isNotBlank())
        throw ProviderConfigurationException("Realtime Database Android n'est pas configuré.")
    }

    override fun stopNativeLocationFallback(rideSessionId: String) {
        check(rideSessionId.isNotBlank())
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

    override suspend fun prepareRidePayment(bookingId: String): PaymentSheetConfig =
        throw ProviderConfigurationException("Stripe Android n'est pas configuré.")
}
