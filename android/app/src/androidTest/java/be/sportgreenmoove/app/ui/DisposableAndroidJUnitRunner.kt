package be.sportgreenmoove.app.ui

import android.app.Activity
import android.os.Bundle
import android.os.ParcelFileDescriptor
import androidx.test.runner.AndroidJUnitRunner

/** Only the explicitly approved disposable CI run may change the test phone policy. */
class DisposableAndroidJUnitRunner : AndroidJUnitRunner() {
    private var blockInstallations = false

    override fun onCreate(arguments: Bundle) {
        val selected = arguments.getString("sgmBlockInstallations")
        require(selected == null || selected == "true")
        blockInstallations = selected == "true"
        super.onCreate(arguments)
    }

    override fun onStart() {
        if (blockInstallations) {
            var stage = "emulator identity"
            try {
                check(shell("getprop ro.kernel.qemu") == "1")
                check(shell("getprop ro.build.version.sdk") == "35")
                check(shell("am get-current-user") == "0")
                stage = "readable installation policy"
                check(shell("pm get-user-restriction --user 0 no_install_apps") in setOf("true", "false"))
                stage = "test administrator confirmation"
                val confirmation = shell("am broadcast --user 0 --receiver-foreground --include-stopped-packages " +
                    "-n be.sportgreenmoove.qa.installguard/.InstallationPolicyReceiver " +
                    "-a be.sportgreenmoove.qa.installguard.SET_BLOCKED --ez blocked true")
                check(confirmation.contains("Broadcast completed: result=-1, data=\"SGM_INSTALL_BLOCKED=true\""))
                stage = "applied installation policy"
                check(shell("pm get-user-restriction --user 0 no_install_apps") == "true")
                sendStatus(0, Bundle().apply { putString("sgm_installations_blocked", "true") })
            } catch (_: Exception) {
                finish(Activity.RESULT_CANCELED, Bundle().apply {
                    putString("shortMsg", "Disposable installation guard failed ($stage); no tests were started")
                })
                return
            }
        }
        // The host owns the original policy snapshot and restores it, even after a test-process crash.
        super.onStart()
    }

    private fun shell(command: String): String {
        // UiAutomation uses Runtime.exec, not a command interpreter. Responses are checked at each call site.
        require(command.none { it in setOf(';', '|', '&', '$', '`', '\n', '\r') })
        return ParcelFileDescriptor.AutoCloseInputStream(
            uiAutomation.executeShellCommand(command)
        ).bufferedReader().use { it.readText() }.trim()
    }
}
