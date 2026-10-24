package be.sportgreenmoove.app.services

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges

internal fun watchRideLifecycle(
    firestore: FirebaseFirestore,
    lease: RideLocationLease,
    onDecision: (RideLifecycleDecision) -> Unit,
): ListenerRegistration = firestore.collection("rideSessions").document(lease.rideSessionId)
    .addSnapshotListener(MetadataChanges.INCLUDE) { snapshot, error ->
        if (error != null) {
            onDecision(RideLifecycleDecision.STOP)
        } else if (snapshot != null) {
            val data = snapshot.data
            onDecision(rideLifecycleDecision(lease, snapshot.metadata.isFromCache, snapshot.exists(),
                data?.get("status") as? String, data?.get("driverUserId") as? String, data?.get("childUserIds") as? List<*>))
        }
    }
