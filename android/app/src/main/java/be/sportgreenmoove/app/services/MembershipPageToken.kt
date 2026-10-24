package be.sportgreenmoove.app.services

internal object MembershipPageToken {
    const val MAX_LENGTH = 16_384
    fun decode(value: Any?): String? {
        if (value == null) return null
        return (value as? String)?.takeIf { it.length in 1..MAX_LENGTH && Regex("^[A-Za-z0-9_-]+$").matches(it) }
            ?: error("Page de liste invalide.")
    }
}
