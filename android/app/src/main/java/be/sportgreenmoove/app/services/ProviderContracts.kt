package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.PaymentSheetConfig
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.RideCompletionSummary
import be.sportgreenmoove.app.data.RewardSummary
import be.sportgreenmoove.app.data.StripeConnectAccount
import be.sportgreenmoove.app.data.StripeConnectAccountLink
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripPublishDraft
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.data.emptyImpactSummary
import be.sportgreenmoove.app.data.emptyRewardSummary

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
    suspend fun listClubSummaries(): List<ClubSummary>
    suspend fun suggestPlaces(input: String): List<PlaceSuggestion>
    suspend fun resolvePlace(placeId: String): ResolvedPlace
    suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary>
    suspend fun createTrip(draft: TripPublishDraft): String
    suspend fun requestBooking(tripId: String, childId: String? = null): String
    suspend fun getDriverBookingRequests(): List<BookingRequestSummary>
    suspend fun approveBooking(bookingId: String): String
    suspend fun startRide(tripId: String, bookingIds: List<String>): LiveRideSnapshot
    suspend fun getActiveRide(): LiveRideSnapshot?
    suspend fun markPickup(rideSessionId: String, bookingId: String, childId: String): String
    suspend fun markDropoff(rideSessionId: String, bookingId: String, childId: String): String
    suspend fun endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int): RideCompletionSummary
    suspend fun getPayableBookings(): List<PayableBookingSummary>
    suspend fun getImpactSummary(): ImpactSummary
    suspend fun getRewardSummary(): RewardSummary
    suspend fun getInbox(): InboxSummary
    suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String? = null): String
    suspend fun createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Boolean): String
    suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole)
    fun stopNativeLocationFallback(rideSessionId: String)
}

interface RadarTrackingGateway {
    val isConfigured: Boolean
    suspend fun startTripTracking(rideSessionId: String, role: AppRole)
    suspend fun stopTripTracking(rideSessionId: String)
}

interface StripePaymentsGateway {
    val isConfigured: Boolean
    suspend fun createStripeAccount(email: String): StripeConnectAccount
    suspend fun createStripeAccountLink(returnUrl: String, refreshUrl: String): StripeConnectAccountLink
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

    override suspend fun listClubSummaries(): List<ClubSummary> = emptyList()

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

    override suspend fun createTrip(draft: TripPublishDraft): String {
        check(draft.seatsAvailable <= draft.seatsTotal)
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

    override suspend fun getImpactSummary(): ImpactSummary = emptyImpactSummary()

    override suspend fun getRewardSummary(): RewardSummary = emptyRewardSummary()

    override suspend fun getInbox(): InboxSummary {
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?): String {
        check(rideSessionId.isNotBlank() && ratedUserId.isNotBlank() && score in 1..5)
        check(comment == null || comment.length <= 500)
        throw ProviderConfigurationException("Cloud Functions Android n'est pas configuré.")
    }

    override suspend fun createReport(
        subjectType: String,
        subjectId: String?,
        reason: String,
        description: String,
        emergency: Boolean,
    ): String {
        check(subjectType.isNotBlank() && reason.length >= 2 && description.length >= 5)
        check(subjectId == null || subjectId.isNotBlank())
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

class UnconfiguredStripePaymentsGateway : StripePaymentsGateway {
    override val isConfigured: Boolean = false

    override suspend fun createStripeAccount(email: String): StripeConnectAccount {
        check(email.isNotBlank())
        throw ProviderConfigurationException("Stripe Android n'est pas configuré.")
    }

    override suspend fun createStripeAccountLink(returnUrl: String, refreshUrl: String): StripeConnectAccountLink {
        check(returnUrl.isNotBlank() && refreshUrl.isNotBlank())
        throw ProviderConfigurationException("Stripe Android n'est pas configuré.")
    }

    override suspend fun prepareRidePayment(bookingId: String): PaymentSheetConfig =
        throw ProviderConfigurationException("Stripe Android n'est pas configuré.")
}
