package be.sportgreenmoove.app.testing

import org.junit.Assert.*
import org.junit.Test

class WindowFocusSnapshotTest {
    @Test fun retainsOnlyKnownWindowOwnersAndNoTitlesOrEditorText() {
        val dump = """
            mCurrentFocus=Window{abc u0 com.android.settings/.FallbackHome}
            mFocusedApp=ActivityRecord{def u0 be.sportgreenmoove.app/androidx.activity.ComponentActivity t12}
            mImeInputTarget=Window{abc u0 be.sportgreenmoove.app/.MainActivity}
            mInputMethodTarget=null
            mEditorInfo=private@example.com
            mWindowTitle=tel:+32470123456
        """.trimIndent()
        assertEquals(listOf("mCurrentFocus=package:com.android.settings",
            "mFocusedApp=package:be.sportgreenmoove.app", "mImeInputTarget=package:be.sportgreenmoove.app",
            "mInputMethodTarget=none"), WindowFocusSnapshot.sanitize(dump))
    }

    @Test fun unknownApplicationsAndArbitraryTitlesAreRedactedRatherThanEchoed() {
        for (value in listOf("Window{abc u0 private.app/.Secret}", "Window{abc u0 private@example.com}",
            "Window{abc u0 secret-token}", "private title", "null private text")) {
            val result = WindowFocusSnapshot.sanitize("mCurrentFocus=$value")
            assertEquals(1, result.size)
            assertTrue(result.single() in listOf("mCurrentFocus=unrecognised-owner", "mCurrentFocus=unrecognised-format"))
        }
        assertEquals(emptyList<String>(), WindowFocusSnapshot.sanitize("private input\nmCurrentFocus private"))
    }

    @Test fun boundsTheNumberOfSanitizedObservationsAndDoesNotAcceptPackagePrefixes() {
        assertEquals(24, WindowFocusSnapshot.sanitize((1..100).joinToString("\n") { "mCurrentFocus=null" }).size)
        assertEquals(listOf("mCurrentFocus=unrecognised-owner"), WindowFocusSnapshot.sanitize(
            "mCurrentFocus=Window{abc u0 be.sportgreenmoove.app.attacker/.Main}"))
    }
}
