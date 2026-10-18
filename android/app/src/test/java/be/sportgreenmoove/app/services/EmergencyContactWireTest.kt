package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.junit.Assert.*
import org.junit.Test

class EmergencyContactWireTest {
    private val target = EmergencyContactTarget.Self
    private val contact = mapOf("name" to "Contact QA", "phone" to "+12025550123")
    private val response = mapOf("kind" to "self", "subjectId" to "parent", "contact" to contact, "revision" to 1)
    @Test fun missingNullAndRemovedContactsHaveExplicitSafeVersions() {
        assertEquals("+12025550123", EmergencyContactWire.view(response, "parent", target).contact?.phone)
        assertNull(EmergencyContactWire.view(response + mapOf("contact" to null, "revision" to 0), "parent", target).contact)
        assertEquals(3L, EmergencyContactWire.view(response + mapOf("contact" to null, "revision" to 3), "parent", target).revision)
        assertThrows(IllegalStateException::class.java) { EmergencyContactWire.view(response - "contact", "parent", target) }
    }
    @Test fun anotherOwnerKindOrSubjectIsRejected() {
        for (patch in listOf(mapOf("subjectId" to "other"), mapOf("kind" to "child")))
            assertThrows(IllegalStateException::class.java) { EmergencyContactWire.view(response + patch, "parent", target) }
        assertThrows(IllegalStateException::class.java) {
            EmergencyContactWire.view(response, "parent", EmergencyContactTarget.Child("child", "club"))
        }
    }
    @Test fun unsafeMissingFractionalAndOutOfRangeVersionsAreNotCoerced() {
        for (revision in listOf(null, "1", -1, .5, Double.NaN, Double.POSITIVE_INFINITY, 9_007_199_254_740_992L))
            assertThrows(IllegalStateException::class.java) { EmergencyContactWire.view(response + mapOf("revision" to revision), "parent", target) }
        assertThrows(IllegalStateException::class.java) { EmergencyContactWire.view(response + mapOf("revision" to 0), "parent", target) }
    }
    @Test fun payloadsNeverAcceptAnotherOwnerAndRemovalIsNotOmitted() {
        val operation = EmergencyContactOperation(EmergencyContactTarget.Child("child", "club"), null, 3,
            "4c949181-39a8-4483-a3a4-ad781f3b7c61")
        val payload = EmergencyContactWire.payload(operation)
        assertEquals(setOf("target", "contact", "expectedRevision", "requestId"), payload.keys)
        assertTrue(payload.containsKey("contact")); assertNull(payload["contact"])
        assertEquals(mapOf("kind" to "child", "childId" to "child", "clubId" to "club"), payload["target"])
        assertThrows(IllegalStateException::class.java) { EmergencyContactWire.payload(operation.copy(expectedRevision = 9_007_199_254_740_991L)) }
    }
    @Test fun aReceiptRequiresTheExactScopeANewerVersionAndExplicitReplayFlag() {
        val operation = EmergencyContactOperation(target, null, 1, "4c949181-39a8-4483-a3a4-ad781f3b7c61")
        val receipt = mapOf("kind" to "self", "subjectId" to "parent", "revision" to 2, "replayed" to false)
        assertEquals(2L, EmergencyContactWire.receipt(receipt, "parent", operation).revision)
        for (patch in listOf(mapOf("revision" to 1), mapOf("subjectId" to "other"), mapOf("replayed" to null)))
            assertThrows(IllegalStateException::class.java) { EmergencyContactWire.receipt(receipt + patch, "parent", operation) }
    }
    @Test fun malformedNamesNumbersAndControlCharactersNeverBecomeADialDestination() {
        for (value in listOf(contact + mapOf("name" to " QA "), contact + mapOf("name" to "QA\nprivate"),
            contact + mapOf("phone" to "112"), contact + mapOf("phone" to "+12025550123\n")))
            assertThrows(IllegalArgumentException::class.java) { EmergencyContactWire.view(response + mapOf("contact" to value), "parent", target) }
    }
}
