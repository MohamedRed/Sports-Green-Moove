package be.sportgreenmoove.app.services

import android.content.Context
import android.os.Build
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.RideCompletionSummary
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

data class AndroidProviderSet(
    val auth: AuthGateway,
    val firebase: FirebaseGateway,
    val radar: RadarTrackingGateway = UnconfiguredRadarTrackingGateway(),
    val googleRoutes: GoogleRoutesGateway = UnconfiguredGoogleRoutesGateway(),
    val stripe: StripePaymentsGateway = UnconfiguredStripePaymentsGateway(),
) {
    val isConfigured: Boolean = auth.isConfigured && firebase.isConfigured
}

object AndroidRuntime {
    fun create(context: Context): AndroidProviderSet {
        val app = FirebaseApp.initializeApp(context) ?: FirebaseApp.getApps(context).firstOrNull()
        return if (app == null) {
            AndroidProviderSet(auth = UnconfiguredAuthGateway(), firebase = UnconfiguredFirebaseGateway())
        } else {
            AndroidProviderSet(
                auth = FirebaseAndroidAuthGateway(),
                firebase = FirebaseAndroidBackendGateway(context.applicationContext),
                radar = FirebaseAndroidRadarTrackingGateway(
                    context = context.applicationContext,
                    publishableKey = context.getString(R.string.sgm_radar_publishable_key),
                ),
                stripe = FirebaseAndroidStripePaymentsGateway(),
            )
        }
    }
}

private class FirebaseAndroidAuthGateway : AuthGateway {
    private val auth = FirebaseAuth.getInstance()
    override val isConfigured: Boolean = true

    override suspend fun currentSession(): AuthSession? =
        auth.currentUser?.let { AuthSession(uid = it.uid, email = it.email) }

    override suspend fun signIn(email: String, password: String): AuthSession {
        val result = auth.signInWithEmailAndPassword(email, password).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Firebase Auth invalide.")
        return AuthSession(uid = user.uid, email = user.email)
    }

    override suspend fun signUp(name: String, email: String, password: String): AuthSession {
        val result = auth.createUserWithEmailAndPassword(email, password).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Firebase Auth invalide.")
        return AuthSession(uid = user.uid, email = user.email)
    }

    override fun signOut() {
        auth.signOut()
    }
}

private class FirebaseAndroidBackendGateway(context: Context) : FirebaseGateway {
    private val appContext = context.applicationContext
    private val firestore = FirebaseFirestore.getInstance()
    private val functions = FirebaseFunctions.getInstance()
    private val locationClient = LocationServices.getFusedLocationProviderClient(appContext)
    override val isConfigured: Boolean = true

    override suspend fun searchTrips(): List<TripSummary> {
        val snapshot = firestore.collection("trips")
            .whereEqualTo("status", "published")
            .orderBy("departureAt")
            .limit(30)
            .get()
            .await()

        return snapshot.documents.map { document ->
            mapTrip(id = document.id, data = document.data.orEmpty())
        }
    }

    override suspend fun listChildren(): List<ChildSummary> {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return emptyList()
        val snapshot = firestore.collection("children")
            .whereArrayContains("guardianUserIds", uid)
            .limit(20)
            .get()
            .await()

        return snapshot.documents.map { document ->
            mapChild(id = document.id, data = document.data.orEmpty())
        }
    }

    override suspend fun suggestPlaces(input: String): List<PlaceSuggestion> {
        val result = functions
            .getHttpsCallable("suggestPlaces")
            .call(mapOf("input" to input))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse Places invalide.")
        return (payload["suggestions"] as? List<*>)
            ?.mapNotNull { it as? Map<*, *> }
            ?.mapNotNull(::mapPlaceSuggestion)
            .orEmpty()
    }

    override suspend fun resolvePlace(placeId: String): ResolvedPlace {
        val result = functions
            .getHttpsCallable("resolvePlace")
            .call(mapOf("placeId" to placeId))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse Place Details invalide.")
        val place = payload["place"] as? Map<*, *> ?: throw ProviderConfigurationException("Place manquante.")
        return mapResolvedPlace(place)
    }

    override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary> {
        val result = functions
            .getHttpsCallable("searchTrips")
            .call(criteria.toCallablePayload())
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse matching invalide.")
        return (payload["matches"] as? List<*>)
            ?.mapNotNull { it as? Map<*, *> }
            ?.mapNotNull(::mapTripMatch)
            .orEmpty()
    }

    override suspend fun requestBooking(tripId: String, childId: String?): String {
        val requestPayload = mutableMapOf<String, Any>("tripId" to tripId, "seats" to 1)
        childId?.takeIf(String::isNotBlank)?.let { requestPayload["childId"] = it }
        val result = functions
            .getHttpsCallable("requestBooking")
            .call(requestPayload)
            .await()
        val responsePayload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse booking invalide.")
        return responsePayload["bookingId"] as? String ?: throw ProviderConfigurationException("Booking manquant.")
    }

    override suspend fun getDriverBookingRequests(): List<BookingRequestSummary> {
        val result = functions
            .getHttpsCallable("listDriverBookingRequests")
            .call(emptyMap<String, Any>())
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse demandes invalide.")
        return (payload["bookings"] as? List<*>)
            ?.mapNotNull { it as? Map<*, *> }
            ?.mapNotNull(::mapBookingRequest)
            .orEmpty()
    }

    override suspend fun approveBooking(bookingId: String): String {
        val result = functions
            .getHttpsCallable("approveBooking")
            .call(mapOf("bookingId" to bookingId))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse approbation invalide.")
        return payload["status"] as? String ?: throw ProviderConfigurationException("Statut approbation manquant.")
    }

    override suspend fun startRide(tripId: String, bookingIds: List<String>): LiveRideSnapshot {
        val result = functions
            .getHttpsCallable("startRide")
            .call(mapOf("tripId" to tripId, "bookingIds" to bookingIds))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse ride invalide.")
        val ride = payload["ride"] as? Map<*, *> ?: throw ProviderConfigurationException("Ride manquante.")
        return mapRide(ride)
    }

    override suspend fun getActiveRide(): LiveRideSnapshot? {
        val result = functions.getHttpsCallable("getActiveRide").call(emptyMap<String, Any>()).await()
        val payload = result.data as? Map<*, *> ?: return null
        val ride = payload["ride"] as? Map<*, *> ?: return null
        return mapRide(ride)
    }

    override suspend fun markPickup(rideSessionId: String, bookingId: String, childId: String): String =
        markPassengerStatus("markPickup", rideSessionId, bookingId, childId)

    override suspend fun markDropoff(rideSessionId: String, bookingId: String, childId: String): String =
        markPassengerStatus("markDropoff", rideSessionId, bookingId, childId)

    private suspend fun markPassengerStatus(
        callable: String,
        rideSessionId: String,
        bookingId: String,
        childId: String,
    ): String {
        val result = functions
            .getHttpsCallable(callable)
            .call(mapOf("rideSessionId" to rideSessionId, "bookingId" to bookingId, "childId" to childId))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse statut passager invalide.")
        return payload["status"] as? String ?: throw ProviderConfigurationException("Statut passager manquant.")
    }

    override suspend fun endRide(
        rideSessionId: String,
        distanceMeters: Int,
        passengersSharing: Int,
    ): RideCompletionSummary {
        val result = functions
            .getHttpsCallable("endRide")
            .call(
                mapOf(
                    "rideSessionId" to rideSessionId,
                    "distanceMeters" to distanceMeters,
                    "passengersSharing" to passengersSharing,
                ),
            )
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse fin de course invalide.")
        return RideCompletionSummary(
            rideSessionId = payload["rideSessionId"] as? String ?: rideSessionId,
            co2SavedKg = (payload["co2SavedKg"] as? Number)?.toDouble() ?: 0.0,
            rewardCents = (payload["rewardCents"] as? Number)?.toInt() ?: 0,
        )
    }

    override suspend fun getPayableBookings(): List<PayableBookingSummary> {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return emptyList()
        val snapshot = firestore.collection("bookings")
            .whereEqualTo("parentUserId", uid)
            .limit(30)
            .get()
            .await()

        return snapshot.documents.mapNotNull { document ->
            val booking = document.data.orEmpty()
            if (booking["status"] != "approved" || booking["paymentStatus"] == "paid") return@mapNotNull null
            val tripId = booking["tripId"] as? String ?: return@mapNotNull null
            val trip = firestore.collection("trips").document(tripId).get().await().data.orEmpty()
            mapPayableBooking(id = document.id, booking = booking, trip = trip)
        }
    }

    override suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole) {
        val location = try {
            locationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
        } catch (error: SecurityException) {
            throw ProviderConfigurationException("Autorisation localisation requise pour le suivi de course.")
        } ?: throw ProviderConfigurationException("Position GPS indisponible pour le suivi de course.")

        val result = functions
            .getHttpsCallable("writeLocationBatch")
            .call(mapOf("updates" to listOf(nativeLocationPayload(rideSessionId, role.locationRole(), location))))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse localisation invalide.")
        val written = (payload["written"] as? Number)?.toInt() ?: 0
        if (written <= 0) throw ProviderConfigurationException("Aucun point GPS écrit.")
        val serviceIntent = ActiveRideLocationService.intent(appContext, rideSessionId, role.locationRole())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            appContext.startForegroundService(serviceIntent)
        } else {
            appContext.startService(serviceIntent)
        }
    }

    override fun stopNativeLocationFallback(rideSessionId: String) {
        appContext.stopService(ActiveRideLocationService.intent(appContext, rideSessionId, AppRole.Driver.locationRole()))
    }
}
