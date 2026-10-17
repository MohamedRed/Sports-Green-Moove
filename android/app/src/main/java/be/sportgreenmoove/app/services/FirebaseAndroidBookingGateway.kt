package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.domain.BookingReviewRequiredException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidBookingGateway(context: Context, functions: FirebaseFunctions, auth: FirebaseAuth) {
    private val coordinator = BookingRequestCoordinator(
        PendingBookingOperations(SharedPreferencesBookingOperations(context)),
        object : BookingRequestTransport {
            override suspend fun call(name: String, payload: Map<String, Any>): Map<*, *> {
                val result = try { functions.getHttpsCallable(name).call(payload).await() }
                catch (failure: FirebaseFunctionsException) {
                    if (failure.code == FirebaseFunctionsException.Code.ABORTED) throw BookingReviewRequiredException(failure)
                    throw failure
                }
                return result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse réservation invalide.")
            }
        },
        { auth.currentUser?.uid },
    )
    suspend fun requestBooking(trip: TripSummary, childId: String?, seats: Int): String {
        bookingRequestPayload(trip, childId, seats)
        return coordinator.request(PendingBookingIntent(trip.id, childId, seats, checkNotNull(trip.bookingIntent)))
    }
}
