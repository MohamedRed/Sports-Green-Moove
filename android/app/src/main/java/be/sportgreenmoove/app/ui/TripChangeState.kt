package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripChangeGateway
import be.sportgreenmoove.app.services.TripChangeDraftStorage
import be.sportgreenmoove.app.services.TripChangeQuoteExpiredException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.time.Instant

@MainThread
internal class TripChangeState(
    private val tripId: String, private val uid: String, private val role: AppRole, private val gateway: TripChangeGateway,
    storage: TripChangeDraftStorage,
    private val now: () -> Instant = Instant::now,
) {
    private val drafts = TripChangeDraftSession(uid, tripId, storage)
    var preview by mutableStateOf<TripChangePreview?>(null); private set
    var review by mutableStateOf<TripChangeReview?>(null); private set
    var draft by mutableStateOf<TripChangeDraft?>(null); private set
    var quote by mutableStateOf<TripChangeRouteQuote?>(null); private set
    var application by mutableStateOf<TripChangeApplicationReceipt?>(null); private set
    var busy by mutableStateOf(false); private set
    var requiresReload by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var draftSaveError by mutableStateOf<String?>(null); private set
    var draftConflict by mutableStateOf(false); private set
    private var proposalRequest: TripChangeProposalRequest? = null
    private var decisionRequest: TripChangeDecisionRequest? = null
    private var withdrawalRequest: TripChangeWithdrawalRequest? = null
    private var quoteRequest: TripChangeQuoteRequest? = null
    private var applyRequest: TripChangeApplyRequest? = null
    private var generation = 0L
    private var closed = false
    val applied get() = application != null || review?.applied == true
    val canEdit get() = !closed && !busy && !requiresReload && !draftConflict && role == AppRole.Driver && preview != null && review == null
    val canPropose get() = canEdit && draftSaveError == null && draft?.changedFrom(requireNotNull(preview).terms, now()) == true &&
        draft?.origin?.busy == false && draft?.destination?.busy == false
    val canRespond get() = !closed && !busy && !requiresReload && role == AppRole.Parent && review?.canRespond == true
    val canWithdraw get() = !closed && !busy && !requiresReload && role == AppRole.Driver && review?.canWithdraw == true && !applied
    val canQuote get() = !closed && !busy && !requiresReload && role == AppRole.Driver && review?.status == TripChangeStatus.Confirmed && !applied
    val canApply get() = canQuote && quote?.let { Instant.parse(it.expiresAt).isAfter(now()) } == true
    private fun current(ticket: Long) = !closed && generation == ticket

    suspend fun reload(proposalId: String?, onChanged: suspend () -> Unit = {}) {
        if (closed || busy) return
        perform("Impossible de vérifier la modification. Actualisez avant de continuer.") {
            val id = proposalId ?: review?.proposalId
            if (id != null) {
                val loaded = gateway.reviewTripChange(tripId, id)
                if (!active()) return@perform
                acceptReview(loaded)
                if (loaded.applied) onChanged()
            } else {
                check(role == AppRole.Driver)
                drafts.load()
                if (proposalRequest == null) proposalRequest = drafts.pendingProposal
                proposalRequest?.let { request ->
                    val recorded = gateway.resolveTripChangeProposal(request)
                    if (!active()) return@perform
                    if (recorded != null) {
                        check(recorded.proposalRequestId == request.requestId && recorded.sourceRevision == request.expectedRevision && recorded.terms == request.terms)
                        acceptReview(recorded)
                        if (recorded.applied) onChanged()
                        return@perform
                    }
                }
                val loaded = gateway.previewTripChange(tripId)
                if (!active()) return@perform
                check(loaded.tripId == tripId)
                if (preview?.revision != loaded.revision) {
                    draft?.origin?.close(); draft?.destination?.close()
                    draft = drafts.open(loaded, ::saveDraft)
                    draftConflict = drafts.conflicts(loaded)
                    if (draftConflict && proposalRequest != null) {
                        drafts.clearUnrecordedRequest(); proposalRequest = null
                    }
                }
                preview = loaded
            }
        }
    }

    suspend fun propose(onChanged: suspend () -> Unit) {
        if (!canPropose) return
        val loaded = requireNotNull(preview)
        val terms = requireNotNull(draft?.terms(now()))
        val request = proposalRequest?.takeIf { it.expectedRevision == loaded.revision && it.terms == terms }
            ?: TripChangeProposalRequest(tripId, loaded.revision, terms).also { proposalRequest = it }
        perform("Proposition non confirmée. Actualisez avant de réessayer.", onChanged) {
            drafts.save(loaded, requireNotNull(draft).snapshot(), request)
            val result = gateway.proposeTripChange(request)
            if (!active()) return@perform
            check(result.sourceRevision == request.expectedRevision && result.terms == request.terms && result.proposalRequestId == request.requestId)
            acceptReview(result)
            onChanged()
        }
    }

    suspend fun decide(decision: TripChangeDecision, onChanged: suspend () -> Unit) {
        if (!canRespond) return
        val loaded = requireNotNull(review)
        val request = decisionRequest?.takeIf { it.proposalId == loaded.proposalId && it.proposalRevision == loaded.revision && it.decision == decision }
            ?: TripChangeDecisionRequest(tripId, loaded.proposalId, loaded.revision, decision).also { decisionRequest = it }
        perform("Décision non confirmée. Actualisez avant de réessayer.", onChanged) {
            val result = gateway.respondTripChange(request)
            if (!active()) return@perform
            check(result.proposalId == loaded.proposalId && result.revision == loaded.revision && result.decision == decision && result.decisionRequestId == request.requestId)
            acceptReview(result)
            onChanged()
        }
    }

    suspend fun withdraw(onChanged: suspend () -> Unit) {
        if (!canWithdraw) return
        val loaded = requireNotNull(review)
        val request = withdrawalRequest?.takeIf { it.proposalId == loaded.proposalId }
            ?: TripChangeWithdrawalRequest(tripId, loaded.proposalId).also { withdrawalRequest = it }
        perform("Retrait non confirmé. Actualisez avant de réessayer.", onChanged) {
            val result = gateway.withdrawTripChange(request)
            if (!active()) return@perform
            check(result.status == TripChangeStatus.Withdrawn && result.proposalId == loaded.proposalId && result.withdrawalRequestId == request.requestId)
            acceptReview(result)
            onChanged()
        }
    }

    suspend fun calculateRoute() {
        if (!canQuote) return
        quote?.takeIf { !Instant.parse(it.expiresAt).isAfter(now()) }?.let {
            quote = null; quoteRequest = null; applyRequest = null
        }
        val loaded = requireNotNull(review)
        val request = quoteRequest?.takeIf { it.proposalId == loaded.proposalId && it.proposalRevision == loaded.revision }
            ?: TripChangeQuoteRequest(tripId, loaded.proposalId, loaded.revision).also { quoteRequest = it }
        perform("Itinéraire non confirmé. Actualisez avant de réessayer.") {
            val result = try { gateway.quoteTripChange(request) }
            catch (expired: TripChangeQuoteExpiredException) {
                if (active()) { quote = null; quoteRequest = null; applyRequest = null }
                throw expired
            }
            if (!active()) return@perform
            check(Instant.parse(result.expiresAt).isAfter(now()))
            quote = result
        }
    }

    suspend fun apply(onChanged: suspend () -> Unit) {
        if (!canApply) return
        val loaded = requireNotNull(review)
        val route = requireNotNull(quote)
        val request = applyRequest?.takeIf { it.proposalId == loaded.proposalId && it.proposalRevision == loaded.revision && it.quoteId == route.quoteId }
            ?: TripChangeApplyRequest(tripId, loaded.proposalId, loaded.revision, route.quoteId).also { applyRequest = it }
        perform("Application non confirmée. Actualisez avant de réessayer.", onChanged) {
            val receipt = gateway.applyTripChange(request)
            if (!active()) return@perform
            check(receipt.tripId == tripId && receipt.proposalId == request.proposalId && receipt.proposalRevision == request.proposalRevision &&
                receipt.quoteId == request.quoteId && receipt.requestId == request.requestId && receipt.actorUserId == uid)
            application = receipt
            onChanged()
            if (!active()) return@perform
            acceptReview(gateway.reviewTripChange(tripId, loaded.proposalId))
        }
    }

    fun expireQuote(quoteId: String) {
        if (closed || busy || quote?.quoteId != quoteId || Instant.parse(requireNotNull(quote).expiresAt).isAfter(now())) return
        quote = null; quoteRequest = null; applyRequest = null
        error = "L’estimation a expiré. Calculez un nouvel itinéraire."
    }

    private suspend fun perform(message: String, recoverList: suspend () -> Unit = {}, action: suspend () -> Unit) {
        val ticket = ++generation
        busy = true; error = null
        try {
            action()
            currentCoroutineContext().ensureActive()
            if (current(ticket)) requiresReload = false
        } catch (cancelled: CancellationException) {
            if (current(ticket)) requiresReload = true
            throw cancelled
        } catch (failure: Exception) {
            if (current(ticket)) {
                requiresReload = true
                error = if (applied) "Détails appliqués. Actualisez pour revoir les réservations."
                    else if (failure is TripChangeQuoteExpiredException) failure.message else message
                try { recoverList() } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { }
            }
        } finally { if (current(ticket)) busy = false }
    }

    private suspend fun acceptReview(result: TripChangeReview) {
        currentCoroutineContext().ensureActive()
        if (closed) return
        check(result.tripId == tripId && (review == null || review?.proposalId == result.proposalId))
        if (role == AppRole.Driver) drafts.accepted(result)
        if (review?.revision != result.revision || result.status != TripChangeStatus.Confirmed) { quote = null; quoteRequest = null }
        review = result; preview = null
        draft?.origin?.close(); draft?.destination?.close(); draft = null
    }

    fun saveDraft() {
        if (closed || draftConflict || role != AppRole.Driver) return
        val loaded = preview ?: return
        val input = draft?.snapshot() ?: return
        val request = proposalRequest?.takeIf { it.terms == draft?.terms(now()) }
        try { drafts.save(loaded, input, request); proposalRequest = request; draftSaveError = null }
        catch (_: Exception) { draftSaveError = "Brouillon non enregistré. Réessayez avant de fermer." }
    }

    fun discardDraft() {
        if (closed || busy || requiresReload || role != AppRole.Driver) return
        val loaded = preview ?: return
        try {
            val next = drafts.discard(loaded, ::saveDraft)
            draft?.origin?.close(); draft?.destination?.close()
            draft = next; draftConflict = false; draftSaveError = null; proposalRequest = null
        } catch (_: Exception) { draftSaveError = "Impossible de remplacer le brouillon. Réessayez." }
    }

    private suspend fun active(): Boolean {
        currentCoroutineContext().ensureActive()
        return !closed
    }

    fun close() {
        closed = true; generation++
        draft?.origin?.close(); draft?.destination?.close()
        draft = null; preview = null; review = null; quote = null; application = null; error = null
        draftSaveError = null; draftConflict = false
        proposalRequest = null; decisionRequest = null; withdrawalRequest = null; quoteRequest = null; applyRequest = null
        busy = false; requiresReload = false
    }
}
