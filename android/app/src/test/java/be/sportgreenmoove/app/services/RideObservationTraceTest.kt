package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class RideObservationTraceTest {
    @Test fun onlyEnumeratedEventsAndConnectionFlagsAreRecorded() {
        var now = 100L
        val messages = mutableListOf<String>()
        val trace = RideObservationTrace({ now }, messages::add)
        trace.record(RideObservationEvent.Opened)
        now += 15
        trace.record(RideObservationEvent.Connected, true)
        trace.record(RideObservationEvent.FetchCancelled)
        assertEquals(3, messages.size)
        assertTrue(messages[0].matches(Regex("observer=\\d+ sequence=1 elapsedMs=0 event=Opened")))
        assertTrue(messages[1].endsWith("sequence=2 elapsedMs=15 event=Connected connected=true"))
        assertTrue(messages[2].endsWith("sequence=3 elapsedMs=15 event=FetchCancelled"))
    }

    @Test fun eachObserverHasADistinctIdentityWithoutAccountOrRideIdentifiers() {
        val messages = mutableListOf<String>()
        repeat(2) { RideObservationTrace({ 0L }, messages::add).record(RideObservationEvent.Opened) }
        assertNotEquals(messages[0].substringBefore(" sequence"), messages[1].substringBefore(" sequence"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun connectionValueCannotBeAttachedToAnotherEvent() {
        RideObservationTrace({ 0L }, {}).record(RideObservationEvent.LocationChanged, true)
    }
}
