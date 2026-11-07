package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CancellationException

internal class ChildInvitationState(private val uid: String, private val target: ChildAccountLinkTarget,
    private val gateway: ChildInvitationGateway, private val now: () -> Long = System::currentTimeMillis) {
    var current by mutableStateOf<ChildInvitationStatus?>(null); private set
    var busy by mutableStateOf(false); private set
    var loaded by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    private var link: ChildInvitationLink? = null
    private var closed = false
    private var generation = 0L
    val canCreate get() = !closed && loaded && !busy && current?.status !in setOf("provisioning", "accepted")
    val canRevoke get() = !closed && loaded && !busy && current?.status == "pending"
    val canShare get() = !closed && loaded && !busy && current?.status == "pending" && link?.current?.invitationHash == current?.invitationHash &&
        link?.current?.expiresAtMillis?.let { it > now() } == true
    fun leaveForeground() { generation++; busy = false; loaded = false; current = null; link = null; error = null }
    fun close() { leaveForeground(); closed = true }
    private suspend fun operation(action: suspend () -> Pair<ChildInvitationStatus?, ChildInvitationLink?>) {
        if (closed || busy) return
        val ticket = ++generation; busy = true; loaded = false; link = null; error = null
        try {
            val (status, receipt) = action()
            if (ticket != generation || closed) return
            current = status; link = receipt; loaded = true
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            if (ticket == generation && !closed) { current = null; error = UserFacingErrorPolicy.messageFor(failure) }
        } finally { if (ticket == generation) busy = false }
    }
    suspend fun refresh() = operation { gateway.current(uid, target) to null }
    suspend fun create() {
        if (!canCreate) return
        operation {
            val value = gateway.create(uid, target); validateInvitationLink(value, target, now())
            value.current to value
        }
    }
    suspend fun revoke() {
        if (!canRevoke) return
        val original = requireNotNull(current)
        operation {
            gateway.revoke(uid, target, original.invitationHash)
            original.copy(status = "revoked") to null
        }
    }
    fun share(action: (String) -> Unit) {
        if (!canShare) return
        val value = requireNotNull(link); validateInvitationLink(value, target, now())
        try { action(value.url) }
        catch (_: Exception) { error = "Le partage est indisponible." }
    }
}
