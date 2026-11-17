package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.junit.Assert.*
import org.junit.Test

class GuardianVerificationWireTest {
    private val row = mapOf("id" to "a".repeat(64), "clubId" to "club", "childId" to "child", "parentUserId" to "parent",
        "clubName" to "Club QA", "childName" to "Enfant QA", "status" to "requested", "revision" to 1.0, "allowedActions" to listOf("withdraw"))
    @Test fun absentVerificationRequiresExplicitNullAndZeroRevision() {
        val absent = row + mapOf("status" to null, "revision" to 0, "allowedActions" to listOf("request"))
        assertNull(GuardianVerificationWire.verification(absent, "parent", true).status)
        assertThrows(Exception::class.java) { GuardianVerificationWire.verification(absent, "parent") }
        assertThrows(Exception::class.java) { GuardianVerificationWire.verification(absent - "status", "parent", true) }
        assertThrows(Exception::class.java) { GuardianVerificationWire.verification(absent + ("revision" to 7), "parent", true) }
    }
    @Test fun foreignOwnershipManagerActionsAndMalformedVersionsAreRejected() {
        assertEquals(GuardianVerificationStatus.Requested, GuardianVerificationWire.verification(row, "parent").status)
        for (patch in listOf(mapOf("parentUserId" to "other"), mapOf("allowedActions" to listOf("verify")),
            mapOf("allowedActions" to listOf("request")), mapOf("allowedActions" to listOf("withdraw", "withdraw")),
            mapOf("revision" to -1), mapOf("revision" to 1.5), mapOf("revision" to Double.POSITIVE_INFINITY),
            mapOf("revision" to "1"), mapOf("status" to "verified-legacy"), mapOf("id" to "foreign")))
            assertThrows(Exception::class.java) { GuardianVerificationWire.verification(row + patch, "parent") }
    }
    @Test fun optionalCurrentIdentityStaysMissingInsteadOfInventingAName() {
        val result = GuardianVerificationWire.verification(row + mapOf("childName" to null, "clubName" to null), "parent")
        assertNull(result.childName); assertNull(result.clubName)
        assertThrows(Exception::class.java) { GuardianVerificationWire.verification(row - "childName", "parent") }
    }
    @Test fun pagesAreBoundedAndRequireExplicitCursorState() {
        val page = GuardianVerificationWire.page(mapOf("items" to listOf(row), "nextCursor" to null)) { GuardianVerificationWire.verification(it, "parent") }
        assertEquals(1, page.items.size)
        for (data in listOf(mapOf("items" to listOf(row)), mapOf("items" to List(21) { row }, "nextCursor" to null),
            mapOf("items" to emptyList<Any>(), "nextCursor" to "")))
            assertThrows(Exception::class.java) { GuardianVerificationWire.page(data) { it } }
    }
    @Test fun receiptIdentityAndRevisionCannotConfirmAnotherOrUnadvancedRequest() {
        val reply = mapOf("verificationId" to "a".repeat(64), "revision" to 2, "status" to "revoked", "replayed" to true)
        assertEquals(GuardianVerificationStatus.Revoked, GuardianVerificationWire.receipt(reply, "a".repeat(64), 1).status)
        for (patch in listOf(mapOf("verificationId" to "b".repeat(64)), mapOf("revision" to 1), mapOf("replayed" to "true")))
            assertThrows(Exception::class.java) { GuardianVerificationWire.receipt(reply + patch, "a".repeat(64), 1) }
    }
}
