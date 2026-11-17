package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class MembershipPageTokenTest {
    @Test fun longOpaqueTokensAreKeptExactlyWithoutAnyClientSideScopeOrIdentityRewrite() {
        val value = "A".repeat(16_384)
        assertEquals(value, MembershipPageToken.decode(value)); assertEquals(value, GuardianVerificationWire.cursor(value))
    }
    @Test fun explicitNullIsTheOnlyEmptyPageMarker() {
        assertNull(MembershipPageToken.decode(null))
        for (value in listOf("", false, 7, emptyMap<String, String>())) assertThrows(Exception::class.java) { MembershipPageToken.decode(value) }
    }
    @Test fun guardianAndTeamPagesKeepLongEntityIdsAndTheSameContinuationToken() {
        val id = "界".repeat(256); val token = "A".repeat(16_384)
        val response = mapOf("items" to listOf(mapOf("id" to id, "name" to "Club QA")), "nextCursor" to token)
        val guardian = GuardianVerificationWire.page(response, GuardianVerificationWire::option)
        val team = GuardianVerificationWire.page(response, TeamEnrollmentWire::option)
        assertEquals(id, guardian.items.single().id); assertEquals(id, team.items.single().id)
        assertEquals(token, guardian.nextCursor); assertEquals(token, team.nextCursor)
    }
    @Test fun oversizedPaddedAndNonAsciiTokensAreRejectedNotTruncated() {
        for (value in listOf("A".repeat(16_385), "valid=", "ab/c", "ab+c", "abc\n", "é"))
            assertThrows(Exception::class.java) { MembershipPageToken.decode(value) }
    }
}
