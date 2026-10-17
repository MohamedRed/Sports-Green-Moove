package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.ResolvedPlace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class PublishDraftFactoryTest {
    private val club = ClubSummary(
        id = "club-wavre",
        name = "Wavre Sports",
        sport = "Football",
        memberCount = 42,
        roleLabel = "DRIVER",
        initials = "WS",
        memberInitials = emptyList(),
    )
    private val origin = ResolvedPlace("origin", "Wavre", "Rue du Stade 1", 50.715, 4.612)
    private val destination = ResolvedPlace("dest", "Ottignies", "Avenue du Club 8", 50.669, 4.567)

    @Test
    fun draftUsesMemberClubContextInsteadOfStaticClubData() {
        val draft = createTripPublishDraft(
            category = "U 13/14",
            departureIso = "2026-09-12T14:30:00Z",
            origin = origin,
            destination = destination,
            seats = 3,
            price = "4,50",
            returnTrip = true,
            childTracking = true,
            club = club,
        )

        requireNotNull(draft)
        assertEquals("club-wavre", draft.clubId)
        assertEquals("Wavre Sports", draft.clubName)
        assertEquals("club-wavre-u-13-14", draft.teamId)
        assertEquals(450, draft.priceCents)
        assertFalse(draft.title.contains("Royal Ottignies"))
    }

    @Test
    fun draftRequiresResolvedPlaces() {
        assertNull(
            createTripPublishDraft(
                category = "U 13/14",
                departureIso = "2026-09-12T14:30:00Z",
                origin = null,
                destination = destination,
                seats = 3,
                price = "4,50",
                returnTrip = true,
                childTracking = true,
                club = club,
            ),
        )
    }
}
