package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ConversationDirectoryPage
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.data.ConversationPosition
import be.sportgreenmoove.app.data.ConversationRef
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ConversationDirectoryTimelineTest {
    private fun item(id: Int, second: Long = id.toLong(), revision: Long = 1) = ConversationListItem("i$id",
        ConversationRef(ConversationKind.Booking, "b$id"), "Trajet $id", "Message $id", "15 octobre", 1, revision,
        ConversationPosition(second, 0, "i$id"), "16 octobre · 18h00")
    private fun page(from: Int, to: Int, cursor: String? = null): ConversationDirectoryPage {
        val items = (from downTo to).map { item(it) }
        return ConversationDirectoryPage(items, cursor, items.firstOrNull()?.position, items.lastOrNull()?.position)
    }

    @Test fun olderConversationsSurviveLiveHeadUpdatesAndAreNotDuplicated() {
        val state = ConversationDirectoryTimeline()
        state.applyLatest(page(40, 21, "older-21"))
        state.applyEarlier("older-21", page(20, 1))
        state.applyLatest(page(55, 36, "older-36"))
        assertEquals(55, state.items.size)
        assertEquals((55 downTo 1).map { "i$it" }, state.items.map { it.id })
        assertNull(state.nextCursor)
    }

    @Test fun burstsBiggerThanTheLiveWindowCanBePagedUntilTheOldCoverageIsReached() {
        val state = ConversationDirectoryTimeline()
        state.applyLatest(page(40, 21, "older-21"))
        state.applyLatest(page(100, 81, "older-81"))
        state.applyEarlier("older-81", page(80, 61, "older-61"))
        state.applyEarlier("older-61", page(60, 41, "older-41"))
        state.applyEarlier("older-41", page(40, 21, "older-21"))
        assertEquals("older-21", state.nextCursor)
        state.applyEarlier("older-21", page(20, 1))
        assertEquals(100, state.items.size)
        assertNull(state.nextCursor)
    }

    @Test fun staleEarlierResponsesCannotReplaceANewerPreviewOrReadCount() {
        val state = ConversationDirectoryTimeline()
        state.applyLatest(page(40, 21, "older-21"))
        val updated = item(7, 1000, 3).copy(preview = "Nouveau message", unreadCount = 70)
        val current = listOf(updated) + page(40, 22).items
        state.applyLatest(ConversationDirectoryPage(current, "older-22", current.first().position, current.last().position))
        state.applyEarlier("older-21", page(20, 1))
        assertEquals(40, state.items.size)
        assertEquals(updated, state.items.first())
    }

    @Test fun aCompleteServerSnapshotRemovesEntriesNoLongerPresentWithoutRegressingRevisions() {
        val state = ConversationDirectoryTimeline()
        val newer = item(2, revision = 4).copy(unreadCount = 0)
        state.applyLatest(ConversationDirectoryPage(listOf(newer, item(1)), null, newer.position, item(1).position))
        state.applyLatest(ConversationDirectoryPage(listOf(item(2)), null, item(2).position, item(2).position))
        assertEquals(listOf(newer), state.items)
        state.applyLatest(ConversationDirectoryPage(emptyList(), null, null, null))
        assertEquals(emptyList<ConversationListItem>(), state.items)
    }
}
