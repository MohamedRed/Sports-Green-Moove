package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
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
    fun requiresSignOut(context: Context, uid: String): Boolean {
        if (BuildConfig.SGM_USE_FIREBASE_EMULATOR) return false
        start(context); return checkNotNull(runtime).requiresSignOut(uid)
    }
    fun authorizeSignIn(context: Context, uid: String) {
        if (BuildConfig.SGM_USE_FIREBASE_EMULATOR) return
        start(context); checkNotNull(runtime).authorizeSignIn(uid)
    }
    suspend fun prepareSignOut(context: Context): SessionExitResult {
        if (BuildConfig.SGM_USE_FIREBASE_EMULATOR) return SessionExitResult.NoRegistration
        start(context)
        return checkNotNull(runtime).prepareSignOut()
    }
    fun afterSignOut(context: Context) { start(context); runtime?.accountChanged() }
    fun received(context: Context, data: Map<String, String>) {
        if (data.keys != setOf("type", "notificationId") || data["type"] != "teamMessage") return
        val id = data["notificationId"]?.takeIf { runCatching { teamPushAlertId(it) }.isSuccess } ?: return
        start(context); runtime?.enqueue(id)
    }
    suspend fun displayAlert(context: Context, request: TeamPushOpenRequest): Boolean {
        if (BuildConfig.SGM_USE_FIREBASE_EMULATOR) return false
        start(context); return checkNotNull(runtime).resolve(request, TeamPushAlertPurpose.Display) { postTeamPushNotification(context, request) }
    }
    suspend fun openAlert(context: Context, request: TeamPushOpenRequest): TeamConversationTarget? {
        check(!BuildConfig.SGM_USE_FIREBASE_EMULATOR) { "Local phone messaging is explicitly disabled" }
        start(context)
        var target: TeamConversationTarget? = null
        checkNotNull(runtime).resolve(request, TeamPushAlertPurpose.Open) { target = it }
        return target
    }
}

private class RegistrationRuntime(private val context: Context) {
    private val auth = FirebaseAuth.getInstance()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val events = Channel<Unit>(Channel.CONFLATED)
    private var refreshRequired = true
    private val registration = FirebaseAndroidTeamPushRegistration(auth)
    private val alerts = FirebaseAndroidTeamPushAlert(auth)
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
        try {
            val changed = androidTeamPushJournal(context).current().ownerUid != firebase.currentUser?.uid
            lifecycle.accountChanged(firebase.currentUser?.uid)
            if (changed) clearAlerts()
            request(refresh = true)
        }
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
        try { lifecycle.signedOut(); clearAlerts(); request() }
        catch (_: Exception) { failed() }
    }
    suspend fun prepareSignOut(): SessionExitResult = try { lifecycle.prepareSignOut(::clearAlerts) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { failed(); throw ProviderConfigurationException("Impossible de confirmer la déconnexion.") }
        finally { request() }
    fun accountChanged() {
        try { lifecycle.accountChanged(auth.currentUser?.uid); clearAlerts(); request(refresh = true) }
        catch (_: Exception) { failed() }
    }
    fun requiresSignOut(uid: String): Boolean = lifecycle.requiresSignOut(uid)
    fun authorizeSignIn(uid: String) { lifecycle.authorizeSignIn(uid); request(refresh = true) }
    fun enqueue(id: String) {
        if (!teamNotificationsAllowed(context)) { permissionRevoked(); return }
        lifecycle.alertRequest(id)?.let { enqueueTeamPushAlert(context, it) }
    }
    suspend fun resolve(request: TeamPushOpenRequest, purpose: TeamPushAlertPurpose, consume: (TeamConversationTarget) -> Unit): Boolean {
        if (!lifecycle.acceptsAlert(request)) return false
        if (!teamNotificationsAllowed(context)) { permissionRevoked(); return false }
        return try { withTimeout(20_000L) {
            if (lifecycle.synchronize(teamNotificationsAllowed(context)) != TeamPushSyncResult.Registered) return@withTimeout false
            lifecycle.resolveAlert(request, purpose, alerts::resolve) { target ->
                if (!teamNotificationsAllowed(context)) { permissionRevoked(); throw TeamPushAlertUnavailableException() }
                consume(target)
            }
        } } catch (_: TimeoutCancellationException) { throw ProviderConfigurationException("Impossible de vérifier la notification. Réessayez.") }
        catch (cancelled: CancellationException) { currentCoroutineContext().ensureActive(); throw TeamPushAlertUnavailableException() }
    }
    private fun clearAlerts() { clearTeamPushNotifications(context); cancelTeamPushWork(context) }
    private fun permissionRevoked() { lifecycle.notificationsDisabled(); clearAlerts(); request() }
}
