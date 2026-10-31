package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal fun tripChangePreview(raw: Any?, tripId: String): TripChangePreview = with(TripChangeWire) {
    val data = map(raw)
    check(id(data["tripId"]) == tripId)
    val bookings = integer(data["bookingCount"])
    TripChangePreview(tripId, hash(data["revision"]), terms(data["terms"]), bookings,
        integer(data["parentCount"], max = bookings))
}

internal fun tripChangeProposalResolution(raw: Any?, request: TripChangeProposalRequest): TripChangeReview? = with(TripChangeWire) {
    val data = map(raw)
    check(data["tripId"] == request.tripId && data["requestId"] == request.requestId && data.containsKey("review"))
    if (!flag(data["recorded"])) { check(data["review"] == null); return null }
    tripChangeReview(data["review"], request.tripId).also {
        check(it.proposalRequestId == request.requestId && it.sourceRevision == request.expectedRevision && it.terms == request.terms)
    }
}

internal fun tripChangeReview(raw: Any?, tripId: String, proposalId: String? = null): TripChangeReview = with(TripChangeWire) {
    val data = map(raw)
    check(id(data["tripId"]) == tripId)
    val proposal = hash(data["proposalId"])
    check(proposalId == null || proposal == proposalId)
    val status = TripChangeStatus.entries.singleOrNull { it.wire == data["status"] } ?: error("Statut de modification invalide.")
    check(data.containsKey("decision"))
    val decision = data["decision"]?.let { value ->
        TripChangeDecision.entries.singleOrNull { it.wire == value } ?: error("Décision de modification invalide.")
    }
    val parents = integer(data["parentCount"])
    val accepted = integer(data["acceptedParentCount"], max = parents)
    val applied = flag(data["applied"])
    val respond = flag(data["canRespond"])
    val withdraw = flag(data["canWithdraw"])
    check(flag(data["applicationImplemented"]))
    check(applied == (status == TripChangeStatus.Applied))
    check(!respond || (status == TripChangeStatus.Pending && decision == null && !withdraw))
    check(!withdraw || status in setOf(TripChangeStatus.Pending, TripChangeStatus.Confirmed, TripChangeStatus.Outdated))
    check(status !in setOf(TripChangeStatus.Confirmed, TripChangeStatus.Applied) || parents == accepted)
    check(status != TripChangeStatus.Pending || accepted < parents)
    val bookingIds = ids(data["bookingIds"])
    val balances = (data["balances"] as? List<*>)?.map { value ->
        val balance = map(value)
        TripChangeBalance(id(balance["bookingId"]), integer(balance["balanceCents"], -800_000, 800_000))
    } ?: error("Soldes de modification manquants.")
    check(balances.size <= 100 && balances.map { it.bookingId }.distinct().size == balances.size)
    check(balances.all { it.bookingId in bookingIds })
    fun optionalRequest(key: String): String? {
        check(data.containsKey(key))
        return data[key]?.let { uuid(it as? String ?: error("Identité de modification invalide.")) }
    }
    TripChangeReview(tripId, proposal, hash(data["revision"]), status, terms(data["originalTerms"]), terms(data["terms"]),
        terms(data["currentTerms"]), parents, accepted, decision, bookingIds, respond, withdraw, applied,
        balances, date(data["createdAt"]), hash(data["sourceRevision"]), optionalRequest("proposalRequestId"),
        optionalRequest("decisionRequestId"), optionalRequest("withdrawalRequestId"))
}

internal fun tripChangeRouteQuote(raw: Any?): TripChangeRouteQuote = with(TripChangeWire) {
    val data = map(raw)
    val route = map(data["route"])
    val polyline = route["encodedPolyline"]?.let { (it as? String)?.takeIf { text -> text.length in 1..100_000 }
        ?: error("Itinéraire de modification invalide.") }
    TripChangeRouteQuote(hash(data["quoteId"]), integer(route["distanceMeters"], 1, 10_000_000),
        integer(route["durationSeconds"], 1, 30 * 86400), polyline, date(data["expiresAt"]))
}

internal fun tripChangeApplicationReceipt(raw: Any?, request: TripChangeApplyRequest, uid: String): TripChangeApplicationReceipt = with(TripChangeWire) {
    val data = map(raw)
    check(data["status"] == "applied" && id(data["tripId"]) == request.tripId &&
        hash(data["proposalId"]) == request.proposalId && hash(data["proposalRevision"]) == request.proposalRevision &&
        hash(data["quoteId"]) == request.quoteId && uuid(data["requestId"] as? String ?: error("Identité manquante.")) == request.requestId &&
        id(data["actorUserId"]) == uid)
    val bookings = ids(data["bookingIds"])
    TripChangeApplicationReceipt(request.tripId, request.proposalId, request.proposalRevision, request.quoteId,
        request.requestId, uid, date(data["appliedAt"]), bookings, integer(data["settlementRequiredCount"], max = bookings.size))
}
