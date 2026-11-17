package be.sportgreenmoove.app.ui

import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.test.StandardTestDispatcher
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class ComposeNodeReadinessTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>(effectContext = StandardTestDispatcher())

    @Test fun absentCompositionStillFailsAtItsDeadline() {
        assertNoComposition()
        assertThrows(ComposeTimeoutException::class.java) {
            compose.waitForComposeNode(hasTestTag("missing-root"), 50)
        }
    }

    @Test fun aLaterCompositionMustContainTheRequestedNode() {
        assertNoComposition()
        val activity = compose.activity
        val handler = Handler(Looper.getMainLooper())
        val attach = Runnable { activity.setContent { Box(Modifier.size(24.dp).testTag("late-root")) } }
        handler.postDelayed(attach, 100)
        try {
            compose.waitForComposeNode(hasTestTag("late-root"), 60_000)
            compose.onNodeWithTag("late-root").assertExists()
        } finally {
            handler.removeCallbacks(attach)
        }
    }

    private fun assertNoComposition() {
        assertTrue(compose.onAllNodes(isRoot()).fetchSemanticsNodes(atLeastOneRootRequired = false).isEmpty())
    }
}
