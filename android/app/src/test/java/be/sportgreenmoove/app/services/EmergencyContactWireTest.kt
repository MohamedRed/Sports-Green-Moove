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
            "4c949181-39a8-4483-a3a4-ad781f3b7c61", "a".repeat(64))
        val payload = EmergencyContactWire.payload(operation)
        assertEquals(setOf("target", "contact", "expectedRevision", "requestId", "expectedChildInstanceId"), payload.keys)
        assertEquals("a".repeat(64), payload["expectedChildInstanceId"])
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
    @Test fun childViewsRequireTheExactClubImmutableIdentityAndTransactionBoundNames() {
        val child = EmergencyContactTarget.Child("child", "club")
        val raw = response + mapOf("kind" to "child", "subjectId" to "child", "clubId" to "club", "childInstanceId" to "a".repeat(64),
            "childName" to "Enfant QA", "clubName" to "Club QA")
        val view = EmergencyContactWire.view(raw, "parent", child)
        assertEquals("a".repeat(64), view.childInstanceId); assertEquals("Enfant QA", view.childName)
        for (patch in listOf(mapOf("childInstanceId" to null), mapOf("childInstanceId" to "a".repeat(63)),
            mapOf("clubId" to "other"), mapOf("childName" to ""), mapOf("clubName" to " Club QA "), mapOf("childName" to "QA\nprivate")))
            assertThrows(IllegalStateException::class.java) { EmergencyContactWire.view(raw + patch, "parent", child) }
    }
    @Test fun childReceiptsCannotAcknowledgeAnotherProfileOrClub() {
        val operation = EmergencyContactOperation(EmergencyContactTarget.Child("child", "club"), null, 1,
            "4c949181-39a8-4483-a3a4-ad781f3b7c61", "a".repeat(64))
        val raw = mapOf("kind" to "child", "subjectId" to "child", "clubId" to "club", "childInstanceId" to "a".repeat(64),
            "revision" to 2, "replayed" to false)
        assertEquals(2L, EmergencyContactWire.receipt(raw, "parent", operation).revision)
        for (patch in listOf(mapOf("childInstanceId" to "b".repeat(64)), mapOf("clubId" to "other")))
            assertThrows(IllegalStateException::class.java) { EmergencyContactWire.receipt(raw + patch, "parent", operation) }
        assertThrows(IllegalStateException::class.java) { EmergencyContactWire.payload(operation.copy(expectedChildInstanceId = null)) }
    }
    @Test fun adultViewsAndWritesCannotCarryUnrelatedChildPrivateMetadata() {
        for (field in listOf("childInstanceId", "clubId", "childName", "clubName"))
            assertThrows(IllegalStateException::class.java) { EmergencyContactWire.view(response + mapOf(field to "private"), "parent", target) }
        assertThrows(IllegalStateException::class.java) {
            EmergencyContactWire.payload(EmergencyContactOperation(target, null, 1, "4c949181-39a8-4483-a3a4-ad781f3b7c61", "a".repeat(64)))
        }
    }
}
