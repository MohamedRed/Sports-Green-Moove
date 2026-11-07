package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripCancellationPreview
import be.sportgreenmoove.app.data.TripCancellationReceipt
import be.sportgreenmoove.app.data.TripCancellationRequest
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidTripCancellationGateway(
    private val functions: FirebaseFunctions,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : TripCancellationGateway {
    private fun uid() = auth.currentUser?.uid ?: throw ProviderConfigurationException("Veuillez vous connecter.")

    override suspend fun previewTripCancellation(tripId: String): TripCancellationPreview {
        require(tripId.isNotBlank() && '/' !in tripId)
        val user = uid()
        val response = functions.getHttpsCallable("getTripCancellation").call(mapOf("tripId" to tripId)).await()
        check(uid() == user) { "La session a changé." }
        return tripCancellationPreview(response.data, tripId)
    }

    override suspend fun cancelTrip(request: TripCancellationRequest): TripCancellationReceipt {
        val user = uid()
        val response = functions.getHttpsCallable("cancelTrip").call(request.callablePayload()).await()
        check(uid() == user) { "La session a changé." }
        return tripCancellationReceipt(response.data, request, user)
    }
}
