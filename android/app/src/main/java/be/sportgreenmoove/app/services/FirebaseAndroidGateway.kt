package be.sportgreenmoove.app.services

import android.content.Context
import android.os.Build
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.FirebaseApp
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

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

    override suspend fun requestBooking(tripId: String): String {
        val result = functions
            .getHttpsCallable("requestBooking")
            .call(mapOf("tripId" to tripId, "seats" to 1))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse booking invalide.")
        return payload["bookingId"] as? String ?: throw ProviderConfigurationException("Booking manquant.")
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

    override suspend fun startRide(tripId: String): LiveRideSnapshot {
        val result = functions
            .getHttpsCallable("startRide")
            .call(mapOf("tripId" to tripId, "bookingIds" to emptyList<String>()))
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
}

private fun mapTrip(id: String, data: Map<String, Any>): TripSummary {
    val departure = dateValue(data["departureAt"])
    val seats = (data["seatsAvailable"] as? Number)?.toInt() ?: 0
    val dateLabel = departure?.let(::formatDateLabel) ?: "DATE À CONFIRMER"
    val timeLabel = departure?.let(::formatTimeLabel) ?: "--h--"
    val distanceKm = (data["distanceKm"] as? Number)?.toDouble()

    return TripSummary(
        id = id,
        title = data["title"] as? String ?: "${data["category"] as? String ?: "Trajet"} sportif",
        club = data["clubName"] as? String ?: data["clubId"] as? String ?: "Club",
        category = data["category"] as? String ?: "",
        sport = data["sport"] as? String ?: "Football",
        departureLabel = "${dateLabel.replace(Regex("^[A-ZÀ-ÿ]{3}\\s"), "")} · $timeLabel",
        dateLabel = dateLabel,
        timeLabel = timeLabel,
        distanceLabel = distanceKm?.let { "%.1f km".format(Locale.US, it) } ?: "Distance à confirmer",
        seatsAvailable = seats,
        priceLabel = priceLabel((data["priceCents"] as? Number)?.toInt() ?: 0),
        passengerInitials = (data["passengerInitials"] as? List<*>)?.filterIsInstance<String>().orEmpty(),
        reasons = listOf(
            if (seats > 1) "$seats places" else "$seats place",
            "Suivi véhicule disponible",
        ),
        status = if (departure != null && departure.before(Date())) TripStatus.Past else TripStatus.Upcoming,
    )
}

private fun mapRide(data: Map<*, *>): LiveRideSnapshot =
    LiveRideSnapshot(
        rideSessionId = data["rideSessionId"] as? String ?: "",
        status = data["status"] as? String ?: "Actif",
        vehicleLastUpdateLabel = data["vehicleLastUpdateLabel"] as? String ?: "En attente du premier point GPS",
        childLastUpdateLabel = data["childLastUpdateLabel"] as? String,
        etaLabel = data["etaLabel"] as? String ?: "ETA à calculer",
        stale = data["stale"] as? Boolean ?: true,
    )

private fun dateValue(value: Any?): Date? =
    when (value) {
        is Timestamp -> value.toDate()
        is Date -> value
        is String -> runCatching { Date.from(Instant.parse(value)) }.getOrNull()
        else -> null
    }

private fun formatDateLabel(date: Date): String =
    SimpleDateFormat("EEE dd MMM", BelgianFrenchLocale)
        .format(date)
        .replace(".", "")
        .uppercase(BelgianFrenchLocale)

private fun formatTimeLabel(date: Date): String =
    SimpleDateFormat("HH'h'mm", BelgianFrenchLocale).format(date)

private fun priceLabel(cents: Int): String =
    if (cents == 0) {
        "Gratuit"
    } else {
        "%.2f EUR".format(BelgianFrenchLocale, cents.toDouble() / 100.0)
    }

private val BelgianFrenchLocale: Locale = Locale.Builder()
    .setLanguage("fr")
    .setRegion("BE")
    .build()
