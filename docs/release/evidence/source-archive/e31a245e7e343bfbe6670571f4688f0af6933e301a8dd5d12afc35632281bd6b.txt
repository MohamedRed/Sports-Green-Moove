package be.sportgreenmoove.app.ui

import android.content.Context
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.util.UUID

internal suspend fun sendLocalPeerReply(context: Context, session: JSONObject, body: String) {
    check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
    check(session.getString("projectId") == "demo-sgm-local-qa")
    val options = FirebaseApp.getInstance().options
    check(options.projectId == "demo-sgm-local-qa")
    val app = FirebaseApp.initializeApp(context, options, "local-chat-peer-${UUID.randomUUID()}")
    val auth = FirebaseAuth.getInstance(app)
    val functions = FirebaseFunctions.getInstance(app)
    auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099)
    functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
    try {
        auth.signInWithEmailAndPassword(session.getString("driver"), session.getString("password")).await()
        functions.getHttpsCallable("sendChatMessage").call(mapOf(
            "bookingId" to "sgm-qa-booking-approved", "body" to body,
            "clientMessageId" to UUID.randomUUID().toString(),
        )).await()
    } finally {
        auth.signOut()
        app.delete()
    }
}
