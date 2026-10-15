package be.sportgreenmoove.app.ui

import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

class LocalMultiSeatSdkTest {
    @Test fun nativeGatewayPersistsTheSelectedTwoSeats() = runBlocking {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        runtime.auth.signIn(session.getString("parent"), session.getString("password"))
        val booking = runtime.firebase.requestBooking(session.getString("multiSeatTripId"), "sgm-qa-child-lina", 2)
        assertTrue(booking.isNotBlank())
    }
}
