package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage

class ConversationTimeline {
    private data class Cursor(val id: String, val stopAtKnownMessage: Boolean)
    private val records = linkedMapOf<String, ConversationMessage>()
    private val cursors = mutableListOf<Cursor>()
    private var headIds = emptySet<String>()
    private var initialized = false

    val messages: List<ConversationMessage> get() = records.values.sortedWith(
        compareByDescending<ConversationMessage> { it.createdAtSeconds }
            .thenByDescending { it.createdAtNanos }.thenByDescending { it.id },
    )
    val olderCursorId: String? get() = cursors.firstOrNull()?.id

    fun applyLatest(page: ConversationPage) {
        val ids = page.messages.map { it.id }.toSet()
        val disconnected = initialized && ids.none { it in headIds }
        if (!initialized || headIds.isEmpty() || disconnected) {
            page.olderCursorId?.let { id ->
                if (cursors.none { it.id == id }) cursors.add(0, Cursor(id, initialized && records.isNotEmpty()))
            }
        }
        headIds = ids
        initialized = true
        merge(page)
    }

    fun applyEarlier(cursorId: String, page: ConversationPage) {
        val index = cursors.indexOfFirst { it.id == cursorId }
        if (index < 0) return
        val cursor = cursors.removeAt(index)
        val reachesKnown = cursor.stopAtKnownMessage && page.messages.any { it.id in records }
        if (!reachesKnown) page.olderCursorId?.let { next ->
            if (cursors.none { it.id == next }) cursors.add(index.coerceAtMost(cursors.size), Cursor(next, cursor.stopAtKnownMessage))
        }
        merge(page)
    }

    fun markRead(ids: List<String>) {
        ids.forEach { id -> records[id]?.let { records[id] = it.copy(needsRead = false) } }
    }

    private fun merge(page: ConversationPage) { page.messages.forEach { records[it.id] = it } }
}
