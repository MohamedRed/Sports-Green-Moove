package be.sportgreenmoove.app.ui

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.regex.Pattern

internal class LocalRideEmergencyUi(private val compose: ComposeTestRule, private val providers: AndroidProviderSet,
    private val runId: String, private val trackingRunning: () -> Boolean) {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val device = UiDevice.getInstance(instrumentation)

    fun verify(role: String, phone: String, otherPhone: String, expected: LiveRideSnapshot): JSONObject {
        check(role in setOf("driver", "parent")); check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val uid = "sgm-qa-$role"
        check(runBlocking { providers.auth.currentSession() }?.uid == uid)
        assertTracking(role, "entry")
        val initial = runBlocking { providers.emergencyContacts.readEmergencyContact(uid, EmergencyContactTarget.Self) }
        check(initial.contact == null && initial.revision == 0L)
        unchangedRide(expected); assertRidePermissions(role)
        compose.onNodeWithTag(SgmTestTags.EmergencyContact).performScrollTo().assertIsEnabled()
        captureLocalUi(compose, filename(role, "entry")); click(SgmTestTags.EmergencyContact)
        waitFor(hasTestTag("emergency.empty")); compose.onNodeWithText(otherPhone).assertDoesNotExist()
        val name = if (role == "driver") "Contact conducteur QA" else "Contact parent QA"
        compose.onNodeWithTag("emergency.name").performScrollTo().performTextReplacement(name)
        compose.onNodeWithTag("emergency.phone").performScrollTo().performTextReplacement(phone)
        click("emergency.save"); waitFor(hasTestTag("emergency.dial") and isEnabled())
        compose.onNodeWithTag("emergency.phone").performScrollTo().assertTextContains(phone)
        val saved = runBlocking { providers.emergencyContacts.readEmergencyContact(uid, EmergencyContactTarget.Self) }
        check(saved.revision == 1L && saved.contact?.phone == phone)
        captureLocalUi(compose, filename(role, "saved"))
        val dial = openPhone(role, phone)
        waitFor(hasTestTag("emergency.dial") and isEnabled())
        compose.onNodeWithTag("emergency.phone").performScrollTo().assertTextContains(phone)
        click("emergency.remove"); click("emergency.confirm", dialog = true)
        waitFor(hasTestTag("emergency.empty"))
        val removed = runBlocking { providers.emergencyContacts.readEmergencyContact(uid, EmergencyContactTarget.Self) }
        check(removed.contact == null && removed.revision == 2L)
        click(SgmTestTags.BackAction); waitFor(hasTestTag(SgmTestTags.ActiveRideScreen))
        unchangedRide(expected); assertRidePermissions(role)
        assertTracking(role, "returned")
        compose.onNodeWithTag(SgmTestTags.EmergencyContact).performScrollTo().assertIsEnabled()
        captureLocalUi(compose, filename(role, "returned"))
        return dial.put("role", role).put("ownerUid", uid).put("rideSessionId", expected.rideSessionId)
            .put("tripId", expected.tripId).put("returnedToSameRide", true).put("passengerStatusesUnchanged", true)
            .put("contactSavedRevision", saved.revision).put("contactRemovedRevision", removed.revision)
            .put("contactChosenThroughUi", true).put("foreignContactVisible", false).put("driverControlsAvailable", role == "driver")
    }

    fun assertTracking(role: String, phase: String): Boolean {
        check(role in setOf("driver", "parent") && phase in setOf("entry", "returned", "resumed"))
        val expected = role == "driver"
        val result = runCatching { compose.waitUntil(15_000) { trackingRunning() == expected } }
        val observed = trackingRunning()
        val diagnostic = JSONObject().put("scope", "active-ride-tracking-account-observation-not-flow-proof")
            .put("runId", runId).put("role", role).put("phase", phase)
            .put("authenticatedUid", runBlocking { providers.auth.currentSession() }?.uid)
            .put("expectedRunning", expected).put("observedRunning", observed)
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence"); check(directory.isDirectory || directory.mkdirs())
        val file = File(directory, "local-ride-emergency-$role-$phase-tracking.json"); check(!file.exists())
        file.writeText(diagnostic.toString(2)); result.getOrThrow(); check(observed == expected)
        return observed
    }

    private fun openPhone(role: String, phone: String): JSONObject {
        val resolved = device.executeShellCommand("cmd package resolve-activity --brief -a android.intent.action.DIAL -d tel:$phone")
            .trim().lineSequence().last()
        val packageName = resolved.substringBefore('/')
        check(resolved.contains('/') && Regex("[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+").matches(packageName))
        check(packageName != context.packageName)
        val dial = instrumentation.addMonitor(IntentFilter(Intent.ACTION_DIAL).apply { addDataScheme("tel") }, null, false)
        val direct = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CALL).apply { addDataScheme("tel") }, null, false)
        try {
            click("emergency.dial")
            awaitLocalExternalUi(compose, 60_000, { device.hasObject(By.pkg(packageName)) }) { appeared ->
                val diagnostic = JSONObject().put("scope", "ride-emergency-dialer-attempt-not-completed-flow")
                    .put("role", role).put("expectedPackageAppeared", appeared).put("observedPackage", device.currentPackageName)
                    .put("dialIntentCount", dial.hits).put("directCallIntentCount", direct.hits)
                val file = File(context.getExternalFilesDir(null), "local-ui-evidence/local-ride-emergency-$role-attempt.json")
                check(!file.exists()); file.writeText(diagnostic.toString(2))
            }
            check(device.currentPackageName == packageName)
            val numberMatched = device.findObjects(By.text(Pattern.compile(".*555.*")))
                .any { it.text.orEmpty().filter(Char::isDigit) == phone.filter(Char::isDigit) }
            check(numberMatched && dial.hits == 1 && direct.hits == 0)
            captureEmergencyDialer(context, device, filename(role, "dialer"))
            repeat(3) {
                if (device.currentPackageName != context.packageName) {
                    check(device.currentPackageName == packageName); device.pressBack(); device.waitForIdle()
                }
            }
            check(device.currentPackageName == context.packageName)
            check(dial.hits == 1 && direct.hits == 0)
            return JSONObject().put("dialerPackage", packageName).put("dialIntentCount", dial.hits)
                .put("directCallIntentCount", direct.hits).put("dialerNumberMatched", numberMatched)
        } finally { instrumentation.removeMonitor(dial); instrumentation.removeMonitor(direct) }
    }

    private fun unchangedRide(expected: LiveRideSnapshot) {
        val current = runBlocking { providers.firebase.getActiveRide() } ?: error("Active ride disappeared")
        check(current.rideSessionId == expected.rideSessionId && current.tripId == expected.tripId && current.driverUserId == expected.driverUserId)
        check(current.status == expected.status && current.passengers.sortedBy { it.bookingId } == expected.passengers.sortedBy { it.bookingId })
    }
    private fun assertRidePermissions(role: String) {
        waitFor(hasTestTag(SgmTestTags.ActiveRideVehicleUpdate))
        if (role == "driver") {
            check(compose.onAllNodesWithTag(SgmTestTags.ActiveRidePickupAction).fetchSemanticsNodes().size == 2)
            compose.onAllNodesWithTag(SgmTestTags.ActiveRidePickupAction)[0].performScrollTo().assertIsEnabled()
            compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).performScrollTo().assertIsNotEnabled()
        } else {
            compose.onNodeWithTag(SgmTestTags.ActiveRidePickupAction).assertDoesNotExist()
            compose.onNodeWithTag(SgmTestTags.ActiveRideDropoffAction).assertDoesNotExist()
            compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).assertDoesNotExist()
        }
    }
    private fun filename(role: String, phase: String) = "local-ride-emergency-$role-$phase.png"
    private fun click(tag: String, dialog: Boolean = false) {
        waitFor(hasTestTag(tag) and isEnabled()); val node = compose.onNodeWithTag(tag)
        if (!dialog) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
}

internal fun writeRideEmergencyEvidence(context: Context, runId: String, results: List<JSONObject>, driverResumedTracking: Boolean) {
    check(Regex("[a-f0-9]{32}").matches(runId)); check(results.map { it.getString("role") } == listOf("driver", "parent"))
    check(results.map { it.getString("rideSessionId") }.toSet().size == 1)
    check(driverResumedTracking)
    val directory = File(context.getExternalFilesDir(null), "local-ui-evidence"); val hashes = JSONObject()
    for (role in listOf("driver", "parent")) for (phase in listOf("entry", "saved", "dialer", "returned")) {
        val filename = "local-ride-emergency-$role-$phase.png"; val bytes = File(directory, filename).readBytes()
        hashes.put(filename, MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) })
    }
    val file = File(directory, "local-ride-emergency-device.json"); check(!file.exists())
    file.writeText(JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", runId)
        .put("scope", "local-native-active-ride-emergency-not-physical").put("actors", JSONArray(results))
        .put("screenshots", hashes).put("driverResumedTracking", driverResumedTracking)
        .put("physicalDevice", false).put("productionWrites", false).toString(2))
}
