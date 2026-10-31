package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.AppRole
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class PaymentConfirmationLayoutTest {
    @get:Rule val compose = createComposeRule()

    @Test fun pendingPaymentOffersOnlyReadOnlyVerificationOnANarrowScreen() {
        var payments = 0; var checks = 0
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                Box(Modifier.width(320.dp).testTag("payments.narrow")) {
                    PaymentsScreen(AppRole.Parent, listOf(UiFlowFixtures.payableBooking), true, {}, { payments++ }, {},
                        paymentPending = true, onVerifyPayment = { checks++ })
                }
            }
        }
        compose.onNodeWithTag("payments.verify").performScrollTo().assertIsEnabled().performClick()
        assertEquals(1, checks)
        compose.onNodeWithTag(SgmTestTags.PaymentAction).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Paiement confirmé.").assertDoesNotExist()
        val host = compose.onNodeWithTag("payments.narrow").fetchSemanticsNode().boundsInRoot
        for (tag in listOf("payments.verify", SgmTestTags.PaymentAction)) {
            val bounds = compose.onNodeWithTag(tag).performScrollTo().fetchSemanticsNode().boundsInRoot
            assertTrue("$tag must fit within the narrow screen", bounds.left >= host.left && bounds.right <= host.right)
        }
        compose.onNodeWithTag("payments.verify").performScrollTo()
        capture("payment-pending-narrow.png")
        assertEquals(0, payments)
    }

    @Test fun aStatusReadDisablesRepeatedChecks() {
        compose.setSgmUiTestContent {
            PaymentsScreen(AppRole.Parent, listOf(UiFlowFixtures.payableBooking), true, {}, {}, {},
                paymentPending = true, verificationBusy = true)
        }
        compose.onNodeWithTag("payments.verify").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.PaymentAction).performScrollTo().assertIsNotEnabled()
    }

    @Test fun anInconsistentRecordRemainsExplicitlyUnconfirmed() {
        compose.setSgmUiTestContent {
            PaymentsScreen(AppRole.Parent, listOf(UiFlowFixtures.payableBooking), true, {}, {}, {}, paymentPending = true,
                verificationMessage = "Le paiement reste à vérifier.", onVerifyPayment = {})
        }
        compose.onNodeWithText("Le paiement reste à vérifier.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Paiement confirmé.").assertDoesNotExist()
        capture("payment-review.png")
    }

    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        val window = name.removeSuffix(".png") + "-window.png"
        check(device.takeScreenshot(File(directory, window)))
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-payment-confirmation")
        for (file in listOf(name, window))
            device.executeShellCommand("cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$file /sdcard/Download/sgm-payment-confirmation/$file")
    }
}
