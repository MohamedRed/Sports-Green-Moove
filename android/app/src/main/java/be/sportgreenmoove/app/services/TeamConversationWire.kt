package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal object TeamConversationWire {
    private fun map(value: Any?) = value as? Map<*, *> ?: error("Conversation d’équipe invalide.")
    private fun label(value: Any?): String? = if (value == null) null else (value as? String)?.takeIf {
        it.isNotBlank() && it.length <= 160 && !Regex("[\\x00-\\x1f\\x7f-\\x9f\\u202a-\\u202e\\u2066-\\u2069]").containsMatchIn(it)
    } ?: error("Nom de conversation invalide.")
    private fun integer(value: Any?, minimum: Long, maximum: Long): Long {
        val number = (value as? Number)?.toDouble() ?: error("Valeur de conversation manquante.")
        check(number.isFinite() && number % 1.0 == 0.0 && number in minimum.toDouble()..maximum.toDouble())
        return number.toLong()
    }
    fun choices(value: Any?, uid: String, clubId: String?): GuardianPage<TeamChatChoice> = map(value).let { payload ->
        check(payload["currentUserId"] == uid && payload["kind"] == if (clubId == null) "clubs" else "teams")
        check(payload.containsKey("clubId") && payload["clubId"] == clubId && payload.containsKey("nextCursor"))
        val rows = payload["items"] as? List<*> ?: error("Liste d’équipes invalide.")
        check(rows.size <= 5)
        val items = rows.map { map(it).let { row ->
            check(row.containsKey("name") && row.containsKey("teamInstanceId") && row.containsKey("unreadCount"))
            TeamChatChoice(TripChangeWire.id(row["id"]), label(row["name"]),
                if (clubId == null) { check(row["teamInstanceId"] == null); null } else TripChangeWire.hash(row["teamInstanceId"]),
                if (clubId == null) { check(row["unreadCount"] == null); null } else integer(row["unreadCount"], 0, 9_007_199_254_740_991L))
        } }
        check(items.map { it.id }.distinct().size == items.size)
        GuardianPage(items, MembershipPageToken.decode(payload["nextCursor"]))
    }
    fun page(value: Any?, uid: String, target: TeamConversationTarget): TeamConversationPage = map(value).let { payload ->
        check(payload["currentUserId"] == uid && payload["teamId"] == target.teamId && payload["teamInstanceId"] == target.teamInstanceId)
        check(payload["historyPolicy"] == "after-current-admission" && payload.containsKey("title") && payload.containsKey("nextCursor"))
        val rows = payload["items"] as? List<*> ?: error("Messages d’équipe invalides.")
        check(rows.size <= 50)
        val messages = rows.map { map(it).let { row ->
            val sender = TripChangeWire.id(row["senderUserId"])
            val body = (row["body"] as? String)?.takeIf { it.isNotBlank() && it.length <= 1000 } ?: error("Message invalide.")
            check(row.containsKey("authorName")); integer(row["sequence"], 1, 9_007_199_254_740_991L)
            val needsRead = row["needsRead"] as? Boolean ?: error("État de lecture manquant.")
            check(sender != uid || !needsRead)
            ConversationMessage(id = TripChangeWire.hash(row["id"]), body = body, mine = sender == uid,
                createdAtSeconds = integer(row["createdAtSeconds"], -62_135_596_800L, 253_402_300_799L),
                createdAtNanos = integer(row["createdAtNanos"], 0, 999_999_999L).toInt(),
                requestId = TripChangeWire.uuid(row["requestId"] as? String ?: error("Identité du message manquante.")),
                authorName = label(row["authorName"]), needsRead = needsRead)
        } }
        check(messages.map { it.id }.distinct().size == messages.size)
        val ordered = compareByDescending<ConversationMessage> { it.createdAtSeconds }.thenByDescending { it.createdAtNanos }.thenByDescending { it.id }
        check(messages == messages.sortedWith(ordered))
        TeamConversationPage(label(payload["title"]), TripChangeWire.hash(payload["accessVersion"]), messages,
            MembershipPageToken.decode(payload["nextCursor"]))
    }
    fun receipt(value: Any?, uid: String, target: TeamConversationTarget): String = map(value).let {
        check(it["currentUserId"] == uid && it["teamInstanceId"] == target.teamInstanceId && it["reused"] is Boolean)
        integer(it["sequence"], 1, 9_007_199_254_740_991L); TripChangeWire.hash(it["messageId"])
    }
    fun target(value: TeamConversationTarget): Map<String, Any> = mapOf(
        "teamId" to TripChangeWire.id(value.teamId), "expectedTeamInstanceId" to TripChangeWire.hash(value.teamInstanceId))
    fun reads(value: Any?, uid: String, target: TeamConversationTarget, accessVersion: String, ids: List<String>) {
        val payload = map(value)
        check(payload["currentUserId"] == uid && payload["teamInstanceId"] == target.teamInstanceId && payload["accessVersion"] == accessVersion)
        val read = (payload["readMessageIds"] as? List<*>)?.map { TripChangeWire.hash(it) } ?: error("Lecture non confirmée.")
        check(read == ids)
    }
}
