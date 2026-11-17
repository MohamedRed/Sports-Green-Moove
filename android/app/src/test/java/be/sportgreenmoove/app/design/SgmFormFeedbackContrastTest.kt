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
class SgmFormFeedbackContrastTest(private val label: String, private val foregroundArgb: Int,
    private val backgroundArgb: Int) {
    @Test fun formFeedbackRemainsReadable() {
        val background = Color(backgroundArgb)
        val foreground = Color(foregroundArgb).compositeOver(background).luminance().toDouble()
        val surface = background.luminance().toDouble()
        val ratio = (max(foreground, surface) + 0.05) / (min(foreground, surface) + 0.05)
        println("{\"case\":\"$label\",\"contrastRatio\":$ratio,\"minimum\":4.5}")
        assertTrue("$label: $ratio is below 4.5:1", ratio >= 4.5)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun cases(): Collection<Array<Any>> =
            listOf("light" to SgmLightColors, "dark" to SgmDarkColors).flatMap { (mode, palette) ->
                listOf("auth", "search", "chat-error", "chat-limit", "chat-sending").map { state ->
                    val foreground = if (state == "chat-sending") palette.textSecondary else palette.textError
                    arrayOf<Any>("$mode-$state", foreground.toArgb(), palette.bgApp.toArgb())
                }
            }
    }
}
