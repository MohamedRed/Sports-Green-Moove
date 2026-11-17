package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import org.junit.Assert.assertTrue
import java.io.File
import java.security.MessageDigest

internal class LocalTeamChatUi(private val compose: ComposeTestRule) {
    fun login(session: JSONObject, role: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction))
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString(role))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    fun open(fixture: JSONObject) {
        click(SgmTestTags.BottomNavMessagesAction); click("team-chat.tab")
        assertTrue(findChoice(fixture.getString("clubId"))); click("team-chat.choice.${fixture.getString("clubId")}")
        openTeam(fixture.getString("teamId"))
    }
    fun openTeam(id: String) {
        assertTrue(findChoice(id)); click("team-chat.choice.$id")
        waitFor(hasTestTag(SgmTestTags.ChatMessageInput) and isEnabled())
    }
    fun findChoice(id: String): Boolean {
        repeat(30) {
            compose.waitUntil(60_000) {
                compose.onAllNodesWithText("Chargement...").fetchSemanticsNodes().isEmpty() &&
                    (compose.onAllNodes(SemanticsMatcher("team choices") {
                        it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("team-chat.choice.") == true
                    }).fetchSemanticsNodes().isNotEmpty() ||
                        compose.onAllNodesWithTag("team-chat.choices-more").fetchSemanticsNodes().isNotEmpty() ||
                        listOf("Aucun club disponible.", "Aucune équipe approuvée.").any { label ->
                            compose.onAllNodesWithText(label).fetchSemanticsNodes().isNotEmpty() })
            }
            if (compose.onAllNodesWithTag("team-chat.choice.$id").fetchSemanticsNodes().isNotEmpty()) return true
            if (compose.onAllNodesWithTag("team-chat.choices-more").fetchSemanticsNodes().isEmpty()) return false
            click("team-chat.choices-more")
        }
        error("Team directory did not terminate")
    }
    fun inputText() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    fun send(body: String) {
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput(body); click(SgmTestTags.ChatSendAction)
        compose.waitUntil(60_000) { inputText().isEmpty() }; waitFor(hasText(body))
    }
    fun capture(stem: String) {
        captureLocalUi(compose, "$stem.png")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val file = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence/$stem-window.png")
        check(UiDevice.getInstance(instrumentation).takeScreenshot(file))
    }
    fun hashes(stems: List<String>): JSONObject {
        val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "local-ui-evidence")
        return JSONObject().apply {
            for (stem in stems) for (suffix in listOf(".png", "-window.png")) {
                val name = stem + suffix
                put(name, MessageDigest.getInstance("SHA-256").digest(File(directory, name).readBytes()).joinToString("") { "%02x".format(it) })
            }
        }
    }
    fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); compose.onNodeWithTag(tag).performClick()
    }
    fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
    fun absent(vararg bodies: String) {
        compose.waitUntil(60_000) { bodies.all { compose.onAllNodesWithText(it).fetchSemanticsNodes().isEmpty() } }
        for (body in bodies) compose.onNodeWithText(body).assertDoesNotExist()
    }
}
