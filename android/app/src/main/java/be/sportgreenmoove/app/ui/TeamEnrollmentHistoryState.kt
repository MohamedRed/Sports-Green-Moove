package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TeamEnrollmentGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

internal class TeamEnrollmentHistoryState(private val uid: String, private val gateway: TeamEnrollmentGateway,
    private val operationId: () -> String = { UUID.randomUUID().toString() }) {
    private fun page() = GuardianPageState({ cursor -> gateway.ownedTeamEnrollments(uid, cursor) }, TeamEnrollmentView::id)
    var requests by mutableStateOf(page()); private set
    var selected by mutableStateOf<TeamEnrollmentView?>(null); private set
    var working by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var generation = 0L
    private var closed = false
    val busy get() = working || requests.busy

    suspend fun refresh() {
        if (closed || busy) return
        clear(); requests.reload()
    }
    suspend fun select(id: String) {
        if (closed || busy || requests.items.none { it.id == id }) return
        val expected = requests.items.single { it.id == id }
        val ticket = ++generation
        selected = null; working = true; error = null; notice = null
        try {
            val view = gateway.ownedTeamEnrollmentView(uid, id)
            currentCoroutineContext().ensureActive()
            check(view.id == id && view.status != null && view.teamId == expected.teamId && view.clubId == expected.clubId &&
                view.teamInstanceId == expected.teamInstanceId && view.subjectId == expected.subjectId &&
                view.childId == expected.childId && view.revision >= expected.revision)
            if (current(ticket)) selected = view
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = "Impossible de consulter cette demande. Actualisez." }
        finally { if (current(ticket)) working = false }
    }
    suspend fun more() { if (!closed && !busy) requests.more() }
    fun dismiss() { if (!working) { generation++; selected = null } }
    suspend fun withdraw(expected: TeamEnrollmentView) {
        if (closed || busy || selected !== expected || TeamEnrollmentAction.Withdraw !in expected.allowedActions) return
        val ticket = ++generation
        selected = null; working = true; error = null; notice = null
        var acknowledged = false
        try {
            val receipt = gateway.withdrawOwnedTeamEnrollment(uid, expected, operationId())
            currentCoroutineContext().ensureActive(); if (!current(ticket)) return
            check(receipt.enrollmentId == expected.id && receipt.teamId == expected.teamId &&
                receipt.teamInstanceId == expected.teamInstanceId && receipt.status == TeamEnrollmentStatus.Withdrawn && receipt.revision > expected.revision)
            acknowledged = true; notice = "Retrait enregistré."
            val view = gateway.ownedTeamEnrollmentView(uid, expected.id)
            currentCoroutineContext().ensureActive()
            check(view.id == expected.id && view.teamId == expected.teamId && view.teamInstanceId == expected.teamInstanceId && view.clubId == expected.clubId &&
                view.subjectId == expected.subjectId && view.childId == expected.childId && view.revision >= receipt.revision)
            if (current(ticket)) { selected = view; requests.reload() }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = if (acknowledged) "Retrait enregistré. Vérifiez la demande avant de continuer."
            else "Retrait non confirmé. Vérifiez la demande avant de réessayer." }
        finally { if (current(ticket)) working = false }
    }
    private fun current(ticket: Long) = !closed && generation == ticket
    fun clear() {
        generation++; requests.close(); requests = page(); selected = null; working = false; error = null; notice = null
    }
    fun close() { clear(); closed = true }
}
