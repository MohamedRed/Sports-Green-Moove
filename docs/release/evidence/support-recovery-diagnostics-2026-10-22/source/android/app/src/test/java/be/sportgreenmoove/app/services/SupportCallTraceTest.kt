package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class SupportCallTraceTest {
    private val request = "fda4bda5-ca1b-4916-929e-bd96f33213e5"

    @Test fun disabledTraceDoesNotInspectOrRecordAnOperation() {
        val trace = SupportCallTrace(false, 42) { error("Disabled trace must not emit") }
        assertNull(trace.start("not-a-test-operation"))
    }

    @Test fun oneSdkCallHasOneStartAndOneTerminalEvenIfTheObserverIsRepeated() {
        val rows = mutableListOf<Map<String, Any>>()
        val terminal = SupportCallTrace(true, 42, rows::add).start(request)!!
        assertEquals(1, rows.size)
        terminal(SupportCallOutcome.FAILED); terminal(SupportCallOutcome.SUCCEEDED)
        assertEquals(2, rows.size)
        assertEquals("call-start", rows[0]["event"]); assertEquals("call-terminal", rows[1]["event"])
        assertEquals("failed", rows[1]["outcome"])
        for (row in rows) {
            assertEquals(1, row["call"]); assertEquals(42, row["pid"]); assertEquals(request, row["operation"])
            assertTrue(row.keys.all { it in setOf("event", "call", "pid", "operation", "outcome") })
        }
    }

    @Test fun anExplicitSecondSdkCallKeepsTheOperationButHasAnotherCallNumber() {
        val rows = mutableListOf<Map<String, Any>>()
        val trace = SupportCallTrace(true, 42, rows::add)
        trace.start(request)!!(SupportCallOutcome.FAILED)
        trace.start(request)!!(SupportCallOutcome.SUCCEEDED)
        assertEquals(listOf(1, 1, 2, 2), rows.map { it["call"] })
        assertEquals(setOf(request), rows.map { it["operation"] }.toSet())
    }

    @Test fun cancellationHasOnlyItsBoundedOutcome() {
        val rows = mutableListOf<Map<String, Any>>()
        SupportCallTrace(true, 42, rows::add).start(request)!!(SupportCallOutcome.CANCELLED)
        assertEquals("cancelled", rows.last()["outcome"])
    }

    @Test fun enabledTraceRejectsAnythingOtherThanAnImmutableUuidBeforeLogging() {
        val rows = mutableListOf<Map<String, Any>>()
        assertThrows(IllegalArgumentException::class.java) { SupportCallTrace(true, 42, rows::add).start("PRIVATE TEXT") }
        assertTrue(rows.isEmpty())
    }
}
