package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ClubSummary
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClubMembershipStateTest {
    @Test fun rejectedInactiveAndMissingStatusesCannotBecomeMembersThroughTheirRoleLabel() {
        val club = ClubSummary("club", "Club QA", "Football", 3, "MEMBRE", "CQ", emptyList())
        for (status in listOf("rejected", "inactive", "cancelled", "requested", "pending", null)) {
            assertFalse(club.copy(membershipStatus = status).isMember)
        }
        assertFalse(club.copy(membershipStatus = "active", membershipActive = false).isMember)
        assertFalse(club.copy(membershipStatus = "rejected", membershipActive = true).isMember)
        assertTrue(club.copy(membershipActive = true).isMember)
    }
    @Test
    fun requestedMembershipIsPendingButNotActiveMember() {
        val club = ClubSummary(
            id = "club-1",
            name = "Wavre Sports",
            sport = "Football",
            memberCount = 42,
            roleLabel = null,
            initials = "WS",
            memberInitials = emptyList(),
            membershipStatus = "requested",
        )

        assertTrue(club.hasPendingRequest)
        assertFalse(club.isMember)
    }

    @Test
    fun activeRoleIsMember() {
        val club = ClubSummary(
            id = "club-1",
            name = "Wavre Sports",
            sport = "Football",
            memberCount = 42,
            roleLabel = "MEMBRE",
            initials = "WS",
            memberInitials = emptyList(),
            membershipStatus = "active",
        )

        assertFalse(club.hasPendingRequest)
        assertTrue(club.isMember)
    }
}
