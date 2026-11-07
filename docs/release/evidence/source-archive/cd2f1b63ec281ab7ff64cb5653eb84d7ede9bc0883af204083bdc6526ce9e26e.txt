package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.SgmTheme
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class BookingDateMeasurementTest {
    @get:Rule val compose = createComposeRule()

    @Test fun completeWrappedDateKeepsEveryCharacter() {
        host()
        val measured = assertMeasuredTextFits(reportedTextLayout(compose.onNodeWithTag("date.measurement")))
        assertTrue(measured.lineCount > 1)
    }

    @Test fun verticallyClippedDateIsRejected() {
        host(clippedHeight = true)
        assertThrows(AssertionError::class.java) {
            assertMeasuredTextFits(reportedTextLayout(compose.onNodeWithTag("date.measurement")))
        }
    }

    @Test fun ellipsizedDateIsRejected() {
        host(ellipsized = true)
        assertThrows(AssertionError::class.java) {
            assertMeasuredTextFits(reportedTextLayout(compose.onNodeWithTag("date.measurement")))
        }
    }

    @Test fun nonWrappingOverflowIsRejected() {
        host(wrap = false)
        assertThrows(AssertionError::class.java) {
            assertMeasuredTextFits(reportedTextLayout(compose.onNodeWithTag("date.measurement")))
        }
    }

    private fun host(clippedHeight: Boolean = false, ellipsized: Boolean = false, wrap: Boolean = true) {
        compose.setContent {
            SgmTheme(darkTheme = false) {
                Box(Modifier.width(80.dp)) {
                    Text("DATE À CONFIRMER · 18h45", fontSize = 20.sp,
                        modifier = (if (clippedHeight) Modifier.height(1.dp) else Modifier).sgmTestTag("date.measurement"),
                        softWrap = wrap, maxLines = if (ellipsized) 1 else Int.MAX_VALUE,
                        overflow = if (ellipsized) TextOverflow.Ellipsis else TextOverflow.Clip)
                }
            }
        }
    }
}
