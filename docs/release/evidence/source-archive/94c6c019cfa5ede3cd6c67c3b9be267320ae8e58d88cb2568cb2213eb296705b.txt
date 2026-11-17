package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.SupportGateway
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
internal fun SupportInboxRoute(uid: String, gateway: SupportGateway, onBack: () -> Unit) {
    val state = remember(uid, gateway) { SupportInboxState(uid, gateway) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { state.refresh(); awaitCancellation() } finally { state.clear() }
        }
    }
    SupportInboxScreen(state, onBack = { if (state.selectedId == null) onBack() else scope.launch { state.back() } },
        onRefresh = { scope.launch { state.refresh() } }, onMore = { scope.launch { state.more() } },
        onOpen = { scope.launch { state.open(it) } })
}

@Composable
internal fun SupportInboxScreen(state: SupportInboxState, onBack: () -> Unit, onRefresh: () -> Unit,
    onMore: () -> Unit, onOpen: (String) -> Unit) {
    BackHandler(onBack = onBack)
    V2Screen(testTag = "support.inbox") {
        V2TopBar(if (state.selectedId == null) "MES DEMANDES" else "MA DEMANDE", onBack = onBack, trailing = {
            V2CircleIconButton(SgmIcon.Refresh, onRefresh, size = 44, enabled = !state.busy,
                testTag = "support.refresh", description = "Actualiser les demandes")
        })
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            if (state.busy) SupportText("Chargement...", "support.loading")
            state.error?.let { SupportText(it, "support.error") }
            if (state.loaded && state.selectedId == null && state.reports.isEmpty()) SupportText("Vous n’avez pas encore de demande.", "support.empty")
            if (state.selectedId == null) state.reports.forEach { report ->
                Column(Modifier.fillMaxWidth().testTag("support.report.${report.id}")
                    .clickable(enabled = !state.busy, role = Role.Button) { onOpen(report.id) }.padding(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(report.reason, style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                    SupportText(report.status.label, "support.status.${report.id}")
                    SupportText(supportDate(report.createdAtMillis), "support.date.${report.id}")
                    report.lastReply?.let { SupportText(it.text, "support.latest.${report.id}") }
                }
            }
            state.detail?.let { detail ->
                Text(detail.report.reason, style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                SupportText(detail.report.status.label, "support.detail.status")
                SupportText(detail.report.description, "support.detail.description")
                SupportText(supportDate(detail.report.createdAtMillis), "support.detail.date")
                if (detail.report.emergency) SupportText("Demande signalée urgente", "support.detail.urgent")
                if (detail.replies.items.isEmpty()) SupportText("Aucune réponse pour le moment.", "support.replies.empty")
                detail.replies.items.forEach { reply ->
                    Column(Modifier.fillMaxWidth().testTag("support.reply.${reply.id}"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SupportText(supportDate(reply.sentAtMillis), "support.reply-date.${reply.id}")
                        SupportText(reply.text, "support.reply-text.${reply.id}")
                    }
                }
            }
            if (state.hasMore) GuardianActionButton("Charger la suite", "support.more", !state.busy, onMore)
            Spacer(Modifier.height(76.dp))
        }
    }
}

@Composable
private fun SupportText(text: String, tag: String) = Text(text, style = SgmType.BodySM,
    color = Sgm.colors.textPrimary, modifier = Modifier.fillMaxWidth().testTag(tag))
private fun supportDate(time: Long) = DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(time))
