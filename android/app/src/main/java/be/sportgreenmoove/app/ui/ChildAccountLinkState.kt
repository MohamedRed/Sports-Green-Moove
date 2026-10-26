package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CancellationException
import java.util.Locale

internal class ChildAccountLinkState(private val uid: String, private val target: ChildAccountLinkTarget?,
    private val gateway: ChildAccountLinkGateway, private val now: () -> Long = System::currentTimeMillis) {
    var code by mutableStateOf<ChildAccountLinkCode?>(null); private set
    var input by mutableStateOf(""); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var approved by mutableStateOf(false); private set
    private var generation = 0L
    private var closed = false
    val canApprove get() = target != null && !busy && !approved && Regex("[a-f0-9]{32}").matches(input)
    fun edit(value: String) { if (!busy && !approved && !closed) input = value.filterNot { it.isWhitespace() }.lowercase(Locale.ROOT).take(128) }
    fun leaveForeground() { generation++; code = null; input = ""; error = null; busy = false; approved = false }
    fun close() { leaveForeground(); closed = true }
    fun expireCode() { if (code?.let { it.expiresAtMillis <= now() } == true) code = null }
    suspend fun create() {
        if (closed || target != null || busy || code != null) return
        val ticket = ++generation; busy = true; code = null; error = null
        try {
            val value = gateway.createCode(uid)
            if (ticket != generation || closed) return
            check(value.accountUserId == uid && Regex("[a-f0-9]{32}").matches(value.code) && value.expiresAtMillis > now())
            code = value
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (ticket == generation && !closed) error = UserFacingErrorPolicy.messageFor(failure) }
        finally { if (ticket == generation) busy = false }
    }
    suspend fun approve() {
        val selected = target ?: return
        if (closed || !canApprove) return
        val ticket = ++generation; busy = true; error = null
        try {
            val value = gateway.approve(uid, selected, input)
            if (ticket != generation || closed) return
            check(value.accountUserId != uid && value.accountUserId.isNotBlank() &&
                value.childId == selected.childId && value.childInstanceId == selected.childInstanceId)
            input = ""; approved = true
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (ticket == generation && !closed) error = UserFacingErrorPolicy.messageFor(failure) }
        finally { if (ticket == generation) busy = false }
    }
}
