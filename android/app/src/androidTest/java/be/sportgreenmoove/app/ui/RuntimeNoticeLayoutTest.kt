package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class RuntimeNoticeLayoutTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun messagesReserveSpaceAndRemainDismissible() {
        var notice by mutableStateOf<String?>("Course terminée")
        compose.setSgmUiTestContent {
            SportsGreenMooveScaffold(currentScreen = AppScreen.Impact, onNavigate = {},
                notice = notice, onDismissMessage = { notice = null }) { padding ->
                Box(Modifier.fillMaxSize().padding(padding)) { Text("Mon impact") }
            }
        }
        val banner = compose.onNodeWithText("Course terminée").fetchSemanticsNode().boundsInRoot
        val title = compose.onNodeWithText("Mon impact").fetchSemanticsNode().boundsInRoot
        assertTrue("Feedback must not obscure the screen heading", banner.bottom <= title.top)
        compose.onNodeWithText("Course terminée").performClick()
        compose.onNodeWithText("Course terminée").assertDoesNotExist()
        compose.onNodeWithText("Mon impact").assertExists()
    }

    @Test
    fun errorsTakePriorityOverAnOlderSuccessMessage() {
        compose.setSgmUiTestContent {
            RuntimeNoticeHost(notice = "Ancien succès", error = "Action impossible", onDismiss = {})
        }
        compose.onNodeWithText("Action impossible").assertExists()
        compose.onNodeWithText("Ancien succès").assertDoesNotExist()
    }
}
