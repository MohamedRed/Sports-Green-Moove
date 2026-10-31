package be.sportgreenmoove.app.data

enum class SupportStatus(val wire: String, val label: String) {
    Open("open", "Reçue"), Reviewing("reviewing", "En cours"), Closed("closed", "Clôturée"),
}
data class SupportReply(val id: String, val text: String, val sequence: Long, val sentAtMillis: Long)
data class SupportReport(val id: String, val reason: String, val description: String, val emergency: Boolean,
    val status: SupportStatus, val createdAtMillis: Long, val updatedAtMillis: Long,
    val replyCount: Long, val lastReply: SupportReply?)
data class SupportPage<T>(val items: List<T>, val nextCursor: String?)
data class SupportDetail(val report: SupportReport, val replies: SupportPage<SupportReply>)
