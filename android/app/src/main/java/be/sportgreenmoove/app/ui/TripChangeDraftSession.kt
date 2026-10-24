package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripChangeDraftStorage

internal class TripChangeDraftSession(private val uid: String, private val tripId: String, private val storage: TripChangeDraftStorage) {
    private var loaded = false
    private var record: TripChangeDraftRecord? = null
    val pendingProposal get() = record?.pendingProposal

    fun load() {
        if (!loaded) { record = storage.read(uid, tripId); loaded = true }
    }

    fun open(preview: TripChangePreview, onChange: () -> Unit): TripChangeDraft {
        check(preview.tripId == tripId)
        val saved = record
        if (saved?.revision == preview.revision) check(saved.original == preview.terms)
        return TripChangeDraft(saved?.original ?: preview.terms, saved?.input, onChange)
    }

    fun conflicts(preview: TripChangePreview) = record?.revision?.let { it != preview.revision } == true

    fun save(preview: TripChangePreview, input: TripChangeDraftInput, request: TripChangeProposalRequest?) {
        check(!conflicts(preview))
        val next = TripChangeDraftRecord(preview.revision, preview.terms, input, request)
        storage.write(uid, tripId, next)
        record = next; loaded = true
    }

    fun discard(preview: TripChangePreview, onChange: () -> Unit): TripChangeDraft {
        check(pendingProposal == null) { "Resolve the pending proposal before discarding its identity" }
        val next = TripChangeDraft(preview.terms, onChange = onChange)
        val reset = TripChangeDraftRecord(preview.revision, preview.terms, next.snapshot(), null)
        storage.write(uid, tripId, reset)
        record = reset; loaded = true
        return next
    }

    fun accepted(review: TripChangeReview) {
        load()
        val request = pendingProposal ?: return
        if (request.requestId != review.proposalRequestId) return
        check(review.tripId == tripId && review.sourceRevision == request.expectedRevision && review.terms == request.terms)
        storage.write(uid, tripId, null)
        record = null
    }

    fun clearUnrecordedRequest() {
        val saved = record ?: return
        if (saved.pendingProposal == null) return
        val next = saved.copy(pendingProposal = null)
        storage.write(uid, tripId, next); record = next
    }
}
