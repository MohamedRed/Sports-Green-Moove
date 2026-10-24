package be.sportgreenmoove.app.ui

import org.junit.Assert.*
import org.junit.Test

class LocalNetworkCleanupTest {
    @Test fun bothRequestsAreReleasedEvenWhenRestorationAndOneReleaseFail() {
        val primary = IllegalStateException("restore")
        val release = IllegalArgumentException("cellular")
        val calls = mutableListOf<String>()
        val failure = runCatching { finishLocalNetworkCleanup(null,
            { calls += "restore"; throw primary }, { calls += "cellular"; throw release }, { calls += "wifi" }) }.exceptionOrNull()
        assertSame(primary, failure)
        assertEquals(listOf("restore", "cellular", "wifi"), calls)
        assertEquals(listOf(release), primary.suppressed.toList())
    }
    @Test fun requestSetupFailureIsNotReplacedByCleanupFailure() {
        val primary = IllegalStateException("setup")
        val cleanup = IllegalStateException("cleanup")
        var closed = false
        val failure = runCatching { finishLocalNetworkCleanup(primary, { throw cleanup }, { closed = true }) }.exceptionOrNull()
        assertSame(primary, failure); assertTrue(closed); assertEquals(listOf(cleanup), primary.suppressed.toList())
    }
}
