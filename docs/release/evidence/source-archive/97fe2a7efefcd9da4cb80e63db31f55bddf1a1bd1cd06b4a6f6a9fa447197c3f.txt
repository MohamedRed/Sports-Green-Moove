package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.services.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.security.MessageDigest

class ChildInvitationFlowTest {
    @get:Rule val compose = createComposeRule()
    private val target = ChildAccountLinkTarget("profile", "club", "b".repeat(64), "Enfant fictif QA")
    @Test fun aParentCreatesThenSharesOnlyTheReturnedLinkWithoutShowingItsSecret() {
        val gateway = InvitationUiFixture(); val shared = mutableListOf<String>(); host(gateway, shared)
        waitLoaded(); compose.onNodeWithTag("child-invitation.share").assertIsNotEnabled()
        compose.onNodeWithTag("child-invitation.create").performClick(); waitForStatus()
        compose.onNodeWithText(target.childName).assertIsDisplayed()
        compose.onNodeWithText(gateway.token, substring = true).assertDoesNotExist()
        compose.onNodeWithTag("child-invitation.share").performScrollTo().performClick()
        compose.runOnIdle { assertEquals(listOf(gateway.link.url), shared); assertEquals(1, gateway.creations) }
    }
    @Test fun anExplicitRevocationDisablesTheShareAction() {
        val gateway = InvitationUiFixture(); host(gateway, mutableListOf()); waitLoaded()
        compose.onNodeWithTag("child-invitation.create").performClick(); waitForStatus()
        compose.onNodeWithTag("child-invitation.revoke").performScrollTo().performClick()
        compose.waitUntil(30_000) { gateway.revocations == 1 }
        compose.onNodeWithTag("child-invitation.share").assertIsNotEnabled()
        compose.onNodeWithText("Invitation annulée.").assertExists()
    }
    @Test fun aConsumedInvitationIsNotDisplayedAsReusableOnALargeTextSmallScreen() {
        val gateway = InvitationUiFixture(); gateway.current = gateway.link.current.copy(status = "accepted")
        host(gateway, mutableListOf()); waitForStatus()
        compose.onNodeWithText("Compte créé.").assertIsDisplayed()
        compose.onNodeWithTag("child-invitation.create").assertIsNotEnabled()
        compose.onNodeWithTag("child-invitation.share").assertIsNotEnabled()
        compose.onNodeWithTag("child-invitation.revoke").assertIsNotEnabled()
        assertEquals(0, gateway.creations)
    }
    private fun host(gateway: InvitationUiFixture, shared: MutableList<String>) {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                Box(Modifier.width(320.dp)) { ChildInvitationDialog("parent", target, gateway, {}, { shared += it }) }
            }
        }
    }
    private fun waitLoaded() { compose.waitUntil(30_000) {
        compose.onAllNodes(hasTestTag("child-invitation.create") and isEnabled()).fetchSemanticsNodes().isNotEmpty()
    } }
    private fun waitForStatus() { compose.waitUntil(30_000) { compose.onAllNodesWithTag("child-invitation.status").fetchSemanticsNodes().isNotEmpty() } }
}

private class InvitationUiFixture : ChildInvitationGateway {
    val token = "a".repeat(64)
    private val hash = MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }
    val link = ChildInvitationLink("profile", "b".repeat(64), "https://sports-green-moove-prod.web.app/child-invitation#$token",
        ChildInvitationStatus(hash, "pending", System.currentTimeMillis() + 86_400_000))
    var current: ChildInvitationStatus? = null; var creations = 0; var revocations = 0
    override suspend fun current(uid: String, target: ChildAccountLinkTarget) = current
    override suspend fun create(uid: String, target: ChildAccountLinkTarget): ChildInvitationLink { creations++; current = link.current; return link }
    override suspend fun revoke(uid: String, target: ChildAccountLinkTarget, invitationHash: String) {
        check(invitationHash == hash); revocations++; current = link.current.copy(status = "revoked")
    }
}
