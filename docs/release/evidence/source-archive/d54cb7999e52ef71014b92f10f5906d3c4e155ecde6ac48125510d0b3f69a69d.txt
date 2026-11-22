package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.launch

@Composable
internal fun TripChangeHistoryDialog(uid: String, role: AppRole, tripId: String, title: String,
    gateway: FirebaseGateway, onChanged: suspend () -> Unit, onDismiss: () -> Unit) {
    val state = remember(uid, role, tripId, gateway) { TripChangeHistoryState(tripId, gateway) }
    var proposal by remember(state) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state) { state.reload() }
    if (proposal != null) {
        TripChangeDialog(uid, role, tripId, title, proposal, gateway, onChanged = { onChanged(); state.reload() },
            onDismiss = { proposal = null; scope.launch { state.reload() } })
    } else Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(color = Sgm.colors.bgCard, modifier = Modifier.padding(12.dp).widthIn(max = 640.dp).fillMaxWidth().fillMaxHeight(0.94f)) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth()) {
                    Text("Historique des modifications", style = SgmType.BodyLG.copy(color = Sgm.colors.textPrimary),
                        modifier = Modifier.weight(1f).testTag("trip.history.title"))
                    IconButton(onDismiss, modifier = Modifier.semantics { contentDescription = "Fermer l’historique" }) {
                        SgmLineIcon(SgmIcon.ChevronLeft, tint = Sgm.colors.textPrimary, modifier = Modifier.size(20.dp))
                    }
                }
                Text(title, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
                if (state.busy) Text("Chargement...", modifier = Modifier.testTag("trip.history.busy"),
                    style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
                state.error?.let { Text(it, modifier = Modifier.testTag("trip.history.error"), style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
                if (state.loaded && state.items.isEmpty()) Text("Aucune modification.", modifier = Modifier.testTag("trip.history.empty"),
                    style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
                state.items.forEach { item ->
                    TextButton(onClick = { proposal = item.proposalId }, enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth().testTag("trip.history.open.${item.proposalId}")) {
                        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(tripChangeStatusLabel(item.status), style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
                            Text(tripChangeDate(item.createdAt), style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary))
                            Text("${tripChangeDate(item.departureAt)} · ${tripChangeMoney(item.priceCents)} / place",
                                style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
                        }
                    }
                }
                V2Button("Actualiser", { scope.launch { state.reload() } }, full = true, enabled = !state.busy,
                    variant = V2ButtonVariant.Secondary, testTag = "trip.history.refresh")
                if (state.hasMore) V2Button("Voir les précédentes", { scope.launch { state.more() } }, full = true,
                    enabled = !state.busy, variant = V2ButtonVariant.Secondary, testTag = "trip.history.more")
            }
        }
    }
}
