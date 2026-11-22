package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidTripChangeGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : TripChangeGateway {
    private fun uid() = auth.currentUser?.uid ?: throw ProviderConfigurationException("Veuillez vous connecter.")
    private suspend fun call(name: String, payload: Map<String, Any?>, user: String): Any? {
        check(uid() == user) { "La session a changé." }
        val response = try { functions.getHttpsCallable(name).call(payload).await() }
        catch (error: FirebaseFunctionsException) {
            check(uid() == user) { "La session a changé." }
            if (error.code == FirebaseFunctionsException.Code.FAILED_PRECONDITION &&
                (error.details as? Map<*, *>)?.get("reason") == "trip-change-quote-expired") throw TripChangeQuoteExpiredException()
            throw error
        }
        check(uid() == user) { "La session a changé." }
        return response.data
    }
    override suspend fun previewTripChange(tripId: String): TripChangePreview =
        tripChangePreview(call("getTripChangePreview", mapOf("tripId" to TripChangeWire.id(tripId)), uid()), tripId)

    override suspend fun tripChangeHistory(tripId: String, cursor: String?): TripChangeHistoryPage =
        tripHistoryPage(call("getTripChangeHistory", mapOf("tripId" to TripChangeWire.id(tripId)) +
            (cursor?.let { mapOf("cursor" to it) } ?: emptyMap()), uid()), tripId)

    override suspend fun reviewTripChange(tripId: String, proposalId: String): TripChangeReview =
        tripChangeReview(call("getTripChangeReview", TripChangeWire.reference(tripId, proposalId), uid()), tripId, proposalId)

    override suspend fun proposeTripChange(request: TripChangeProposalRequest): TripChangeReview {
        val view = tripChangeReview(call("proposeTripChanges", request.callablePayload(), uid()), request.tripId)
        check(view.proposalRequestId == request.requestId && view.sourceRevision == request.expectedRevision && view.terms == request.terms)
        return view
    }

    override suspend fun resolveTripChangeProposal(request: TripChangeProposalRequest): TripChangeReview? =
        tripChangeProposalResolution(call("resolveTripChangeProposal", mapOf("tripId" to TripChangeWire.id(request.tripId),
            "requestId" to TripChangeWire.uuid(request.requestId)), uid()), request)

    override suspend fun respondTripChange(request: TripChangeDecisionRequest): TripChangeReview {
        val view = tripChangeReview(call("respondToTripChanges", request.callablePayload(), uid()), request.tripId, request.proposalId)
        check(view.revision == request.proposalRevision && view.decision == request.decision && view.decisionRequestId == request.requestId)
        return view
    }

    override suspend fun withdrawTripChange(request: TripChangeWithdrawalRequest): TripChangeReview {
        val view = tripChangeReview(call("withdrawTripChanges", request.callablePayload(), uid()), request.tripId, request.proposalId)
        check(view.status == TripChangeStatus.Withdrawn && view.withdrawalRequestId == request.requestId)
        return view
    }

    override suspend fun quoteTripChange(request: TripChangeQuoteRequest): TripChangeRouteQuote {
        val data = TripChangeWire.map(call("getTripChangeApplicationQuote", request.callablePayload(), uid()))
        check(data["tripId"] == request.tripId && data["proposalId"] == request.proposalId &&
            data["proposalRevision"] == request.proposalRevision && data["requestId"] == request.requestId)
        return tripChangeRouteQuote(data)
    }

    override suspend fun applyTripChange(request: TripChangeApplyRequest): TripChangeApplicationReceipt {
        val user = uid()
        return tripChangeApplicationReceipt(call("applyTripChanges", request.callablePayload(), user), request, user)
    }
}
