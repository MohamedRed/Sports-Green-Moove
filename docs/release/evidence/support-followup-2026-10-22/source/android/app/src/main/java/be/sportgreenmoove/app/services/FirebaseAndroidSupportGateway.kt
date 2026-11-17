package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidSupportGateway(private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()) : SupportGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Account changed during support read")
    }
    private suspend fun call(uid: String, name: String, input: Map<String, Any>): Any? {
        requireSession(uid); val result = functions.getHttpsCallable(name).call(input).await(); requireSession(uid); return result.data
    }
    private fun cursor(value: String?) = value?.let { mapOf("cursor" to requireNotNull(MembershipPageToken.decode(it))) } ?: emptyMap()
    override suspend fun supportReports(uid: String, cursor: String?): SupportPage<SupportReport> =
        SupportWire.reports(call(uid, "listMySupportReports", cursor(cursor)))
    override suspend fun supportReport(uid: String, reportId: String, cursor: String?): SupportDetail =
        SupportWire.detail(call(uid, "getMySupportReport", mapOf("reportId" to TripChangeWire.id(reportId)) + cursor(cursor)), reportId)
}
