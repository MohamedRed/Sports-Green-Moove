package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal object SupportWire {
    private fun map(value: Any?) = value as? Map<*, *> ?: error("Réponse du support invalide.")
    private fun number(value: Any?, positive: Boolean = false): Long {
        check(value !is Boolean)
        val numeric = (value as? Number)?.toDouble() ?: error("Nombre du support manquant.")
        check(numeric.isFinite() && numeric % 1.0 == 0.0 && numeric in (if (positive) 1.0 else 0.0)..9_007_199_254_740_991.0)
        return numeric.toLong()
    }
    private fun text(value: Any?, minimum: Int, maximum: Int): String = (value as? String)?.also {
        check(it.trim().length >= minimum && it.length <= maximum)
    } ?: error("Texte du support manquant.")
    fun reply(value: Any?): SupportReply = map(value).let {
        SupportReply(TripChangeWire.hash(it["id"]), text(it["text"], 1, 2000), number(it["sequence"], true), number(it["sentAtMillis"], true))
    }
    fun report(value: Any?): SupportReport = map(value).let {
        check(it["emergency"] is Boolean && it.containsKey("lastReply"))
        val count = number(it["replyCount"]); val last = it["lastReply"]?.let(::reply)
        check(if (count == 0L) last == null else last?.sequence == count)
        val created = number(it["createdAtMillis"], true); val updated = number(it["updatedAtMillis"], true); check(updated >= created)
        SupportReport(TripChangeWire.id(it["id"]), text(it["reason"], 2, 120), text(it["description"], 5, 2000), it["emergency"] as Boolean,
            SupportStatus.entries.singleOrNull { status -> status.wire == it["status"] } ?: error("Statut du support invalide."),
            created, updated, count, last)
    }
    fun <T> page(value: Any?, identity: (T) -> String, decode: (Any?) -> T): SupportPage<T> = map(value).let {
        check(it.containsKey("nextCursor")); val rows = it["items"] as? List<*> ?: error("Liste du support manquante.")
        check(rows.size <= 20); val items = rows.map(decode); check(items.map(identity).distinct().size == items.size)
        SupportPage(items, MembershipPageToken.decode(it["nextCursor"]))
    }
    fun reports(value: Any?) = page(value, SupportReport::id, ::report)
    fun detail(value: Any?, expectedId: String): SupportDetail = map(value).let {
        val report = report(it["report"]); check(report.id == expectedId)
        val replies = page(it["replies"], SupportReply::id, ::reply)
        check(replies.items.all { row -> row.sequence <= report.replyCount })
        check(replies.items.zipWithNext().all { (left, right) -> left.sequence > right.sequence })
        SupportDetail(report, replies)
    }
}
