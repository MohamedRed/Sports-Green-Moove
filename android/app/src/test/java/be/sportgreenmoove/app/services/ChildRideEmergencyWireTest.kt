package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class ChildRideEmergencyWireTest {
    private fun reply() = mapOf<String, Any?>("accountUserId" to "child", "subjectId" to "profile-child", "rideSessionId" to "ride", "childName" to "Enfant QA",
        "childInstanceId" to "a".repeat(64), "revision" to 1,
        "contact" to mapOf("name" to "Contact QA", "phone" to "+12025550121"))
    @Test fun exactChildAndRideBindingsAreRequired() {
        val result = EmergencyContactWire.childRideView(reply(), "child", "ride")
        assertEquals("child", result.ownerUid); assertEquals("profile-child", result.childId); assertEquals("ride", result.rideSessionId)
        assertEquals("+12025550121", result.contact?.phone)
        for (patch in listOf(mapOf("accountUserId" to "other"), mapOf("subjectId" to "a/b"), mapOf("rideSessionId" to "other"),
            mapOf("childInstanceId" to "unknown"), mapOf("childName" to " ")))
            assertThrows(Exception::class.java) { EmergencyContactWire.childRideView(reply() + patch, "child", "ride") }
    }
    @Test fun missingContactAndMalformedNumberAreNotInterpretedAsAbsence() {
        assertThrows(Exception::class.java) { EmergencyContactWire.childRideView(reply() - "contact", "child", "ride") }
        assertThrows(Exception::class.java) { EmergencyContactWire.childRideView(reply() +
            mapOf("contact" to mapOf("name" to "QA", "phone" to "112")), "child", "ride") }
        val absent = EmergencyContactWire.childRideView(reply() + mapOf("contact" to null, "revision" to 0), "child", "ride")
        assertNull(absent.contact); assertEquals(0L, absent.revision)
    }
    @Test fun unsafeVersionsAndUnversionedContactsAreRejected() {
        for (version in listOf(-1, 0, .5, Double.POSITIVE_INFINITY, "1", 9_007_199_254_740_992.0))
            assertThrows(Exception::class.java) { EmergencyContactWire.childRideView(reply() + mapOf("revision" to version), "child", "ride") }
    }
}
