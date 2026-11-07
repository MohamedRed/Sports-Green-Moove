package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.RewardSummary
import be.sportgreenmoove.app.data.emptyImpactSummary
import be.sportgreenmoove.app.data.emptyRewardSummary
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidLedgerGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private suspend fun read(name: String, uid: String): Any? {
        if (auth.currentUser?.uid != uid) throw CancellationException("Ledger account changed")
        val result = functions.getHttpsCallable(name).call(emptyMap<String, Any>()).await()
        if (auth.currentUser?.uid != uid) throw CancellationException("Ledger account changed")
        return result.data
    }
    suspend fun getImpactSummary(): ImpactSummary {
        val uid = auth.currentUser?.uid ?: return emptyImpactSummary()
        return parseImpactSummary(read("getImpactSummary", uid), uid)
    }
    suspend fun getRewardSummary(): RewardSummary {
        val uid = auth.currentUser?.uid ?: return emptyRewardSummary()
        return parseRewardSummary(read("getRewardSummary", uid), uid)
    }
}
