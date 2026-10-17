package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class ConversationTimelineTest {
    private fun page(from: Int, to: Int, cursor: Int? = null) = ConversationPage(
        (from downTo to).map { ConversationMessage("m$it", "Message $it", false, it.toLong(), needsRead = true) }, cursor?.let { "m$it" },
    )

    @Test fun earlierPagesAndReadUpdatesKeepOneOrderedCopyOfEveryMessage() {
        val timeline = ConversationTimeline()
        timeline.applyLatest(page(101, 52, 52))
        timeline.applyEarlier("m52", page(51, 2, 2))
        timeline.applyEarlier("m2", page(1, 1))
        timeline.applyLatest(page(101, 52, 52))
        assertEquals(101, timeline.messages.size)
        assertEquals("m101", timeline.messages.first().id)
        assertEquals("m1", timeline.messages.last().id)
        assertNull(timeline.olderCursorId)
        timeline.markRead(listOf("m1"))
        assertFalse(timeline.messages.last().needsRead)
    }

    @Test fun aBurstLargerThanTheLiveWindowCanBeLoadedWithoutLosingOlderHistory() {
        val timeline = ConversationTimeline()
        timeline.applyLatest(page(100, 51, 51))
        timeline.applyLatest(page(220, 171, 171))
        timeline.applyEarlier("m171", page(170, 121, 121))
        timeline.applyEarlier("m121", page(120, 71, 71))
        assertEquals("m51", timeline.olderCursorId)
        timeline.applyEarlier("m51", page(50, 1))
        assertEquals(220, timeline.messages.size)
        assertNull(timeline.olderCursorId)
    }

    @Test fun equalTimestampMessagesUseNanosecondsAndStableDocumentIdOrder() {
        val timeline = ConversationTimeline()
        timeline.applyLatest(ConversationPage(listOf(
            ConversationMessage("a", "A", false, 1, 2), ConversationMessage("c", "C", false, 1, 1),
            ConversationMessage("b", "B", false, 1, 2),
        ), null))
        assertEquals(listOf("b", "a", "c"), timeline.messages.map { it.id })
    }
}
