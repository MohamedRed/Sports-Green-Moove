package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.GuardianVerificationGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

internal class GuardianVerificationState(private val uid: String, private val gateway: GuardianVerificationGateway,
    private val operationId: () -> String = { UUID.randomUUID().toString() }) {
    val children = GuardianPageState({ cursor -> gateway.guardianOptions(uid, GuardianOptionKind.Children, cursor) }, GuardianOption::id)
    val clubs = GuardianPageState({ cursor -> gateway.guardianOptions(uid, GuardianOptionKind.Clubs, cursor) }, GuardianOption::id)
    val history = GuardianPageState({ cursor -> gateway.guardianHistory(uid, cursor).also { page ->
        check(page.items.all { it.parentUserId == uid && it.status != null })
    } }, GuardianVerification::id)
    var childId by mutableStateOf<String?>(null); private set
    var clubId by mutableStateOf<String?>(null); private set
    var view by mutableStateOf<GuardianVerification?>(null); private set
    var working by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var reference: Pair<String, String>? = null
    private var generation = 0L
    private var closed = false
    val busy get() = working || children.busy || clubs.busy || history.busy
    val canReview get() = !closed && !busy && children.loaded && clubs.loaded &&
        children.items.any { it.id == childId && it.name != null } && clubs.items.any { it.id == clubId && it.name != null }

    suspend fun load() {
        if (closed || busy) return
        val ticket = ++generation
        working = true; view = null; reference = null; error = null; notice = null
        try { children.reload(); clubs.reload(); history.reload() }
        finally { if (current(ticket)) working = false }
    }
    fun selectChild(id: String) {
        if (busy || closed || children.items.none { it.id == id && it.name != null }) return
        childId = id; clearReview()
    }
    fun selectClub(id: String) {
        if (busy || closed || clubs.items.none { it.id == id && it.name != null }) return
        clubId = id; clearReview()
    }
    suspend fun reviewSelection() { if (canReview) read(requireNotNull(clubId), requireNotNull(childId)) }
    suspend fun reviewHistory(item: GuardianVerification) {
        if (!closed && !busy && history.items.any { it === item }) read(item.clubId, item.childId)
    }
    suspend fun refresh() {
        if (busy || closed) return
        val target = reference
        load()
        if (target != null && !closed) read(target.first, target.second)
    }
    private suspend fun read(club: String, child: String) {
        if (closed || busy) return
        val ticket = ++generation
        reference = club to child; view = null; error = null; notice = null; working = true
        try {
            val result = gateway.guardianView(uid, club, child)
            currentCoroutineContext().ensureActive()
            check(result.parentUserId == uid && result.clubId == club && result.childId == child)
            if (current(ticket)) view = result
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = "Impossible de vérifier cette demande. Actualisez." }
        finally { if (current(ticket)) working = false }
    }
    suspend fun submit(expected: GuardianVerification, action: GuardianParentAction) {
        if (closed || busy || view !== expected || action !in expected.allowedActions || expected.parentUserId != uid ||
            action == GuardianParentAction.Request && (expected.childName == null || expected.clubName == null)) return
        val ticket = ++generation
        view = null; error = null; notice = null; working = true
        var acknowledged = false
        try {
            val receipt = gateway.transitionGuardian(GuardianParentOperation(expected.clubId, expected.childId, uid, action,
                expected.revision, operationId()))
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            check(receipt.verificationId == expected.id && receipt.revision > expected.revision)
            acknowledged = true
            notice = if (action == GuardianParentAction.Request) "Demande enregistrée." else "Retrait enregistré."
            val latest = gateway.guardianView(uid, expected.clubId, expected.childId)
            currentCoroutineContext().ensureActive()
            check(latest.parentUserId == uid && latest.clubId == expected.clubId && latest.childId == expected.childId)
            if (!current(ticket)) return
            view = latest
            history.reload()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = if (acknowledged)
            "Demande enregistrée. Actualisez pour vérifier son état." else "Demande non confirmée. Actualisez avant de réessayer."
        } finally { if (current(ticket)) working = false }
    }
    private fun clearReview() { view = null; reference = null; error = null; notice = null; generation++ }
    private fun current(ticket: Long) = !closed && generation == ticket
    fun close() {
        closed = true; generation++; children.close(); clubs.close(); history.close()
        childId = null; clubId = null; reference = null; view = null; error = null; notice = null; working = false
    }
}
