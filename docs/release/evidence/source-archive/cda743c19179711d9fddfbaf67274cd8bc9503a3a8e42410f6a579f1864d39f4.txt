package be.sportgreenmoove.app.ui

import android.os.Process
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.BookingSlot
import be.sportgreenmoove.app.services.FirebaseAndroidBookingGateway
import be.sportgreenmoove.app.services.SharedPreferencesBookingOperations
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.util.UUID

class LocalBookingResponseLossTest {
    @Test fun prepareUnconfirmedBooking() = stage(false)
    @Test fun recoverUnconfirmedBooking() = stage(true)

    private fun stage(recover: Boolean) = runBlocking {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        val args = InstrumentationRegistry.getArguments()
        val port = requireNotNull(args.getString("bookingFaultPort")).toInt().also { check(it in 1024..65535) }
        val tripId = requireNotNull(args.getString("bookingFaultTripId"))
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signIn(session.getString("parent"), session.getString("password"))
        val options = FirebaseApp.getInstance().options.also { check(it.projectId == "demo-sgm-local-qa") }
        val app = FirebaseApp.initializeApp(context, options, "booking-loss-${UUID.randomUUID()}")
        val auth = FirebaseAuth.getInstance(app); val functions = FirebaseFunctions.getInstance(app)
        auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099)
        functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, port)
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
        val slot = BookingSlot("sgm-qa-parent", tripId, "sgm-qa-child-lina")
        val storage = SharedPreferencesBookingOperations(context)
        try {
            auth.signInWithEmailAndPassword(session.getString("parent"), session.getString("password")).await()
            assertEquals(slot.uid, auth.currentUser?.uid)
            val trip = runtime.firebase.searchTrips().single { it.id == tripId }
            val gateway = FirebaseAndroidBookingGateway(context, functions, auth)
            if (!recover) {
                assertNull(storage.read(slot))
                val error = runCatching { gateway.requestBooking(trip, slot.childId, 2) }.exceptionOrNull()
                assertNotNull("The independently committed response must be lost", error)
                val pending = checkNotNull(storage.read(slot))
                val before = JSONObject().put("runId", session.getString("runId")).put("projectId", options.projectId)
                    .put("scope", "native-sdk-booking-response-loss-not-ui").put("tripId", tripId)
                    .put("processId", Process.myPid()).put("clientRequestId", pending.requestId)
                    .put("replyUnconfirmed", true).put("pendingIdentityPersisted", true)
                File(directory, "local-booking-loss-before.json").writeText(before.toString(2))
            } else {
                val before = JSONObject(File(directory, "local-booking-loss-before.json").readText())
                assertEquals(session.getString("runId"), before.getString("runId"))
                assertEquals(tripId, before.getString("tripId"))
                assertNotEquals(before.getInt("processId"), Process.myPid())
                assertEquals(before.getString("clientRequestId"), storage.read(slot)?.requestId)
                val bookingId = gateway.requestBooking(trip, slot.childId, 2)
                assertTrue(bookingId.isNotBlank()); assertNull(storage.read(slot))
                val after = JSONObject().put("runId", session.getString("runId")).put("projectId", options.projectId)
                    .put("scope", "native-sdk-booking-response-loss-not-ui").put("tripId", tripId)
                    .put("processId", Process.myPid()).put("previousProcessId", before.getInt("processId"))
                    .put("clientRequestId", before.getString("clientRequestId")).put("bookingId", bookingId)
                    .put("pendingClearedAfterAcknowledgement", true).put("completed", true)
                File(directory, "local-booking-loss-after.json").writeText(after.toString(2))
            }
        } finally {
            auth.signOut(); app.delete(); runtime.auth.signOut()
        }
    }
}
