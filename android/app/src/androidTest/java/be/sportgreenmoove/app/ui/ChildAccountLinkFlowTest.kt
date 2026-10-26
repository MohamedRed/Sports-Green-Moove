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

class ChildAccountLinkFlowTest {
    @get:Rule val compose = createComposeRule()
    private val target = ChildAccountLinkTarget("profile", "club", "b".repeat(64), "Enfant fictif QA")
    @Test fun theChildCanCreateACodeButHasNoApprovalControl() {
        val gateway = PairingUiFixture()
        host(gateway, null)
        compose.onNodeWithTag("child-link.approve").assertDoesNotExist()
        compose.onNodeWithTag("child-link.create").performClick()
        waitFor("child-link.code"); assertEquals(1, gateway.creations); assertEquals(0, gateway.approvals)
        compose.waitForIdle(); captureChildAccountWindow("child-account-code-window.png")
    }
    @Test fun theParentSeesTheSelectedChildAndApprovesAnExplicitCodeOnASmallScreen() {
        val gateway = PairingUiFixture(); host(gateway, target)
        compose.onNodeWithText(target.childName).assertIsDisplayed()
        compose.onNodeWithTag("child-link.create").assertDoesNotExist()
        compose.onNodeWithTag("child-link.approve").assertIsNotEnabled()
        compose.onNodeWithTag("child-link.input").performTextInput("a".repeat(32))
        compose.onNodeWithTag("child-link.input").performImeAction()
        compose.onNodeWithTag("child-link.approve").assertIsEnabled()
        compose.waitForIdle(); captureChildAccountWindow("child-account-parent-window.png")
        compose.onNodeWithTag("child-link.approve").performClick()
        waitFor("child-link.approved"); assertEquals(1, gateway.approvals); assertEquals(target, gateway.target)
        assertEquals(0, gateway.creations)
    }
    private fun host(gateway: PairingUiFixture, selected: ChildAccountLinkTarget?) {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                Box(Modifier.width(320.dp)) { ChildAccountLinkDialog(if (selected == null) "child" else "parent", gateway, selected) {} }
            }
        }
    }
    private fun waitFor(tag: String) { compose.waitUntil(30_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() } }
}

private class PairingUiFixture : ChildAccountLinkGateway {
    var creations = 0; var approvals = 0; var target: ChildAccountLinkTarget? = null
    override suspend fun createCode(uid: String): ChildAccountLinkCode {
        creations++; check(uid == "child"); return ChildAccountLinkCode(uid, "a".repeat(32), System.currentTimeMillis() + 600_000)
    }
    override suspend fun approve(uid: String, target: ChildAccountLinkTarget, code: String): ChildAccountLinkReceipt {
        approvals++; check(uid == "parent" && code == "a".repeat(32)); this.target = target
        return ChildAccountLinkReceipt("child", target.childId, target.childInstanceId)
    }
}
