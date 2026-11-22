package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AppRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class PaymentsConnectLayoutTest {
    @get:Rule val compose = createComposeRule()

    @Test fun openingDisablesTheAccountActionAndBlocksRepeatedTaps() {
        val loading = mutableStateOf(false)
        var starts = 0
        compose.setSgmUiTestContent {
            PaymentsScreen(AppRole.Driver, emptyList(), loading.value, {}, {}, {
                starts++; loading.value = true
            })
        }
        compose.onNodeWithTag(SgmTestTags.PaymentConnectAction).performScrollTo().performClick()
        compose.onNodeWithTag(SgmTestTags.PaymentConnectAction).assertIsNotEnabled().performClick()
        compose.runOnIdle { assertEquals(1, starts) }
        captureLocalUi(compose, "connect-opening.png")
    }

    @Test fun theAccountActionFitsANarrowScreenWithLargerText() {
        var starts = 0
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                Box(Modifier.width(320.dp).testTag("connect.narrow")) {
                    PaymentsScreen(AppRole.Driver, emptyList(), false, {}, {}, { starts++ })
                }
            }
        }
        val action = compose.onNodeWithTag(SgmTestTags.PaymentConnectAction).performScrollTo().assertIsEnabled()
        val host = compose.onNodeWithTag("connect.narrow").fetchSemanticsNode().boundsInRoot
        val bounds = action.fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= host.left && bounds.right <= host.right)
        assertMeasuredTextFits(reportedTextLayout(action))
        action.performClick(); compose.runOnIdle { assertEquals(1, starts) }
        captureLocalUi(compose, "connect-narrow.png")
    }

    @Test fun wrappedCommandsRetainTheirWholeTextInsteadOfClippingTheSecondLine() {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                Box(Modifier.width(180.dp)) {
                    V2Button("Continuer l’inscription", {}, full = true, size = V2ButtonSize.Sm, testTag = "connect.wrapped")
                }
            }
        }
        val layout = assertMeasuredTextFits(reportedTextLayout(compose.onNodeWithTag("connect.wrapped")))
        assertTrue("This case must exercise a wrapped label", layout.lineCount > 1)
    }

    @Test fun parentPaymentScreensDoNotOfferDriverAccountCreation() {
        compose.setSgmUiTestContent { PaymentsScreen(AppRole.Parent, emptyList(), false, {}, {}, {}) }
        compose.onNodeWithTag(SgmTestTags.PaymentConnectAction).assertDoesNotExist()
    }
}
