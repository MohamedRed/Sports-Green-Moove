package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TeamEnrollmentGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

internal class TeamEnrollmentState(private val uid: String, private val gateway: TeamEnrollmentGateway, val canChooseChild: Boolean,
    private val operationId: () -> String = { UUID.randomUUID().toString() }) {
    private fun page(kind: TeamEnrollmentOptionKind, contextId: String? = null) = GuardianPageState(
        { cursor -> gateway.teamOptions(uid, kind, contextId, cursor) }, GuardianOption::id)
    var clubs by mutableStateOf(page(TeamEnrollmentOptionKind.Clubs)); private set
    var teams by mutableStateOf(page(TeamEnrollmentOptionKind.Teams)); private set
    var children by mutableStateOf(page(TeamEnrollmentOptionKind.Children)); private set
    var clubId by mutableStateOf<String?>(null); private set
    var teamId by mutableStateOf<String?>(null); private set
    var childId by mutableStateOf<String?>(null); private set
    var childMode by mutableStateOf(false); private set
    var view by mutableStateOf<TeamEnrollmentView?>(null); private set
    var working by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var generation = 0L
    private var closed = false
    val busy get() = working || clubs.busy || teams.busy || children.busy
    val canReview get() = !closed && !busy && clubId != null && teamId != null &&
        (!childMode || childId != null) && teams.loaded && teams.items.any { it.id == teamId && it.name != null }

    suspend fun refresh() {
        if (closed || busy) return
        clear(); clubs.reload()
    }
    suspend fun chooseClub(id: String) {
        if (closed || busy || clubs.items.none { it.id == id && it.name != null }) return
        invalidate(); clubId = id; teamId = null; childId = null
        teams.close(); children.close(); teams = page(TeamEnrollmentOptionKind.Teams, id); children = page(TeamEnrollmentOptionKind.Children)
        teams.reload()
    }
    suspend fun chooseTeam(id: String) {
        if (closed || busy || teams.items.none { it.id == id && it.name != null }) return
        invalidate(); teamId = id; childId = null; children.close(); children = page(TeamEnrollmentOptionKind.Children, id)
        if (childMode) children.reload()
    }
    suspend fun chooseChildMode(child: Boolean) {
        if (closed || busy || child && !canChooseChild) return
        invalidate(); childMode = child; childId = null
        children.close(); children = page(TeamEnrollmentOptionKind.Children, teamId)
        if (child && teamId != null) children.reload()
    }
    fun chooseChild(id: String) {
        if (closed || busy || !childMode || children.items.none { it.id == id && it.name != null }) return
        invalidate(); childId = id
    }
    suspend fun review() {
        if (!canReview) return
        val target = requireNotNull(teamId); val child = childId.takeIf { childMode }; val club = requireNotNull(clubId)
        val ticket = ++generation
        view = null; error = null; notice = null; working = true
        try {
            val result = gateway.teamEnrollmentView(uid, target, child)
            currentCoroutineContext().ensureActive()
            check(result.teamId == target && result.childId == child && result.clubId == club && result.subjectId == (child ?: uid))
            if (current(ticket)) view = result
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = "Impossible de vérifier cette inscription. Actualisez." }
        finally { if (current(ticket)) working = false }
    }
    suspend fun submit(expected: TeamEnrollmentView, action: TeamEnrollmentAction) {
        if (closed || busy || view !== expected || action !in expected.allowedActions || expected.teamId != teamId ||
            expected.clubId != clubId || expected.childId != childId.takeIf { childMode } ||
            action == TeamEnrollmentAction.Request && (expected.subjectName == null || expected.teamName == null)) return
        val ticket = ++generation
        view = null; working = true; error = null; notice = null
        var acknowledged = false
        try {
            val receipt = gateway.changeTeamEnrollment(uid, expected, action, operationId())
            currentCoroutineContext().ensureActive(); if (!current(ticket)) return
            check(receipt.enrollmentId == expected.id && receipt.teamId == expected.teamId &&
                receipt.teamInstanceId == expected.teamInstanceId && receipt.revision > expected.revision)
            acknowledged = true; notice = if (action == TeamEnrollmentAction.Request) "Demande enregistrée." else "Retrait enregistré."
            val latest = gateway.teamEnrollmentView(uid, expected.teamId, expected.childId)
            currentCoroutineContext().ensureActive()
            check(latest.id == expected.id && latest.teamInstanceId == expected.teamInstanceId && latest.clubId == expected.clubId &&
                latest.teamId == expected.teamId && latest.childId == expected.childId && latest.subjectId == expected.subjectId && latest.revision >= receipt.revision)
            if (current(ticket)) view = latest
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = if (acknowledged) "Modification enregistrée. Vérifiez l’inscription avant de continuer."
            else "Modification non confirmée. Vérifiez l’inscription avant de réessayer."
        } finally { if (current(ticket)) working = false }
    }
    private fun invalidate() { generation++; view = null; error = null; notice = null }
    private fun current(ticket: Long) = !closed && generation == ticket
    fun clear() {
        invalidate(); clubs.close(); teams.close(); children.close()
        clubs = page(TeamEnrollmentOptionKind.Clubs); teams = page(TeamEnrollmentOptionKind.Teams); children = page(TeamEnrollmentOptionKind.Children)
        clubId = null; teamId = null; childId = null; childMode = false; working = false
    }
    fun close() { clear(); closed = true }
}
