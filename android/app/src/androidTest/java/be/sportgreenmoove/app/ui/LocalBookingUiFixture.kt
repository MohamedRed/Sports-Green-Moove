package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.Closeable
import java.io.File
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

internal class LocalBookingUiFixture private constructor(
    val session: JSONObject, val trip: TripSummary, val children: List<ChildSummary>,
    private val runtime: AndroidProviderSet, private val app: FirebaseApp,
    private val auth: FirebaseAuth, context: Context,
) : Closeable {
    val slot = BookingSlot("sgm-qa-parent", trip.id, "sgm-qa-child-lina")
    val storage = SharedPreferencesBookingOperations(context)
    val sendGate = CompletableDeferred<Unit>()
    val calls = AtomicInteger()
    val acknowledgedBookingId = AtomicReference<String?>()
    private val booking = FirebaseAndroidBookingGateway(context, FirebaseFunctions.getInstance(app), auth)
    val providers = runtime.copy(firebase = object : FirebaseGateway by runtime.firebase {
        override suspend fun resolvePlace(placeId: String): ResolvedPlace {
            val intent = checkNotNull(trip.bookingIntent)
            val point = if (placeId == "origin") intent.origin else intent.destination
            return ResolvedPlace(placeId, if (placeId == "origin") "Départ QA" else "Arrivée QA", "Adresse de test", point.lat, point.lng)
        }
        override suspend fun searchTripMatches(criteria: TripSearchCriteria) =
            listOf(TripMatchSummary(trip.id, 1.0, trip, emptyList(), null, null))
        override suspend fun requestBooking(trip: TripSummary, childId: String?, seats: Int): String {
            calls.incrementAndGet(); sendGate.await()
            return booking.requestBooking(trip, childId, seats).also { acknowledgedBookingId.set(it) }
        }
    })

    override fun close() { auth.signOut(); app.delete(); runtime.auth.signOut() }

    companion object {
        suspend fun open(context: Context): LocalBookingUiFixture {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
            check(context.packageName == "be.sportgreenmoove.app.local")
            check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
            val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
            check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
            val args = InstrumentationRegistry.getArguments()
            val port = checkNotNull(args.getString("bookingFaultPort")).toInt().also { check(it in 1024..65535) }
            val tripId = checkNotNull(args.getString("bookingFaultTripId"))
            val runtime = AndroidRuntime.create(context)
            runtime.auth.signIn(session.getString("parent"), session.getString("password"))
            val options = FirebaseApp.getInstance().options.also { check(it.projectId == "demo-sgm-local-qa") }
            val app = FirebaseApp.initializeApp(context, options, "booking-ui-loss-${UUID.randomUUID()}")
            val auth = FirebaseAuth.getInstance(app)
            try {
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099)
                FirebaseFunctions.getInstance(app).useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, port)
                auth.signInWithEmailAndPassword(session.getString("parent"), session.getString("password")).await()
                check(auth.currentUser?.uid == "sgm-qa-parent")
                val trip = runtime.firebase.searchTrips().single { it.id == tripId }
                return LocalBookingUiFixture(session, trip, runtime.firebase.listChildren(), runtime, app, auth, context)
            } catch (error: Throwable) { auth.signOut(); app.delete(); runtime.auth.signOut(); throw error }
        }
    }
}
