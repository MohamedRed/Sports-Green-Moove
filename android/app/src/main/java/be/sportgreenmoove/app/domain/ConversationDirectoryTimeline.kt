package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ConversationDirectoryPage
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.data.ConversationPosition

class ConversationDirectoryTimeline {
    private data class Cursor(val token: String, val stopAt: ConversationPosition?)
    private val records = linkedMapOf<String, ConversationListItem>()
    private val cursors = mutableListOf<Cursor>()
    private var newest: ConversationPosition? = null
    private var initialized = false
    val items: List<ConversationListItem> get() = records.values.sortedByDescending { it.position }
    val nextCursor: String? get() = cursors.firstOrNull()?.token

    fun applyLatest(page: ConversationDirectoryPage) {
        if (page.nextCursor == null) {
            records.keys.retainAll(page.items.map { it.id }.toSet())
            cursors.clear()
        } else {
            val previous = newest
            val disjoint = previous != null && page.oldest != null && page.oldest > previous
            if (!initialized || disjoint) enqueue(0, Cursor(page.nextCursor, if (initialized) previous else null))
        }
        merge(page)
        newest = page.newest
        initialized = true
    }

    fun applyEarlier(token: String, page: ConversationDirectoryPage) {
        val index = cursors.indexOfFirst { it.token == token }
        if (index < 0) return
        val cursor = cursors.removeAt(index)
        val reached = cursor.stopAt != null && page.oldest != null && page.oldest <= cursor.stopAt
        if (!reached && page.nextCursor != null) enqueue(index, Cursor(page.nextCursor, cursor.stopAt))
        merge(page)
    }

    private fun enqueue(index: Int, cursor: Cursor) {
        if (cursors.none { it.token == cursor.token }) cursors.add(index.coerceAtMost(cursors.size), cursor)
    }

    private fun merge(page: ConversationDirectoryPage) {
        page.excludedIds.forEach(records::remove)
        page.items.forEach { incoming ->
            val previous = records[incoming.id]
            if (previous == null || incoming.revision >= previous.revision) records[incoming.id] = incoming
        }
    }
}
