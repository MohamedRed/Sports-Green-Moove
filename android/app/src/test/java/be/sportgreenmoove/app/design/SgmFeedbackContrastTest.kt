package be.sportgreenmoove.app.design

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import kotlin.math.max
import kotlin.math.min

@RunWith(Parameterized::class)
class SgmFeedbackContrastTest(private val label: String, private val foregroundArgb: Int,
    private val backgroundArgb: Int, private val minimum: Double) {
    @Test fun feedbackRemainsReadable() {
        val background = Color(backgroundArgb)
        val first = Color(foregroundArgb).compositeOver(background).luminance().toDouble()
        val second = background.luminance().toDouble()
        val ratio = (max(first, second) + 0.05) / (min(first, second) + 0.05)
        println("{\"case\":\"$label\",\"minimum\":$minimum,\"contrastRatio\":$ratio}")
        assertTrue("$label: $ratio is below $minimum:1", ratio >= minimum)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun cases(): Collection<Array<Any>> =
            listOf("light" to SgmLightColors, "dark" to SgmDarkColors).flatMap { (mode, palette) ->
                val staleCard = SgmColor.Orange.copy(alpha = 0.12f).compositeOver(palette.bgApp)
                val livePill = SgmColor.Green.copy(alpha = 0.16f).compositeOver(palette.bgCard)
                val stalePill = SgmColor.Orange.copy(alpha = 0.16f).compositeOver(staleCard)
                listOf(
                    arrayOf<Any>("$mode-runtime-info", palette.textAccent.toArgb(), palette.bgCard.toArgb(), 4.5),
                    arrayOf<Any>("$mode-runtime-warning", palette.textWarning.toArgb(), palette.bgCard.toArgb(), 4.5),
                    arrayOf<Any>("$mode-live-pill", palette.textAccent.toArgb(), livePill.toArgb(), 4.5),
                    arrayOf<Any>("$mode-stale-pill", palette.textWarning.toArgb(), stalePill.toArgb(), 4.5),
                    arrayOf<Any>("$mode-stale-entry-heading", palette.textWarning.toArgb(), staleCard.toArgb(), 4.5),
                    arrayOf<Any>("$mode-stale-entry-update", palette.textWarning.toArgb(), staleCard.toArgb(), 4.5),
                    arrayOf<Any>("$mode-stale-monitor-warning", palette.textWarning.toArgb(), staleCard.toArgb(), 4.5),
                    arrayOf<Any>("$mode-review-error", palette.textError.toArgb(), palette.bgCard.toArgb(), 4.5),
                    arrayOf<Any>("$mode-rating-action", palette.textWarning.toArgb(), palette.bgCard.toArgb(), 3.0),
                    arrayOf<Any>("$mode-on-material-error", (if (mode == "light") SgmColor.TextOnGreen else SgmColor.TextOnAccent).toArgb(), palette.textError.toArgb(), 4.5),
                ) + mapOf("app" to palette.bgApp, "surface" to palette.bgSurface,
                    "card" to palette.bgCard, "elevated" to palette.bgElevated, "input" to palette.bgInput).map { (name, background) ->
                    arrayOf<Any>("$mode-material-error-$name", palette.textError.toArgb(), background.toArgb(), 4.5)
                }
            }
    }
}
