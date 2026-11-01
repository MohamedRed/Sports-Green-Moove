package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout

internal object AndroidTeamPushRuntime {
    @Volatile private var runtime: RegistrationRuntime? = null
    @Synchronized fun start(context: Context) {
        if (BuildConfig.SGM_USE_FIREBASE_EMULATOR || runtime != null || FirebaseApp.getApps(context).isEmpty()) return
        runtime = RegistrationRuntime(context.applicationContext).also { it.start() }
    }
    fun resumed(context: Context) { start(context); runtime?.request() }
    fun tokenRefreshed(context: Context) { start(context); runtime?.request(refresh = true) }
    fun beforeSignOut(context: Context) { start(context); runtime?.signOut() }
    fun afterSignOut(context: Context) { start(context); runtime?.accountChanged() }
}

private class RegistrationRuntime(private val context: Context) {
    private val auth = FirebaseAuth.getInstance()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val events = Channel<Unit>(Channel.CONFLATED)
    private var refreshRequired = true
    private val registration = FirebaseAndroidTeamPushRegistration(auth)
    private val tokens = firebaseTeamPushTokenSource()
    private val lifecycle = TeamPushLifecycle(androidTeamPushJournal(context), tokens,
        { auth.currentUser?.uid }, { uid ->
            val user = auth.currentUser
            if (user?.uid != uid) throw CancellationException("Team phone session changed")
            val claims = user.getIdToken(false).await().claims
            if (auth.currentUser?.uid != uid) throw CancellationException("Team phone session changed")
            teamPushAdultClaims(claims)
        }, registration::register)
    private val listener = FirebaseAuth.IdTokenListener { firebase: FirebaseAuth ->
        try { lifecycle.accountChanged(firebase.currentUser?.uid); request(refresh = true) }
        catch (_: Exception) { tokens.setAutoInit(false) }
    }
    fun start() {
        createTeamPushChannel(context)
        scope.launch {
            for (event in events) {
                val refresh = takeRefresh()
                try { withTimeout(20_000L) { lifecycle.synchronize(teamNotificationsAllowed(context), refresh) } }
                catch (_: CancellationException) { failed() }
                catch (_: Exception) { failed() }
            }
        }
        auth.addIdTokenListener(listener)
    }
    @Synchronized fun request(refresh: Boolean = false) { refreshRequired = refreshRequired || refresh; events.trySend(Unit) }
    @Synchronized private fun takeRefresh(): Boolean = refreshRequired.also { refreshRequired = false }
    @Synchronized private fun failed() {
        tokens.setAutoInit(false)
        refreshRequired = true
    }
    fun signOut() {
        try { lifecycle.signedOut(); request() }
        catch (_: Exception) { failed() }
    }
    fun accountChanged() {
        try { lifecycle.accountChanged(auth.currentUser?.uid); request(refresh = true) }
        catch (_: Exception) { failed() }
    }
}
