package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmDarkColors
import be.sportgreenmoove.app.design.SgmLightColors
import be.sportgreenmoove.app.design.SgmTheme
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import kotlin.math.max
import kotlin.math.min

@RunWith(Parameterized::class)
class BookingDateLayoutTest(private val name: String, private val screen: String, private val kind: String,
    private val dark: Boolean, private val width: Int, private val height: Int, private val density: Float) {
    @get:Rule val compose = createComposeRule()

    @Test fun bookingDateIsCompleteAndReadable() {
        assumeTrue(BuildConfig.DEBUG)
        check(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            .executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val date = if (kind == "scheduled") "MER 18 NOV." else "DATE À CONFIRMER"
        val time = if (kind == "scheduled") "18h45" else "--h--"
        val label = "$date · $time" + if (screen == "payments") " · 2 places" else ""
        compose.setContent {
            SgmTheme(darkTheme = dark) {
                V2ThemeToggleProvider(darkTheme = dark, onToggle = {}) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CompositionLocalProvider(LocalDensity provides Density(density, fontScale = 1.3f)) {
                            Box(Modifier.requiredSize(width.dp, height.dp).sgmTestTag("booking-date.viewport")) {
                                when (screen) {
                                    "requests" -> V2Screen {
                                        val item = UiFlowFixtures.reservation.copy(booking = UiFlowFixtures.bookingRequest
                                            .copy(dateLabel = date, timeLabel = time, seats = 2))
                                        BookingRequestsList(listOf(item), false, onDecision = { _, _ -> })
                                    }
                                    "trips" -> V2Screen {
                                        TripsCard(UiFlowFixtures.trip.copy(dateLabel = date, timeLabel = time), {}, null)
                                    }
                                    "payments" -> PaymentsScreen(AppRole.Parent, listOf(UiFlowFixtures.payableBooking
                                        .copy(dateLabel = date, timeLabel = time, seats = 2, amountCents = 800,
                                            amountLabel = "8,00 EUR")), false, {}, {}, {})
                                }
                            }
                        }
                    }
                }
            }
        }
        val node = compose.onNodeWithText(label, useUnmergedTree = true).performScrollTo().assertIsDisplayed()
        val reported = reportedTextLayout(node)
        check(reported.layoutInput.text.text == label) { "$name: unexpected date label" }
        val metrics = JSONObject().put("case", name).put("reportedWidthPx", reported.size.width)
            .put("reportedHeightPx", reported.size.height).put("reportedParagraphWidthPx", reported.multiParagraph.width)
            .put("reportedParagraphHeightPx", reported.multiParagraph.height)
            .put("reportedWidthOverflow", reported.didOverflowWidth).put("reportedHeightOverflow", reported.didOverflowHeight)
        println("SGM_BOOKING_DATE_REPORTED $metrics")
        val measured = assertMeasuredTextFits(reported)
        metrics.put("measuredParagraphWidthPx", measured.width).put("measuredParagraphHeightPx", measured.height)
            .put("measuredLineCount", measured.lineCount).put("measuredLastLineEnd", measured.getLineEnd(measured.lineCount - 1))
        val bounds = node.fetchSemanticsNode().boundsInRoot
        val viewport = compose.onNodeWithTag("booking-date.viewport").fetchSemanticsNode().boundsInRoot
        check(bounds.width > 0 && bounds.height > 0 && bounds.left >= viewport.left && bounds.right <= viewport.right &&
            bounds.top >= viewport.top && bounds.bottom <= viewport.bottom) { "$name: date outside viewport: $bounds / $viewport" }
        val palette = if (dark) SgmDarkColors else SgmLightColors
        val background = if (screen == "trips") SgmColor.HeroStart else palette.bgCard
        val color = reported.layoutInput.style.color
        check(color != Color.Unspecified) { "$name: date foreground must be explicit" }
        val first = color.compositeOver(background).luminance().toDouble()
        val second = background.luminance().toDouble()
        val contrast = (max(first, second) + 0.05) / (min(first, second) + 0.05)
        check(contrast >= 4.5) { "$name: date contrast $contrast below 4.5:1" }
        captureBookingDateViewport(compose, name, screen, kind, dark, width, height, density,
            metrics.put("dateLabel", label).put("boundsInRoot", bounds.toString())
                .put("layoutCount", 1).put("measuredTextFits", true).put("contrastRatio", contrast))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun cases(): Collection<Array<Any>> =
            listOf("requests", "trips", "payments").flatMap { screen -> listOf("scheduled", "unknown").flatMap { kind ->
                listOf(false, true).flatMap { dark -> listOf(
                    arrayOf<Any>("$screen-$kind-${if (dark) "dark" else "light"}-phone", screen, kind, dark, 320, 700, 3f),
                    arrayOf<Any>("$screen-$kind-${if (dark) "dark" else "light"}-wide", screen, kind, dark, 900, 600, 1f)) }
            } }
    }
}
