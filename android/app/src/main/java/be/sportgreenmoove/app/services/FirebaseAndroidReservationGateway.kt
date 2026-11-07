package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationPage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidReservationGateway : ReservationGateway {
    private val functions = FirebaseFunctions.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private fun uid() = auth.currentUser?.uid ?: throw ProviderConfigurationException("Veuillez vous connecter.")
    private fun checkIdentity(expected: String) {
        check(uid() == expected) { "La session a changé." }
    }
    override suspend fun list(role: AppRole, cursor: String?): ReservationPage {
        require(role == AppRole.Parent || role == AppRole.Driver)
        val user = uid()
        val data = mutableMapOf<String, Any>("role" to if (role == AppRole.Driver) "driver" else "parent")
        cursor?.let { data["cursor"] = it }
        val result = functions.getHttpsCallable("listReservations").call(data).await()
        checkIdentity(user)
        return reservationPage(result.data)
    }
    override suspend fun decide(bookingId: String, decision: ReservationDecision) {
        require(bookingId.isNotBlank() && '/' !in bookingId)
        val user = uid()
        val callable = when (decision) {
            ReservationDecision.Approve -> "approveBooking"
            ReservationDecision.Decline -> "declineBooking"
            ReservationDecision.Cancel -> "cancelBooking"
        }
        val result = functions.getHttpsCallable(callable).call(mapOf("bookingId" to bookingId)).await().data as? Map<*, *>
            ?: throw ProviderConfigurationException("Décision non confirmée. Actualisez la liste.")
        checkIdentity(user)
        check(result["bookingId"] == bookingId && result["status"] == decision.status) { "Décision non confirmée. Actualisez la liste." }
    }
}
