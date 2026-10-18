package be.sportgreenmoove.app.testing

internal object WindowFocusSnapshot {
    private val fields = setOf("mCurrentFocus", "mFocusedApp", "mInputMethodTarget",
        "mImeInputTarget", "mImeLayeringTarget", "mImeControlTarget")
    private val knownPackages = setOf("be.sportgreenmoove.app", "be.sportgreenmoove.app.test",
        "com.android.settings", "com.android.systemui", "com.google.android.apps.nexuslauncher",
        "com.google.android.gms", "com.android.inputmethod.latin", "com.google.android.inputmethod.latin")
    private val component = Regex("(?:^|\\s)([a-zA-Z_][a-zA-Z0-9_.]*)/[a-zA-Z_.$][a-zA-Z0-9_.$]*(?=\\s|}|$)")

    // Retain only allowlisted package identities, never window titles or editor data.
    fun sanitize(dump: String): List<String> = dump.lineSequence().mapNotNull { line ->
        val key = line.substringBefore('=').trim()
        if (key !in fields) return@mapNotNull null
        val value = line.substringAfter('=').trim()
        val state = when {
            value == "null" -> "none"
            value.startsWith("Window{") || value.startsWith("ActivityRecord{") -> {
                val owner = component.find(value)?.groupValues?.get(1)
                if (owner in knownPackages) "package:$owner" else "unrecognised-owner"
            }
            else -> "unrecognised-format"
        }
        "$key=$state"
    }.take(24).toList()
}
