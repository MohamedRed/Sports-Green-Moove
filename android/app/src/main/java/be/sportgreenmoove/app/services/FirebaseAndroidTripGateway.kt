package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripSummary
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidTripGateway(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun listTrips(): List<TripSummary> {
        val uid = auth.currentUser?.uid ?: return emptyList()
        val published = firestore.collection("trips").whereEqualTo("status", "published")
            .orderBy("departureAt").limit(30).get().await().documents
        val completedOwned = firestore.collection("trips").whereEqualTo("driverUserId", uid)
            .whereEqualTo("status", "completed").orderBy("completedAt", Query.Direction.DESCENDING)
            .limit(30).get().await().documents
        val bookings = firestore.collection("bookings").whereEqualTo("parentUserId", uid)
            .whereEqualTo("status", "completed").orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(30).get().await().documents
        val completedBooked = bookings.mapNotNull { it.getString("tripId") }.distinct().map { id ->
            firestore.collection("trips").document(id).get().await()
        }.filter { it.exists() && it.getString("status") == "completed" }
        return (published + completedOwned + completedBooked).distinctBy { it.id }
            .map { mapTrip(it.id, it.data.orEmpty()) }
    }
}
